// Offline cache for Con Mode lookups
// Uses localStorage with LRU eviction and 7-day TTL

const CACHE_KEY = "con_mode_lookup_cache";
const OFFLINE_QUEUE_KEY = "con_mode_offline_queue";
// Browser event dispatched on `window` whenever the offline queue changes, so
// consumers can react to the new count instead of polling on an interval.
export const OFFLINE_QUEUE_CHANGED_EVENT = "offline-queue-changed";
const MAX_CACHED_ITEMS = 30;
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
// Skip rewriting lastAccessed (and the full localStorage serialize) on cache
// reads when the delta since the last recorded access is below this threshold.
const LAST_ACCESSED_WRITE_THRESHOLD_MS = 60 * 1000;

export interface GradeEstimate {
  grade: number;
  label: string;
  rawValue: number;
  slabbedValue: number;
}

export interface CachedLookup {
  key: string;
  data: {
    title: string;
    issueNumber: string;
    publisher?: string | null;
    releaseYear?: string | null;
    grade: number;
    averagePrice: number | null;
    recentSale: { price: number; date: string } | null;
    coverImageUrl?: string | null;
    keyInfo?: string[];
    gradeEstimates?: GradeEstimate[];
  };
  timestamp: number;
  lastAccessed: number;
}

export interface OfflineAction {
  id: string;
  type: "add_to_collection";
  data: {
    title: string;
    issueNumber: string;
    publisher?: string | null;
    releaseYear?: string | null;
    grade: number;
    averagePrice: number | null;
    recentSale: { price: number; date: string } | null;
    coverImageUrl?: string | null;
    keyInfo?: string[];
  };
  timestamp: number;
}

// Generate a cache key from lookup parameters
export function generateCacheKey(title: string, issueNumber: string, grade: number): string {
  const normalizedTitle = title.toLowerCase().trim().replace(/\s+/g, "-");
  const normalizedIssue = issueNumber.toString().trim();
  return `${normalizedTitle}-${normalizedIssue}-${grade}`;
}

// Get all cached lookups
function getCachedLookups(): CachedLookup[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(CACHE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Save cached lookups
function saveCachedLookups(lookups: CachedLookup[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(lookups));
  } catch (error) {
    console.error("Failed to save lookup cache:", error);
    // If storage is full, try to evict items and retry
    const evictedLookups = evictOldestItems(lookups, 5);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(evictedLookups));
    } catch {
      console.error("Failed to save even after eviction");
    }
  }
}

// Evict oldest items (LRU based on lastAccessed)
function evictOldestItems(lookups: CachedLookup[], count: number): CachedLookup[] {
  return lookups
    .sort((a, b) => b.lastAccessed - a.lastAccessed)
    .slice(0, Math.max(0, lookups.length - count));
}

// Remove expired items
function removeExpiredItems(lookups: CachedLookup[]): CachedLookup[] {
  const now = Date.now();
  return lookups.filter((item) => now - item.timestamp < TTL_MS);
}

// Get a cached lookup result
export function getCachedLookup(key: string): CachedLookup["data"] | null {
  let lookups = getCachedLookups();

  // Clean up expired items first
  lookups = removeExpiredItems(lookups);

  const item = lookups.find((l) => l.key === key);
  if (!item) return null;

  // Only update last accessed time (and persist) when it has drifted enough to
  // matter for LRU. Avoids a full localStorage write on every cache read.
  const now = Date.now();
  if (now - item.lastAccessed >= LAST_ACCESSED_WRITE_THRESHOLD_MS) {
    item.lastAccessed = now;
    saveCachedLookups(lookups);
  }

  return item.data;
}

// Cache a lookup result
export function cacheLookup(key: string, data: CachedLookup["data"]): void {
  let lookups = getCachedLookups();

  // Remove expired items
  lookups = removeExpiredItems(lookups);

  // Check if this key already exists and update it
  const existingIndex = lookups.findIndex((l) => l.key === key);
  const now = Date.now();

  if (existingIndex !== -1) {
    lookups[existingIndex] = {
      ...lookups[existingIndex],
      data,
      timestamp: now,
      lastAccessed: now,
    };
  } else {
    // Add new item
    lookups.push({
      key,
      data,
      timestamp: now,
      lastAccessed: now,
    });

    // Evict oldest items if over limit
    if (lookups.length > MAX_CACHED_ITEMS) {
      lookups = evictOldestItems(lookups, lookups.length - MAX_CACHED_ITEMS);
    }
  }

  saveCachedLookups(lookups);

  // Also notify service worker to cache
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: "CACHE_LOOKUP_RESULT",
      key,
      data,
    });
  }
}

// Get all cached lookups (for offline search)
export function getAllCachedLookups(): CachedLookup[] {
  let lookups = getCachedLookups();
  lookups = removeExpiredItems(lookups);
  return lookups.sort((a, b) => b.lastAccessed - a.lastAccessed);
}

// Search cached lookups
export function searchCachedLookups(query: string): CachedLookup[] {
  const lookups = getAllCachedLookups();
  const normalizedQuery = query.toLowerCase().trim();

  return lookups.filter((lookup) => {
    const title = lookup.data.title.toLowerCase();
    const issue = lookup.data.issueNumber.toString();
    const publisher = (lookup.data.publisher || "").toLowerCase();

    return (
      title.includes(normalizedQuery) ||
      issue.includes(normalizedQuery) ||
      publisher.includes(normalizedQuery)
    );
  });
}

// Clear all cached lookups
export function clearLookupCache(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CACHE_KEY);
}

// Get cache statistics
export function getCacheStats(): {
  count: number;
  oldestDate: Date | null;
  newestDate: Date | null;
} {
  const lookups = getAllCachedLookups();
  if (lookups.length === 0) {
    return { count: 0, oldestDate: null, newestDate: null };
  }

  const timestamps = lookups.map((l) => l.timestamp);
  return {
    count: lookups.length,
    oldestDate: new Date(Math.min(...timestamps)),
    newestDate: new Date(Math.max(...timestamps)),
  };
}

// Offline action queue functions
export function getOfflineQueue(): OfflineAction[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Notify consumers that the offline queue changed (SSR-safe)
function notifyOfflineQueueChanged(count: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_CHANGED_EVENT, { detail: { count } }));
}

function saveOfflineQueue(queue: OfflineAction[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error("Failed to save offline queue:", error);
  }
  // Notify consumers of the new queue count
  notifyOfflineQueueChanged(queue.length);
}

export function addToOfflineQueue(action: Omit<OfflineAction, "id" | "timestamp">): void {
  const queue = getOfflineQueue();
  queue.push({
    ...action,
    id: `offline-${crypto.randomUUID()}`,
    timestamp: Date.now(),
  });
  saveOfflineQueue(queue);

  // Request background sync if available
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        if ("sync" in registration) {
          (
            registration as ServiceWorkerRegistration & {
              sync: { register: (tag: string) => Promise<void> };
            }
          ).sync.register("sync-offline-actions");
        }
      })
      .catch(() => {
        // Background sync not supported, will sync on next online event
      });
  }
}

export function removeFromOfflineQueue(id: string): void {
  const queue = getOfflineQueue().filter((item) => item.id !== id);
  saveOfflineQueue(queue);
}

export function clearOfflineQueue(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
  // Notify consumers the queue is now empty
  notifyOfflineQueueChanged(0);
}

export function getOfflineQueueCount(): number {
  return getOfflineQueue().length;
}

// ===========================================
// Key Hunt Scan History (formerly Con Mode)
// ===========================================

const HISTORY_KEY = "key_hunt_scan_history";
const LEGACY_HISTORY_KEY = "con_mode_scan_history";
const MAX_HISTORY_ITEMS = 30;
const HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface KeyHuntHistoryEntry {
  id: string;
  title: string;
  issueNumber: string;
  variant?: string;
  publisher?: string;
  grade: number;
  isSlabbed: boolean;
  priceResult: {
    rawPrice: number | null;
    slabbedPrice: number | null;
    recentSale?: { price: number; date: string };
  };
  coverImageUrl?: string;
  // Key collector facts (e.g., "First appearance of Miles Morales") so the
  // KEY ISSUE chip renders consistently in the history detail view, not just
  // on the live result. Persisted into localStorage; missing on legacy entries
  // (treat as undefined / no chip).
  keyInfo?: string[];
  keyInfoMeta?: {
    matchType: "exact" | "year-resolved";
    matchedYear: number | null;
    totalCandidates: number;
  };
  timestamp: number;
}

// Get all history entries (with migration from legacy key)
function getHistoryEntries(): KeyHuntHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    // Try new key first
    let data = localStorage.getItem(HISTORY_KEY);
    if (data) return JSON.parse(data);

    // Fall back to legacy key and migrate
    const legacyData = localStorage.getItem(LEGACY_HISTORY_KEY);
    if (legacyData) {
      const entries = JSON.parse(legacyData);
      // Migrate to new key
      localStorage.setItem(HISTORY_KEY, legacyData);
      localStorage.removeItem(LEGACY_HISTORY_KEY);
      return entries;
    }

    return [];
  } catch {
    return [];
  }
}

// Save history entries
function saveHistoryEntries(entries: KeyHuntHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error("Failed to save history:", error);
    // If storage is full, remove oldest entries and retry
    const trimmed = entries.slice(0, Math.max(10, entries.length - 5));
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    } catch {
      console.error("Failed to save even after trimming");
    }
  }
}

// Remove expired history entries
function removeExpiredHistory(entries: KeyHuntHistoryEntry[]): KeyHuntHistoryEntry[] {
  const now = Date.now();
  return entries.filter((entry) => now - entry.timestamp < HISTORY_TTL_MS);
}

// Add entry to history
export function addToKeyHuntHistory(
  entry: Omit<KeyHuntHistoryEntry, "id" | "timestamp">
): KeyHuntHistoryEntry {
  let entries = getHistoryEntries();

  // Remove expired entries
  entries = removeExpiredHistory(entries);

  // Create new entry with ID and timestamp
  const newEntry: KeyHuntHistoryEntry = {
    ...entry,
    id: `history-${crypto.randomUUID()}`,
    timestamp: Date.now(),
  };

  // Grades are canonical-scale numbers, so exact === comparison is intentional/safe.
  // Check for duplicate (same title, issue, grade) and remove if exists
  entries = entries.filter(
    (e) =>
      !(
        e.title.toLowerCase() === entry.title.toLowerCase() &&
        e.issueNumber === entry.issueNumber &&
        e.grade === entry.grade
      )
  );

  // Add new entry at the beginning (most recent first)
  entries.unshift(newEntry);

  // Trim to max items
  if (entries.length > MAX_HISTORY_ITEMS) {
    entries = entries.slice(0, MAX_HISTORY_ITEMS);
  }

  saveHistoryEntries(entries);
  return newEntry;
}

// Get all history (cleaned of expired entries)
export function getKeyHuntHistory(): KeyHuntHistoryEntry[] {
  let entries = getHistoryEntries();
  entries = removeExpiredHistory(entries);
  // Save cleaned list back
  saveHistoryEntries(entries);
  return entries;
}

// Get a specific history entry by ID
export function getKeyHuntHistoryEntry(id: string): KeyHuntHistoryEntry | null {
  const entries = getKeyHuntHistory();
  return entries.find((e) => e.id === id) || null;
}

// Remove a specific history entry
export function removeFromKeyHuntHistory(id: string): void {
  let entries = getHistoryEntries();
  entries = entries.filter((e) => e.id !== id);
  saveHistoryEntries(entries);
}

// Clear all history
export function clearKeyHuntHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(LEGACY_HISTORY_KEY);
}

// Get history count
export function getKeyHuntHistoryCount(): number {
  return getKeyHuntHistory().length;
}
