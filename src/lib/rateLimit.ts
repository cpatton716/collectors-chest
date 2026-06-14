import { NextResponse } from "next/server";

import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "./redis";

// Rate limiters for different endpoint types
// analytics:false on all limiters - the analytics writes double the Upstash
// command count (one per limit() call) and we don't consume the dashboards.
//
// L-CC25 (Redis read batching) note: each limiter's `.limit()` already issues
// its multi-key sliding-window reads/writes as a single Upstash pipeline
// internally, so there is nothing to hand-batch in the per-limiter definitions
// below. The only fan-out a request could create is checking SEVERAL limiters
// at once; `checkRateLimitsBatch` (below) covers that case by running the
// checks concurrently so they share one network flush instead of N serial
// round trips.
export const rateLimiters = {
  // AI endpoints - expensive, strict limits (5 per minute)
  analyze: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "1 m"),
        analytics: false,
        prefix: "ratelimit:analyze",
      })
    : null,

  // General API - moderate limits (30 per minute)
  api: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, "1 m"),
        analytics: false,
        prefix: "ratelimit:api",
      })
    : null,

  // Bidding - prevent sniping bots (3 per minute)
  bidding: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, "1 m"),
        analytics: false,
        prefix: "ratelimit:bidding",
      })
    : null,

  // Comic lookup - moderate limits (20 per minute)
  lookup: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, "1 m"),
        analytics: false,
        prefix: "ratelimit:lookup",
      })
    : null,
};

// Response type for rate limit check
interface RateLimitResult {
  success: boolean;
  response?: NextResponse;
}

/**
 * Check if a request should be rate limited
 * @param limiter - The rate limiter to use
 * @param identifier - Unique identifier (userId, IP, etc.)
 * @returns Object with success flag and optional 429 response
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<RateLimitResult> {
  // If rate limiting is not configured, allow all requests
  if (!limiter) {
    return { success: true };
  }

  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);

    if (!success) {
      return {
        success: false,
        response: NextResponse.json(
          { error: "Too many requests. Please try again later." },
          {
            status: 429,
            headers: {
              "X-RateLimit-Limit": limit.toString(),
              "X-RateLimit-Remaining": remaining.toString(),
              "X-RateLimit-Reset": reset.toString(),
              "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
            },
          }
        ),
      };
    }

    return { success: true };
  } catch (error) {
    // If rate limiting fails, log and allow the request
    console.error("Rate limit check failed:", error);
    return { success: true };
  }
}

/**
 * Check several rate limiters for a request in one batched pass (L-CC25).
 *
 * When a single request needs to satisfy more than one limiter (e.g. a strict
 * per-action limit AND a general per-IP limit), calling `checkRateLimit` in
 * series issues each limiter's Upstash pipeline back-to-back, doubling the
 * round-trip latency. Running them concurrently lets the underlying client
 * flush them together, so the per-request cost is one batched flush instead of
 * N serial ones.
 *
 * Fails open just like `checkRateLimit`: any limiter that errors is treated as
 * a pass. The first limiter that denies short-circuits the result and returns
 * its 429 response (limiters are evaluated in array order for a deterministic
 * response).
 *
 * @param checks - One entry per limiter to evaluate (null limiters are skipped)
 * @returns Combined result: success only if every limiter passed; otherwise the
 *   first denial's 429 response.
 */
export async function checkRateLimitsBatch(
  checks: { limiter: Ratelimit | null; identifier: string }[]
): Promise<RateLimitResult> {
  if (checks.length === 0) return { success: true };

  const results = await Promise.all(
    checks.map(({ limiter, identifier }) => checkRateLimit(limiter, identifier))
  );

  const firstDenial = results.find((r) => !r.success);
  return firstDenial ?? { success: true };
}

/**
 * Get identifier for rate limiting from request context
 * Prefers userId, falls back to IP, then "anonymous"
 */
export function getRateLimitIdentifier(
  userId: string | null | undefined,
  ip: string | null | undefined
): string {
  return userId || ip || "anonymous";
}
