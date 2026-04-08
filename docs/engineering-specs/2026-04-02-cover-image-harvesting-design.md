# Auto-Harvest Cover Images from Graded Book Scans — Spec

**Status:** Approved (Rev 3 — updated after second deep-dive review)
**Date:** April 2, 2026
**Supersedes:** `docs/plans/2026-02-25-cover-image-harvesting-design.md` (original design doc)

---

## Goal

Automatically harvest clean cover artwork from graded book (CGC/CBCS/PGX) scans and populate the community cover database — zero user friction, zero extra API cost.

## Scope

- **In scope:** Graded/slabbed books only. Extract cover artwork only (no label, grade, cert number, case edges). Authenticated users only.
- **Out of scope:** Raw book scans. Guest user scans (no accountability). Admin quality review process (deferred to post-launch, ~3-6 months / 1K users).

## How It Works

When an **authenticated user** scans a slabbed comic:

1. The existing AI call (Claude/Gemini) already analyzes the image for title, issue, grade, etc.
2. **New:** The AI prompt also requests `coverHarvestable` (boolean) and `coverCropCoordinates` ({x, y, width, height} in pixels) — the bounding box of the actual cover artwork inside the slab, excluding the label, plastic case, and reflections.
3. If `isSlabbed === true` AND `coverHarvestable === true` AND user is authenticated:
   - Crop the **compressed base64 image** (the same image the AI analyzed, already resized to 1200px max by the client) using the returned coordinates
   - Apply 4% inset padding to compensate for AI coordinate inaccuracy
   - Validate crop (after inset): dimensions, aspect ratio (~2:3), and color variance
   - Convert to WebP via `sharp` (quality: 85)
   - Upload to Supabase Storage bucket `cover-images`
   - Submit to community cover database via `submitCoverImage()` with `autoApprove: true`
   - Sync to `comic_metadata` via `saveComicMetadata()` so the cover is immediately findable
4. If `coverHarvestable === false`, not slabbed, or guest user → skip silently
5. If a community cover already exists for that title+issue+variant → skip (don't overwrite)

**User experience:** Completely invisible. No extra screens, prompts, or delay.

## Execution Strategy — Pre-Response with Timeout

**The harvest runs BEFORE the response is returned**, wrapped in a `Promise.race` with a 2-second timeout. This is necessary because Netlify serverless functions may freeze/terminate after the response is sent — fire-and-forget async work is unreliable.

```
const harvestPromise = harvestCoverFromScan(params).catch(err => {
  console.error("[harvest] failed:", err.message);
});
const timeoutPromise = new Promise(resolve => setTimeout(resolve, 2000));

await Promise.race([harvestPromise, timeoutPromise]);

return NextResponse.json(scanResult);
```

**Impact:** Adds up to 2 seconds to slabbed-book scans (typical: 300-800ms). Non-slabbed scans are unaffected. If the harvest doesn't complete in 2 seconds, it is abandoned — no retry, the next scan of a similar book may succeed.

## Prerequisite — sharp on Netlify Proof-of-Concept

**Before writing any harvest code**, verify that `sharp` works in Netlify's serverless environment:

1. Add `sharp` (v0.33+) to `package.json`
2. Create a minimal test API route that resizes a small image using sharp
3. Deploy to Netlify and verify the route works

`sharp` uses native C++ bindings (libvips). The macOS binary from local `npm install` will not work on Lambda (Amazon Linux). Sharp v0.33+ includes `@img/sharp-linux-x64` as an optional dependency which should handle this, but it must be verified.

**Fallback if sharp fails:** Use Supabase Storage's built-in image transformation — upload the full slab image and store a URL with crop parameters. Supabase applies the crop at read time, eliminating the need for server-side image processing entirely.

## AI Prompt Changes

Add to the `IMAGE_ANALYSIS_PROMPT` in **both** `src/lib/providers/anthropic.ts` and `src/lib/providers/gemini.ts` (only populated when `isSlabbed: true`):

```json
{
  "coverHarvestable": true,
  "coverCropCoordinates": {
    "x": 45,
    "y": 180,
    "width": 390,
    "height": 580
  }
}
```

**Token limits:** Increase `max_tokens` from 1024 to 1536 in `anthropic.ts` and increase `maxOutputTokens` equivalently in `gemini.ts` to accommodate the additional response fields with safety margin.

Update `ImageAnalysisResult` type in `src/lib/providers/types.ts` to include the new fields as optional:
```typescript
coverHarvestable?: boolean;
coverCropCoordinates?: {
  x: number;
  y: number;
  width: number;
  height: number;
};
```

### coverHarvestable (boolean)

A single yes/no decision. The AI returns `true` only when ALL of these are met:
- Cover artwork is clearly visible through the slab
- Image is sharp and well-lit
- Minimal glare/reflections on the plastic
- Colors appear accurate (not washed out or over-saturated)
- Full cover is visible (not cut off)

**Rationale:** A boolean is more reliable than a numeric scale. The AI will be inconsistent on a 1-10 rating, but a binary "is this cover usable?" decision is clearer.

### coverCropCoordinates

Bounding box **in pixels relative to the image the AI received** (the client-compressed version, max 1200px on the longest dimension). Must exclude:
- Grading company label (top of slab — CGC labels are wide, CBCS labels are narrower, PGX labels are smaller)
- Certification number and grade info
- Plastic case borders (inner well edge, not outer plastic)
- Any reflections or glare at edges

**Important:** The client compresses images to ~400KB / 1200px max before sending. The AI coordinates are relative to this compressed image. The crop is performed on this same compressed buffer — there is no "original" on the server.

## Image Processing Pipeline

1. Decode the compressed base64 image to buffer (same image the AI analyzed)
2. Get image dimensions via `sharp(buffer).metadata()`
3. Validate AI coordinates are within image bounds (`x + width <= imageWidth`, `y + height <= imageHeight`, no negative values, no NaN)
4. Apply 4% inset padding: shrink the crop box by 4% on each edge to compensate for AI coordinate imprecision (better to crop slightly into the cover than include slab edges)
5. **Validate dimensions AFTER inset** (inset can reduce dimensions below thresholds): width >= 100px, height >= 150px, area < 90% of original image. If inset pushes below minimums → skip harvest.
6. Validate aspect ratio (after inset): crop must be approximately 2:3 (width:height ratio between 0.55 and 0.80). Reject if wildly different — indicates bad coordinates.
7. Crop using `sharp` with the adjusted coordinates
8. Validate color variance: check that the cropped image has reasonable pixel diversity (rejects solid-color or near-solid crops from garbage coordinates). Use `sharp.stats()` — reject if all channel standard deviations are below 10.
9. Convert to WebP (quality: 85 — higher than typical to reduce double-compression artifacts since the source is already JPEG-compressed)
10. Upload to Supabase Storage: `cover-images/{normalized_title}/{issue_number}/{normalized_variant}/{uuid}.webp`
11. Get public URL from Supabase Storage
12. Call `submitCoverImage()` with the public URL, `autoApprove: true`, `submittedBy: SYSTEM_HARVEST_PROFILE_ID`, `sourceQuery: "scan-harvest"`, and the `variant` value
13. Call `saveComicMetadata()` to sync the cover URL into the metadata cache so it's immediately available to future lookups

## Variant Handling

The community cover database should store **one cover per title+issue+variant combination**, not just title+issue. Different variants (Cover A, Newsstand, Foil, etc.) have visually distinct covers.

- The AI already returns a `variant` field from the scan
- Dedup check: query `cover_images` by `title_normalized + issue_number + variant` (normalized)
- If no variant is detected, use empty string as the variant key
- This means "Amazing Spider-Man #300 Cover A" and "#300 Newsstand" each get their own cover

**Database migration required (see Database Migrations section):**
1. Add `variant` column to `cover_images` table
2. Backfill existing rows with empty string
3. Add partial unique index on `(title_normalized, issue_number, variant)` where `status = 'approved'`

**Code changes:** Update `submitCoverImage()` and `getCommunityCovers()` in `coverImageDb.ts` to accept and query by `variant` parameter. Default to empty string when not provided for backward compatibility.

## submittedBy and approved_by — System Harvest Profile

The `submitted_by` and `approved_by` columns in `cover_images` are **UUID foreign keys** referencing `profiles(id)`. Inserting a plain string like `"system-harvest"` will fail with a type/FK error.

**Solution:** Create a sentinel profile row in the `profiles` table with a well-known UUID for system operations:

```sql
-- System harvest profile (sentinel row for automated operations)
INSERT INTO profiles (id, display_name, created_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'System Harvest', NOW())
ON CONFLICT (id) DO NOTHING;
```

**In code:** Define a constant:
```typescript
export const SYSTEM_HARVEST_PROFILE_ID = '00000000-0000-0000-0000-000000000001';
```

Use this UUID for both `submittedBy` and `approved_by` in auto-harvested covers. This preserves FK integrity and clearly identifies system-generated content.

**RLS consideration:** The `supabaseAdmin` client (used in the analyze route) connects with the service role key, which bypasses RLS. Verified: `src/lib/supabase.ts` creates `supabaseAdmin` with `SUPABASE_SERVICE_ROLE_KEY`. Inserts with the sentinel UUID will not be blocked by RLS policies that check `submitted_by` against JWT claims.

## Storage

- **Supabase Storage bucket:** `cover-images` (public read, service-role write)
- **File path:** `{normalized_title}/{issue_number}/{normalized_variant}/{uuid}.webp` (variant in path for browsability; use `_default` when variant is empty)
- **Format:** WebP, quality 85
- **Size estimate:** ~30-80KB per cover (after crop from compressed source)
- **Capacity:** ~15,000-30,000 covers within 1GB free tier

**Bucket creation:** Must be created in the Supabase dashboard before deployment. Add to deploy checklist.

## Database Migrations

A single migration file handles all schema changes:

```sql
-- Migration: cover_images_harvest_support.sql

-- 1. Add variant column
ALTER TABLE cover_images ADD COLUMN IF NOT EXISTS variant TEXT DEFAULT '';

-- 2. Backfill existing rows
UPDATE cover_images SET variant = '' WHERE variant IS NULL;

-- 3. Remove duplicate approved covers before adding unique constraint
-- (keeps the most recently approved one)
DELETE FROM cover_images a
USING cover_images b
WHERE a.title_normalized = b.title_normalized
  AND a.issue_number = b.issue_number
  AND COALESCE(a.variant, '') = COALESCE(b.variant, '')
  AND a.status = 'approved'
  AND b.status = 'approved'
  AND a.approved_at < b.approved_at;

-- 4. Add partial unique index for dedup
CREATE UNIQUE INDEX IF NOT EXISTS idx_cover_images_unique_approved
ON cover_images (title_normalized, issue_number, COALESCE(variant, ''))
WHERE status = 'approved';

-- 5. System harvest profile (sentinel row for automated operations)
INSERT INTO profiles (id, display_name, created_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'System Harvest', NOW())
ON CONFLICT (id) DO NOTHING;

-- 6. Add cover_harvested column to scan_analytics
ALTER TABLE scan_analytics ADD COLUMN IF NOT EXISTS cover_harvested BOOLEAN DEFAULT FALSE;
```

**Migration order matters:** Column add → backfill → dedup → unique index → sentinel profile → analytics column.

## Dependencies

- `sharp` (v0.33+) — Server-side image cropping and WebP conversion. Must pass Netlify PoC first.
- Supabase Storage — Create `cover-images` bucket (Supabase dashboard)

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/providers/anthropic.ts` | Add `coverHarvestable` and `coverCropCoordinates` to `IMAGE_ANALYSIS_PROMPT`. Increase `max_tokens` to 1536. |
| `src/lib/providers/gemini.ts` | Same prompt changes as anthropic.ts. Increase `maxOutputTokens` to 1536. |
| `src/lib/providers/types.ts` | Add optional `coverHarvestable` and `coverCropCoordinates` fields to `ImageAnalysisResult` |
| `src/app/api/analyze/route.ts` | Add harvest logic before response, wrapped in Promise.race with 2s timeout |
| `src/lib/coverImageDb.ts` | Add `uploadCoverToStorage()` function for Supabase Storage upload |
| `src/lib/coverImageDb.ts` | Add `harvestCoverFromScan()` orchestrator function with `SYSTEM_HARVEST_PROFILE_ID` |
| `src/lib/coverImageDb.ts` | Update `submitCoverImage()` to accept `variant` parameter and pass to insert |
| `src/lib/coverImageDb.ts` | Update `getCommunityCovers()` to accept and filter by `variant` parameter |
| `src/lib/coverImageDb.ts` | Add `saveComicMetadata()` call after auto-approved inserts |
| `src/lib/analyticsServer.ts` | Add `coverHarvested` field to `ScanAnalyticsRecord` interface |
| `package.json` | Add `sharp` (v0.33+) dependency |
| `supabase/migrations/` | New migration: variant column, unique index, sentinel profile, analytics column |

## Admin Dashboard (Minimal)

Add Supabase Storage usage metric to existing admin usage page:
- Show current storage usage (MB / 1GB)
- Alert thresholds: 70% warning (700MB), 90% critical (900MB)

## Logging and Metrics

**All harvest operations are logged.** Silent to the user, visible in server logs.

```
console.error("[harvest] failed:", err.message)        // On any error
console.log("[harvest] skipped: not slabbed")           // Skip reasons
console.log("[harvest] skipped: not harvestable")
console.log("[harvest] skipped: cover exists")
console.log("[harvest] skipped: guest user")
console.log("[harvest] skipped: bad coordinates")
console.log("[harvest] skipped: bad aspect ratio")
console.log("[harvest] skipped: too small after inset")
console.log("[harvest] skipped: low color variance")
console.log("[harvest] success: {title} #{issue}")      // On success
```

**Analytics:** Add `coverHarvested: boolean` field to the existing `recordScanAnalytics()` call in `src/lib/analyticsServer.ts`. Requires corresponding `cover_harvested` column in `scan_analytics` table (included in migration). This allows tracking harvest rate, skip reasons, and success rate in the admin dashboard and PostHog.

## Cost Impact

| Item | Cost |
|------|------|
| Additional AI API | $0.00 (piggybacking on existing Vision call — same image, same request) |
| Supabase Storage | Free (within 1GB tier) |
| Processing overhead | ~300-800ms per graded scan (crop + validation + WebP + upload + DB write) |
| sharp dependency | Free, MIT licensed |
| Scan response delay | Up to 2s for slabbed books only (typically 300-800ms). Non-slabbed scans unaffected. |

## Validation Rules

- Only harvest from slabbed books (`isSlabbed === true`)
- Only harvest for authenticated users (guests excluded — no accountability)
- `coverHarvestable` must be `true` (AI boolean decision)
- Crop coordinates must be within image bounds (no negative values, no overflow, no NaN)
- **All dimension/ratio checks happen AFTER 4% inset padding is applied:**
  - Crop dimensions: width >= 100px, height >= 150px, area < 90% of original image
  - Aspect ratio: width/height between 0.55 and 0.80 (approximately 2:3 comic cover proportions)
- Color variance: all channel standard deviations must be >= 10 (rejects solid-color garbage crops)
- Skip if community cover already exists for title+issue+variant (enforced by unique index)
- On any error: log and skip (don't break the scan flow)

## Error Handling

All harvest errors are caught and **logged** (not silently swallowed). A failed harvest must never:
- Block the scan response beyond the 2-second timeout
- Cause the scan to fail or return an error
- Show any error to the user
- Retry automatically (if it fails, it fails — next scan of a similar book may succeed)

**Specific failure modes handled:**
- AI returns `coverCropCoordinates` as null or with non-numeric values → skip
- AI returns coordinates outside image bounds → skip
- Inset padding pushes dimensions below minimums → skip
- `sharp` throws on corrupt/edge-case image data → skip
- Supabase Storage upload fails (network, quota) → skip
- Database insert fails (unique constraint = duplicate, RLS, other) → skip
- Timeout (>2 seconds) → abandoned, response proceeds

## Security

- **Public bucket:** Low risk. Images are server-generated WebP files from user photos, cropped and re-encoded by sharp. No user-controlled filenames (UUID generated server-side), no user-controlled content type.
- **Path traversal:** `normalizeTitle()` strips non-alphanumeric characters, preventing `/` or `..` in storage paths.
- **Guest exclusion:** Only authenticated users' scans are eligible. Prevents anonymous submission of adversarial images.
- **Adversarial images:** A crafted image could trick the AI into cropping offensive content. Low probability, mitigated by the color variance check and the post-launch admin review process.

## Known Limitations

- **Title normalization does not strip leading articles.** "The Amazing Spider-Man" and "Amazing Spider-Man" normalize to different keys. This is a pre-existing limitation of `normalizeTitle()` and affects all cover lookups, not just harvesting. Not worth fixing in this spec — would require a broader normalization overhaul.
- **AI coordinate precision is approximate.** Vision-language models estimate pixel positions with roughly +/- 10-30px accuracy on a 1200px image. The 4% inset padding compensates for this but may occasionally crop slightly into the cover artwork. This is acceptable — better than including slab edges.

## Future Maintenance (Post-Launch)

**Timeline:** ~3-6 months post-launch or ~1,000 users, whichever comes first.

- Add admin sampling/review process for harvested cover quality (spot-check random harvests)
- Monitor storage usage trends and plan Supabase Storage upgrade if approaching 1GB
- Evaluate crop quality across real scans — adjust inset padding % if needed
- Review whether boolean `coverHarvestable` is sufficient or needs refinement
- Consider orphaned storage file cleanup (from race condition losers or rejected covers)
- Evaluate whether `normalizeTitle()` should strip leading articles for better dedup

## Testing

### Unit Tests
- **Coordinate validation:** Within bounds, out of bounds, negative values, NaN, floating-point, zero dimensions
- **Aspect ratio validation:** Valid (~2:3), too wide (1:1), too tall (1:4), edge cases
- **Inset padding calculation:** Verify 4% inset produces correct adjusted coordinates; verify edge case where inset pushes below minimums
- **Harvest orchestrator skip conditions:** Not slabbed, `coverHarvestable: false`, guest user, existing cover, bad coordinates, bad aspect ratio, too small after inset, low color variance
- **AI response parsing:** `coverHarvestable` and `coverCropCoordinates` present, missing, wrong types (string instead of number), null values
- **Title normalization for dedup:** "The Amazing Spider-Man" vs "Amazing Spider-Man" — document as known non-collision
- **Variant dedup:** Same title+issue but different variants should not collide; same title+issue+variant should collide
- **submitCoverImage with variant:** Verify variant is stored and queryable
- **getCommunityCovers with variant:** Verify variant filtering works; verify backward compatibility when variant is omitted

### Integration Tests
- Manual test: scan a slabbed book and verify the cover appears in community DB
- Manual test: scan the same slabbed book again and verify it is skipped (dedup)
- Manual test: scan a different variant of the same issue and verify both covers exist
- Verify `comic_metadata` is updated with the harvested cover URL
- Verify `scan_analytics` records `cover_harvested = true` for successful harvests

### Pre-Implementation
- **sharp on Netlify PoC:** Deploy a test route that uses sharp to resize an image. Verify it works before writing harvest code.
