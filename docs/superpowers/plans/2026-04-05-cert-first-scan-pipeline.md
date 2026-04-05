# Cert-First Scan Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce AI cost for slabbed comic scans by 50-80% via early slab detection and cert-first data sourcing. Slabbed first-scan drops from 1.5-3.6c to ~0.7c; repeat scans drop to ~0.3c.

**Architecture:** A cheap AI call detects slabbed comics and extracts the cert number. Cert lookup provides comic details for free. A metadata cache gate on creator fields decides whether a focused AI call is needed. Phase 5.5 reuses `extractSlabDetails()` for cover harvest fields on cache-hit paths. Raw comics use the existing full pipeline unchanged. 15s cert-first budget for Phases 1-5.5; existing 25s hard deadline for Phases 6-8.

**Tech Stack:** Gemini 2.0 Flash / Claude Sonnet 4 (provider fallback), CGC/CBCS/PGX web scraping, Redis + Supabase caching, Jest

**Design Spec:** `docs/superpowers/specs/2026-04-05-cert-first-scan-pipeline-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/providers/types.ts` | Modify | Add `SlabDetectionResult`, `SlabDetailExtractionResult`, update `AICallType`, add method signatures to `AIProvider`, extend `ScanResponseMeta.callDetails` |
| `src/lib/providers/anthropic.ts` | Modify | Add `detectSlab()` and `extractSlabDetails()` implementations + prompts, update `estimateCostCents()` |
| `src/lib/providers/gemini.ts` | Modify | Add `detectSlab()` and `extractSlabDetails()` implementations, update `estimateCostCents()` |
| `src/lib/aiProvider.ts` | Modify | Add `executeSlabDetection()` and `executeSlabDetailExtraction()` dispatch functions |
| `src/lib/certHelpers.ts` | Create | `normalizeGradingCompany()`, `parseKeyComments()`, `parseArtComments()` pure functions |
| `src/lib/metadataCache.ts` | Modify | Add `hasCompleteSlabData()` helper (creator fields only) |
| `src/lib/analyticsServer.ts` | Modify | Add `scan_path` and `barcode_extracted` fields to `ScanAnalyticsRecord` |
| `src/app/api/analyze/route.ts` | Modify | Add cert-first branch with 15s budget, Phases 1-5.5, budget degradation |
| `src/lib/__tests__/certHelpers.test.ts` | Create | Tests for `normalizeGradingCompany`, `parseKeyComments`, `parseArtComments` |
| `src/lib/__tests__/hasCompleteSlabData.test.ts` | Create | Tests for `hasCompleteSlabData()` cache gate |
| `src/lib/__tests__/slabProviderTypes.test.ts` | Create | Tests for slab detection and detail extraction response parsing |
| `supabase/migrations/20260405_cert_first_analytics.sql` | Create | Add `scan_path` and `barcode_extracted` columns to `scan_analytics` |

---

### Task 1: Add Provider Interface Types

**Files:**
- Modify: `src/lib/providers/types.ts`

- [ ] **Step 1: Add SlabDetectionResult type**

Add after the existing `VerificationResult` type (around line 77):

```typescript
/** Cheap slab detection -- determines if image is a graded comic */
export interface SlabDetectionResult {
  isSlabbed: boolean;
  gradingCompany: GradingCompany | null; // reuses import from @/types/comic
  certificationNumber: string | null;
}
```

Note: `GradingCompany` is already imported at line 4 of this file.

- [ ] **Step 2: Add SlabDetailExtractionResult type**

Add immediately after `SlabDetectionResult`:

```typescript
/** Focused extraction for slabbed comics -- barcode, cover harvest, creators */
export interface SlabDetailExtractionResult {
  barcode: {
    raw: string | null;
    confidence: "high" | "medium" | "low";
  };
  coverHarvestable: boolean;
  coverCropCoordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  writer: string | null;
  coverArtist: string | null;
  interiorArtist: string | null;
}
```

Important: There is NO `barcodeNumber` field. `barcode.raw` is the single source of barcode data.

- [ ] **Step 3: Update AICallType**

Find the existing type (line 96):

```typescript
// BEFORE:
export type AICallType = "imageAnalysis" | "verification";

// AFTER:
export type AICallType =
  | "imageAnalysis"
  | "verification"
  | "slabDetection"
  | "slabDetailExtraction";
```

- [ ] **Step 4: Add methods to AIProvider interface**

Update the `AIProvider` interface (line 98) to add new methods. Note the `options` parameter on `extractSlabDetails`:

```typescript
export interface AIProvider {
  readonly name: "anthropic" | "gemini";
  analyzeImage(req: ImageAnalysisRequest, opts?: CallOptions): Promise<ImageAnalysisResult>;
  verifyAndEnrich(req: VerificationRequest, opts?: CallOptions): Promise<VerificationResult>;
  detectSlab(req: ImageAnalysisRequest, opts?: CallOptions): Promise<SlabDetectionResult>;
  extractSlabDetails(
    req: ImageAnalysisRequest,
    opts?: CallOptions & {
      skipCreators?: boolean;   // true when creators already cached
      skipBarcode?: boolean;    // true when barcode already cataloged
    }
  ): Promise<SlabDetailExtractionResult>;
  estimateCostCents(callType: AICallType): number;
}
```

- [ ] **Step 5: Extend ScanResponseMeta.callDetails**

Update the `ScanResponseMeta` interface (line 117) to add optional fields for new call types:

```typescript
export interface ScanResponseMeta {
  provider: "anthropic" | "gemini";
  fallbackUsed: boolean;
  fallbackReason: string | null;
  confidence: "high" | "medium" | "low";
  cerebro_assisted?: boolean;
  callDetails: {
    imageAnalysis: { provider: string; fallbackUsed: boolean } | null;
    verification: { provider: string; fallbackUsed: boolean } | null;
    slabDetection?: { provider: string; durationMs: number; cost: number };
    slabDetailExtraction?: {
      provider: string;
      durationMs: number;
      cost: number;
      coverHarvestOnly?: boolean;
    };
  };
}
```

Note: Changed `imageAnalysis` to allow `null` (it won't run on cert-first-cached path).

- [ ] **Step 6: Commit**

```bash
git add src/lib/providers/types.ts
git commit -m "feat: add SlabDetectionResult, SlabDetailExtractionResult types and update AIProvider interface"
```

---

### Task 2: Implement Slab Detection & Detail Extraction in Anthropic Provider

**Files:**
- Modify: `src/lib/providers/anthropic.ts`

- [ ] **Step 1: Add imports for new types**

Update the import block at the top (lines 8-16) to include new types:

```typescript
import type {
  AICallType,
  AIProvider,
  CallOptions,
  ImageAnalysisRequest,
  ImageAnalysisResult,
  SlabDetectionResult,
  SlabDetailExtractionResult,
  VerificationRequest,
  VerificationResult,
} from "./types";
```

- [ ] **Step 2: Add SLAB_DETECTION_PROMPT**

Add after the existing `IMAGE_ANALYSIS_PROMPT` constant. Export it so Gemini can reuse it:

```typescript
export const SLAB_DETECTION_PROMPT = `You are examining a photo of a comic book. Determine ONLY whether this is a professionally graded (slabbed) comic in a hard plastic case.

If it IS slabbed, read the certification number from the grading label. The cert number is typically 7-10 digits, often near a barcode on the label.

Return ONLY this JSON object, no other text:
{
  "isSlabbed": true or false,
  "gradingCompany": "CGC" or "CBCS" or "PGX" or null if not slabbed,
  "certificationNumber": "the certification number as a string" or null if not visible or not slabbed
}`;
```

- [ ] **Step 3: Add SLAB_DETAIL_EXTRACTION_PROMPT**

Add after `SLAB_DETECTION_PROMPT`. Export it so Gemini can reuse it:

```typescript
export const SLAB_DETAIL_EXTRACTION_PROMPT = `You are examining a photo of a professionally graded (slabbed) comic book. The comic's identity has already been determined. Your job is to extract additional details from the COVER ARTWORK visible through the slab case.

TASKS:
1. UPC BARCODE: Look for the comic's UPC barcode on the cover artwork (NOT the cert label barcode). It's typically in the bottom-left or bottom-right of the cover art. Read ALL digits (12-17 digits). Report confidence based on clarity.
2. COVER HARVEST: Is the cover artwork clearly visible through the slab? If yes, provide pixel coordinates of ONLY the cover artwork (exclude grading label, cert number, plastic borders, reflections).
3. CREATORS: Identify the writer, cover artist, and interior artist if visible on the cover or readable from the image.

Return ONLY this JSON object, no other text:
{
  "barcode": {"raw": "all digits as string", "confidence": "high" | "medium" | "low"} or null if no barcode visible,
  "coverHarvestable": true or false,
  "coverCropCoordinates": {"x": number, "y": number, "width": number, "height": number} or null if not harvestable,
  "writer": "writer name" or null,
  "coverArtist": "cover artist name" or null,
  "interiorArtist": "interior artist name" or null
}`;
```

- [ ] **Step 4: Add SLAB_COVER_HARVEST_ONLY_PROMPT for Phase 5.5**

```typescript
export const SLAB_COVER_HARVEST_ONLY_PROMPT = `You are examining a photo of a professionally graded (slabbed) comic book. Your ONLY job is to determine if the cover artwork is suitable for harvesting and provide crop coordinates.

Return ONLY this JSON object, no other text:
{
  "barcode": null,
  "coverHarvestable": true or false,
  "coverCropCoordinates": {"x": number, "y": number, "width": number, "height": number} or null if not harvestable,
  "writer": null,
  "coverArtist": null,
  "interiorArtist": null
}`;
```

- [ ] **Step 5: Add detectSlab() method to AnthropicProvider**

Add after the `verifyAndEnrich()` method (after line 244):

```typescript
  // ── Slab Detection (cheap, fast) ──

  async detectSlab(
    req: ImageAnalysisRequest,
    opts?: CallOptions
  ): Promise<SlabDetectionResult> {
    const response = await this.client.messages.create(
      {
        model: MODEL_PRIMARY,
        max_tokens: 128,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: req.mediaType,
                  data: req.base64Data,
                },
              },
              { type: "text", text: SLAB_DETECTION_PROMPT },
            ],
          },
        ],
      },
      { signal: opts?.signal }
    );

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Slab detection returned no text content.");
    }

    const parsed = this.parseJsonResponse(textBlock.text) as Record<string, unknown>;

    return {
      isSlabbed: parsed.isSlabbed === true,
      gradingCompany: (parsed.gradingCompany as GradingCompany) || null,
      certificationNumber: (parsed.certificationNumber as string) || null,
    };
  }
```

- [ ] **Step 6: Add extractSlabDetails() method to AnthropicProvider**

Add after `detectSlab()`:

```typescript
  // ── Focused Slab Detail Extraction ──

  async extractSlabDetails(
    req: ImageAnalysisRequest,
    opts?: CallOptions & { skipCreators?: boolean; skipBarcode?: boolean }
  ): Promise<SlabDetailExtractionResult> {
    // Use cover-harvest-only prompt when both creators and barcode are skipped
    const coverHarvestOnly = opts?.skipCreators && opts?.skipBarcode;
    const prompt = coverHarvestOnly
      ? SLAB_COVER_HARVEST_ONLY_PROMPT
      : SLAB_DETAIL_EXTRACTION_PROMPT;
    const maxTokens = coverHarvestOnly ? 128 : 384;

    const response = await this.client.messages.create(
      {
        model: MODEL_PRIMARY,
        max_tokens: maxTokens,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: req.mediaType,
                  data: req.base64Data,
                },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      },
      { signal: opts?.signal }
    );

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Slab detail extraction returned no text content.");
    }

    const parsed = this.parseJsonResponse(textBlock.text) as Record<string, unknown>;
    const barcode = parsed.barcode as { raw: string | null; confidence: string } | null;

    return {
      barcode: barcode
        ? {
            raw: barcode.raw || null,
            confidence: (barcode.confidence as "high" | "medium" | "low") || "low",
          }
        : { raw: null, confidence: "low" },
      coverHarvestable: parsed.coverHarvestable === true,
      coverCropCoordinates:
        (parsed.coverCropCoordinates as {
          x: number;
          y: number;
          width: number;
          height: number;
        }) || null,
      writer: (parsed.writer as string) || null,
      coverArtist: (parsed.coverArtist as string) || null,
      interiorArtist: (parsed.interiorArtist as string) || null,
    };
  }
```

- [ ] **Step 7: Update estimateCostCents()**

Replace the existing `estimateCostCents()` method (line 248):

```typescript
  estimateCostCents(callType: AICallType): number {
    switch (callType) {
      case "imageAnalysis":
        return 1.5;
      case "verification":
        return 0.6;
      case "slabDetection":
        return 0.2;
      case "slabDetailExtraction":
        return 0.5;
    }
  }
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/providers/anthropic.ts
git commit -m "feat: add detectSlab() and extractSlabDetails() to Anthropic provider"
```

---

### Task 3: Implement Both Methods in Gemini Provider

**Files:**
- Modify: `src/lib/providers/gemini.ts`

- [ ] **Step 1: Update imports**

Update the import block at the top (lines 6-18):

```typescript
import {
  IMAGE_ANALYSIS_PROMPT,
  buildVerificationPrompt,
  SLAB_DETECTION_PROMPT,
  SLAB_DETAIL_EXTRACTION_PROMPT,
  SLAB_COVER_HARVEST_ONLY_PROMPT,
} from "./anthropic";
import type {
  AIProvider,
  AICallType,
  CallOptions,
  ImageAnalysisRequest,
  ImageAnalysisResult,
  SlabDetectionResult,
  SlabDetailExtractionResult,
  VerificationRequest,
  VerificationResult,
} from "./types";
import type { GradingCompany } from "@/types/comic";
```

- [ ] **Step 2: Add detectSlab() to GeminiProvider**

Add after the `verifyAndEnrich()` method (after line 112). Follow existing Gemini patterns with `this.withTimeout()` and `this.parseJsonResponse()`:

```typescript
  // ── Slab Detection (cheap, fast) ──

  async detectSlab(
    req: ImageAnalysisRequest,
    opts?: CallOptions
  ): Promise<SlabDetectionResult> {
    const model = this.genAI.getGenerativeModel(
      { model: GEMINI_PRIMARY },
      { apiVersion: "v1beta" }
    );

    const result = await this.withTimeout(
      model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: req.mediaType, data: req.base64Data } },
              { text: SLAB_DETECTION_PROMPT },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 128 },
      }),
      opts?.signal
    );

    const text = result.response.text();
    if (!text) throw new Error("No response from Gemini slab detection");
    const parsed = this.parseJsonResponse(text) as Record<string, unknown>;

    return {
      isSlabbed: parsed.isSlabbed === true,
      gradingCompany: (parsed.gradingCompany as GradingCompany) || null,
      certificationNumber: (parsed.certificationNumber as string) || null,
    };
  }
```

- [ ] **Step 3: Add extractSlabDetails() to GeminiProvider**

Add after `detectSlab()`:

```typescript
  // ── Focused Slab Detail Extraction ──

  async extractSlabDetails(
    req: ImageAnalysisRequest,
    opts?: CallOptions & { skipCreators?: boolean; skipBarcode?: boolean }
  ): Promise<SlabDetailExtractionResult> {
    const coverHarvestOnly = opts?.skipCreators && opts?.skipBarcode;
    const prompt = coverHarvestOnly
      ? SLAB_COVER_HARVEST_ONLY_PROMPT
      : SLAB_DETAIL_EXTRACTION_PROMPT;
    const maxTokens = coverHarvestOnly ? 128 : 384;

    const model = this.genAI.getGenerativeModel(
      { model: GEMINI_PRIMARY },
      { apiVersion: "v1beta" }
    );

    const result = await this.withTimeout(
      model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: req.mediaType, data: req.base64Data } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
      opts?.signal
    );

    const text = result.response.text();
    if (!text) throw new Error("No response from Gemini slab detail extraction");
    const parsed = this.parseJsonResponse(text) as Record<string, unknown>;
    const barcode = parsed.barcode as { raw: string | null; confidence: string } | null;

    return {
      barcode: barcode
        ? {
            raw: barcode.raw || null,
            confidence: (barcode.confidence as "high" | "medium" | "low") || "low",
          }
        : { raw: null, confidence: "low" },
      coverHarvestable: parsed.coverHarvestable === true,
      coverCropCoordinates:
        (parsed.coverCropCoordinates as {
          x: number;
          y: number;
          width: number;
          height: number;
        }) || null,
      writer: (parsed.writer as string) || null,
      coverArtist: (parsed.coverArtist as string) || null,
      interiorArtist: (parsed.interiorArtist as string) || null,
    };
  }
```

- [ ] **Step 4: Update estimateCostCents() in GeminiProvider**

Replace the existing `estimateCostCents()` method (line 116):

```typescript
  estimateCostCents(callType: AICallType): number {
    switch (callType) {
      case "imageAnalysis":
        return 0.3;
      case "verification":
        return 0.1;
      case "slabDetection":
        return 0.05;
      case "slabDetailExtraction":
        return 0.1;
    }
  }
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/providers/gemini.ts
git commit -m "feat: add detectSlab() and extractSlabDetails() to Gemini provider"
```

---

### Task 4: Add Dispatch Functions to aiProvider.ts

**Files:**
- Modify: `src/lib/aiProvider.ts`

- [ ] **Step 1: Add imports for new types**

Add to the import block at the top (line 7):

```typescript
import type { AIProvider, CallResult, ErrorReason, SlabDetectionResult, SlabDetailExtractionResult } from "./providers/types";
```

- [ ] **Step 2: Add executeSlabDetection() dispatch function**

Add after the existing `executeWithFallback()` function (after line 123):

```typescript
/**
 * Execute slab detection with provider fallback.
 * Uses shorter timeouts since the call is cheap and fast.
 * Timeout is clamped to remaining budget for cert-first path.
 */
export async function executeSlabDetection(
  base64Data: string,
  mediaType: string,
  remainingBudgetMs?: number,
  providerList?: AIProvider[]
): Promise<CallResult<SlabDetectionResult>> {
  const list = providerList || providers;
  const timeout = remainingBudgetMs
    ? Math.min(5000, remainingBudgetMs)
    : 5000;
  return executeWithFallback(
    (provider, signal) =>
      provider.detectSlab(
        { base64Data, mediaType: mediaType as "image/jpeg" | "image/png" | "image/webp" },
        { signal }
      ),
    timeout,
    timeout,
    "slabDetection",
    list
  );
}
```

- [ ] **Step 3: Add executeSlabDetailExtraction() dispatch function**

Add after `executeSlabDetection()`:

```typescript
/**
 * Execute focused slab detail extraction with provider fallback.
 * Timeout is clamped to remaining budget for cert-first path.
 * When coverHarvestOnly is true, skips creators and barcode (Phase 5.5).
 */
export async function executeSlabDetailExtraction(
  base64Data: string,
  mediaType: string,
  options?: {
    skipCreators?: boolean;
    skipBarcode?: boolean;
    remainingBudgetMs?: number;
  },
  providerList?: AIProvider[]
): Promise<CallResult<SlabDetailExtractionResult>> {
  const list = providerList || providers;
  const coverHarvestOnly = options?.skipCreators && options?.skipBarcode;
  const baseTimeout = coverHarvestOnly ? 5000 : 8000;
  const timeout = options?.remainingBudgetMs
    ? Math.min(baseTimeout, options.remainingBudgetMs)
    : baseTimeout;
  return executeWithFallback(
    (provider, signal) =>
      provider.extractSlabDetails(
        { base64Data, mediaType: mediaType as "image/jpeg" | "image/png" | "image/webp" },
        {
          signal,
          skipCreators: options?.skipCreators,
          skipBarcode: options?.skipBarcode,
        }
      ),
    timeout,
    timeout,
    "slabDetailExtraction",
    list
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/aiProvider.ts
git commit -m "feat: add slab detection and detail extraction dispatch functions with budget clamping"
```

---

### Task 5: Create Cert Helper Functions

**Files:**
- Create: `src/lib/certHelpers.ts`
- Create: `src/lib/__tests__/certHelpers.test.ts`

- [ ] **Step 1: Write failing tests for all three helpers**

Create `src/lib/__tests__/certHelpers.test.ts`:

```typescript
/**
 * Cert helper tests
 *
 * Tests for normalizeGradingCompany(), parseKeyComments(), and parseArtComments().
 * These are pure functions with no external dependencies.
 */
import {
  normalizeGradingCompany,
  parseKeyComments,
  parseArtComments,
  mergeKeyComments,
} from "../certHelpers";

// ── normalizeGradingCompany ──

describe("normalizeGradingCompany", () => {
  it("normalizes 'CGC' to 'CGC'", () => {
    expect(normalizeGradingCompany("CGC")).toBe("CGC");
  });

  it("normalizes 'cgc' (lowercase) to 'CGC'", () => {
    expect(normalizeGradingCompany("cgc")).toBe("CGC");
  });

  it("normalizes 'C.G.C.' (dots) to 'CGC'", () => {
    expect(normalizeGradingCompany("C.G.C.")).toBe("CGC");
  });

  it("normalizes 'CBCS' to 'CBCS'", () => {
    expect(normalizeGradingCompany("CBCS")).toBe("CBCS");
  });

  it("normalizes 'cbcs' (lowercase) to 'CBCS'", () => {
    expect(normalizeGradingCompany("cbcs")).toBe("CBCS");
  });

  it("normalizes 'PGX' to 'PGX'", () => {
    expect(normalizeGradingCompany("PGX")).toBe("PGX");
  });

  it("normalizes ' CGC ' (whitespace) to 'CGC'", () => {
    expect(normalizeGradingCompany(" CGC ")).toBe("CGC");
  });

  it("returns null for 'EGS' (unsupported)", () => {
    expect(normalizeGradingCompany("EGS")).toBeNull();
  });

  it("returns null for 'HALO' (unsupported)", () => {
    expect(normalizeGradingCompany("HALO")).toBeNull();
  });

  it("returns null for 'Other'", () => {
    expect(normalizeGradingCompany("Other")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeGradingCompany("")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(normalizeGradingCompany(null)).toBeNull();
  });
});

// ── parseKeyComments ──

describe("parseKeyComments", () => {
  it("splits semicolon-delimited string", () => {
    expect(parseKeyComments("1st app Wolverine; 1st app Wendigo")).toEqual([
      "1st app Wolverine",
      "1st app Wendigo",
    ]);
  });

  it("splits newline-delimited string", () => {
    expect(parseKeyComments("1st app Wolverine\n1st app Wendigo")).toEqual([
      "1st app Wolverine",
      "1st app Wendigo",
    ]);
  });

  it("trims whitespace from entries", () => {
    expect(parseKeyComments("  1st app Wolverine ; 1st app Wendigo  ")).toEqual([
      "1st app Wolverine",
      "1st app Wendigo",
    ]);
  });

  it("filters empty entries", () => {
    expect(parseKeyComments("1st app Wolverine;;")).toEqual([
      "1st app Wolverine",
    ]);
  });

  it("returns empty array for null", () => {
    expect(parseKeyComments(null)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseKeyComments("")).toEqual([]);
  });

  it("returns single-item array for string with no delimiters", () => {
    expect(parseKeyComments("1st app Wolverine")).toEqual(["1st app Wolverine"]);
  });
});

// ── mergeKeyComments ──

describe("mergeKeyComments", () => {
  it("cert entries come first, DB entries appended", () => {
    const result = mergeKeyComments(
      ["1st app Wolverine"],
      ["1st full app Wolverine", "1st app Wendigo"]
    );
    expect(result[0]).toBe("1st app Wolverine");
    expect(result).toContain("1st full app Wolverine");
    expect(result).toContain("1st app Wendigo");
  });

  it("deduplicates exact matches (case-insensitive, trimmed)", () => {
    const result = mergeKeyComments(
      ["1st App Wolverine"],
      ["1st app wolverine", "1st app Wendigo"]
    );
    expect(result).toEqual(["1st App Wolverine", "1st app Wendigo"]);
  });

  it("returns cert entries when DB entries are empty", () => {
    const result = mergeKeyComments(["1st app Wolverine"], []);
    expect(result).toEqual(["1st app Wolverine"]);
  });

  it("returns DB entries when cert entries are empty", () => {
    const result = mergeKeyComments([], ["1st app Wolverine"]);
    expect(result).toEqual(["1st app Wolverine"]);
  });
});

// ── parseArtComments ──

describe("parseArtComments", () => {
  it("parses 'cover and art' pattern", () => {
    expect(parseArtComments("Todd McFarlane cover and art")).toEqual({
      coverArtist: "Todd McFarlane",
      interiorArtist: "Todd McFarlane",
    });
  });

  it("parses 'Cover by X; Interior art by Y' pattern", () => {
    expect(
      parseArtComments("Cover by Jim Lee; Interior art by Scott Williams")
    ).toEqual({
      coverArtist: "Jim Lee",
      interiorArtist: "Scott Williams",
    });
  });

  it("parses 'Art by X' pattern (maps to interiorArtist)", () => {
    expect(parseArtComments("Art by Jack Kirby")).toEqual({
      interiorArtist: "Jack Kirby",
    });
  });

  it("returns empty object for null", () => {
    expect(parseArtComments(null)).toEqual({});
  });

  it("returns empty object for empty string", () => {
    expect(parseArtComments("")).toEqual({});
  });

  it("returns empty object for unrecognized pattern", () => {
    expect(parseArtComments("Some random text")).toEqual({});
  });

  it("handles 'cover & art' variant", () => {
    expect(parseArtComments("Todd McFarlane cover & art")).toEqual({
      coverArtist: "Todd McFarlane",
      interiorArtist: "Todd McFarlane",
    });
  });

  it("handles names with hyphens and apostrophes", () => {
    expect(parseArtComments("Cover by Jim O'Brien")).toEqual({
      coverArtist: "Jim O'Brien",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/lib/__tests__/certHelpers.test.ts -v
```

Expected: FAIL -- module `../certHelpers` not found

- [ ] **Step 3: Implement certHelpers.ts**

Create `src/lib/certHelpers.ts`:

```typescript
/**
 * Cert-first pipeline helpers
 *
 * Pure functions for normalizing grading company names, parsing cert
 * keyComments into arrays, merging with curated DB entries, and
 * extracting creator names from artComments.
 */

/**
 * Normalize AI-returned gradingCompany to exact known values.
 * Strips non-alpha characters, uppercases, and matches against CGC/CBCS/PGX.
 * Returns null for unrecognized companies (triggers fallback to full pipeline).
 */
export function normalizeGradingCompany(
  raw: string | null | undefined
): "CGC" | "CBCS" | "PGX" | null {
  if (!raw) return null;
  const cleaned = raw.toUpperCase().replace(/[^A-Z]/g, "");
  if (cleaned === "CGC") return "CGC";
  if (cleaned === "CBCS") return "CBCS";
  if (cleaned === "PGX") return "PGX";
  return null;
}

/**
 * Split raw keyComments string from cert lookup into an array.
 * Splits on semicolons and newlines, trims whitespace, filters empty entries.
 */
export function parseKeyComments(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Merge cert keyComments with curated DB key info.
 * Cert entries come first. DB entries are appended.
 * Deduplicates by normalizing strings (lowercase, trim) and removing exact matches.
 */
export function mergeKeyComments(
  certEntries: string[],
  dbEntries: string[]
): string[] {
  const seen = new Set(certEntries.map((s) => s.toLowerCase().trim()));
  const merged = [...certEntries];

  for (const entry of dbEntries) {
    const normalized = entry.toLowerCase().trim();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      merged.push(entry);
    }
  }

  return merged;
}

/**
 * Extract creator names from cert artComments string.
 * Handles common cert label patterns:
 *   - "Name cover and art" / "Name cover & art"
 *   - "Cover by Name"
 *   - "Interior art by Name"
 *   - "Art by Name"
 *
 * Writer is rarely present in artComments. Returns partial results.
 */
export function parseArtComments(artComments: string | null): {
  writer?: string;
  coverArtist?: string;
  interiorArtist?: string;
} {
  if (!artComments) return {};

  const result: { writer?: string; coverArtist?: string; interiorArtist?: string } = {};

  // Pattern: "Name cover and art" or "Name cover & art"
  const coverAndArt = artComments.match(
    /^([\w\s.\-']+?)\s+cover\s+(?:and|&)\s+art$/i
  );
  if (coverAndArt) {
    result.coverArtist = coverAndArt[1].trim();
    result.interiorArtist = coverAndArt[1].trim();
    return result;
  }

  // Pattern: "Cover by [Name]"
  const coverBy = artComments.match(/cover\s+by\s+([\w\s.\-']+?)(?:;|$)/i);
  // Pattern: "Interior art by [Name]"
  const interiorBy = artComments.match(
    /interior\s+art\s+by\s+([\w\s.\-']+?)(?:;|$)/i
  );
  // Pattern: "Art by [Name]" (fallback for interiorArtist)
  const artBy = artComments.match(/(?:^|\s)art\s+by\s+([\w\s.\-']+?)(?:;|$)/i);

  if (coverBy) result.coverArtist = coverBy[1].trim();
  if (interiorBy) result.interiorArtist = interiorBy[1].trim();
  if (artBy && !result.interiorArtist) result.interiorArtist = artBy[1].trim();

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/lib/__tests__/certHelpers.test.ts -v
```

Expected: All passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/certHelpers.ts src/lib/__tests__/certHelpers.test.ts
git commit -m "feat: add normalizeGradingCompany, parseKeyComments, mergeKeyComments, parseArtComments helpers"
```

---

### Task 6: Add hasCompleteSlabData() to Metadata Cache

**Files:**
- Modify: `src/lib/metadataCache.ts`
- Create: `src/lib/__tests__/hasCompleteSlabData.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/hasCompleteSlabData.test.ts`:

```typescript
/**
 * hasCompleteSlabData tests
 *
 * Tests the Phase 4 cache gate for the cert-first pipeline.
 * Gate checks ONLY creator fields (writer, coverArtist, interiorArtist).
 */
import { hasCompleteSlabData } from "../metadataCache";

type CreatorFields = { writer?: string | null; coverArtist?: string | null; interiorArtist?: string | null };

const baseMetadata: CreatorFields = {
  writer: "David Michelinie",
  coverArtist: "Todd McFarlane",
  interiorArtist: "Todd McFarlane",
};

describe("hasCompleteSlabData", () => {
  it("returns true when all three creator fields are present", () => {
    expect(hasCompleteSlabData(baseMetadata)).toBe(true);
  });

  it("returns false when writer is missing", () => {
    expect(hasCompleteSlabData({ ...baseMetadata, writer: null })).toBe(false);
  });

  it("returns false when coverArtist is missing", () => {
    expect(hasCompleteSlabData({ ...baseMetadata, coverArtist: null })).toBe(false);
  });

  it("returns false when interiorArtist is missing", () => {
    expect(hasCompleteSlabData({ ...baseMetadata, interiorArtist: null })).toBe(false);
  });

  it("returns false when all creator fields are missing", () => {
    expect(
      hasCompleteSlabData({
        ...baseMetadata,
        writer: null,
        coverArtist: null,
        interiorArtist: null,
      })
    ).toBe(false);
  });

  it("returns false for null input", () => {
    expect(hasCompleteSlabData(null)).toBe(false);
  });

  it("returns false for undefined input", () => {
    expect(hasCompleteSlabData(undefined)).toBe(false);
  });

  it("returns true when artComments-derived creators are passed", () => {
    const partial: CreatorFields = {
      writer: "Stan Lee",
      coverArtist: "Jack Kirby",
      interiorArtist: "Jack Kirby",
    };
    expect(hasCompleteSlabData(partial)).toBe(true);
  });

  it("accepts plain creator objects without extra metadata fields", () => {
    const creatorsOnly: CreatorFields = {
      writer: "Greg Pak",
      coverArtist: "Stonehouse",
      interiorArtist: "Robert Gill",
    };
    expect(hasCompleteSlabData(creatorsOnly)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/lib/__tests__/hasCompleteSlabData.test.ts -v
```

Expected: FAIL -- `hasCompleteSlabData` not exported from `../metadataCache`

- [ ] **Step 3: Implement hasCompleteSlabData()**

Add to the end of `src/lib/metadataCache.ts`:

```typescript
/**
 * Check if cached metadata (or artComments-derived data) has all three
 * creator fields needed for the cert-first pipeline Phase 4 gate.
 *
 * When all creators are known, the focused AI extraction call (Phase 5)
 * can be skipped, and only cover harvest fields are needed (Phase 5.5).
 */
export function hasCompleteSlabData(
  metadata: { writer?: string | null; coverArtist?: string | null; interiorArtist?: string | null } | null | undefined
): boolean {
  if (!metadata) return false;
  return Boolean(
    metadata.writer && metadata.coverArtist && metadata.interiorArtist
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/lib/__tests__/hasCompleteSlabData.test.ts -v
```

Expected: All passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/metadataCache.ts src/lib/__tests__/hasCompleteSlabData.test.ts
git commit -m "feat: add hasCompleteSlabData() cache gate for cert-first pipeline"
```

---

### Task 7: Update Analytics with scan_path and barcode_extracted

**Files:**
- Modify: `src/lib/analyticsServer.ts`
- Create: `supabase/migrations/20260405_cert_first_analytics.sql`

- [ ] **Step 1: Add ScanPath type and update ScanAnalyticsRecord**

Add the `ScanPath` type above the `ScanAnalyticsRecord` interface (around line 84):

```typescript
export type ScanPath =
  | "cert-first-cached"    // Slabbed, cache hit, minimal AI for cover harvest only
  | "cert-first-full"      // Slabbed, cache miss, ran Phase 5 focused AI
  | "cert-first-fallback"  // Slabbed detected, but fell back to full pipeline
  | "full-pipeline";       // Raw comic, standard flow
```

Add two new fields to the `ScanAnalyticsRecord` interface:

```typescript
export interface ScanAnalyticsRecord {
  profile_id: string | null;
  scan_method: string;
  estimated_cost_cents: number;
  ai_calls_made: number;
  metadata_cache_hit: boolean;
  ebay_lookup: boolean;
  duration_ms: number;
  success: boolean;
  subscription_tier: string;
  error_type?: string | null;
  provider?: string;
  fallback_used?: boolean;
  fallback_reason?: string | null;
  cover_harvested?: boolean;
  scan_path?: ScanPath;
  barcode_extracted?: boolean;
}
```

- [ ] **Step 2: Update recordScanAnalytics() to pass new fields**

In the `recordScanAnalytics()` function (line 106), add the new fields to the Supabase insert:

```typescript
      scan_path: record.scan_path || "full-pipeline",
      barcode_extracted: record.barcode_extracted ?? false,
```

Add these two lines after the existing `cover_harvested` line in the insert object.

- [ ] **Step 3: Create migration SQL**

Create `supabase/migrations/20260405_cert_first_analytics.sql`:

```sql
-- Add scan_path and barcode_extracted columns to scan_analytics
-- for tracking cert-first pipeline usage and barcode extraction rates.

ALTER TABLE scan_analytics
  ADD COLUMN IF NOT EXISTS scan_path TEXT DEFAULT 'full-pipeline',
  ADD COLUMN IF NOT EXISTS barcode_extracted BOOLEAN DEFAULT FALSE;

-- Index for scan_path analytics queries
CREATE INDEX IF NOT EXISTS idx_scan_analytics_scan_path
  ON scan_analytics (scan_path);
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/analyticsServer.ts supabase/migrations/20260405_cert_first_analytics.sql
git commit -m "feat: add scan_path and barcode_extracted to scan analytics with migration"
```

---

### Task 8: Write Provider Response Parsing Tests

**Files:**
- Create: `src/lib/__tests__/slabProviderTypes.test.ts`

- [ ] **Step 1: Write tests for SlabDetectionResult and SlabDetailExtractionResult parsing**

Create `src/lib/__tests__/slabProviderTypes.test.ts`:

```typescript
/**
 * Slab provider type tests
 *
 * Tests that AI response JSON is correctly shaped for SlabDetectionResult
 * and SlabDetailExtractionResult. These validate the parsing contracts
 * that both Anthropic and Gemini providers must satisfy.
 */
import type {
  SlabDetectionResult,
  SlabDetailExtractionResult,
} from "@/lib/providers/types";

// ── SlabDetectionResult ──

describe("SlabDetectionResult shape", () => {
  it("parses a CGC slab detection response", () => {
    const raw = `{"isSlabbed":true,"gradingCompany":"CGC","certificationNumber":"3809701007"}`;
    const result: SlabDetectionResult = JSON.parse(raw);
    expect(result.isSlabbed).toBe(true);
    expect(result.gradingCompany).toBe("CGC");
    expect(result.certificationNumber).toBe("3809701007");
  });

  it("parses a CBCS slab detection response", () => {
    const raw = `{"isSlabbed":true,"gradingCompany":"CBCS","certificationNumber":"1234567"}`;
    const result: SlabDetectionResult = JSON.parse(raw);
    expect(result.isSlabbed).toBe(true);
    expect(result.gradingCompany).toBe("CBCS");
  });

  it("parses a PGX slab detection response", () => {
    const raw = `{"isSlabbed":true,"gradingCompany":"PGX","certificationNumber":"9876543"}`;
    const result: SlabDetectionResult = JSON.parse(raw);
    expect(result.gradingCompany).toBe("PGX");
  });

  it("parses non-slabbed response", () => {
    const raw = `{"isSlabbed":false,"gradingCompany":null,"certificationNumber":null}`;
    const result: SlabDetectionResult = JSON.parse(raw);
    expect(result.isSlabbed).toBe(false);
    expect(result.gradingCompany).toBeNull();
    expect(result.certificationNumber).toBeNull();
  });

  it("handles slab with missing cert number", () => {
    const raw = `{"isSlabbed":true,"gradingCompany":"CGC","certificationNumber":null}`;
    const result: SlabDetectionResult = JSON.parse(raw);
    expect(result.isSlabbed).toBe(true);
    expect(result.certificationNumber).toBeNull();
  });
});

// ── SlabDetailExtractionResult ──

describe("SlabDetailExtractionResult shape", () => {
  it("parses full extraction response with barcode and creators", () => {
    const raw = JSON.stringify({
      barcode: { raw: "75960608936802211", confidence: "medium" },
      coverHarvestable: true,
      coverCropCoordinates: { x: 120, y: 280, width: 450, height: 680 },
      writer: "Greg Pak",
      coverArtist: "Stonehouse",
      interiorArtist: "Robert Gill",
    });
    const result: SlabDetailExtractionResult = JSON.parse(raw);
    expect(result.barcode?.raw).toBe("75960608936802211");
    expect(result.barcode?.confidence).toBe("medium");
    expect(result.coverHarvestable).toBe(true);
    expect(result.coverCropCoordinates?.x).toBe(120);
    expect(result.writer).toBe("Greg Pak");
  });

  it("parses response with no barcode visible", () => {
    const raw = JSON.stringify({
      barcode: { raw: null, confidence: "low" },
      coverHarvestable: true,
      coverCropCoordinates: { x: 100, y: 200, width: 400, height: 600 },
      writer: "Todd McFarlane",
      coverArtist: "Todd McFarlane",
      interiorArtist: "Todd McFarlane",
    });
    const result: SlabDetailExtractionResult = JSON.parse(raw);
    expect(result.barcode?.raw).toBeNull();
    expect(result.coverHarvestable).toBe(true);
  });

  it("parses cover-harvest-only response (Phase 5.5)", () => {
    const raw = JSON.stringify({
      barcode: { raw: null, confidence: "low" },
      coverHarvestable: true,
      coverCropCoordinates: { x: 50, y: 100, width: 500, height: 700 },
      writer: null,
      coverArtist: null,
      interiorArtist: null,
    });
    const result: SlabDetailExtractionResult = JSON.parse(raw);
    expect(result.coverHarvestable).toBe(true);
    expect(result.writer).toBeNull();
    expect(result.coverArtist).toBeNull();
    expect(result.interiorArtist).toBeNull();
  });

  it("parses response where cover is not harvestable", () => {
    const raw = JSON.stringify({
      barcode: { raw: null, confidence: "low" },
      coverHarvestable: false,
      coverCropCoordinates: null,
      writer: null,
      coverArtist: null,
      interiorArtist: null,
    });
    const result: SlabDetailExtractionResult = JSON.parse(raw);
    expect(result.coverHarvestable).toBe(false);
    expect(result.coverCropCoordinates).toBeNull();
  });

  it("has no barcodeNumber field (barcode.raw is the single source)", () => {
    const raw = JSON.stringify({
      barcode: { raw: "12345678901234", confidence: "high" },
      coverHarvestable: false,
      coverCropCoordinates: null,
      writer: null,
      coverArtist: null,
      interiorArtist: null,
    });
    const result = JSON.parse(raw);
    expect(result).not.toHaveProperty("barcodeNumber");
    expect(result.barcode.raw).toBe("12345678901234");
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npx jest src/lib/__tests__/slabProviderTypes.test.ts -v
```

Expected: All passing (these test JSON shape contracts, not implementations)

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/slabProviderTypes.test.ts
git commit -m "test: add slab detection and detail extraction response shape tests"
```

---

### Task 9: Implement Cert-First Branch in Analyze Route

**Files:**
- Modify: `src/app/api/analyze/route.ts`

This is the main integration task. The cert-first branch is inserted after rate limiting/image validation and before the existing full pipeline.

- [ ] **Step 1: Add imports**

Add to the import block at the top of `src/app/api/analyze/route.ts`:

```typescript
import { executeSlabDetection, executeSlabDetailExtraction } from "@/lib/aiProvider";
import { hasCompleteSlabData } from "@/lib/metadataCache";
import {
  normalizeGradingCompany,
  parseKeyComments,
  mergeKeyComments,
  parseArtComments,
} from "@/lib/certHelpers";
import type { ScanPath } from "@/lib/analyticsServer";
```

Note: `ComicMetadata`, `generateComicMetadataCacheKey`, `mergeMetadataIntoDetails`, `getComicMetadata`, `cacheGet`, `cacheSet`, `parseBarcode`, and `lookupKeyInfo` are already imported in the route and do not need new import statements.

- [ ] **Step 2: Add cert-first budget constant and scanPath variable**

Near the top of the POST handler, after `scanStartTime` is defined:

```typescript
const CERT_FIRST_BUDGET_MS = 15_000; // 15s budget for Phases 1-5.5
let scanPath: ScanPath = "full-pipeline";
let barcodeExtracted = false;
```

- [ ] **Step 3: Add cert-first branch after image validation, before existing Phase 1**

After the image hash / cached analysis check block (around line 270), this code goes INSIDE the `else` branch of `if (cachedAnalysis && cachedAnalysis.title)`, after `} else {`. The existing full pipeline is already inside this else branch -- the cert-first block is inserted at the TOP of that else branch, before the existing AI analysis code.

```typescript
    // This entire cert-first block is inside the no-cache-hit else branch
    // i.e., inside: if (cachedAnalysis && cachedAnalysis.title) { ... } else { ← HERE

    // ============================================
    // CERT-FIRST PATH: Detect slab early, use cert data if available
    // Budget: 15s for Phases 1-5.5; Phases 6-8 use existing 25s hard deadline
    // ============================================
    let certFirstPath = false;
    const certFirstStart = Date.now();

    /** Remaining cert-first budget in ms */
    const getCertBudget = () =>
      Math.max(0, CERT_FIRST_BUDGET_MS - (Date.now() - certFirstStart));

    try {
      // Phase 1: Slab Detection (cheap AI, ~0.2c, 5s timeout)
      const slabDetectionStart = Date.now();
      const slabResult = await executeSlabDetection(
        base64Data,
        mediaType || "image/jpeg",
        getCertBudget(),
        aiProviders
      );
      const slabData = slabResult.result;
      const slabDetectionMs = Date.now() - slabDetectionStart;
      aiCallsMade++;

      if (!slabData.isSlabbed || !slabData.certificationNumber || !slabData.gradingCompany) {
        // Not slabbed or missing data -> full pipeline
        console.info("[scan] Not slabbed or missing cert data, using full pipeline");
      } else {
        // Phase 1.5: Grading Company Normalization (free, instant)
        const normalizedCompany = normalizeGradingCompany(slabData.gradingCompany);
        if (!normalizedCompany) {
          console.info(`[scan] Unrecognized grading company: ${slabData.gradingCompany}, falling back`);
          scanPath = "cert-first-fallback";
        } else {
          console.info(
            `[scan] Slab detected: ${normalizedCompany} cert #${slabData.certificationNumber}`
          );

          // Phase 2: Cert Lookup (free, web scrape, 5s timeout)
          if (getCertBudget() <= 0) {
            console.warn("[scan] Cert-first budget exhausted before cert lookup");
            scanPath = "cert-first-fallback";
          } else {
            const certResult = await lookupCertification(
              normalizedCompany,
              slabData.certificationNumber
            );

            if (!certResult.success || !certResult.data || !certResult.data.title) {
              console.warn("[scan] Cert lookup failed, falling back to full pipeline");
              scanPath = "cert-first-fallback";
            } else {
              // Cert lookup succeeded -- build comicDetails from cert data
              certFirstPath = true;

              // Phase 2 data mapping
              const certKeyComments = parseKeyComments(certResult.data.keyComments);

              comicDetails = {
                title: certResult.data.title,
                issueNumber: certResult.data.issueNumber || null,
                variant: certResult.data.variant || null,
                publisher: certResult.data.publisher || null,
                coverArtist: null,
                writer: null,
                interiorArtist: null,
                releaseYear: certResult.data.releaseYear || null,
                confidence: "high",
                isSlabbed: true,
                gradingCompany: normalizedCompany,
                grade: certResult.data.grade || null,
                certificationNumber: slabData.certificationNumber,
                labelType: certResult.data.labelType || undefined,
                pageQuality: certResult.data.pageQuality || undefined,
                gradeDate: certResult.data.gradeDate || undefined,
                graderNotes: certResult.data.graderNotes || undefined,
                isSignatureSeries:
                  certResult.data.labelType?.toLowerCase().includes("signature") || false,
                signedBy: certResult.data.signatures || null,
                barcode: null,
                priceData: null,
                keyInfo: certKeyComments,
                keyInfoSource: certKeyComments.length > 0 ? "cgc" : undefined,
              };

              // Phase 2.5: artComments Creator Parsing (free, instant)
              const artCreators = parseArtComments(certResult.data.artComments ?? null);
              if (artCreators.writer) comicDetails.writer = artCreators.writer;
              if (artCreators.coverArtist) comicDetails.coverArtist = artCreators.coverArtist;
              if (artCreators.interiorArtist)
                comicDetails.interiorArtist = artCreators.interiorArtist;

              // Phase 3: Key Info DB Lookup (free, instant, 3s timeout)
              if (getCertBudget() > 0) {
                try {
                  const databaseKeyInfo = lookupKeyInfo(
                    comicDetails.title,
                    comicDetails.issueNumber || "",
                    comicDetails.releaseYear
                      ? parseInt(String(comicDetails.releaseYear))
                      : null
                  );
                  if (databaseKeyInfo && databaseKeyInfo.length > 0) {
                    comicDetails.keyInfo = mergeKeyComments(certKeyComments, databaseKeyInfo);
                    comicDetails.keyInfoSource = "database";
                  }
                } catch (err) {
                  console.warn("[scan] Key info DB lookup failed, continuing:", err);
                }
              }

              // Phase 4: Metadata Cache Check (free, Redis -> Supabase two-layer)
              // Matches existing pattern at lines 600-617 of the analyze route
              let cachedMeta: ComicMetadata | null = null;
              if (comicDetails.title && comicDetails.issueNumber) {
                const metaCacheKey = generateComicMetadataCacheKey(
                  comicDetails.title,
                  comicDetails.issueNumber
                );
                // Layer 1: Redis (fast, 7-day TTL)
                cachedMeta = await cacheGet<ComicMetadata>(metaCacheKey, "comicMetadata");
                // Layer 2: Supabase fallback (permanent)
                if (!cachedMeta) {
                  const dbMetadata = await getComicMetadata(comicDetails.title, comicDetails.issueNumber);
                  if (dbMetadata) {
                    cachedMeta = dbMetadata as ComicMetadata;
                    // Backfill Redis for next time (fire-and-forget)
                    cacheSet(metaCacheKey, dbMetadata, "comicMetadata").catch(() => {});
                  }
                }
              }
              if (cachedMeta) {
                mergeMetadataIntoDetails(
                  comicDetails as unknown as Record<string, unknown>,
                  cachedMeta
                );
              }

              // Combine artComments creators + cache creators for gate check
              const creatorSnapshot = {
                writer: comicDetails.writer,
                coverArtist: comicDetails.coverArtist,
                interiorArtist: comicDetails.interiorArtist,
              };

              const cacheHasAllCreators = hasCompleteSlabData(creatorSnapshot);

              if (cacheHasAllCreators) {
                // Phase 5.5: Cover Harvest Fields Only (cache hit path)
                scanPath = "cert-first-cached";
                console.info(
                  "[scan] Cache complete for slab -- running cover harvest only (Phase 5.5)"
                );

                if (getCertBudget() > 0) {
                  try {
                    const harvestStart = Date.now();
                    const harvestResult = await executeSlabDetailExtraction(
                      base64Data,
                      mediaType || "image/jpeg",
                      {
                        skipCreators: true,
                        skipBarcode: true,
                        remainingBudgetMs: getCertBudget(),
                      },
                      aiProviders
                    );
                    const harvestMs = Date.now() - harvestStart;
                    aiCallsMade++;

                    const harvest = harvestResult.result;
                    (comicDetails as Record<string, unknown>).coverHarvestable =
                      harvest.coverHarvestable;
                    (comicDetails as Record<string, unknown>).coverCropCoordinates =
                      harvest.coverCropCoordinates;

                    // Track in callDetails
                    slabDetailExtractionMeta = {
                      provider: harvestResult.provider,
                      durationMs: harvestMs,
                      cost: aiProviders.find((p) => p.name === harvestResult.provider)
                        ?.estimateCostCents("slabDetailExtraction") ?? 0.1,
                      coverHarvestOnly: true,
                    };
                  } catch (err) {
                    console.warn("[scan] Cover harvest extraction failed:", err);
                  }
                }
              } else {
                // Phase 5: Focused AI Call (cache miss path, ~0.5c)
                scanPath = "cert-first-full";
                console.info(
                  "[scan] Cache incomplete -- running focused AI extraction (Phase 5)"
                );

                if (getCertBudget() > 0) {
                  try {
                    const detailStart = Date.now();
                    const detailResult = await executeSlabDetailExtraction(
                      base64Data,
                      mediaType || "image/jpeg",
                      { remainingBudgetMs: getCertBudget() },
                      aiProviders
                    );
                    const detailMs = Date.now() - detailStart;
                    aiCallsMade++;

                    const details = detailResult.result;

                    // Merge barcode
                    if (details.barcode && details.barcode.raw) {
                      comicDetails.barcode = {
                        raw: details.barcode.raw!,
                        confidence: details.barcode.confidence,
                      };
                      comicDetails.barcodeNumber = details.barcode.raw;
                      barcodeExtracted = true;
                    }

                    // Merge cover harvest fields
                    (comicDetails as Record<string, unknown>).coverHarvestable =
                      details.coverHarvestable;
                    (comicDetails as Record<string, unknown>).coverCropCoordinates =
                      details.coverCropCoordinates;

                    // Merge creators (fill-only, never overwrite)
                    if (!comicDetails.writer && details.writer)
                      comicDetails.writer = details.writer;
                    if (!comicDetails.coverArtist && details.coverArtist)
                      comicDetails.coverArtist = details.coverArtist;
                    if (!comicDetails.interiorArtist && details.interiorArtist)
                      comicDetails.interiorArtist = details.interiorArtist;

                    // Save creators to metadata cache for future scans
                    // (handled by existing save logic later in the route)

                    // Track in callDetails
                    slabDetailExtractionMeta = {
                      provider: detailResult.provider,
                      durationMs: detailMs,
                      cost: aiProviders.find((p) => p.name === detailResult.provider)
                        ?.estimateCostCents("slabDetailExtraction") ?? 0.5,
                      coverHarvestOnly: false,
                    };
                  } catch (err) {
                    console.warn(
                      "[scan] Slab detail extraction failed, continuing without:",
                      err
                    );
                  }
                } else {
                  console.warn(
                    "[scan] Cert-first budget exhausted before Phase 5 -- skipping to eBay pricing"
                  );
                }
              }

              // Track slab detection in callDetails
              slabDetectionMeta = {
                provider: slabResult.provider,
                durationMs: slabDetectionMs,
                cost: aiProviders.find((p) => p.name === slabResult.provider)
                  ?.estimateCostCents("slabDetection") ?? 0.2,
              };

              console.info(
                `[scan] Cert-first path complete: title="${comicDetails.title}" issue="${comicDetails.issueNumber}" scanPath="${scanPath}"`
              );
            }
          }
        }
      }
    } catch (err) {
      console.warn("[scan] Slab detection failed, falling back to full pipeline:", err);
      scanPath = "cert-first-fallback";
      certFirstPath = false;
    }

    if (!certFirstPath) {
      // ─── EXISTING FULL PIPELINE (unchanged) ───
```

Then close the `if (!certFirstPath)` block after the existing full pipeline code with `}`.

- [ ] **Step 4: Declare callDetails tracking variables**

Near the top of the POST handler, alongside other tracking variables:

```typescript
    let slabDetectionMeta: {
      provider: string;
      durationMs: number;
      cost: number;
    } | undefined;
    let slabDetailExtractionMeta: {
      provider: string;
      durationMs: number;
      cost: number;
      coverHarvestOnly?: boolean;
    } | undefined;
    let verificationMeta: { provider: string; fallbackUsed: boolean } | null = null;
```

- [ ] **Step 5: Update ScanResponseMeta construction**

Where the response `meta` object is built, add the new callDetails fields:

```typescript
    callDetails: {
      imageAnalysis: certFirstPath
        ? null
        : { provider: p1, fallbackUsed: fb1 },
      verification: verificationMeta,
      slabDetection: slabDetectionMeta,
      slabDetailExtraction: slabDetailExtractionMeta,
    },
```

- [ ] **Step 6: Update analytics tracking**

In the `recordScanAnalytics()` call, add the new fields:

```typescript
      scan_path: scanPath,
      barcode_extracted: barcodeExtracted,
```

- [ ] **Step 7: Parse barcode if detected**

After the cert-first block, before eBay pricing:

```typescript
    // Parse barcode if detected in cert-first path
    if (comicDetails.barcode && comicDetails.barcode.raw) {
      const parsed = parseBarcode(comicDetails.barcode.raw);
      if (parsed) {
        comicDetails.barcode.parsed = parsed;
      }
    }

    // Backward-compat: populate legacy barcodeNumber field
    if (comicDetails.barcode?.raw && !comicDetails.barcodeNumber) {
      comicDetails.barcodeNumber = comicDetails.barcode.raw;
    }
```

- [ ] **Step 8: Run full test suite**

```bash
npm test
```

Expected: All tests passing (no regressions)

- [ ] **Step 9: Run type check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 10: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat: implement cert-first scan branch with 15s budget and 4 scan paths"
```

---

### Task 10: Integration Testing and Final Verification

**Files:** None (manual testing + quality checks)

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All tests passing, no regressions

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: No new lint errors

- [ ] **Step 4: Restart dev server and test slabbed comic scan**

Scan a CGC-graded comic. Verify in server logs:
- `[scan] Slab detected: CGC cert #XXXXXXX` appears
- `[scan] Cert-first path complete:` appears with scanPath
- No full AI analysis log should appear
- eBay pricing still works
- Cover harvest runs (Phase 5 or 5.5)

- [ ] **Step 5: Test raw comic scan (no regression)**

Scan a non-graded comic. Verify in server logs:
- Slab detection runs but `isSlabbed=false`
- Falls through to full pipeline
- Existing behavior unchanged

- [ ] **Step 6: Test repeat slabbed scan (cache hit path)**

Scan the same slabbed comic again. Verify:
- `[scan] Cache complete for slab -- running cover harvest only (Phase 5.5)` appears
- scanPath is `cert-first-cached`
- Only slab detection + cover harvest AI calls made

- [ ] **Step 7: Test cert lookup failure fallback**

Temporarily modify cert number to invalid value and scan. Verify:
- Cert lookup fails
- `scanPath: "cert-first-fallback"` in logs
- Falls back to full pipeline seamlessly

- [ ] **Step 8: Verify analytics**

Check Supabase `scan_analytics` table for recent scans. Verify:
- `scan_path` column populated with correct values
- `barcode_extracted` column populated correctly

- [ ] **Step 9: Commit any fixes from testing**

```bash
npm test && npx tsc --noEmit && npm run lint
git add -A
git commit -m "fix: integration test fixes for cert-first pipeline"
```
