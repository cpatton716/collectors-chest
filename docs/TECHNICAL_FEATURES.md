# Collectors Chest - Key Technical Features

> Reference document for spec doc creation. Each feature below should get its own detailed spec document through individual review sessions.
>
> **Last Updated:** June 14, 2026 — Session 48

---

## 1. AI Cover Recognition & Multi-Provider Fallback
Camera capture → image compression (400KB target) → Gemini 2.0 Flash (primary) → Claude Sonnet 4.5 (fallback) → structured comic identification. Two independent AI calls: image analysis (12s timeout) + verification/enrichment (8s timeout). Per-call fallback logic, non-retryable error detection, cost tracking ($0.001-0.006/scan Gemini primary, $0.01-0.03/scan Anthropic on fallback). Gemini is primary because it tests more accurately for comic covers and is ~5x cheaper than Claude.

**Session 31 additions — Slab detection AI calls:**
- `detectSlab()` — Quick binary classification: is this a slabbed comic? Returns `SlabDetectionResult` with confidence score
- `extractSlabDetails()` — Detailed extraction from slab label: cert number, grade, grading company, label color, title, issue, variant, key comments, art comments, barcode. Returns `SlabDetailExtractionResult`
- New prompts: `SLAB_DETECTION_PROMPT`, `SLAB_DETAIL_EXTRACTION_PROMPT`, `SLAB_COVER_HARVEST_ONLY_PROMPT`
- New AICallType values: `slabDetection`, `slabDetailExtraction`
- Updated barcode detection prompt for slabbed comics (reads barcode through slab case)

**Session 48 (June 14, 2026) — Routing, cost, and cache optimizations:**
- **Gemini confirmed PRIMARY, Anthropic fallback.** Documentation reconciled to match the actual code path (Gemini 2.0 Flash first, Claude as fallback). Earlier docs had drifted toward describing Anthropic as primary.
- **Text-only lookups → Haiku (not Sonnet).** Non-vision enrichment/lookup calls now use `MODEL_LIGHTWEIGHT` (Claude Haiku) instead of Sonnet, ~60-70% cheaper on those paths.
- **Cert-first slab ordering.** Slab detection AI calls now run **only when the main analysis flags a slab**, instead of unconditionally — avoids paying for `detectSlab()` on the common raw-comic path.
- **Low-confidence rescan gated to signed-in users.** When the first analysis returns low confidence, an automatic single retry (cap **1 extra** call) is offered to signed-in users only; guests do not get the bonus rescan.
- **Image-hash cache hit no longer fully short-circuits.** A cache hit on the image-hash cache still re-runs the (cheap) `barcode_catalog` lookup + variant re-resolve so newly-approved catalog/variant data surfaces on a re-scan of the same photo.
- **Anthropic prompt caching on vision calls.** Vision requests to Claude now use prompt caching to cut input-token cost on the fallback path.

**Key files:** `src/lib/aiProvider.ts`, `src/lib/providers/anthropic.ts`, `src/lib/providers/gemini.ts`, `src/lib/providers/types.ts`, `src/app/api/analyze/route.ts`

---

## 2. Real-Time Pricing Engine (eBay Browse API)
OAuth token management → keyword search builder → category fallback chain (Comics → Collectibles → All) → outlier filtering (remove top/bottom 10%) → Q1 conservative pricing (25th percentile instead of median for more buyer-friendly estimates, min 3 listings) → grade multiplier extrapolation (6 grades from single lookup). Redis cache: 12h for results, 1h for "no data."

**Session 31 improvements:**
- **Year disambiguation:** `buildSearchKeywords()` accepts optional `year` param to differentiate same-title reboots (e.g., "Amazing Spider-Man #1 1963" vs "Amazing Spider-Man #1 2022")
- **Irrelevant listing filtering:** `filterIrrelevantListings()` removes non-comic results (lots, sets, posters, reprints, etc.) before price calculation
- **Q1 pricing:** `filterOutliersAndCalculateMedian()` now uses Q1 (25th percentile) instead of median for more conservative, buyer-friendly estimates
- **Grade filtering for slabs:** When pricing slabbed comics, search includes grade in keywords and filters results to only matching grade

**Session 40b addition — On-demand FMV refresh per comic:** `POST /api/comics/[id]/refresh-value` runs eBay Browse lookup for a single owned comic (owner-auth gated) and persists the result to `price_data` + `average_price` on that comic row. Honors the same 12h Redis cache as `/api/ebay-prices`. UI wire-up: `ComicDetailModal` renders a blue "Look Up Market Value" CTA when `effectivePriceData?.estimatedValue` is falsy (e.g., buyer-side clones of manually-added comics where the seller never scanned), and a "Refresh value" link inside the value card once data exists. Result is applied optimistically via local state so the new value appears without a reload. Known limitation (BACKLOG): `MIN_LISTINGS_THRESHOLD = 3` at exact grade returns "No eBay sales data found" for rare keys at uncommon grades — grade-band fallback needed pre-launch.

**Key files:** `src/lib/ebayBrowse.ts`, `src/app/api/ebay-prices/route.ts`, `src/app/api/comics/[id]/refresh-value/route.ts`, `src/lib/gradePrice.ts`, `src/components/ComicDetailModal.tsx`

---

## 3. Cover Image Pipeline & Auto-Harvest
Four-source waterfall for finding covers: Community covers → eBay listing images → Open Library → Gemini validation. Community submission with auto-approve (single match) or admin queue (multi-match). Creator Credits awarded on approval.

**Auto-harvest from graded scans:** When scanning slabbed comics, the AI reports crop coordinates for the cover artwork visible through the slab. If harvestable (sharp, well-lit, minimal glare), the pipeline automatically crops the cover, converts to WebP, uploads to Supabase Storage, and submits to the community cover DB — zero user friction. Runs pre-response with a 2s timeout. Deduplication via partial unique index.

**Session 39 addition — Aspect-ratio guard:** `src/lib/coverCropValidator.ts` rejects AI-returned crop coordinates outside the comic-book aspect range (0.55-0.85 w/h). Runs at the top of `harvestCoverFromScan` so out-of-range crops don't pollute the cover cache. 16 unit tests.

**Key files:** `src/lib/coverValidation.ts`, `src/lib/coverImageDb.ts`, `src/lib/coverHarvest.ts`, `src/lib/coverCropValidator.ts`, `src/app/api/cover-images/route.ts`

---

## 3b. Cover-Image Preservation Rule (durable invariant)

A small but load-bearing rule, codified in Session 45b after a Key Hunt regression where a user-snapped cover was being silently replaced by an eBay placeholder during Refresh / New Grade.

- **The user's per-instance cover lives in `comics.cover_image_url`.** It is the photo they took (or the cover they curated) for *their* copy of the book and is treated as user content.
- **Only `updateComic()` in `src/lib/db.ts` writes that column,** and it is only called from the collection-edit flow. No scan, no lookup, no cron, no admin tool writes `comics.cover_image_url` outside that one path.
- **API routes that fetch external covers** (eBay listing images, the cover harvest pipeline, slab cover-only harvest, etc.) write to `comic_metadata.cover_image_url` — the shared catalog cache — never the user's `comics` row.
- **Refresh / New Grade flows in Key Hunt** thread the existing `coverImageUrl` through the lookup so a fresh call that returns no listings (and therefore no eBay image) doesn't cause the UI to fall back to a placeholder.

**This rule is durable.** Any new code path that touches `coverImageUrl` — new scan modes, sync jobs, repair tools, future native-app flows — must respect the boundary: scrape/harvest results land in `comic_metadata`, the user's photo stays put in `comics`.

**Key files:** `src/lib/db.ts` (`updateComic()` — sole writer of `comics.cover_image_url`), `src/app/key-hunt/page.tsx` (`setPendingComic` cover passthrough), `src/lib/coverImageDb.ts` (`comic_metadata` writers).

---

## 3c. Cover Image Persistence Pipeline (Session 46, May 9, 2026)

User-snapped photos taken via the FAB scan flow are now uploaded to a dedicated Supabase Storage bucket and persisted as a public URL on the `comics` row instead of being embedded as a `data:` URI. Required because the existing `cover_image_url` sanitizer (`src/lib/coverImageUrlSanitizer.ts`) hard-rejects all `data:` URIs to protect downstream consumers (CSV exports, Stripe product image URL caps, marketplace listing payloads).

**Pipeline:**
- Camera capture → in-memory `data:` URI for instant preview → on save, client helper `uploadCoverImage()` converts data URI → `Blob` → multipart `POST /api/comics/upload-cover` (Clerk-authed) → returns the public Supabase URL → that URL is what gets written to `comics.cover_image_url` via the normal `addComic()` path.
- `scan/page.tsx` `handleSave()` calls the helper before the DB write **for signed-in users only**. Guests bypass entirely (their collections live in localStorage where the data URI is fine).
- **Graceful degradation:** if the upload fails (network, bucket misconfig, oversize), the helper resolves to `""` and the save still succeeds — the comic just renders the placeholder cover instead of blocking the user.

**Storage configuration (migration `20260509_comic_covers_bucket.sql`):**
- Bucket name: `comic-covers`
- Public read (so URLs work in `<img>` tags, CSVs, Stripe payloads without signed URLs)
- 10MB file size cap (matches the analyze-route image cap)
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`
- RLS: authenticated users can `INSERT`; anyone can `SELECT`

**Boundary respected:** This is a write to `comics.cover_image_url` — Cover-Image Preservation Rule (3b) still holds. The user's photo lands in `comics`, not in `comic_metadata`. External harvest pipelines continue to write to `comic_metadata` only.

**Session 47 (May 27, 2026) — PROD-VALIDATED end-to-end + iOS rendering fixes.** The full upload pipeline was confirmed working in production on iPhone + Android (first user verification): a newly scanned cover persists into the collection grid, the detail view, and survives a reload. Two iOS Safari rendering bugs against the persisted cover were fixed in the same session:
- **Grid paint bug (`ComicCard.tsx`).** On iOS Safari the cover image rendered blank/cut-off on first paint. Fixed by making the `<img>` `absolute inset-0` inside its aspect-ratio box and fading it in (opacity 0→100) on the `load` event — the opacity transition forces the iOS repaint. A `complete` / `naturalWidth` check short-circuits the fade for already-cached images so they don't flash. Deliberately kept a plain `<img>` (NOT `next/image`) to avoid Netlify Image CDN cost.
- **Detail-modal thumbnail squish.** The modal cover thumbnail used `w-20 h-30`; `h-30` is an undefined Tailwind class that collapsed the box. Changed to `w-20 aspect-[2/3] self-start` so the thumbnail renders as a proper tall comic cover.

**Session 48 (June 14, 2026) — server-side WebP conversion.** Uploaded covers are now converted to **WebP server-side** in `/api/comics/upload-cover` before they land in the `comic-covers` bucket, shrinking stored cover size (helps the 1GB Supabase storage cap flagged in COST_PROJECTIONS) without changing the public-URL contract. The collection grid also gained **Load-more pagination** so large collections don't render every row at once.

**Key files:** `src/app/api/comics/upload-cover/route.ts` (server-side WebP conversion), `src/lib/uploadCoverImage.ts`, `src/app/scan/page.tsx` (`handleSave()`), `src/app/collection/page.tsx` (Load-more pagination), `src/components/ComicCard.tsx` (iOS fade-in-on-load grid render), `supabase/migrations/20260509_comic_covers_bucket.sql`

---

## 4. Multi-Layer Caching Architecture
Redis (backend): eBay prices (12h), metadata (7d), AI analysis (30d), barcodes (6mo), certs (1yr). localStorage (frontend): offline lookups (7d, 30 items LRU), scan history, guest collection. Image hash cache prevents re-analyzing identical photos.

**Session 48 (June 14, 2026) — Image-hash cache hit re-runs cheap lookups.** A hit on the image-hash cache no longer fully short-circuits the route: it still re-runs the `barcode_catalog` lookup and variant re-resolve so a re-scan of the same photo picks up any newly admin-approved catalog/variant data. The expensive AI vision/enrichment calls are still skipped on the cache hit.

**Two distinct caching strategies for scans:**
- **Cert-level cache** (`cache:cert:{company}-{certNumber}`, 1yr TTL) — Stores the full cert lookup response. Keyed by cert number, so only helps if the exact same physical book is scanned again (rare in production).
- **Issue-level cache** (`cache:comic:{title}|{issueNumber}`, 7d TTL + permanent Supabase fallback) — Stores shared metadata: title, publisher, year, creators, keyInfo, coverImageUrl. Keyed by title+issue, so ALL copies of the same comic share this cache. This is where the real cost savings happen — the first scan of any ASM #300 populates this cache, and every subsequent ASM #300 scan (different cert, different user) skips expensive AI calls.

**End-of-route save:** Every successful scan writes issue-level metadata to both Redis (7d) and Supabase `comic_metadata` table (permanent) in parallel. This is the mechanism that connects cert lookups, AI results, and all enrichment to the shared issue-level cache.

**Key files:** `src/lib/cache.ts`, `src/lib/metadataCache.ts`, `src/lib/db.ts`, `src/lib/offlineCache.ts`, `src/lib/storage.ts`

---

## 5. Scan Quota & Reservation System
Guest: 5 scans (client-side + server header validation, +5 via email capture). Free: 10/month (atomic `reserveScanSlot()` with conditional UPDATE). Premium: unlimited. Purchased 10-packs ($1.99, never expire). Scan slot released on AI failure. Monthly auto-reset on 1st.

**Session 38 additions:**
- 10MB image upload cap via `src/lib/uploadLimits.ts` (`MAX_IMAGE_UPLOAD_BYTES`, `assertImageSize()`, `base64DecodedByteLength()`). Returns HTTP 413 on oversize. Shared by `/api/analyze` and `/api/messages/upload-image`. Client-side pre-validation in `ImageUpload.tsx` and `MessageComposer.tsx`.
- Scan-slot reservation leak fix: 413 (too large) and 400 (no image) error branches now release the reserved slot so users aren't billed a scan for a malformed request.

**Session 39 addition — hCaptcha Guest Scan Protection:** Invisible hCaptcha gates guest scans **4 and 5 only** (the last two free scans before the limit). Client via `@hcaptcha/react-hcaptcha` with floating badge (`src/components/GuestCaptcha.tsx`), server helper at `src/lib/hcaptcha.ts` with 5s siteverify timeout and dev/prod key swap. Env vars: `HCAPTCHA_SECRET_KEY` + `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`.

**Session 48 (June 14, 2026) — Guest scans now server-enforced (was bypassable).** Guest scan counting moved off the trust-the-client model (previously a request header the client controlled, trivially bypassable) onto a **signed `cc_guest` cookie + Redis counters**. The route mints/reads a tamper-resistant signed token (`src/lib/guestScanToken.ts` on top of `src/lib/signedToken.ts`) and increments a server-side Redis counter, so neither the base 5-scan limit nor the **+5 email-capture bonus** can be defeated by editing client state. Bonus scans are likewise granted and tracked server-side. New env var: `GUEST_SCAN_SECRET`.

**Key files:** `src/lib/subscription.ts`, `src/lib/uploadLimits.ts`, `src/lib/hcaptcha.ts`, `src/lib/signedToken.ts`, `src/lib/guestScanToken.ts`, `src/hooks/useGuestScans.ts`, `src/components/GuestCaptcha.tsx`, `src/app/api/analyze/route.ts`

---

## 6. Subscription & Trial Lifecycle
Three paths: 7-day direct trial (no Stripe, DB-only) → 30-day promo trial (QR code → localStorage flag → Stripe subscription with `trial_period_days: 30`) → paid subscription ($4.99/mo or $49.99/yr). Webhook-driven state machine: created → active/trialing → past_due → canceled → downgrade. Idempotent webhook processing via event ID cache.

**Session 48 (June 14, 2026) — QR-exclusive signed promo-trial token.** The 30-day promo trial is now gated behind a **signed promo-trial token** (`src/lib/signedToken.ts`, purpose-scoped via `PROMO_TRIAL_SECRET`) carried by the QR-code entry point, so the 30-day trial can no longer be self-granted by setting the localStorage flag directly — eligibility is verified server-side (`profiles.promo_trial_eligible`, added in `20260614_audit_closeout.sql`). Token purpose is scoped so it can't be cross-used as a guest-scan or unsubscribe token. New env var: `PROMO_TRIAL_SECRET`.

**Key files:** `src/lib/subscription.ts`, `src/lib/signedToken.ts`, `src/app/api/billing/`, `src/app/api/webhooks/stripe/route.ts`, `src/lib/promoTrial.ts`

---

## 7. CGC/CBCS/PGX Certificate Verification
HTML scraping of grading company websites → structured data extraction (grade, page quality, signatures, label type, grader notes) → 1-year Redis cache keyed by cert number. Auto-detection of grading company from cert number format. Feeds into pricing, cover harvesting, and cert-first scan pipelines. Cert data also flows into the issue-level cache (see Feature 4) at end-of-route, so the first cert lookup for any issue benefits all future scans of that same issue.

**Known issue (Apr 2026):** CGC's website is blocking server-side lookups with Cloudflare bot protection (HTTP 403). CBCS and PGX are unaffected. ZenRows API (`mode=auto&wait=5000`) validated as mitigation — pending partner cost review ($49/mo for ~10K lookups). See BACKLOG.md for details.

**Session 31 additions:**
- `src/lib/certHelpers.ts` — `normalizeGradingCompany()` standardizes company names, `parseKeyComments()` / `mergeKeyComments()` combine AI-detected and cert-provider key comments, `parseArtComments()` extracts art-related notes
- Cert lookup integrated into cert-first pipeline Phase 3 for automatic verification during slab scans

**Key files:** `src/lib/certLookup.ts`, `src/lib/certHelpers.ts`, `src/app/api/cert-lookup/route.ts`

---

## 8. Barcode Detection & Catalog System
AI extracts 12-17 digit UPC → parsed into prefix/item/check/addon components → variant extracted from digits 16-17 → crowd-sourced `barcode_catalog` lookup → low-confidence entries queued for admin review in `admin_barcode_reviews`. Variant **name** resolution (turning the addon digits into a human-readable label like "Cover G") is delegated to the Variant Name Resolver — see Feature 8c.

**Session 45b (May 6, 2026) — Comic Vine integration retired.** The `/api/quick-lookup` route (Comic Vine barcode-fallback), the `COMIC_VINE_API_KEY` env var, the "Quick Lookup" PWA shortcut in `manifest.json`, and the service-worker cache entry for `/api/quick-lookup` were all removed in commit `69c186b` (~250 lines deleted). Comic Vine's API was unreliable for new releases and the curated key DB + crowd-sourced `barcode_catalog` cover the same gap with better data quality. Crowd-sourced barcode catalog is now the only post-AI fallback path.

**Key files:** `src/app/api/analyze/route.ts`, `src/lib/db.ts` (barcode catalog functions)

---

## 8b. Cert-First Scan Pipeline (Slabbed Comics)
Dedicated scan pipeline for slabbed/graded comics that bypasses standard cover recognition. Triggered when the main image-analysis call flags a slab. Five-phase pipeline:

- **Phase 1 — Slab Detection:** the main image-analysis call (Gemini → Anthropic fallback) returns `isSlabbed` + grading fields directly; the cert-first branch fires only when it flags a slab (no dedicated slab-detection vision call per scan)
- **Phase 2 — Slab Detail Extraction:** `executeSlabDetailExtraction()` reads cert number, grade, grading company, label color (blue/yellow/green/etc.), title, issue, variant, key comments, art comments from the slab label photo
- **Phase 3 — Cert Lookup:** If cert number found, scrapes CGC/CBCS/PGX for verification. `mergeKeyComments()` combines AI-detected comments with cert provider data. `normalizeGradingCompany()` standardizes company names
- **Phase 4 — eBay Pricing:** Grade-specific search with year disambiguation. `filterIrrelevantListings()` removes non-comic results. Q1 conservative pricing. Grade included in search keywords for slabbed results
- **Phase 4.5 — Metadata Cache Gate:** Checks issue-level cache (Redis → Supabase) for creators. If all 3 present (writer, coverArtist, interiorArtist), skips Phase 5 AI call. This is the key cost optimization — after the first scan of any issue, subsequent scans skip the ~0.5¢ AI call
- **Phase 5/5.5 — Focused AI / Cover Harvest:** Phase 5 extracts creators + barcode via AI (only if cache miss). Phase 5.5 runs cover harvest only (when cache hit). End-of-route save persists all data to issue-level cache for future scans. Analytics logged with `scan_path: 'cert-first'` and `barcode_extracted` fields

**Migration:** `supabase/migrations/20260405_cert_first_analytics.sql` — adds `scan_path` and `barcode_extracted` columns to `scan_analytics`

**Key files:** `src/app/api/analyze/route.ts` (Phases 1-5.5), `src/lib/aiProvider.ts`, `src/lib/certHelpers.ts`, `src/lib/providers/anthropic.ts`, `src/lib/providers/gemini.ts`, `src/lib/metadataCache.ts`, `src/lib/analyticsServer.ts`

---

## 8c. Variant Name Resolver (Session 46, May 9, 2026)

Three-tier resolver that turns a parsed barcode into a human-readable variant label (e.g., "Cover G", "Virgin Variant", "1:25 Incentive"). Lives in `src/lib/variantResolver.ts` and is wired into `src/app/api/analyze/route.ts` immediately after `parseBarcode()` (~line 730).

**Design principle:** The barcode signal trumps any AI cover-derived hint. Two physically different variant editions can share identical cover artwork (cover-art-equal but trade-dress-different printings) — the addon supplement digits are the only authoritative discriminator, so the resolver intentionally ignores AI cover guesses when a barcode is present.

**Resolution tiers:**
- **Tier 1 — Catalog lookup.** `lookupApprovedVariantName()` queries `barcode_catalog` for a community-approved entry matching the prefix/item/addon. Source = `'catalog'`.
- **Tier 2 — Focused AI enrichment.** `enrichVariantNameFromAI()` makes a narrow Claude Haiku call (`MODEL_LIGHTWEIGHT`, ~$0.0008/call) using the cover image + parsed barcode to suggest a variant label. Source = `'ai'`.
- **Tier 3 — Deterministic addon fallback.** Pure mapping from addon digits to a generic label (e.g., addon `"71"` → `"Cover G"`). Source = `'addon'`. This always returns *something* when the barcode parsed cleanly.

**Dependency injection.** `resolveVariant()` takes `{ catalog: CatalogLookup, enricher: VariantEnricher }` so the route can swap in the production Supabase + Anthropic implementations while the unit tests inject in-memory fakes. 21 unit tests in `src/lib/__tests__/variantResolver.test.ts` cover tier ordering, short-circuit behavior, missing-input fallthrough, and the addon → label mapping table.

**Schema additions to `barcode_catalog`:**
- `variant_name TEXT` — the resolved label
- `variant_name_source TEXT` — `'catalog' | 'ai' | 'addon'`
- `variant_name_status TEXT DEFAULT 'pending'` — community-submitted variant names require admin approval before they're surfaced by Tier 1 lookups (prevents poisoning the shared catalog from a single low-confidence scan)

**UI:** `ComicDetailsForm.tsx` renders a "🔍 Detected from barcode/AI/addon code…" hint above the variant field with source-aware copy so the user can see why the form pre-filled the way it did.

**⚠️ Production caveat (known gap, top-priority for next session).** The resolver requires the AI to extract a full **17-digit** barcode (12-digit main UPC + 5-digit addon supplement) so the addon digits are available. In production scans the AI consistently captures only the 12-digit main UPC and misses the 5-digit add-on. Net effect: Tier 1 mostly hits only for entries seeded by other paths, and Tiers 2 + 3 don't fire at all in production today because the addon is empty. Tracked in BACKLOG as **"Variant Detection — Two-Pass High-Res Barcode OCR (Option C3)"** — a second targeted OCR pass on a high-resolution crop of the barcode region to recover the missing addon digits.

**Key files:** `src/lib/variantResolver.ts`, `src/lib/__tests__/variantResolver.test.ts`, `src/app/api/analyze/route.ts` (resolver wiring after `parseBarcode`), `src/components/ComicDetailsForm.tsx` (variant hint UI), `barcode_catalog` migration adding `variant_name` / `variant_name_source` / `variant_name_status`

---

## 9. Collection Entry Flows (4 paths)
- **Camera scan**: AI analysis → review/edit → save
- **Manual entry**: Form → optional metadata enrichment via Claude → save
- **CSV import**: Parse → per-row `/api/import-lookup` (cache-first, AI fallback) → bulk insert
- **Key Hunt**: Cover scan or manual → grade select → price lookup → optional "Add to Collection"

**Key files:** `src/app/scan/page.tsx`, `src/components/ComicDetailsForm.tsx`, `src/lib/csvHelpers.ts`, `src/app/api/import-lookup/route.ts`

---

## 10. Key Hunt (Convention Mode)

Mobile-first quick-lookup designed for the convention floor: scan a cover, get title + grade-aware price + key-issue context in 2-3 seconds, with graceful degradation when WiFi is unreliable. Updated extensively in Session 44 (May 5, 2026) and again in Session 45b (May 6, 2026 — history persistence + cover preservation).

### End-to-end flow

**Step 0 — Entry point.** User taps Key Hunt in the mobile nav (or opens `/key-hunt` directly), then selects "Scan Cover" (camera) or "Manual Entry" (autocomplete + form). Camera path described below; manual path skips Step 1 and goes straight to Step 2 with user-provided `{title, issueNumber}`.

**Step 1 — Cover image → AI vision (`POST /api/analyze`).**
- `src/app/key-hunt/page.tsx:153` POSTs `{image: base64, mediaType}` to `/api/analyze`
- `src/app/api/analyze/route.ts` enforces auth + scan-limit (guest 5 / free 10/mo / premium ∞)
- Image goes to **Gemini 2.0 Flash vision** (primary; Claude Sonnet 4.5 fallback on 5xx)
- The provider returns `{title, issueNumber, publisher, releaseYear, isSlabbed, grade?}`
- **`lookupKeyInfo()` consulted** with the recognized title+issue+year — pulls key facts from the curated `src/lib/keyComicsDatabase.ts` (1,132 entries) and attaches them to the response
- `recordScanAnalytics()` logs the scan to the `scan_analytics` table (cost ~$0.015, latency, AI calls, cache hit/miss, tier)
- Returns `ComicDetails` to the client

**Step 2 — Grade decision.**
- Slabbed: Claude detected a CGC/CBCS label and read the grade — client skips the picker and calls Step 3 with the detected grade
- Raw: client renders the 6-grade picker (9.8 / 9.4 / 8.0 / 6.0 / 4.0 / 2.0). User taps; client proceeds to Step 3.

**Step 3 — Price + key info lookup (`POST /api/con-mode-lookup`).**
- `src/app/api/con-mode-lookup/route.ts` runs three resolvers in order:

  **3a. Supabase cache hit** (`getComicMetadata` on `comic_metadata` table, ~50ms). If a row exists with eBay-sourced price data:
  - Pull cached `priceData`, `gradeEstimates`, `coverImageUrl`
  - **Curated DB beats stale cache (Session 44):** call `lookupKeyInfo()` against `keyComicsDatabase.ts`. If curated returns a hit, that wins over `dbResult.keyInfo`. Closes the long-tail bug where an earlier silent AI failure baked `key_info: []` into a row and returned empty key info forever.
  - Increment `comic_lookup_count` (powers future "top scans" gap analytics)
  - Return immediately — **no eBay call, no AI call, ~$0.00 cost**

  **3b. Cache miss → eBay Browse API + targeted AI.**
  - `searchActiveListings` queries eBay for current grade-aware listings
  - `convertBrowseToPriceData` produces `gradeEstimates`, `recentSales`, etc.
  - `runCoverPipeline` resolves the canonical cover URL with aspect-ratio guard (`coverCropValidator.ts` rejects bad crops — grade label strips, full slab regions)
  - **Curated DB beats AI (Session 44):** `lookupKeyInfo()` is called *before* `fetchKeyInfoFromAI()`. If the 945-entry curated DB has the answer, the AI call is skipped entirely. Saves cost on every scan of a popular key.
  - If curated DB doesn't have it: `fetchKeyInfoFromAI` runs (small ~$0.005 call). Failures are swallowed (returns `[]`).
  - `saveComicMetadata` persists the full result back to Supabase for next time
  - Return to client

  **3c. No eBay data → graceful fallback.** Returns `priceData: null` + `totalListings` + `ebaySearchQuery` so the client can render "X active listings on eBay" link instead of a price. **Curated key info still surfaces** (Session 44 — `lookupKeyInfo` consulted on this path too). **Session 45b — AI rescues curated misses on this path:** if `lookupKeyInfo()` returns nothing, the no-data branch now calls `fetchKeyInfoFromAI()` (mirroring 3b's behavior) so slabbed scans whose CGC cert title doesn't match a curated alias (e.g. "Ultimate Fallout: Spider-Man No More") still get the KEY ISSUE chip when there are zero eBay listings. Logged with the `[keyinfo-drift]` breadcrumb so the gap can be backfilled into `keyComicsDatabase.ts`.

**Step 4 — Client receives result, caches, renders.**
- `page.tsx:283` builds `LookupResult { title, issue, grade, price, keyInfo, coverImageUrl, source, ... }`
- **`cacheLookup()`** writes to `localStorage` keyed by `${title}-${years}|${issueNumber}|${grade}`. This is what makes re-scanning the same book at the con instant, even on bad WiFi.
- **`addToKeyHuntHistory()`** logs the scan to localStorage history (powers the "Recent Scans" view)
- `setResult(lookupResult)` + `setFlow("result")` triggers the result modal

**Step 5 — Result modal renders (`KeyHuntPriceResult.tsx`).**
- Cover thumbnail (top-left of gradient header) — **tappable → opens full-screen `CoverLightbox` for verification** (Session 44, addresses convention-floor variant verification need)
- Source badge: "eBay Data" / "Cached" / etc.
- Title + issue
- Grade badge
- **Yellow "KEY ISSUE" chips (Session 44)** — one chip per curated key fact (e.g. "Death of Elektra"). Renders between grade and price so collectors see context next to value. Hidden cleanly when `keyInfo` is empty.
- Raw / Slabbed price toggle (when both available)
- Big bold average price
- Recent sale (color-coded — red 20%+ above avg = market cooling, green 20%+ below = deal)
- "Recent Sales on eBay" deep link
- Add to Hunt List (Premium-gated, Capacitor-friendly)
- Add to Collection / New Lookup actions

### Convention-floor resilience matrix

| Scenario | Behavior |
|----------|----------|
| Online, fresh scan | Full Step 1-5 pipeline. Cache populated for next time. |
| Same book scanned again | localStorage cache hit, **instant return**, no network. "Cached" badge on result. |
| WiFi drops mid-fetch | `/api/con-mode-lookup` failure → automatic fallback to localStorage cache if available |
| Offline Mode toggled | Skips network entirely. localStorage only. Errors gracefully if not cached. |
| eBay returned but <3 listings at exact grade | Below-threshold display: "X active listings found" + eBay search link, key info still rendered |
| Anthropic API 5xx | `/api/analyze` falls back to Gemini for cover recognition automatically |
| Curated DB has the issue | Zero AI calls for key info on the entire flow. Faster + cheaper. |

### Curated key issue database

**Session 48 (June 14, 2026) — DB-backed key comics is now the PRIMARY source.** A database-backed key-comics module (community-approved entries) is now consulted first by both `/api/analyze` and `/api/con-mode-lookup`, so community-curated keys surface in Key Hunt and regular scans. The static `keyComicsDatabase.ts` file (the ~2.1k-line hand-vetted list described below) is now the **fallback** when the DB has no entry. The year-convention, multi-volume disambiguation, and `resolveEntry()` rules below still apply to the static fallback.

**`src/lib/keyComicsDatabase.ts`** (static fallback) — 945 hand-vetted canonical key issues (404 baseline + 541 added Session 44). Examples: Action #1 (first Superman), Detective #27 (first Batman), Detective #38 (first Robin), AF #15 (first Spider-Man), FF #1 (first Fantastic Four), FF #5 (first Doctor Doom), Hulk #181 (first Wolverine), GS X-Men #1, DD #181 (death of Elektra), ASM #300 (first Venom), ASM #129 (first Punisher), Batman Adventures #12 (first Harley Quinn), Walking Dead #1, NYX #3 (first X-23), Ultimate Fallout #4 (first Miles Morales), Captain America Comics #1, Marvel Comics #1, Whiz #2 (first Captain Marvel/Shazam), All-American #16 (first Alan Scott Green Lantern), Tales of Suspense #59 (first solo Cap modern), House of X #1 (Krakoa era), Mad #1, etc.

**Year convention: series-start year, NOT issue-publication year.** Detective Comics #38 (published 1940) uses `year: 1937` because Detective Comics started in 1937. ASM #700 (published 2012) uses `year: 1963` because the series started in 1963. The `resolveEntry()` function in `keyComicsDatabase.ts` rejects matches where `releaseYear < entry.year` (i.e., the comic claims to be from before the series started — wrong volume).

**Multi-volume disambiguation.** When a series has been relaunched (X-Men 1963 vs 1991 vs 2019, Iron Man volumes, Justice League #1 1987 vs 2011, etc.), every relaunch is a separate entry with its own `year`. The resolver picks by exact-year match, then by "most recent series start ≤ release year."

**Expansion path.** Curated DB is consulted by both `/api/analyze` (regular collection scans) and `/api/con-mode-lookup` (Key Hunt). Future entries will come from scan-data-driven gap mining (`npm run keys:gaps` tooling, planned post-launch — see BACKLOG "Expand Curated Key Info DB"). The DB also feeds the planned ETL for "Pre-populate Top Comics Cache" so seeded `comic_metadata` rows get correct `key_info` from day one.

### Session 45b (May 6, 2026) — History persistence + cover preservation

**Key info now persists in scan history.** The `KeyHuntHistoryEntry` interface in `src/lib/offlineCache.ts` was extended with `keyInfo` + `keyInfoMeta`, so curated key facts survive across the localStorage history (30-day TTL). Renders as a "Key" badge in `KeyHuntHistoryList` (one-line preview) and as full chips in `KeyHuntHistoryDetail`. Entries written before the May 6, 2026 deploy lack the field — natural attrition handles them as the 30-day TTL expires.

**Refresh / New Grade preserves the user's cover image.** When the user re-runs a lookup at a different grade or refreshes pricing on an existing result, the prior `coverImageUrl` is now threaded through `setPendingComic` so the lookup pipeline doesn't fall back to an eBay null/placeholder when the new query has no fresh listings. Fixes the visual regression where a user-photographed cover would suddenly switch to a generic image after Refresh.

**Add to Collection from history now passes `keyInfo`.** Previously the history → collection hand-off hardcoded `keyInfo: []`, dropping the curated facts. Now the persisted `keyInfo`/`keyInfoMeta` flow into the collection-entry form so the new `comics` row inherits the correct key context.

### Wishlist (Hunt List)

Premium feature. `key_hunt_lists` table tracks comics the user is hunting. Add-to-list button on result modal. Future enhancement: price-drop notifications when a hunted issue's eBay listing data hits a target.

### Key files

- `src/app/key-hunt/page.tsx` — entry, scan handler, lookup orchestration, localStorage cache + history
- `src/app/api/analyze/route.ts` — AI cover recognition, calls `lookupKeyInfo()`, scan-limit enforcement, scan analytics
- `src/app/api/con-mode-lookup/route.ts` — three-tier price + key-info resolver (cache → eBay+curated/AI → fallback)
- `src/lib/keyComicsDatabase.ts` — 945-entry curated key-issue DB + `lookupKeyInfo()` + `resolveEntry()`
- `src/components/KeyHuntPriceResult.tsx` — result modal, KEY ISSUE chips, lightbox trigger
- `src/components/KeyHuntHistoryList.tsx` / `KeyHuntHistoryDetail.tsx` — recent-scans list + drill-down (Session 45b: render `keyInfo` badge + chips, pass `keyInfo` into Add-to-Collection)
- `src/components/CoverLightbox.tsx` — full-screen cover viewer (Session 44)
- `src/lib/offlineCache.ts` / `useOffline.ts` — localStorage cache and history helpers (Session 45b: `KeyHuntHistoryEntry` extended with `keyInfo` + `keyInfoMeta`)
- `src/lib/coverValidation.ts` + `coverCropValidator.ts` — aspect-ratio guard for AI-returned crops

---

## 11. Auction & Fixed-Price Marketplace
Two listing types: timed auction (1-14 days, proxy bidding) and fixed-price (30-day, accepts offers). Offer negotiation (max 3 rounds, 7-day expiry). Stripe Connect (Express) for seller payouts via destination charges. Transaction fees: 8% free / 5% premium with a **$0.75 minimum per sale** (seller-favorable `Math.floor` rounding above the floor). Cron-driven auction processing, listing expiration, and offer expiration.

**Session 48 (June 14, 2026) — switched to true DESTINATION CHARGES (seller = merchant of record).** The checkout charge model changed from the platform-as-merchant transfer split (below) to a Stripe Connect **destination charge** using `on_behalf_of` + `application_fee_amount`. The buyer's charge is now created **on behalf of the seller's Connect account** (seller is the merchant of record on the buyer's statement and for tax/regulatory purposes); the platform's cut is taken via `application_fee_amount` and Stripe deducts processing fees from the seller's side. The fee-snapshot rules below (rate fixed at listing time, $0.75 floor) are unchanged — only the Stripe charge shape and merchant-of-record changed. The worked examples further down describe the OLD platform-as-merchant model and are retained for historical reference; net platform/seller economics are equivalent. Stripe webhook must be subscribed to `account.updated` for Connect onboarding state (deploy prerequisite). Other Session 48 marketplace changes: **atomic Buy-It-Now guard** (one-winner UNIQUE index + conditional update prevents double-purchase races), **idempotent scan-pack crediting** (`credit_scan_pack` RPC + `processed_stripe_sessions` ledger), **refund/dispute reversal handlers** in the Stripe webhook, **webhook idempotency reworked to mark-after-success** (was mark-before, which dropped events when processing failed), and **auto-reject competing offers on accept** (accepting one offer on a fixed-price listing now atomically rejects all other open offers on that listing so a seller can't accidentally accept two).

**Transaction fee mechanics — snapshotted at listing time, not checkout time:**

The fee *rate* (5% or 8%) is determined by the seller's subscription tier *at the moment the listing is created*, not when the buyer pays. The minimum fee floor is a current constant, applied at checkout. Flow:

1. `createAuction` (`src/lib/auctionDb.ts:112-115`) and `createFixedPriceListing` (`src/lib/auctionDb.ts:207-210`) call `getTransactionFeePercent(sellerId)` at write time and persist the result to `auctions.platform_fee_percent` (5 for premium/trialing, 8 for free — see `src/lib/subscription.ts:655-663`).
2. `/api/checkout` reads the stored `platform_fee_percent` off the listing row — *not* the seller's current tier — and computes the platform's `application_fee_amount = max(MIN_PLATFORM_FEE_CENTS, floor(totalCents × feePercent / 100))`, capped so the seller's net can never go negative.
3. **(Session 48)** Stripe Checkout receives `payment_intent_data.on_behalf_of` (the seller's Connect account ID) + `payment_intent_data.application_fee_amount` (the platform cut) + `transfer_data.destination` (the seller's Connect account). The charge settles on the seller's account as merchant of record; the platform receives only the application fee.

**Snapshot consequences (intentional, not a bug):**
- Premium seller lists, then cancels Premium → that listing still settles at 5% on purchase.
- Free seller lists, then upgrades to Premium → that listing still settles at 8% on purchase.
- Premium incentive is "list while you're Premium." If a future requirement is to recompute the rate at checkout, the change is `auctionDb.ts:115` and `:210` (drop the snapshot writes) plus `checkout/route.ts:151-154` (call `getTransactionFeePercent(listing.seller_id)` instead of reading the column).
- The $0.75 floor is **not** snapshotted — it's a const in `stripeConnect.ts` applied at checkout. Changing the floor affects all future settlements regardless of when the listing was created. If we ever need a snapshotted floor (so a price increase doesn't retroactively hit live listings), add `auctions.platform_fee_min_cents` and write it alongside `platform_fee_percent`.

**Stripe processing fee (~2.9% + $0.30):**

> **Note (Session 48):** As of the destination-charge switch, the **seller** is the merchant of record and Stripe deducts the ~2.9% + $0.30 processing fee from the seller's side of the charge; the platform receives the `application_fee_amount`. The worked examples in this subsection describe the PRE-Session-48 platform-as-merchant model and are retained for the fee-floor break-even math (which is unchanged). The buyer still pays exactly the listed total with no surcharge.

Worked example — $100 sale, 8% (free seller):
- Buyer pays $100.00 flat.
- Stripe deducts ~$3.20 processing fee from gross → platform balance gains $96.80.
- Stripe transfers `sellerAmount = 100 - floor(100 × 0.08) = $92.00` to the seller's Connect account (8% percent-fee is well above the $0.75 floor, so floor doesn't apply).
- Platform net: $96.80 − $92.00 = **~$4.80**.
- Seller net: $92.00.

Same sale at 5% (premium seller): platform net **~$1.80**, seller net $95.00.

**$0.75 minimum platform fee floor (Session 42, Apr 27 2026):**

Below the percent-fee/Stripe-fee break-even point, every sale lost the platform money:
- Free tier (8%) break-even: $5.88. Premium (5%) break-even: $14.29.
- April 27 PROD validation showed a $2 test sale at 8% nets the platform −$0.20 (Stripe pulls the difference from future charges).

Floor sized to keep every sale gross-positive after Stripe's $0.30 + 2.9%. Above $9.38 (8%) and $15.00 (5%) the percent-fee already exceeds the floor, so the floor is invisible to typical comic sales. Below those thresholds, the seller pays $0.75 instead of the smaller percent-fee.

Worked example — $5 sale, 8% (free seller):
- Without floor: fee = $0.40, seller gets $4.60, platform nets $4.55 − $4.60 = **−$0.05**.
- With floor: fee = $0.75 (max of $0.40 and $0.75), seller gets $4.25, platform nets $4.55 − $4.25 = **$0.30**.

Worked example — $10 sale, 5% (premium seller):
- Without floor: fee = $0.50, seller gets $9.50, platform nets $9.41 − $9.50 = **−$0.09**.
- With floor: fee = $0.75, seller gets $9.25, platform nets $9.41 − $9.25 = **$0.16**.

Edge case — $0.50 sale: percent-fee would be $0.04, floor wants $0.75, but the cap at `totalCents` ensures the seller payout never goes negative. Platform takes the full $0.50, seller gets $0.00. Still a loss for the platform once Stripe fees apply, but only an issue if anyone lists at sub-floor prices (rare; we may add a listing-price floor as a follow-up if abuse appears).

**Session 36 changes (April 21, 2026):**
- **Stripe Connect fully enabled in both test and live mode.** Destination-charge fee splits validated end-to-end on localhost with test keys (5% premium tier and 8% free tier both verified). Live webhook endpoint now subscribed to `account.updated` (8 of 8 events configured).
- **RLS silent-failure fix:** `purchaseFixedPriceListing`, `placeBid`, and `processEndedAuctions` now use `supabaseAdmin` for writes. The regular client was silently failing under RLS — UI showed "Purchase Complete" while DB state remained unchanged. This caused stuck listings and unpaid winners.
- **PaymentButton rendered in detail modals:** Both `ListingDetailModal` and `AuctionDetailModal` now render `PaymentButton` when the viewer is the winner with `payment_status = "pending"`. Status checks normalized to cover both `sold` (Buy Now) and `ended` (auction) post-sale states.
- **Contextual notification copy:** `createNotification` accepts optional `{title, message}` overrides, so Buy Now purchases show Buy-Now-specific copy instead of inheriting the default auction-completion text.
- **Checkout success redirect** fixed from `/my-auctions` (seller view) to `/collection` (buyer view) — the buyer is the one completing the checkout.

**Session 37 changes (April 22, 2026):**
- **Flat $1 bid increment across all price tiers.** `getBidIncrement()` now returns $1 regardless of price (previously tiered $1/$5/$25). Simplifies bidding UX for casual users.
- **Buy It Now auto-hides when bid exceeds BIN price.** Prevents buyers paying more than current leading bid. Also hidden when viewer is the seller.
- **Idempotent `processEndedAuctions`:** conditional `UPDATE ... WHERE status='active'` with row-count check. Repeat cron calls on same auction are no-ops — no duplicate win/sold notifications or emails.
- **`getListingComicData` FK-qualified embed.** `sold_via_auction_id` FK added in the sold-tracking migration created a second auctions↔comics FK path, breaking unqualified PostgREST embeds with PGRST201. All embeds now use `comics!auctions_comic_id_fkey(...)`. This was silently dropping every outbid/auction_won/auction_sold email.
- **Awaited outbid email send** (`placeBid`) replaced fire-and-forget IIFE. Errors now logged; no more silent drops on serverless.
- **Auction buyer feedback eligibility** unlocks on `shipped_at` (matches `checkSaleFeedbackEligibility`). Previously buyer had to wait for `completed_at` or 7 days.
- **`submitFeedback` join fix:** all `.select` calls referenced non-existent `first_name, last_name` — changed to `display_name, username`. Insert was succeeding; the returning join was failing silently as "Failed to submit feedback."
- **New `/transactions` page + API** — tabbed buyer view (Wins / Purchases / Bids / Offers) with status pills (Awaiting Shipment / Shipped / Pending Payment / Paid).
- **Mark-as-shipped flow** — `POST /api/auctions/[id]/mark-shipped` sets `shipped_at`, clones the comic to the buyer's collection, fires shipped notification. Ownership transfer is gated on shipping, not on payment.
- **Auction-end email templates** — `auction_won`, `auction_sold`, `bid_auction_lost` (new types); all deliver correctly after FK fix.
- **Friendly DB error translation** — `placeBid` maps `valid_max_bid` and RLS errors to user-facing messages instead of surfacing raw Postgres strings.

**Session 38 changes (April 23, 2026) — Payment Deadline Enforcement:**
- **Checkout-time deadline guard** (`/api/checkout`): HTTP 400 "The payment window for this auction has expired" when `listing.paymentDeadline < now`. Previously buyers could pay days/weeks late — route only checked `paymentStatus !== "pending"`.
- **Live countdown timer on `/transactions`** via new `<PaymentDeadlineCountdown>` client component. Neutral >24h, orange ≤24h, red ≤6h, "Expired" at ≤0. Ticks every 60s, hydration-safe.
- **`sendPaymentReminders()` cron pass** fires at T-24h, idempotent via `payment_reminder_sent_at` column. `payment_reminder` NotificationType was already declared but never emitted.
- **`expireUnpaidAuctions()` cron pass** transitions stale auctions (`status='ended' AND payment_status='pending' AND payment_deadline < NOW()`) to `status='cancelled'`, sets `payment_expired_at`, emails both parties. Race-safe via `WHERE payment_expired_at IS NULL` + `.select()` row-count check.
- **`PAYMENT_WINDOW_HOURS` const cleanup** — four hardcoded `48`s replaced with `calculatePaymentDeadline()`.
- **New cron pipeline:** `processEndedAuctions → sendPaymentReminders → expireUnpaidAuctions → expireOffers → expireListings` (Session 39 adds `expireSecondChanceOffers`).
- **Migration:** `20260423_payment_reminder_tracking.sql` — adds `payment_reminder_sent_at`, `payment_expired_at` columns + partial index on `(payment_deadline) WHERE status='ended' AND payment_status='pending'`.

**Session 40 changes (April 23, 2026) — Marketplace PROD testing polish:**
- **Checkout image URL guard** (`/api/checkout`): `product_data.images[0]` is now only passed to Stripe when the cover URL is `http(s)://` AND ≤2048 chars. Previously a long Supabase signed-URL JWT query param or a base64 `data:` URI blew Stripe's 2048-char cap and surfaced as HTTP 500 `invalid_request_error`. Cosmetic-only on Stripe Checkout when omitted. Consistent with the existing defensive pattern in `csvExport.ts`.
- **Rating-request notification moved to shipment.** `rating_request` previously fired from the Stripe webhook on payment completion, but server-side eligibility (`checkSaleFeedbackEligibility`) requires `shipped_at`. Buyers were prompted but found no feedback UI. `/api/auctions/[id]/mark-shipped` now fires `rating_request` for both buyer and seller at the moment the button actually becomes visible; the Stripe webhook emission was removed.
- **Feedback eligibility re-fetch on submit.** `useFeedbackEligibility` now accepts a `refreshKey` arg; callers in `ListingDetailModal` + `AuctionDetailModal` pass `${shippedAt}:${feedbackRefreshTick}` so the hook re-queries when `shippedAt` flips and again after `LeaveFeedbackButton.onFeedbackSubmitted` bumps the tick. UI swaps to "Feedback submitted on …" without a hard refresh.
- **Active Bids tab fix.** `/api/transactions?type=bids` had its Supabase select referencing column `amount`; the real column is `bid_amount`. Single-character rename in the select + matching `row.bid_amount` access site fixed the 500.
- **Outbid email — `yourMaxBid` line.** `BidActivityEmailData.yourMaxBid` field was already declared but the template never rendered it. HTML and text variants now conditionally render "Your max bid: $X"; wired from `currentWinningBid.max_bid` at the `placeBid` call site so bidders know if their proxy is still in the running.
- **Mobile auction/Buy-Now modal cover caps.** `AuctionDetailModal` cover image capped at `max-h-[35vh]` on mobile (desktop `md:max-h-[70vh]` unchanged); `ListingDetailModal` capped at `max-h-[40vh]` on mobile. Fixes cover image dominating the viewport and leaving a sliver for bid details.
- **Purchase confirmation email copy.** "The comic has been added to your collection." → "The comic will be added to your collection once the seller marks it as shipped." — matches actual ship-gated ownership-transfer timing.

**Session 39 changes (April 23, 2026) — Second Chance + Strike + Audit + Cron Batching:**
- **Second Chance Offer System** — When auction expires unpaid and runner-up exists, seller gets email + in-app notification with "Offer to runner-up" CTA. Runner-up has 48h to accept at their last actual bid price (not max_bid). No cascade. New table `second_chance_offers` + RLS, new routes (`/api/auctions/[id]/second-chance`, `/api/second-chance-offers`, `/api/second-chance-offers/[id]`), new components (`SecondChanceOfferButton`, `SecondChanceInboxCard`), cron pass `expireSecondChanceOffers`, 5 new email templates, 7 new notification types. See Feature #22 below.
- **Payment-Miss Strike System** — See Feature #21 below. Inside `expireUnpaidAuctions()`, increments `payment_missed_count`; 1st offense → warning email, 2+ strikes in 90 days → sets `bid_restricted_at`, inserts system-negative reputation rating, emails user + admins. `/api/auctions/[id]/bid` enforces bid restriction.
- **Auction Audit Log** — See Feature #23 below. New table `auction_audit_log` (admin-read RLS), `auction_audit_event_type` enum, `src/lib/auditLog.ts` helper, 17 wire-ups across auction/offer/payment/shipment lifecycle. Admins can now query a complete transaction log for dispute resolution + debugging.
- **Cron Batching** — `src/lib/concurrency.ts` with `mapWithConcurrency(5)`. `sendPaymentReminders` + `expireUnpaidAuctions` refactored: serial race-safe UPDATE → batched Supabase notification insert → Resend `batch.send()` (50 emails/batch). Handles 50+ expirations per tick without timeout or rate-limit issues.

**Key files:** `src/lib/auctionDb.ts`, `src/lib/auditLog.ts`, `src/lib/concurrency.ts`, `src/app/api/auctions/`, `src/app/api/second-chance-offers/`, `src/app/api/offers/`, `src/app/api/connect/`, `src/app/api/checkout/route.ts`, `src/app/api/transactions/route.ts`, `src/app/api/auctions/[id]/mark-shipped/route.ts`, `src/app/api/auctions/[id]/second-chance/route.ts`, `src/app/api/cron/process-auctions/route.ts`, `src/app/api/webhooks/stripe/route.ts`, `src/app/transactions/page.tsx`, `src/app/seller-onboarding/page.tsx`, `src/components/PaymentDeadlineCountdown.tsx`, `src/components/auction/`, `src/lib/cloneSoldComic.ts`, `src/types/auction.ts`, `docs/stripe-connect-setup.md`

---

## 12. P2P Trading System
Comics marked `for_trade` → algorithmic matching via `find_trade_matches()` RPC → match quality scoring → trade proposal → accept → ship (with tracking) → confirm receipt → `completeTrade()` swaps `comics.user_id` ownership. Feedback reminders auto-created post-completion.

**Key files:** `src/lib/tradingDb.ts`, `src/app/api/trades/`

---

## 13. Messaging System with Content Moderation
Conversation model (2-party) → content validation → spam/scam filter → block check → Supabase real-time broadcast → email notification (fire-and-forget). Cron-driven AI moderation: Claude analyzes flagged messages → severity scoring → auto-report creation for medium+.

**Key files:** `src/lib/messagingDb.ts`, `src/app/api/messages/`, `src/app/api/cron/moderate-messages/route.ts`

---

## 14. Follow System & Notification Chain
Unidirectional follows with denormalized counts on `profiles`. New listing triggers `notifyFollowersOfNewListing()` → batch notification insert → email dispatch for opted-in users. "Following Only" marketplace filter uses `getFollowingIds()`.

**Key files:** `src/lib/followDb.ts`, `src/app/api/follows/`, `src/components/follows/`

---

## 15. Seller Reputation & Feedback Engine
Binary ratings (positive/negative) per transaction (sale/auction/trade). 7-day edit window, 48-hour seller response window (negative only). Creator Credits for community contributions (key info, cover images). Reputation tiers: Hero (95%+, 5+ reviews), Villain (<50%), Neutral.

**Eligibility rules (Session 37 update):** Both sale and auction buyer eligibility unlock on `shipped_at` (seller-reported tracking). Fallback: 7 days after sale/auction end if seller never marks shipped. Seller eligibility unlocks immediately on ship-or-completed.

**Session 40b/c updates — rating-request timing + live eligibility refresh:**
- `rating_request` notification moved from the Stripe webhook (payment completed) to `/api/auctions/[id]/mark-shipped` so it fires at the same moment server-side eligibility flips true. Both buyer AND seller get a `rating_request` at shipment.
- `useFeedbackEligibility` now accepts a `refreshKey` arg. `ListingDetailModal` + `AuctionDetailModal` pass `${shippedAt}:${feedbackRefreshTick}` — the `shippedAt` half re-queries when shipment status changes; `LeaveFeedbackButton.onFeedbackSubmitted` bumps the tick so submission triggers a fresh query that returns `canLeaveFeedback: false` with `feedbackLeftAt` populated, swapping the UI to "Feedback submitted on …" without a hard refresh.

**Key files:** `src/lib/creatorCreditsDb.ts`, `src/app/api/feedback/`, `src/app/api/reputation/`, `src/hooks/useFeedbackEligibility.ts`, `src/components/auction/ListingDetailModal.tsx`, `src/components/auction/AuctionDetailModal.tsx`, `src/app/api/auctions/[id]/mark-shipped/route.ts`

---

## 16. Offline-First Architecture (PWA)
Service Worker: network-first for pages, cache-first for static assets. Offline action queue syncs on reconnect via Background Sync API. `useOffline` hook exposes `isOnline`, `pendingActionsCount`, `syncPendingActions()`. Guest collection stored entirely in localStorage.

**Session 47 (May 27, 2026) — Mobile nav hides during collection multi-select.** The floating bottom `MobileNav` was overlapping the collection's multi-select action bar. The collection page (`src/app/collection/page.tsx`) now dispatches a `cc:selection-mode` window `CustomEvent` (`{ detail: { active } }`) when entering/exiting select mode, and `MobileNav.tsx` listens for it and hides itself while selection is active. To keep the bar above everything, its z-index was raised (z-40 → z-50) and the grid bottom padding bumped (`pb-20` → `pb-28`) so the last row of comics isn't hidden behind the bar. Touch-target reliability was also fixed project-wide via Tailwind `future.hoverOnlyWhenSupported` (in `tailwind.config`) so sticky `:hover` styles no longer require a double-tap on iOS to select a checkbox.

**Key files:** `public/sw.js`, `src/hooks/useOffline.ts`, `src/lib/offlineCache.ts`, `src/lib/storage.ts`, `src/app/collection/page.tsx` (dispatches `cc:selection-mode`), `src/components/MobileNav.tsx` (listens, hides during select), `tailwind.config` (`hoverOnlyWhenSupported`)

---

## 17. ~~Hot Books / Trending Discovery~~ (REMOVED — Session 38)

Feature fully removed April 23, 2026. Deleted: `src/app/hottest-books/*`, `src/app/api/hottest-books/*`, `src/lib/hotBooksData.ts`. DB tables `hot_books`, `hot_books_history`, `hot_books_refresh_log` remain but are no longer read by any code path. Navigation entries pruned from `Navigation.tsx` and `MobileNav.tsx`. Removed because the feature did not align with product vision (collection & community first, marketplace secondary).

---

## 18. Public Collection Sharing
Toggle `is_public` → auto-generate URL slug → `/u/[slug]` renders public profile with collection stats, shared lists, and comics. RLS policies gate visibility. SEO metadata generation. Per-list sharing control via `is_shared` flag.

**Key files:** `src/app/u/[slug]/page.tsx`, `src/app/api/sharing/route.ts`, `src/lib/db.ts` (public profile functions)

---

## 19. Admin Operations Suite
Cover approval queue, barcode review queue, key info moderation, message report review, user management (suspend/grant premium/reset trial), health checks (eBay/storage connectivity), usage monitoring with rate limit alerts. **Session 39 addition:** flagged-users endpoint (`/api/admin/flagged-users`) surfaces users with `bid_restricted_at` set from the Payment-Miss Strike System.

**Key files:** `src/app/api/admin/`, `src/lib/adminAuth.ts`

---

## 20. Email System (Themed Templates)
Resend integration with comic-themed templates (POW!, BAM!, KA-CHING! sound effects). **27+ email types** (was 12+): welcome, trial expiring, offers, listings, messages, feedback reminders, followed seller alerts, auction won/sold/lost, payment received, shipped, rating request, plus Session 38+39 additions (payment_reminder, auction_payment_expired, auction_payment_expired_seller, payment_missed_warning, payment_missed_flagged, 5 Second Chance Offer templates). Cron-driven batch sending with idempotency guards.

**Session 39 additions:**
- **Preference gating** via `NOTIFICATION_CATEGORY_MAP` (`src/lib/notificationPreferences.ts`): 4 categories (Transactional locked / Marketplace / Social / Marketing). `sendNotificationEmail` + `sendNotificationEmailsBatch` check `profiles.email_pref_marketplace`/`email_pref_social`/`email_pref_marketing` before sending, return skipped count. (Schema: migration `20260423_notification_preferences.sql`.)
- **Resend `batch.send()`** used by cron passes — 50 emails/batch, fed via `mapWithConcurrency(5)` from `src/lib/concurrency.ts`. Unlocks 50+ payment expirations per cron tick without rate-limit issues.
- **UI:** per-category toggles at `/settings/notifications` (GET/PATCH on `/api/settings/notifications`), plus 29 unit tests.

**Session 40 copy polish:**
- **Outbid email — max bid line.** Template now conditionally renders "Your max bid: $X" on both HTML + text variants when `BidActivityEmailData.yourMaxBid` is present. Wired from `currentWinningBid.max_bid` at the `placeBid` call site so bidders can tell if their proxy is still in play.
- **Purchase confirmation email copy.** "added to your collection" → "will be added to your collection once the seller marks it as shipped" — matches ship-gated ownership-transfer timing.
- **Site-wide em dash sweep.** ~55 em dashes (U+2014) removed from user-facing copy across 10 files (all email templates HTML + text, FAQ answers, notification titles/messages, seller-onboarding guide, about/terms/settings, SecondChanceInboxCard, comicFacts, refresh-value error string, collection placeholder glyphs). Context-aware replacements: names followed by dash → comma; sentence break → period; gloss → colon; no-space dash → hyphen. ~224 occurrences intentionally skipped in code comments, console args, AI prompts, internal validator reasons, JSDoc, tests, migrations, and markdown docs.

**Session 48 (June 14, 2026) — one-click List-Unsubscribe + HTML escaping:**
- **RFC 8058 one-click unsubscribe.** Emails now carry `List-Unsubscribe` / `List-Unsubscribe-Post` headers pointing at a new `/api/unsubscribe` route. The link/header carries a **signed unsubscribe token** (`src/lib/signedToken.ts`, purpose-scoped via `UNSUBSCRIBE_SECRET`, which **falls back to `CLERK_SECRET_KEY`** if unset) so a click flips the recipient's email preference without requiring login and without exposing a forgeable user id. Token purpose is scoped so it can't be cross-used as a promo-trial / guest-scan token.
- **HTML escaping across templates.** User-supplied values interpolated into email HTML (titles, names, messages) are now escaped to prevent HTML/markup injection in rendered emails.
- **Batched sends** (Resend `batch.send()` via `mapWithConcurrency`) continue from Session 39 and were preserved through the `email.ts → src/lib/email/*` refactor.

**Key files:** `src/lib/email/*` (decomposed from `email.ts` in Session 48), `src/lib/signedToken.ts`, `src/app/api/unsubscribe/*`, `src/lib/notificationPreferences.ts`, `src/lib/concurrency.ts`, `src/types/notificationPreferences.ts`, `src/app/api/cron/send-trial-reminders/route.ts`, `src/app/api/cron/send-feedback-reminders/route.ts`, `src/app/api/settings/notifications/route.ts`, `src/app/settings/notifications/page.tsx`

---

## 21. Payment Deadline Enforcement + Payment-Miss Strike System (Sessions 38 + 39)

48-hour payment window enforced automatically from auction end (or Buy Now purchase) through the `/api/cron/process-auctions` pipeline.

**Timeline:**
- `T=0` — auction ends or Buy Now purchase → `payment_deadline` = T+48h
- `T+24h` — `sendPaymentReminders()` cron pass. Conditional UPDATE `WHERE payment_reminder_sent_at IS NULL` (race-safe). Resend `batch.send()` delivers `payment_reminder` templates via `mapWithConcurrency(5)`.
- `T+48h` — `expireUnpaidAuctions()` cron pass. Conditional UPDATE `WHERE payment_expired_at IS NULL`. Sets `status='cancelled'`, `payment_expired_at=NOW()`. Emails `auction_payment_expired` (buyer) + `auction_payment_expired_seller` (seller). Fires Payment-Miss Strike System.
- `T+48h`+ — checkout-time guard on `/api/checkout`: HTTP 400 "payment window has expired" if a late-pay attempt sneaks in.
- `/transactions` — live `<PaymentDeadlineCountdown>` ticks every 60s; neutral >24h, orange ≤24h, red ≤6h, "Expired" at ≤0.

**Payment-Miss Strike System (Session 39):**
- **1st offense:** increment `profiles.payment_missed_count`, set `payment_missed_at`, send `payment_missed_warning` email.
- **2+ strikes in 90 days:** set `profiles.bid_restricted_at`, insert system-generated negative `transaction_feedback` row (idempotent on unique constraint), email `payment_missed_flagged`, notify admins via `/api/admin/flagged-users`.
- **Enforcement:** `/api/auctions/[id]/bid` blocks bid placement when `bid_restricted_at IS NOT NULL`.
- **Audit:** every transition is logged to `auction_audit_log` (see Feature #23).

**Session 48 (June 14, 2026) — strike-counting correctness fix.** The payment-strike accumulation/restriction logic was corrected (strike counting + the 2-in-90-days restriction trigger) as part of the atomic Buy-It-Now / payment-path remediation, so missed-payment offenses are counted and the `bid_restricted_at` restriction is applied accurately.

**Migrations:**
- `20260423_payment_reminder_tracking.sql` — `payment_reminder_sent_at`, `payment_expired_at` columns + partial index (Session 38)
- `20260423_payment_miss_tracking.sql` — 4 profile columns + `user_flagged` audit enum value + `valid_notification_type` CHECK constraint fix (Session 39)

**Key files:** `src/lib/auctionDb.ts` (`sendPaymentReminders()`, `expireUnpaidAuctions()`), `src/lib/concurrency.ts`, `src/lib/email.ts`, `src/app/api/cron/process-auctions/route.ts`, `src/app/api/checkout/route.ts`, `src/app/api/auctions/[id]/bid/route.ts`, `src/app/api/admin/flagged-users/route.ts`, `src/components/PaymentDeadlineCountdown.tsx`, `src/types/auction.ts` (`calculatePaymentDeadline()`, `PAYMENT_REMINDER_WINDOW_HOURS`)

---

## 22. Second Chance Offer System (Session 39)

Seller-initiated re-offer to the runner-up after an auction expires unpaid.

**Flow:**
1. Auction expires unpaid via `expireUnpaidAuctions()` cron pass. If a runner-up exists, `handleRunnerUpForExpiredAuction()` (`auctionDb.ts:3293`) creates a `second_chance_available` in-app notification and email for the seller with an "Offer to runner-up" CTA. **Idempotent:** if a `second_chance_offers` row already exists for the auction, the function early-returns — no duplicate notification, safe for cron re-runs.
2. Seller clicks CTA in `SecondChanceOfferButton` → `POST /api/auctions/[id]/second-chance` → creates `second_chance_offers` row with `status='pending'`, `expires_at = NOW() + 48h`.
3. Runner-up is notified (`second_chance_offered` email + in-app), sees the offer in `SecondChanceInboxCard` with 48h countdown.
4. **Price = runner-up's last actual bid price** (not their `max_bid`).
5. Accept → `POST /api/second-chance-offers/[id]` (`action: "accept"`) → re-opens the auction row (see "Auction row transitions" below) → buyer flows into the standard `/api/checkout` path → same payment deadline enforcement and Stripe Connect payout as a normal won auction. Mark-shipped + feedback eligibility flows are **identical to a normal win** — no special casing downstream.
6. Decline or ignore → `expireSecondChanceOffers()` cron pass flips unanswered offers to `status='expired'` at the 48h mark. **No cascade** — the offer simply ends; it does NOT fall to 3rd place (tracked as a Low-priority BACKLOG enhancement).

**Runner-up selection rule** (`auctionDb.ts:3308-3325`): all bids for the auction ordered `bid_amount DESC, created_at ASC`. First row's `bidder_id` is the winner. Runner-up = the first subsequent row whose `bidder_id !== winner.bidder_id`. Ties in `bid_amount` are broken by earliest `created_at`. If there are fewer than 2 distinct bidders, no offer is created.

**Auction row transitions on accept** (`auctionDb.ts:3723-3767`): conditional UPDATE on `second_chance_offers` (race-safe — requires `status='pending' AND expires_at > NOW()`), then auction row patched with `status='ended'`, `winner_id = runnerUp`, `winning_bid = offer_price`, `payment_status='pending'`, `payment_deadline = NOW() + 48h`, `payment_expired_at = NULL`. Acceptance + auction re-open are **not transactional** — if the auction re-open fails, the offer stays accepted and the error is logged for admin follow-up.

**Infrastructure:**
- New table `second_chance_offers` with RLS (migration `20260423_second_chance_offers.sql`)
- **Columns:** `id`, `auction_id` (FK auctions), `runner_up_profile_id` (FK profiles — **not** `recipient_profile_id`), `offer_price` (numeric), `status` (`pending | accepted | declined | expired`), `expires_at`, `accepted_at`, `declined_at`, `created_at`
- New routes: `POST /api/auctions/[id]/second-chance` (seller creates), `GET /api/second-chance-offers` (runner-up's pending inbox), `POST/PATCH /api/second-chance-offers/[id]` (runner-up accepts/declines)
- New cron pass `expireSecondChanceOffers` added to `/api/cron/process-auctions` pipeline
- **5 email templates + 5 notification types** — `second_chance_available` (seller), `second_chance_offered` (runner-up), `second_chance_accepted` (seller), `second_chance_declined` (seller), `second_chance_expired` (seller). Types enumerated in `src/types/auction.ts:39-43`.
- **Audit events** emitted via `logAuctionAuditEvent`: `offer_accepted` + `offer_rejected` (both with `eventData.kind: "second_chance"` discriminator) on runner-up action; `second_chance_sent`, `second_chance_accepted`, `second_chance_expired` enum values are declared in `auction_audit_event_type` and wired at corresponding state transitions.
- Components: `src/components/auction/SecondChanceOfferButton.tsx`, `src/components/auction/SecondChanceInboxCard.tsx`

**Key files:** `src/lib/auctionDb.ts`, `src/types/auction.ts`, `src/app/api/auctions/[id]/second-chance/route.ts`, `src/app/api/second-chance-offers/route.ts`, `src/app/api/second-chance-offers/[id]/route.ts`, `src/components/auction/SecondChanceOfferButton.tsx`, `src/components/auction/SecondChanceInboxCard.tsx`

---

## 23. Auction Audit Log (Session 39)

Complete state-transition log for every auction/offer/payment/shipment event. Enables admin dispute resolution + debugging.

- **Table:** `auction_audit_log` (admin-read RLS, service-role insert). Migration: `20260423_auction_audit_log.sql`.
- **Enum:** `auction_audit_event_type` with 20+ events: `auction_created`, `bid_placed`, `auction_ended`, `buy_now_purchased`, `payment_received`, `payment_reminder_sent`, `payment_expired`, `second_chance_sent`, `second_chance_accepted`, `second_chance_expired`, `shipped`, `offer_sent`, `offer_accepted`, `offer_declined`, `user_flagged`, etc.
- **Helper:** `src/lib/auditLog.ts` — fire-and-forget single + batch variants; does NOT block critical path on failure.
- **Wire-ups:** 17 call sites across `src/lib/auctionDb.ts`, `src/app/api/auctions/[id]/mark-shipped/route.ts`, and `src/app/api/webhooks/stripe/route.ts`.
- **Tests:** 15 unit tests.

**Key files:** `src/lib/auditLog.ts`, `src/app/api/auctions/[id]/mark-shipped/route.ts`, `src/app/api/webhooks/stripe/route.ts`, `supabase/migrations/20260423_auction_audit_log.sql`

---

## 24. Input Validation Layer — Zod (Session 39)

All API routes (~81 as of Session 45b, after `quick-lookup` was retired alongside Comic Vine) validate input via a shared helper before any business logic runs.

- **Helper:** `src/lib/validation.ts` — `validateBody(request, schema)`, `validateQuery(request, schema)`, `validateParams(params, schema)`, plus reusable field schemas (`schemas.uuid` / `email` / `url` / `trimmedString` / `positiveInt` / `nonNegativeNumber`)
- **Standardized error:** HTTP 400 with `{error: "Validation failed", details: [{field, issue}]}`
- **`.strict()` support** used on `settings/*` routes to reject unknown fields
- **Scope:**
  - Marketplace + money (31 routes): auctions, offers, listings, checkout, billing, connect, trades, transactions, feedback, reputation
  - User + social + admin (32 routes): username, users, sellers, follows, messages, notifications, settings, age-verification, waitlist, email-capture, watchlist, sharing, location, admin/*
  - Content + scan + lookup: analyze, barcode-lookup, cert-lookup, comic-lookup, import-lookup, con-mode-lookup, key-hunt, cover-*, comics, ebay-prices, titles (`quick-lookup` removed in Session 45b — see Section 8 / Comic Vine retirement)
- **Dependency:** adds `zod` as a runtime dep

**Key files:** `src/lib/validation.ts`, `package.json` (zod), `src/app/api/**/*.ts` (~81 routes instrumented after Session 45b's `quick-lookup` removal)

---

## 25. Clerk ↔ Supabase Username & Profile Sync (Sessions 38 + 39)

Bidirectional sync so that Clerk and Supabase `profiles` never drift.

**Inbound (Clerk → Supabase)** — `/api/webhooks/clerk` on `user.created` and `user.updated`:
- Upserts `profiles` row with email + username (sanitized via `sanitizeUsername()` against Supabase's `^[a-z0-9_]{3,20}$` regex) + `first_name` + `last_name` + derived `display_name` (via `buildDisplayName()`)
- Sanitizer ensures invalid usernames (e.g. with dashes, which Clerk allows) don't kill the entire upsert — the rest of the fields still land

**Outbound (Supabase → Clerk)** — `/api/username` sync-on-write (Session 39):
- POST and DELETE now call the Clerk Backend API after successful Supabase update
- Graceful degradation: Clerk errors are logged but don't fail the request (Supabase remains source of truth)

**Known drift point:** Clerk dashboard allows dashes in usernames; Supabase's CHECK constraint doesn't. Still-open BACKLOG item to align Clerk's username rules so users get a friendly error at signup.

**Key files:** `src/app/api/webhooks/clerk/route.ts` (`sanitizeUsername()`, `buildDisplayName()`), `src/app/api/username/route.ts`, `src/lib/db.ts` (`getOrCreateProfile()` self-heals email)

---

## 26. Sales Page — Partial Gating for Free Tier (Session 40d/e)

The `/sales` page is visible to every user regardless of tier; only the aggregate stats UI is paywalled.

- **Always visible:** Sales list + per-row detail (Comic, Sale Price, Date). Free users can see their entire sold-books history.
- **Gated on `features.fullStats`:**
  - 3 Summary Cards at the top (Total Sales / Total Profit / Avg. Profit) — wrapped in a `relative` container with `filter blur-sm pointer-events-none select-none` and an absolutely positioned upgrade CTA overlay ("Unlock your Sales Stats" / "Start 7-Day Free Trial" / "View Pricing").
  - Cost `<th>`/`<td>` and Profit `<th>`/`<td>` in the desktop table + mobile detail panel — conditionally rendered behind `hasStatsAccess`.
  - Empty-state copy drops the "with profit tracking" phrase for free users.
- **Write path is tier-agnostic.** `markComicAsSold` in `src/lib/db.ts` always writes `purchase_price`, `sale_price`, and `profit` into the `sales` table. Free users' sale data is fully preserved → upgrading surfaces existing data retroactively. Overlay copy explicitly tells users "Your sale data is still being saved."

**Session 48 (June 14, 2026) — skippable bulk Mark-as-Sold + unpriced-sale tracking.** Bulk Mark-as-Sold (multi-select in the collection) now lets the user **skip the sale-price prompt per item**. Each selected comic still records a `sales` row, but a new `sale_price_recorded` boolean (migration `20260614_audit_closeout.sql`) records whether a price was actually entered. Revenue/profit displays now **annotate "unpriced" sold books** so totals are honest when some sales were marked without a price. The migration also adds `platform_fee` / `seller_net` columns to `sales` for marketplace-sourced sales accounting.

**Key files:** `src/app/sales/page.tsx`, `src/app/collection/page.tsx` (bulk Mark-as-Sold flow), `src/lib/db.ts` (`markComicAsSold`), `supabase/migrations/20260614_audit_closeout.sql`

---

## 27. Ask the Professor FAQ Modal (Session 40b/c)

Site-wide FAQ modal surfaced from `Navigation.tsx` (desktop) and `AskProfessor.tsx` (mobile).

- **Session 40b content addition:** "What happens after I buy a comic?" entry explains the payment → seller notified → ship → comic added to collection → feedback window flow. Sets expectations for the ship-gated ownership transfer and answers the "why doesn't it show up yet?" question in plain English.
- **Session 40c UX polish:**
  - **Body scroll lock.** `useEffect` in `Navigation.tsx` sets `document.body.style.overflow = "hidden"` while `showProfessor` is true, with cleanup restoring the previous value. Prevents the underlying page from scrolling once the user reaches the end of the FAQ list.
  - **Internal link → close modal.** Delegated click handler on the FAQ list container closes the modal (`setShowProfessor(false)`) when the click target is inside an `<a>`. Works for the existing Seller Onboarding link and any future FAQ links without per-link wiring.

**Key files:** `src/components/Navigation.tsx`, `src/components/AskProfessor.tsx`

---

## 28. Notifications Inbox (Session 42d, Apr 27 2026)

Full-page `/notifications` view that complements the bell-dropdown preview. Mobile-first — the bell line-clamps message bodies and offers no escape route; the inbox renders full text with infinite scroll, per-row dismiss, and offline cache hydration. Designed to be the deep-link destination for Capacitor iOS push notifications once the native app ships.

**Routing & deep-link contract:**
- `getNotificationDeepLink(notification)` is the single source of truth across bell, inbox, email links, and the future Capacitor `PushNotifications` listener. When the notification carries an `auction_id` it links to `/shop?listing=<id>` (or `…&leave-feedback=true` for `rating_request`). When it doesn't (system-only types), it links to `/notifications?focus=<id>`.
- The inbox reads `?focus=<id>` on mount and either scrolls/flash-highlights the row in the current page, or fetches it via `GET /api/notifications/:id` to confirm existence. On 404 (e.g., the row was pruned) it surfaces a toast and `router.replace`s the URL to clear the param so a remount doesn't re-trigger.

**Pagination:**
- Composite cursor `(created_at, id)` ordered DESC. Single-key cursors break under the cron's batch inserts (`processEndedAuctions`, `sendPaymentReminders`, `notifyFollowersOfNewListing`) which all share `now()` to the microsecond.
- Wire format: base64 of `${createdAt}|${id}`, URL-safe (`+` → `-`, `/` → `_`, no padding).
- Server-side `limit` capped at `NOTIFICATIONS_PAGE_LIMIT_MAX = 100`.
- SQL builder uses PostgREST `.or("created_at.lt.X,and(created_at.eq.X,id.lt.Y)")` because the JS client doesn't natively express row-tuple `<`.

**Auto-cleanup:**
- `pruneOldNotifications()` cron pass (every 5 min via Netlify scheduled function): hard-deletes rows where `read_at < NOW() - 30d` AND rows where `is_read = false AND created_at < NOW() - 90d`. Returns counts; cron logs them.
- Trade-off documented: email links pointing at `/notifications?focus=<id>` go 404-feeling after 30 days. Most email links target the underlying auction directly via `getNotificationDeepLink`, so this is a corner case for system-only types only.

**Schema (migration `20260427_notifications_inbox.sql`):**
- `read_at TIMESTAMPTZ NULL` (drives 30-day prune; backfilled to `created_at` for already-read rows)
- `idx_notifications_user_created (user_id, created_at DESC)` — covers the cursor hot path
- `idx_notifications_cleanup (read_at) WHERE read_at IS NOT NULL` — bounded prune index
- New RLS DELETE policy `notifications_delete_policy USING (user_id = current_profile_id())` (defense-in-depth; the API uses `supabaseAdmin` so it bypasses RLS, but the policy stops anyone refactoring to the anon client)

**Security:**
- `markNotificationRead(notificationId, userId)` is now owner-scoped — a pre-existing IDOR (any auth'd user could mark anyone else's notification read by guessing UUIDs) was discovered in Round 2 of the deep dive and patched as part of this work.
- `markAllNotificationsRead(userId, asOf?)` clamps to `created_at <= asOf` so notifications arriving mid-flight aren't silently swept; also narrows by `read_at IS NULL` for idempotent re-runs.
- `DELETE /api/notifications/:id` does atomic `.eq("id", id).eq("user_id", profile.id)`, suspension check, and rejects `NON_DELETABLE_NOTIFICATION_TYPES` (`payment_missed_warning`, `payment_missed_flagged`, `auction_payment_expired`, `auction_payment_expired_seller`) — moderation/safety evidence the user shouldn't be able to erase.
- `GET /api/notifications/:id` returns 404 (not 403) on owner mismatch to avoid leaking existence.

**Bell behavior** (reversed from the original plan after Round 1's "liar badge" feedback):
- Shows ALL notifications. System-only types (no `auction_id`) render dimmed + non-clickable with "View in inbox for details" hint. Badge count = ALL unread (honest math).
- Footer adds "View all notifications →" link to `/notifications`.

**Offline-first cache:**
- `notificationsCache.ts` stores last successful inbox response in localStorage, profile-namespaced (`cc_notifications_inbox_<profileId>`), version-tagged (CACHE_VERSION = 1).
- On fetch failure, hydrate from cache + show banner "Showing cached notifications. Tap to refresh →". Distinguishes offline-empty from true-empty so a user tapping a push from lock-screen doesn't see "You're all caught up" when their inbox actually has content.
- Cleared on Clerk sign-out via `useEffect` watching `userId`.

**Mobile/Capacitor decisions:**
- No custom pull-to-refresh in v1 — iOS WKWebView's native bounce conflicts with JS-level pull events. Show "Last updated Xm ago — tap to refresh" pill instead. Defer to `@capacitor/pull-to-refresh` when native app ships.
- 44×44pt transparent padding around the per-row X dismiss button + `e.stopPropagation()` to prevent fat-finger collision with the row tap.
- Cards: min-height 88px, `line-clamp-3` on the message — long messages don't break the Lichtenstein bordered card layout.

**Tests:** 20 new unit tests across `notificationCursor.test.ts` and `notificationLinks.test.ts`. Cursor tests cover encode/decode roundtrip + URL-safety + malformed-input tolerance + the PostgREST `.or()` builder. Link tests cover deep-link mapping + clickability predicate + `NON_DELETABLE_TYPES` membership matrix.

**Three rounds of deep-dive review** before code: 3 Critical / 8 High / 9 Medium / 6 Low (R1) → 1 Critical / 2 High / 3 Medium (R2) → PASS with 2 minor follow-ups (R3, both captured for post-launch BACKLOG). Findings logged to `docs/superpowers/deep-dive-learnings.md`.

**Key files:**
- `src/lib/notificationLinks.ts`, `src/lib/notificationCursor.ts`, `src/lib/notificationsCache.ts`
- `src/lib/auctionDb.ts` (helpers + IDOR fix)
- `src/app/api/notifications/route.ts`, `src/app/api/notifications/[id]/route.ts`
- `src/app/notifications/page.tsx`, `src/components/notifications/NotificationsInbox.tsx`
- `src/components/NotificationBell.tsx`, `src/components/Navigation.tsx`
- `supabase/migrations/20260427_notifications_inbox.sql`
- `supabase/migrations/20260427_add_shipped_notification_type.sql` (companion: `shipped` notification type + Truck icon)

---

## 29. Modal Accessibility & Motion/Zoom Controls (Session 48, June 14, 2026)

Site-wide accessibility pass landed during the Session 48 audit remediation + refactor.

- **`useModalA11y` hook.** A single hook gives every overlay proper dialog semantics: `role="dialog"` / `aria-modal`, **Escape-to-close**, **focus trap + focus restore** on close, and initial-focus management. **17 overlay modals plus `ComicDetailModal`** were converted to use it, so all blocking overlays now behave consistently for keyboard and screen-reader users. `ComicDetailModal` / `ComicDetailsForm` were decomposed into `src/components/comicDetail/*` as part of the same work, with the modal becoming a true accessible dialog.
- **Global reduced-motion support.** Animations/transitions respect `prefers-reduced-motion` site-wide (the scan-result and modal transitions no longer animate for users who opt out).
- **Pinch-zoom re-enabled.** The viewport no longer disables pinch-zoom globally (an accessibility regression); zoom is now allowed everywhere **except during an active scan**, where it stays locked so the framing UI isn't disrupted mid-capture.

**Key files:** `src/hooks/useModalA11y.ts`, `src/components/comicDetail/*` (ComicDetailModal / ComicDetailsForm decomposition), the 17 overlay-modal components wired to the hook, `src/app/scan/page.tsx` (scan-time zoom lock), viewport/meta + global motion CSS.

---

## 30. Branding — "Technopathic" Terminology (Session 48, June 14, 2026)

All user-facing "AI" copy was replaced with the brand's **"Technopathic"** terminology (cover scanning, price estimates, FAQ answers, metadata description, sign-up benefits, etc.). This is the brand-approved direction; the project's `CLAUDE.md` documents an exact per-file **"revert technopathy"** command to roll the wording back to "AI" if ever needed. Code identifiers, prompts, comments, and provider names are intentionally unchanged — copy-only.

**Key files:** `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/sign-up/[[...sign-up]]/page.tsx`, `src/components/Navigation.tsx`, `src/components/AskProfessor.tsx`, `src/components/comicDetail/*`, `src/app/key-hunt/page.tsx`, `src/components/KeyHuntPriceResult.tsx`, `src/hooks/useOffline.ts`, `src/app/api/analyze/route.ts` (disclaimer strings). Full per-file inventory lives in `CLAUDE.md` under "Revert Technopathy Command".
