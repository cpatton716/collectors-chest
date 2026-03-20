# Cover Image Validation Pipeline — Design Spec

**Date:** 2026-03-19
**Status:** Draft
**Author:** Claude + Chris Patton

## Problem

Cover images are frequently wrong — showing completely different comics (e.g., Batman #423 displays a "2000 AD Snowbound" cover). The current system blindly trusts results from Open Library, which often returns incorrect matches for comic books. There is no validation step, so bad covers get cached permanently and shown to all users.

Additionally, `getComicMetadata()` uses `.ilike()` (pattern matching) instead of exact equality, which can return the wrong cached record entirely.

## Solution

A two-stage cover image pipeline: gather candidates from multiple sources, then validate the best candidate using Gemini vision before caching. Bad covers are never stored. No cover is better than a wrong cover.

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Validation engine | Gemini vision API | Already integrated as fallback AI provider. Strong at recognizing comic covers. |
| Candidate priority | Community DB → eBay images → Open Library | Community covers are admin-approved (trusted). eBay images are real photos from sellers (high accuracy). Open Library is designed for books, not comics (low accuracy). |
| Comic Vine | Removed | API never returned reliable results. Not configured in production. Removed as a candidate source. Existing Comic Vine covers are preserved with `cover_source: 'comicvine', cover_validated: false` for re-validation. |
| Cache strategy | Validated covers cached permanently; "no cover" cached 7 days | Covers don't change, so permanent cache is safe. 7-day retry ensures new listings/sources are checked periodically. |
| Existing covers | Re-validated on next lookup | All current covers have `cover_validated: false`, triggering Gemini validation. Flushes bad covers organically. |
| Query matching | `.eq()` with title normalization | Fixes root cause of wrong cached records. Lowercase normalization ensures consistent matching. |

## Architecture

### Two-Stage Pipeline

**Stage 1 — Candidate Gathering**

Collect cover image URLs from multiple sources. Do not short-circuit — gather all available candidates in priority order:

| Priority | Source | Cost | Confidence |
|----------|--------|------|------------|
| 1 | Community covers DB (`cover_images` table) | Free (local DB) | Highest — admin-approved, skip Gemini validation |
| 2 | eBay Browse API listing images | Free (already in pricing response) | High — real photos of actual comics |
| 3 | Open Library API | Free (external API) | Low — designed for books, not comics. Most useful for graphic novels and TPBs with ISBNs. For single-issue comics, rarely produces a correct match. Gemini validation prevents wrong covers from being cached, but each failed candidate burns ~$0.002 in validation cost. |

**eBay images are free** — they come back in the `BrowsePriceResult.listings[].imageUrl` field already fetched for pricing. No additional API call needed.

**eBay candidate selection:** Use the first listing's image URL. eBay's default sort puts the most relevant listing first.

**eBay image selection:** Skip listings where `imageUrl` is undefined. eBay images are seller-uploaded photos (varying quality, may show slabs/angles). They are suitable for Gemini validation ('is this the right comic?') and as display covers when no cleaner source exists. If a community cover or validated Open Library cover becomes available later, it takes priority.

**eBay image durability:** eBay image URLs (hosted on `i.ebayimg.com`) are generally stable but may return 404 when listings end. Cached eBay covers are correct images — just potentially unavailable over time. The display components should handle broken image URLs with placeholder fallback styling (existing behavior). A future enhancement could periodically verify cached URLs via HEAD requests on a 30-day cycle and re-run the pipeline for stale URLs.

**Stage 2 — Gemini Validation**

Send the best candidate image to Gemini with a vision prompt:

```
Is this a cover of [Title] #[Issue] ([Year], [Publisher])?
Variant covers, reprints, and different printings of the same issue are acceptable.
The comic may be shown inside a CGC/CBCS grading slab — this is still acceptable if the cover is visible.
Answer YES or NO. If NO, briefly say what comic this actually appears to be.
```

When year or publisher is unknown, omit them from the prompt: `Is this the cover of [Title] #[Issue]?` The model can still identify most covers by title and issue alone.

**Gemini implementation:** Use `gemini-2.0-flash` (the `GEMINI_PRIMARY` constant from `src/lib/models.ts`) via a direct call to the `@google/generative-ai` SDK in `coverValidation.ts`. Do NOT use the existing `GeminiProvider` class — it is purpose-built for comic recognition (structured JSON output) and does not support YES/NO validation prompts. The validation call should use `maxOutputTokens: 50` since the response is a brief YES/NO with an optional explanation. Add `coverValidation` to cost tracking if scan analytics recording is desired.

Flow:
1. Take the highest-priority non-community candidate (eBay first, then Open Library)
2. Fetch the candidate image into a buffer, base64-encode it, and send to Gemini via `inlineData` for validation
3. If **YES** → cache the URL with `coverSource` and `coverValidated: true`
4. If **NO** → try the next candidate
5. If all candidates fail → cache `coverValidated: true, coverImageUrl: null` (prevents retry for 7 days)

**Response parsing:** Parse the first word of the Gemini response (case-insensitive). If it starts with 'YES', treat as validated. If it starts with 'NO', treat as rejected — try the next candidate. Any other response (empty, error, 'MAYBE', ambiguous text) is treated as a validation failure — cache with `coverValidated: false` so it retries on next lookup. Ambiguous responses do NOT count against the 3-failure retry limit.

**Synchronous validation:** The Gemini validation call is awaited within the request lifecycle. Netlify Functions freeze/terminate immediately after the response is sent, so background promises will never complete. The full pipeline (candidate gathering + image fetch + base64 + Gemini call) adds ~2-3s to the first lookup. The `con-mode-lookup` route already takes several seconds (eBay API + key info), so the total response time remains acceptable for convention use.

On subsequent lookups, the validated (or rejected) cover is served from cache with zero added latency.

The entire `runCoverPipeline()` function is awaited. Candidate gathering (community DB query, eBay listing extraction) is fast (~10ms). The Gemini validation call (~2s) is the main latency contributor.

**Duplicate prevention:** The pipeline checks `shouldRunPipeline()` before running. Once a cover is validated and cached, subsequent lookups skip the pipeline entirely. In the rare case of truly concurrent requests for the same comic, both will run the pipeline and both will write the same validated result — this is idempotent and harmless.

**Community covers bypass validation** — they are admin-approved and trusted.

**Community cover lifecycle:**
- When a community cover is approved via `approveCover()`, the pipeline should also update `comic_metadata` for that comic: set `cover_source: 'community', cover_validated: true, cover_image_url: [approved URL]`. This ensures the cache reflects the community cover immediately.
- **Invalidating wrong community covers** is out of scope for this spec. The existing `rejectCover()` function only works on pending covers. A future admin tool enhancement should add an `invalidateApprovedCover()` function that sets `status: 'rejected'` on approved covers and clears the corresponding `comic_metadata.cover_image_url`, triggering re-validation on next lookup.

**Image encoding:** The current Gemini provider (`src/lib/providers/gemini.ts`) accepts base64-encoded image data via `inlineData`, not image URLs. The cover validation function must fetch the candidate image URL, convert it to base64, and pass it to Gemini. This is the same pattern used by the existing scan flow.

**MIME type detection:** Determine the image MIME type from the HTTP response `Content-Type` header. If the header is missing or unrecognized, fall back to detecting the format from the first bytes of the buffer (magic bytes: JPEG starts with `FF D8 FF`, PNG with `89 50 4E 47`). Only proceed with MIME types supported by Gemini: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`. Skip to the next candidate if the image format is unsupported.

**URL validation:** Before fetching any candidate image URL for base64 conversion, validate it with a `validateImageUrl()` function in `coverValidation.ts`. Only allow HTTPS URLs from known hostnames: eBay domains (`*.ebayimg.com`, `*.ebaystatic.com`) — use pattern matching: `hostname.endsWith('.ebayimg.com') || hostname.endsWith('.ebaystatic.com')`, `covers.openlibrary.org`, and `upload.wikimedia.org`. Reject URLs with HTTP scheme, private/internal IP ranges, or unexpected hostnames. This prevents SSRF attacks via crafted eBay listing data.

**Image size limit:** Before base64 encoding, check the response `Content-Length` header or buffer size. Reject images over 5MB — this prevents memory exhaustion on serverless and stays well within Gemini's 20MB inline data limit. Skip to the next candidate if the image is too large.

**Cost:** One Gemini vision call per comic, ever. After validation (pass or fail), the result is cached in `comic_metadata`. Approximate cost: ~$0.002 per validation call.

### When the Pipeline Runs

| Scenario | Action |
|----------|--------|
| New lookup, no cached cover | Run full pipeline |
| Cached cover, `cover_validated: false` | Re-validate with Gemini |
| Cached cover, `cover_validated: true` | Use cached — skip pipeline |
| Cached cover, `cover_source: "community"` | Use cached — skip pipeline (admin-approved) |
| No cover found, `cover_validated: true` | Check `updated_at` — if older than 7 days, retry pipeline |
| Manual cover submission via community DB | Immediately overrides any cached cover |

**Known gap — CSV import:** Comics imported via CSV (`import-lookup` route) do not trigger the cover pipeline. They are saved with `coverImageUrl: null` and `coverValidated: false`. Users will see placeholder images until they individually look up each comic through Key Hunt or scan. A future batch-validation endpoint could process comics with missing covers.

**Cache decision pseudocode** (in `coverValidation.ts`):
```typescript
function shouldRunPipeline(metadata: ComicMetadata | null): boolean {
  // No cached metadata at all — run pipeline
  if (!metadata) return true;
  // Treat undefined/null cover_validated as "not yet validated"
  const validated = metadata.coverValidated === true;
  // Community covers are always trusted
  if (metadata.coverSource === 'community') return false;
  // Already validated with a cover — keep it
  if (validated && metadata.coverImageUrl) return false;
  // Validated but no cover found — retry after 7 days
  if (validated && !metadata.coverImageUrl) {
    return daysSince(metadata.updatedAt) > 7;
  }
  // Not yet validated — run pipeline
  return true;
}
```

### Pipeline Function Interface

```typescript
interface CoverPipelineResult {
  /** Validated cover URL, or null if no valid cover found */
  coverUrl: string | null;
  /** Source of the cover */
  coverSource: 'community' | 'ebay' | 'openlibrary' | null;
}

async function runCoverPipeline(
  title: string,
  issueNumber: string,
  year: string | null,
  publisher: string | null,
  options?: { ebayListings?: BrowseListingItem[] }
): Promise<CoverPipelineResult>
```

The function awaits candidate gathering and Gemini validation before returning. The caller receives a fully validated result (or `null` if no valid cover was found). Community covers bypass Gemini validation and are returned immediately.

### Integration Points

The pipeline replaces the internals of `fetchCoverImage()` in `con-mode-lookup`. In the `analyze` route, which gets covers from Metron, the pipeline is called as a separate validation step when no Metron cover is available or to validate Metron-provided covers.

1. **`con-mode-lookup` route** — after Browse API pricing call, harvest eBay listing images as candidates. The function signature stays the same so callers don't change.
2. **`analyze` route** — after scan completes, if no Metron cover is available, call the cover pipeline with eBay listing images as candidates. The pipeline is called as a separate function, not by replacing `fetchCoverImage()`. The analyze route gets covers from Metron (`metronResult.cover_image`), so the pipeline serves as a fallback and validation step.

**Plumbing requirement:** The `BrowseListingItem[]` from `searchActiveListings()` is currently discarded after price extraction in `con-mode-lookup`. The cover pipeline needs the first listing's `imageUrl` passed through. The route must capture `browseResult.listings` and pass it to the cover pipeline function.

## Data Model Changes

### `comic_metadata` table — two new columns

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `cover_source` | TEXT | `NULL` | Where the cover came from: `"community"`, `"ebay"`, `"openlibrary"`, `"metron"`, `"comicvine"` |
| `cover_validated` | BOOLEAN | `false` | Whether Gemini has validated this cover |

### Re-validation logic

| `cover_source` | `cover_validated` | Action on next lookup |
|---------------|-------------------|----------------------|
| `"community"` | any | Trust — skip validation |
| `"ebay"` | `true` | Trust — use cached |
| `"ebay"` | `false` | Validate with Gemini |
| `"openlibrary"` | `true` | Trust — use cached |
| `"openlibrary"` | `false` | Validate with Gemini |
| `"metron"` | `true` | Trust — use cached |
| `"metron"` | `false` | Validate with Gemini |
| `"comicvine"` | `true` | Trust — use cached |
| `"comicvine"` | `false` | Validate with Gemini |
| `null` (no cover) | `true` | Retry after 7 days (check `updated_at`) |
| `null` | `false` | Run full pipeline |

### Migration for existing data

All current `cover_image_url` values get `cover_source: NULL, cover_validated: false`. This triggers re-validation on the next lookup for every comic, flushing bad covers organically.

```sql
-- Add new columns
ALTER TABLE comic_metadata ADD COLUMN cover_source TEXT;
ALTER TABLE comic_metadata ADD COLUMN cover_validated BOOLEAN DEFAULT false;

-- Existing covers are preserved with `cover_validated: false` (the default for the new column).
-- The pipeline will re-validate each cover organically on next lookup — correct covers pass
-- validation and stay; wrong covers are cleared. This avoids a flash of missing covers for all users.
```

### Cleanup: Existing Bad Covers on `comics` Table

The `comics` table stores `cover_image_url` independently of `comic_metadata`. Bad covers from Open Library are already cached on users' collection records. The pipeline fixes future lookups but does not propagate back to individual comic records.

**One-time migration:**
```sql
-- Clear Open Library covers from user comics (known unreliable source)
UPDATE comics
SET cover_image_url = NULL
WHERE cover_image_url LIKE '%openlibrary.org%';
```

Run after deploying the pipeline. Users will see placeholder images until covers are re-fetched through validated lookups. Community-submitted and eBay covers are unaffected.

**Cover propagation (future enhancement):** Currently, `ComicDetailModal.tsx` and `ComicDetailsForm.tsx` read `coverImageUrl` from the `comics` table row passed as props — they have no access to `comic_metadata`. Validated covers from the pipeline only live in `comic_metadata`. For the initial implementation, the one-time migration clearing Open Library covers from the `comics` table prevents the worst wrong covers. Fresh covers from new scans/lookups will be saved to both `comic_metadata` (validated) and the `comics` table (via `addComic()`/`updateComic()`). A future enhancement could add a server-side overlay that joins `comic_metadata.cover_image_url` when fetching collection items, preferring validated covers.

**Scan-path override:** When adding a comic from scan results, `pendingComic.coverImageUrl` (the user's camera photo) takes precedence over the pipeline-validated cover in the `comics` table. This is intentional — the user's own photo is the most accurate cover for their specific copy. The pipeline-validated cover in `comic_metadata` serves future lookups for other users.

**Manual cover changes:** When a user changes a comic's cover via `ComicDetailsForm.tsx` (search or URL paste), the change is saved to the `comics` table via `updateComic()`. This does NOT invalidate `comic_metadata` — the community cover submission flow (triggered on paste) handles cache updates when an admin approves the submitted cover. No additional changes to `updateComic()` are needed.

## Query Fix — `.ilike()` → `.eq()`

In `getComicMetadata()` (`src/lib/db.ts`), change:

```typescript
// OLD: pattern matching — can return wrong records
.ilike("title", title)
.ilike("issue_number", issueNumber)

// NEW: exact match
.eq("title", title)
.eq("issue_number", issueNumber)
```

**Title normalization:** To prevent case mismatches between save and lookup, normalize titles to lowercase before both saving and querying. This keeps matching exact but case-consistent.

Apply the same fix to `saveComicMetadata()`, `incrementComicLookupCount()`, and any other functions that query `comic_metadata` by title/issue.

### Title Normalization Consistency

All routes that call `getComicMetadata()` or `saveComicMetadata()` must normalize titles identically before querying or saving. Shared `normalizeTitle()` and `normalizeIssueNumber()` functions ensure consistency:

```typescript
function normalizeTitle(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, ' ');
}
// Lowercase, strip non-alphanumeric characters (except hyphens), and collapse whitespace.
// Matches the normalization used by `coverImageDb.ts` for consistency across both lookup tables.
//
// This function should be defined in a shared utility (e.g., `src/lib/normalizeTitle.ts`) and
// imported by both `db.ts` and `coverImageDb.ts` to guarantee a single source of truth.
// Update `coverImageDb.ts` to import from the shared utility instead of defining its own copy.
//
// **Other normalizers in the codebase:** `keyComicsDatabase.ts` and `keyComicsDb.ts` each have
// their own `normalizeTitle()` with different behavior (strips 'The', removes all non-alphanumeric
// including spaces/hyphens). These are intentionally different — they perform fuzzy in-memory
// matching against the curated key comics list, not database lookups. The shared `normalizeTitle.ts`
// utility is ONLY for `comic_metadata` and `cover_images` table queries. Add a JSDoc comment to the
// shared utility: `/** For comic_metadata/cover_images DB queries only. Do NOT use for key comics matching. */`

function normalizeIssueNumber(issue: string): string {
  return issue.toLowerCase().trim().replace(/^#/, '');
}
// Handles edge cases: `'Annual #1'` → `'annual 1'`, `'1/2'` → `'1/2'` (unchanged),
// `''` (empty) → `''`. For one-shots and graphic novels with no issue number, callers
// should pass `'1'` as the default (matching the existing pattern in `quick-lookup` line 110).
```

**Data migration:** Normalize all existing `comic_metadata.title` and `issue_number` values as part of the database migration:
```sql
BEGIN;
-- Both steps MUST run atomically — Step 2 will fail if Step 1 is skipped

-- Step 1: Deduplicate rows that will conflict after title normalization
-- Keeps the row with the highest lookup_count (most popular)
DELETE FROM comic_metadata
WHERE id NOT IN (
  SELECT DISTINCT ON (
    LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(title), '[^a-zA-Z0-9[:space:]-]', '', 'g'), '[[:space:]]+', ' ', 'g')),
    LOWER(REGEXP_REPLACE(TRIM(LEADING '#' FROM TRIM(issue_number)), '[[:space:]]+', ' ', 'g'))
  ) id
  FROM comic_metadata
  ORDER BY
    LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(title), '[^a-zA-Z0-9[:space:]-]', '', 'g'), '[[:space:]]+', ' ', 'g')),
    LOWER(REGEXP_REPLACE(TRIM(LEADING '#' FROM TRIM(issue_number)), '[[:space:]]+', ' ', 'g')),
    lookup_count DESC, cover_image_url IS NULL ASC, updated_at DESC
);

-- Step 2: Normalize titles and issue numbers
UPDATE comic_metadata
SET title = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(title), '[^a-zA-Z0-9[:space:]-]', '', 'g'), '[[:space:]]+', ' ', 'g')),
    issue_number = LOWER(TRIM(LEADING '#' FROM TRIM(issue_number)));

COMMIT;
```
This prevents duplicate rows from case-variant titles after the `.eq()` switch.

**Keep existing unique constraint + add functional index:**
```sql
-- Keep the existing UNIQUE(title, issue_number) constraint for upsert targeting
-- Add a functional index as a safety net for case-insensitive uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_comic_metadata_unique_normalized
ON comic_metadata (
  LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(title), '[^a-zA-Z0-9[:space:]-]', '', 'g'), '[[:space:]]+', ' ', 'g')),
  LOWER(TRIM(LEADING '#' FROM TRIM(issue_number)))
);
```

The column-based constraint serves as the upsert target (`onConflict: 'title,issue_number'`). The functional index is a safety net that prevents duplicates even if a code path misses normalization. Both coexist without conflict since pre-normalized data satisfies both constraints.

**Defensive guard:** If a `23505` unique violation is logged from `saveComicMetadata()` after migration, it indicates a code path is bypassing `normalizeTitle()`. The functional index is the safety net catching this. Add a runtime assertion in `saveComicMetadata()`: `if (title !== normalizeTitle(title)) console.warn('[metadata] Unnormalized title detected:', title)`. Investigate and fix the missing normalization rather than removing the index.

**Migration window note:** The dedup migration (Step 1) may delete rows that in-flight lookups are trying to read. This is benign — affected lookups will get a cache miss and perform a fresh API call, re-caching the result. No data is lost.

**Deploy ordering:** This migration is a **deploy prerequisite** — it must run in the Supabase SQL Editor BEFORE the application code that calls `normalizeTitle()` goes live. If the migration is delayed, the application's `.eq()` queries will search for lowercase titles while the database still stores mixed-case, causing cache misses on every lookup.

Both functions are applied in `getComicMetadata()`, `saveComicMetadata()`, and `incrementComicLookupCount()` before any database operation. All five routes (analyze, con-mode-lookup, quick-lookup, comic-lookup, import-lookup) call these shared functions, so normalization is enforced at the database layer, not per-route.

## Files Affected

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/coverValidation.ts` | Gemini validation function, candidate gathering, pipeline orchestration |
| `src/lib/__tests__/coverValidation.test.ts` | Unit tests for candidate ranking, validation flow, cache logic |
| `src/lib/normalizeTitle.ts` | Shared title and issue number normalization functions used by both `db.ts` and `coverImageDb.ts` |

### Modified Files
| File | What Changes |
|------|-------------|
| `src/lib/db.ts` | `.ilike()` → `.eq()` in `getComicMetadata()`, `saveComicMetadata()`, and `incrementComicLookupCount()`. Add title normalization. Update `saveComicMetadata()` function signature to accept optional `coverSource?: string` and `coverValidated?: boolean` parameters and include them in the upsert payload. Update `ComicMetadata` interface to include `coverSource` and `coverValidated` in the return type. Update `getComicMetadata()` to read and return the new columns. **Critical: conditional upsert fields.** The `saveComicMetadata()` upsert must only include `cover_source`, `cover_validated`, and `cover_image_url` in the payload when they are explicitly provided. If these fields are `undefined` in the input, they must be omitted from the upsert object — NOT sent as `null` or `false`. This prevents price-refresh calls (which don't pass cover fields) from resetting `cover_validated` back to `false` on every update. Use conditional spread: `...(coverSource !== undefined && { cover_source: coverSource })`. **Upsert conflict target:** The existing column-based unique constraint is kept (see migration section), so `.upsert({ onConflict: 'title,issue_number' })` continues to work. Since all values are pre-normalized before saving, the column-based constraint and functional index both remain satisfied. **Conditional spread for ALL cover fields:** Apply the conditional spread pattern to `cover_image_url` in addition to `cover_source` and `cover_validated`: `...(metadata.coverImageUrl !== undefined && { cover_image_url: metadata.coverImageUrl }), ...(metadata.coverSource !== undefined && { cover_source: metadata.coverSource }), ...(metadata.coverValidated !== undefined && { cover_validated: metadata.coverValidated })`. This prevents price-refresh calls from overwriting validated covers with `null`. |
| `src/app/api/con-mode-lookup/route.ts` | Replace the `fetchCoverImage()` call with a call to `runCoverPipeline(title, issue, year, publisher, { ebayListings: browseResult.listings })` from `coverValidation.ts`. The old `fetchCoverImage()` function can be deleted. **Rate limiting must be added** using `rateLimiters.lookup` (20/min) alongside the pipeline integration. Remove the `// Try to fetch a cover image (non-blocking)` comment — the pipeline is synchronous. |
| `src/app/api/analyze/route.ts` | Call cover pipeline as a separate validation step when no Metron cover is available or to validate Metron-provided covers. Does not replace `fetchCoverImage()`. |
| `src/app/api/quick-lookup/route.ts` | Apply `.ilike()` → `.eq()` fix and title normalization. This route fetches covers from Comic Vine (when configured). **Update the `saveComicMetadata()` call to pass `coverSource: 'comicvine', coverValidated: false` when saving a Comic Vine cover URL.** This ensures Comic Vine covers are flagged for Gemini validation on the next lookup. |
| `src/app/api/comic-lookup/route.ts` | Apply `.ilike()` → `.eq()` fix and title normalization. These routes do not fetch covers — they write coverImageUrl only when provided by upstream (e.g., from scan results). No pipeline integration needed. |
| `src/app/api/import-lookup/route.ts` | Apply `.ilike()` → `.eq()` fix and title normalization. These routes do not fetch covers — they write coverImageUrl only when provided by upstream (e.g., from scan results). No pipeline integration needed. |
| `src/app/api/cover-search/route.ts` | **Out of scope for this spec.** The `cover-search` route returns multiple Open Library candidates for user browsing — a fundamentally different operation from the single-cover validation pipeline. It should be addressed in a separate spec. The route is independent of the Key Hunt pipeline. |
| `src/lib/metadataCache.ts` | Add `coverImageUrl`, `coverSource`, and `coverValidated` to the `SAVEABLE_FIELDS` array. All three fields must be added together so provenance is always captured. The analyze route must set `coverSource: 'metron'` and `coverValidated: false` on `comicDetails` before `buildMetadataSavePayload()` is called, ensuring Metron covers enter the cache with proper source tagging. This is an intentional behavior change — the analyze route will now persist cover URLs through `buildMetadataSavePayload()` where it previously did not. **Pre-existing issue:** `priceData` is also not in `SAVEABLE_FIELDS`, meaning the analyze route does not persist price data through `buildMetadataSavePayload()`. This is a separate issue from the cover pipeline — price data is saved through direct `saveComicMetadata()` calls in other routes. Document but do not fix in this spec. |
| `src/lib/coverImageDb.ts` | Import `normalizeTitle` from shared `src/lib/normalizeTitle.ts` instead of defining its own local copy. Ensures a single source of truth for normalization. |

**Read-only consumers:** `src/app/api/hottest-books/route.ts` and `src/app/key-hunt/page.tsx` read `cover_image_url` from `comic_metadata`. No code changes needed — they will serve validated covers organically after the pipeline re-validates each comic. During the transition, existing covers are preserved with `cover_validated: false` and re-validated on next lookup.

### Database Migration
| File | What |
|------|------|
| `supabase/migrations/YYYYMMDD_cover_validation.sql` | Add `cover_source` and `cover_validated` columns to `comic_metadata` |

## Error Handling

- **Gemini error classification:**
  - **429 (Rate Limited) or daily quota exceeded:** Log warning, set a module-level cooldown flag to skip Gemini calls for 60 seconds, cache as `coverValidated: false`. The Gemini free tier allows 15 RPM — the `con-mode-lookup` rate limiter allows 20/min, so 429s are expected under burst load.
  - **400 with invalid/expired API key:** Log `console.error`, cache as `coverValidated: false`. Consider a circuit-breaker that disables validation for the remainder of the function invocation (Netlify functions are short-lived, so this naturally resets).
  - **500/503 (Server Error):** Transient. Cache as `coverValidated: false`, retry on next lookup.
  - **Successful response but ambiguous output:** See Response Parsing section.
- If eBay listing has no image → skip to Open Library candidate
- If Open Library API fails → no candidate from that source
- If all sources fail and Gemini is unavailable → cache nothing, retry next lookup
- No silent failures — all errors logged with `[cover-validation]` prefix
- If Gemini errors repeatedly for the same comic → after 3 failed attempts (tracked in memory per request, not persisted), cache `coverValidated: false` and stop retrying for this lookup. The next lookup will try again. This prevents unbounded Gemini calls for frequently-accessed comics during API outages.

### Rate Limiting

The `con-mode-lookup` route currently has NO rate limiting. Before the cover validation pipeline goes live, add rate limiting using the existing `rateLimiters.lookup` (20/min) to the route. This prevents unbounded Gemini API costs from bots or aggressive usage. The rate limiter must be added as a prerequisite in the same deploy as the pipeline.

## Cost Analysis

| Action | Cost | Frequency |
|--------|------|-----------|
| Gemini validation call | ~$0.002 | Once per comic (cached permanently) |
| eBay image candidate | $0 | Already in pricing response |
| Open Library lookup | $0 | External API, no cost |

For a collection of 500 comics, the one-time re-validation cost is approximately $1.00.

**Re-validation pacing:** Post-migration re-validation is gradual by design — it only triggers when a comic is actively looked up through Key Hunt or scan routes. There is no bulk re-validation sweep. Read-only consumers (hottest-books, key-hunt page) read from `comic_metadata` without triggering the pipeline. The worst-case burst is bounded by the rate limiter on `con-mode-lookup` (20/min per Finding 1). For a collection of 500 comics, full re-validation would take ~25 minutes of continuous lookups.

### Offline Mode

Offline-cached covers (in localStorage via `useOffline.ts`) from before the pipeline deployment may be incorrect. These are not retroactively fixed — the one-time migration to clear Open Library covers from the `comics` table handles the server-side cleanup. When offline data syncs to the server, the server-side cover will be the authoritative source on next view. No changes to the offline sync flow are needed.

## Testing

- Unit tests for candidate priority ordering
- Unit tests for cache decision logic (when to validate, when to skip, when to retry)
- Unit tests for title normalization
- Manual testing: scan Batman #423, verify correct cover appears
- Manual testing: scan an obscure comic, verify placeholder shown (not wrong cover)
- Manual testing: submit community cover, verify it takes priority immediately

### Mock Strategy
- **Gemini calls:** `coverValidation.ts` should accept an optional `geminiClient` parameter (dependency injection) so tests can pass a mock. Tests use `vi.fn()` to return canned YES/NO responses.
- **Image fetching:** Mock global `fetch` with `vi.fn()` to return fake image buffers for base64 conversion.
- **Pipeline integration:** Call `runCoverPipeline()` and `await` the result. Verify that the returned `coverUrl` matches the expected validated URL and that `saveComicMetadata()` was called with `coverValidated: true`.
