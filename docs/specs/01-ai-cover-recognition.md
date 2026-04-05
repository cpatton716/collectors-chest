# Spec: AI Cover Recognition & Multi-Provider Fallback

> **Feature #1** from [TECHNICAL_FEATURES.md](../TECHNICAL_FEATURES.md)
> **Last Updated:** 2026-04-05
> **Status:** Production

---

## Overview

The AI Cover Recognition system is a 13-phase pipeline that identifies comic books from cover photos, enriches them with metadata from multiple sources, and returns real-time market pricing. It is the core feature of Collectors Chest — every scan, CSV import lookup, and Key Hunt query flows through some or all of these phases.

---

## User-Facing Flow

1. User takes a photo (live camera) or uploads an image (file picker)
2. App shows analyzing spinner with rotating comic facts
3. Results appear on a review screen with all identified fields editable
4. User confirms and saves to collection

---

## Architecture Diagram

**Image Input (Camera or Upload)**

↓

**[Phase 1] Rate Limit + Scan Slot Reservation**

↓

**[Phase 2] Image Hash Cache (SHA-256)** -----→ HIT: Skip to Phase 5
- Reuse prior AI result

↓

**[Phase 3] AI Vision Analysis (Call 1)**
- Primary: Gemini Flash
- Fallback: Claude Sonnet

↓

**[Phase 4] Low-Confidence Retry**
- If confidence="low", try other provider

↓

**[Phase 5] Barcode Parsing**
- UPC structure: prefix / item / check / addon
- Variant mapping from addon digits

↓

**[Phase 6] Barcode Catalog Lookup**
- Crowd-sourced DB of verified barcode-to-comic mappings

↓

**[Phase 7] Cert Verification (if slabbed)**
- Scrape CGC/CBCS/PGX by cert number
- Cert data OVERRIDES AI data

↓

**[Phase 8] Key Comics Database**
- Curated local lookup (free, instant)
- If found: skip AI verification call

↓

**[Phase 9] Metadata Cache** ← runs in parallel with Phase 10
- Redis (7d) → Supabase (permanent)
- Fill-only merge (never overwrites)

**[Phase 10] Metron Verification** ← runs in parallel with Phase 9
- Fire-and-forget, 3s timeout
- Boosts confidence if verified

↓

**[Phase 11] AI Verification (Call 2)** — CONDITIONAL
- Only if gaps remain after cache merge
- Fills: creators, publisher, year, key info

↓

**[Phase 12] eBay Pricing**
- Active listings → outlier filter → median
- Grade multiplier extrapolation (6 grades)

↓

**[Phase 13] Cover Image Pipeline**
- Community covers → eBay images → Open Library
- Gemini validates each candidate

↓

**[Phase 14] Cover Harvesting (if slabbed + harvestable)**
- Crop cover from slab → WebP → Supabase Storage → community DB
- 2s timeout, fire-and-forget

↓

**Save metadata to cache + Record analytics + Return response**

---

## Phase Details

### Phase 1: Gate Checks

**Purpose:** Prevent abuse and enforce tier limits before any expensive operations.

| Check | Details |
|-------|---------|
| Rate limit | 5 requests/minute per user or IP (Upstash Redis sliding window) |
| Scan slot reservation | Atomic check-and-increment on `profiles.scans_used_this_month` |
| Guest validation | `x-guest-scan-count` header, max 5 scans (+ up to 5 bonus via email capture) |

**Tier limits:**
- Guest: 5 total scans
- Free: 10/month (resets 1st of month) + purchased 10-packs ($1.99, never expire)
- Premium/Trial: Unlimited

**On failure later in pipeline:** Scan slot is released via `releaseScanSlot()` so the user isn't charged for a failed scan.

---

### Phase 2: Image Hash Cache

**Purpose:** Skip all AI calls if this exact image was scanned before.

- **Hash:** SHA-256 of base64 image data
- **Cache key:** `cache:ai:{hash}`
- **TTL:** 30 days
- **Cached fields:** title, issueNumber, publisher, releaseYear, variant, writer, coverArtist, interiorArtist, isSlabbed, grade, gradingCompany, certificationNumber, keyInfo
- **On hit:** Jump directly to Phase 5 (barcode parsing) with cached AI results

---

### Phase 3: AI Vision Analysis (Call 1)

**Purpose:** Core comic identification from cover image.

**Provider order:** Gemini Flash (primary) -> Claude Sonnet (fallback)
- Gemini is primary: more accurate for comics in testing, 5x cheaper

**Timeouts:**
- Primary: 12s (or remaining budget, whichever is less)
- Fallback: 10s (or remaining budget)

**What the AI extracts:**

| Category | Fields |
|----------|--------|
| Identity | title (full, including subtitles), issueNumber, variant, publisher, releaseYear |
| Creators | writer, coverArtist, interiorArtist |
| Grading | isSlabbed, gradingCompany (CGC/CBCS/PGX), grade, certificationNumber, isSignatureSeries, signedBy |
| Barcode | raw digits (12-17), confidence (high/medium/low) |
| Cover harvest | coverHarvestable (graded books only), coverCropCoordinates |
| Confidence | high / medium / low |

**Variant detection checklist** (from prompt):
- Cover letters (A/B/C), ratio variants (1:10, 1:25, 1:50)
- Print variants (2nd/3rd Print), edition variants (Newsstand, Direct)
- Special covers (Foil, Hologram, Glow in Dark, Virgin, Sketch, Blank)
- Creator variants, store exclusives (NYCC, ComicsPro)
- Format variants (Director's Cut, Facsimile, Reprint)

**Fallback trigger:** Primary provider timeout, rate limit, or server error. Non-retryable errors (`bad_request`, `content_policy`) do NOT trigger fallback.

---

### Phase 4: Low-Confidence Retry

**Purpose:** Get a second opinion when the primary provider isn't sure.

- **Trigger:** `confidence === "low"` AND fallback provider available AND 5s+ budget remaining
- **Behavior:** Re-run Call 1 with the alternate provider. Take whichever result has better confidence.
- **Flag:** Sets `cerebro_assisted: true` in response metadata for debugging

---

### Phase 5: Barcode Parsing

**Purpose:** Extract structured data from UPC digits detected by AI.

**UPC-A structure (12-17 digits):**

```
Digits 0-4:   Publisher code (upcPrefix)
Digits 5-10:  Item identifier (itemNumber)
Digit 11:     Check digit
Digits 12-14: Issue number (addonIssue) — optional
Digits 15-16: Variant code (addonVariant) — optional
```

**Variant mapping:** First digit of addonVariant -> cover letter (1=A, 2=B, 3=C...). Only applied if AI didn't already detect a variant.

---

### Phase 6: Barcode Catalog Lookup

**Purpose:** Use crowd-sourced verified barcode-to-comic mappings to supplement or validate AI results.

**Table:** `barcode_catalog`

| Column | Purpose |
|--------|---------|
| raw_barcode | Full UPC string |
| upc_prefix, item_number, check_digit, addon_issue, addon_variant | Parsed components |
| confidence | high / medium / low |
| status | auto_approved / pending_review / approved |
| submitted_by | User who verified (via save-to-collection) |

**Lookup priority:**
1. Exact match on full barcode
2. Prefix match (without check digit) if exact miss

**Only queries** `auto_approved` or `approved` entries. Pending entries are invisible to lookups.

**Cataloging happens at save time** (not scan time) — the user reviewing and saving acts as implicit human verification. High-confidence barcodes are auto-approved; medium/low go to admin review queue.

---

### Phase 7: Certificate Verification (Graded Books)

**Purpose:** For slabbed comics, scrape the grading company's website to get authoritative data.

**Trigger:** `isSlabbed === true` AND `certificationNumber` present AND `gradingCompany` set

**Supported companies:**

| Company | URL Pattern | Cert Format |
|---------|-------------|-------------|
| CGC | `cgccomics.com/certlookup/{cert}/` | 7-10 digits |
| CBCS | `cbcscomics.com/grading-notes/{cert}` | Alphanumeric with dashes |
| PGX | `pgxcomics.com/cert/verify/{cert}` | 5-7 digits |

**Auto-detection:** `detectGradingCompany()` identifies company from cert number format.

**Data extracted:** title, issueNumber, grade, pageQuality, labelType, gradeDate, graderNotes, signatures, keyComments

**Merge rule:** Cert data **overrides** AI data for overlapping fields (grade, title, issue, etc.). This is the only phase where AI results get overwritten, not just filled.

**Cache:** 1-year TTL in Redis (certificates don't change).

---

### Phase 8: Key Comics Database

**Purpose:** Fast, free lookup of key issue information (first appearances, deaths, origin stories).

- Curated local database — no API call, no cost
- If found: sets `keyInfoSource = "database"` and **skips the AI verification call** (Phase 11)
- This is the preferred source for key info — verified by humans, not AI

---

### Phase 9: Metadata Cache

**Purpose:** Reuse previously identified comic data to skip AI calls on future scans of the same title+issue.

**Two-layer cache:**

| Layer | TTL | Lookup |
|-------|-----|--------|
| Redis | 7 days | Fast, checked first |
| Supabase (`comic_metadata` table) | Permanent | Fallback if Redis miss; backfills Redis on hit |

**Cache key:** Normalized `title|issueNumber`

**Merge strategy:** Fill-only — never overwrites existing fields. Fills: publisher, releaseYear, writer, coverArtist, interiorArtist, keyInfo, coverImageUrl.

**Shared repository:** `comic_metadata` is global across all users. Every scan enriches the shared cache for future lookups by any user.

---

### Phase 10: Metron Verification (Parallel)

**Purpose:** Independent verification that the AI-identified comic exists in the Metron comic database.

- **Runs in parallel** with Phase 9 (fire-and-forget via `Promise.allSettled`)
- **Timeout:** 3 seconds hard limit
- **Auth:** Basic Auth with METRON_USERNAME/METRON_PASSWORD
- **On success:**
  - Boost confidence to "high" (independent confirmation)
  - Use Metron cover image if no cover found yet
  - Store `metronId` for future reference
- **On failure:** Silent — returns safe default, zero impact on scan

---

### Phase 11: AI Verification & Enrichment (Call 2) — Conditional

**Purpose:** Fill remaining gaps that cache and database lookups couldn't resolve.

**Trigger:** Only runs if ALL of these are true:
- title and issueNumber exist (AI at least partially identified the comic)
- AND one or more of: missing creators, missing publisher/year, missing keyInfo

**Skipped when:**
- Key comics database already provided keyInfo (Phase 8)
- Metadata cache filled all missing fields (Phase 9)
- Time budget insufficient (<3s remaining)

**Timeouts:** Primary 8s, fallback 6s (or remaining budget)

**Prompt sends:** Known fields + list of specific missing fields for targeted enrichment.

**Merge rule:** Fill-only (same as cache merge). Never overwrites existing fields.

---

### Phase 12: eBay Pricing

**Purpose:** Real-time market pricing from active eBay listings.

**Flow:**
1. Check Redis cache (key: `title|issue|grade|slabbed|company`, TTL: 12h)
2. If miss: OAuth token -> eBay Browse API search
3. Category fallback: Comics (259104) -> Collectibles (63) -> No filter
4. Require minimum 3 listings for valid pricing
5. Outlier filtering: remove prices outside 0.2x - 3.0x of raw median
6. Calculate filtered median, high, low

**Grade extrapolation:** Single eBay lookup generates prices for 6 grades via multipliers (relative to 9.4 NM baseline):

| Grade | Label | Raw Multiplier | Slabbed Multiplier |
|-------|-------|---------------|-------------------|
| 9.8 | NM/M | 2.5x | 3.0x |
| 9.4 | NM | 1.0x (baseline) | 1.3x |
| 8.0 | VF | 0.55x | 0.7x |
| 6.0 | F | 0.35x | 0.45x |
| 4.0 | VG | 0.2x | 0.25x |
| 2.0 | G | 0.1x | 0.15x |

**Cache behavior:**
- Successful results: 12-hour TTL
- "No data" marker: 1-hour TTL (retry sooner as new listings may appear)

---

### Phase 13: Cover Image Pipeline

**Purpose:** Find a clean cover image when Metron and cache didn't provide one.

**Source priority:**
1. Community covers (`cover_images` table) — trusted, no validation needed
2. eBay listing images — from Browse API results
3. Open Library — public book cover API

**Gemini validation:** Each candidate image (from sources 2-3) is sent to Gemini with the prompt "Is this a cover of {title} #{issue}?" Accepts variant covers, reprints, and grading slabs.

**Safety checks:** HTTPS only, no private IPs, allowed hosts whitelist, 5MB size limit, MIME type validation via magic bytes.


### Phase 14: Cover Harvesting (Graded Books Only)

**Purpose:** Automatically extract clean cover artwork from slabbed comic scans and populate the community cover database — zero user friction, zero extra API cost.

**Trigger:** `isSlabbed === true` AND `coverHarvestable === true` (from Phase 3 AI response)

**Runs:** Pre-response with a 2-second timeout. If harvest takes longer, the scan response returns normally and the harvest is abandoned.

**Pipeline:**
1. Eligibility check (authenticated user, slabbed, harvestable, coordinates present)
2. Duplicate check — skip if community cover already exists for title+issue+variant
3. Decode image, validate crop coordinates against image bounds
4. Apply 4% inset padding (compensates for AI coordinate imprecision)
5. Validate: minimum dimensions (100x150px), aspect ratio (0.55-0.80 w/h), color variance (reject solid-color garbage crops)
6. Crop with sharp, convert to WebP (quality 85)
7. Upload to Supabase Storage (`cover-images` bucket, public)
8. Submit to `cover_images` table via `submitCoverImage()` with `autoApprove: true`
9. Sync to `comic_metadata` so the cover is immediately findable by other users

**Sentinel profile:** All harvested covers are submitted by `SYSTEM_HARVEST_PROFILE_ID` (`00000000-0000-0000-0000-000000000001`) — a system user, not a real account.

**Dedup:** Partial unique index on `cover_images (title_normalized, issue_number, variant) WHERE status = 'approved'` prevents duplicate approved covers.

**Failure handling:** All failures are silent (logged, not thrown). The scan response is never delayed or broken by harvest failures.

---

## Image Input Specifications

### Live Camera
- MediaStream API at 1280x720 (ideal), environment-facing default
- Canvas frame capture at JPEG 0.9 quality
- Compression via `quickCompress()` to 400KB target

### File Upload
- Accepted: JPEG, PNG
- Rejected: HEIC/HEIF (with user-facing message)
- Max pre-compression: 15MB
- Mobile: native camera picker; Desktop: drag-and-drop

### Compression Pipeline
- Max dimension: 1200px (maintains aspect ratio)
- Target size: 400KB
- Quality reduction loop: starts at 0.8, decrements by 0.05, floor at 0.4
- API rejects base64 > 20MB (~15MB binary)

---

## AI Provider Configuration

| | Gemini Flash (Primary) | Claude Sonnet (Fallback) |
|---|---|---|
| Model | `gemini-2.0-flash` | `claude-sonnet-4-20250514` |
| Cost per image analysis | 0.3 cents | 1.5 cents |
| Cost per verification | 0.1 cents | 0.6 cents |
| Why primary | Cheaper, tested more accurate for comics | Higher general capability |
| Max tokens | 1,536 | 1,536 |

**Shared prompts:** Both providers use identical `IMAGE_ANALYSIS_PROMPT` and `buildVerificationPrompt()`.

**Fallback logic is per-call:** Call 1 and Call 2 have independent fallback chains. If Gemini fails on Call 1 but works on Call 2, that's fine.

**Non-retryable errors:** `bad_request` and `content_policy` — same input will fail on both providers, so no point in fallback.

---

## Time Budget Management

**Hard deadline:** 25 seconds (1s safety margin before Netlify's 26s edge function limit)

**Budget allocation:**

| Phase | Ideal Time | Budget Rule |
|-------|-----------|-------------|
| Call 1 primary | 12s | `min(12s, remaining - 4s reserve)` |
| Call 1 fallback | 10s | `min(10s, remaining - 4s reserve)` |
| Low-confidence retry | 10s | Only if 5s+ remaining |
| Call 2 primary | 8s | `min(8s, remaining - 4s reserve)` |
| Call 2 fallback | 6s | `min(6s, remaining - 4s reserve)` |
| Metron | 3s | Independent (fire-and-forget) |
| Cover harvest | 2s | Only if slabbed+harvestable, timeout-guarded |
| eBay + cover pipeline | ~4s | Remaining budget |

If budget runs out, later phases are skipped gracefully — the scan returns whatever data it has.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Both AI providers fail | Scan slot released, analytics recorded (success=false), user gets "service temporarily busy" message |
| Low confidence from both providers | Return best result with `confidence: "low"` — user can still review and edit |
| eBay API down | No pricing returned; comic still identified and saveable |
| Metron timeout | Silent — no impact on scan |
| Cert lookup fails | Grading info from AI used as-is |
| Cover pipeline fails | No cover image; user sees placeholder |
| Netlify timeout (26s) | 504 error; frontend shows "image took too long, try smaller image" |

**Scan slot rollback:** On ANY failure after reservation, `releaseScanSlot()` fires (catch block, non-throwing) to restore the user's scan credit.

---

## Analytics & Cost Tracking

**Recorded per scan** (success and failure):

| Field | Source |
|-------|--------|
| profile_id | Clerk auth (null for guests) |
| scan_method | "camera" |
| estimated_cost_cents | Calculated from provider + calls made |
| ai_calls_made | 1 or 2 |
| metadata_cache_hit | Boolean |
| ebay_lookup | Boolean |
| duration_ms | Wall clock time |
| success | Boolean |
| subscription_tier | guest / free / premium |
| provider | gemini / anthropic |
| fallback_used | Boolean |
| fallback_reason | timeout / rate_limited / server_error / null |
| cover_harvested | Boolean (graded book cover extracted) |

**Cost examples:**
- Cache hit: ~0 cents
- 1 AI call (Gemini) + eBay: 0.45 cents
- 2 AI calls (Gemini) + eBay: 0.55 cents
- 2 AI calls (Anthropic) + eBay: 2.25 cents

**Destinations:** PostHog (user behavior) + `scan_analytics` table (cost/performance). Both fire-and-forget.

---

## Response Object

```json
{
  "title": "Amazing Spider-Man",
  "issueNumber": "300",
  "publisher": "Marvel Comics",
  "releaseYear": "1988",
  "variant": "Newsstand Edition",
  "writer": "David Michelinie",
  "coverArtist": "Todd McFarlane",
  "interiorArtist": "Todd McFarlane",
  "confidence": "high",

  "isSlabbed": true,
  "gradingCompany": "CGC",
  "grade": "9.8",
  "certificationNumber": "1234567890",
  "isSignatureSeries": false,
  "signedBy": null,
  "labelType": "Universal",
  "pageQuality": "White",
  "gradeDate": "2024-01-15",
  "graderNotes": null,

  "barcode": {
    "raw": "75960609486600345",
    "confidence": "high"
  },

  "keyInfo": ["First full appearance of Venom"],
  "keyInfoSource": "database",

  "priceData": {
    "estimatedValue": 250.00,
    "gradeEstimates": [
      { "grade": 9.8, "label": "NM/M", "rawValue": 625, "slabbedValue": 750 },
      { "grade": 9.4, "label": "NM", "rawValue": 250, "slabbedValue": 325 }
    ],
    "baseGrade": 9.4,
    "priceSource": "ebay"
  },

  "coverImageUrl": "https://metron.cloud/covers/...",
  "coverSource": "metron",

  "_meta": {
    "provider": "gemini",
    "fallbackUsed": false,
    "fallbackReason": null,
    "confidence": "high",
    "callDetails": {
      "imageAnalysis": { "provider": "gemini", "fallbackUsed": false },
      "verification": null
    }
  }
}
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/app/api/analyze/route.ts` | Main pipeline orchestrator (~1000 lines) |
| `src/lib/aiProvider.ts` | Multi-provider fallback with dynamic time budgets |
| `src/lib/providers/anthropic.ts` | Claude implementation + all AI prompts |
| `src/lib/providers/gemini.ts` | Gemini implementation (reuses Anthropic prompts) |
| `src/lib/providers/types.ts` | Shared interfaces (AIProvider, results, errors) |
| `src/lib/ebayBrowse.ts` | eBay OAuth + search + outlier filtering + grade multipliers |
| `src/lib/gradePrice.ts` | Grade multiplier calculations |
| `src/lib/certLookup.ts` | CGC/CBCS/PGX website scrapers |
| `src/lib/metronVerify.ts` | Metron API verification (fire-and-forget) |
| `src/lib/coverValidation.ts` | Cover image pipeline with Gemini validation |
| `src/lib/coverImageDb.ts` | Community cover submissions and lookups |
| `src/lib/coverHarvest.ts` | Cover harvesting: validation, crop, upload, submit |
| `src/lib/keyComicsDatabase.ts` | Curated key comics local database |
| `src/lib/cache.ts` | Redis caching layer (all TTLs and prefixes) |
| `src/lib/db.ts` | Supabase queries (metadata, barcode catalog) |
| `src/lib/subscription.ts` | Scan slot reservation/release |
| `src/lib/rateLimit.ts` | Upstash rate limiting |
| `src/lib/imageOptimization.ts` | Compression pipeline |
| `src/lib/analyticsServer.ts` | Cost estimation + PostHog + scan_analytics |
| `src/components/LiveCameraCapture.tsx` | Camera UI component |
| `src/components/ImageUpload.tsx` | File upload component |
| `src/app/scan/page.tsx` | Scan page (state machine, API call, review UI) |

---

## Design Decisions & Rationale

| Decision | Rationale |
|----------|-----------|
| Gemini as primary provider | 5x cheaper, tested more accurate for comics specifically |
| Per-call fallback (not per-scan) | If Call 1 fails on provider A, Call 2 might succeed on A. Independent failures. |
| Fire-and-forget for Metron | Unreliable API shouldn't block scans. Free upside when it works. |
| Barcode cataloging at save time (not scan time) | User reviewing + saving = implicit human verification. Prevents bad data in catalog. |
| 30-day image hash cache | Same photo = same comic. Saves AI cost on re-scans. |
| Fill-only metadata merge | Prevents cache from overwriting fresher AI results or user edits. |
| Cert data overrides AI | Grading company is authoritative source of truth for graded books. |
| Key comics DB checked before AI verification | Free + instant + human-curated > AI-generated key info. Skips an AI call when available. |
| 25s hard deadline (not 26s) | 1s safety margin for response serialization before Netlify kills the function. |
