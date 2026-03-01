# Scan Resilience: Multi-Provider Fallback Design

**Date:** February 27, 2026
**Last Revised:** March 1, 2026 (Sr. Engineering Review #2 — 9 additional findings incorporated, 24 total)
**Status:** Approved — awaiting implementation
**Triggered by:** Production outage — `claude-sonnet-4-latest` model alias became invalid, breaking all scans with no fallback.

---

## Problem

Scanning depends entirely on Anthropic's API. If Anthropic is unavailable for any reason — model deprecation, alias changes, outages, rate limits, billing issues, API key problems — scanning is completely down. Users see "Our comic recognition service is temporarily busy" with no recovery path.

This is unacceptable for a production app. Scanning is the core feature.

## Design Goals

1. **Title + issue number must always be returned** — these are non-negotiable. Other fields (pricing, creators) can degrade gracefully.
2. **Reliability over complexity** — add whatever infrastructure is needed to ensure scans don't fail.
3. **Transparent to the user** — if fallback kicks in, show a "taking a bit longer than usual" message rather than an error. When results come from a fallback provider, include response metadata so the frontend can optionally prompt users to verify details.
4. **Invisible to the codebase** — only the AI provider layer knows about multiple providers. The rest of the app (scan limits, caching) stays unchanged.
5. **Per-call fallback granularity** — each independent AI call in the pipeline fails over individually. A failure in price estimation does not restart image analysis.
6. **Graceful degradation without the fallback provider** — the app must still function with only `ANTHROPIC_API_KEY` configured. Missing `OPENAI_API_KEY` disables the fallback chain but does not crash the app.

---

## Phased Rollout

### Phase 1 — Analyze Route Only (this document)

**Scope:** `/api/analyze/route.ts` — the cover scan endpoint. This is the highest-value, highest-risk route. It contains 3 independent AI calls (image analysis, verification, price estimation), handles vision input, and is the only feature users literally cannot work around if it goes down.

**Delivers:** Per-call provider fallback, timeout enforcement, circuit breaker (1b), analytics, response metadata.

### Phase 1b — Circuit Breaker

**Scope:** After core fallback is proven stable, add a Redis-backed circuit breaker to skip the primary provider entirely during sustained outages. Avoids wasting 12 seconds of timeout budget on a provider that is known to be down.

### Phase 2 — Text-Only Routes

**Scope:** `quick-lookup`, `comic-lookup`, `con-mode-lookup`, `import-lookup`, `hottest-books`. These are text-only — no images. They require a generic `textCompletion()` method on the provider interface, not `analyzeImage()`. Attempting to force them through the vision interface would be an architectural mistake.

**Why not Phase 1:** These routes are lower risk (most have cache layers or database fallbacks), and shoehorning them into a vision-only interface would delay the critical reliability improvement.

### Phase 3 — Additional Providers

**Scope:** Google Gemini as a third fallback, smart routing based on cost/latency, streaming status updates.

---

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/lib/aiProvider.ts` | Unified AI provider interface + fallback orchestration |
| `src/lib/providers/anthropic.ts` | Anthropic-specific implementation (extracted from analyze route) |
| `src/lib/providers/openai.ts` | OpenAI-specific implementation |
| `src/lib/providers/types.ts` | Shared types for provider interface |

### Modified Files

| File | Changes |
|------|---------|
| `src/app/api/analyze/route.ts` | Replace 3 direct Anthropic calls with provider-orchestrated calls. Remove JSON parsing (providers handle it internally). Add `_meta` field to response. |
| `src/lib/models.ts` | Extend to include OpenAI model config |
| `src/lib/analyticsServer.ts` | Add `provider` and `fallback_used` fields to `ScanAnalyticsRecord` and `ScanEventProperties`. Make `estimateScanCostCents` provider-aware. |
| `src/app/scan/page.tsx` | Add timeout-based "taking longer" message (5-second threshold) |
| `package.json` | Add `openai` SDK dependency |

### NOT Modified in Phase 1

| File | Reason |
|------|--------|
| `src/app/api/quick-lookup/route.ts` | Text-only route — Phase 2 |
| `src/app/api/comic-lookup/route.ts` | Text-only route — Phase 2 |
| `src/app/api/con-mode-lookup/route.ts` | Text-only route — Phase 2 |
| `src/app/api/import-lookup/route.ts` | Text-only route — Phase 2 (also: fix missing API key guard as pre-existing bug) |
| `src/app/api/hottest-books/route.ts` | Text-only route — Phase 2 |
| Scan limits, rate limiting, caching, barcode detection, eBay pricing | No changes needed |

### Pre-Existing Bug: import-lookup Missing API Key Guard

`/api/import-lookup/route.ts` instantiates `new Anthropic()` at module scope (line 9) and has no guard checking `process.env.ANTHROPIC_API_KEY` before making AI calls. If the key is missing, the request crashes instead of returning a meaningful error. This should be fixed during Phase 2 when the route is migrated to the provider interface, but it can also be patched independently as a one-line fix.

---

## The 3 AI Calls in the Analyze Route

The analyze route makes **3 distinct Anthropic calls**, each with a different purpose. Each can fail independently. The fallback design must wrap each call individually.

| # | Call | Type | Purpose | Model | Max Tokens | Can Skip? |
|---|------|------|---------|-------|------------|-----------|
| 1 | **Image Analysis** | Vision | Extract title, issue, publisher, variant, grading, barcode from cover photo | Sonnet | 1024 | No — this is the core scan |
| 2 | **Verification + Creators** | Text | Fill in missing creators, publisher, year, key info using comic knowledge | Sonnet | 384 | Yes — AI data only supplements |
| 3 | **Price Estimation** | Text | Generate estimated sale prices and grade-based estimates when eBay has no data | Sonnet | 512 | Yes — only runs when eBay lookup returns nothing |

### Per-Call Fallback Behavior

```
Call 1: Image Analysis (REQUIRED)
  ├─ Try Anthropic ──── success → continue to Call 2
  ├─ Anthropic fails → Try OpenAI ──── success → continue to Call 2
  └─ Both fail → Return error (scan cannot proceed without image analysis)

Call 2: Verification (OPTIONAL, runs if fields are missing)
  ├─ Try Anthropic ──── success → continue to Call 3
  ├─ Anthropic fails → Try OpenAI ──── success → continue to Call 3
  └─ Both fail → Continue with partial data (image analysis result still valid)

Call 3: Price Estimation (OPTIONAL, runs only if eBay has no data)
  ├─ Try Anthropic ──── success → attach price data
  ├─ Anthropic fails → Try OpenAI ──── success → attach price data
  └─ Both fail → Return null priceData (user sees "no pricing available")
```

**Key principle:** If Call 1 succeeds on Anthropic but Call 2 fails on Anthropic, we retry Call 2 on OpenAI. We do NOT re-run Call 1. Each call is an independent unit of work.

---

## Provider Interface

```typescript
// src/lib/providers/types.ts

import type {
  ComicDetails,
  BarcodeData,
  PriceData,
  GradeEstimate,
} from "@/types/comic";

// ── Request Types ──

interface ImageAnalysisRequest {
  base64Data: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
}

interface VerificationRequest {
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

interface PriceEstimationRequest {
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

/** Fields returned by Call 1 (image analysis). Derived from the actual ComicDetails interface. */
interface ImageAnalysisResult {
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
  gradingCompany: "CGC" | "CBCS" | "PGX" | "Other" | null;
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

interface VerificationResult {
  writer: string | null;
  coverArtist: string | null;
  interiorArtist: string | null;
  publisher: string | null;
  releaseYear: string | null;
  variant: string | null;
  keyInfo: string[];
}

interface PriceEstimationResult {
  recentSales: {
    price: number;
    date: string;
    source: string;
    daysAgo?: number;
  }[];
  gradeEstimates: GradeEstimate[];
  marketNotes: string;
}

// ── Call Options ──

interface CallOptions {
  signal?: AbortSignal;
}

// ── Provider Interface ──

interface AIProvider {
  readonly name: "anthropic" | "openai";

  /**
   * Phase 1: Vision-based cover analysis.
   * Provider is responsible for sending the prompt, calling the API,
   * parsing the JSON response, and returning a validated object.
   * JSON extraction/cleanup logic lives inside the provider, NOT in route handlers.
   */
  analyzeImage(req: ImageAnalysisRequest, opts?: CallOptions): Promise<ImageAnalysisResult>;

  /**
   * Phase 1: Text-based verification and creator lookup.
   * Same JSON ownership rules as analyzeImage.
   */
  verifyAndEnrich(req: VerificationRequest, opts?: CallOptions): Promise<VerificationResult>;

  /**
   * Phase 1: Text-based price estimation.
   * Same JSON ownership rules as analyzeImage.
   */
  estimatePrice(req: PriceEstimationRequest, opts?: CallOptions): Promise<PriceEstimationResult>;

  /**
   * Phase 2: Generic text completion for text-only routes.
   * Accepts a system instruction + user prompt, returns parsed JSON.
   * NOT implemented in Phase 1.
   */
  textCompletion<T>(prompt: string, maxTokens: number, opts?: CallOptions): Promise<T>;

  /**
   * Returns the estimated cost in cents for a single call of the given type.
   * Used by estimateScanCostCents to calculate provider-aware costs.
   */
  estimateCostCents(callType: "imageAnalysis" | "verification" | "priceEstimation"): number;
}
```

**Phase 2 note:** `textCompletion<T>` should require a Zod schema or validation function for runtime type safety, since AI responses may not match the expected type at runtime:
```typescript
textCompletion<T>(prompt: string, maxTokens: number, schema: z.ZodType<T>, opts?: CallOptions): Promise<T>;
```
This prevents silent type mismatches where the generic `T` passes TypeScript but fails at runtime.

### JSON Parsing Ownership

Each provider's methods own their JSON parsing internally. The duplicated pattern in the current codebase:

```typescript
// BEFORE: This pattern is repeated 6+ times in route handlers and will DOUBLE with 2 providers
let jsonText = textContent.text.trim();
if (jsonText.startsWith("```json")) jsonText = jsonText.slice(7);
if (jsonText.startsWith("```")) jsonText = jsonText.slice(3);
if (jsonText.endsWith("```")) jsonText = jsonText.slice(0, -3);
const parsed = JSON.parse(jsonText.trim());
```

```typescript
// AFTER: Each provider parses internally, route handlers get clean objects
// Inside AnthropicProvider.analyzeImage():
private parseJsonResponse(raw: string): unknown {
  let text = raw.trim();
  if (text.startsWith("```json")) text = text.slice(7);
  if (text.startsWith("```")) text = text.slice(3);
  if (text.endsWith("```")) text = text.slice(0, -3);
  return JSON.parse(text.trim());
}

// Inside OpenAIProvider (uses JSON mode — no markdown cleanup needed):
// OpenAI with response_format: { type: "json_object" } returns clean JSON directly
```

---

## Provider Implementations

### Anthropic Provider

Extract existing Anthropic logic from `analyze/route.ts` into `src/lib/providers/anthropic.ts`. Same prompts, same parsing, same model (`claude-sonnet-4-20250514`). No behavior change — just moved to its own module with JSON parsing internalized.

```typescript
// src/lib/providers/anthropic.ts (sketch)

import Anthropic from "@anthropic-ai/sdk";
import { MODEL_PRIMARY } from "@/lib/models";
import type { AIProvider, ImageAnalysisRequest, ImageAnalysisResult, CallOptions } from "./types";

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic" as const;
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async analyzeImage(req: ImageAnalysisRequest, opts?: CallOptions): Promise<ImageAnalysisResult> {
    const response = await this.client.messages.create({
      model: MODEL_PRIMARY,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: req.mediaType, data: req.base64Data },
            },
            { type: "text", text: IMAGE_ANALYSIS_PROMPT },
          ],
        },
      ],
    }, { signal: opts?.signal });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Anthropic image analysis");
    }

    return this.parseJsonResponse(textBlock.text) as ImageAnalysisResult;
  }

  // verifyAndEnrich() and estimatePrice() follow the same pattern

  estimateCostCents(callType: "imageAnalysis" | "verification" | "priceEstimation"): number {
    switch (callType) {
      case "imageAnalysis": return 1.5;   // ~$0.015
      case "verification": return 0.6;    // ~$0.006
      case "priceEstimation": return 0.6; // ~$0.006
    }
  }

  private parseJsonResponse(raw: string): unknown {
    let text = raw.trim();
    if (text.startsWith("```json")) text = text.slice(7);
    if (text.startsWith("```")) text = text.slice(3);
    if (text.endsWith("```")) text = text.slice(0, -3);
    return JSON.parse(text.trim());
  }
}
```

### OpenAI Provider

New implementation in `src/lib/providers/openai.ts`. Uses GPT-4o with vision. Key differences from Anthropic:

- OpenAI uses `messages` with `image_url` content type (base64 data URL)
- Response format: JSON mode (`response_format: { type: "json_object" }`) — no markdown cleanup needed
- Same extraction fields, same validation logic
- Provider self-reports its own cost per call type

```typescript
// src/lib/providers/openai.ts (sketch)

import OpenAI from "openai";
import { OPENAI_PRIMARY } from "@/lib/models";
import type { AIProvider, ImageAnalysisRequest, ImageAnalysisResult, CallOptions } from "./types";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async analyzeImage(req: ImageAnalysisRequest, opts?: CallOptions): Promise<ImageAnalysisResult> {
    const response = await this.client.chat.completions.create({
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
    }, { signal: opts?.signal });

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error("No response from OpenAI image analysis");

    // OpenAI JSON mode returns clean JSON — no markdown cleanup needed
    return JSON.parse(text) as ImageAnalysisResult;
  }

  // verifyAndEnrich() and estimatePrice() follow the same pattern

  estimateCostCents(callType: "imageAnalysis" | "verification" | "priceEstimation"): number {
    // GPT-4o pricing (different from Anthropic)
    switch (callType) {
      case "imageAnalysis": return 1.2;   // ~$0.012
      case "verification": return 0.4;    // ~$0.004
      case "priceEstimation": return 0.4; // ~$0.004
    }
  }
}
```

### Shared Prompts

Both providers receive the same core instruction set. Prompts are defined once in `src/lib/aiProvider.ts` and passed to each provider method. The prompts do not change between providers — only the API formatting differs.

```typescript
// src/lib/aiProvider.ts

// Shared prompt constants — used by both providers
export const IMAGE_ANALYSIS_PROMPT = `You are an expert comic book identifier...`; // Extracted from current route
export const VERIFICATION_PROMPT_TEMPLATE = (comic: VerificationRequest) => `...`;
export const PRICE_ESTIMATION_PROMPT_TEMPLATE = (comic: PriceEstimationRequest) => `...`;
```

---

## Timeout Budget

**Hard constraint:** Netlify serverless functions timeout at 26 seconds. The analyze route must complete within this window including all non-AI work (auth, caching, eBay lookup, barcode lookup, cert lookup, analytics).

### Budget Allocation

| Phase | Budget | Purpose |
|-------|--------|---------|
| Pre-AI pipeline | ~2s | Auth, rate limiting, scan limit check, image hash cache check |
| **AI Call 1** (image analysis) | **12s primary / 10s fallback** | The critical call. Must complete. |
| Barcode + cert lookup | ~2s | Database/API lookups (non-AI) |
| **AI Call 2** (verification) | **8s primary / 6s fallback** | Text-only, fast. Only runs if needed. |
| eBay lookup | ~2s | External API (non-AI) |
| **AI Call 3** (price estimation) | **8s primary / 6s fallback** | Text-only. Only runs if eBay has no data. |
| Post-AI pipeline | ~1s | Scan count increment, analytics, metadata cache save |

**Note on sequential vs. parallel:** Calls 2 and 3 cannot run in parallel because Call 3 needs to know whether eBay returned data first (eBay runs between Calls 2 and 3). However, Call 2 and the eBay lookup CAN run in parallel. This is an optimization opportunity.

### Implementation: AbortSignal.timeout()

```typescript
// Per-call timeout enforcement using AbortSignal

async function callWithTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    return await fn(signal);
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ProviderTimeoutError(`${label} timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// Usage in orchestrator:
const result = await callWithTimeout(
  (signal) => provider.analyzeImage(req, { signal }),
  isPrimary ? 12_000 : 10_000,
  `${provider.name}:analyzeImage`
);
```

Both provider implementations must accept and forward `AbortSignal` to their underlying SDK calls:

```typescript
// Anthropic supports abort signal natively:
await this.client.messages.create({ ... }, { signal });

// OpenAI supports abort signal natively:
await this.client.chat.completions.create({ ... }, { signal });
```

### Dynamic Budget Management

The static timeout budget above assumes each call completes within its allocation. In the worst case, all 3 calls could fallback — consuming far more than the 26-second Netlify limit. To handle this, track elapsed time dynamically and adjust downstream timeouts:

```typescript
// Dynamic budget: track elapsed time, adjust downstream timeouts
const HARD_DEADLINE_MS = 25_000; // 1s safety margin before Netlify's 26s

function getRemainingBudget(scanStartTime: number, reserveMs: number = 4000): number {
  const elapsed = Date.now() - scanStartTime;
  return Math.max(0, HARD_DEADLINE_MS - elapsed - reserveMs);
}

// Usage in analyze route:
const scanStartTime = Date.now();

// Call 1: Image analysis (gets full primary/fallback budget)
const call1Timeout = Math.min(12_000, getRemainingBudget(scanStartTime));
const analysis = await executeWithFallback(
  (provider, signal) => provider.analyzeImage(req, { signal }),
  { primaryTimeoutMs: call1Timeout, fallbackTimeoutMs: Math.min(10_000, getRemainingBudget(scanStartTime)) }
);

// Call 2: Verification (budget adjusted based on time spent so far)
const call2Budget = getRemainingBudget(scanStartTime);
if (call2Budget < 3000) {
  // Not enough time — skip optional verification
  console.warn('[scan] Skipping verification: only ${call2Budget}ms remaining');
} else {
  const verification = await executeWithFallback(
    (provider, signal) => provider.verifyAndEnrich(enrichReq, { signal }),
    { primaryTimeoutMs: Math.min(8_000, call2Budget), fallbackTimeoutMs: Math.min(6_000, getRemainingBudget(scanStartTime)) }
  );
}

// Call 3: Price estimation (same dynamic budget)
const call3Budget = getRemainingBudget(scanStartTime);
if (call3Budget < 3000) {
  console.warn('[scan] Skipping price estimation: only ${call3Budget}ms remaining');
} else {
  // ... same pattern
}
```

**Key insight:** If Call 1 uses the fallback provider (consuming ~22s worst case), Calls 2 and 3 will be automatically skipped rather than risking a Netlify timeout that returns no data at all. Returning title + issue number without price data is far better than returning nothing.

---

## Fallback Orchestration

```typescript
// src/lib/aiProvider.ts

import { AnthropicProvider } from "./providers/anthropic";
import { OpenAIProvider } from "./providers/openai";
import type { AIProvider } from "./providers/types";

// ── Safe Provider Construction ──
// Guard: missing API keys must NOT crash the app on cold start.
// Both providers are guarded — the app degrades gracefully to whatever is available.
const providers: AIProvider[] = [
  ...(process.env.ANTHROPIC_API_KEY ? [new AnthropicProvider()] : []),
  ...(process.env.OPENAI_API_KEY ? [new OpenAIProvider()] : []),
];

if (providers.length === 0) {
  console.error('[aiProvider] CRITICAL: No AI providers configured. All scans will fail.');
}

// ── Per-Call Fallback ──

interface CallResult<T> {
  result: T;
  provider: string;
  fallbackUsed: boolean;
  fallbackReason: string | null;
}

async function executeWithFallback<T>(
  callFn: (provider: AIProvider, signal: AbortSignal) => Promise<T>,
  primaryTimeoutMs: number,
  fallbackTimeoutMs: number,
  callLabel: string
): Promise<CallResult<T>> {

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const timeoutMs = i === 0 ? primaryTimeoutMs : fallbackTimeoutMs;
    const signal = AbortSignal.timeout(timeoutMs);

    try {
      const result = await callFn(provider, signal);
      return {
        result,
        provider: provider.name,
        fallbackUsed: i > 0,
        fallbackReason: null,
      };
    } catch (error) {
      const reason = classifyError(error);
      console.error(`[${provider.name}:${callLabel}] failed (${reason}):`, error);

      // Don't fallback for client errors — same input will fail on both providers
      if (reason === "bad_request" || reason === "content_policy") {
        throw error;
      }

      // If this is the last provider, throw
      if (i === providers.length - 1) {
        throw error;
      }

      // Otherwise, continue to next provider (log the reason for analytics)
    }
  }

  // Unreachable, but TypeScript needs this
  throw new Error(`All providers exhausted for ${callLabel}`);
}
```

### Error Classification

```typescript
type ErrorReason =
  | "model_not_found"   // 404 — fallback
  | "rate_limited"      // 429 — fallback
  | "server_error"      // 500/502/503 — fallback
  | "timeout"           // AbortSignal timeout — fallback
  | "auth_error"        // 401/403 — fallback (different API key)
  | "bad_request"       // 400 — do NOT fallback (same input will fail)
  | "content_policy"    // content moderation — do NOT fallback
  | "unknown";          // unexpected — fallback

function classifyError(error: unknown): ErrorReason {
  if (error instanceof DOMException && error.name === "TimeoutError") return "timeout";

  const status = (error as { status?: number })?.status;
  if (status === 400) return "bad_request";
  if (status === 401 || status === 403) return "auth_error";
  if (status === 404) return "model_not_found";
  if (status === 429) return "rate_limited";
  if (status && status >= 500) return "server_error";

  // Check for content policy messages
  const message = (error as Error)?.message?.toLowerCase() || "";
  if (message.includes("content policy") || message.includes("safety")) return "content_policy";

  return "unknown";
}
```

### Usage in the Analyze Route

```typescript
// In /api/analyze/route.ts — replacing the 3 direct anthropic.messages.create() calls

// Call 1: Image Analysis (REQUIRED)
const { result: imageResult, provider: p1, fallbackUsed: fb1, fallbackReason: fr1 } =
  await executeWithFallback(
    (provider, signal) => provider.analyzeImage({ base64Data, mediaType }, { signal }),
    12_000, // primary timeout
    10_000, // fallback timeout
    "imageAnalysis"
  );

// ... barcode lookup, cert lookup, metadata cache (unchanged) ...

// Call 2: Verification (OPTIONAL — try/catch, continue on failure)
let verificationMeta = { provider: p1, fallbackUsed: false, fallbackReason: null as string | null };
if (needsAIVerification) {
  try {
    const { result: verifyResult, ...meta } = await executeWithFallback(
      (provider, signal) => provider.verifyAndEnrich(verificationReq, { signal }),
      8_000,
      6_000,
      "verification"
    );
    verificationMeta = meta;
    // Merge verification results into comicDetails (same logic as today)
  } catch {
    // Continue with partial data — image analysis is still valid
  }
}

// ... eBay lookup (unchanged) ...

// Call 3: Price Estimation (OPTIONAL — only if eBay has no data)
let priceMeta = { provider: p1, fallbackUsed: false, fallbackReason: null as string | null };
if (!priceDataFound) {
  try {
    const { result: priceResult, ...meta } = await executeWithFallback(
      (provider, signal) => provider.estimatePrice(priceReq, { signal }),
      8_000,
      6_000,
      "priceEstimation"
    );
    priceMeta = meta;
    // Process price result (same business logic as today)
  } catch {
    comicDetails.priceData = null;
  }
}
```

---

## Invariants

These invariants MUST be preserved during the refactoring. Violating any of them is a correctness bug.

### 1. Scan Count Increments Exactly Once

```
INVARIANT: incrementScanCount() is called ONCE per successful scan, AFTER the final
result is assembled, regardless of how many provider attempts were made.
```

Current code (line ~1003 in route.ts) already does this correctly — it runs after all AI calls complete. The refactoring must not move this call into the fallback loop or into any per-call wrapper. If Anthropic fails on Call 1 and OpenAI succeeds, the user is charged 1 scan, not 2.

### 2. Cache Keys Are Provider-Agnostic

```
INVARIANT: Image hash cache keys, barcode cache keys, metadata cache keys, and eBay
price cache keys do NOT include the provider name. A result from Anthropic and a result
from OpenAI for the same image produce the same cache key and are interchangeable.
```

### 3. Error Responses Never Expose Provider Details

```
INVARIANT: User-facing error messages never mention "Anthropic", "OpenAI", "Claude",
or "GPT". They use generic language: "our comic recognition service."
```

### 4. Guest vs. Free vs. Premium Logic Is Untouched

```
INVARIANT: The provider fallback layer does not interact with subscription logic.
Scan limit checks happen BEFORE any AI calls. Scan count increments happen AFTER.
The provider layer exists entirely between these two boundaries.
```

---

## Response Metadata (_meta field)

When the fallback provider is used, results may be lower quality (especially for barcode reading and slab detection — see Prompt Compatibility below). The frontend should know this so it can optionally show a "verify details" prompt.

### API Response Shape

```typescript
// Added to the JSON response from /api/analyze
interface ScanResponseMeta {
  provider: "anthropic" | "openai";
  fallbackUsed: boolean;
  fallbackReason: string | null; // "timeout" | "rate_limited" | "server_error" | etc.
  confidence: "high" | "medium" | "low"; // Downgraded to "low" if fallback + known weak fields
  callDetails: {
    imageAnalysis: { provider: string; fallbackUsed: boolean };
    verification: { provider: string; fallbackUsed: boolean } | null;
    priceEstimation: { provider: string; fallbackUsed: boolean } | null;
  };
}

// Response:
{
  ...comicDetails,
  _meta: {
    provider: "openai",         // Which provider returned the primary (image analysis) result
    fallbackUsed: true,
    fallbackReason: "timeout",
    confidence: "medium",       // Downgraded because OpenAI is weaker at barcode reading
    callDetails: {
      imageAnalysis: { provider: "openai", fallbackUsed: true },
      verification: { provider: "anthropic", fallbackUsed: false },
      priceEstimation: { provider: "anthropic", fallbackUsed: false },
    }
  }
}
```

### Frontend Usage (Optional)

```typescript
// In scan results display — show a subtle prompt when results may be lower quality
if (result._meta?.fallbackUsed && result._meta?.confidence !== "high") {
  showToast("Results may need verification — double-check the details", "info");
}
```

### Frontend Handling: Destructuring `_meta`

The scan page must destructure `_meta` out before spreading the response into component state, to prevent it from being silently carried through the component tree and potentially written to the database:

```typescript
// In src/app/scan/page.tsx
const { _meta, ...details } = await response.json();
const comicWithId = { ...details, id: uuidv4() };
setComicDetails(comicWithId);

// Use _meta for UX decisions
if (_meta?.fallbackUsed) {
  setShowVerifyPrompt(true);
}
```

---

## Circuit Breaker (Phase 1b)

After the core fallback is working and deployed, add a Redis-backed circuit breaker to avoid wasting 12 seconds of timeout budget on a provider that is known to be down.

### Design

Uses Upstash Redis (already in the stack for rate limiting and caching).

```typescript
// Circuit breaker states:
// CLOSED (normal)  — all requests go to primary provider
// OPEN (tripped)   — skip primary, go directly to fallback
// HALF_OPEN (probe) — allow one request through to test if primary recovered

const CIRCUIT_BREAKER_KEY = "cb:anthropic:failures";
const FAILURE_THRESHOLD = 3;     // Trip after 3 consecutive failures
const FAILURE_WINDOW_SEC = 300;  // Within 5 minutes of the most recent failure (TTL resets on each failure)
const OPEN_DURATION_SEC = 60;    // Stay open for 1 minute before probing

async function getCircuitState(): Promise<"closed" | "open" | "half_open"> {
  const failures = await redis.get(CIRCUIT_BREAKER_KEY);
  if (!failures || parseInt(failures) < FAILURE_THRESHOLD) return "closed";

  const openedAt = await redis.get("cb:anthropic:opened_at");
  if (openedAt && Date.now() - parseInt(openedAt) > OPEN_DURATION_SEC * 1000) {
    return "half_open"; // Time to probe
  }

  return "open";
}

async function recordFailure(): Promise<void> {
  const count = await redis.incr(CIRCUIT_BREAKER_KEY);
  await redis.expire(CIRCUIT_BREAKER_KEY, FAILURE_WINDOW_SEC);

  if (count >= FAILURE_THRESHOLD) {
    await redis.set("cb:anthropic:opened_at", Date.now().toString(), { ex: OPEN_DURATION_SEC + 30 });
  }
}

async function recordSuccess(): Promise<void> {
  await redis.del(CIRCUIT_BREAKER_KEY);
  await redis.del("cb:anthropic:opened_at");
}
```

### Integration with Fallback Orchestrator

```typescript
async function executeWithFallback<T>(...) {
  const circuitState = await getCircuitState();

  if (circuitState === "open") {
    // Skip primary entirely — go straight to fallback
    console.warn(`[circuit-breaker] Anthropic circuit OPEN. Skipping to fallback.`);
    return executeOnFallbackOnly(callFn, fallbackTimeoutMs, callLabel);
  }

  // circuitState === "closed" or "half_open" — try primary
  // ... existing fallback logic ...
  // On primary failure: recordFailure()
  // On primary success: recordSuccess()
}
```

---

## Model Configuration

Update `src/lib/models.ts`:

```typescript
/**
 * Centralized model configuration for all AI providers.
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

---

## Environment Variables

New variables required:

| Variable | Purpose | Required? |
|----------|---------|-----------|
| `OPENAI_API_KEY` | OpenAI API key for fallback provider | **No** — app works without it, fallback is disabled |

### Construction Guard

```typescript
// In aiProvider.ts — safe provider list construction
const providers: AIProvider[] = [
  ...(process.env.ANTHROPIC_API_KEY ? [new AnthropicProvider()] : []),
  ...(process.env.OPENAI_API_KEY ? [new OpenAIProvider()] : []),
];

if (providers.length === 0) {
  console.error('[aiProvider] CRITICAL: No AI providers configured. All scans will fail.');
}
```

The app MUST boot and function normally with only `ANTHROPIC_API_KEY` configured. Both providers are guarded — each is only instantiated when its API key exists.

**Note:** The route-level API key check (`if (!process.env.ANTHROPIC_API_KEY)`) in `analyze/route.ts` should be preserved as an early-exit guard that returns a clear error to the user, while the provider-level guard here prevents crashes during module initialization. These are two distinct safety layers: the route guard gives users a helpful error message, the construction guard prevents cold-start crashes.

---

## Analytics & Monitoring

### Database Migration

Add columns to the existing `scan_analytics` table:

```sql
-- Migration: add provider tracking to scan_analytics
ALTER TABLE scan_analytics
  ADD COLUMN provider text DEFAULT 'anthropic',
  ADD COLUMN fallback_used boolean DEFAULT false,
  ADD COLUMN fallback_reason text;  -- Raw error classification + message for debugging fallback triggers
```

### Updated TypeScript Interfaces

```typescript
// src/lib/analyticsServer.ts

export interface ScanEventProperties {
  scanMethod: string;
  metadataCacheHit: boolean;
  redisCacheHit: boolean;
  supabaseCacheHit: boolean;
  aiCallsMade: number;
  ebayLookup: boolean;
  durationMs: number;
  estimatedCostCents: number;
  success: boolean;
  userId?: string;
  subscriptionTier?: string;
  // NEW: Provider tracking
  provider: "anthropic" | "openai";
  fallbackUsed: boolean;
  fallbackReason: string | null;
}

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
  // NEW: Provider tracking
  provider: string;
  fallback_used: boolean;
  fallback_reason: string | null; // Error classification + raw message (truncated to 200 chars)
}
```

### Provider-Aware Cost Estimation

**Note on failed-scan cost estimates:** When a scan fails after attempting multiple providers, the cost estimate is approximate. A fully-failed scan may have consumed partial credits on both Anthropic (which failed) and OpenAI (which also failed). The estimate uses the Anthropic rate as a conservative upper bound. For precise cost tracking of failed multi-provider attempts, check provider billing dashboards directly.

```typescript
// Updated estimateScanCostCents — now provider-aware

export function estimateScanCostCents(params: {
  metadataCacheHit: boolean;
  aiCallsMade: number;
  ebayLookup: boolean;
  provider?: "anthropic" | "openai"; // NEW
}): number {
  const provider = params.provider || "anthropic";

  // Per-provider cost constants (in cents)
  const costs = {
    anthropic: { imageAnalysis: 1.5, verification: 0.6, ebay: 0.15 },
    openai:    { imageAnalysis: 1.2, verification: 0.4, ebay: 0.15 },
  };

  const c = costs[provider];
  let cost = 0;

  if (params.aiCallsMade >= 1) cost += c.imageAnalysis;
  if (params.aiCallsMade >= 2) cost += (params.aiCallsMade - 1) * c.verification;
  if (params.ebayLookup) cost += c.ebay;

  return Math.round(cost * 100) / 100;
}
```

### Updated recordScanAnalytics

```typescript
export async function recordScanAnalytics(record: ScanAnalyticsRecord): Promise<void> {
  try {
    await supabaseAdmin.from("scan_analytics").insert({
      profile_id: record.profile_id,
      scan_method: record.scan_method,
      estimated_cost_cents: record.estimated_cost_cents,
      ai_calls_made: record.ai_calls_made,
      metadata_cache_hit: record.metadata_cache_hit,
      ebay_lookup: record.ebay_lookup,
      duration_ms: record.duration_ms,
      success: record.success,
      subscription_tier: record.subscription_tier,
      error_type: record.error_type || null,
      // NEW
      provider: record.provider || "anthropic",
      fallback_used: record.fallback_used || false,
      fallback_reason: record.fallback_reason || null,
    });
  } catch (err) {
    console.error("Failed to record scan analytics:", err);
  }
}
```

### Sentry Alerts

- If fallback usage exceeds 10% of scans in a 1-hour window, trigger an alert. This means the primary provider has a systemic issue.
- If circuit breaker trips, send an immediate alert with context (last N error messages).

### PostHog Events

```typescript
// Additional properties on scan_completed_server event
{
  provider: "anthropic" | "openai",
  fallbackUsed: boolean,
  fallbackReason: string | null,       // "timeout" | "rate_limited" | "server_error" | etc.
  primaryErrorStatus: number | null,   // HTTP status of primary failure, if any
  primaryErrorMessage: string | null,  // Raw error message (truncated to 200 chars) for debugging
  callDetails: { ... },                // Per-call provider breakdown
}
```

### Raw Error Logging for Fallback Debugging

When fallback is triggered, log the primary provider's raw error message (truncated to 200 characters) alongside the error classification. The classification (`rate_limited`, `model_not_found`) helps with aggregation, but the raw message helps with debugging: a 503 with `overloaded_error` vs. 503 with `internal_server_error` indicates different root causes.

Store this in both the `scan_analytics` record and as Sentry breadcrumb context:

```typescript
// In executeWithFallback, when primary fails and fallback begins:
const rawMessage = (error as Error)?.message?.slice(0, 200) || "unknown";
console.error(`[${provider.name}:${callLabel}] failed (${reason}): ${rawMessage}`);

// Pass to analytics
fallbackReason: reason,
fallbackRawError: rawMessage,  // truncated to 200 chars

// Add as Sentry breadcrumb
Sentry.addBreadcrumb({
  category: "ai-fallback",
  message: `Primary failed: ${reason} — ${rawMessage}`,
  level: "warning",
});
```

---

## Frontend: "Taking Longer" UX

When the primary provider fails and fallback is attempted, the user waits longer. Use a simple timeout-based message — no special headers, no streaming.

```typescript
// In scan/page.tsx during analyzing state
useEffect(() => {
  if (status === "analyzing") {
    const timer = setTimeout(() => {
      setShowSlowMessage(true);
    }, 5000);
    return () => clearTimeout(timer);
  }
  setShowSlowMessage(false);
}, [status]);

// Render:
{showSlowMessage && (
  <p className="text-sm text-gray-500 animate-pulse">
    Still working on it... taking a bit longer than usual.
  </p>
)}
```

This is simple, requires no API changes, and covers the fallback case naturally since fallback adds 3-10 seconds.

---

## Prompt Compatibility & Validation

GPT-4o may produce significantly different quality results from Claude, especially for:
- **Barcode reading** — Claude has shown stronger OCR capabilities on small, noisy text
- **Slab detection** — reading CGC/CBCS labels through reflective plastic cases
- **Grading detail extraction** — labelType, pageQuality, graderNotes from grading labels

### Pre-Implementation Validation (Required)

Before writing production code, run a validation study:

1. **Select 10-15 sample comic images** covering:
   - Raw comics with visible barcodes (3-4 images)
   - CGC slabbed comics (3-4 images)
   - CBCS slabbed comics (2 images)
   - Variant covers with subtle numbering (2-3 images)
   - Low-quality/blurry photos (2 images)

2. **Run each image through both providers** with the identical `IMAGE_ANALYSIS_PROMPT`.

3. **Score each response** on:
   - Title + issue number accuracy (critical)
   - Barcode digit accuracy (important)
   - Slab detection accuracy (important)
   - Creator identification (nice-to-have)

4. **Document the quality delta** in a results table. Example:

   | Field | Anthropic Accuracy | OpenAI Accuracy | Delta |
   |-------|-------------------|-----------------|-------|
   | Title | 95% | 92% | -3% |
   | Issue Number | 97% | 94% | -3% |
   | Barcode (all digits) | 85% | 60% | -25% |
   | Slab Detection | 90% | 80% | -10% |

5. **Decision rules based on results:**
   - If OpenAI is notably worse at barcode reading: when the fallback provider is used, set `barcode.confidence` to `"low"` regardless of what the model reports.
   - If OpenAI is notably worse at slab detection: add a field-level confidence indicator and set the `_meta.confidence` to `"medium"` or `"low"`.
   - If OpenAI cannot reliably extract a field: return `null` for that field rather than returning incorrect data.

**This validation MUST happen before the fallback is deployed to production.** Bad data from a fallback provider is worse than no data.

---

## Cost Impact

| Scenario | Anthropic Cost | OpenAI Cost | Total |
|----------|---------------|-------------|-------|
| Normal — all 3 calls on Anthropic | ~$0.027 | $0 | ~$0.027 |
| Call 1 fallback to OpenAI, Calls 2-3 on Anthropic | ~$0.012 (calls 2+3) | ~$0.012 (call 1) | ~$0.024 |
| All 3 calls fallback to OpenAI | $0 | ~$0.020 | ~$0.020 |
| Both fail on all calls | $0 (failed calls may still incur partial cost) | $0 | ~$0 |

**Expected fallback rate:** <1% under normal conditions. Only triggered during provider outages. Negligible cost impact.

**Double-charge prevention:** See Invariant #1 — scan count increments exactly once regardless of retry count.

---

## Operational Runbook: Total Provider Outage

What to do when both Anthropic and OpenAI are unavailable simultaneously.

### Detection

- Sentry alert spike — scan errors jump to 100%
- Circuit breaker opens for all providers
- `scan_analytics` shows 0 successful scans over a sustained period
- User reports of scanning failures

### User Experience

Users see the standard error message with an **"Enter Manually"** button — they can still add comics by typing details directly. Scanning is the only feature affected; collection browsing, following, messaging, and all other features continue working normally.

### Immediate Response

1. **Check provider status pages:**
   - Anthropic: [status.anthropic.com](https://status.anthropic.com)
   - OpenAI: [status.openai.com](https://status.openai.com)
2. **Verify billing on both accounts** — ensure neither account has been suspended or has exhausted prepaid credits
3. **Check API key validity** — keys may have been rotated or revoked
4. **Review Sentry errors** — confirm the failure is provider-side, not a bug in our code (e.g., malformed requests)

### Escalation

- If both providers are genuinely down, post a **status banner** on the site informing users that scanning is temporarily unavailable
- Consider fast-tracking **Phase 3 (Gemini)** if the outage persists beyond 4 hours
- If only one provider is down, the system is already handling it via fallback — no action needed

### Recovery

- When providers come back online, the **circuit breaker auto-recovers** via the HALF_OPEN state — no manual intervention required
- Monitor `scan_analytics` for normal success rates returning before removing any status banner
- Review the outage timeline and update this runbook with any lessons learned

---

## Testing Strategy

### Pre-Implementation: Prompt Comparison Study

See "Prompt Compatibility & Validation" section above. This is a manual step that produces a results document used to calibrate the fallback provider's confidence levels.

### Unit Tests

**`src/lib/__tests__/aiProvider.test.ts`** — Fallback orchestration:
- Primary succeeds on first try → returns result, `fallbackUsed: false`
- Primary fails with 500 → retries on fallback, `fallbackUsed: true`
- Primary fails with 400 (bad request) → does NOT fallback, throws error
- Primary fails with content policy → does NOT fallback, throws error
- Primary times out → retries on fallback within timeout budget
- Both providers fail → throws last error with combined context
- Only one provider configured → works without fallback, throws on failure
- Circuit breaker OPEN → skips primary, goes directly to fallback

**`src/lib/__tests__/aiProvider.test.ts`** — Per-call independence:
- Call 1 fails on Anthropic, succeeds on OpenAI. Call 2 tries Anthropic first (not OpenAI).
- Call 1 succeeds on Anthropic. Call 2 fails on both. Call 3 still attempts both providers.

**`src/lib/providers/__tests__/anthropic.test.ts`** — Anthropic-specific:
- JSON response parsing (with and without markdown code blocks)
- All 3 method signatures produce valid typed results
- AbortSignal timeout is forwarded to SDK call
- Cost estimation returns correct values per call type

**`src/lib/providers/__tests__/openai.test.ts`** — OpenAI-specific:
- JSON mode response parsing (clean JSON, no markdown)
- All 3 method signatures produce valid typed results
- AbortSignal timeout is forwarded to SDK call
- Cost estimation returns correct values per call type

**`src/lib/__tests__/analyticsServer.test.ts`** — Analytics:
- `estimateScanCostCents` returns different values for `provider: "anthropic"` vs `provider: "openai"`
- `ScanAnalyticsRecord` includes `provider` and `fallback_used` fields

### Integration Tests (Manual)

- Set `ANTHROPIC_API_KEY` to invalid value → verify OpenAI fallback handles all 3 calls
- Set both keys to invalid → verify graceful error with "Enter Manually" option
- Set `OPENAI_API_KEY` to empty → verify app boots and works with Anthropic only
- Verify "taking longer" message appears after 5 seconds
- Verify `_meta` field is present in response when fallback is used
- Verify scan count is incremented exactly once (check `scan_analytics` table)
- Verify `scan_analytics.provider` and `scan_analytics.fallback_used` are populated
- Test on mobile (Android + iPhone)

---

## Rollout Plan

### Phase 1 — Core Fallback (Analyze Route)

1. **Run prompt comparison study** — 10-15 images through both providers, document quality delta
2. **Set up OpenAI account** — create API key, add billing, test vision API works
3. **Create provider interface and types** — `src/lib/providers/types.ts`
4. **Implement Anthropic provider** — extract from analyze route into `src/lib/providers/anthropic.ts`
5. **Implement OpenAI provider** — new implementation in `src/lib/providers/openai.ts`
6. **Build fallback orchestrator** — `src/lib/aiProvider.ts` with per-call fallback, timeout enforcement, error classification
7. **Run database migration** — add `provider` and `fallback_used` columns to `scan_analytics`
8. **Update analytics** — `ScanAnalyticsRecord`, `ScanEventProperties`, `estimateScanCostCents` with provider awareness
9. **Refactor analyze route** — replace 3 direct Anthropic calls with orchestrated calls, add `_meta` field to response
10. **Add frontend "taking longer" message** — timeout-based approach in `scan/page.tsx`
11. **Write tests** — unit tests for fallback logic, provider parsing, analytics
12. **Deploy** — add `OPENAI_API_KEY` to Netlify env vars first, then push code
13. **Verify in production** — test by temporarily breaking Anthropic key

### Phase 1b — Circuit Breaker

14. **Implement circuit breaker** — Redis-backed state machine using Upstash
15. **Integrate with orchestrator** — skip primary when circuit is OPEN
16. **Add Sentry alerts** — alert on circuit trip

### Phase 2 — Text-Only Routes

17. **Add `textCompletion<T>()` method** to provider interface
18. **Implement in both providers** — Anthropic and OpenAI generic text completion
19. **Migrate text-only routes** — quick-lookup, comic-lookup, con-mode-lookup, import-lookup, hottest-books
20. **Fix import-lookup API key guard** — pre-existing bug
21. **Update analytics** — provider tracking for text-only routes

---

## Future Enhancements (Out of Scope)

- **Streaming status updates** — replace timeout-based message with real-time progress via SSE
- **Smart routing** — route to the cheaper/faster provider based on image complexity or call type
- **Additional providers** — Google Gemini as a third fallback
- **Client-side barcode scanning** — extract barcode without AI as an additional non-AI fast path
- **A/B testing providers** — route a percentage of traffic to OpenAI to continuously measure quality delta
