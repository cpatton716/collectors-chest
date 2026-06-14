import { normalizeTitle, normalizeIssueNumber } from "./normalizeTitle";
import { redis } from "./redis";

// Cache key prefixes for different data types
const CACHE_PREFIX = {
  ebayPrice: "cache:ebay:",
  comicMetadata: "cache:comic:",
  aiAnalyze: "cache:ai:",
  barcode: "cache:barcode:", // Phase 2: Barcode lookups (immutable)
  cert: "cache:cert:", // Phase 2: CGC/CBCS cert lookups (immutable)
  profile: "cache:profile:", // Phase 3: User profiles (short TTL for freshness)
  titleSuggest: "cache:title:", // Phase 4: Title autocomplete (reduce AI calls)
  webhook: "cache:webhook:", // Webhook idempotency (prevent duplicate processing)
  popularTitles: "cache:popular:", // Popular titles suggestions (hourly refresh)
} as const;

// TTL values in seconds
const CACHE_TTL = {
  ebayPrice: 60 * 60 * 12, // 12 hours
  comicMetadata: 60 * 60 * 24 * 7, // 7 days
  aiAnalyze: 60 * 60 * 24 * 30, // 30 days (AI results are stable)
  barcode: 60 * 60 * 24 * 180, // 6 months (barcodes never change)
  cert: 60 * 60 * 24 * 365, // 1 year (certificates are permanent)
  profile: 60 * 5, // 5 minutes (short for subscription/settings changes)
  titleSuggest: 60 * 60 * 24, // 24 hours (title data is stable)
  webhook: 60 * 60 * 24 * 3, // 3 days (prevent duplicate webhook processing; Stripe retries failed events for up to ~3 days)
  popularTitles: 60 * 60, // 1 hour (refresh popular titles hourly)
} as const;

/**
 * Check if Redis caching is available
 */
export function isCacheAvailable(): boolean {
  return redis !== null;
}

/**
 * Get a value from Redis cache
 * @param key - Cache key (will be prefixed automatically)
 * @param prefix - Cache prefix type
 * @returns Cached value or null if not found
 */
export async function cacheGet<T>(
  key: string,
  prefix: keyof typeof CACHE_PREFIX
): Promise<T | null> {
  if (!redis) return null;

  try {
    const fullKey = `${CACHE_PREFIX[prefix]}${key}`;
    const data = await redis.get<T>(fullKey);
    return data;
  } catch (error) {
    console.error("Redis cache get error:", error);
    return null;
  }
}

/**
 * Get several values for the SAME prefix in a single round trip (L-CC25).
 *
 * Use this anywhere a code path would otherwise loop and `await cacheGet` once
 * per key (a fan-out). A naive loop of N keys spends N Upstash commands and N
 * network round trips; `mget` collapses that to a single command + round trip,
 * keeping the per-request command budget flat at 1 regardless of how many keys
 * are read. Prefer this over `Promise.all([...].map(cacheGet))` for hot paths.
 *
 * Per-request command budget: 1 Upstash command (one `MGET`) for any key count.
 *
 * @param keys - Cache keys (each will be prefixed automatically)
 * @param prefix - Cache prefix type (single prefix for the whole batch)
 * @returns Array aligned to `keys`; each slot is the cached value or null
 *   (cache miss). Returns all-null when Redis is unavailable or on error so
 *   callers can treat it as a clean miss and fall back to fetching.
 */
export async function cacheGetMany<T>(
  keys: string[],
  prefix: keyof typeof CACHE_PREFIX
): Promise<(T | null)[]> {
  if (keys.length === 0) return [];
  if (!redis) return keys.map(() => null);

  try {
    const fullKeys = keys.map((key) => `${CACHE_PREFIX[prefix]}${key}`);
    // Upstash returns one slot per key (value or null), JSON-deserialized like
    // .get(). A single MGET command covers the whole batch.
    const values = await redis.mget<(T | null)[]>(...fullKeys);
    // Defensive: normalize length/shape so the result always aligns to `keys`.
    return keys.map((_, i) => (values?.[i] ?? null) as T | null);
  } catch (error) {
    console.error("Redis cache mget error:", error);
    return keys.map(() => null);
  }
}

/**
 * Set a value in Redis cache with automatic TTL
 * @param key - Cache key (will be prefixed automatically)
 * @param value - Value to cache (will be JSON serialized)
 * @param prefix - Cache prefix type (determines TTL)
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  prefix: keyof typeof CACHE_PREFIX,
  ttlOverride?: number
): Promise<void> {
  if (!redis) return;

  try {
    const fullKey = `${CACHE_PREFIX[prefix]}${key}`;
    const ttl = ttlOverride || CACHE_TTL[prefix];
    await redis.set(fullKey, value, { ex: ttl });
  } catch (error) {
    console.error("Redis cache set error:", error);
    // Don't throw - cache failures shouldn't break the app
  }
}

/**
 * Delete a value from Redis cache
 * @param key - Cache key (will be prefixed automatically)
 * @param prefix - Cache prefix type
 */
export async function cacheDelete(key: string, prefix: keyof typeof CACHE_PREFIX): Promise<void> {
  if (!redis) return;

  try {
    const fullKey = `${CACHE_PREFIX[prefix]}${key}`;
    await redis.del(fullKey);
  } catch (error) {
    console.error("Redis cache delete error:", error);
  }
}

/**
 * Get or set pattern - returns cached value or fetches and caches
 * @param key - Cache key
 * @param prefix - Cache prefix type
 * @param fetcher - Async function to fetch data if not cached
 * @param options - Optional `shouldCache` predicate; when it returns false the
 *   freshly fetched value is NOT persisted (e.g., skip caching empty/error
 *   results so a transient failure isn't pinned for the full TTL).
 * @returns Cached or freshly fetched data
 */
export async function cacheGetOrSet<T>(
  key: string,
  prefix: keyof typeof CACHE_PREFIX,
  fetcher: () => Promise<T>,
  options?: { shouldCache?: (data: T) => boolean }
): Promise<{ data: T; cached: boolean }> {
  // Try to get from cache first
  const cached = await cacheGet<T>(key, prefix);
  if (cached !== null) {
    return { data: cached, cached: true };
  }

  // Fetch fresh data
  const data = await fetcher();

  // Cache it for next time (don't await - fire and forget) unless the caller
  // opts out via shouldCache (e.g., to avoid persisting empty/error results).
  if (!options?.shouldCache || options.shouldCache(data)) {
    cacheSet(key, data, prefix);
  }

  return { data, cached: false };
}

// ============================================================================
// Webhook idempotency (Stripe, etc.)
// ============================================================================

/**
 * Whether a webhook event has already been fully processed.
 *
 * Pair with markWebhookProcessed AFTER the handler succeeds. Marking before
 * the handler runs (the old pattern) meant a handler that threw still left the
 * "processed" marker behind, so Stripe's automatic retry was silently dropped
 * and the event never completed. See H-PAY1.
 */
export async function isWebhookProcessed(eventId: string): Promise<boolean> {
  const seen = await cacheGet<boolean>(eventId, "webhook");
  return seen === true;
}

/**
 * Mark a webhook event as fully processed so retries are deduped. Call this
 * only after the handler has completed successfully.
 */
export async function markWebhookProcessed(eventId: string): Promise<void> {
  await cacheSet(eventId, true, "webhook");
}

// ============================================================================
// Specialized cache functions for common use cases
// ============================================================================

/**
 * Generate cache key for eBay price lookup
 */
export function generateEbayPriceCacheKey(
  title: string,
  issueNumber: string,
  grade: number,
  isSlabbed: boolean,
  gradingCompany?: string
): string {
  return [
    title.toLowerCase().trim(),
    issueNumber.toLowerCase().trim(),
    grade.toString(),
    isSlabbed ? "slabbed" : "raw",
    gradingCompany?.toLowerCase() || "",
  ].join("|");
}

/**
 * Generate cache key for comic metadata lookup
 */
export function generateComicMetadataCacheKey(title: string, issueNumber: string): string {
  return `${normalizeTitle(title)}|${normalizeIssueNumber(issueNumber)}`;
}

/**
 * Generate cache key for AI image analysis
 * Uses a hash of the image to identify unique covers
 */
export function generateAiAnalyzeCacheKey(imageHash: string): string {
  return imageHash;
}

/**
 * Hash function for creating cache keys from image data
 * Uses SHA-256 for collision-free fingerprinting
 */
export function hashImageData(base64Image: string): string {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(base64Image).digest("hex");
}
