/**
 * Rate limit helper tests (L-CC29)
 *
 * Focus: getRateLimitIdentifier precedence (userId > ip > "anonymous") and the
 * checkRateLimit fail-open / 429 contract. The shared redis module is mocked to
 * null so no real client is constructed and limiters are null (the
 * "not configured" path).
 *
 * @jest-environment node
 *
 * (node env: rateLimit.ts imports next/server, which needs Web Request/Response
 * globals that jsdom lacks but Node provides.)
 */

// Mock the shared redis module BEFORE importing rateLimit so the module-level
// rateLimiters are all null (Redis not configured).
jest.mock("../redis", () => ({
  redis: null,
  isRedisAvailable: () => false,
}));

import type { Ratelimit } from "@upstash/ratelimit";

import {
  checkRateLimit,
  checkRateLimitsBatch,
  getRateLimitIdentifier,
  rateLimiters,
} from "../rateLimit";

describe("getRateLimitIdentifier", () => {
  it("prefers userId when present", () => {
    expect(getRateLimitIdentifier("user_123", "1.2.3.4")).toBe("user_123");
  });

  it("falls back to ip when userId is null", () => {
    expect(getRateLimitIdentifier(null, "1.2.3.4")).toBe("1.2.3.4");
  });

  it("falls back to ip when userId is undefined", () => {
    expect(getRateLimitIdentifier(undefined, "5.6.7.8")).toBe("5.6.7.8");
  });

  it("falls back to anonymous when both are missing", () => {
    expect(getRateLimitIdentifier(null, null)).toBe("anonymous");
    expect(getRateLimitIdentifier(undefined, undefined)).toBe("anonymous");
  });

  it("treats empty-string userId as absent and uses ip", () => {
    expect(getRateLimitIdentifier("", "9.9.9.9")).toBe("9.9.9.9");
  });

  it("treats empty-string userId and ip as anonymous", () => {
    expect(getRateLimitIdentifier("", "")).toBe("anonymous");
  });
});

describe("rateLimiters (Redis unconfigured)", () => {
  it("exposes all four limiter slots as null when Redis is absent", () => {
    expect(rateLimiters.analyze).toBeNull();
    expect(rateLimiters.api).toBeNull();
    expect(rateLimiters.bidding).toBeNull();
    expect(rateLimiters.lookup).toBeNull();
  });
});

describe("checkRateLimit", () => {
  it("allows the request when limiter is null (not configured)", async () => {
    const result = await checkRateLimit(null, "user_1");
    expect(result.success).toBe(true);
    expect(result.response).toBeUndefined();
  });

  it("allows the request when the limiter reports success", async () => {
    const limiter = {
      limit: jest.fn().mockResolvedValue({
        success: true,
        limit: 5,
        remaining: 4,
        reset: Date.now() + 60_000,
      }),
    } as unknown as Ratelimit;

    const result = await checkRateLimit(limiter, "user_1");
    expect(result.success).toBe(true);
    expect(result.response).toBeUndefined();
  });

  it("returns a 429 with rate-limit headers when the limiter denies", async () => {
    const reset = Date.now() + 30_000;
    const limiter = {
      limit: jest.fn().mockResolvedValue({
        success: false,
        limit: 5,
        remaining: 0,
        reset,
      }),
    } as unknown as Ratelimit;

    const result = await checkRateLimit(limiter, "user_1");
    expect(result.success).toBe(false);
    expect(result.response).toBeDefined();
    expect(result.response!.status).toBe(429);
    expect(result.response!.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(result.response!.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(result.response!.headers.get("Retry-After")).toBeTruthy();
  });

  it("fails open (allows the request) when the limiter throws", async () => {
    const limiter = {
      limit: jest.fn().mockRejectedValue(new Error("redis down")),
    } as unknown as Ratelimit;

    const result = await checkRateLimit(limiter, "user_1");
    expect(result.success).toBe(true);
  });
});

describe("checkRateLimitsBatch (L-CC25 batched multi-limiter check)", () => {
  const passing = () =>
    ({
      limit: jest.fn().mockResolvedValue({
        success: true,
        limit: 5,
        remaining: 4,
        reset: Date.now() + 60_000,
      }),
    }) as unknown as Ratelimit;

  const denying = () =>
    ({
      limit: jest.fn().mockResolvedValue({
        success: false,
        limit: 5,
        remaining: 0,
        reset: Date.now() + 30_000,
      }),
    }) as unknown as Ratelimit;

  it("succeeds with no checks", async () => {
    const result = await checkRateLimitsBatch([]);
    expect(result.success).toBe(true);
  });

  it("succeeds when every limiter passes", async () => {
    const result = await checkRateLimitsBatch([
      { limiter: passing(), identifier: "a" },
      { limiter: passing(), identifier: "b" },
    ]);
    expect(result.success).toBe(true);
    expect(result.response).toBeUndefined();
  });

  it("returns the first denial's 429 response when one limiter denies", async () => {
    const result = await checkRateLimitsBatch([
      { limiter: passing(), identifier: "a" },
      { limiter: denying(), identifier: "b" },
    ]);
    expect(result.success).toBe(false);
    expect(result.response).toBeDefined();
    expect(result.response!.status).toBe(429);
  });

  it("evaluates all checks concurrently (each limiter called once)", async () => {
    const p = passing();
    const d = passing();
    await checkRateLimitsBatch([
      { limiter: p, identifier: "a" },
      { limiter: d, identifier: "b" },
    ]);
    expect((p as unknown as { limit: jest.Mock }).limit).toHaveBeenCalledTimes(1);
    expect((d as unknown as { limit: jest.Mock }).limit).toHaveBeenCalledTimes(1);
  });

  it("treats null limiters as a pass (not configured)", async () => {
    const result = await checkRateLimitsBatch([
      { limiter: null, identifier: "a" },
      { limiter: passing(), identifier: "b" },
    ]);
    expect(result.success).toBe(true);
  });
});
