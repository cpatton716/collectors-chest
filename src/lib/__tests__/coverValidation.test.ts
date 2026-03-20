/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Mocks — must be set up before imports
// ---------------------------------------------------------------------------

// Mock coverImageDb to avoid Supabase/db import chain
jest.mock("../coverImageDb", () => ({
  getCommunityCovers: jest.fn(),
}));

// Mock @google/generative-ai
jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn(),
}));

// Mock models.ts to avoid any side effects
jest.mock("@/lib/models", () => ({
  GEMINI_PRIMARY: "gemini-2.0-flash",
}));

import {
  validateImageUrl,
  detectMimeType,
  shouldRunPipeline,
  runCoverPipeline,
} from "../coverValidation";
import { getCommunityCovers } from "../coverImageDb";

const mockGetCommunityCovers = getCommunityCovers as jest.MockedFunction<
  typeof getCommunityCovers
>;

// ---------------------------------------------------------------------------
// URL Validation
// ---------------------------------------------------------------------------

describe("validateImageUrl", () => {
  it("accepts eBay image URLs", () => {
    expect(
      validateImageUrl("https://i.ebayimg.com/images/g/abc/s-l1600.jpg")
    ).toBe(true);
  });

  it("accepts ebaystatic URLs", () => {
    expect(
      validateImageUrl("https://thumbs1.ebaystatic.com/pict/123.jpg")
    ).toBe(true);
  });

  it("accepts Open Library URLs", () => {
    expect(
      validateImageUrl("https://covers.openlibrary.org/b/title/Batman-L.jpg")
    ).toBe(true);
  });

  it("accepts Wikimedia URLs", () => {
    expect(
      validateImageUrl("https://upload.wikimedia.org/wikipedia/en/a/a1/Cover.jpg")
    ).toBe(true);
  });

  it("rejects HTTP URLs", () => {
    expect(
      validateImageUrl("http://i.ebayimg.com/images/g/abc/s-l1600.jpg")
    ).toBe(false);
  });

  it("rejects unknown hosts", () => {
    expect(validateImageUrl("https://evil.com/image.jpg")).toBe(false);
  });

  it("rejects localhost", () => {
    expect(validateImageUrl("https://localhost/image.jpg")).toBe(false);
  });

  it("rejects private IPs", () => {
    expect(validateImageUrl("https://192.168.1.1/image.jpg")).toBe(false);
    expect(validateImageUrl("https://10.0.0.1/image.jpg")).toBe(false);
    expect(validateImageUrl("https://127.0.0.1/image.jpg")).toBe(false);
    expect(validateImageUrl("https://172.16.0.1/image.jpg")).toBe(false);
    expect(validateImageUrl("https://169.254.1.1/image.jpg")).toBe(false);
  });

  it("rejects invalid URLs", () => {
    expect(validateImageUrl("not-a-url")).toBe(false);
    expect(validateImageUrl("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MIME Detection
// ---------------------------------------------------------------------------

describe("detectMimeType", () => {
  it("detects JPEG from magic bytes", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    expect(detectMimeType(buf, null)).toBe("image/jpeg");
  });

  it("detects PNG from magic bytes", () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]);
    expect(detectMimeType(buf, null)).toBe("image/png");
  });

  it("falls back to Content-Type header", () => {
    const buf = Buffer.from([0x00, 0x00, 0x00]); // no magic bytes match
    expect(detectMimeType(buf, "image/webp")).toBe("image/webp");
  });

  it("returns null for unsupported types", () => {
    const buf = Buffer.from([0x00, 0x00, 0x00]);
    expect(detectMimeType(buf, "application/pdf")).toBe(null);
  });

  it("returns null when no info available", () => {
    const buf = Buffer.from([0x00, 0x00, 0x00]);
    expect(detectMimeType(buf, null)).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// shouldRunPipeline
// ---------------------------------------------------------------------------

describe("shouldRunPipeline", () => {
  it("returns true for null metadata", () => {
    expect(shouldRunPipeline(null)).toBe(true);
  });

  it("returns false for community source", () => {
    expect(
      shouldRunPipeline({
        coverSource: "community",
        coverValidated: true,
        coverImageUrl: "https://example.com/img.jpg",
      })
    ).toBe(false);
  });

  it("returns false for validated with URL", () => {
    expect(
      shouldRunPipeline({
        coverSource: "ebay",
        coverValidated: true,
        coverImageUrl: "https://i.ebayimg.com/img.jpg",
      })
    ).toBe(false);
  });

  it("returns true for unvalidated metadata", () => {
    expect(
      shouldRunPipeline({
        coverSource: "ebay",
        coverValidated: false,
        coverImageUrl: null,
      })
    ).toBe(true);
  });

  it("returns true for validated null cover older than 7 days", () => {
    const eightDaysAgo = new Date(
      Date.now() - 8 * 24 * 60 * 60 * 1000
    ).toISOString();
    expect(
      shouldRunPipeline({
        coverValidated: true,
        coverImageUrl: null,
        updatedAt: eightDaysAgo,
      })
    ).toBe(true);
  });

  it("returns false for validated null cover less than 7 days old", () => {
    const twoDaysAgo = new Date(
      Date.now() - 2 * 24 * 60 * 60 * 1000
    ).toISOString();
    expect(
      shouldRunPipeline({
        coverValidated: true,
        coverImageUrl: null,
        updatedAt: twoDaysAgo,
      })
    ).toBe(false);
  });

  it("returns true for undefined coverValidated", () => {
    expect(
      shouldRunPipeline({
        coverSource: null,
        coverImageUrl: null,
      })
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runCoverPipeline integration tests
// ---------------------------------------------------------------------------

describe("runCoverPipeline", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCommunityCovers.mockResolvedValue(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns community cover without calling Gemini", async () => {
    mockGetCommunityCovers.mockResolvedValue(
      "https://covers.openlibrary.org/community/batman1.jpg"
    );

    const result = await runCoverPipeline("Batman", "1", "2016", "DC");
    expect(result).toEqual({
      coverUrl: "https://covers.openlibrary.org/community/batman1.jpg",
      coverSource: "community",
    });
  });

  it("validates eBay image with Gemini YES response", async () => {
    // Mock fetch for image download (eBay image) + Open Library HEAD
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0x02]);

    global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
      // Open Library HEAD request
      if (
        typeof url === "string" &&
        url.includes("covers.openlibrary.org") &&
        opts?.method === "HEAD"
      ) {
        return Promise.resolve({
          ok: false,
          headers: new Headers(),
        });
      }

      // eBay image fetch
      if (typeof url === "string" && url.includes("ebayimg.com")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({
            "content-type": "image/jpeg",
            "content-length": "7",
          }),
          arrayBuffer: () => Promise.resolve(jpegBuffer.buffer),
        });
      }

      return Promise.resolve({ ok: false, headers: new Headers() });
    });

    // Mock Gemini client
    const mockGeminiClient = {
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: () => "YES this is Batman #1",
          },
        }),
      }),
    };

    const result = await runCoverPipeline("Batman", "1", "2016", "DC", {
      ebayListings: [
        {
          itemId: "123",
          title: "Batman #1",
          price: 10,
          currency: "USD",
          condition: "New",
          itemUrl: "https://www.ebay.com/itm/123",
          imageUrl: "https://i.ebayimg.com/images/g/abc/s-l1600.jpg",
        },
      ],
      geminiClient: mockGeminiClient,
    });

    expect(result).toEqual({
      coverUrl: "https://i.ebayimg.com/images/g/abc/s-l1600.jpg",
      coverSource: "ebay",
    });
  });

  it("skips listings with no imageUrl", async () => {
    global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
      // Open Library HEAD → fail (no candidates)
      if (opts?.method === "HEAD") {
        return Promise.resolve({ ok: false, headers: new Headers() });
      }
      return Promise.resolve({ ok: false, headers: new Headers() });
    });

    const result = await runCoverPipeline("Batman", "1", "2016", "DC", {
      ebayListings: [
        {
          itemId: "123",
          title: "Batman #1",
          price: 10,
          currency: "USD",
          condition: "New",
          itemUrl: "https://www.ebay.com/itm/123",
          // no imageUrl
        },
      ],
    });

    expect(result).toEqual({ coverUrl: null, coverSource: null });
  });
});
