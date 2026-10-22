"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useUser } from "@clerk/nextjs";

import { sanitizeCoverImageUrl } from "@/lib/coverImageUrlSanitizer";
import {
  addComic,
  addComicToList as addComicToListDb,
  createList as createListDb,
  deleteComic,
  deleteList as deleteListDb,
  getOrCreateProfile,
  getUserComics,
  getUserLists,
  getUserSales,
  recordSale as recordSaleDb,
  removeComicFromList as removeComicFromListDb,
  updateComic as updateComicDb,
} from "@/lib/db";
import { getVisibleLists, MARKETPLACE_ENABLED } from "@/lib/features";
import { storage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

import { CollectionItem, SaleRecord, UserList } from "@/types/comic";

/**
 * A sale row may carry the H-CO1 `sale_price_recorded` flag once the closeout
 * migration lands. `false` means the seller skipped the per-item price during a
 * bulk "Mark as Sold" — the sale is intentionally recorded with no value so the
 * skip is auditable rather than silently dropped. Pre-migration the column does
 * not exist, so the flag is optional everywhere.
 */
export interface SaleRecordWithFlag extends SaleRecord {
  priceRecorded?: boolean;
}

/**
 * Pure helper (H-CO1): builds the `sales` insert payload for a recorded sale.
 *
 * When `priceRecorded` is true (the single-item default and any bulk sale where
 * the seller entered a price) the sale stores the real price/profit. When false
 * (bulk "Mark as Sold" with the price prompt skipped) the sale is recorded with
 * a zero/null price and `sale_price_recorded = false` so revenue math can treat
 * it as "no value" while the sale itself stays on the books for audit.
 *
 * Kept side-effect free so it can be unit tested without a DB. The caller is
 * responsible for the migration-gated fallback if `sale_price_recorded` does not
 * yet exist as a column.
 */
export function buildSaleInsertFields(
  profileId: string,
  item: CollectionItem,
  salePrice: number,
  priceRecorded: boolean,
  buyerId?: string
): {
  user_id: string;
  comic_title: string | null;
  comic_issue_number: string | null;
  comic_variant: string | null;
  comic_publisher: string | null;
  cover_image_url: string | null;
  purchase_price: number | null;
  sale_price: number | null;
  profit: number;
  buyer_id: string | null;
  sale_price_recorded: boolean;
} {
  // A skipped price is recorded as null (auditable absence of value), and never
  // contributes profit. A recorded price stores the real number + profit.
  const effectivePrice = priceRecorded ? salePrice : null;
  const profit = priceRecorded ? salePrice - (item.purchasePrice || 0) : 0;

  return {
    user_id: profileId,
    comic_title: item.comic.title,
    comic_issue_number: item.comic.issueNumber ?? null,
    comic_variant: item.comic.variant ?? null,
    comic_publisher: item.comic.publisher ?? null,
    cover_image_url: sanitizeCoverImageUrl(item.coverImageUrl),
    purchase_price: item.purchasePrice ?? null,
    sale_price: effectivePrice,
    profit,
    buyer_id: buyerId || null,
    sale_price_recorded: priceRecorded,
  };
}

/**
 * Pure helper (H-CO1): the revenue value a sale row should contribute to
 * totals. Rows flagged `sale_price_recorded === false` count as zero ("no
 * value") so a skipped bulk sale never inflates revenue. Rows with the flag
 * absent (pre-migration / legacy) fall back to their stored sale price.
 */
export function saleRevenueValue(sale: SaleRecordWithFlag): number {
  if (sale.priceRecorded === false) return 0;
  return sale.salePrice || 0;
}

/** True when a sale row was recorded without a price (skipped during bulk sell). */
export function isSalePriceMissing(sale: SaleRecordWithFlag): boolean {
  return sale.priceRecorded === false;
}

// Postgres / PostgREST signals for a column that does not exist yet — used to
// detect a pre-migration `sales` table that lacks `sale_price_recorded`.
const MISSING_COLUMN_CODES = new Set(["42703", "PGRST204"]);

function isMissingColumnError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return typeof code === "string" && MISSING_COLUMN_CODES.has(code);
}

/**
 * Records a bulk "Mark as Sold" sale where the per-item price was skipped
 * (H-CO1). Writes an enriched `sales` row with `sale_price_recorded = false`
 * and a null price so the sale is auditable.
 *
 * Migration-gated: `sale_price_recorded` (and the now-nullable `sale_price`)
 * arrive in the closeout migration. If they are not present yet the insert
 * fails with a missing-column error (42703 / PGRST204); we degrade gracefully
 * by recording the sale through the existing path as a $0 sale so the book is
 * still removed from the collection and the sale stays on the books.
 */
async function recordSkippedSale(
  profileId: string,
  item: CollectionItem,
  buyerId?: string
): Promise<SaleRecordWithFlag> {
  const fields = buildSaleInsertFields(profileId, item, 0, false, buyerId);

  const { data, error } = await supabase.from("sales").insert(fields).select().single();

  if (error) {
    if (isMissingColumnError(error)) {
      // Pre-migration fallback: record as a $0 sale via the standard path so the
      // book still leaves the collection. Flag stays false in app state so
      // revenue helpers continue to treat it as "no value".
      const fallback = await recordSaleDb(profileId, item, 0, buyerId);
      return { ...fallback, priceRecorded: false };
    }
    throw error;
  }

  // Mirror recordSaleDb: the comic leaves the collection once the sale is logged.
  await deleteComic(item.id);

  return {
    id: data.id,
    comic: item.comic,
    coverImageUrl: item.coverImageUrl,
    purchasePrice: item.purchasePrice,
    salePrice: data.sale_price ?? 0,
    saleDate: data.sale_date,
    profit: data.profit,
    buyerId: data.buyer_id,
    priceRecorded: false,
  };
}

export interface CollectionStats {
  totalComics: number;
  totalValue: number;
  totalCost: number;
  forSaleCount: number;
  profitLoss: number;
}

export interface SalesStats {
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
}

export interface UseCollectionReturn {
  // State
  collection: CollectionItem[];
  lists: UserList[];
  sales: SaleRecord[];
  isLoading: boolean;
  error: Error | null;

  // Auth awareness
  isCloudEnabled: boolean;
  profileId: string | null;

  // Collection CRUD
  addToCollection: (item: CollectionItem) => Promise<void>;
  updateCollectionItem: (id: string, updates: Partial<CollectionItem>) => Promise<void>;
  removeFromCollection: (id: string) => Promise<void>;
  getCollectionItem: (id: string) => CollectionItem | undefined;

  // List operations
  createList: (name: string) => Promise<UserList>;
  deleteList: (id: string) => Promise<void>;
  addItemToList: (itemId: string, listId: string) => Promise<void>;
  removeItemFromList: (itemId: string, listId: string) => Promise<void>;
  getItemsInList: (listId: string) => CollectionItem[];

  // Sales
  recordSale: (
    item: CollectionItem,
    salePrice: number,
    buyerId?: string,
    priceRecorded?: boolean
  ) => Promise<SaleRecord>;

  // Stats
  getCollectionStats: () => CollectionStats;
  getSalesStats: () => SalesStats;

  // Utility
  refresh: () => Promise<void>;
}

export function useCollection(): UseCollectionReturn {
  const { user, isSignedIn, isLoaded } = useUser();

  // State
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [lists, setLists] = useState<UserList[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const isCloudEnabled = isLoaded && isSignedIn && profileId !== null;

  // Load profile ID when user signs in
  useEffect(() => {
    async function loadProfile() {
      if (isLoaded && isSignedIn && user) {
        try {
          const profile = await getOrCreateProfile(user.id, user.primaryEmailAddress?.emailAddress);
          setProfileId(profile.id);
        } catch (err) {
          console.error("Failed to load profile:", err);
          setError(err instanceof Error ? err : new Error("Failed to load profile"));
          // Fall back to localStorage
          setProfileId(null);
        }
      } else if (isLoaded && !isSignedIn) {
        setProfileId(null);
      }
    }

    loadProfile();
  }, [isLoaded, isSignedIn, user]);

  // Load collection data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (profileId) {
        // Cloud mode - fetch from Supabase
        const [comicsData, listsData, salesData] = await Promise.all([
          getUserComics(profileId),
          getUserLists(profileId),
          getUserSales(profileId),
        ]);
        setCollection(comicsData);
        setLists(listsData);
        setSales(salesData);
      } else if (isLoaded) {
        // Guest mode - use localStorage
        setCollection(storage.getCollection());
        setLists(storage.getLists());
        setSales(storage.getSales());
      }
    } catch (err) {
      console.error("Failed to load collection:", err);
      setError(err instanceof Error ? err : new Error("Failed to load collection"));
      // Fall back to localStorage on error
      setCollection(storage.getCollection());
      setLists(storage.getLists());
      setSales(storage.getSales());
    } finally {
      setIsLoading(false);
    }
  }, [profileId, isLoaded]);

  // Load data when profileId changes or auth loads
  useEffect(() => {
    if (isLoaded) {
      loadData();
    }
  }, [isLoaded, profileId, loadData]);

  // Collection CRUD operations
  const addToCollection = useCallback(
    async (item: CollectionItem) => {
      // Optimistic update
      setCollection((prev) => [item, ...prev]);

      try {
        if (profileId) {
          await addComic(profileId, item);
        } else {
          storage.addToCollection(item);
        }
      } catch (err) {
        // Rollback on failure
        setCollection((prev) => prev.filter((i) => i.id !== item.id));
        throw err;
      }
    },
    [profileId]
  );

  const updateCollectionItem = useCallback(
    async (id: string, updates: Partial<CollectionItem>) => {
      // Capture previous state inside the updater so this callback doesn't
      // depend on `collection` (avoids stale closures / re-creation churn).
      let prevCollection: CollectionItem[] = [];
      setCollection((prev) => {
        prevCollection = prev;
        return prev.map((item) => (item.id === id ? { ...item, ...updates } : item));
      });

      try {
        if (profileId) {
          await updateComicDb(id, updates);
        } else {
          storage.updateCollectionItem(id, updates);
        }
      } catch (err) {
        // Rollback on failure
        setCollection(prevCollection);
        throw err;
      }
    },
    [profileId]
  );

  const removeFromCollection = useCallback(
    async (id: string) => {
      // Capture the removed item inside the updater so this callback doesn't
      // depend on `collection`.
      let removedItem: CollectionItem | undefined;
      setCollection((prev) => {
        removedItem = prev.find((item) => item.id === id);
        return prev.filter((item) => item.id !== id);
      });

      try {
        if (profileId) {
          await deleteComic(id);
        } else {
          storage.removeFromCollection(id);
        }
      } catch (err) {
        // Rollback on failure
        if (removedItem) {
          setCollection((prev) => [removedItem!, ...prev]);
        }
        throw err;
      }
    },
    [profileId]
  );

  const getCollectionItem = useCallback(
    (id: string) => collection.find((item) => item.id === id),
    [collection]
  );

  // List operations
  const createList = useCallback(
    async (name: string): Promise<UserList> => {
      if (profileId) {
        const newList = await createListDb(profileId, name);
        setLists((prev) => [...prev, newList]);
        return newList;
      } else {
        const newList = storage.createList(name);
        setLists(storage.getLists());
        return newList;
      }
    },
    [profileId]
  );

  const deleteListFn = useCallback(
    async (id: string) => {
      // Optimistic update
      setLists((prev) => prev.filter((list) => list.id !== id || list.isDefault));

      try {
        if (profileId) {
          await deleteListDb(id);
        } else {
          storage.removeList(id);
        }
      } catch (err) {
        // Reload lists on failure
        if (profileId) {
          const listsData = await getUserLists(profileId);
          setLists(listsData);
        } else {
          setLists(storage.getLists());
        }
        throw err;
      }
    },
    [profileId]
  );

  const addItemToList = useCallback(
    async (itemId: string, listId: string) => {
      // Optimistic update
      setCollection((prev) =>
        prev.map((item) =>
          item.id === itemId && !item.listIds.includes(listId)
            ? { ...item, listIds: [...item.listIds, listId] }
            : item
        )
      );

      try {
        if (profileId) {
          await addComicToListDb(itemId, listId);
        } else {
          storage.addItemToList(itemId, listId);
        }
      } catch (err) {
        // Reload collection on failure
        await loadData();
        throw err;
      }
    },
    [profileId, loadData]
  );

  const removeItemFromList = useCallback(
    async (itemId: string, listId: string) => {
      // Optimistic update
      setCollection((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, listIds: item.listIds.filter((id) => id !== listId) }
            : item
        )
      );

      try {
        if (profileId) {
          await removeComicFromListDb(itemId, listId);
        } else {
          storage.removeItemFromList(itemId, listId);
        }
      } catch (err) {
        // Reload collection on failure
        await loadData();
        throw err;
      }
    },
    [profileId, loadData]
  );

  const getItemsInList = useCallback(
    (listId: string): CollectionItem[] => {
      if (listId === "collection") {
        return collection;
      }
      return collection.filter((item) => item.listIds.includes(listId));
    },
    [collection]
  );

  // Sales
  const recordSale = useCallback(
    async (
      item: CollectionItem,
      salePrice: number,
      buyerId?: string,
      // H-CO1: bulk "Mark as Sold" may skip the per-item price prompt. The
      // single-item path always records a price, so this defaults to true.
      priceRecorded: boolean = true
    ): Promise<SaleRecord> => {
      // Remove from collection optimistically
      setCollection((prev) => prev.filter((i) => i.id !== item.id));

      try {
        let saleRecord: SaleRecordWithFlag;

        if (profileId) {
          if (priceRecorded) {
            // Standard path — unchanged behavior, no migration dependency.
            saleRecord = { ...(await recordSaleDb(profileId, item, salePrice, buyerId)), priceRecorded: true };
          } else {
            // Skipped-price path: persist an auditable flagged row with a null
            // price. Migration-gated — `sale_price_recorded` (+ nullable
            // sale_price) ship in the closeout migration. If the column is not
            // there yet, fall back so the sale still records (as a $0 sale).
            saleRecord = await recordSkippedSale(profileId, item, buyerId);
          }
        } else {
          // Guest/localStorage path: record at face value; the missing-price
          // flag is a cloud-only audit concern, so a skip stores a $0 sale.
          const guestPrice = priceRecorded ? salePrice : 0;
          saleRecord = { ...storage.recordSale(item, guestPrice, buyerId), priceRecorded };
        }

        // Add to sales list
        setSales((prev) => [saleRecord, ...prev]);
        return saleRecord;
      } catch (err) {
        // Rollback - add item back to collection
        setCollection((prev) => [item, ...prev]);
        throw err;
      }
    },
    [profileId]
  );

  // Stats
  const getCollectionStats = useCallback((): CollectionStats => {
    const totalComics = collection.length;
    const totalValue = collection.reduce(
      (sum, item) => sum + (item.comic.priceData?.estimatedValue || item.averagePrice || 0),
      0
    );
    const totalCost = collection.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);
    const forSaleCount = collection.filter((item) => item.forSale).length;
    const profitLoss = totalValue - totalCost;

    return { totalComics, totalValue, totalCost, forSaleCount, profitLoss };
  }, [collection]);

  const getSalesStats = useCallback((): SalesStats => {
    // H-CO1: sales recorded without a price (skipped bulk sell) must not inflate
    // revenue — saleRevenueValue() returns 0 for `sale_price_recorded === false`.
    return {
      totalSales: sales.length,
      totalRevenue: sales.reduce((sum, sale) => sum + saleRevenueValue(sale), 0),
      totalProfit: sales.reduce((sum, sale) => sum + sale.profit, 0),
    };
  }, [sales]);

  // Refresh
  const refresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  // While the marketplace is hidden, the default "For Sale" list is hidden
  // from every consumer (memberships stay in the DB untouched).
  const visibleLists = useMemo(() => getVisibleLists(lists, MARKETPLACE_ENABLED), [lists]);

  return {
    // State
    collection,
    lists: visibleLists,
    sales,
    isLoading,
    error,

    // Auth awareness
    isCloudEnabled,
    profileId,

    // Collection CRUD
    addToCollection,
    updateCollectionItem,
    removeFromCollection,
    getCollectionItem,

    // List operations
    createList,
    deleteList: deleteListFn,
    addItemToList,
    removeItemFromList,
    getItemsInList,

    // Sales
    recordSale,

    // Stats
    getCollectionStats,
    getSalesStats,

    // Utility
    refresh,
  };
}
