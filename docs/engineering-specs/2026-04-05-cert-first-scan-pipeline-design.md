# Cert-First Scan Pipeline for Slabbed Comics

**Date:** April 5, 2026
**Status:** Design — updated with caching architecture, data persistence, and CGC Cloudflare mitigation (Apr 7, 2026)

> **Apr 23, 2026 update:** CGC cert lookup activation deferred post-launch pending ZenRows ROI decision. **CBCS + PGX paths fully active in production.** Uncached CGC certs continue to fall back to the full AI pipeline. Metron verification has been fully removed from the scan flow as of Apr 23, 2026 — any references to Metron below (e.g., cover pipeline candidate list, verification steps) describe historical behavior only.

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
  labelColor: "blue" | "yellow" | "purple" | "green" | "red" | null;
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
  → isSlabbed, gradingCompany, certificationNumber, labelColor
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

## Data Persistence & Caching Architecture

The pipeline uses three distinct caching layers. Understanding how they interact is critical — the first scan of any issue populates the issue-level cache, and all subsequent scans of the same issue (regardless of cert number) benefit from that cache.

### Layer 1: Cert-Level Cache (Redis)
- **Key pattern:** `cache:cert:{company}-{certNumber}` (e.g., `cache:cert:cgc-3986843008`)
- **TTL:** 1 year
- **Data:** Full cert lookup response — title, issue, grade, publisher, year, variant, labelType, pageQuality, signatures, keyComments, artComments, gradeDate, graderNotes
- **Written by:** `lookupCertification()` in `src/lib/certLookup.ts` (fire-and-forget after successful web scrape)
- **Read by:** Phase 2 — checked before making a web scrape request
- **Purpose:** Avoids re-scraping the same cert from CGC/CBCS/PGX. Since cert data is immutable (a graded book's grade never changes), 1-year TTL is appropriate.
- **Important:** Cert numbers are unique per physical book. Two copies of ASM #300 have different cert numbers. This cache only helps if the exact same book is scanned again, which is rare in production. The real cost savings come from Layer 2.

### Layer 2: Issue-Level Cache (Redis, 7-day TTL)
- **Key pattern:** `cache:comic:{normalizedTitle}|{normalizedIssueNumber}` (e.g., `cache:comic:amazing spider-man|300`)
- **TTL:** 7 days
- **Data:** title, issueNumber, publisher, releaseYear, writer, coverArtist, interiorArtist, keyInfo, priceData, coverImageUrl
- **Written by:** End-of-route save in `src/app/api/analyze/route.ts` via `cacheSet()` — runs after EVERY successful scan (cert-first or standard)
- **Read by:** Phase 4 metadata cache check — checked via `cacheGet()` before the expensive Phase 5 AI call
- **Purpose:** Shares issue-level metadata across all scans of the same issue. The first person to scan any ASM #300 populates this cache. Every subsequent ASM #300 scan (different cert number, different user) gets an instant cache hit on creators, publisher, year, and key info — skipping the expensive Phase 5 AI call.

### Layer 3: Issue-Level Permanent Store (Supabase `comic_metadata` table)
- **Key:** Unique constraint on `(title, issue_number)`, both normalized
- **TTL:** Permanent (no expiry)
- **Data:** Same fields as Layer 2, plus `lookup_count` analytics
- **Written by:** End-of-route save via `saveComicMetadata()` — runs in parallel with Layer 2 Redis write
- **Read by:** Phase 4 metadata cache check — checked via `getComicMetadata()` as fallback when Layer 2 Redis misses (e.g., after 7-day TTL expiry)
- **Purpose:** Permanent fallback. When a Redis key expires after 7 days, the Supabase row is still there. On cache miss, the data is read from Supabase and backfilled into Redis.

### Two-Layer Lookup Pattern (Phase 4)

```
Phase 4: Check issue-level cache
  ↓
Layer 2: Redis (cache:comic:amazing spider-man|300)
  → HIT? Use cached metadata, backfill nothing
  → MISS ↓
Layer 3: Supabase (comic_metadata WHERE title='amazing spider-man' AND issue_number='300')
  → HIT? Use DB metadata, backfill Redis (fire-and-forget)
  → MISS ↓
No cached metadata available — proceed to Phase 5
```

### End-of-Route Save (All Scan Paths)

After every successful scan completes — whether cert-first or standard pipeline — the route saves issue-level metadata to both Layer 2 and Layer 3 in parallel:

```
End of route:
  ↓
buildMetadataSavePayload(comicDetails)
  → Extracts: title, issueNumber, publisher, releaseYear, writer, coverArtist, interiorArtist, keyInfo, coverImageUrl
  → Returns null if title or issueNumber missing (no save)
  ↓
Promise.all([
  saveComicMetadata(payload),              // Layer 3: Supabase (permanent)
  cacheSet(key, payload, "comicMetadata"), // Layer 2: Redis (7-day TTL)
])
```

This is the mechanism that connects cert lookups to the issue-level cache. When the first ASM #300 is scanned:
1. Cert lookup returns title, publisher, year, grade (cert-specific)
2. artComments parsing extracts creators
3. Phase 5 AI fills any remaining creators
4. End-of-route save persists ALL of this to `cache:comic:amazing spider-man|300` (Redis) and `comic_metadata` table (Supabase)
5. The next ASM #300 scan (different cert) hits the issue cache in Phase 4 → creators already present → Phase 5 skipped

### Fill-Only Merge Strategy

When cached metadata is found in Phase 4, it is merged into `comicDetails` using a **fill-only strategy** (`mergeMetadataIntoDetails()` in `src/lib/metadataCache.ts`):
- Only populates fields that are currently empty/null in `comicDetails`
- Never overwrites data from the cert lookup or AI
- Mergeable fields: publisher, releaseYear, writer, coverArtist, interiorArtist
- keyInfo: only fills if `comicDetails.keyInfo` is empty/falsy

This ensures cert-specific data (grade, signatures, label type) is never overwritten by cached data from a different cert.

### What Cannot Be Cached

These fields are unique per scan and must be extracted fresh every time:
- **Grade, pageQuality, labelType, signatures** — unique per cert (from Phase 2 cert lookup)
- **coverHarvestable, coverCropCoordinates** — unique per photo (from Phase 5 or 5.5 AI call)
- **Barcode** — extracted per photo, cataloged at save time (from Phase 5 AI call)

---

## Phase 1: Slab Detection Call

**New function:** `detectSlab()` in provider layer
**Returns:** `SlabDetectionResult`

**Prompt:** Minimal — identify 4 fields from the image. Constrain `gradingCompany` to return one of: `"CGC"`, `"CBCS"`, `"PGX"`, or `"Other"`. Also detect the label color for enrichment.

```json
{
  "isSlabbed": true,
  "gradingCompany": "CGC",
  "certificationNumber": "3809701007",
  "labelColor": "blue"
}
```

**Label color detection:** The `labelColor` field identifies the grading label color, which maps to label types:
- `"blue"` — Standard/Universal grade
- `"yellow"` — Signature Series (professionally witnessed signatures)
- `"purple"` — Restored (comic has been professionally restored)
- `"green"` — Qualified (grade with a qualifying defect noted)
- `"red"` — Conserved/Modern (conservation or modern grading)
- `null` — Not identifiable or not slabbed

This color is used in Phase 2 to enrich the label type when cert lookup provides it, and in the analyze route to infer `restored` or `qualified` status from the color when cert data lacks explicit label type info.

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

**Known issue — CGC Cloudflare 403 blocking (as of April 2026):** CGC's website (`cgccomics.com`) is blocking all server-side cert lookups with Cloudflare 403 responses. This means all CGC cert lookups for uncached certs will fail and trigger the fallback to the full pipeline. Previously cached CGC certs (in Redis with 1-year TTL) continue to work. CBCS and PGX lookups are unaffected.

**Validated mitigation (Apr 7, 2026):** ZenRows API with `mode=auto&wait=5000` successfully bypasses Cloudflare and returns full cert page HTML. Tested against cert #3986843008 — returned complete data including grade, title, publisher, and all metadata fields. Implementation is pending partner cost review of ZenRows subscription ($49/mo for 250K credits = ~10,000 cert lookups; 25 credits per request). See BACKLOG.md "Fix CGC Cert Lookup Cloudflare 403 Errors" for full details.

**Services tested and results:**
- ❌ Direct fetch with browser headers — 403
- ❌ ScraperAPI (standard + premium) — 500
- ❌ ZenRows (`js_render=true&antibot=true`) — timeout
- ✅ ZenRows (`mode=auto&wait=5000`) — 200 with full cert data

**Current fallback behavior:** The cert-first pipeline gracefully falls back to the full pipeline, so user experience is not degraded — only cost savings are lost for uncached CGC certs.

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

**Cache:** Layer 1 (cert-level) — existing 1-year Redis TTL keyed by cert number. See "Data Persistence & Caching Architecture" for how cert data also flows into the issue-level cache (Layers 2 & 3) at end-of-route.

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

## Phase 4: Metadata Cache Check (Issue-Level)

Uses the two-layer lookup pattern described in "Data Persistence & Caching Architecture":
1. Check Redis `cache:comic:{title}|{issue}` (Layer 2, 7-day TTL)
2. On miss, check Supabase `comic_metadata` table (Layer 3, permanent)
3. On Supabase hit, backfill Redis (fire-and-forget)

Uses `generateComicMetadataCacheKey()` from `src/lib/cache.ts` and `getComicMetadata()` from `src/lib/db.ts`. No changes needed to these functions.

**This is the key optimization for repeat issues.** When a different copy of the same comic is scanned (e.g., a second ASM #300 with a different cert number), this cache check finds the issue-level metadata saved by the first scan's end-of-route save. The cert lookup (Phase 2) still runs to get this specific book's grade, but the expensive Phase 5 AI call can be skipped if creators are already cached.

**Gate logic:** After merging cached metadata into `comicDetails`, check if all three creator fields are present:
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
- Creators extracted here are stored in `comicDetails` and persisted to the issue-level cache (Layers 2 & 3) by the end-of-route save — see "Data Persistence & Caching Architecture"
- Store `barcode.raw` in the scan response for use at save time (barcode is cataloged when the comic is saved, not during scan)
- Subsequent scans of the same **issue** (any cert number) hit the issue-level cache in Phase 4 → skip this call (except cover harvest fields via Phase 5.5)

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
| CGC Cloudflare 403 blocking (current) | All uncached CGC cert lookups fail → fall back to full pipeline (`scanPath: "cert-first-fallback"`). Cached CGC certs still work. CBCS/PGX unaffected. ZenRows API validated as mitigation — pending cost review. |
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
