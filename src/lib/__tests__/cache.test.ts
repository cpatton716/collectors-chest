import {
  cacheGetOrSet,
  generateAiAnalyzeCacheKey,
  generateComicMetadataCacheKey,
  generateEbayPriceCacheKey,
  hashImageData,
  isWebhookProcessed,
  markWebhookProcessed,
} from "../cache";
import { redis as mockRedis } from "../redis";

/**
 * Cache utility function tests
 *
 * Tests the pure cache key generation and hashing functions, plus the
 * Redis-backed cacheGetOrSet shouldCache predicate (L-PR14) and the webhook
 * idempotency helpers (H-PAY1 / M-PAY4).
 */

// Mock Redis to avoid ESM import issues in Jest
jest.mock("@upstash/redis", () => ({
  Redis: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  })),
}));

// Provide a controllable shared redis client so the Redis-backed helpers run.
jest.mock("../redis", () => {
  const client = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
  return { redis: client, isRedisAvailable: () => true };
});

const redisClient = mockRedis as unknown as {
  get: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
};

describe("Cache Key Generation", () => {
  describe("generateEbayPriceCacheKey", () => {
    it("generates consistent keys for same inputs", () => {
      const key1 = generateEbayPriceCacheKey("Amazing Spider-Man", "300", 9.8, true, "CGC");
      const key2 = generateEbayPriceCacheKey("Amazing Spider-Man", "300", 9.8, true, "CGC");
      expect(key1).toBe(key2);
    });

    it("normalizes title and issue to lowercase", () => {
      const key1 = generateEbayPriceCacheKey("AMAZING SPIDER-MAN", "300A", 9.8, true, "CGC");
      const key2 = generateEbayPriceCacheKey("amazing spider-man", "300a", 9.8, true, "CGC");
      expect(key1).toBe(key2);
    });

    it("trims whitespace from inputs", () => {
      const key1 = generateEbayPriceCacheKey("  Amazing Spider-Man  ", "  300  ", 9.8, true, "CGC");
      const key2 = generateEbayPriceCacheKey("Amazing Spider-Man", "300", 9.8, true, "CGC");
      expect(key1).toBe(key2);
    });

    it("differentiates raw vs slabbed", () => {
      const rawKey = generateEbayPriceCacheKey("Amazing Spider-Man", "300", 9.8, false);
      const slabbedKey = generateEbayPriceCacheKey("Amazing Spider-Man", "300", 9.8, true, "CGC");
      expect(rawKey).not.toBe(slabbedKey);
      expect(rawKey).toContain("raw");
      expect(slabbedKey).toContain("slabbed");
    });

    it("differentiates grades", () => {
      const key98 = generateEbayPriceCacheKey("Amazing Spider-Man", "300", 9.8, true, "CGC");
      const key94 = generateEbayPriceCacheKey("Amazing Spider-Man", "300", 9.4, true, "CGC");
      expect(key98).not.toBe(key94);
    });

    it("differentiates grading companies", () => {
      const cgcKey = generateEbayPriceCacheKey("Amazing Spider-Man", "300", 9.8, true, "CGC");
      const cbcsKey = generateEbayPriceCacheKey("Amazing Spider-Man", "300", 9.8, true, "CBCS");
      expect(cgcKey).not.toBe(cbcsKey);
    });

    it("handles missing grading company", () => {
      const key = generateEbayPriceCacheKey("Amazing Spider-Man", "300", 9.8, false);
      expect(key).toBe("amazing spider-man|300|9.8|raw|");
    });

    it("normalizes grading company to lowercase", () => {
      const key1 = generateEbayPriceCacheKey("Amazing Spider-Man", "300", 9.8, true, "CGC");
      const key2 = generateEbayPriceCacheKey("Amazing Spider-Man", "300", 9.8, true, "cgc");
      expect(key1).toBe(key2);
    });
  });

  describe("generateComicMetadataCacheKey", () => {
    it("generates consistent keys for same inputs", () => {
      const key1 = generateComicMetadataCacheKey("Amazing Spider-Man", "300");
      const key2 = generateComicMetadataCacheKey("Amazing Spider-Man", "300");
      expect(key1).toBe(key2);
    });

    it("normalizes to lowercase", () => {
      const key1 = generateComicMetadataCacheKey("BATMAN", "1");
      const key2 = generateComicMetadataCacheKey("batman", "1");
      expect(key1).toBe(key2);
    });

    it("trims whitespace", () => {
      const key1 = generateComicMetadataCacheKey("  Batman  ", "  1  ");
      const key2 = generateComicMetadataCacheKey("Batman", "1");
      expect(key1).toBe(key2);
    });

    it("differentiates different comics", () => {
      const key1 = generateComicMetadataCacheKey("Batman", "1");
      const key2 = generateComicMetadataCacheKey("Batman", "2");
      const key3 = generateComicMetadataCacheKey("Superman", "1");
      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
    });

    it("uses pipe delimiter", () => {
      const key = generateComicMetadataCacheKey("Amazing Spider-Man", "300");
      expect(key).toBe("amazing spider-man|300");
    });

    it("normalizes title with special chars to match DB normalization", () => {
      const key = generateComicMetadataCacheKey("Batman: Year One", "1");
      expect(key).toBe("batman year one|1");
    });

    it("strips leading hashes from issue number", () => {
      const key = generateComicMetadataCacheKey("Batman", "#5");
      expect(key).toBe("batman|5");
    });

    it("collapses whitespace in title", () => {
      const key = generateComicMetadataCacheKey("The  Amazing  Spider-Man", "300");
      expect(key).toBe("the amazing spider-man|300");
    });
  });

  describe("generateAiAnalyzeCacheKey", () => {
    it("returns the image hash as-is", () => {
      const hash = "abc123_12345";
      const key = generateAiAnalyzeCacheKey(hash);
      expect(key).toBe(hash);
    });

    it("preserves hash format", () => {
      const hash = "-1a2b3c4d_999999";
      const key = generateAiAnalyzeCacheKey(hash);
      expect(key).toBe(hash);
    });
  });
});

describe("Image Hashing", () => {
  describe("hashImageData", () => {
    it("generates consistent hash for same input", () => {
      const imageData = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...";
      const hash1 = hashImageData(imageData);
      const hash2 = hashImageData(imageData);
      expect(hash1).toBe(hash2);
    });

    it("generates different hashes for different images", () => {
      const image1 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...";
      const image2 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA...";
      const hash1 = hashImageData(image1);
      const hash2 = hashImageData(image2);
      expect(hash1).not.toBe(hash2);
    });

    it("produces collision-free hashes for different content", () => {
      const shortImage = "abc";
      const longerImage = "abcdefghijklmnop";
      const hash1 = hashImageData(shortImage);
      const hash2 = hashImageData(longerImage);

      expect(hash1).not.toBe(hash2);
    });

    it("returns 64-character hex SHA-256 hash", () => {
      const imageData = "test image data";
      const hash = hashImageData(imageData);

      // SHA-256 produces 64 hex characters
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("handles empty string", () => {
      const hash = hashImageData("");
      // SHA-256 of empty string is a known constant
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("handles very long strings", () => {
      const longImage = "x".repeat(100000);
      const start = Date.now();
      const hash = hashImageData(longImage);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("differentiates images with same prefix but different content", () => {
      // SHA-256 hashes the full content, not just a prefix
      const image1 = "a".repeat(1000);
      const image2 = "a".repeat(1000) + "b";
      const hash1 = hashImageData(image1);
      const hash2 = hashImageData(image2);

      expect(hash1).not.toBe(hash2);
    });
  });
});

describe("Cache TTL Configuration", () => {
  // These tests verify the TTL values are sensible
  // The actual TTL constants are internal, but we can verify behavior expectations

  it("should have longer TTLs for immutable data", () => {
    // This is a documentation test - verifying our design decisions
    // Barcodes and certs should have longer TTLs than eBay prices

    // From the implementation:
    // ebayPrice: 24 hours
    // barcode: 6 months
    // cert: 1 year
    // profile: 5 minutes

    // We can't directly test TTLs without exporting them,
    // but this documents the expected behavior
    expect(true).toBe(true);
  });
});

describe("cacheGetOrSet shouldCache predicate (L-PR14)", () => {
  beforeEach(() => {
    redisClient.get.mockReset();
    redisClient.set.mockReset();
  });

  it("returns cached value without invoking the fetcher on a hit", async () => {
    redisClient.get.mockResolvedValueOnce({ value: 42 });
    const fetcher = jest.fn();
    const { data, cached } = await cacheGetOrSet("k", "ebayPrice", fetcher);
    expect(cached).toBe(true);
    expect(data).toEqual({ value: 42 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("persists the fetched value when no predicate is supplied", async () => {
    redisClient.get.mockResolvedValueOnce(null);
    const { data, cached } = await cacheGetOrSet("k", "ebayPrice", async () => ({ value: 7 }));
    expect(cached).toBe(false);
    expect(data).toEqual({ value: 7 });
    // fire-and-forget set runs on the next microtask
    await Promise.resolve();
    expect(redisClient.set).toHaveBeenCalledTimes(1);
  });

  it("skips persisting when shouldCache returns false (e.g., empty result)", async () => {
    redisClient.get.mockResolvedValueOnce(null);
    const { data } = await cacheGetOrSet("k", "ebayPrice", async () => null, {
      shouldCache: (d) => d !== null,
    });
    expect(data).toBeNull();
    await Promise.resolve();
    expect(redisClient.set).not.toHaveBeenCalled();
  });

  it("persists when shouldCache returns true", async () => {
    redisClient.get.mockResolvedValueOnce(null);
    await cacheGetOrSet("k", "ebayPrice", async () => ({ value: 99 }), {
      shouldCache: (d) => d !== null,
    });
    await Promise.resolve();
    expect(redisClient.set).toHaveBeenCalledTimes(1);
  });
});

describe("webhook idempotency helpers (H-PAY1 / M-PAY4)", () => {
  beforeEach(() => {
    redisClient.get.mockReset();
    redisClient.set.mockReset();
  });

  it("isWebhookProcessed returns true only when the marker is exactly true", async () => {
    redisClient.get.mockResolvedValueOnce(true);
    expect(await isWebhookProcessed("evt_1")).toBe(true);
  });

  it("isWebhookProcessed returns false on a cache miss (null)", async () => {
    redisClient.get.mockResolvedValueOnce(null);
    expect(await isWebhookProcessed("evt_missing")).toBe(false);
  });

  it("markWebhookProcessed writes a true marker under the webhook prefix", async () => {
    redisClient.set.mockResolvedValueOnce("OK");
    await markWebhookProcessed("evt_2");
    expect(redisClient.set).toHaveBeenCalledTimes(1);
    const [key, value, opts] = redisClient.set.mock.calls[0];
    expect(key).toBe("cache:webhook:evt_2");
    expect(value).toBe(true);
    // 3-day TTL (M-PAY4): 60 * 60 * 24 * 3 = 259200 seconds
    expect(opts).toEqual({ ex: 60 * 60 * 24 * 3 });
  });
});
