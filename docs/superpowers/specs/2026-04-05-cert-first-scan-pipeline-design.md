# Cert-First Scan Pipeline for Slabbed Comics

**Date:** April 5, 2026
**Status:** Design — awaiting approval

---

## Problem

The current scan pipeline runs a full AI image analysis (~1.5¢, 12s) on every comic, then overwrites most of the AI-extracted data with cert lookup results for slabbed books. This wastes money and time — the cert label already contains title, issue, grade, publisher, year, variant, signatures, and key info.

## Solution

Split the pipeline into two branches based on early slab detection:

- **Slabbed path:** Cheap slab detection → cert lookup → cache check → focused AI (if needed)
- **Raw path:** Current full pipeline (unchanged)

## Cost Impact

| Scenario | Current | Cert-First |
|----------|---------|------------|
| Slabbed, first scan of this book | 1.5-3.6¢ | ~0.7¢ |
| Slabbed, previously scanned book | 1.5-3.6¢ | ~0.2¢ |
| Raw comic (no change) | 1.5-3.6¢ | 1.5-3.6¢ |

---

## Pipeline: Slabbed Path

```
Image Upload
  ↓
Phase 1: Slab Detection (cheap AI, ~0.2¢)
  → isSlabbed, gradingCompany, certificationNumber
  ↓
  [not slabbed or no cert?] → Fall back to current full pipeline
  ↓
Phase 2: Cert Lookup (free, web scrape)
  → title, issue, grade, publisher, year, variant
  → labelType, pageQuality, signatures, keyComments
  ↓
  [cert lookup failed?] → Fall back to current full pipeline
  ↓
Phase 3: Key Info DB Lookup (free, instant)
  → key facts from curated database
  ↓
Phase 4: Metadata Cache Check (free, Redis → Supabase)
  → barcode, writer, coverArtist, interiorArtist
  ↓
  [cache has barcode + creators?] → Skip Phase 5, go to Phase 6
  ↓
Phase 5: Focused AI Call (~0.5¢)
  → UPC barcode from cover art through slab
  → coverHarvestable + coverCropCoordinates
  → writer, coverArtist, interiorArtist
  → Save results to metadata cache
  ↓
Phase 6: eBay Price Lookup (existing logic)
  ↓
Phase 7: Cover Pipeline + Harvest (existing logic)
  ↓
Phase 8: Analytics + Response
```

## Pipeline: Raw Path

No changes. The current full pipeline runs exactly as it does today.

---

## Phase 1: Slab Detection Call

**New function:** `detectSlab()` in provider layer

**Prompt:** Minimal — identify only 3 fields from the image:

```json
{
  "isSlabbed": true,
  "gradingCompany": "CGC",
  "certificationNumber": "3809701007"
}
```

- **Max tokens:** 128
- **Timeout:** 5s
- **Provider:** Same provider order as full pipeline (Gemini → Anthropic fallback)
- **Cost:** ~0.2¢

**Fallback triggers:**
- `isSlabbed = false` → run current full pipeline
- `certificationNumber = null` → run current full pipeline
- AI call fails on all providers → run current full pipeline

## Phase 2: Cert Lookup

Uses existing `lookupCertification()` from `src/lib/certLookup.ts`. No changes needed.

**Data returned by cert lookup:**
- title, issueNumber, publisher, releaseYear, grade, variant
- labelType (Universal, Signature Series, etc.)
- pageQuality (White, Off-white, etc.)
- gradeDate, graderNotes
- signatures (maps to signedBy)
- keyComments (maps to keyInfo array)

**Fallback:** If cert lookup fails (site down, invalid cert, timeout) → fall back to current full pipeline.

**Cache:** Existing 1-year Redis TTL (cert data never changes).

## Phase 3: Key Info DB Lookup

Uses existing `lookupKeyInfo()` from `src/lib/keyComicsDatabase.ts`. No changes needed.

Merges curated key facts (first appearances, deaths, origins) with cert keyComments.

## Phase 4: Metadata Cache Check

Uses existing `getComicMetadata()` from `src/lib/metadataCache.ts`. No changes needed.

**Gate logic:** Check if cache contains:
- `barcode` (UPC from cover) — or null if previously determined no barcode visible
- `writer`
- `coverArtist`
- `interiorArtist`

If ALL are present → skip Phase 5 entirely. The scan costs only ~0.2¢ (slab detection).

If ANY are missing → proceed to Phase 5.

## Phase 5: Focused AI Call

**New function:** `extractSlabDetails()` in provider layer

**Prompt:** Targeted extraction from the cover artwork visible through the slab:

```json
{
  "barcodeNumber": "75960608936802211",
  "barcode": {
    "raw": "75960608936802211",
    "confidence": "medium"
  },
  "coverHarvestable": true,
  "coverCropCoordinates": {"x": 120, "y": 280, "width": 450, "height": 680},
  "writer": "Greg Pak",
  "coverArtist": "Stonehouse",
  "interiorArtist": "Robert Gill"
}
```

- **Max tokens:** 384
- **Timeout:** 8s
- **Provider:** Same provider order as full pipeline (Gemini → Anthropic fallback)
- **Cost:** ~0.5¢

**After response:**
- Save barcode + creators to metadata cache (Redis + Supabase)
- Catalog barcode to `barcode_catalog` table (existing `catalogBarcode()`)
- Subsequent scans of same book hit cache → skip this call

## Phases 6-8: Existing Logic

No changes to:
- **eBay price lookup** — uses title/issue/grade/year from cert data
- **Cover pipeline** — Metron verification, community covers, eBay images
- **Cover harvest** — uses coverHarvestable + coordinates from Phase 5 (or skipped if no Phase 5)
- **Analytics tracking** — add new field `scanPath: "cert-first" | "full-pipeline"` for tracking

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/providers/anthropic.ts` | Add `detectSlab()` and `extractSlabDetails()` functions with new prompts |
| `src/lib/providers/gemini.ts` | Add `detectSlab()` and `extractSlabDetails()` functions (Gemini is primary provider) |
| `src/lib/providers/types.ts` | Add function signatures to provider interface |
| `src/app/api/analyze/route.ts` | Add branching logic after Phase 1: slab detection → cert-first path vs full pipeline |
| `src/lib/metadataCache.ts` | Add `hasCompleteSlabData()` helper to check cache completeness |
| `src/lib/analyticsServer.ts` | Add `scanPath` field to analytics tracking |

## Files Unchanged

- `src/lib/certLookup.ts` — existing cert lookup, no changes
- `src/lib/keyComicsDatabase.ts` — existing key info, no changes
- `src/lib/ebayBrowse.ts` — existing pricing, no changes
- `src/lib/coverHarvest.ts` — existing harvest, no changes
- `src/lib/db.ts` — existing barcode cataloging, no changes

---

## Edge Cases

| Case | Behavior |
|------|----------|
| Slab detected but no cert number visible | Fall back to full pipeline |
| Cert lookup fails (site down) | Fall back to full pipeline |
| Cert returns invalid/empty data | Fall back to full pipeline |
| Book scanned before (cache hit) | Skip Phase 5, cost = ~0.2¢ |
| Barcode not visible through slab | Store null in cache, skip on future scans |
| PGX graded book | Cert lookup supports PGX, same flow |
| Non-standard slab (e.g., EGS, HALO) | Slab detected but cert lookup may fail → fallback |
| Gemini rate-limited (current issue) | Slab detection uses primary provider only, unaffected |

## Testing Strategy

- **Unit tests:** `detectSlab()` and `extractSlabDetails()` prompt/response parsing
- **Unit tests:** `hasCompleteSlabData()` cache check logic
- **Unit tests:** Branching logic in analyze route (mock providers)
- **Integration test:** Scan slabbed CGC comic end-to-end, verify cert-first path taken
- **Integration test:** Scan raw comic, verify full pipeline unchanged
- **Integration test:** Scan slabbed comic with cert lookup failure, verify fallback
- **Analytics verification:** Confirm `scanPath` field recorded correctly

## Success Criteria

- Slabbed comic scans cost ≤0.7¢ on first scan, ≤0.2¢ on repeat scans
- No regression in scan accuracy for slabbed or raw comics
- Fallback to full pipeline is seamless — user never sees a difference
- Barcode extraction rate from slabbed covers improves over current (currently 0%)
- `scanPath` analytics show cert-first path usage
