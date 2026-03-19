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
| Query matching | `.eq()` with title normalization | Fixes root cause of wrong cached records. Title case normalization ensures consistent matching. |

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

**Stage 2 — Gemini Validation**

Send the best candidate image to Gemini with a vision prompt:

```
Is this the cover of [Title] #[Issue] ([Year], [Publisher])?
Answer YES or NO. If NO, briefly say what comic this actually appears to be.
```

Flow:
1. Take the highest-priority non-community candidate (eBay first, then Open Library)
2. Send image URL to Gemini for validation
3. If **YES** → cache the URL with `coverSource` and `coverValidated: true`
4. If **NO** → try the next candidate
5. If all candidates fail → cache `coverValidated: true, coverImageUrl: null` (prevents retry for 7 days)

**Community covers bypass validation** — they are admin-approved and trusted.

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

### Integration Points

The pipeline replaces the internals of the existing `fetchCoverImage()` function in two routes:

1. **`con-mode-lookup` route** — after Browse API pricing call, harvest eBay listing images as candidates
2. **`analyze` route** — same flow after scan's Browse API call

The function signature stays the same so callers don't change.

## Data Model Changes

### `comic_metadata` table — two new columns

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `cover_source` | TEXT | `NULL` | Where the cover came from: `"community"`, `"ebay"`, `"openlibrary"` |
| `cover_validated` | BOOLEAN | `false` | Whether Gemini has validated this cover |

### Re-validation logic

| `cover_source` | `cover_validated` | Action on next lookup |
|---------------|-------------------|----------------------|
| `"community"` | any | Trust — skip validation |
| `"ebay"` | `true` | Trust — use cached |
| `"ebay"` | `false` | Validate with Gemini |
| `"openlibrary"` | `true` | Trust — use cached |
| `"openlibrary"` | `false` | Validate with Gemini |
| `null` (no cover) | `true` | Retry after 7 days (check `updated_at`) |
| `null` | `false` | Run full pipeline |

### Migration for existing data

All current `cover_image_url` values get `cover_source: NULL, cover_validated: false`. This triggers re-validation on the next lookup for every comic, flushing bad covers organically.

```sql
-- Add new columns
ALTER TABLE comic_metadata ADD COLUMN cover_source TEXT;
ALTER TABLE comic_metadata ADD COLUMN cover_validated BOOLEAN DEFAULT false;
```

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

**Title normalization:** To prevent case mismatches between save and lookup, normalize titles to title case before both saving and querying. This keeps matching exact but case-consistent.

Apply the same fix to `saveComicMetadata()` and any other functions that query `comic_metadata` by title/issue.

## Files Affected

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/coverValidation.ts` | Gemini validation function, candidate gathering, pipeline orchestration |
| `src/lib/__tests__/coverValidation.test.ts` | Unit tests for candidate ranking, validation flow, cache logic |

### Modified Files
| File | What Changes |
|------|-------------|
| `src/lib/db.ts` | `.ilike()` → `.eq()` in `getComicMetadata()`, add title normalization, read/write `cover_source` and `cover_validated` fields |
| `src/app/api/con-mode-lookup/route.ts` | Replace `fetchCoverImage()` internals with new pipeline, pass eBay listing images as candidates |
| `src/app/api/analyze/route.ts` | Same pipeline integration |
| `src/lib/coverImageDb.ts` | May need minor updates to align `getCommunityCovers()` with new priority system |

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
