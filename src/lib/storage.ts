import { CollectionItem, SaleRecord, UserList } from "@/types/comic";

const COLLECTION_KEY = "comic_collection";
const LISTS_KEY = "comic_lists";
const SALES_KEY = "comic_sales";
const RECENTLY_VIEWED_KEY = "comic_recently_viewed";

// Storage quota helpers
const STORAGE_FALLBACK_QUOTA = 5 * 1024 * 1024; // 5MB fallback when Storage API is unavailable

export class StorageQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageQuotaError";
  }
}

// Estimate total localStorage usage in bytes. Synchronous best-effort against
// the ~5MB fallback quota.
function getStorageUsage(total: number = STORAGE_FALLBACK_QUOTA): {
  used: number;
  total: number;
  percentage: number;
} {
  if (typeof window === "undefined") return { used: 0, total, percentage: 0 };

  let used = 0;
  for (const key in localStorage) {
    if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
      // Each character is 2 bytes in UTF-16
      used += (localStorage[key].length + key.length) * 2;
    }
  }

  const percentage = total > 0 ? used / total : 0;

  return { used, total, percentage };
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Safe setItem with error handling
function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    if (error instanceof Error && error.name === "QuotaExceededError") {
      const usage = getStorageUsage();
      throw new StorageQuotaError(
        `Storage is full (${formatBytes(usage.used)} used). Please sign in to sync your collection to the cloud, or remove some comics to free up space.`
      );
    }
    throw error;
  }
}

// Default lists that every user starts with
const DEFAULT_LISTS: UserList[] = [
  {
    id: "collection",
    name: "My Collection",
    description: "All comics in your collection",
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "want-list",
    name: "Want List",
    description: "Comics you want to acquire",
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "for-sale",
    name: "For Sale",
    description: "Comics you're selling",
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "slabbed",
    name: "Slabbed",
    description: "Graded/slabbed comics",
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "passed-on",
    name: "Passed On",
    description: "Comics you saw but didn't buy",
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
];

export const storage = {
  // Collection methods
  getCollection(): CollectionItem[] {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(COLLECTION_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveCollection(collection: CollectionItem[]): void {
    if (typeof window === "undefined") return;
    safeSetItem(COLLECTION_KEY, JSON.stringify(collection));
  },

  addToCollection(item: CollectionItem): CollectionItem[] {
    const collection = this.getCollection();
    collection.unshift(item);
    this.saveCollection(collection);
    return collection;
  },

  updateCollectionItem(id: string, updates: Partial<CollectionItem>): CollectionItem[] {
    const collection = this.getCollection();
    const index = collection.findIndex((item) => item.id === id);
    if (index !== -1) {
      collection[index] = { ...collection[index], ...updates };
      this.saveCollection(collection);
    }
    return collection;
  },

  removeFromCollection(id: string): CollectionItem[] {
    const collection = this.getCollection().filter((item) => item.id !== id);
    this.saveCollection(collection);
    return collection;
  },

  getCollectionItem(id: string): CollectionItem | undefined {
    return this.getCollection().find((item) => item.id === id);
  },

  // List methods
  getLists(): UserList[] {
    if (typeof window === "undefined") return DEFAULT_LISTS;
    const data = localStorage.getItem(LISTS_KEY);
    if (!data) {
      this.saveLists(DEFAULT_LISTS);
      return DEFAULT_LISTS;
    }

    // Ensure all default lists exist (handles migrations when new default lists are added)
    const lists: UserList[] = JSON.parse(data);
    let needsSave = false;
    for (const defaultList of DEFAULT_LISTS) {
      if (!lists.find((l) => l.id === defaultList.id)) {
        lists.push(defaultList);
        needsSave = true;
      }
    }
    if (needsSave) {
      this.saveLists(lists);
    }

    return lists;
  },

  saveLists(lists: UserList[]): void {
    if (typeof window === "undefined") return;
    safeSetItem(LISTS_KEY, JSON.stringify(lists));
  },

  addList(list: UserList): UserList[] {
    const lists = this.getLists();
    lists.push(list);
    this.saveLists(lists);
    return lists;
  },

  createList(name: string): UserList {
    const newList: UserList = {
      id: `list-${Date.now()}`,
      name,
      description: "",
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    this.addList(newList);
    return newList;
  },

  removeList(id: string): UserList[] {
    const lists = this.getLists().filter((list) => list.id !== id || list.isDefault);
    this.saveLists(lists);
    return lists;
  },

  // Get items in a specific list
  getItemsInList(listId: string): CollectionItem[] {
    const collection = this.getCollection();
    if (listId === "collection") {
      return collection;
    }
    return collection.filter((item) => item.listIds.includes(listId));
  },

  // Add item to a list
  addItemToList(itemId: string, listId: string): CollectionItem[] {
    const collection = this.getCollection();
    const index = collection.findIndex((item) => item.id === itemId);
    if (index !== -1 && !collection[index].listIds.includes(listId)) {
      collection[index].listIds.push(listId);
      this.saveCollection(collection);
    }
    return collection;
  },

  // Remove item from a list
  removeItemFromList(itemId: string, listId: string): CollectionItem[] {
    const collection = this.getCollection();
    const index = collection.findIndex((item) => item.id === itemId);
    if (index !== -1) {
      collection[index].listIds = collection[index].listIds.filter((id) => id !== listId);
      this.saveCollection(collection);
    }
    return collection;
  },

  // Calculate collection stats
  getCollectionStats(): {
    totalComics: number;
    totalValue: number;
    forSaleCount: number;
  } {
    const collection = this.getCollection();
    return {
      totalComics: collection.length,
      totalValue: collection.reduce(
        (sum, item) => sum + (item.comic.priceData?.estimatedValue || item.purchasePrice || 0),
        0
      ),
      forSaleCount: collection.filter((item) => item.forSale).length,
    };
  },

  // Sales methods
  getSales(): SaleRecord[] {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(SALES_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveSales(sales: SaleRecord[]): void {
    if (typeof window === "undefined") return;
    safeSetItem(SALES_KEY, JSON.stringify(sales));
  },

  recordSale(item: CollectionItem, salePrice: number, buyerId?: string): SaleRecord {
    const saleRecord: SaleRecord = {
      id: `sale-${Date.now()}`,
      comic: item.comic,
      coverImageUrl: item.coverImageUrl,
      purchasePrice: item.purchasePrice,
      salePrice,
      saleDate: new Date().toISOString(),
      profit: salePrice - (item.purchasePrice || 0),
      buyerId: buyerId || null,
    };

    const sales = this.getSales();
    sales.unshift(saleRecord);
    this.saveSales(sales);

    // Remove from collection
    this.removeFromCollection(item.id);

    return saleRecord;
  },

  getSalesStats(): {
    totalSales: number;
    totalRevenue: number;
    totalProfit: number;
  } {
    const sales = this.getSales();
    return {
      totalSales: sales.length,
      totalRevenue: sales.reduce((sum, sale) => sum + sale.salePrice, 0),
      totalProfit: sales.reduce((sum, sale) => sum + sale.profit, 0),
    };
  },

  // Recently viewed methods
  getRecentlyViewed(): string[] {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(RECENTLY_VIEWED_KEY);
    return data ? JSON.parse(data) : [];
  },

  addToRecentlyViewed(itemId: string): void {
    if (typeof window === "undefined") return;
    const recentIds = this.getRecentlyViewed();
    // Remove if already exists
    const filtered = recentIds.filter((id) => id !== itemId);
    // Add to front
    filtered.unshift(itemId);
    // Keep only last 10
    const trimmed = filtered.slice(0, 10);
    try {
      safeSetItem(RECENTLY_VIEWED_KEY, JSON.stringify(trimmed));
    } catch {
      // Silently fail for recently viewed - not critical
    }
  },

  getRecentlyViewedItems(): CollectionItem[] {
    const recentIds = this.getRecentlyViewed();
    const collection = this.getCollection();
    return recentIds
      .map((id) => collection.find((item) => item.id === id))
      .filter((item): item is CollectionItem => item !== undefined)
      .slice(0, 5);
  },
};
