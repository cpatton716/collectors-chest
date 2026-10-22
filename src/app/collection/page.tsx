"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";

import { useUser } from "@clerk/nextjs";

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  DollarSign,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Receipt,
  Share2,
  Star,
  TrendingUp,
  X,
} from "lucide-react";

import { pruneSelection } from "@/lib/bulkActions";
import { exportCollectionToCSV } from "@/lib/csvExport";
import { resolveSelectedListId } from "@/lib/features";
import { COLLECTION_PAGE_SIZE, getUserComicsPage } from "@/lib/db";
import { calculateCollectionValue, getComicValue } from "@/lib/gradePrice";
import { storage } from "@/lib/storage";

import { isSalePriceMissing, useCollection } from "@/hooks/useCollection";
import { useSelection } from "@/hooks/useSelection";
import { useSubscription } from "@/hooks/useSubscription";

import { CollectionGrid } from "@/components/collection/CollectionGrid";
import { CollectionToolbar } from "@/components/collection/CollectionToolbar";
import { SelectionHeader } from "@/components/collection/SelectionHeader";
import { SelectionToolbar } from "@/components/collection/SelectionToolbar";
import { UndoToast } from "@/components/collection/UndoToast";
import { ComicImage } from "@/components/ComicImage";
import { ComicListItem as _ComicListItem } from "@/components/ComicListItem";
import { FeatureButton } from "@/components/FeatureGate";
import { CollectionPageSkeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";

import { CollectionItem } from "@/types/comic";

// Heavy modals/forms are code-split so they only download when first opened.
// These are client-only overlays, so SSR is disabled.
const ComicDetailModal = dynamic(
  () => import("@/components/ComicDetailModal").then((m) => m.ComicDetailModal),
  { ssr: false }
);
const ComicDetailsForm = dynamic(
  () => import("@/components/ComicDetailsForm").then((m) => m.ComicDetailsForm),
  { ssr: false }
);
const ShareCollectionModal = dynamic(
  () => import("@/components/ShareCollectionModal").then((m) => m.ShareCollectionModal),
  { ssr: false }
);
const BulkDeleteModal = dynamic(
  () => import("@/components/collection/BulkDeleteModal").then((m) => m.BulkDeleteModal),
  { ssr: false }
);
const BulkListPickerModal = dynamic(
  () => import("@/components/collection/BulkListPickerModal").then((m) => m.BulkListPickerModal),
  { ssr: false }
);

type ViewMode = "grid" | "list";
type SortOption = "date" | "title" | "value" | "value-asc" | "issue" | "grade";
type FilterOption = "all" | string;

/**
 * Per-comic instruction for the bulk "Mark as Sold" flow (H-CO1).
 * `priceRecorded:false` means the sale is logged WITHOUT a value (skip pricing);
 * the row is persisted with `sale_price_recorded=false` so revenue/PL math can
 * exclude it instead of treating $0 as a real sale.
 */
export interface BulkSaleEntry {
  id: string;
  salePrice: number;
  priceRecorded: boolean;
}

/**
 * Pure skip→flag mapping helper (H-CO1, testable in isolation).
 * Given the selected comic ids and an optional draft of typed prices, build the
 * per-item sale entries. When `skipped` is true every entry is flagged
 * price-not-recorded (price 0); otherwise each entry carries its typed price
 * (defaulting to 0) and is flagged recorded.
 */
export function buildBulkSaleEntries(
  ids: string[],
  drafts: Record<string, number | undefined>,
  skipped: boolean
): BulkSaleEntry[] {
  return ids.map((id) => {
    if (skipped) {
      return { id, salePrice: 0, priceRecorded: false };
    }
    const price = drafts[id];
    const numeric = typeof price === "number" && Number.isFinite(price) ? price : 0;
    return { id, salePrice: numeric, priceRecorded: true };
  });
}

export default function CollectionPage() {
  return (
    <Suspense>
      <CollectionPageContent />
    </Suspense>
  );
}

function CollectionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn: _isSignedIn, isLoaded: authLoaded } = useUser();
  const { showToast } = useToast();
  const { features: _features } = useSubscription();

  // Use the collection hook for cloud sync
  const {
    collection: hookCollection,
    lists,
    sales,
    isLoading: collectionLoading,
    isCloudEnabled: _isCloudEnabled,
    profileId,
    addToCollection: _addToCollection,
    updateCollectionItem: updateItem,
    createList: createNewList,
    addItemToList,
    removeItemFromList,
    recordSale,
    getCollectionStats: _getCollectionStats,
    getSalesStats,
    refresh,
  } = useCollection();

  // M-CO9: pagination. The hook loads the first page (COLLECTION_PAGE_SIZE);
  // additional pages are fetched on demand via `Load more` and appended here so
  // we never pull the whole collection at once. Reset when the underlying
  // first-page data reloads (refresh/auth change).
  const [extraPages, setExtraPages] = useState<CollectionItem[]>([]);
  const [nextOffset, setNextOffset] = useState(COLLECTION_PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // The full working set = hook's first page + any pages we loaded, deduped
  // (a refresh can re-introduce ids that also live in extraPages).
  const collection = useMemo(() => {
    if (extraPages.length === 0) return hookCollection;
    const seen = new Set(hookCollection.map((i) => i.id));
    const merged = [...hookCollection];
    for (const item of extraPages) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        merged.push(item);
      }
    }
    return merged;
  }, [hookCollection, extraPages]);

  // When the hook reloads its first page, the first page is "full" (=== page
  // size) iff more rows may exist. Reset the appended pages + offset cursor.
  useEffect(() => {
    setExtraPages([]);
    setNextOffset(COLLECTION_PAGE_SIZE);
    setHasMore(hookCollection.length >= COLLECTION_PAGE_SIZE);
  }, [hookCollection]);

  const handleLoadMore = async () => {
    if (!profileId || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const page = await getUserComicsPage(profileId, {
        offset: nextOffset,
        limit: COLLECTION_PAGE_SIZE,
      });
      setExtraPages((prev) => [...prev, ...page.items]);
      setNextOffset(page.nextOffset);
      setHasMore(page.hasMore);
    } catch {
      showToast("Failed to load more comics", "error");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedList, setSelectedList] = useState<string>("collection");
  // Fall back to the full collection if the selected list is no longer
  // visible (e.g. the "For Sale" list hidden while the marketplace is off).
  useEffect(() => {
    const resolved = resolveSelectedListId(selectedList, lists);
    if (resolved !== selectedList) setSelectedList(resolved);
  }, [selectedList, lists]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [showForTradeOnly, setShowForTradeOnly] = useState(false);
  const [editingItem, setEditingItem] = useState<CollectionItem | null>(null);
  const [publisherFilter, setPublisherFilter] = useState<FilterOption>("all");
  const [titleFilter, setTitleFilter] = useState<FilterOption>("all");
  const [gradingCompanyFilter, setGradingCompanyFilter] = useState<FilterOption>("all");
  const [gradeFilter, setGradeFilter] = useState<FilterOption>("all");
  const [showFinancials, setShowFinancials] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);

  // Selection state
  const {
    isSelectionMode,
    selectedIds,
    selectionCount,
    hasSelection: _hasSelection,
    checkIsAllSelected,
    enterSelectionMode,
    exitSelectionMode,
    toggle: toggleSelection,
    selectAllVisible,
    clearAll: clearSelection,
  } = useSelection();

  // Bulk action modals
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkListPicker, setShowBulkListPicker] = useState(false);
  // H-CO1: bulk "Mark as Sold" per-item price modal + its draft prices.
  const [showBulkSoldModal, setShowBulkSoldModal] = useState(false);
  const [bulkSalePrices, setBulkSalePrices] = useState<Record<string, number | undefined>>({});
  const [isSubmittingBulkSold, setIsSubmittingBulkSold] = useState(false);
  const [undoState, setUndoState] = useState<{
    message: string;
    comicIds: string[];
  } | null>(null);

  const salesStats = getSalesStats();
  // H-CO1: count sold books with no recorded sale value so revenue/PL stats can
  // disclose that some sales aren't reflected in the totals. Uses B10's
  // `isSalePriceMissing` so the definition of "no value" stays single-sourced.
  const unpricedSalesCount = useMemo(
    () => sales.filter((sale) => isSalePriceMissing(sale)).length,
    [sales]
  );
  const isLoaded = authLoaded && !collectionLoading;

  // Read URL search params on mount (for deep links from stats page)
  useEffect(() => {
    const gradeParam = searchParams.get("grade");
    const gradingCompanyParam = searchParams.get("gradingCompany");
    const publisherParam = searchParams.get("publisher");
    const sortParam = searchParams.get("sortBy") as SortOption | null;

    if (gradeParam) setGradeFilter(gradeParam);
    if (gradingCompanyParam) setGradingCompanyFilter(gradingCompanyParam);
    if (publisherParam) setPublisherFilter(publisherParam);
    if (sortParam) setSortBy(sortParam);
  }, [searchParams]);

  // Tell the mobile bottom nav to hide while we're in multi-select mode so its
  // floating bar never covers the selection action toolbar.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("cc:selection-mode", { detail: { active: isSelectionMode } }),
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent("cc:selection-mode", { detail: { active: false } }),
      );
    };
  }, [isSelectionMode]);

  // Welcome toast for promo trial users
  useEffect(() => {
    if (searchParams.get("welcome") === "promo") {
      showToast("Welcome! Your 30-day Premium trial is active. Start scanning!", "success");
      // Clean up the URL param
      router.replace("/collection");
    }
  }, [searchParams, showToast, router]);

  // Fetch show_financials preference
  useEffect(() => {
    async function fetchPreferences() {
      try {
        const res = await fetch("/api/settings/preferences");
        if (res.ok) {
          const data = await res.json();
          setShowFinancials(data.showFinancials ?? true);
        }
      } catch {
        // Default to showing financials on error
      }
    }
    if (_isSignedIn) fetchPreferences();
  }, [_isSignedIn]);

  const toggleFinancials = async () => {
    const newValue = !showFinancials;
    setShowFinancials(newValue);
    try {
      await fetch("/api/settings/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showFinancials: newValue }),
      });
    } catch {
      setShowFinancials(!newValue); // Rollback on error
    }
  };

  // Get unique publishers and titles for filters
  const uniquePublishers = useMemo(
    () =>
      Array.from(
        new Set(
          collection.map((item) => item.comic.publisher).filter((p): p is string => Boolean(p))
        )
      ).sort(),
    [collection]
  );
  const uniqueTitles = useMemo(
    () =>
      Array.from(
        new Set(collection.map((item) => item.comic.title).filter((t): t is string => Boolean(t)))
      ).sort(),
    [collection]
  );
  const uniqueGradingCompanies = useMemo(
    () =>
      Array.from(
        new Set(collection.map((item) => item.gradingCompany).filter((g): g is string => Boolean(g)))
      ).sort(),
    [collection]
  );

  // The "My Collection" primary list is the union view - items present in
  // the collection don't tag themselves with its id. Other auto-seeded
  // lists (Want List, For Sale, Slabbed, Passed-on) ALSO carry
  // isDefault=true but ARE member-tagged like custom lists. Detect the
  // primary list by id-sentinel (guest) or by name (cloud).
  const isPrimaryList = (list: { id: string; name: string } | undefined) =>
    !!list && (list.id === "collection" || list.name === "My Collection");
  const isDefaultListSelected =
    selectedList === "collection" ||
    isPrimaryList(lists.find((l) => l.id === selectedList));

  // Count of active *filters* (excludes search, sort, list - those have
  // their own visible controls). Drives the "Filters (N)" badge on mobile
  // and decides whether to render the active-chips bar.
  const activeFilterCount = [
    showStarredOnly,
    showForTradeOnly,
    publisherFilter !== "all",
    titleFilter !== "all",
    uniqueGradingCompanies.length > 0 && gradingCompanyFilter !== "all",
  ].filter(Boolean).length;

  // Filter and sort collection (memoized so we don't re-walk the whole
  // collection on every unrelated re-render, e.g. opening a modal).
  const filteredCollection = useMemo(
    () =>
      collection
    .filter((item) => {
      // Filter by list - skip filtering when "My Collection" is selected
      if (!isDefaultListSelected) {
        if (!item.listIds.includes(selectedList)) return false;
      }

      // Filter by starred
      if (showStarredOnly && !item.isStarred) {
        return false;
      }

      // Filter by for trade
      if (showForTradeOnly && !item.forTrade) {
        return false;
      }

      // Filter by publisher
      if (publisherFilter !== "all" && item.comic.publisher !== publisherFilter) {
        return false;
      }

      // Filter by title
      if (titleFilter !== "all" && item.comic.title !== titleFilter) {
        return false;
      }

      // Filter by grading company
      if (gradingCompanyFilter !== "all" && item.gradingCompany !== gradingCompanyFilter) {
        return false;
      }

      // Filter by grade (supports comma-separated multiselect from stats page)
      if (gradeFilter !== "all") {
        const itemGrade = item.comic.grade || (item.conditionGrade ? String(item.conditionGrade) : null);
        const grades = gradeFilter.split(",");
        if (!itemGrade || !grades.includes(itemGrade)) return false;
      }

      // Filter by search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          item.comic.title?.toLowerCase().includes(query) ||
          item.comic.publisher?.toLowerCase().includes(query) ||
          item.comic.writer?.toLowerCase().includes(query) ||
          item.comic.issueNumber?.includes(query)
        );
      }

      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "title":
          return (a.comic.title || "").localeCompare(b.comic.title || "");
        case "value":
          return getComicValue(b) - getComicValue(a);
        case "value-asc":
          return getComicValue(a) - getComicValue(b);
        case "grade": {
          const gradeA = parseFloat(a.comic.grade || (a.conditionGrade ? String(a.conditionGrade) : "0"));
          const gradeB = parseFloat(b.comic.grade || (b.conditionGrade ? String(b.conditionGrade) : "0"));
          return gradeB - gradeA; // Highest grade first
        }
        case "issue":
          return parseInt(a.comic.issueNumber || "0") - parseInt(b.comic.issueNumber || "0");
        case "date":
        default:
          return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
      }
    }),
    [
      collection,
      isDefaultListSelected,
      selectedList,
      showStarredOnly,
      showForTradeOnly,
      publisherFilter,
      titleFilter,
      gradingCompanyFilter,
      gradeFilter,
      searchQuery,
      sortBy,
    ]
  );

  // Calculate stats for current view using grade-aware pricing
  const filteredValue = useMemo(
    () => calculateCollectionValue(filteredCollection),
    [filteredCollection]
  );
  const totalCollectionValue = useMemo(
    () => calculateCollectionValue(collection),
    [collection]
  );
  const isFiltered = filteredCollection.length !== collection.length;

  const stats = useMemo(
    () => ({
      count: filteredCollection.length,
      totalCount: collection.length,
      totalValue: filteredValue.totalValue,
      fullCollectionValue: totalCollectionValue.totalValue,
      unpricedCount: filteredValue.unpricedCount,
      totalCost: filteredCollection.reduce((sum, item) => sum + (item.purchasePrice || 0), 0),
      forSale: filteredCollection.filter((item) => item.forSale).length,
    }),
    [filteredCollection, collection.length, filteredValue, totalCollectionValue]
  );
  const profitLoss = stats.totalValue - stats.totalCost;
  const _profitLossPercent = stats.totalCost > 0 ? (profitLoss / stats.totalCost) * 100 : 0;

  // Get selected items
  const selectedItems = useMemo(
    () => filteredCollection.filter((item) => selectedIds.has(item.id)),
    [filteredCollection, selectedIds]
  );
  const visibleIds = useMemo(
    () => filteredCollection.map((item) => item.id),
    [filteredCollection]
  );

  // Prune selected IDs that scroll out of view when filters/search change so
  // bulk actions never act on a hidden, still-selected comic (L-CO23).
  useEffect(() => {
    if (!isSelectionMode || selectedIds.size === 0) return;
    const pruned = pruneSelection(selectedIds, visibleIds);
    if (pruned.size !== selectedIds.size) {
      selectAllVisible(Array.from(pruned));
    }
  }, [isSelectionMode, selectedIds, visibleIds, selectAllVisible]);

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedItems.length >= 10) {
      setShowBulkDeleteModal(true);
      return;
    }
    await executeBulkDelete();
  };

  const executeBulkDelete = async () => {
    setShowBulkDeleteModal(false);
    const idsToDelete = Array.from(selectedIds);

    try {
      const response = await fetch("/api/comics/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comicIds: idsToDelete }),
      });

      if (!response.ok) throw new Error("Failed to delete");

      // Show undo toast
      setUndoState({
        message: `${idsToDelete.length} comics deleted`,
        comicIds: idsToDelete,
      });

      // Exit selection mode and refresh
      exitSelectionMode();
      refresh();
    } catch {
      showToast("Failed to delete comics", "error");
    }
  };

  const handleUndoDelete = async () => {
    if (!undoState) return;

    try {
      const response = await fetch("/api/comics/undo-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comicIds: undoState.comicIds }),
      });

      if (!response.ok) throw new Error("Failed to undo");

      setUndoState(null);
      refresh();
    } catch {
      showToast("Failed to restore comics", "error");
    }
  };

  const handleExpireUndo = useCallback(() => {
    setUndoState(null);
  }, []);

  // Bulk mark for trade handler
  const handleBulkMarkForTrade = async () => {
    const idsToUpdate = Array.from(selectedIds);

    try {
      const response = await fetch("/api/comics/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comicIds: idsToUpdate,
          field: "for_trade",
          value: true,
        }),
      });

      if (!response.ok) throw new Error("Failed to update");

      exitSelectionMode();
      refresh();
      showToast(`${idsToUpdate.length} comics marked for trade`, "success");
    } catch {
      showToast("Failed to mark for trade", "error");
    }
  };

  // Bulk add to list handler
  const handleBulkAddToList = async (listId: string) => {
    const idsToAdd = Array.from(selectedIds);
    setShowBulkListPicker(false);

    try {
      const response = await fetch("/api/comics/bulk-add-to-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comicIds: idsToAdd, listId }),
      });

      if (!response.ok) throw new Error("Failed to add to list");

      exitSelectionMode();
      refresh();
      const list = lists.find((l) => l.id === listId);
      showToast(`${idsToAdd.length} comics added to "${list?.name}"`, "success");
    } catch {
      showToast("Failed to add to list", "error");
    }
  };

  // Bulk mark as sold handler (H-CO1). Instead of a blind flag flip, open a
  // SKIPPABLE per-item price prompt: each selected book gets a sale price field
  // pre-filled with its FMV estimate (where available). The user can enter
  // prices and proceed (records a real sale per comic) or skip pricing (records
  // each sale flagged price-not-recorded so revenue/PL math can exclude it).
  const handleBulkMarkSold = () => {
    const prefill: Record<string, number | undefined> = {};
    for (const item of selectedItems) {
      const fmv = getComicValue(item);
      prefill[item.id] = fmv > 0 ? Math.round(fmv * 100) / 100 : undefined;
    }
    setBulkSalePrices(prefill);
    setShowBulkSoldModal(true);
  };

  // Records a real sale for every selected comic. `skipped` controls whether
  // prices are written: false → use the typed/pre-filled prices; true →
  // persist each sale with priceRecorded=false (sale_price_recorded=false per
  // migration / B10 shape), so the book is auditable as "sold, no value".
  const submitBulkSold = async (skipped: boolean) => {
    if (isSubmittingBulkSold) return;
    const ids = selectedItems.map((i) => i.id);
    if (ids.length === 0) {
      setShowBulkSoldModal(false);
      return;
    }
    setIsSubmittingBulkSold(true);

    const entries = buildBulkSaleEntries(ids, bulkSalePrices, skipped);
    const byId = new Map(selectedItems.map((i) => [i.id, i]));

    let succeeded = 0;
    let failed = 0;
    for (const entry of entries) {
      const item = byId.get(entry.id);
      if (!item) continue;
      try {
        // B10 endpoint shape: recordSale(item, salePrice, buyerId?, priceRecorded?).
        // priceRecorded=false → backend writes sale_price_recorded=false + null/0 price.
        await recordSale(item, entry.salePrice, undefined, entry.priceRecorded);
        succeeded += 1;
      } catch {
        failed += 1;
      }
    }

    setIsSubmittingBulkSold(false);
    setShowBulkSoldModal(false);
    setBulkSalePrices({});
    exitSelectionMode();
    refresh();

    if (failed === 0) {
      showToast(
        skipped
          ? `${succeeded} comics marked as sold (price not recorded)`
          : `${succeeded} comics marked as sold`,
        "success"
      );
    } else if (succeeded > 0) {
      showToast(`${succeeded} sold, ${failed} failed`, "info");
    } else {
      showToast("Failed to mark as sold", "error");
    }
  };

  // Stable handler identities keep the memoized ComicCard from re-rendering
  // on unrelated parent state changes (M-CO8).
  const handleComicClick = useCallback((item: CollectionItem) => {
    setSelectedItem(item);
    storage.addToRecentlyViewed(item.id);
  }, []);

  const handleCloseModal = () => {
    setSelectedItem(null);
  };

  const handleRemove = async (id: string) => {
    const item = collection.find((c) => c.id === id);
    const title = item?.comic?.title || "Comic";
    try {
      const response = await fetch("/api/comics/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comicIds: [id] }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.error === "active_listing") {
          const error = new Error(data.message) as Error & { code: string };
          error.code = "active_listing";
          throw error;
        }
        throw new Error("Failed to delete");
      }

      // Show undo toast (same as bulk delete)
      setUndoState({
        message: `"${title}" deleted`,
        comicIds: [id],
      });

      refresh();
    } catch (err) {
      if (err instanceof Error && (err as Error & { code?: string }).code === "active_listing") {
        throw err;
      }
      showToast("Failed to delete comic", "error");
    }
  };

  const handleAddToList = async (itemId: string, listId: string) => {
    const list = lists.find((l) => l.id === listId);
    try {
      await addItemToList(itemId, listId);
      showToast(`Added to "${list?.name}"`, "success");
      // Update selected item view
      const item = collection.find((i) => i.id === itemId);
      if (item) {
        setSelectedItem({ ...item, listIds: [...item.listIds, listId] });
      }
    } catch {
      showToast("Failed to add to list", "error");
    }
  };

  const handleRemoveFromList = async (itemId: string, listId: string) => {
    const list = lists.find((l) => l.id === listId);
    try {
      await removeItemFromList(itemId, listId);
      showToast(`Removed from "${list?.name}"`, "info");
      // Update selected item view
      const item = collection.find((i) => i.id === itemId);
      if (item) {
        setSelectedItem({ ...item, listIds: item.listIds.filter((id) => id !== listId) });
      }
    } catch {
      showToast("Failed to remove from list", "error");
    }
  };

  const handleCreateList = async (name: string) => {
    try {
      const newList = await createNewList(name);
      showToast(`List "${name}" created`, "success");
      return newList;
    } catch {
      showToast("Failed to create list", "error");
      throw new Error("Failed to create list");
    }
  };

  const handleMarkSold = async (itemId: string, salePrice: number) => {
    const item = collection.find((c) => c.id === itemId);
    if (item) {
      const profit = salePrice - (item.purchasePrice || 0);
      try {
        await recordSale(item, salePrice);
        setSelectedItem(null);
        showToast(
          `Sale recorded! ${profit >= 0 ? "Profit" : "Loss"}: $${Math.abs(profit).toFixed(2)}`,
          profit >= 0 ? "success" : "info"
        );
      } catch {
        showToast("Failed to record sale", "error");
      }
    }
  };

  const handleToggleStar = useCallback(
    async (itemId: string) => {
      const item = collection.find((c) => c.id === itemId);
      if (item) {
        try {
          await updateItem(itemId, { isStarred: !item.isStarred });
          showToast(item.isStarred ? "Removed from favorites" : "Added to favorites", "success");
          // Update selected item if it's the one being toggled
          setSelectedItem((prev) =>
            prev?.id === itemId ? { ...item, isStarred: !item.isStarred } : prev
          );
        } catch {
          showToast("Failed to update", "error");
        }
      }
    },
    [collection, updateItem, showToast]
  );

  const handleEdit = useCallback((item: CollectionItem) => {
    setSelectedItem(null); // Close detail modal
    setEditingItem(item);
  }, []);

  const handleSaveEdit = async (itemData: Partial<CollectionItem>) => {
    if (editingItem) {
      try {
        await updateItem(editingItem.id, {
          ...itemData,
          comic: itemData.comic || editingItem.comic,
        });
        setEditingItem(null);
        showToast("Changes saved", "success");
      } catch {
        showToast("Failed to save changes", "error");
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
  };

  const handleExportCSV = () => {
    if (filteredCollection.length === 0) {
      showToast("No comics to export", "info");
      return;
    }
    exportCollectionToCSV(filteredCollection);
    showToast(`Exported ${filteredCollection.length} comics to CSV`, "success");
  };

  if (!isLoaded) {
    return (
      <div role="status" aria-busy="true">
        <span className="sr-only">Loading your collection…</span>
        <CollectionPageSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Collection</h1>
          <p className="text-gray-600 mt-1">
            {isFiltered ? (
              <>
                {stats.count} of {stats.totalCount} comics • $
                {stats.totalValue.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                of $
                {stats.fullCollectionValue.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                total
              </>
            ) : (
              <>
                {stats.count} comics • $
                {stats.totalValue.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                total value
                {stats.unpricedCount > 0 && (
                  <span className="text-gray-400"> ({stats.unpricedCount} unpriced)</span>
                )}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/stats")}
            className="inline-flex items-center gap-2 px-3 py-2 bg-pop-white border-2 border-pop-black text-pop-black font-bold hover:shadow-[2px_2px_0px_#000] transition-all"
          >
            <BarChart3 className="w-5 h-5" />
            <span className="hidden sm:inline">Stats</span>
          </button>
          <button
            onClick={() => router.push("/sales")}
            className="inline-flex items-center gap-2 px-3 py-2 bg-pop-white border-2 border-pop-black text-pop-black font-bold hover:shadow-[2px_2px_0px_#000] transition-all"
          >
            <DollarSign className="w-5 h-5" />
            <span className="hidden sm:inline">Sales</span>
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-pop-white border-2 border-pop-black text-pop-black font-bold hover:shadow-[2px_2px_0px_#000] transition-all"
          >
            <Share2 className="w-5 h-5" />
            <span className="hidden sm:inline">Share</span>
          </button>
          <FeatureButton
            feature="csvExport"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3 py-2 bg-pop-white border-2 border-pop-black text-pop-black font-bold hover:shadow-[2px_2px_0px_#000] transition-all"
          >
            <Download className="w-5 h-5" />
            <span className="hidden sm:inline">CSV</span>
          </FeatureButton>
          <button
            onClick={() => router.push("/scan")}
            className="inline-flex items-center gap-2 whitespace-nowrap px-3 py-2 bg-pop-blue border-2 border-pop-black text-white font-bold shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] transition-all"
          >
            <Plus className="w-5 h-5" />
            Add Book
          </button>
        </div>
      </div>

      {/* Stats Cards - Pop Art Style */}
      <div className="flex items-center justify-between mb-2">
        <div />
        <button
          onClick={toggleFinancials}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-comic text-gray-600 hover:text-pop-black border-2 border-gray-300 hover:border-pop-black bg-pop-white shadow-[1px_1px_0px_#ccc] hover:shadow-[2px_2px_0px_#000] transition-all"
          title={showFinancials ? "Hide financial fields" : "Show financial fields"}
        >
          {showFinancials ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showFinancials ? "Hide" : "Show"} Financials
        </button>
      </div>
      <div className={`grid grid-cols-2 ${showFinancials ? "md:grid-cols-3 lg:grid-cols-5" : "md:grid-cols-2"} gap-3 mb-8`}>
        <div className="bg-pop-white border-3 border-pop-black p-3 shadow-[3px_3px_0px_#000] flex items-center gap-3">
          <div className="w-10 h-10 bg-pop-blue border-2 border-pop-black flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-600 uppercase font-bold truncate">
              Comics{isFiltered && "*"}
            </p>
            <p className="text-xl font-black text-pop-black">{stats.count}</p>
          </div>
        </div>
        {showFinancials && <div className="bg-pop-white border-3 border-pop-black p-3 shadow-[3px_3px_0px_#000] flex items-center gap-3">
          <div className="w-10 h-10 bg-pop-red border-2 border-pop-black flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-600 uppercase font-bold truncate">Cost</p>
            <p className="text-xl font-black text-pop-black">
              $
              {stats.totalCost.toLocaleString("en-US", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
        </div>}
        <div className="bg-pop-white border-3 border-pop-black p-3 shadow-[3px_3px_0px_#000] flex items-center gap-3">
          <div className="w-10 h-10 bg-pop-green border-2 border-pop-black flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-600 uppercase font-bold truncate">Value</p>
            <p className="text-xl font-black text-pop-black">
              $
              {stats.totalValue.toLocaleString("en-US", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
        </div>
        {showFinancials && (
          <>
            <div className="bg-pop-white border-3 border-pop-black p-3 shadow-[3px_3px_0px_#000] flex items-center gap-3">
              <div className="w-10 h-10 bg-pop-blue border-2 border-pop-black flex items-center justify-center flex-shrink-0">
                <Receipt className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-600 uppercase font-bold truncate">
                  Sales ({salesStats.totalSales})
                </p>
                <p className="text-xl font-black text-pop-black">
                  $
                  {salesStats.totalRevenue.toLocaleString("en-US", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </p>
                {unpricedSalesCount > 0 && (
                  <p
                    className="flex items-center gap-1 text-[10px] leading-tight text-pop-black/60 font-bold"
                    title={`${unpricedSalesCount} sold ${unpricedSalesCount === 1 ? "book has" : "books have"} no recorded sale value and ${unpricedSalesCount === 1 ? "is" : "are"} not counted in revenue / profit-loss totals.`}
                  >
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 text-pop-orange" />
                    {unpricedSalesCount} unpriced
                  </p>
                )}
              </div>
            </div>
            <div
              className={`bg-pop-white border-3 border-pop-black p-3 shadow-[3px_3px_0px_#000] flex items-center gap-3 col-span-2 md:col-span-1`}
            >
              <div
                className={`w-10 h-10 border-2 border-pop-black flex items-center justify-center flex-shrink-0 ${
                  profitLoss >= 0 ? "bg-pop-green" : "bg-pop-red"
                }`}
              >
                {profitLoss >= 0 ? (
                  <ArrowUpRight className="w-5 h-5 text-white" />
                ) : (
                  <ArrowDownRight className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-600 uppercase font-bold truncate">Profit/Loss</p>
                <p
                  className={`text-xl font-black ${
                    profitLoss >= 0 ? "text-pop-green" : "text-pop-red"
                  }`}
                >
                  {profitLoss >= 0 ? "+" : ""}$
                  {profitLoss.toLocaleString("en-US", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Selection Header - shown when in selection mode */}
      {isSelectionMode && (
        <SelectionHeader
          selectionCount={selectionCount}
          isAllSelected={checkIsAllSelected(visibleIds)}
          onSelectAll={() => selectAllVisible(visibleIds)}
          onClear={clearSelection}
          onCancel={exitSelectionMode}
        />
      )}

      {/* Filters Bar - Pop Art Style */}
      <CollectionToolbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        viewMode={viewMode}
        setViewMode={setViewMode}
        enterSelectionMode={enterSelectionMode}
        selectedList={selectedList}
        setSelectedList={setSelectedList}
        lists={lists}
        collection={collection}
        isPrimaryList={isPrimaryList}
        activeFilterCount={activeFilterCount}
        setShowFiltersDrawer={setShowFiltersDrawer}
        sortBy={sortBy}
        setSortBy={setSortBy}
        showStarredOnly={showStarredOnly}
        setShowStarredOnly={setShowStarredOnly}
        showForTradeOnly={showForTradeOnly}
        setShowForTradeOnly={setShowForTradeOnly}
        publisherFilter={publisherFilter}
        setPublisherFilter={setPublisherFilter}
        titleFilter={titleFilter}
        setTitleFilter={setTitleFilter}
        gradingCompanyFilter={gradingCompanyFilter}
        setGradingCompanyFilter={setGradingCompanyFilter}
        gradeFilter={gradeFilter}
        setGradeFilter={setGradeFilter}
        uniquePublishers={uniquePublishers}
        uniqueTitles={uniqueTitles}
        uniqueGradingCompanies={uniqueGradingCompanies}
        isDefaultListSelected={isDefaultListSelected}
      />

      {/* Collection Display */}
      {filteredCollection.length === 0 ? (
        <div className="bg-pop-white border-3 border-pop-black p-12 shadow-[4px_4px_0px_#000] text-center">
          <div className="w-20 h-20 bg-pop-yellow border-3 border-pop-black flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-10 h-10 text-pop-black" />
          </div>
          <h3 className="text-2xl font-black text-pop-black mb-2 font-comic uppercase">
            {searchQuery ||
            publisherFilter !== "all" ||
            titleFilter !== "all" ||
            showStarredOnly ||
            showForTradeOnly
              ? "No comics match your filters"
              : !isDefaultListSelected
                ? "This list is empty"
                : "Your collection is empty"}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchQuery ||
            publisherFilter !== "all" ||
            titleFilter !== "all" ||
            showStarredOnly ||
            showForTradeOnly
              ? "Try adjusting your filters or search terms"
              : !isDefaultListSelected
                ? "Add comics to this list from the comic details view"
                : "Start by scanning your first comic book cover"}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {searchQuery ||
            publisherFilter !== "all" ||
            titleFilter !== "all" ||
            showStarredOnly ||
            showForTradeOnly ? (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setPublisherFilter("all");
                  setTitleFilter("all");
                  setShowStarredOnly(false);
                  setShowForTradeOnly(false);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-pop-blue border-2 border-pop-black text-white font-bold shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] transition-all"
              >
                Clear All Filters
              </button>
            ) : (
              <button
                onClick={() => router.push("/scan")}
                className="inline-flex items-center gap-2 px-5 py-3 bg-pop-blue border-3 border-pop-black text-white font-bold text-lg"
                style={{ boxShadow: "4px 4px 0px #000" }}
              >
                <Plus className="w-5 h-5" />
                {!isDefaultListSelected ? "Scan a Book" : "Add Your First Comic"}
              </button>
            )}
            {!isDefaultListSelected && collection.length > 0 && (
              <button
                onClick={() => setSelectedList("collection")}
                className="inline-flex items-center gap-2 px-4 py-2 bg-pop-white border-2 border-pop-black text-pop-black font-bold shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] transition-all"
              >
                View All Comics
              </button>
            )}
          </div>
        </div>
      ) : (
        <CollectionGrid
          viewMode={viewMode}
          filteredCollection={filteredCollection}
          showFinancials={showFinancials}
          isSelectionMode={isSelectionMode}
          selectedIds={selectedIds}
          onComicClick={handleComicClick}
          onToggleStar={handleToggleStar}
          onEdit={handleEdit}
          onToggleSelect={toggleSelection}
        />
      )}

      {/* Load More (M-CO9) - fetch the next page on demand instead of pulling
          the whole collection up front. Only rendered in cloud mode when the
          server reports more rows past what we've loaded. */}
      {hasMore && filteredCollection.length > 0 && (
        <div className="flex justify-center mt-8">
          <button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-2 px-6 py-3 bg-pop-white border-3 border-pop-black text-pop-black font-bold shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-[3px_3px_0px_#000]"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading…
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Load More
              </>
            )}
          </button>
        </div>
      )}

      {/* Comic Detail Modal */}
      {selectedItem && (
        <ComicDetailModal
          item={selectedItem}
          lists={lists}
          collection={collection}
          onClose={handleCloseModal}
          onRemove={handleRemove}
          onAddToList={handleAddToList}
          onRemoveFromList={handleRemoveFromList}
          onCreateList={handleCreateList}
          onMarkSold={handleMarkSold}
          onToggleStar={handleToggleStar}
          onEdit={handleEdit}
          onViewItem={(item) => setSelectedItem(item)}
        />
      )}

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-20 md:pb-4">
          <div className="absolute inset-0 bg-black/50" onClick={handleCancelEdit} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] md:max-h-[90vh] overflow-hidden">
            <div className="flex flex-col lg:flex-row max-h-[85vh] md:max-h-[90vh]">
              {/* Image Preview - Hidden on mobile, shown on desktop */}
              <div className="hidden lg:block lg:w-1/3 p-6 bg-gray-50 border-r border-gray-100">
                <div className="sticky top-6">
                  <div className="aspect-[2/3] rounded-lg overflow-hidden shadow-lg">
                    <ComicImage
                      src={editingItem.coverImageUrl}
                      alt="Comic cover"
                      aspectRatio="fill"
                      sizes="(max-width: 1024px) 0px, 33vw"
                    />
                  </div>
                </div>
              </div>

              {/* Form */}
              <div className="lg:w-2/3 p-4 md:p-6 overflow-y-auto">
                <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4 md:mb-6">
                  Edit Comic Details
                </h2>
                <ComicDetailsForm
                  key={editingItem.id}
                  comic={editingItem.comic}
                  coverImageUrl={editingItem.coverImageUrl}
                  onSave={handleSaveEdit}
                  onCancel={handleCancelEdit}
                  mode="edit"
                  existingItem={editingItem}
                  onCoverImageChange={(url) => {
                    setEditingItem({
                      ...editingItem,
                      coverImageUrl: url,
                    });
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Collection Modal */}
      {showShareModal && <ShareCollectionModal onClose={() => setShowShareModal(false)} />}

      {/* Selection Toolbar - shown when in selection mode */}
      {isSelectionMode && (
        <SelectionToolbar
          selectionCount={selectionCount}
          onDelete={handleBulkDelete}
          onMarkForTrade={handleBulkMarkForTrade}
          onAddToList={() => setShowBulkListPicker(true)}
          onMarkSold={handleBulkMarkSold}
        />
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <BulkDeleteModal
          items={selectedItems}
          onConfirm={executeBulkDelete}
          onCancel={() => setShowBulkDeleteModal(false)}
        />
      )}

      {/* Bulk List Picker Modal */}
      {showBulkListPicker && (
        <BulkListPickerModal
          lists={lists}
          selectionCount={selectionCount}
          onSelect={handleBulkAddToList}
          onCreateList={async (name) => {
            const newList = await createNewList(name);
            return newList;
          }}
          onCancel={() => setShowBulkListPicker(false)}
        />
      )}

      {/* Bulk Mark-as-Sold Modal (H-CO1) - SKIPPABLE per-item price prompt.
          Lists every selected book with a price field pre-filled from its FMV
          estimate. "Record Sales" posts the typed prices; "Skip Pricing" logs
          each as sold with no recorded value (auditable). */}
      {showBulkSoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-20 md:pb-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !isSubmittingBulkSold && setShowBulkSoldModal(false)}
            aria-hidden="true"
          />
          <div className="relative bg-pop-white border-3 border-pop-black shadow-[6px_6px_0px_#000] w-full max-w-lg max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b-3 border-pop-black flex-shrink-0">
              <h2 className="text-lg font-black uppercase font-comic text-pop-black flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-pop-green" />
                Mark {selectedItems.length} as Sold
              </h2>
              <button
                onClick={() => setShowBulkSoldModal(false)}
                disabled={isSubmittingBulkSold}
                className="p-1.5 border-2 border-pop-black bg-pop-white hover:shadow-[2px_2px_0px_#000] transition-all disabled:opacity-50"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-pop-black" />
              </button>
            </div>

            {/* Intro / skip hint */}
            <div className="px-4 py-3 border-b-2 border-pop-black/20 flex-shrink-0">
              <p className="text-sm text-gray-700 font-comic">
                Enter a sale price for each book, or{" "}
                <span className="font-bold text-pop-black">Skip Pricing</span> to
                log them as sold without a recorded value.
              </p>
            </div>

            {/* Per-item price list */}
            <div className="overflow-y-auto px-4 py-3 flex flex-col gap-2 flex-1">
              {selectedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 border-2 border-pop-black bg-pop-white p-2"
                >
                  <div className="w-9 h-12 flex-shrink-0 overflow-hidden border border-pop-black/30">
                    <ComicImage
                      src={item.coverImageUrl}
                      alt={`${item.comic.title} #${item.comic.issueNumber}`}
                      aspectRatio="fill"
                      sizes="36px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-pop-black truncate">
                      {item.comic.title || "Unknown Title"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      Issue #{item.comic.issueNumber || "?"}
                    </p>
                  </div>
                  <div className="relative flex-shrink-0 w-28">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm font-bold text-pop-black/60">
                      $
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={bulkSalePrices[item.id] ?? ""}
                      placeholder="0.00"
                      aria-label={`Sale price for ${item.comic.title || "comic"}`}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setBulkSalePrices((prev) => ({
                          ...prev,
                          [item.id]: raw === "" ? undefined : parseFloat(raw),
                        }));
                      }}
                      className="w-full pl-6 pr-2 py-1.5 border-2 border-pop-black bg-pop-white font-comic text-sm text-pop-black focus:outline-none focus-visible:ring-2 focus-visible:ring-pop-blue focus:shadow-[2px_2px_0px_#000] transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Footer actions */}
            <div className="flex items-center gap-2 px-4 py-3 border-t-3 border-pop-black bg-pop-white flex-shrink-0">
              <button
                onClick={() => submitBulkSold(true)}
                disabled={isSubmittingBulkSold}
                className="flex-1 px-4 py-2 border-2 border-pop-black bg-pop-white text-pop-black font-bold text-sm hover:shadow-[2px_2px_0px_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Skip Pricing
              </button>
              <button
                onClick={() => submitBulkSold(false)}
                disabled={isSubmittingBulkSold}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 border-2 border-pop-black bg-pop-green text-white font-bold text-sm shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingBulkSold ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Record Sales"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo Toast */}
      {undoState && (
        <UndoToast
          message={undoState.message}
          onUndo={handleUndoDelete}
          onExpire={handleExpireUndo}
        />
      )}

      {/* Mobile Filters Drawer - bottom-sheet pattern. Hidden on md+ where
          the inline filter row is visible directly. */}
      {showFiltersDrawer && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowFiltersDrawer(false)}
            aria-hidden="true"
          />
          {/* Sheet */}
          <div className="absolute inset-x-0 bottom-0 bg-pop-white border-t-3 border-pop-black max-h-[85vh] flex flex-col shadow-[0_-4px_0px_#000]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b-2 border-pop-black flex-shrink-0">
              <h3 className="text-lg font-black uppercase font-comic text-pop-black">
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-pop-blue text-white text-xs font-black border border-pop-black">
                    {activeFilterCount}
                  </span>
                )}
              </h3>
              <button
                onClick={() => setShowFiltersDrawer(false)}
                className="p-1.5 border-2 border-pop-black bg-pop-white hover:shadow-[2px_2px_0px_#000] transition-all"
                aria-label="Close filters"
              >
                <X className="w-5 h-5 text-pop-black" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-4 py-4 flex flex-col gap-3 flex-1">
              {/* Quick toggles */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowStarredOnly(!showStarredOnly)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border-2 border-pop-black font-comic text-sm transition-all ${
                    showStarredOnly
                      ? "bg-pop-yellow text-pop-black shadow-[2px_2px_0px_#000]"
                      : "bg-pop-white text-pop-black"
                  }`}
                >
                  <Star
                    className={`w-4 h-4 ${showStarredOnly ? "fill-pop-black" : ""}`}
                  />
                  Starred
                </button>
                <button
                  onClick={() => setShowForTradeOnly(!showForTradeOnly)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border-2 border-pop-black font-comic text-sm transition-all ${
                    showForTradeOnly
                      ? "bg-pop-orange text-pop-white shadow-[2px_2px_0px_#000]"
                      : "bg-pop-white text-pop-black"
                  }`}
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  For Trade
                </button>
              </div>

              {/* Publisher */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-comic font-bold text-pop-black/70 uppercase">
                  Publisher
                </label>
                <select
                  value={publisherFilter}
                  onChange={(e) => setPublisherFilter(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-pop-black bg-pop-white text-sm font-comic text-pop-black focus:outline-none cursor-pointer"
                >
                  <option value="all">All Publishers</option>
                  {uniquePublishers.map((publisher) => (
                    <option key={publisher} value={publisher}>
                      {publisher}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-comic font-bold text-pop-black/70 uppercase">
                  Title
                </label>
                <select
                  value={titleFilter}
                  onChange={(e) => setTitleFilter(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-pop-black bg-pop-white text-sm font-comic text-pop-black focus:outline-none cursor-pointer"
                >
                  <option value="all">All Titles</option>
                  {uniqueTitles.map((title) => (
                    <option key={title} value={title}>
                      {title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Grader (conditional) */}
              {uniqueGradingCompanies.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-comic font-bold text-pop-black/70 uppercase">
                    Grader
                  </label>
                  <select
                    value={gradingCompanyFilter}
                    onChange={(e) => setGradingCompanyFilter(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-pop-black bg-pop-white text-sm font-comic text-pop-black focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Graders</option>
                    {uniqueGradingCompanies.map((company) => (
                      <option key={company} value={company}>
                        {company}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex items-center gap-2 px-4 py-3 border-t-2 border-pop-black bg-pop-white flex-shrink-0">
              <button
                onClick={() => {
                  setPublisherFilter("all");
                  setTitleFilter("all");
                  setGradingCompanyFilter("all");
                  setShowStarredOnly(false);
                  setShowForTradeOnly(false);
                }}
                disabled={activeFilterCount === 0}
                className="flex-1 px-4 py-2 border-2 border-pop-black bg-pop-white text-pop-black font-bold text-sm hover:shadow-[2px_2px_0px_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowFiltersDrawer(false)}
                className="flex-1 px-4 py-2 border-2 border-pop-black bg-pop-blue text-white font-bold text-sm shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] transition-all"
              >
                Show {filteredCollection.length}{" "}
                {filteredCollection.length === 1 ? "Comic" : "Comics"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
