# Cert-First Scan Pipeline for Slabbed Comics

**Date:** April 5, 2026
**Status:** Design — awaiting approval

---

## Problem

The current scan pipeline runs a full AI image analysis (~1.5¢, 12s) on every comic, then overwrites most of the AI-extracted data with cert lookup results for slabbed books. This wastes money and time — the cert label already contains title, issue, publisher, year, grade, variant, signatures, and key info.

## Solution

Split the pipeline into two branches based on early slab detection:

- **Slabbed path:** Cheap slab detection → cert lookup → cache check → focused AI (if needed)
- **Raw path:** Current full pipeline (unchanged)

## Cost Impact

| Scenario | Current | Cert-First |
|----------|---------|------------|
| Slabbed, first scan of this book | 1.5-3.6¢ | ~0.7¢ |
| Slabbed, previously scanned book | 1.5-3.6¢ | ~0.2¢ |
| Slabbed, repeat scan (Anthropic fallback) | 1.5-3.6¢ | ~1.0¢ |
| Raw comic (no change) | 1.5-3.6¢ | 1.5-3.6¢ |

---

## Type Definitions

### SlabDetectionResult

```typescript
interface SlabDetectionResult {
  isSlabbed: boolean;
  gradingCompany: GradingCompany | null; // import from @/types/comic
  certificationNumber: string | null;
}
```

### SlabDetailExtractionResult

```typescript
interface SlabDetailExtractionResult {
  barcode: {
    raw: string | null;
    confidence: "high" | "medium" | "low";
  };
  coverHarvestable: boolean;
  coverCropCoordinates: { x: number; y: number; width: number; height: number } | null;
  writer: string | null;
  coverArtist: string | null;
  interiorArtist: string | null;
}
```

### AICallType Update

Add new call types to the existing `AICallType` union:

```typescript
type AICallType = 
  | "fullAnalysis" 
  | "quickLookup" 
  | "slabDetection" 
  | "slabDetailExtraction";
```

### AIProvider Interface Additions

Add these method signatures to the existing `AIProvider` interface in `src/lib/providers/types.ts`:

```typescript
interface AIProvider {
  // ... existing methods ...
  detectSlab(imageBase64: string): Promise<SlabDetectionResult>;
  extractSlabDetails(imageBase64: string, options?: {
    skipCreators?: boolean;  // true when creators already cached
    skipBarcode?: boolean;   // true when barcode already cataloged
  }): Promise<SlabDetailExtractionResult>;
}
```

### ScanResponseMeta Extension

Extend `ScanResponseMeta.callDetails` with optional fields for new call types, using the same structure as the existing `imageAnalysis` field:

```typescript
interface ScanResponseMeta {
  callDetails: {
    imageAnalysis?: { provider: string; durationMs: number; cost: number };
    slabDetection?: { provider: string; durationMs: number; cost: number };
    slabDetailExtraction?: { provider: string; durationMs: number; cost: number; coverHarvestOnly?: boolean };
  };
}
```

---

## Pipeline: Slabbed Path

```
Image Upload
  ↓
Phase 1: Slab Detection (cheap AI, ~0.2¢)
  → isSlabbed, gradingCompany, certificationNumber
  ↓
  [not slabbed or no cert or gradingCompany not recognized?] → Fall back to current full pipeline
  ↓
Phase 1.5: Grading Company Normalization (free, instant)
  → Normalize gradingCompany to exact value ("CGC", "CBCS", "PGX")
  ↓
Phase 2: Cert Lookup (free, web scrape)
  → title, issue, grade, publisher, year, variant
  → labelType, pageQuality, signatures, keyComments (string)
  ↓
  [cert lookup failed?] → Fall back to current full pipeline
  ↓
Phase 2.5: artComments Creator Parsing (free, instant)
  → Parse artComments from cert lookup for creator names
  → Pre-fill writer/artist fields for cache gate check
  ↓
Phase 3: Key Info DB Lookup (free, instant, 3s timeout)
  → key facts from curated database
  → Merge with keyComments from cert (non-fatal if lookup fails)
  ↓
Phase 4: Metadata Cache Check (free, Redis → Supabase)
  → writer, coverArtist, interiorArtist
  ↓
  [cache has all 3 creator fields?] → Skip Phase 5, go to Phase 5.5
  ↓
Phase 5: Focused AI Call (~0.5¢)
  → UPC barcode from cover art through slab
  → coverHarvestable + coverCropCoordinates
  → writer, coverArtist, interiorArtist
  → Save results to metadata cache
  ↓
Phase 5.5: Cover Harvest Fields (conditional)
  → When Phase 5 was skipped (cache hit), run a minimal AI call for:
     coverHarvestable + coverCropCoordinates ONLY
  → These image-specific fields can't be cached (each photo is different)
  ↓
Phase 6: eBay Price Lookup (existing logic)
  ↓
Phase 7: Cover Pipeline + Harvest (existing logic)
  ↓
Phase 8: Analytics + Response
```

**Cert-First Budget:** 15s for Phases 1–5.5 (slab detection through cover harvest). Phases 6–8 (eBay pricing, cover pipeline, analytics) run under the existing 25s hard deadline using `getRemainingBudget()`. Each phase checks remaining budget before starting. If the 15s cert-first budget is exceeded, return partial results from completed phases and skip to Phase 6.

**Budget degradation:** When budget is constrained, phase timeouts are clamped to `Math.min(phaseTimeout, remainingBudget)`. If remaining budget reaches 0 before Phase 5, skip to Phase 6 — cert data provides title, issue, grade, publisher, year, which is sufficient for eBay pricing. Creators and barcode will be missing but non-fatal.

## Pipeline: Raw Path

No changes. The current full pipeline runs exactly as it does today.

---

## Phase 1: Slab Detection Call

**New function:** `detectSlab()` in provider layer
**Returns:** `SlabDetectionResult`

**Prompt:** Minimal — identify only 3 fields from the image. Constrain `gradingCompany` to return one of: `"CGC"`, `"CBCS"`, `"PGX"`, or `"Other"`.

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
- `gradingCompany === "Other"` or not in `["CGC", "CBCS", "PGX"]` → run current full pipeline
- AI call fails on all providers → run current full pipeline

## Phase 1.5: Grading Company Normalization

**Purpose:** Normalize AI-returned `gradingCompany` to exact known values, accounting for casing and formatting variations.

**Logic:**
1. Uppercase the returned value and strip non-alpha characters
2. Match against known companies: `CGC`, `CBCS`, `PGX`
3. If no match → trigger fallback to full pipeline (treated as unrecognized company)

```typescript
function normalizeGradingCompany(raw: string): "CGC" | "CBCS" | "PGX" | null {
  const cleaned = raw.toUpperCase().replace(/[^A-Z]/g, "");
  if (cleaned === "CGC") return "CGC";
  if (cleaned === "CBCS") return "CBCS";
  if (cleaned === "PGX") return "PGX";
  return null; // triggers fallback
}
```

## Phase 2: Cert Lookup

Uses existing `lookupCertification()` from `src/lib/certLookup.ts`. No changes needed.

**Timeout:** 5s. Note: `lookupCertification()` uses Redis cache with 1-year TTL, so cache hits are instant. The 5s timeout covers cold lookups that require a web scrape.

**Data returned by cert lookup:**
- title, issueNumber, publisher, releaseYear, grade, variant
- labelType (Universal, Signature Series, etc.)
- pageQuality (White, Off-white, etc.)
- gradeDate, graderNotes
- signatures (maps to signedBy)
- keyComments (`string | null` — raw text from cert label, NOT an array)
- artComments (may contain creator info — see Phase 2.5)

**keyComments transformation:** The raw `keyComments` string from `CertLookupResult.data` must be split into an array for use in the response:

```typescript
function parseKeyComments(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[;\n]/)
    .map(s => s.trim())
    .filter(Boolean);
}
```

**Merge strategy with curated DB (Phase 3):**
1. Start with parsed cert `keyComments` as the base array
2. Append entries from curated key info DB
3. Deduplicate by normalizing strings (lowercase, trim) and removing exact matches
4. Cert entries appear first, DB entries appended after

**Fallback:** If cert lookup fails (site down, invalid cert, timeout) → fall back to current full pipeline.

**Cache:** Existing 1-year Redis TTL (cert data never changes).

## Phase 2.5: artComments Creator Parsing

**Purpose:** Extract creator names from cert `artComments` to pre-fill writer/artist fields before the cache gate in Phase 4.

**Logic:**
1. Parse `artComments` string for known patterns (e.g., "Cover art by [Name]", "Interior art by [Name]", "Written by [Name]")
2. Use regex matching for common cert label formats
3. Any extracted names are used as defaults — overridden by metadata cache or Phase 5 AI if available

```typescript
function parseArtComments(artComments: string | null): {
  writer?: string;
  coverArtist?: string;
  interiorArtist?: string;
} {
  if (!artComments) return {};

  const result: { writer?: string; coverArtist?: string; interiorArtist?: string } = {};

  // Pattern: "cover and art" or "cover & art" → single artist for both
  const coverAndArt = artComments.match(/^([\w\s.\-']+?)\s+cover\s+(?:and|&)\s+art$/i);
  if (coverAndArt) {
    result.coverArtist = coverAndArt[1].trim();
    result.interiorArtist = coverAndArt[1].trim();
    return result;
  }

  // Pattern: "Cover by [Name]; Interior art by [Name]"
  const coverBy = artComments.match(/cover\s+by\s+([\w\s.\-']+?)(?:;|$)/i);
  const interiorBy = artComments.match(/interior\s+art\s+by\s+([\w\s.\-']+?)(?:;|$)/i);
  const artBy = artComments.match(/(?:^|\s)art\s+by\s+([\w\s.\-']+?)(?:;|$)/i);

  if (coverBy) result.coverArtist = coverBy[1].trim();
  if (interiorBy) result.interiorArtist = interiorBy[1].trim();
  if (artBy && !result.interiorArtist) result.interiorArtist = artBy[1].trim();

  return result;
}
```

**Real-world examples:**

| artComments string | Parsed output |
|---|---|
| `"Todd McFarlane cover and art"` | `{ coverArtist: "Todd McFarlane", interiorArtist: "Todd McFarlane" }` |
| `"Cover by Jim Lee; Interior art by Scott Williams"` | `{ coverArtist: "Jim Lee", interiorArtist: "Scott Williams" }` |
| `"Art by Jack Kirby"` | `{ interiorArtist: "Jack Kirby" }` |

**Note:** Writer is rarely present in artComments — it focuses on visual artists. Writer typically comes from the metadata cache or Phase 5 AI.

**Impact on Phase 4 gate:** If artComments provides all three creator fields, Phase 5 can be skipped entirely.

## Phase 3: Key Info DB Lookup

Uses existing `lookupKeyInfo()` from `src/lib/keyComicsDatabase.ts` (static in-memory lookup, same function used in the analyze route). No changes needed.

Merges curated key facts (first appearances, deaths, origins) with cert keyComments using the merge strategy defined in Phase 2.

**Timeout:** 3s. If lookup fails or times out, continue without key info — this is non-fatal. The cert `keyComments` still provide baseline key information.

## Phase 4: Metadata Cache Check

Uses existing `getComicMetadata()` from `src/lib/db.ts`. No changes needed.

**Gate logic:** Check if cache (or artComments from Phase 2.5) contains:
- `writer`
- `coverArtist`
- `interiorArtist`

If ALL three creator fields are present → skip Phase 5, go to Phase 5.5 (cover harvest fields only).

If ANY creator fields are missing → proceed to Phase 5.

**Note on barcodes:** Barcode cataloging happens at comic save time (existing flow in `catalogBarcode()`), not during the scan pipeline. The `barcode_catalog` table is keyed by `comic_id`, which doesn't exist yet at scan time. Phase 5 always extracts barcodes when it runs (first scan). On repeat scans where creators ARE cached, Phase 5 is skipped and barcode extraction is skipped too — that's acceptable since the barcode was already cataloged when the comic was first saved.

## Phase 5: Focused AI Call

**New function:** `extractSlabDetails()` in provider layer
**Returns:** `SlabDetailExtractionResult`

**Prompt:** Targeted extraction from the cover artwork visible through the slab:

```json
{
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
- Save creators to metadata cache (Redis + Supabase)
- Store `barcode.raw` in the scan response for use at save time (barcode is cataloged when the comic is saved, not during scan)
- Subsequent scans of same book hit cache → skip this call (except cover harvest fields)

## Phase 5.5: Cover Harvest Fields (Cache Hit Path)

**Purpose:** When Phase 5 is skipped due to a full cache hit, the cover harvest fields (`coverHarvestable`, `coverCropCoordinates`) still need to be extracted because they are image-specific — each photo has different framing, angle, and lighting, so these values cannot be cached.

**Implementation:** Reuses `extractSlabDetails()` with a prompt that only asks for cover harvest fields. The AI naturally returns null for barcode/creators when not asked about them. No new AICallType needed — cost tracking uses the existing `"slabDetailExtraction"` call type.

Extracts only:
- `coverHarvestable: boolean`
- `coverCropCoordinates: { x, y, width, height } | null`

- **Max tokens:** 128
- **Timeout:** 5s
- **Provider:** Same provider order (Gemini → Anthropic fallback)
- **Cost:** ~0.1¢

This ensures cover harvesting works on every scan, even repeat scans of the same book.

## Phases 6-8: Existing Logic

These phases run under the existing 25s hard deadline using `getRemainingBudget()`, not the 15s cert-first budget.

No changes to:
- **eBay price lookup** — uses title/issue/grade/year from cert data
- **Cover pipeline** — Metron verification, community covers, eBay images
- **Cover harvest** — uses coverHarvestable + coordinates from Phase 5 or Phase 5.5
- **Analytics tracking** — add new field `scanPath` and `barcode_extracted` for tracking

### scanPath Values

```typescript
type ScanPath = 
  | "cert-first-cached"    // Slabbed, cache hit, minimal AI for cover harvest only
  | "cert-first-full"      // Slabbed, cache miss, ran Phase 5 focused AI
  | "cert-first-fallback"  // Slabbed detected, but fell back to full pipeline (cert fail, etc.)
  | "full-pipeline";       // Raw comic, standard flow
```

### Analytics Fields

```typescript
{
  scanPath: ScanPath;
  barcode_extracted: boolean;  // Whether a barcode was successfully extracted this scan
}
```

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/providers/anthropic.ts` | Add `detectSlab()` and `extractSlabDetails()` functions with new prompts |
| `src/lib/providers/gemini.ts` | Add `detectSlab()` and `extractSlabDetails()` functions (Gemini is primary provider) |
| `src/lib/providers/types.ts` | Add `SlabDetectionResult`, `SlabDetailExtractionResult` interfaces; add `detectSlab()` and `extractSlabDetails()` method signatures to `AIProvider` interface; update `AICallType` |
| `src/app/api/analyze/route.ts` | Add branching logic after Phase 1: slab detection → cert-first path vs full pipeline; add 15s cert-first budget (Phases 1–5.5) under existing 25s hard deadline; add Phase 1.5 normalization; add Phase 2.5 artComments parsing; add Phase 5.5 cover harvest; extend `callDetails` with `slabDetection` and `slabDetailExtraction` fields |
| `src/lib/metadataCache.ts` | Add `hasCompleteSlabData()` helper to check cache completeness (creator fields only) |
| `src/lib/analyticsServer.ts` | Add `scanPath` and `barcode_extracted` fields to analytics tracking |
| `src/lib/certLookup.ts` | Add `parseKeyComments()` and `parseArtComments()` helper functions |

## Files Unchanged

- `src/lib/keyComicsDatabase.ts` — existing key info, no changes
- `src/lib/ebayBrowse.ts` — existing pricing, no changes
- `src/lib/coverHarvest.ts` — existing harvest, no changes
- `src/lib/db.ts` — existing barcode cataloging, no changes

---

## Edge Cases

| Case | Behavior |
|------|----------|
| Slab detected but no cert number visible | Fall back to full pipeline (`scanPath: "cert-first-fallback"`) |
| Slab detected but gradingCompany is "Other" or unrecognized | Fall back to full pipeline (`scanPath: "cert-first-fallback"`) |
| Cert lookup fails (site down) | Fall back to full pipeline (`scanPath: "cert-first-fallback"`) |
| Cert returns invalid/empty data | Fall back to full pipeline (`scanPath: "cert-first-fallback"`) |
| Key info DB lookup fails or times out (3s) | Continue without curated key info; cert keyComments still used |
| Book scanned before (cache hit) | Skip Phase 5, run Phase 5.5 for cover harvest, cost = ~0.3¢ (`scanPath: "cert-first-cached"`) |
| Barcode not visible through slab | Phase 5 returns `barcode.raw = null`; no barcode cataloged at save time. Future scans still attempt extraction via Phase 5 if creators aren't cached |
| PGX graded book | Cert lookup supports PGX, same flow |
| Non-standard slab (e.g., EGS, HALO) | Slab detected but gradingCompany normalization fails → fallback (`scanPath: "cert-first-fallback"`) |
| Gemini rate-limited | Slab detection uses full fallback chain (Gemini → Anthropic); Anthropic used as fallback |
| artComments contains creator info | Parsed in Phase 2.5; may allow skipping Phase 5 if all creators found |
| Pipeline exceeds 15s cert-first budget | Skip remaining cert-first phases, proceed to Phase 6 under existing 25s hard deadline via `getRemainingBudget()`; log timeout in analytics |

## Testing Strategy

- **Unit tests:** `detectSlab()` and `extractSlabDetails()` prompt/response parsing
- **Unit tests:** `hasCompleteSlabData()` cache check logic (creator fields only)
- **Unit tests:** `normalizeGradingCompany()` with various inputs (casing, whitespace, unknown companies)
- **Unit tests:** `parseKeyComments()` string splitting and deduplication
- **Unit tests:** `parseArtComments()` creator extraction patterns
- **Unit tests:** Branching logic in analyze route (mock providers)
- **Unit tests:** Pipeline timeout budget enforcement
- **Integration test:** Scan slabbed CGC comic end-to-end, verify cert-first path taken
- **Integration test:** Scan raw comic, verify full pipeline unchanged
- **Integration test:** Scan slabbed comic with cert lookup failure, verify fallback
- **Integration test:** Scan previously-scanned slabbed comic, verify Phase 5 skipped but cover harvest runs
- **Integration test:** Scan slabbed comic where artComments provides all creators, verify Phase 5 skipped
- **Analytics verification:** Confirm `scanPath` field recorded correctly with all 4 enum values
- **Analytics verification:** Confirm `barcode_extracted` tracked accurately

## Success Criteria

- Slabbed comic scans cost ≤0.7¢ on first scan, ≤0.3¢ on repeat scans (cover harvest adds ~0.1¢)
- No regression in scan accuracy for slabbed or raw comics
- Fallback to full pipeline is seamless — user never sees a difference
- Barcode extraction rate from slabbed covers improves over current (currently 0%)
- `scanPath` analytics show cert-first path usage across all 4 path types
- Cover harvest works on every scan, including repeat scans of cached books
- Cert-first phases (1–5.5) complete within 15s budget; full pipeline completes within existing 25s hard deadline
