# Scan Resilience: Multi-Provider Fallback — Implementation Plan

> **Apr 23, 2026 update:** Provider-fallback task list below is unchanged. Adjacent scan-flow additions also shipped: pre-harvest aspect-ratio guard (`src/lib/coverCropValidator.ts`), hCaptcha gate on guest scans 4-5, 10MB upload cap, updated slab prompt with EXCLUDE/CROP markers, and Metron verification removed from the pipeline.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add OpenAI GPT-4o as a fallback AI provider for the `/api/analyze` route so that comic cover scanning never goes down — even when Anthropic is unavailable.

**Architecture:** Extract Anthropic-specific logic from the monolithic analyze route into a provider abstraction layer (`src/lib/providers/`). Build a fallback orchestrator (`src/lib/aiProvider.ts`) that wraps each of the 3 independent AI calls with per-call fallback, timeout enforcement, and error classification. The analyze route becomes a consumer of the provider interface rather than directly calling the Anthropic SDK.

**Tech Stack:** Next.js 14, TypeScript, Anthropic SDK, OpenAI SDK (new), Supabase (Postgres), Upstash Redis, PostHog, Sentry

**Design Doc:** `docs/plans/2026-02-27-scan-resilience-design.md` (2 rounds of Sr. Engineering review, 24 findings incorporated)

**Scope:** Phase 1 only — `/api/analyze` route. Text-only routes (`quick-lookup`, `comic-lookup`, etc.) are Phase 2.

---

## Pre-Implementation: Prompt Comparison Study

> **REQUIRED before deploying to production.** Can be done in parallel with Tasks 1-5.

Run 10-15 sample comic images through both Anthropic (Claude Sonnet) and OpenAI (GPT-4o) with the same prompt. Score each response on: title accuracy, issue number accuracy, barcode digit accuracy, slab detection accuracy. Document the quality delta. If OpenAI is notably worse at certain fields, the fallback provider should return `null` for those fields or set `confidence: "low"`.

This does not block development — the fallback code can be written and tested with mocks before the study is complete. But the study MUST be done before the fallback is deployed to production.

---

### Task 1: Install OpenAI SDK + Update Model Configuration

**Files:**
- Modify: `package.json` (add `openai` dependency)
- Modify: `src/lib/models.ts`

**Step 1: Install the OpenAI SDK**

Run:
```bash
npm install openai
```

**Step 2: Update model configuration**

Edit `src/lib/models.ts` to add OpenAI model constants. Keep the existing Anthropic constants unchanged.

```typescript
/**
 * Centralized AI model configuration for all providers.
 *
 * Anthropic: Pin to specific version to avoid breaking changes from aliases.
 * OpenAI: Use stable model identifiers.
 */

// Anthropic models (primary provider)
export const MODEL_PRIMARY = "claude-sonnet-4-20250514";
export const MODEL_LIGHTWEIGHT = "claude-haiku-4-5-20251001";

// OpenAI models (fallback provider)
export const OPENAI_PRIMARY = "gpt-4o";
export const OPENAI_LIGHTWEIGHT = "gpt-4o-mini";

// Provider order (first = primary, rest = fallbacks)
export const VISION_PROVIDER_ORDER = ["anthropic", "openai"] as const;
```

**Step 3: Commit**

```bash
git add package.json package-lock.json src/lib/models.ts
git commit -m "feat: install OpenAI SDK and add model config for fallback provider"
```

---

### Task 2: Create Provider Types

**Files:**
- Create: `src/lib/providers/types.ts`

**Step 1: Create the provider types file**

Create `src/lib/providers/types.ts` with all shared types used by both providers and the orchestrator. These types are derived directly from the `ComicDetails` interface in `src/types/comic.ts` and the actual fields returned by the 3 AI calls in the analyze route.

```typescript
// src/lib/providers/types.ts

import type { GradingCompany, GradeEstimate } from "@/types/comic";

// ── Call Options ──

export interface CallOptions {
  signal?: AbortSignal;
}

// ── Request Types ──

export interface ImageAnalysisRequest {
  base64Data: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
}

export interface VerificationRequest {
  title: string;
  issueNumber: string;
  publisher: string | null;
  releaseYear: string | null;
  variant: string | null;
  writer: string | null;
  coverArtist: string | null;
  interiorArtist: string | null;
  missingFields: string[];
}

export interface PriceEstimationRequest {
  title: string;
  issueNumber: string;
  publisher: string | null;
  releaseYear: string | null;
  grade: string | null;
  gradingCompany: string | null;
  isSlabbed: boolean;
  isSignatureSeries: boolean;
  signedBy: string | null;
}

// ── Result Types ──

/** Fields returned by Call 1 (image analysis). Derived from ComicDetails in src/types/comic.ts. */
export interface ImageAnalysisResult {
  title: string | null;
  issueNumber: string | null;
  publisher: string | null;
  releaseYear: string | null;
  variant: string | null;
  writer: string | null;
  coverArtist: string | null;
  interiorArtist: string | null;
  confidence: "high" | "medium" | "low";
  // Grading info (detected from slabbed comics)
  isSlabbed: boolean;
  gradingCompany: GradingCompany | null;
  grade: string | null;
  certificationNumber: string | null;
  labelType: string | null;
  pageQuality: string | null;
  gradeDate: string | null;
  graderNotes: string | null;
  isSignatureSeries: boolean;
  signedBy: string | null;
  // Barcode
  barcodeNumber: string | null;
  barcode: {
    raw: string;
    confidence: "high" | "medium" | "low";
  } | null;
}

export interface VerificationResult {
  writer: string | null;
  coverArtist: string | null;
  interiorArtist: string | null;
  publisher: string | null;
  releaseYear: string | null;
  variant: string | null;
  keyInfo: string[];
}

export interface PriceEstimationResult {
  recentSales: {
    price: number;
    date: string;
    source: string;
    daysAgo?: number;
  }[];
  gradeEstimates: GradeEstimate[];
  marketNotes: string;
}

// ── Error Types ──

export type ErrorReason =
  | "model_not_found"
  | "rate_limited"
  | "server_error"
  | "timeout"
  | "auth_error"
  | "bad_request"
  | "content_policy"
  | "unknown";

/** Errors that should NOT trigger fallback — same input will fail on any provider */
export const NON_RETRYABLE_ERRORS: ErrorReason[] = ["bad_request", "content_policy"];

// ── Provider Interface ──

export type AICallType = "imageAnalysis" | "verification" | "priceEstimation";

export interface AIProvider {
  readonly name: "anthropic" | "openai";

  /** Vision-based cover analysis. Provider owns JSON parsing internally. */
  analyzeImage(req: ImageAnalysisRequest, opts?: CallOptions): Promise<ImageAnalysisResult>;

  /** Text-based verification and creator lookup. Provider owns JSON parsing internally. */
  verifyAndEnrich(req: VerificationRequest, opts?: CallOptions): Promise<VerificationResult>;

  /** Text-based price estimation. Provider owns JSON parsing internally. */
  estimatePrice(req: PriceEstimationRequest, opts?: CallOptions): Promise<PriceEstimationResult>;

  /** Returns the estimated cost in cents for a single call of the given type. */
  estimateCostCents(callType: AICallType): number;
}

// ── Orchestrator Result ──

export interface CallResult<T> {
  result: T;
  provider: string;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  fallbackRawError: string | null;
}

// ── Response Metadata ──

export interface ScanResponseMeta {
  provider: "anthropic" | "openai";
  fallbackUsed: boolean;
  fallbackReason: string | null;
  confidence: "high" | "medium" | "low";
  callDetails: {
    imageAnalysis: { provider: string; fallbackUsed: boolean };
    verification: { provider: string; fallbackUsed: boolean } | null;
    priceEstimation: { provider: string; fallbackUsed: boolean } | null;
  };
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```
Expected: No errors related to `providers/types.ts`.

**Step 3: Commit**

```bash
git add src/lib/providers/types.ts
git commit -m "feat: add provider types for multi-provider fallback"
```

---

### Task 3: Implement Anthropic Provider (Extract from Analyze Route)

**Files:**
- Create: `src/lib/providers/anthropic.ts`
- Create: `src/lib/providers/__tests__/anthropic.test.ts`

**Context:** The current analyze route (`src/app/api/analyze/route.ts`) has 3 inline Anthropic calls at lines ~261, ~690, and ~832. This task extracts the prompt text and response parsing into a standalone provider class. The route will NOT be modified yet (that's Task 7).

**Step 1: Write tests for Anthropic provider**

Create `src/lib/providers/__tests__/anthropic.test.ts`:

```typescript
import { AnthropicProvider } from "../anthropic";

// Mock the Anthropic SDK
jest.mock("@anthropic-ai/sdk", () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  }));
});

// Mock models
jest.mock("@/lib/models", () => ({
  MODEL_PRIMARY: "claude-sonnet-4-20250514",
}));

describe("AnthropicProvider", () => {
  let provider: AnthropicProvider;
  let mockCreate: jest.Mock;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    provider = new AnthropicProvider();
    // Access the mock through the provider's client
    const Anthropic = require("@anthropic-ai/sdk");
    const instance = new Anthropic();
    mockCreate = instance.messages.create;
    // Replace the provider's internal client with our mock
    (provider as unknown as { client: { messages: { create: jest.Mock } } }).client = instance;
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe("name", () => {
    it("returns 'anthropic'", () => {
      expect(provider.name).toBe("anthropic");
    });
  });

  describe("parseJsonResponse", () => {
    // Access private method for testing
    const parse = (raw: string) =>
      (provider as unknown as { parseJsonResponse: (s: string) => unknown }).parseJsonResponse(raw);

    it("parses clean JSON", () => {
      const result = parse('{"title": "Spider-Man", "issueNumber": "1"}');
      expect(result).toEqual({ title: "Spider-Man", issueNumber: "1" });
    });

    it("strips ```json fences", () => {
      const result = parse('```json\n{"title": "Batman"}\n```');
      expect(result).toEqual({ title: "Batman" });
    });

    it("strips ``` fences without json label", () => {
      const result = parse('```\n{"title": "X-Men"}\n```');
      expect(result).toEqual({ title: "X-Men" });
    });

    it("handles whitespace around JSON", () => {
      const result = parse('  \n{"title": "Spawn"}\n  ');
      expect(result).toEqual({ title: "Spawn" });
    });

    it("throws on invalid JSON", () => {
      expect(() => parse("not json")).toThrow();
    });
  });

  describe("estimateCostCents", () => {
    it("returns 1.5 for imageAnalysis", () => {
      expect(provider.estimateCostCents("imageAnalysis")).toBe(1.5);
    });

    it("returns 0.6 for verification", () => {
      expect(provider.estimateCostCents("verification")).toBe(0.6);
    });

    it("returns 0.6 for priceEstimation", () => {
      expect(provider.estimateCostCents("priceEstimation")).toBe(0.6);
    });
  });

  describe("analyzeImage", () => {
    it("calls Anthropic with vision message and returns parsed result", async () => {
      const mockResult = {
        title: "Amazing Spider-Man",
        issueNumber: "300",
        publisher: "Marvel Comics",
        releaseYear: "1988",
        variant: null,
        writer: "David Michelinie",
        coverArtist: "Todd McFarlane",
        interiorArtist: "Todd McFarlane",
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

      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify(mockResult) }],
      });

      const result = await provider.analyzeImage({
        base64Data: "base64data",
        mediaType: "image/jpeg",
      });

      expect(result.title).toBe("Amazing Spider-Man");
      expect(result.issueNumber).toBe("300");
      expect(result.publisher).toBe("Marvel Comics");
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
        }),
        expect.any(Object)
      );
    });

    it("throws when response has no text block", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "123" }],
      });

      await expect(
        provider.analyzeImage({ base64Data: "data", mediaType: "image/jpeg" })
      ).rejects.toThrow("No text response");
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
npm test -- src/lib/providers/__tests__/anthropic.test.ts
```
Expected: FAIL — `AnthropicProvider` doesn't exist yet.

**Step 3: Implement the Anthropic provider**

Create `src/lib/providers/anthropic.ts`. Extract the 3 prompts from `src/app/api/analyze/route.ts` (lines ~278-335 for image analysis, ~694-718 for verification, ~835-887 for price estimation). The prompts must be extracted EXACTLY as they appear in the route — do not modify the prompt text.

```typescript
// src/lib/providers/anthropic.ts

import Anthropic from "@anthropic-ai/sdk";
import { MODEL_PRIMARY } from "@/lib/models";
import type {
  AIProvider,
  AICallType,
  CallOptions,
  ImageAnalysisRequest,
  ImageAnalysisResult,
  VerificationRequest,
  VerificationResult,
  PriceEstimationRequest,
  PriceEstimationResult,
} from "./types";

// ── Shared Prompts ──
// These are extracted verbatim from /api/analyze/route.ts.
// They live here so both Anthropic and OpenAI providers can use them.

export const IMAGE_ANALYSIS_PROMPT = `You are an expert comic book identifier. Analyze this comic book cover image and extract the following information in JSON format:

{
  "title": "Comic title",
  "issueNumber": "Issue number (digits only, e.g., '1', '300')",
  "publisher": "Publisher name",
  "releaseYear": "Year of publication (4-digit year)",
  "variant": "Variant description or null if standard cover",
  "writer": "Writer name or null if not visible",
  "coverArtist": "Cover artist name or null if not visible",
  "interiorArtist": "Interior artist name or null if not visible",
  "confidence": "high/medium/low based on how confident you are in the identification",
  "isSlabbed": false,
  "gradingCompany": null,
  "grade": null,
  "certificationNumber": null,
  "labelType": null,
  "pageQuality": null,
  "gradeDate": null,
  "graderNotes": null,
  "isSignatureSeries": false,
  "signedBy": null,
  "barcodeNumber": null,
  "barcode": null
}

IMPORTANT INSTRUCTIONS:
1. Look carefully at the cover for the title, issue number, and any other visible text
2. If the comic is in a graded slab (CGC, CBCS, or PGX), set isSlabbed to true and extract grading info from the label
3. For CGC/CBCS/PGX slabbed comics, extract: gradingCompany, grade (numeric like "9.8"), certificationNumber, labelType, pageQuality, gradeDate, graderNotes
4. If there is a visible UPC barcode, try to read the digits. Set barcodeNumber to the full digit string, and set barcode to {"raw": "digits", "confidence": "high/medium/low"}
5. For barcode confidence: "high" = you can clearly read all digits, "medium" = you can read most digits but some are uncertain, "low" = very uncertain
6. Return ONLY the JSON object, no additional text or explanation
7. If you cannot determine a field, set it to null
8. For isSignatureSeries, check if the label says "Signature Series" or "SS"
9. If signed, try to identify who signed it from the label`;

export function buildVerificationPrompt(req: VerificationRequest): string {
  const missingList = req.missingFields.join(", ");
  return `You are an expert comic book database. I have identified a comic book but am missing some information. Please help fill in the missing details.

Comic identified:
- Title: ${req.title}
- Issue Number: ${req.issueNumber}
- Publisher: ${req.publisher || "Unknown"}
- Release Year: ${req.releaseYear || "Unknown"}
- Variant: ${req.variant || "Standard"}
- Writer: ${req.writer || "Unknown"}
- Cover Artist: ${req.coverArtist || "Unknown"}
- Interior Artist: ${req.interiorArtist || "Unknown"}

Missing fields I need: ${missingList}

Also, please identify if this comic is a "key issue" - meaning it features a first appearance, death, origin story, or other significant event. Return key info as an array of strings.

Return ONLY a JSON object with these fields:
{
  "writer": "Writer name or null",
  "coverArtist": "Cover artist name or null",
  "interiorArtist": "Interior artist name or null",
  "publisher": "Publisher name or null",
  "releaseYear": "Year or null",
  "variant": "Variant description or null",
  "keyInfo": ["First appearance of Venom", "etc"] or []
}

Return ONLY fields you are confident about. Set uncertain fields to null.`;
}

export function buildPriceEstimationPrompt(req: PriceEstimationRequest): string {
  const gradeInfo = req.isSlabbed
    ? `Graded by ${req.gradingCompany} at ${req.grade}`
    : `Raw/ungraded (estimate at 9.4 NM condition)`;
  const sigInfo = req.isSignatureSeries
    ? `Signature Series, signed by ${req.signedBy || "unknown"}`
    : "Not signed";

  return `You are an expert comic book price guide. Estimate the current market value and recent sale prices for this comic:

Title: ${req.title}
Issue Number: ${req.issueNumber}
Publisher: ${req.publisher || "Unknown"}
Release Year: ${req.releaseYear || "Unknown"}
Condition: ${gradeInfo}
Signature: ${sigInfo}

Return a JSON object with this structure:
{
  "recentSales": [
    {"price": 45.00, "date": "2026-01-15", "source": "eBay", "daysAgo": 45},
    {"price": 42.50, "date": "2025-12-20", "source": "eBay", "daysAgo": 71},
    {"price": 50.00, "date": "2025-11-10", "source": "eBay", "daysAgo": 111}
  ],
  "gradeEstimates": [
    {"grade": 9.8, "label": "Near Mint/Mint", "rawValue": 60, "slabbedValue": 120},
    {"grade": 9.4, "label": "Near Mint", "rawValue": 40, "slabbedValue": 80},
    {"grade": 8.0, "label": "Very Fine", "rawValue": 25, "slabbedValue": 50},
    {"grade": 6.0, "label": "Fine", "rawValue": 15, "slabbedValue": 30}
  ],
  "marketNotes": "Brief market notes about this comic's value trends"
}

IMPORTANT:
1. Estimate realistic prices based on actual market knowledge
2. recentSales should reflect what similar comics actually sell for on eBay
3. gradeEstimates should show how value changes across common grades
4. Include at least 3 recent sales if possible
5. Include 4 grade estimates spanning 9.8 to 6.0
6. Return ONLY the JSON object`;
}

// ── Provider Implementation ──

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic" as const;
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async analyzeImage(req: ImageAnalysisRequest, opts?: CallOptions): Promise<ImageAnalysisResult> {
    const response = await this.client.messages.create(
      {
        model: MODEL_PRIMARY,
        max_tokens: 1024,
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
              { type: "text", text: IMAGE_ANALYSIS_PROMPT },
            ],
          },
        ],
      },
      { signal: opts?.signal }
    );

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Anthropic image analysis");
    }

    return this.parseJsonResponse(textBlock.text) as ImageAnalysisResult;
  }

  async verifyAndEnrich(req: VerificationRequest, opts?: CallOptions): Promise<VerificationResult> {
    const response = await this.client.messages.create(
      {
        model: MODEL_PRIMARY,
        max_tokens: 384,
        messages: [
          {
            role: "user",
            content: buildVerificationPrompt(req),
          },
        ],
      },
      { signal: opts?.signal }
    );

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Anthropic verification");
    }

    return this.parseJsonResponse(textBlock.text) as VerificationResult;
  }

  async estimatePrice(req: PriceEstimationRequest, opts?: CallOptions): Promise<PriceEstimationResult> {
    const response = await this.client.messages.create(
      {
        model: MODEL_PRIMARY,
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: buildPriceEstimationPrompt(req),
          },
        ],
      },
      { signal: opts?.signal }
    );

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Anthropic price estimation");
    }

    return this.parseJsonResponse(textBlock.text) as PriceEstimationResult;
  }

  estimateCostCents(callType: AICallType): number {
    switch (callType) {
      case "imageAnalysis":
        return 1.5; // ~$0.015
      case "verification":
        return 0.6; // ~$0.006
      case "priceEstimation":
        return 0.6; // ~$0.006
    }
  }

  /** Strip markdown code fences and parse JSON from Anthropic's response */
  parseJsonResponse(raw: string): unknown {
    let text = raw.trim();
    if (text.startsWith("```json")) text = text.slice(7);
    if (text.startsWith("```")) text = text.slice(3);
    if (text.endsWith("```")) text = text.slice(0, -3);
    return JSON.parse(text.trim());
  }
}
```

**Important:** The prompts above are representative. During implementation, the engineer MUST read the actual prompts from `src/app/api/analyze/route.ts` (lines ~278-335, ~694-718, ~835-887) and extract them exactly. The prompts above capture the structure but the actual route may have minor differences.

**Step 4: Run tests**

Run:
```bash
npm test -- src/lib/providers/__tests__/anthropic.test.ts
```
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/lib/providers/anthropic.ts src/lib/providers/__tests__/anthropic.test.ts
git commit -m "feat: extract Anthropic provider from analyze route"
```

---

### Task 4: Implement OpenAI Provider

**Files:**
- Create: `src/lib/providers/openai.ts`
- Create: `src/lib/providers/__tests__/openai.test.ts`

**Step 1: Write tests for OpenAI provider**

Create `src/lib/providers/__tests__/openai.test.ts`:

```typescript
import { OpenAIProvider } from "../openai";

// Mock the OpenAI SDK
jest.mock("openai", () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }));
});

jest.mock("@/lib/models", () => ({
  OPENAI_PRIMARY: "gpt-4o",
}));

describe("OpenAIProvider", () => {
  let provider: OpenAIProvider;
  let mockCreate: jest.Mock;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    provider = new OpenAIProvider();
    const OpenAI = require("openai");
    const instance = new OpenAI();
    mockCreate = instance.chat.completions.create;
    (provider as unknown as { client: { chat: { completions: { create: jest.Mock } } } }).client =
      instance;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe("name", () => {
    it("returns 'openai'", () => {
      expect(provider.name).toBe("openai");
    });
  });

  describe("estimateCostCents", () => {
    it("returns 1.2 for imageAnalysis (cheaper than Anthropic)", () => {
      expect(provider.estimateCostCents("imageAnalysis")).toBe(1.2);
    });

    it("returns 0.4 for verification", () => {
      expect(provider.estimateCostCents("verification")).toBe(0.4);
    });

    it("returns 0.4 for priceEstimation", () => {
      expect(provider.estimateCostCents("priceEstimation")).toBe(0.4);
    });
  });

  describe("analyzeImage", () => {
    it("calls OpenAI with image_url content and JSON mode", async () => {
      const mockResult = {
        title: "Batman",
        issueNumber: "1",
        publisher: "DC Comics",
        releaseYear: "2011",
        variant: null,
        writer: "Scott Snyder",
        coverArtist: "Greg Capullo",
        interiorArtist: "Greg Capullo",
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

      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockResult) } }],
      });

      const result = await provider.analyzeImage({
        base64Data: "base64data",
        mediaType: "image/jpeg",
      });

      expect(result.title).toBe("Batman");
      expect(result.publisher).toBe("DC Comics");
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4o",
          response_format: { type: "json_object" },
        }),
        expect.any(Object)
      );
    });

    it("throws when response has no content", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });

      await expect(
        provider.analyzeImage({ base64Data: "data", mediaType: "image/jpeg" })
      ).rejects.toThrow("No response from OpenAI");
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
npm test -- src/lib/providers/__tests__/openai.test.ts
```
Expected: FAIL — `OpenAIProvider` doesn't exist yet.

**Step 3: Implement the OpenAI provider**

Create `src/lib/providers/openai.ts`:

```typescript
// src/lib/providers/openai.ts

import OpenAI from "openai";
import { OPENAI_PRIMARY } from "@/lib/models";
import {
  IMAGE_ANALYSIS_PROMPT,
  buildVerificationPrompt,
  buildPriceEstimationPrompt,
} from "./anthropic";
import type {
  AIProvider,
  AICallType,
  CallOptions,
  ImageAnalysisRequest,
  ImageAnalysisResult,
  VerificationRequest,
  VerificationResult,
  PriceEstimationRequest,
  PriceEstimationResult,
} from "./types";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async analyzeImage(req: ImageAnalysisRequest, opts?: CallOptions): Promise<ImageAnalysisResult> {
    const response = await this.client.chat.completions.create(
      {
        model: OPENAI_PRIMARY,
        max_tokens: 1024,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${req.mediaType};base64,${req.base64Data}`,
                },
              },
              { type: "text", text: IMAGE_ANALYSIS_PROMPT },
            ],
          },
        ],
      },
      { signal: opts?.signal }
    );

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error("No response from OpenAI image analysis");

    // OpenAI JSON mode returns clean JSON — no markdown cleanup needed
    return JSON.parse(text) as ImageAnalysisResult;
  }

  async verifyAndEnrich(req: VerificationRequest, opts?: CallOptions): Promise<VerificationResult> {
    const response = await this.client.chat.completions.create(
      {
        model: OPENAI_PRIMARY,
        max_tokens: 384,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: buildVerificationPrompt(req),
          },
        ],
      },
      { signal: opts?.signal }
    );

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error("No response from OpenAI verification");

    return JSON.parse(text) as VerificationResult;
  }

  async estimatePrice(req: PriceEstimationRequest, opts?: CallOptions): Promise<PriceEstimationResult> {
    const response = await this.client.chat.completions.create(
      {
        model: OPENAI_PRIMARY,
        max_tokens: 512,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: buildPriceEstimationPrompt(req),
          },
        ],
      },
      { signal: opts?.signal }
    );

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error("No response from OpenAI price estimation");

    return JSON.parse(text) as PriceEstimationResult;
  }

  estimateCostCents(callType: AICallType): number {
    // GPT-4o pricing (slightly cheaper than Anthropic Sonnet)
    switch (callType) {
      case "imageAnalysis":
        return 1.2; // ~$0.012
      case "verification":
        return 0.4; // ~$0.004
      case "priceEstimation":
        return 0.4; // ~$0.004
    }
  }
}
```

**Step 4: Run tests**

Run:
```bash
npm test -- src/lib/providers/__tests__/openai.test.ts
```
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/lib/providers/openai.ts src/lib/providers/__tests__/openai.test.ts
git commit -m "feat: implement OpenAI provider for fallback scanning"
```

---

### Task 5: Build Fallback Orchestrator

**Files:**
- Create: `src/lib/aiProvider.ts`
- Create: `src/lib/__tests__/aiProvider.test.ts`

**Step 1: Write tests for the orchestrator**

Create `src/lib/__tests__/aiProvider.test.ts`:

```typescript
import { classifyError, executeWithFallback } from "../aiProvider";
import type { AIProvider, ImageAnalysisResult } from "../providers/types";

// ── Helper: create a mock provider ──
function createMockProvider(name: "anthropic" | "openai"): AIProvider & { analyzeImage: jest.Mock } {
  return {
    name,
    analyzeImage: jest.fn(),
    verifyAndEnrich: jest.fn(),
    estimatePrice: jest.fn(),
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
    expect(classifyError({ status: 401, message: "unauthorized" })).toBe("auth_error");
  });

  it("classifies 404 as model_not_found", () => {
    expect(classifyError({ status: 404, message: "not found" })).toBe("model_not_found");
  });

  it("classifies 429 as rate_limited", () => {
    expect(classifyError({ status: 429, message: "rate limit" })).toBe("rate_limited");
  });

  it("classifies 500+ as server_error", () => {
    expect(classifyError({ status: 500, message: "internal" })).toBe("server_error");
    expect(classifyError({ status: 502, message: "bad gateway" })).toBe("server_error");
    expect(classifyError({ status: 503, message: "unavailable" })).toBe("server_error");
  });

  it("classifies content policy errors", () => {
    expect(classifyError(new Error("content policy violation detected"))).toBe("content_policy");
    expect(classifyError(new Error("safety system triggered"))).toBe("content_policy");
  });

  it("classifies unknown errors", () => {
    expect(classifyError(new Error("something weird"))).toBe("unknown");
  });
});

describe("executeWithFallback", () => {
  it("returns primary result when primary succeeds", async () => {
    const primary = createMockProvider("anthropic");
    primary.analyzeImage.mockResolvedValueOnce(mockResult);

    const result = await executeWithFallback(
      (provider, signal) => provider.analyzeImage({ base64Data: "x", mediaType: "image/jpeg" }, { signal }),
      15_000,
      10_000,
      "test",
      [primary]
    );

    expect(result.provider).toBe("anthropic");
    expect(result.fallbackUsed).toBe(false);
    expect(result.result.title).toBe("Spider-Man");
  });

  it("falls back to secondary when primary fails with server error", async () => {
    const primary = createMockProvider("anthropic");
    const secondary = createMockProvider("openai");

    primary.analyzeImage.mockRejectedValueOnce({ status: 500, message: "internal server error" });
    secondary.analyzeImage.mockResolvedValueOnce(mockResult);

    const result = await executeWithFallback(
      (provider, signal) => provider.analyzeImage({ base64Data: "x", mediaType: "image/jpeg" }, { signal }),
      15_000,
      10_000,
      "test",
      [primary, secondary]
    );

    expect(result.provider).toBe("openai");
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe("server_error");
  });

  it("does NOT fallback on 400 bad_request", async () => {
    const primary = createMockProvider("anthropic");
    const secondary = createMockProvider("openai");

    primary.analyzeImage.mockRejectedValueOnce({ status: 400, message: "bad request" });

    await expect(
      executeWithFallback(
        (provider, signal) => provider.analyzeImage({ base64Data: "x", mediaType: "image/jpeg" }, { signal }),
        15_000,
        10_000,
        "test",
        [primary, secondary]
      )
    ).rejects.toEqual({ status: 400, message: "bad request" });

    // Secondary should never have been called
    expect(secondary.analyzeImage).not.toHaveBeenCalled();
  });

  it("does NOT fallback on content_policy", async () => {
    const primary = createMockProvider("anthropic");
    const secondary = createMockProvider("openai");

    primary.analyzeImage.mockRejectedValueOnce(new Error("content policy violation"));

    await expect(
      executeWithFallback(
        (provider, signal) => provider.analyzeImage({ base64Data: "x", mediaType: "image/jpeg" }, { signal }),
        15_000,
        10_000,
        "test",
        [primary, secondary]
      )
    ).rejects.toThrow("content policy");

    expect(secondary.analyzeImage).not.toHaveBeenCalled();
  });

  it("throws when all providers fail", async () => {
    const primary = createMockProvider("anthropic");
    const secondary = createMockProvider("openai");

    primary.analyzeImage.mockRejectedValueOnce({ status: 500, message: "down" });
    secondary.analyzeImage.mockRejectedValueOnce({ status: 503, message: "unavailable" });

    await expect(
      executeWithFallback(
        (provider, signal) => provider.analyzeImage({ base64Data: "x", mediaType: "image/jpeg" }, { signal }),
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
      (provider, signal) => provider.analyzeImage({ base64Data: "x", mediaType: "image/jpeg" }, { signal }),
      15_000,
      10_000,
      "test",
      [primary]
    );

    expect(result.provider).toBe("anthropic");
    expect(result.fallbackUsed).toBe(false);
  });

  it("preserves per-call independence (Call 2 retries Anthropic first even if Call 1 fell back)", async () => {
    const primary = createMockProvider("anthropic");
    const secondary = createMockProvider("openai");

    // Call 1: primary fails, secondary succeeds
    primary.analyzeImage.mockRejectedValueOnce({ status: 500, message: "down" });
    secondary.analyzeImage.mockResolvedValueOnce(mockResult);

    await executeWithFallback(
      (provider, signal) => provider.analyzeImage({ base64Data: "x", mediaType: "image/jpeg" }, { signal }),
      15_000,
      10_000,
      "call1",
      [primary, secondary]
    );

    // Call 2: primary is tried FIRST again (per-call independence)
    primary.verifyAndEnrich = jest.fn().mockResolvedValueOnce({ keyInfo: [] });

    const call2Result = await executeWithFallback(
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

    // Primary was called for Call 2 (not skipped because of Call 1 failure)
    expect(call2Result.provider).toBe("anthropic");
    expect(call2Result.fallbackUsed).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
npm test -- src/lib/__tests__/aiProvider.test.ts
```
Expected: FAIL — `aiProvider.ts` doesn't export these functions yet.

**Step 3: Implement the orchestrator**

Create `src/lib/aiProvider.ts`:

```typescript
// src/lib/aiProvider.ts
// Fallback orchestrator for multi-provider AI calls.
// Each AI call (image analysis, verification, price estimation) is independently
// wrapped with per-call fallback. If Anthropic fails on Call 2, we retry Call 2
// on OpenAI — we do NOT re-run Call 1.

import { AnthropicProvider } from "./providers/anthropic";
import { OpenAIProvider } from "./providers/openai";
import type {
  AIProvider,
  CallResult,
  ErrorReason,
  NON_RETRYABLE_ERRORS,
} from "./providers/types";
import { NON_RETRYABLE_ERRORS as NON_RETRYABLE } from "./providers/types";

// ── Safe Provider Construction ──
// Guard: missing API keys must NOT crash the app on cold start.
const providers: AIProvider[] = [
  ...(process.env.ANTHROPIC_API_KEY ? [new AnthropicProvider()] : []),
  ...(process.env.OPENAI_API_KEY ? [new OpenAIProvider()] : []),
];

if (providers.length === 0) {
  console.error(
    "[aiProvider] CRITICAL: No AI providers configured. All scans will fail."
  );
} else if (providers.length === 1) {
  console.warn(
    `[aiProvider] Only ${providers[0].name} configured. No fallback available.`
  );
}

/** Get the configured provider list (used by the analyze route) */
export function getProviders(): AIProvider[] {
  return providers;
}

// ── Error Classification ──

export function classifyError(error: unknown): ErrorReason {
  if (error instanceof DOMException && error.name === "TimeoutError")
    return "timeout";

  const status = (error as { status?: number })?.status;
  if (status === 400) return "bad_request";
  if (status === 401 || status === 403) return "auth_error";
  if (status === 404) return "model_not_found";
  if (status === 429) return "rate_limited";
  if (status && status >= 500) return "server_error";

  const message = (error as Error)?.message?.toLowerCase() || "";
  if (message.includes("content policy") || message.includes("safety"))
    return "content_policy";

  return "unknown";
}

// ── Dynamic Budget ──

const HARD_DEADLINE_MS = 25_000; // 1s safety before Netlify's 26s limit

export function getRemainingBudget(
  scanStartTime: number,
  reserveMs: number = 4000
): number {
  const elapsed = Date.now() - scanStartTime;
  return Math.max(0, HARD_DEADLINE_MS - elapsed - reserveMs);
}

// ── Per-Call Fallback ──

export async function executeWithFallback<T>(
  callFn: (provider: AIProvider, signal: AbortSignal) => Promise<T>,
  primaryTimeoutMs: number,
  fallbackTimeoutMs: number,
  callLabel: string,
  providerList: AIProvider[] = providers
): Promise<CallResult<T>> {
  let lastReason: ErrorReason | null = null;
  let lastRawError: string | null = null;

  for (let i = 0; i < providerList.length; i++) {
    const provider = providerList[i];
    const timeoutMs = i === 0 ? primaryTimeoutMs : fallbackTimeoutMs;
    const signal = AbortSignal.timeout(timeoutMs);

    try {
      const result = await callFn(provider, signal);
      return {
        result,
        provider: provider.name,
        fallbackUsed: i > 0,
        fallbackReason: i > 0 ? lastReason : null,
        fallbackRawError: i > 0 ? lastRawError : null,
      };
    } catch (error) {
      const reason = classifyError(error);
      const rawMessage =
        (error as Error)?.message?.slice(0, 200) || "unknown error";

      console.error(
        `[${provider.name}:${callLabel}] failed (${reason}): ${rawMessage}`
      );

      lastReason = reason;
      lastRawError = rawMessage;

      // Don't fallback for client errors — same input will fail on both providers
      if (NON_RETRYABLE.includes(reason)) {
        throw error;
      }

      // If this is the last provider, throw
      if (i === providerList.length - 1) {
        throw error;
      }

      // Otherwise, continue to next provider
    }
  }

  // Unreachable, but TypeScript needs this
  throw new Error(`All providers exhausted for ${callLabel}`);
}
```

**Step 4: Run tests**

Run:
```bash
npm test -- src/lib/__tests__/aiProvider.test.ts
```
Expected: All tests PASS.

**Step 5: Run all tests to check for regressions**

Run:
```bash
npm test
```
Expected: All existing tests PASS + new tests PASS.

**Step 6: Commit**

```bash
git add src/lib/aiProvider.ts src/lib/__tests__/aiProvider.test.ts
git commit -m "feat: build fallback orchestrator with per-call fallback and error classification"
```

---

### Task 6: Database Migration + Analytics Updates

**Files:**
- Create: `supabase/migrations/20260301_scan_analytics_provider.sql`
- Modify: `src/lib/analyticsServer.ts`
- Modify: `src/lib/__tests__/analyticsServer.test.ts`

**Step 1: Create the migration SQL**

Create `supabase/migrations/20260301_scan_analytics_provider.sql`:

```sql
-- Add provider tracking columns to scan_analytics
-- Part of Scan Resilience Phase 1: Multi-Provider Fallback
ALTER TABLE scan_analytics
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'anthropic',
  ADD COLUMN IF NOT EXISTS fallback_used boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fallback_reason text;
```

**Step 2: Write tests for provider-aware cost estimation**

Add to existing `src/lib/__tests__/analyticsServer.test.ts`:

```typescript
describe("estimateScanCostCents - provider awareness", () => {
  it("returns Anthropic costs by default", () => {
    const cost = estimateScanCostCents({
      metadataCacheHit: false,
      aiCallsMade: 1,
      ebayLookup: false,
    });
    expect(cost).toBe(1.5);
  });

  it("returns Anthropic costs when explicitly specified", () => {
    const cost = estimateScanCostCents({
      metadataCacheHit: false,
      aiCallsMade: 2,
      ebayLookup: true,
      provider: "anthropic",
    });
    expect(cost).toBe(1.5 + 0.6 + 0.15); // 2.25
  });

  it("returns lower OpenAI costs", () => {
    const cost = estimateScanCostCents({
      metadataCacheHit: false,
      aiCallsMade: 2,
      ebayLookup: true,
      provider: "openai",
    });
    expect(cost).toBe(1.2 + 0.4 + 0.15); // 1.75
  });

  it("returns 0 for 0 AI calls regardless of provider", () => {
    expect(
      estimateScanCostCents({ metadataCacheHit: false, aiCallsMade: 0, ebayLookup: false, provider: "openai" })
    ).toBe(0);
  });
});
```

**Step 3: Run tests to verify they fail**

Run:
```bash
npm test -- src/lib/__tests__/analyticsServer.test.ts
```
Expected: New tests FAIL because `estimateScanCostCents` doesn't accept `provider` yet.

**Step 4: Update analyticsServer.ts**

Update `src/lib/analyticsServer.ts`:

1. Add `provider`, `fallbackUsed`, `fallbackReason` to `ScanEventProperties`
2. Add `provider`, `fallback_used`, `fallback_reason` to `ScanAnalyticsRecord`
3. Make `estimateScanCostCents` provider-aware
4. Update `recordScanAnalytics` to insert the new columns

The updated `estimateScanCostCents`:

```typescript
// Per-provider cost constants (in cents)
const PROVIDER_COSTS = {
  anthropic: { imageAnalysis: 1.5, verification: 0.6, ebay: 0.15 },
  openai: { imageAnalysis: 1.2, verification: 0.4, ebay: 0.15 },
} as const;

export function estimateScanCostCents(params: {
  metadataCacheHit: boolean;
  aiCallsMade: number;
  ebayLookup: boolean;
  provider?: "anthropic" | "openai";
}): number {
  const c = PROVIDER_COSTS[params.provider || "anthropic"];
  let cost = 0;

  if (params.aiCallsMade >= 1) {
    cost += c.imageAnalysis;
  }
  if (params.aiCallsMade >= 2) {
    cost += (params.aiCallsMade - 1) * c.verification;
  }
  if (params.ebayLookup) {
    cost += c.ebay;
  }

  return Math.round(cost * 100) / 100;
}
```

The updated `ScanAnalyticsRecord` should add:

```typescript
  provider: string;
  fallback_used: boolean;
  fallback_reason: string | null;
```

The updated `recordScanAnalytics` should insert these 3 new columns with defaults:

```typescript
  provider: record.provider || "anthropic",
  fallback_used: record.fallback_used || false,
  fallback_reason: record.fallback_reason || null,
```

The updated `ScanEventProperties` should add:

```typescript
  provider: "anthropic" | "openai";
  fallbackUsed: boolean;
  fallbackReason: string | null;
```

**Step 5: Run tests**

Run:
```bash
npm test -- src/lib/__tests__/analyticsServer.test.ts
```
Expected: All tests PASS (existing + new).

**Step 6: Copy migration SQL to clipboard for Supabase**

Run:
```bash
cat "supabase/migrations/20260301_scan_analytics_provider.sql" | pbcopy
```

Tell the user: "Migration SQL copied to clipboard. Run this in the Supabase SQL Editor."

**Step 7: Commit**

```bash
git add supabase/migrations/20260301_scan_analytics_provider.sql src/lib/analyticsServer.ts src/lib/__tests__/analyticsServer.test.ts
git commit -m "feat: add provider tracking to scan analytics with provider-aware cost estimation"
```

---

### Task 7: Refactor Analyze Route

**Files:**
- Modify: `src/app/api/analyze/route.ts`

**Context:** This is the big task. Replace the 3 direct `anthropic.messages.create()` calls (at lines ~261, ~690, ~832) with `executeWithFallback()` calls. Add `_meta` field to the response. Add dynamic budget management. Preserve all 4 invariants from the design doc.

**INVARIANTS TO PRESERVE (from design doc):**
1. `incrementScanCount()` called ONCE per successful scan, AFTER final result — NOT in the fallback loop
2. Cache keys are provider-agnostic — no provider name in cache keys
3. Error responses never expose provider details — use "our comic recognition service"
4. Guest vs. free vs. premium logic is untouched — scan limits before AI, counts after AI

**Step 1: Update imports at top of file**

Replace the direct Anthropic SDK import and `MODEL_PRIMARY` import with the provider orchestrator:

```typescript
// REMOVE these:
// import Anthropic from "@anthropic-ai/sdk";
// import { MODEL_PRIMARY } from "@/lib/models";

// ADD these:
import { executeWithFallback, getRemainingBudget, getProviders } from "@/lib/aiProvider";
import type { ScanResponseMeta } from "@/lib/providers/types";
```

**Step 2: Remove the module-level Anthropic client**

Remove lines 76-78:
```typescript
// REMOVE:
// const anthropic = new Anthropic({
//   apiKey: process.env.ANTHROPIC_API_KEY,
// });
```

**Step 3: Replace Call 1 (Image Analysis, ~line 261)**

Replace the direct `anthropic.messages.create()` call with:

```typescript
const scanStartTime = Date.now();
const aiProviders = getProviders();

// Call 1: Image Analysis (REQUIRED)
const call1Timeout = Math.min(12_000, getRemainingBudget(scanStartTime));
const call1FallbackTimeout = Math.min(10_000, getRemainingBudget(scanStartTime));
const {
  result: imageResult,
  provider: p1,
  fallbackUsed: fb1,
  fallbackReason: fr1,
  fallbackRawError: fre1,
} = await executeWithFallback(
  (provider, signal) =>
    provider.analyzeImage({ base64Data, mediaType }, { signal }),
  call1Timeout,
  call1FallbackTimeout,
  "imageAnalysis",
  aiProviders
);
aiCallsMade++;
```

Then use `imageResult` fields instead of manually parsing JSON from the raw response. The JSON parsing, markdown stripping, etc. is now handled inside the provider.

**Step 4: Replace Call 2 (Verification, ~line 690)**

Replace the direct Anthropic call with:

```typescript
let verificationMeta = { provider: p1, fallbackUsed: false, fallbackReason: null as string | null };

if (needsAIVerification) {
  const call2Budget = getRemainingBudget(scanStartTime);
  if (call2Budget < 3000) {
    console.warn(`[scan] Skipping verification: only ${call2Budget}ms remaining`);
  } else {
    try {
      const { result: verifyResult, ...meta } = await executeWithFallback(
        (provider, signal) =>
          provider.verifyAndEnrich(
            {
              title: comicDetails.title || "",
              issueNumber: comicDetails.issueNumber || "",
              publisher: comicDetails.publisher,
              releaseYear: comicDetails.releaseYear,
              variant: comicDetails.variant,
              writer: comicDetails.writer,
              coverArtist: comicDetails.coverArtist,
              interiorArtist: comicDetails.interiorArtist,
              missingFields,
            },
            { signal }
          ),
        Math.min(8_000, call2Budget),
        Math.min(6_000, getRemainingBudget(scanStartTime)),
        "verification",
        aiProviders
      );
      verificationMeta = meta;
      aiCallsMade++;

      // Merge verification results — same logic as before, just using verifyResult
      if (!comicDetails.writer && verifyResult.writer) comicDetails.writer = verifyResult.writer;
      if (!comicDetails.coverArtist && verifyResult.coverArtist) comicDetails.coverArtist = verifyResult.coverArtist;
      if (!comicDetails.interiorArtist && verifyResult.interiorArtist) comicDetails.interiorArtist = verifyResult.interiorArtist;
      if (!comicDetails.publisher && verifyResult.publisher) comicDetails.publisher = verifyResult.publisher;
      if (!comicDetails.releaseYear && verifyResult.releaseYear) comicDetails.releaseYear = verifyResult.releaseYear;
      if (verifyResult.keyInfo?.length) comicDetails.keyInfo = [...comicDetails.keyInfo, ...verifyResult.keyInfo];
    } catch {
      // Continue with partial data — image analysis result is still valid
    }
  }
}
```

**Step 5: Replace Call 3 (Price Estimation, ~line 832)**

Replace the direct Anthropic call with:

```typescript
let priceMeta = { provider: p1, fallbackUsed: false, fallbackReason: null as string | null };

if (!priceDataFound) {
  const call3Budget = getRemainingBudget(scanStartTime);
  if (call3Budget < 3000) {
    console.warn(`[scan] Skipping price estimation: only ${call3Budget}ms remaining`);
  } else {
    try {
      const { result: priceResult, ...meta } = await executeWithFallback(
        (provider, signal) =>
          provider.estimatePrice(
            {
              title: comicDetails.title || "",
              issueNumber: comicDetails.issueNumber || "",
              publisher: comicDetails.publisher,
              releaseYear: comicDetails.releaseYear,
              grade: comicDetails.grade,
              gradingCompany: comicDetails.gradingCompany,
              isSlabbed: comicDetails.isSlabbed,
              isSignatureSeries: comicDetails.isSignatureSeries || false,
              signedBy: comicDetails.signedBy || null,
            },
            { signal }
          ),
        Math.min(8_000, call3Budget),
        Math.min(6_000, getRemainingBudget(scanStartTime)),
        "priceEstimation",
        aiProviders
      );
      priceMeta = meta;
      aiCallsMade++;

      // Process price result — same business logic as today
      // (filter sales, calculate estimated value, build PriceData)
    } catch {
      comicDetails.priceData = null;
    }
  }
}
```

**Step 6: Add `_meta` field to response**

Before the final `NextResponse.json()`, build the `_meta` object:

```typescript
const _meta: ScanResponseMeta = {
  provider: p1 as "anthropic" | "openai",
  fallbackUsed: fb1 || verificationMeta.fallbackUsed || priceMeta.fallbackUsed,
  fallbackReason: fr1 || verificationMeta.fallbackReason || priceMeta.fallbackReason,
  confidence: fb1 ? "medium" : (imageResult.confidence as "high" | "medium" | "low"),
  callDetails: {
    imageAnalysis: { provider: p1, fallbackUsed: fb1 },
    verification: needsAIVerification
      ? { provider: verificationMeta.provider, fallbackUsed: verificationMeta.fallbackUsed }
      : null,
    priceEstimation: !priceDataFound
      ? { provider: priceMeta.provider, fallbackUsed: priceMeta.fallbackUsed }
      : null,
  },
};

// Include _meta in the response
return NextResponse.json({ ...comicDetails, _meta });
```

**Step 7: Update analytics call to include provider info**

Update the `recordScanAnalytics()` and `trackScanServer()` calls to include the new fields:

```typescript
provider: p1 as "anthropic" | "openai",
fallback_used: fb1 || verificationMeta.fallbackUsed || priceMeta.fallbackUsed,
fallback_reason: fr1 || verificationMeta.fallbackReason || priceMeta.fallbackReason,
```

Also update the `estimateScanCostCents` call to pass the provider:

```typescript
const estimatedCost = estimateScanCostCents({
  metadataCacheHit,
  aiCallsMade,
  ebayLookup: ebayLookupMade,
  provider: p1 as "anthropic" | "openai",
});
```

**Step 8: Verify the API key early-exit guard is preserved**

The existing guard at the top of the route handler should remain:

```typescript
if (!process.env.ANTHROPIC_API_KEY) {
  return NextResponse.json(
    { error: "AI service not configured" },
    { status: 500 }
  );
}
```

This is the user-facing safety net. The provider construction guard in `aiProvider.ts` prevents cold-start crashes; this guard gives users a clear error message.

**Step 9: Run all tests**

Run:
```bash
npm test
```
Expected: All tests PASS.

**Step 10: Run TypeScript check**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 11: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat: refactor analyze route to use multi-provider fallback orchestrator"
```

---

### Task 8: Frontend "Taking Longer" Message + `_meta` Handling

**Files:**
- Modify: `src/app/scan/page.tsx`

**Step 1: Add "taking longer" timeout in scan page**

In `src/app/scan/page.tsx`, add state and effect for the slow message. Look for the `analyzing` state handling (around line 101+):

Add new state:
```typescript
const [showSlowMessage, setShowSlowMessage] = useState(false);
```

Add effect:
```typescript
useEffect(() => {
  if (status === "analyzing") {
    const timer = setTimeout(() => {
      setShowSlowMessage(true);
    }, 5000);
    return () => clearTimeout(timer);
  }
  setShowSlowMessage(false);
}, [status]);
```

**Step 2: Add the slow message to the analyzing UI**

In the JSX where the analyzing state is rendered (around lines 447-495), add below the existing loading message:

```tsx
{showSlowMessage && (
  <p className="text-sm text-gray-500 animate-pulse mt-2">
    Still working on it... taking a bit longer than usual.
  </p>
)}
```

**Step 3: Destructure `_meta` from response**

Find where the response JSON is parsed (around line 173):

```typescript
// BEFORE:
// const details = await response.json();
// const comicWithId = { ...details, id: uuidv4() };

// AFTER:
const { _meta, ...details } = await response.json();
const comicWithId = { ...details, id: uuidv4() };

// Use _meta for UX decisions
if (_meta?.fallbackUsed) {
  console.info("[scan] Fallback provider used:", _meta);
}
```

**Step 4: Run TypeScript check**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 5: Commit**

```bash
git add src/app/scan/page.tsx
git commit -m "feat: add 'taking longer' message and handle _meta from fallback provider"
```

---

### Task 9: Quality Checks

**Step 1: Run all tests**

Run:
```bash
npm test
```
Expected: All tests PASS (existing + all new provider/orchestrator tests).

**Step 2: Run TypeScript check**

Run:
```bash
npx tsc --noEmit
```
Expected: No type errors.

**Step 3: Run linter**

Run:
```bash
npm run lint
```
Expected: No lint errors.

**Step 4: Run build**

Run:
```bash
npm run build
```
Expected: Build succeeds.

**Step 5: Verify test count**

Run:
```bash
npm test 2>&1 | grep -E "Tests:|Test Suites:"
```
Expected: New test count should be higher than the previous 313 tests (we added tests for anthropic provider, openai provider, aiProvider orchestrator, and analytics provider-awareness).

---

## Post-Implementation Checklist

After all tasks are complete:

- [ ] Migration SQL run in Supabase production (`ALTER TABLE scan_analytics ADD COLUMN provider...`)
- [ ] `OPENAI_API_KEY` added to `.env.local` (local dev)
- [ ] `OPENAI_API_KEY` added to Netlify environment variables (production)
- [ ] Prompt comparison study completed (10-15 images, quality delta documented)
- [ ] Manual test: set `ANTHROPIC_API_KEY` to invalid → verify OpenAI fallback
- [ ] Manual test: both keys invalid → verify graceful error + "Enter Manually"
- [ ] Manual test: only `ANTHROPIC_API_KEY` set → verify app works without fallback
- [ ] Manual test: "taking longer" message appears after 5 seconds
- [ ] Manual test: verify `scan_analytics` records `provider` and `fallback_used` correctly
- [ ] Manual test: mobile (Android + iPhone)
