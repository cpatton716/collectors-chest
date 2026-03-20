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
| Comic Vine | Removed | API never returned reliable results. Not configured in production. Dead code. |
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
| 3 | Open Library API | Free (external API) | Low — designed for books, not comics |

**eBay images are free** — they come back in the `BrowsePriceResult.listings[].imageUrl` field already fetched for pricing. No additional API call needed.

**eBay candidate selection:** Use the first listing's image URL. eBay's default sort puts the most relevant listing first.

**eBay image selection:** Skip listings where `imageUrl` is undefined. eBay images are seller-uploaded photos (varying quality, may show slabs/angles). They are suitable for Gemini validation ('is this the right comic?') and as display covers when no cleaner source exists. If a community cover or validated Open Library cover becomes available later, it takes priority.

**Stage 2 — Gemini Validation**

Send the best candidate image to Gemini with a vision prompt:

```
Is this a cover of [Title] #[Issue] ([Year], [Publisher])?
Variant covers, reprints, and different printings of the same issue are acceptable.
Answer YES or NO. If NO, briefly say what comic this actually appears to be.
```

When year or publisher is unknown, omit them from the prompt: `Is this the cover of [Title] #[Issue]?` The model can still identify most covers by title and issue alone.

Flow:
1. Take the highest-priority non-community candidate (eBay first, then Open Library)
2. Fetch the candidate image into a buffer, base64-encode it, and send to Gemini via `inlineData` for validation
3. If **YES** → cache the URL with `coverSource` and `coverValidated: true`
4. If **NO** → try the next candidate
5. If all candidates fail → cache `coverValidated: true, coverImageUrl: null` (prevents retry for 7 days)

**Latency budget:** Image fetch ~200-500ms, Gemini validation ~1-2s. Total added latency: ~2-3s on first lookup. To avoid blocking the user, **validation runs asynchronously**: the route returns the unvalidated cover image immediately (for display), then validates in the background and updates `comic_metadata`. On subsequent lookups, the validated (or rejected) cover is served from cache. This keeps Key Hunt lookups fast at conventions.

**First-lookup UX:** On first lookup, the client displays the unvalidated cover candidate (or a placeholder if no candidate was found synchronously). On subsequent lookups — including a second scan at the same convention — the validated result is served from cache. No client-side polling is required. The brief window of a potentially wrong cover on first lookup is an acceptable trade-off for fast response times.

**Concurrency guard:** The `coverValidation.ts` pipeline uses an in-memory lock (`Map<string, Promise>` keyed by `title|issue_number`) so concurrent requests for the same comic deduplicate into a single Gemini call. If a validation is already in flight, subsequent requests await the existing promise. In a serverless environment (Netlify Functions), the lock works within a single function invocation lifetime — rare cross-instance duplication is acceptable since the validation result is idempotent.

**Community covers bypass validation** — they are admin-approved and trusted.

**Image encoding:** The current Gemini provider (`src/lib/providers/gemini.ts`) accepts base64-encoded image data via `inlineData`, not image URLs. The cover validation function must fetch the candidate image URL, convert it to base64, and pass it to Gemini. This is the same pattern used by the existing scan flow.

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

**Cache decision pseudocode** (in `coverValidation.ts`):
```typescript
function shouldRunPipeline(metadata: ComicMetadata): boolean {
  // Community covers are always trusted
  if (metadata.coverSource === 'community') return false;
  // Already validated with a cover — keep it
  if (metadata.coverValidated && metadata.coverImageUrl) return false;
  // Validated but no cover found — retry after 7 days
  if (metadata.coverValidated && !metadata.coverImageUrl) {
    return daysSince(metadata.updatedAt) > 7;
  }
  // Not yet validated — run pipeline
  return true;
}
```

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

**Future propagation:** When `comic_metadata` gets a validated cover, the display components should prefer `comic_metadata.cover_image_url` (validated) over the `comics` table cover when available. This is handled at render time in `ComicDetailModal.tsx` and `ComicDetailsForm.tsx` — no schema change needed.

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

function normalizeIssueNumber(issue: string): string {
  return issue.trim().replace(/^#/, '');
}
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
    LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(title), '[^a-zA-Z0-9\s\-]', '', 'g'), '\s+', ' ', 'g')),
    LOWER(REGEXP_REPLACE(TRIM(LEADING '#' FROM TRIM(issue_number)), '\s+', ' ', 'g'))
  ) id
  FROM comic_metadata
  ORDER BY
    LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(title), '[^a-zA-Z0-9\s\-]', '', 'g'), '\s+', ' ', 'g')),
    LOWER(REGEXP_REPLACE(TRIM(LEADING '#' FROM TRIM(issue_number)), '\s+', ' ', 'g')),
    lookup_count DESC
);

-- Step 2: Normalize titles and issue numbers
UPDATE comic_metadata
SET title = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(title), '[^a-zA-Z0-9\s\-]', '', 'g'), '\s+', ' ', 'g')),
    issue_number = TRIM(LEADING '#' FROM TRIM(issue_number));

COMMIT;
```
This prevents duplicate rows from case-variant titles after the `.eq()` switch.

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
| `src/lib/db.ts` | `.ilike()` → `.eq()` in `getComicMetadata()`, `saveComicMetadata()`, and `incrementComicLookupCount()`. Add title normalization. Update `saveComicMetadata()` function signature to accept optional `coverSource?: string` and `coverValidated?: boolean` parameters and include them in the upsert payload. Update `ComicMetadata` interface to include `coverSource` and `coverValidated` in the return type. Update `getComicMetadata()` to read and return the new columns. |
| `src/app/api/con-mode-lookup/route.ts` | Replace the `fetchCoverImage()` call with a call to `runCoverPipeline(title, issue, year, publisher, { ebayListings: browseResult.listings })` from `coverValidation.ts`. The old `fetchCoverImage()` function can be deleted. |
| `src/app/api/analyze/route.ts` | Call cover pipeline as a separate validation step when no Metron cover is available or to validate Metron-provided covers. Does not replace `fetchCoverImage()`. |
| `src/app/api/quick-lookup/route.ts` | Apply `.ilike()` → `.eq()` fix and title normalization. This route fetches covers from Comic Vine (when configured). **Update the `saveComicMetadata()` call to pass `coverSource: 'comicvine', coverValidated: false` when saving a Comic Vine cover URL.** This ensures Comic Vine covers are flagged for Gemini validation on the next lookup. |
| `src/app/api/comic-lookup/route.ts` | Apply `.ilike()` → `.eq()` fix and title normalization. These routes do not fetch covers — they write coverImageUrl only when provided by upstream (e.g., from scan results). No pipeline integration needed. |
| `src/app/api/import-lookup/route.ts` | Apply `.ilike()` → `.eq()` fix and title normalization. These routes do not fetch covers — they write coverImageUrl only when provided by upstream (e.g., from scan results). No pipeline integration needed. |
| `src/app/api/cover-search/route.ts` | Route through the cover validation pipeline. Currently calls Open Library directly with no validation. This route is called by `ComicDetailsForm.tsx`. Update the route to use the `runCoverPipeline()` from `coverValidation.ts`, returning only validated cover URLs. Also add `src/components/ComicDetailsForm.tsx` to the Modified Files table if the API response shape changes. This route is independent of the Key Hunt pipeline and can be implemented and tested separately. |
| `src/lib/metadataCache.ts` | Add `coverImageUrl`, `coverSource`, and `coverValidated` to the `SAVEABLE_FIELDS` array so the analyze route can persist cover data through `buildMetadataSavePayload()`. Note: this is an intentional behavior change — the analyze route will now persist cover URLs through `buildMetadataSavePayload()` where it previously did not. |
| `src/lib/coverImageDb.ts` | Import `normalizeTitle` from shared `src/lib/normalizeTitle.ts` instead of defining its own local copy. Ensures a single source of truth for normalization. |

**Read-only consumers:** `src/app/api/hottest-books/route.ts` and `src/app/key-hunt/page.tsx` read `cover_image_url` from `comic_metadata`. No code changes needed — they will serve validated covers organically after the pipeline re-validates each comic. During the transition, existing covers are preserved with `cover_validated: false` and re-validated on next lookup.

### Database Migration
| File | What |
|------|------|
| `supabase/migrations/YYYYMMDD_cover_validation.sql` | Add `cover_source` and `cover_validated` columns to `comic_metadata` |

## Error Handling

- If Gemini API fails → skip validation, cache cover as `cover_validated: false` (will retry next lookup)
- If eBay listing has no image → skip to Open Library candidate
- If Open Library API fails → no candidate from that source
- If all sources fail and Gemini is unavailable → cache nothing, retry next lookup
- No silent failures — all errors logged with `[cover-validation]` prefix
- If Gemini errors repeatedly for the same comic → after 3 failed attempts (tracked in memory per request, not persisted), cache `coverValidated: false` and stop retrying for this lookup. The next lookup will try again. This prevents unbounded Gemini calls for frequently-accessed comics during API outages.

## Cost Analysis

| Action | Cost | Frequency |
|--------|------|-----------|
| Gemini validation call | ~$0.002 | Once per comic (cached permanently) |
| eBay image candidate | $0 | Already in pricing response |
| Open Library lookup | $0 | External API, no cost |

For a collection of 500 comics, the one-time re-validation cost is approximately $1.00.

## Testing

- Unit tests for candidate priority ordering
- Unit tests for cache decision logic (when to validate, when to skip, when to retry)
- Unit tests for title normalization
- Manual testing: scan Batman #423, verify correct cover appears
- Manual testing: scan an obscure comic, verify placeholder shown (not wrong cover)
- Manual testing: submit community cover, verify it takes priority immediately
