import { Redis } from "@upstash/redis";

// Initialize Redis only when environment variables are present
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

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
  webhook: 60 * 60, // 1 hour (prevent duplicate webhook processing)
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
 * @returns Cached or freshly fetched data
 */
export async function cacheGetOrSet<T>(
  key: string,
  prefix: keyof typeof CACHE_PREFIX,
  fetcher: () => Promise<T>
): Promise<{ data: T; cached: boolean }> {
  // Try to get from cache first
  const cached = await cacheGet<T>(key, prefix);
  if (cached !== null) {
    return { data: cached, cached: true };
  }

  // Fetch fresh data
  const data = await fetcher();

  // Cache it for next time (don't await - fire and forget)
  cacheSet(key, data, prefix);

  return { data, cached: false };
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
  return `${title.toLowerCase().trim()}|${issueNumber.toLowerCase().trim()}`;
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
