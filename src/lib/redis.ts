import { Redis } from "@upstash/redis";

/**
 * Shared Upstash Redis client.
 *
 * Single source of truth so cache.ts, rateLimit.ts, and route handlers don't
 * each spin up their own client (and each parse the same env vars). Returns
 * null when the Upstash env vars aren't configured, so callers must guard.
 */
export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

/**
 * Whether Redis is configured and available for use.
 */
export function isRedisAvailable(): boolean {
  return redis !== null;
}
