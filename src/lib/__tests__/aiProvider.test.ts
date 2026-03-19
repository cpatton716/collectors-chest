import {
  classifyError,
  executeWithFallback,
  getRemainingBudget,
} from "../aiProvider";
import type { AIProvider, ImageAnalysisResult } from "../providers/types";

// Mock the provider modules to prevent actual SDK instantiation
jest.mock("../providers/anthropic", () => ({
  AnthropicProvider: jest.fn(),
}));
jest.mock("../providers/gemini", () => ({
  GeminiProvider: jest.fn(),
}));

function createMockProvider(
  name: "anthropic" | "gemini"
): AIProvider & {
  analyzeImage: jest.Mock;
  verifyAndEnrich: jest.Mock;
} {
  return {
    name,
    analyzeImage: jest.fn(),
    verifyAndEnrich: jest.fn(),
    estimateCostCents: jest.fn().mockReturnValue(1.5),
  };
}

const mockResult: ImageAnalysisResult = {
  title: "Spider-Man",
  issueNumber: "1",
  publisher: "Marvel",
  releaseYear: "1990",
  variant: null,
  writer: null,
  coverArtist: null,
  interiorArtist: null,
  confidence: "high",
  isSlabbed: false,
  gradingCompany: null,
  grade: null,
  certificationNumber: null,
  labelType: null,
  pageQuality: null,
  gradeDate: null,
  graderNotes: null,
  isSignatureSeries: false,
  signedBy: null,
  barcodeNumber: null,
  barcode: null,
};

describe("classifyError", () => {
  it("classifies timeout errors", () => {
    const err = new DOMException("timeout", "TimeoutError");
    expect(classifyError(err)).toBe("timeout");
  });

  it("classifies 400 as bad_request", () => {
    expect(classifyError({ status: 400, message: "bad" })).toBe("bad_request");
  });

  it("classifies 401 as auth_error", () => {
    expect(classifyError({ status: 401, message: "unauthorized" })).toBe(
      "auth_error"
    );
  });

  it("classifies 403 as auth_error", () => {
    expect(classifyError({ status: 403, message: "forbidden" })).toBe(
      "auth_error"
    );
  });

  it("classifies 404 as model_not_found", () => {
    expect(classifyError({ status: 404, message: "not found" })).toBe(
      "model_not_found"
    );
  });

  it("classifies 429 as rate_limited", () => {
    expect(classifyError({ status: 429, message: "rate limit" })).toBe(
      "rate_limited"
    );
  });

  it("classifies 500 as server_error", () => {
    expect(classifyError({ status: 500, message: "internal" })).toBe(
      "server_error"
    );
  });

  it("classifies 502 as server_error", () => {
    expect(classifyError({ status: 502, message: "bad gateway" })).toBe(
      "server_error"
    );
  });

  it("classifies 503 as server_error", () => {
    expect(classifyError({ status: 503, message: "unavailable" })).toBe(
      "server_error"
    );
  });

  it("classifies content policy errors by message", () => {
    expect(classifyError(new Error("content policy violation detected"))).toBe(
      "content_policy"
    );
    expect(classifyError(new Error("safety system triggered"))).toBe(
      "content_policy"
    );
  });

  it("classifies unknown errors", () => {
    expect(classifyError(new Error("something weird"))).toBe("unknown");
    expect(classifyError("string error")).toBe("unknown");
  });
});

describe("getRemainingBudget", () => {
  it("returns full budget minus reserve when just started", () => {
    const now = Date.now();
    const budget = getRemainingBudget(now);
    // 25000 - 0 - 4000 = 21000 (approximately, within a few ms)
    expect(budget).toBeGreaterThan(20900);
    expect(budget).toBeLessThanOrEqual(21000);
  });

  it("returns reduced budget as time passes", () => {
    const fiveSecondsAgo = Date.now() - 5000;
    const budget = getRemainingBudget(fiveSecondsAgo);
    // 25000 - 5000 - 4000 = 16000
    expect(budget).toBeGreaterThan(15900);
    expect(budget).toBeLessThanOrEqual(16000);
  });

  it("returns 0 when past deadline", () => {
    const thirtySecondsAgo = Date.now() - 30000;
    expect(getRemainingBudget(thirtySecondsAgo)).toBe(0);
  });

  it("accepts custom reserve", () => {
    const now = Date.now();
    const budget = getRemainingBudget(now, 10000);
    // 25000 - 0 - 10000 = 15000
    expect(budget).toBeGreaterThan(14900);
    expect(budget).toBeLessThanOrEqual(15000);
  });
});

describe("executeWithFallback", () => {
  it("returns primary result when primary succeeds", async () => {
    const primary = createMockProvider("anthropic");
    primary.analyzeImage.mockResolvedValueOnce(mockResult);

    const result = await executeWithFallback(
      (provider, signal) =>
        provider.analyzeImage(
          { base64Data: "x", mediaType: "image/jpeg" },
          { signal }
        ),
      15_000,
      10_000,
      "test",
      [primary]
    );

    expect(result.provider).toBe("anthropic");
    expect(result.fallbackUsed).toBe(false);
    expect(result.fallbackReason).toBeNull();
    expect(result.result.title).toBe("Spider-Man");
  });

  it("falls back when primary fails with server error", async () => {
    const primary = createMockProvider("anthropic");
    const secondary = createMockProvider("gemini");

    primary.analyzeImage.mockRejectedValueOnce({
      status: 500,
      message: "internal server error",
    });
    secondary.analyzeImage.mockResolvedValueOnce(mockResult);

    const result = await executeWithFallback(
      (provider, signal) =>
        provider.analyzeImage(
          { base64Data: "x", mediaType: "image/jpeg" },
          { signal }
        ),
      15_000,
      10_000,
      "test",
      [primary, secondary]
    );

    expect(result.provider).toBe("gemini");
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe("server_error");
  });

  it("does NOT fallback on 400 bad_request", async () => {
    const primary = createMockProvider("anthropic");
    const secondary = createMockProvider("gemini");

    primary.analyzeImage.mockRejectedValueOnce({
      status: 400,
      message: "bad request",
    });

    await expect(
      executeWithFallback(
        (provider, signal) =>
          provider.analyzeImage(
            { base64Data: "x", mediaType: "image/jpeg" },
            { signal }
          ),
        15_000,
        10_000,
        "test",
        [primary, secondary]
      )
    ).rejects.toEqual({ status: 400, message: "bad request" });

    expect(secondary.analyzeImage).not.toHaveBeenCalled();
  });

  it("does NOT fallback on content_policy", async () => {
    const primary = createMockProvider("anthropic");
    const secondary = createMockProvider("gemini");

    primary.analyzeImage.mockRejectedValueOnce(
      new Error("content policy violation")
    );

    await expect(
      executeWithFallback(
        (provider, signal) =>
          provider.analyzeImage(
            { base64Data: "x", mediaType: "image/jpeg" },
            { signal }
          ),
        15_000,
        10_000,
        "test",
        [primary, secondary]
      )
    ).rejects.toThrow("content policy");

    expect(secondary.analyzeImage).not.toHaveBeenCalled();
  });

  it("throws when all providers fail with retryable error", async () => {
    const primary = createMockProvider("anthropic");
    const secondary = createMockProvider("gemini");

    primary.analyzeImage.mockRejectedValueOnce({
      status: 500,
      message: "down",
    });
    secondary.analyzeImage.mockRejectedValueOnce({
      status: 503,
      message: "unavailable",
    });

    await expect(
      executeWithFallback(
        (provider, signal) =>
          provider.analyzeImage(
            { base64Data: "x", mediaType: "image/jpeg" },
            { signal }
          ),
        15_000,
        10_000,
        "test",
        [primary, secondary]
      )
    ).rejects.toEqual({ status: 503, message: "unavailable" });
  });

  it("works with single provider (no fallback available)", async () => {
    const primary = createMockProvider("anthropic");
    primary.analyzeImage.mockResolvedValueOnce(mockResult);

    const result = await executeWithFallback(
      (provider, signal) =>
        provider.analyzeImage(
          { base64Data: "x", mediaType: "image/jpeg" },
          { signal }
        ),
      15_000,
      10_000,
      "test",
      [primary]
    );

    expect(result.provider).toBe("anthropic");
    expect(result.fallbackUsed).toBe(false);
  });

  it("falls back on rate limit (429)", async () => {
    const primary = createMockProvider("anthropic");
    const secondary = createMockProvider("gemini");

    primary.analyzeImage.mockRejectedValueOnce({
      status: 429,
      message: "rate limited",
    });
    secondary.analyzeImage.mockResolvedValueOnce(mockResult);

    const result = await executeWithFallback(
      (provider, signal) =>
        provider.analyzeImage(
          { base64Data: "x", mediaType: "image/jpeg" },
          { signal }
        ),
      15_000,
      10_000,
      "test",
      [primary, secondary]
    );

    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe("rate_limited");
  });

  it("falls back on model_not_found (404)", async () => {
    const primary = createMockProvider("anthropic");
    const secondary = createMockProvider("gemini");

    primary.analyzeImage.mockRejectedValueOnce({
      status: 404,
      message: "model not found",
    });
    secondary.analyzeImage.mockResolvedValueOnce(mockResult);

    const result = await executeWithFallback(
      (provider, signal) =>
        provider.analyzeImage(
          { base64Data: "x", mediaType: "image/jpeg" },
          { signal }
        ),
      15_000,
      10_000,
      "test",
      [primary, secondary]
    );

    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe("model_not_found");
  });

  it("preserves per-call independence", async () => {
    const primary = createMockProvider("anthropic");
    const secondary = createMockProvider("gemini");

    // Call 1: primary fails, secondary succeeds
    primary.analyzeImage.mockRejectedValueOnce({
      status: 500,
      message: "down",
    });
    secondary.analyzeImage.mockResolvedValueOnce(mockResult);

    await executeWithFallback(
      (provider, signal) =>
        provider.analyzeImage(
          { base64Data: "x", mediaType: "image/jpeg" },
          { signal }
        ),
      15_000,
      10_000,
      "call1",
      [primary, secondary]
    );

    // Call 2: primary is tried FIRST again (not skipped)
    primary.verifyAndEnrich.mockResolvedValueOnce({ keyInfo: [] });

    const call2 = await executeWithFallback(
      (provider, signal) =>
        provider.verifyAndEnrich(
          {
            title: "Spider-Man",
            issueNumber: "1",
            publisher: "Marvel",
            releaseYear: "1990",
            variant: null,
            writer: null,
            coverArtist: null,
            interiorArtist: null,
            missingFields: ["writer"],
          },
          { signal }
        ),
      8_000,
      6_000,
      "call2",
      [primary, secondary]
    );

    expect(call2.provider).toBe("anthropic");
    expect(call2.fallbackUsed).toBe(false);
  });

  it("includes fallback raw error in result", async () => {
    const primary = createMockProvider("anthropic");
    const secondary = createMockProvider("gemini");

    primary.analyzeImage.mockRejectedValueOnce(
      new Error("Connection reset by peer")
    );
    secondary.analyzeImage.mockResolvedValueOnce(mockResult);

    const result = await executeWithFallback(
      (provider, signal) =>
        provider.analyzeImage(
          { base64Data: "x", mediaType: "image/jpeg" },
          { signal }
        ),
      15_000,
      10_000,
      "test",
      [primary, secondary]
    );

    expect(result.fallbackRawError).toBe("Connection reset by peer");
  });
});
