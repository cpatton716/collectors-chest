"use client";

import { useCallback, useEffect, useState } from "react";

import { useUser } from "@clerk/nextjs";

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
import { storage } from "@/lib/storage";

import { CollectionItem, SaleRecord, UserList } from "@/types/comic";

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
  recordSale: (item: CollectionItem, salePrice: number, buyerId?: string) => Promise<SaleRecord>;

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
    async (item: CollectionItem, salePrice: number, buyerId?: string): Promise<SaleRecord> => {
      // Remove from collection optimistically
      setCollection((prev) => prev.filter((i) => i.id !== item.id));

      try {
        let saleRecord: SaleRecord;

        if (profileId) {
          saleRecord = await recordSaleDb(profileId, item, salePrice, buyerId);
        } else {
          saleRecord = storage.recordSale(item, salePrice, buyerId);
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
    return {
      totalSales: sales.length,
      totalRevenue: sales.reduce((sum, sale) => sum + sale.salePrice, 0),
      totalProfit: sales.reduce((sum, sale) => sum + sale.profit, 0),
    };
  }, [sales]);

  // Refresh
  const refresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  return {
    // State
    collection,
    lists,
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
