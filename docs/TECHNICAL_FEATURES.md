# Collectors Chest - Key Technical Features

> Reference document for spec doc creation. Each feature below should get its own detailed spec document through individual review sessions.

---

## 1. AI Cover Recognition & Multi-Provider Fallback
Camera capture → image compression (400KB target) → Claude Vision (primary) → Gemini (fallback) → structured comic identification. Two independent AI calls: image analysis (12s timeout) + verification/enrichment (8s timeout). Per-call fallback logic, non-retryable error detection, cost tracking ($0.02-0.03/scan Anthropic, $0.004-0.006 Gemini).

**Session 31 additions — Slab detection AI calls:**
- `detectSlab()` — Quick binary classification: is this a slabbed comic? Returns `SlabDetectionResult` with confidence score
- `extractSlabDetails()` — Detailed extraction from slab label: cert number, grade, grading company, label color, title, issue, variant, key comments, art comments, barcode. Returns `SlabDetailExtractionResult`
- New prompts: `SLAB_DETECTION_PROMPT`, `SLAB_DETAIL_EXTRACTION_PROMPT`, `SLAB_COVER_HARVEST_ONLY_PROMPT`
- New AICallType values: `slabDetection`, `slabDetailExtraction`
- Updated barcode detection prompt for slabbed comics (reads barcode through slab case)

**Key files:** `src/lib/aiProvider.ts`, `src/lib/providers/anthropic.ts`, `src/lib/providers/gemini.ts`, `src/lib/providers/types.ts`, `src/app/api/analyze/route.ts`

---

## 2. Real-Time Pricing Engine (eBay Browse API)
OAuth token management → keyword search builder → category fallback chain (Comics → Collectibles → All) → outlier filtering (remove top/bottom 10%) → Q1 conservative pricing (25th percentile instead of median for more buyer-friendly estimates, min 3 listings) → grade multiplier extrapolation (6 grades from single lookup). Redis cache: 12h for results, 1h for "no data."

**Session 31 improvements:**
- **Year disambiguation:** `buildSearchKeywords()` accepts optional `year` param to differentiate same-title reboots (e.g., "Amazing Spider-Man #1 1963" vs "Amazing Spider-Man #1 2022")
- **Irrelevant listing filtering:** `filterIrrelevantListings()` removes non-comic results (lots, sets, posters, reprints, etc.) before price calculation
- **Q1 pricing:** `filterOutliersAndCalculateMedian()` now uses Q1 (25th percentile) instead of median for more conservative, buyer-friendly estimates
- **Grade filtering for slabs:** When pricing slabbed comics, search includes grade in keywords and filters results to only matching grade

**Key files:** `src/lib/ebayBrowse.ts`, `src/app/api/ebay-prices/route.ts`, `src/lib/gradePrice.ts`

---

## 3. Cover Image Pipeline & Auto-Harvest
Four-source waterfall for finding covers: Community covers → eBay listing images → Open Library → Gemini validation. Community submission with auto-approve (single match) or admin queue (multi-match). Creator Credits awarded on approval.

**Auto-harvest from graded scans:** When scanning slabbed comics, the AI reports crop coordinates for the cover artwork visible through the slab. If harvestable (sharp, well-lit, minimal glare), the pipeline automatically crops the cover, converts to WebP, uploads to Supabase Storage, and submits to the community cover DB — zero user friction. Runs pre-response with a 2s timeout. Deduplication via partial unique index.

**Key files:** `src/lib/coverValidation.ts`, `src/lib/coverImageDb.ts`, `src/lib/coverHarvest.ts`, `src/app/api/cover-images/route.ts`

---

## 4. Multi-Layer Caching Architecture
Redis (backend): eBay prices (12h), metadata (7d), AI analysis (30d), barcodes (6mo), certs (1yr). localStorage (frontend): offline lookups (7d, 30 items LRU), scan history, guest collection. Image hash cache prevents re-analyzing identical photos.

**Key files:** `src/lib/cache.ts`, `src/lib/offlineCache.ts`, `src/lib/storage.ts`

---

## 5. Scan Quota & Reservation System
Guest: 5 scans (client-side + server header validation, +5 via email capture). Free: 10/month (atomic `reserveScanSlot()` with conditional UPDATE). Premium: unlimited. Purchased 10-packs ($1.99, never expire). Scan slot released on AI failure. Monthly auto-reset on 1st.

**Key files:** `src/lib/subscription.ts`, `src/hooks/useGuestScans.ts`, `src/app/api/analyze/route.ts`

---

## 6. Subscription & Trial Lifecycle
Three paths: 7-day direct trial (no Stripe, DB-only) → 30-day promo trial (QR code → localStorage flag → Stripe subscription with `trial_period_days: 30`) → paid subscription ($4.99/mo or $49.99/yr). Webhook-driven state machine: created → active/trialing → past_due → canceled → downgrade. Idempotent webhook processing via event ID cache.

**Key files:** `src/lib/subscription.ts`, `src/app/api/billing/`, `src/app/api/webhooks/stripe/route.ts`, `src/lib/promoTrial.ts`

---

## 7. CGC/CBCS/PGX Certificate Verification
HTML scraping of grading company websites → structured data extraction (grade, page quality, signatures, label type, grader notes) → 1-year Redis cache. Auto-detection of grading company from cert number format. Feeds into pricing, cover harvesting, and cert-first scan pipelines.

**Session 31 additions:**
- `src/lib/certHelpers.ts` — `normalizeGradingCompany()` standardizes company names, `parseKeyComments()` / `mergeKeyComments()` combine AI-detected and cert-provider key comments, `parseArtComments()` extracts art-related notes
- Cert lookup integrated into cert-first pipeline Phase 3 for automatic verification during slab scans

**Key files:** `src/lib/certLookup.ts`, `src/lib/certHelpers.ts`, `src/app/api/cert-lookup/route.ts`

---

## 8. Barcode Detection & Catalog System
AI extracts 12-17 digit UPC → parsed into prefix/item/check/addon components → variant extracted from digits 16-17 → crowd-sourced `barcode_catalog` lookup → low-confidence entries queued for admin review in `admin_barcode_reviews`.

**Key files:** `src/app/api/analyze/route.ts`, `src/lib/db.ts` (barcode catalog functions)

---

## 8b. Cert-First Scan Pipeline (Slabbed Comics)
Dedicated scan pipeline for slabbed/graded comics that bypasses standard cover recognition. Triggered when slab detection AI call returns positive. Five-phase pipeline:

- **Phase 1 — Slab Detection:** `executeSlabDetection()` with Gemini → Anthropic fallback. Quick binary: is this a slab?
- **Phase 2 — Slab Detail Extraction:** `executeSlabDetailExtraction()` reads cert number, grade, grading company, label color (blue/yellow/green/etc.), title, issue, variant, key comments, art comments from the slab label photo
- **Phase 3 — Cert Lookup:** If cert number found, scrapes CGC/CBCS/PGX for verification. `mergeKeyComments()` combines AI-detected comments with cert provider data. `normalizeGradingCompany()` standardizes company names
- **Phase 4 — eBay Pricing:** Grade-specific search with year disambiguation. `filterIrrelevantListings()` removes non-comic results. Q1 conservative pricing. Grade included in search keywords for slabbed results
- **Phase 5/5.5 — Cache, Cover Harvest, Analytics:** Results cached in metadata. Cover harvested if eligible. Analytics logged with `scan_path: 'cert-first'` and `barcode_extracted` fields

**Migration:** `supabase/migrations/20260405_cert_first_analytics.sql` — adds `scan_path` and `barcode_extracted` columns to `scan_analytics`

**Key files:** `src/app/api/analyze/route.ts` (Phases 1-5.5), `src/lib/aiProvider.ts`, `src/lib/certHelpers.ts`, `src/lib/providers/anthropic.ts`, `src/lib/providers/gemini.ts`, `src/lib/metadataCache.ts`, `src/lib/analyticsServer.ts`

---

## 9. Collection Entry Flows (4 paths)
- **Camera scan**: AI analysis → review/edit → save
- **Manual entry**: Form → optional metadata enrichment via Claude → save
- **CSV import**: Parse → per-row `/api/import-lookup` (cache-first, AI fallback) → bulk insert
- **Key Hunt**: Cover scan or manual → grade select → price lookup → optional "Add to Collection"

**Key files:** `src/app/scan/page.tsx`, `src/components/ComicDetailsForm.tsx`, `src/lib/csvHelpers.ts`, `src/app/api/import-lookup/route.ts`

---

## 10. Key Hunt (Convention Mode)
Mobile-first quick-lookup: cover scan or manual entry → grade selector → `/api/con-mode-lookup` → eBay pricing with grade extrapolation table. Offline-capable via localStorage cache (30 items). History tracking with re-lookup. Wishlist with price drop notifications (`key_hunt_lists` table).

**Key files:** `src/app/key-hunt/page.tsx`, `src/app/api/con-mode-lookup/route.ts`, `src/app/api/key-hunt/route.ts`, `src/lib/offlineCache.ts`

---

## 11. Auction & Fixed-Price Marketplace
Two listing types: timed auction (1-14 days, proxy bidding) and fixed-price (30-day, accepts offers). Offer negotiation (max 3 rounds, 7-day expiry). Stripe Connect for seller payouts. Transaction fees: 8% free / 5% premium. Cron-driven auction processing, listing expiration, and offer expiration.

**Key files:** `src/lib/auctionDb.ts`, `src/app/api/auctions/`, `src/app/api/offers/`, `src/app/api/connect/`

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

**Key files:** `src/lib/creatorCreditsDb.ts`, `src/app/api/feedback/`, `src/app/api/reputation/`

---

## 16. Offline-First Architecture (PWA)
Service Worker: network-first for pages, cache-first for static assets. Offline action queue syncs on reconnect via Background Sync API. `useOffline` hook exposes `isOnline`, `pendingActionsCount`, `syncPendingActions()`. Guest collection stored entirely in localStorage.

**Key files:** `public/sw.js`, `src/hooks/useOffline.ts`, `src/lib/offlineCache.ts`, `src/lib/storage.ts`

---

## 17. ~~Hot Books / Trending Discovery~~
`hot_books` table with AI-generated rankings. Background eBay price refresh (24h TTL). Historical tracking in `hot_books_history` for trend analysis. Rank change tracking. "Add to Hunt List" integration.

**Status:** CANDIDATE FOR REMOVAL — Feature still exists in codebase but does not align with product vision (collection & community first, marketplace secondary). Code, routes, pages, and DB tables still present. Needs cleanup session to remove.

**Affected files:** `src/app/api/hottest-books/route.ts`, `src/app/hottest-books/page.tsx`, `src/app/hottest-books/HotBooksClient.tsx`, `src/lib/hotBooksData.ts`, `src/components/AddToKeyHuntButton.tsx` (partial), DB tables: `hot_books`, `hot_books_history`

---

## 18. Public Collection Sharing
Toggle `is_public` → auto-generate URL slug → `/u/[slug]` renders public profile with collection stats, shared lists, and comics. RLS policies gate visibility. SEO metadata generation. Per-list sharing control via `is_shared` flag.

**Key files:** `src/app/u/[slug]/page.tsx`, `src/app/api/sharing/route.ts`, `src/lib/db.ts` (public profile functions)

---

## 19. Admin Operations Suite
Cover approval queue, barcode review queue, key info moderation, message report review, user management (suspend/grant premium/reset trial), health checks (Metron/eBay/storage connectivity), usage monitoring with rate limit alerts.

**Key files:** `src/app/api/admin/`, `src/lib/adminAuth.ts`

---

## 20. Email System (Themed Templates)
Resend integration with comic-themed templates (POW!, BAM!, KA-CHING! sound effects). 12+ email types: welcome, trial expiring, offers, listings, messages, feedback reminders, followed seller alerts. Cron-driven batch sending with idempotency guards.

**Key files:** `src/lib/email.ts`, `src/app/api/cron/send-trial-reminders/route.ts`, `src/app/api/cron/send-feedback-reminders/route.ts`
