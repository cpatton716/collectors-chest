# Scan Resilience: Multi-Provider Fallback Design

**Date:** February 27, 2026
**Status:** Approved — awaiting implementation
**Triggered by:** Production outage — `claude-sonnet-4-latest` model alias became invalid, breaking all scans with no fallback.

---

## Problem

Scanning depends entirely on Anthropic's API. If Anthropic is unavailable for any reason — model deprecation, alias changes, outages, rate limits, billing issues, API key problems — scanning is completely down. Users see "Our comic recognition service is temporarily busy" with no recovery path.

This is unacceptable for a production app. Scanning is the core feature.

## Design Goals

1. **Title + issue number must always be returned** — these are non-negotiable. Other fields (pricing, creators) can degrade gracefully.
2. **Reliability over complexity** — add whatever infrastructure is needed to ensure scans don't fail.
3. **Transparent to the user** — if fallback kicks in, show a "taking a bit longer than usual" message rather than an error.
4. **Invisible to the codebase** — only the AI provider layer knows about multiple providers. The rest of the app (analyze route, scan limits, caching) stays unchanged.

## Approach: Multi-Provider Fallback Chain

Add OpenAI GPT-4o as a secondary vision provider. If Anthropic fails for any reason, automatically retry with OpenAI using the same image and a compatible prompt.

### Flow

```
User snaps photo / uploads image
            ↓
      /api/analyze
            ↓
   aiProvider.analyzeComicCover(image)
            ↓
   ┌─ Try Anthropic (Sonnet) ────── success → return results
   │
   ├─ Anthropic fails (any error)
   │     ├─ Log error + provider to Sentry
   │     ├─ Set response header: x-scan-retry: true
   │     │   (frontend shows "Taking a bit longer than usual...")
   │     └─ Try OpenAI (GPT-4o) ──── success → return results
   │
   └─ Both fail
         ├─ Return best partial data if any
         └─ Return actionable error with "Enter Manually" option
```

### Latency Budget

- Primary (Anthropic): ~3-5 seconds typical
- Fallback (OpenAI): ~3-5 seconds additional
- Total worst case: ~10-15 seconds (user sees progress message)
- Hard timeout: 25 seconds (Netlify function limit is 26s)

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
| `src/app/api/analyze/route.ts` | Replace direct Anthropic calls with `aiProvider.analyzeComicCover()` |
| `src/app/api/quick-lookup/route.ts` | Replace direct Anthropic calls with provider interface |
| `src/app/api/comic-lookup/route.ts` | Replace direct Anthropic calls with provider interface |
| `src/app/api/con-mode-lookup/route.ts` | Replace direct Anthropic calls with provider interface |
| `src/app/api/import-lookup/route.ts` | Replace direct Anthropic calls with provider interface |
| `src/app/api/hottest-books/route.ts` | Replace direct Anthropic calls with provider interface |
| `src/app/scan/page.tsx` | Handle `x-scan-retry` header to show "taking longer" message |
| `src/lib/models.ts` | Extend to include OpenAI model config |
| `package.json` | Add `openai` SDK dependency |

### Unchanged

- Scan limits, rate limiting, caching, barcode detection, eBay pricing — all stay the same
- Guest vs free vs premium logic — unchanged
- PostHog analytics — unchanged (add `provider` field to track which was used)

---

## Provider Interface

```typescript
// src/lib/providers/types.ts

interface ComicAnalysisRequest {
  base64Data: string;
  mediaType: string; // "image/jpeg" | "image/png"
}

interface ComicAnalysisResult {
  title: string | null;
  issueNumber: string | null;
  publisher: string | null;
  variant: string | null;
  writer: string | null;
  coverArtist: string | null;
  interiorArtist: string | null;
  releaseYear: string | null;
  confidence: "high" | "medium" | "low";
  isSlabbed: boolean;
  gradingCompany: string | null;
  grade: string | null;
  certificationNumber: string | null;
  isSignatureSeries: boolean;
  signedBy: string | null;
  barcode: BarcodeInfo | null;
}

interface AIProvider {
  name: string; // "anthropic" | "openai"
  analyzeImage(req: ComicAnalysisRequest): Promise<ComicAnalysisResult>;
  estimatePrice(comic: ComicDetails): Promise<PriceEstimate>;
  verifyMetadata(comic: ComicDetails, missingFields: string[]): Promise<Partial<ComicDetails>>;
}
```

---

## Provider Implementations

### Anthropic Provider

Extract existing Anthropic logic from `analyze/route.ts` into `src/lib/providers/anthropic.ts`. Same prompt, same parsing, same model (`claude-sonnet-4-20250514`). No behavior change — just moved to its own module.

### OpenAI Provider

New implementation in `src/lib/providers/openai.ts`. Uses GPT-4o with vision. Prompt adapted to match the same output JSON schema. Key differences:
- OpenAI uses `messages` with `image_url` content type (base64 data URL)
- Response format: request JSON mode (`response_format: { type: "json_object" }`)
- Same extraction fields, same validation logic

### Prompt Compatibility

Both providers receive the same core instruction set:
- Extract title, issue number, publisher, variant, creators, year
- Read barcode digits with confidence level
- Detect grading labels (CGC/CBCS/PGX)
- Return JSON with defined schema

The prompt text will be shared (defined once in `aiProvider.ts`), with minor formatting adjustments per provider's API shape.

---

## Fallback Orchestration

```typescript
// src/lib/aiProvider.ts (simplified)

const providers: AIProvider[] = [
  new AnthropicProvider(),  // Primary
  new OpenAIProvider(),     // Fallback
];

async function analyzeComicCover(
  req: ComicAnalysisRequest
): Promise<{ result: ComicAnalysisResult; provider: string; fallbackUsed: boolean }> {

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    try {
      const result = await provider.analyzeImage(req);
      return {
        result,
        provider: provider.name,
        fallbackUsed: i > 0,
      };
    } catch (error) {
      // Log which provider failed and why
      console.error(`[${provider.name}] failed:`, error);
      captureException(error, { provider: provider.name });

      // If this is the last provider, throw
      if (i === providers.length - 1) {
        throw error;
      }
      // Otherwise, continue to next provider
    }
  }
}
```

### Error Categorization

Not all errors should trigger fallback. Categorize before deciding:

| Error Type | Action |
|------------|--------|
| Model not found (404) | Fallback to next provider |
| Rate limited (429) | Fallback to next provider |
| Server error (500/502/503) | Fallback to next provider |
| Timeout | Fallback to next provider |
| Auth error (401/403) | Fallback to next provider (different API key) |
| Invalid request (400) | Do NOT fallback (same image will fail on both) — return error |
| Content policy violation | Do NOT fallback — return appropriate user message |

---

## Frontend: "Taking Longer" UX

When the primary provider fails and fallback is attempted, the API response includes a header:

```
x-scan-fallback: true
```

But since the fallback happens server-side before the response, the frontend needs a different mechanism. Two options:

### Option A: Streaming status (recommended for future)
Use Server-Sent Events or streaming response to send status updates. Complex but best UX.

### Option B: Timeout-based message (simpler, implement first)
If the scan takes longer than 5 seconds, the frontend shows:

> "Still working on it... taking a bit longer than usual."

This is simple, requires no API changes, and covers the fallback case naturally since fallback adds ~3-5 seconds.

**Implementation:** Add a `setTimeout` in `scan/page.tsx` that triggers after 5 seconds during the `analyzing` state. Clear it when the response arrives.

```typescript
// In scan/page.tsx during analyzing state
useEffect(() => {
  if (status === 'analyzing') {
    const timer = setTimeout(() => {
      setShowSlowMessage(true);
    }, 5000);
    return () => clearTimeout(timer);
  }
  setShowSlowMessage(false);
}, [status]);
```

---

## Model Configuration

Update `src/lib/models.ts`:

```typescript
// Anthropic models
export const ANTHROPIC_PRIMARY = "claude-sonnet-4-20250514";
export const ANTHROPIC_LIGHTWEIGHT = "claude-haiku-4-5-20251001";

// OpenAI models (fallback)
export const OPENAI_PRIMARY = "gpt-4o";
export const OPENAI_LIGHTWEIGHT = "gpt-4o-mini";

// Provider order (first = primary, rest = fallbacks)
export const VISION_PROVIDER_ORDER = ["anthropic", "openai"] as const;
```

---

## Environment Variables

New variables required:

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | OpenAI API key for fallback provider |

Must be added to both `.env.local` and Netlify environment variables before deployment.

---

## Analytics & Monitoring

Track which provider handled each scan:

```typescript
// PostHog event payload additions
{
  provider: "anthropic" | "openai",
  fallbackUsed: boolean,
  fallbackReason: string | null,  // e.g., "model_not_found", "rate_limited", "timeout"
  primaryErrorStatus: number | null,
}
```

**Sentry alerts:** If fallback usage exceeds 10% of scans in a 1-hour window, trigger an alert. This means the primary provider has a systemic issue that needs investigation.

---

## Testing Strategy

### Unit Tests
- `src/lib/__tests__/aiProvider.test.ts` — test fallback chain logic:
  - Primary succeeds → returns primary result, `fallbackUsed: false`
  - Primary fails with 404 → falls back to secondary, `fallbackUsed: true`
  - Primary fails with 400 (bad request) → does NOT fallback, throws error
  - Both fail → throws last error
  - Provider response parsing (both Anthropic and OpenAI formats)

- `src/lib/providers/__tests__/anthropic.test.ts` — test Anthropic-specific parsing
- `src/lib/providers/__tests__/openai.test.ts` — test OpenAI-specific parsing

### Manual Tests
- Temporarily set `ANTHROPIC_API_KEY` to invalid value → verify OpenAI fallback works
- Set both keys to invalid → verify graceful error with "Enter Manually" option
- Verify "taking longer" message appears after 5 seconds
- Verify scan results are identical quality from both providers
- Test on mobile (Android + iPhone)

---

## Cost Impact

| Scenario | Cost |
|----------|------|
| Normal (Anthropic succeeds) | ~$0.015/scan (no change) |
| Fallback (OpenAI used) | ~$0.01-0.02/scan (comparable) |
| Both fail | $0 (no successful API call) |

**Expected fallback rate:** <1% under normal conditions. Only triggered during provider outages or issues. Negligible cost impact.

---

## Rollout Plan

1. **Set up OpenAI account** — create API key, add billing, test vision API works
2. **Implement provider interface** — extract Anthropic logic, add OpenAI provider
3. **Wire up fallback chain** — orchestration layer with error categorization
4. **Update all API routes** — swap direct Anthropic calls for provider interface
5. **Add frontend "taking longer" message** — timeout-based approach
6. **Add analytics tracking** — provider field in PostHog events
7. **Write tests** — unit tests for fallback logic and response parsing
8. **Deploy** — add `OPENAI_API_KEY` to Netlify first, then push code
9. **Verify** — test by temporarily breaking Anthropic key on staging

---

## Future Enhancements (Out of Scope)

- **Streaming status updates** — replace timeout-based message with real-time progress via SSE
- **Provider health checks** — periodic ping to detect outages before users hit them
- **Smart routing** — route to the cheaper/faster provider based on image complexity
- **Additional providers** — Google Gemini as a third fallback
- **Client-side barcode scanning** — extract barcode without AI as an additional non-AI fast path
