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
2. Update `NULL_RESULT` to `{ coverUrl: null, coverSource: null, validated: true }`. This is used ONLY for the 'no candidates found' early return (line 366). The end-of-candidate-loop return (line 445) must NOT use `NULL_RESULT` directly — it must compute `validated` from `allCandidatesChecked` as described below.
3. Track an `allCandidatesChecked` boolean through the candidate validation loop (starts `true`, set to `false` when a candidate is skipped due to Gemini unavailability — rate limit, missing key, or error)
4. Set `allCandidatesChecked = false` when:
   - API key is missing
   - Rate limit cooldown is active
   - Gemini call throws an error (network, 429, 500, etc.)
5. At end of pipeline, compute `validated`:
   - If `coverUrl` is not null → `validated: true` (we found a valid cover)
   - If no candidates existed → `validated: true` (nothing to validate)
   - If `allCandidatesChecked` is true → `validated: true` (Gemini checked everything, definitive no-cover)
   - If `allCandidatesChecked` is false → `validated: false` (some candidates couldn't be checked, transient)
6. Community cover path: always `validated: true` (no Gemini needed)
7. No-candidates path: always `validated: true` (nothing to validate)

> **Note:** When `GEMINI_API_KEY` is missing, `validateWithGemini()` currently returns `'ambiguous'` instead of throwing. The implementation must check for the missing key BEFORE entering the candidate loop and set `allCandidatesChecked = false` early, rather than relying on the catch block.

> **Note:** When rate-limit cooldown is active (line 399), change `continue` to `break` — if Gemini is rate-limited, it's rate-limited for all remaining candidates too. Also set `allCandidatesChecked = false` before breaking.

### `src/app/api/analyze/route.ts`
- Update the cover pipeline result handling to ALWAYS set `comicDetails.coverValidated = pipelineResult.validated`, not just when `coverUrl` is truthy. Currently the else branch is missing — `coverValidated` stays undefined when no cover is found, which means `shouldRunPipeline` always re-runs (safe but wasteful). The fix: set `coverValidated` in both the success and null-cover branches.

### `src/app/api/con-mode-lookup/route.ts`
- Fix inverted `coverValidated` logic. Current code sets `coverValidated: pipelineResult?.coverUrl !== null` which is wrong — it returns `false` for definitive 'no cover' results, causing unnecessary re-runs. Change to: `coverValidated: pipelineResult?.validated`.

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
9. Community cover lookup throws → pipeline continues to candidate gathering

**Existing tests updated:**
- All existing tests updated to assert `validated: true` on success paths
- Community cover test asserts `validated: true` (trusted, no Gemini)

## Files Modified

| File | Change |
|------|--------|
| `src/lib/coverValidation.ts` | Add `validated` to interface and return values |
| `src/app/api/analyze/route.ts` | Use `validated` field |
| `src/app/api/con-mode-lookup/route.ts` | Use `validated` field |
| `src/lib/__tests__/coverValidation.test.ts` | Add 9 error path tests, update existing tests |
| `src/app/api/quick-lookup/route.ts` | Review `coverValidated` assignment for consistency |

## `shouldRunPipeline` Interaction

When `coverValidated: false` is saved (transient failure), `shouldRunPipeline()` returns `true` on next lookup, triggering an automatic retry. This is the primary mechanism by which the `validated` flag improves system behavior.

## Success Criteria
- All existing tests still pass with `validated: true` assertions added
- 9 new error path tests pass
- Callers can distinguish transient failures from definitive "no cover" results
- `npm test` passes clean
