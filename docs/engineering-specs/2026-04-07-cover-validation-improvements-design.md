# Cover Validation: Distinguish "No Cover" from "Unavailable" + Error Path Tests

**Date:** April 7, 2026
**Status:** Design approved
**Backlog Items:** #7 (Cover Validation: Test Coverage for Error Paths), #8 (Cover Validation: Distinguish "No Cover" from "Unavailable")

---

## Problem

The cover image validation pipeline returns `{ coverUrl: null, coverSource: null }` for every failure mode — whether Gemini is rate-limited, the API key is missing, no candidate images were found, or all candidates were rejected. Callers cannot distinguish transient failures (retry later) from definitive results (no cover exists).

## Solution

Add a `validated` boolean field to `CoverPipelineResult` and write comprehensive tests for all error paths.

## Type Change

```typescript
export interface CoverPipelineResult {
  coverUrl: string | null;
  coverSource: "community" | "ebay" | "openlibrary" | "metron" | "comicvine" | null;
  validated: boolean; // NEW
}
```

### Semantics

| coverUrl | validated | Meaning |
|----------|-----------|---------|
| `"https://..."` | `true` | Cover found and validated |
| `null` | `true` | Pipeline completed — no valid cover exists (definitive) |
| `null` | `false` | Gemini unavailable/rate-limited — should retry later (transient) |

### When `validated` is `true`:
- Community cover found (trusted source, no Gemini needed)
- All candidates checked by Gemini, none passed
- No candidates found from any source (eBay, Open Library)
- Gemini returned "NO" or "ambiguous" for all candidates

### When `validated` is `false`:
- Gemini API key missing
- Gemini rate-limited (429)
- All Gemini calls failed with errors (network, server error)
- Max failures threshold reached before completing validation

## Code Changes

### `src/lib/coverValidation.ts`
1. Add `validated: boolean` to `CoverPipelineResult` interface
2. Update `NULL_RESULT` constant to `{ coverUrl: null, coverSource: null, validated: true }` (default: definitive no-cover)
3. Track a `geminiAvailable` boolean through the candidate validation loop
4. Set `geminiAvailable = false` when:
   - API key is missing
   - Rate limit cooldown is active
   - Gemini call throws an error (network, 429, 500, etc.)
5. At end of pipeline: return `validated: geminiAvailable || coverUrl !== null`
   - If we found a cover, validated is always true (we got a result)
   - If no cover and Gemini was reachable, validated is true (definitive)
   - If no cover and Gemini was NOT reachable, validated is false (transient)
6. Community cover path: always `validated: true` (no Gemini needed)
7. No-candidates path: always `validated: true` (nothing to validate)

### `src/app/api/analyze/route.ts`
- Use `pipelineResult.validated` to set `comicDetails.coverValidated` instead of inferring from `coverUrl !== null`

### `src/app/api/con-mode-lookup/route.ts`
- Same pattern — pass `validated` through to response if needed

## Test Coverage

### New tests in `src/lib/__tests__/coverValidation.test.ts`

**Error path tests:**
1. Gemini rate limit (429 error) → `validated: false`, `coverUrl: null`
2. Gemini API key missing → `validated: false`, `coverUrl: null`
3. Gemini returns "NO" for all candidates → `validated: true`, `coverUrl: null`
4. Gemini returns "ambiguous" for all candidates → `validated: true`, `coverUrl: null`
5. Network error on image fetch → continues to next candidate, doesn't crash
6. Max failures reached (all Gemini calls fail) → `validated: false`, `coverUrl: null`
7. Image too large (>5MB) → skipped, continues to next candidate
8. Invalid MIME type → skipped, continues to next candidate

**Existing tests updated:**
- All existing tests updated to assert `validated: true` on success paths
- Community cover test asserts `validated: true` (trusted, no Gemini)

## Files Modified

| File | Change |
|------|--------|
| `src/lib/coverValidation.ts` | Add `validated` to interface and return values |
| `src/app/api/analyze/route.ts` | Use `validated` field |
| `src/app/api/con-mode-lookup/route.ts` | Use `validated` field |
| `src/lib/__tests__/coverValidation.test.ts` | Add 8 error path tests, update existing tests |

## Success Criteria
- All existing tests still pass with `validated: true` assertions added
- 8 new error path tests pass
- Callers can distinguish transient failures from definitive "no cover" results
- `npm test` passes clean
