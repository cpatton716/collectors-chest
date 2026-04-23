# Cover Image Harvesting from Graded Book Scans — Design

**Status:** Superseded by `docs/engineering-specs/2026-04-02-cover-image-harvesting-design.md`
**Date:** February 25, 2026

> **Apr 23, 2026 update:** This original design was superseded by the Apr 2, 2026 Rev 3 spec. For current behavior (including the new `coverCropValidator.ts` aspect-ratio guard shipped Apr 23), see the newer spec. Preserved for historical reference only.

---

## Goal

Automatically harvest clean cover images from graded book (CGC/CBCS) scans and populate the community cover database — zero user friction, zero extra API cost.

## Architecture

Piggyback on the existing Claude Vision analyze call. When a user scans a graded book, Claude already inspects the image. We add instructions to also assess cover image quality and return crop coordinates for the cover area (excluding the hard case, label, and reflections). If quality meets the threshold, we crop server-side, upload to Supabase Storage, and auto-approve into the community cover database.

## Eligible Books

Graded books only (CGC/CBCS slabs). Raw book photos are excluded — too much variance in quality (fingers, shadows, partial covers, angles).

## Scan Flow Changes

**Current flow:**
1. User photographs slab → base64 sent to `/api/analyze`
2. Claude Vision identifies title, issue, grade, publisher, price
3. Response returned → user reviews and saves

**New additions to the same flow:**
1. Claude Vision prompt expanded to also return:
   - `coverQuality` (1-10): clarity, lighting, glare, color accuracy, completeness
   - `coverCrop` coordinates: `{ x, y, width, height }` in pixels for the cover area only
2. Analyze route checks: if `graded: true` AND `coverQuality >= 7` → harvest
3. Server-side: crop image using coordinates → convert to WebP → upload to Supabase Storage → submit to community cover database as auto-approved
4. If quality < 7 or not graded → skip silently

**User experience:** Completely invisible. No extra screens, prompts, or delay.

## Image Storage

- **Supabase Storage bucket:** `cover-images`
- **File path:** `{normalized_title}/{issue_number}/{uuid}.webp`
- **Format:** WebP (50-70% smaller than JPEG)
- **Size estimate:** ~50-100KB per cover
- **Capacity:** ~10,000-20,000 covers within 1GB free tier

## Quality Assessment

Claude rates each graded book scan on:
- Clarity/sharpness (not blurry)
- Lighting (well-lit, not dark)
- Glare/reflections (minimal plastic glare on slab)
- Color accuracy (not washed out or over-saturated)
- Cover completeness (full cover visible, not cut off)

**Threshold:** 7 out of 10. Below that, the image is too degraded to serve as a reference cover.

## Community Database Integration

- Cropped cover auto-submitted with `status: 'approved'` (Claude already vetted quality)
- If a community cover already exists for that title+issue, skip (don't overwrite)
- Future lookups (CSV import, any cover search) find this cover via `getCommunityCovers()`

## Storage Usage Alert

- Add Supabase Storage usage metric to admin Usage page
- Free tier limit: 1GB
- Alert thresholds: 70% warning (700MB), 90% critical (900MB)

## Cost Impact

| Item | Cost |
|------|------|
| Additional Claude API | $0.00 (piggybacking on existing Vision call) |
| Supabase Storage | Free (within 1GB tier) |
| Processing overhead | ~100-200ms per graded scan (crop + upload) |

## Files to Modify

- `src/app/api/analyze/route.ts` — expand Claude prompt, add harvest logic
- `src/lib/coverImageDb.ts` — add Supabase Storage upload function
- `src/app/api/admin/usage/route.ts` — add storage usage metric
- `src/app/api/admin/usage/check-alerts/route.ts` — add storage alert threshold

## Open Considerations

- **Duplicate covers:** If multiple users scan the same graded comic, only the first high-quality cover is kept
- **Variant detection:** Claude already identifies variants during scan — the cover is tied to the specific variant
- **Base64 to buffer conversion:** Node.js `Buffer.from(base64, 'base64')` for the crop, then sharp or canvas for WebP conversion
- **Image processing library:** May need `sharp` (Node.js image processing) as a dependency for cropping and WebP conversion
