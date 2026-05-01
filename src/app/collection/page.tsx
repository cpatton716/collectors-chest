"use client";

import { Suspense, useCallback, useEffect, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { useUser } from "@clerk/nextjs";

import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CheckSquare,
  DollarSign,
  Download,
  Eye,
  EyeOff,
  Filter,
  Grid3X3,
  List,
  Plus,
  Receipt,
  Search,
  Share2,
  SortAsc,
  Star,
  Tag,
  TrendingUp,
  X,
} from "lucide-react";

import { exportCollectionToCSV } from "@/lib/csvExport";
import { calculateCollectionValue, getComicValue } from "@/lib/gradePrice";
import { storage } from "@/lib/storage";

import { useCollection } from "@/hooks/useCollection";
import { useSelection } from "@/hooks/useSelection";
import { useSubscription } from "@/hooks/useSubscription";

import { BulkDeleteModal } from "@/components/collection/BulkDeleteModal";
import { BulkListPickerModal } from "@/components/collection/BulkListPickerModal";
import { SelectionHeader } from "@/components/collection/SelectionHeader";
import { SelectionToolbar } from "@/components/collection/SelectionToolbar";
import { UndoToast } from "@/components/collection/UndoToast";
import { ComicCard } from "@/components/ComicCard";
import { ComicDetailModal } from "@/components/ComicDetailModal";
import { ComicDetailsForm } from "@/components/ComicDetailsForm";
import { ComicImage } from "@/components/ComicImage";
import { ComicListItem as _ComicListItem } from "@/components/ComicListItem";
import { FeatureButton } from "@/components/FeatureGate";
import { ShareCollectionModal } from "@/components/ShareCollectionModal";
import { CollectionPageSkeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";

import { CollectionItem } from "@/types/comic";

type ViewMode = "grid" | "list";
type SortOption = "date" | "title" | "value" | "value-asc" | "issue" | "grade";
type FilterOption = "all" | string;

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
    collection,
    lists,
    sales: _sales,
    isLoading: collectionLoading,
    isCloudEnabled: _isCloudEnabled,
    addToCollection: _addToCollection,
    updateCollectionItem: updateItem,
    removeFromCollection,
    createList: createNewList,
    addItemToList,
    removeItemFromList,
    recordSale,
    getCollectionStats: _getCollectionStats,
    getSalesStats,
    refresh,
  } = useCollection();

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedList, setSelectedList] = useState<string>("collection");
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
  const [undoState, setUndoState] = useState<{
    message: string;
    comicIds: string[];
  } | null>(null);

  const salesStats = getSalesStats();
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
  const uniquePublishers = Array.from(
    new Set(collection.map((item) => item.comic.publisher).filter((p): p is string => Boolean(p)))
  ).sort();
  const uniqueTitles = Array.from(
    new Set(collection.map((item) => item.comic.title).filter((t): t is string => Boolean(t)))
  ).sort();
  const uniqueGradingCompanies = Array.from(
    new Set(collection.map((item) => item.gradingCompany).filter((g): g is string => Boolean(g)))
  ).sort();

  // The "My Collection" primary list is the union view — items present in
  // the collection don't tag themselves with its id. Other auto-seeded
  // lists (Want List, For Sale, Slabbed, Passed-on) ALSO carry
  // isDefault=true but ARE member-tagged like custom lists. Detect the
  // primary list by id-sentinel (guest) or by name (cloud).
  const isPrimaryList = (list: { id: string; name: string } | undefined) =>
    !!list && (list.id === "collection" || list.name === "My Collection");
  const isDefaultListSelected =
    selectedList === "collection" ||
    isPrimaryList(lists.find((l) => l.id === selectedList));

  // Count of active *filters* (excludes search, sort, list — those have
  // their own visible controls). Drives the "Filters (N)" badge on mobile
  // and decides whether to render the active-chips bar.
  const activeFilterCount = [
    showStarredOnly,
    showForTradeOnly,
    publisherFilter !== "all",
    titleFilter !== "all",
    uniqueGradingCompanies.length > 0 && gradingCompanyFilter !== "all",
  ].filter(Boolean).length;

  // Filter and sort collection
  const filteredCollection = collection
    .filter((item) => {
      // Filter by list — skip filtering when "My Collection" is selected
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
    });

  // Calculate stats for current view using grade-aware pricing
  const filteredValue = calculateCollectionValue(filteredCollection);
  const totalCollectionValue = calculateCollectionValue(collection);
  const isFiltered = filteredCollection.length !== collection.length;

  const stats = {
    count: filteredCollection.length,
    totalCount: collection.length,
    totalValue: filteredValue.totalValue,
    fullCollectionValue: totalCollectionValue.totalValue,
    unpricedCount: filteredValue.unpricedCount,
    totalCost: filteredCollection.reduce((sum, item) => sum + (item.purchasePrice || 0), 0),
    forSale: filteredCollection.filter((item) => item.forSale).length,
  };
  const profitLoss = stats.totalValue - stats.totalCost;
  const _profitLossPercent = stats.totalCost > 0 ? (profitLoss / stats.totalCost) * 100 : 0;

  // Get selected items
  const selectedItems = filteredCollection.filter((item) => selectedIds.has(item.id));
  const visibleIds = filteredCollection.map((item) => item.id);

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

  // Bulk mark as sold handler
  const handleBulkMarkSold = async () => {
    const idsToUpdate = Array.from(selectedIds);

    try {
      const response = await fetch("/api/comics/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comicIds: idsToUpdate,
          field: "is_sold",
          value: true,
        }),
      });

      if (!response.ok) throw new Error("Failed to update");

      exitSelectionMode();
      refresh();
      showToast(`${idsToUpdate.length} comics marked as sold`, "success");
    } catch {
      showToast("Failed to mark as sold", "error");
    }
  };

  const handleComicClick = (item: CollectionItem) => {
    setSelectedItem(item);
    storage.addToRecentlyViewed(item.id);
  };

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

  const handleToggleStar = async (itemId: string) => {
    const item = collection.find((c) => c.id === itemId);
    if (item) {
      try {
        await updateItem(itemId, { isStarred: !item.isStarred });
        showToast(item.isStarred ? "Removed from favorites" : "Added to favorites", "success");
        // Update selected item if it's the one being toggled
        if (selectedItem?.id === itemId) {
          setSelectedItem({ ...item, isStarred: !item.isStarred });
        }
      } catch {
        showToast("Failed to update", "error");
      }
    }
  };

  const handleEdit = (item: CollectionItem) => {
    setSelectedItem(null); // Close detail modal
    setEditingItem(item);
  };

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
    return <CollectionPageSkeleton />;
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
            className="inline-flex items-center gap-2 px-3 py-2 bg-pop-blue border-2 border-pop-black text-white font-bold shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] transition-all"
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
      <div className="bg-pop-white border-3 border-pop-black p-4 shadow-[4px_4px_0px_#000] mb-6">
        <div className="flex flex-col gap-3">
          {/* Row 1 — Search + View Toggle + Select (Select desktop-only;
              mobile gets it next to the Viewing dropdown to free space) */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pop-black/50" />
              <input
                type="text"
                placeholder="Search by title, publisher, writer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-1.5 border-2 border-pop-black bg-pop-white font-comic text-sm text-pop-black placeholder:text-pop-black/40 focus:outline-none focus:shadow-[2px_2px_0px_#000] transition-all"
              />
            </div>

            <div className="flex items-center bg-gray-100 rounded-lg p-1 flex-shrink-0">
              <button
                onClick={() => setViewMode("grid")}
                title="Grid View - Display comics as cover thumbnails"
                className={`p-2 rounded-md transition-colors ${
                  viewMode === "grid"
                    ? "bg-white shadow-sm text-primary-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Grid3X3 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                title="List View - Display comics in a detailed table format"
                className={`p-2 rounded-md transition-colors ${
                  viewMode === "list"
                    ? "bg-white shadow-sm text-primary-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>

            <button
              onClick={enterSelectionMode}
              className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 bg-pop-white border-2 border-pop-black text-pop-black font-bold hover:shadow-[2px_2px_0px_#000] transition-all flex-shrink-0 text-sm"
            >
              <CheckSquare className="w-4 h-4" />
              <span>Select</span>
            </button>
          </div>

          {/* Row 2 — Viewing (list switcher with counts) */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm font-comic font-bold text-pop-black/70 flex-shrink-0">
              Viewing:
            </label>
            <select
              value={selectedList}
              onChange={(e) => setSelectedList(e.target.value)}
              className="px-3 py-1.5 border-2 border-pop-black bg-pop-white text-sm font-comic font-bold text-pop-black focus:outline-none hover:shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
            >
              {lists.map((list) => {
                const count = isPrimaryList(list)
                  ? collection.length
                  : collection.filter((item) =>
                      item.listIds.includes(list.id)
                    ).length;
                return (
                  <option key={list.id} value={list.id}>
                    {list.name} ({count})
                  </option>
                );
              })}
            </select>

            <button
              onClick={enterSelectionMode}
              className="md:hidden ml-auto inline-flex items-center gap-2 px-3 py-1.5 bg-pop-white border-2 border-pop-black text-pop-black font-bold hover:shadow-[2px_2px_0px_#000] transition-all flex-shrink-0 text-sm"
            >
              <CheckSquare className="w-4 h-4" />
              <span>Select</span>
            </button>
          </div>

          {/* Row 3 (mobile) — Filters drawer trigger + inline Sort.
              Sort stays out of the drawer because users change it often. */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setShowFiltersDrawer(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 border-2 border-pop-black bg-pop-white font-comic text-sm font-bold hover:shadow-[2px_2px_0px_#000] transition-all"
            >
              <Filter className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-pop-blue text-white text-xs font-black border border-pop-black min-w-[20px] text-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <div className="flex items-center gap-1.5 ml-auto">
              <SortAsc className="w-4 h-4 text-pop-black flex-shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-2 py-1.5 border-2 border-pop-black bg-pop-white text-sm font-comic text-pop-black focus:outline-none cursor-pointer"
              >
                <option value="date">Date Added</option>
                <option value="title">Title</option>
                <option value="issue">Issue #</option>
                <option value="value">Value (High to Low)</option>
                <option value="value-asc">Value (Low to High)</option>
                <option value="grade">Grade (High to Low)</option>
              </select>
            </div>
          </div>

          {/* Row 3 (desktop) — Filters inline + Sort + Clear */}
          <div className="hidden md:flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowStarredOnly(!showStarredOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border-2 border-pop-black font-comic text-sm transition-all ${
                showStarredOnly
                  ? "bg-pop-yellow text-pop-black shadow-[2px_2px_0px_#000]"
                  : "bg-pop-white text-pop-black hover:shadow-[2px_2px_0px_#000]"
              }`}
            >
              <Star
                className={`w-4 h-4 ${showStarredOnly ? "fill-pop-black" : ""}`}
              />
              Starred
            </button>

            <button
              onClick={() => setShowForTradeOnly(!showForTradeOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border-2 border-pop-black font-comic text-sm transition-all ${
                showForTradeOnly
                  ? "bg-pop-orange text-pop-white shadow-[2px_2px_0px_#000]"
                  : "bg-pop-white text-pop-black hover:shadow-[2px_2px_0px_#000]"
              }`}
            >
              <ArrowLeftRight className="w-4 h-4" />
              For Trade
            </button>

            <select
              value={publisherFilter}
              onChange={(e) => setPublisherFilter(e.target.value)}
              className="px-3 py-1.5 border-2 border-pop-black bg-pop-white text-sm font-comic text-pop-black focus:outline-none hover:shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
            >
              <option value="all">Publishers</option>
              {uniquePublishers.map((publisher) => (
                <option key={publisher} value={publisher}>
                  {publisher}
                </option>
              ))}
            </select>

            <select
              value={titleFilter}
              onChange={(e) => setTitleFilter(e.target.value)}
              className="px-3 py-1.5 border-2 border-pop-black bg-pop-white text-sm font-comic text-pop-black focus:outline-none hover:shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
            >
              <option value="all">Titles</option>
              {uniqueTitles.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>

            {uniqueGradingCompanies.length > 0 && (
              <select
                value={gradingCompanyFilter}
                onChange={(e) => setGradingCompanyFilter(e.target.value)}
                className="px-3 py-1.5 border-2 border-pop-black bg-pop-white text-sm font-comic text-pop-black focus:outline-none hover:shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
              >
                <option value="all">Graders</option>
                {uniqueGradingCompanies.map((company) => (
                  <option key={company} value={company}>
                    {company}
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <label className="text-sm font-comic text-pop-black flex items-center gap-1">
                <SortAsc className="w-4 h-4" />
                Sort:
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-1.5 border-2 border-pop-black bg-pop-white text-sm font-comic text-pop-black focus:outline-none hover:shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
              >
                <option value="date">Date Added</option>
                <option value="title">Title</option>
                <option value="issue">Issue #</option>
                <option value="value">Value (High to Low)</option>
                <option value="value-asc">Value (Low to High)</option>
                <option value="grade">Grade (High to Low)</option>
              </select>
            </div>

            {(publisherFilter !== "all" ||
              titleFilter !== "all" ||
              gradingCompanyFilter !== "all" ||
              gradeFilter !== "all" ||
              showStarredOnly ||
              showForTradeOnly ||
              searchQuery ||
              !isDefaultListSelected) && (
              <button
                onClick={() => {
                  setPublisherFilter("all");
                  setTitleFilter("all");
                  setGradingCompanyFilter("all");
                  setGradeFilter("all");
                  setShowStarredOnly(false);
                  setShowForTradeOnly(false);
                  setSearchQuery("");
                  setSelectedList("collection");
                }}
                className="text-sm text-primary-600 hover:text-primary-700 underline whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>

          {/* Row 4 (mobile only) — Active filter chips with one-tap remove.
              Mirrors the desktop inline filter row so users can see/clear
              what's active without re-opening the drawer. */}
          {activeFilterCount > 0 && (
            <div className="md:hidden flex flex-wrap items-center gap-1.5 pt-3 border-t-2 border-pop-black/20">
              <span className="text-xs font-comic font-bold text-pop-black/60 uppercase mr-1">
                Active:
              </span>
              {showStarredOnly && (
                <button
                  onClick={() => setShowStarredOnly(false)}
                  className="inline-flex items-center gap-1 px-2 py-1 border-2 border-pop-black bg-pop-yellow text-pop-black text-xs font-bold hover:shadow-[1px_1px_0px_#000] transition-all"
                >
                  Starred
                  <X className="w-3 h-3" />
                </button>
              )}
              {showForTradeOnly && (
                <button
                  onClick={() => setShowForTradeOnly(false)}
                  className="inline-flex items-center gap-1 px-2 py-1 border-2 border-pop-black bg-pop-orange text-pop-white text-xs font-bold hover:shadow-[1px_1px_0px_#000] transition-all"
                >
                  For Trade
                  <X className="w-3 h-3" />
                </button>
              )}
              {publisherFilter !== "all" && (
                <button
                  onClick={() => setPublisherFilter("all")}
                  className="inline-flex items-center gap-1 px-2 py-1 border-2 border-pop-black bg-pop-white text-pop-black text-xs font-bold hover:shadow-[1px_1px_0px_#000] transition-all"
                >
                  {publisherFilter}
                  <X className="w-3 h-3" />
                </button>
              )}
              {titleFilter !== "all" && (
                <button
                  onClick={() => setTitleFilter("all")}
                  className="inline-flex items-center gap-1 px-2 py-1 border-2 border-pop-black bg-pop-white text-pop-black text-xs font-bold hover:shadow-[1px_1px_0px_#000] transition-all"
                >
                  {titleFilter}
                  <X className="w-3 h-3" />
                </button>
              )}
              {uniqueGradingCompanies.length > 0 &&
                gradingCompanyFilter !== "all" && (
                  <button
                    onClick={() => setGradingCompanyFilter("all")}
                    className="inline-flex items-center gap-1 px-2 py-1 border-2 border-pop-black bg-pop-white text-pop-black text-xs font-bold hover:shadow-[1px_1px_0px_#000] transition-all"
                  >
                    {gradingCompanyFilter}
                    <X className="w-3 h-3" />
                  </button>
                )}
            </div>
          )}
        </div>
      </div>

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
      ) : viewMode === "grid" ? (
        <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 ${isSelectionMode ? "pb-20" : ""}`}>
          {filteredCollection.map((item) => (
            <ComicCard
              key={item.id}
              item={item}
              onClick={() => handleComicClick(item)}
              onToggleStar={handleToggleStar}
              onEdit={handleEdit}
              isSelectionMode={isSelectionMode}
              isSelected={selectedIds.has(item.id)}
              onToggleSelect={toggleSelection}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Table Header */}
          <div className={`grid ${showFinancials ? "grid-cols-12" : "grid-cols-10"} gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider`}>
            <div className={showFinancials ? "col-span-5" : "col-span-5"}>Comic</div>
            <div className="col-span-2">Publisher</div>
            <div className="col-span-2 text-right">Est. Value</div>
            {showFinancials && <div className="col-span-2 text-right">Purchase Price</div>}
            <div className="col-span-1 text-center">For Sale</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-gray-100">
            {filteredCollection.map((item) => {
              const { comic } = item;
              const estimatedValue = getComicValue(item);
              const itemProfitLoss =
                estimatedValue && item.purchasePrice ? estimatedValue - item.purchasePrice : null;

              return (
                <div
                  key={item.id}
                  onClick={() => handleComicClick(item)}
                  className={`grid ${showFinancials ? "grid-cols-12" : "grid-cols-10"} gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors items-center`}
                >
                  {/* Comic Info */}
                  <div className="col-span-5 flex items-center gap-3">
                    <div className="w-10 h-14 flex-shrink-0 rounded overflow-hidden">
                      <ComicImage
                        src={item.coverImageUrl}
                        alt={`${comic.title} #${comic.issueNumber}`}
                        aspectRatio="fill"
                        sizes="40px"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">
                          {comic.title || "Unknown Title"}
                        </p>
                        {item.isStarred && (
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        Issue #{comic.issueNumber || "?"}
                        {comic.variant && <span className="text-gray-400"> • {comic.variant}</span>}
                      </p>
                    </div>
                  </div>

                  {/* Publisher */}
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600 truncate">{comic.publisher || "Unknown"}</p>
                  </div>

                  {/* Est. Value */}
                  <div className="col-span-2 text-right">
                    {estimatedValue > 0 ? (
                      <div>
                        <p className="font-medium text-gray-900">
                          $
                          {estimatedValue.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                        {showFinancials && itemProfitLoss !== null && (
                          <p
                            className={`text-xs ${itemProfitLoss >= 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            {itemProfitLoss >= 0 ? "+" : ""}$
                            {itemProfitLoss.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </div>

                  {/* Purchase Price */}
                  {showFinancials && <div className="col-span-2 text-right">
                    {item.purchasePrice ? (
                      <p className="font-medium text-gray-900">${item.purchasePrice.toFixed(2)}</p>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </div>}

                  {/* For Sale */}
                  <div className="col-span-1 flex justify-center">
                    {item.forSale ? (
                      <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full">
                        <Tag className="w-3 h-3" />
                        <span className="text-xs font-medium">
                          ${item.askingPrice?.toFixed(0) || "-"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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

      {/* Undo Toast */}
      {undoState && (
        <UndoToast
          message={undoState.message}
          onUndo={handleUndoDelete}
          onExpire={handleExpireUndo}
        />
      )}

      {/* Mobile Filters Drawer — bottom-sheet pattern. Hidden on md+ where
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
