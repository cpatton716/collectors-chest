# Collectors Chest - Key Technical Features

> Reference document for spec doc creation. Each feature below should get its own detailed spec document through individual review sessions.
>
> **Last Updated:** April 23, 2026 — Sessions 38 + 39 + 40 (a–e)

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

**Session 40b addition — On-demand FMV refresh per comic:** `POST /api/comics/[id]/refresh-value` runs eBay Browse lookup for a single owned comic (owner-auth gated) and persists the result to `price_data` + `average_price` on that comic row. Honors the same 12h Redis cache as `/api/ebay-prices`. UI wire-up: `ComicDetailModal` renders a blue "Look Up Market Value" CTA when `effectivePriceData?.estimatedValue` is falsy (e.g., buyer-side clones of manually-added comics where the seller never scanned), and a "Refresh value" link inside the value card once data exists. Result is applied optimistically via local state so the new value appears without a reload. Known limitation (BACKLOG): `MIN_LISTINGS_THRESHOLD = 3` at exact grade returns "No eBay sales data found" for rare keys at uncommon grades — grade-band fallback needed pre-launch.

**Key files:** `src/lib/ebayBrowse.ts`, `src/app/api/ebay-prices/route.ts`, `src/app/api/comics/[id]/refresh-value/route.ts`, `src/lib/gradePrice.ts`, `src/components/ComicDetailModal.tsx`

---

## 3. Cover Image Pipeline & Auto-Harvest
Four-source waterfall for finding covers: Community covers → eBay listing images → Open Library → Gemini validation. Community submission with auto-approve (single match) or admin queue (multi-match). Creator Credits awarded on approval.

**Auto-harvest from graded scans:** When scanning slabbed comics, the AI reports crop coordinates for the cover artwork visible through the slab. If harvestable (sharp, well-lit, minimal glare), the pipeline automatically crops the cover, converts to WebP, uploads to Supabase Storage, and submits to the community cover DB — zero user friction. Runs pre-response with a 2s timeout. Deduplication via partial unique index.

**Session 39 addition — Aspect-ratio guard:** `src/lib/coverCropValidator.ts` rejects AI-returned crop coordinates outside the comic-book aspect range (0.55-0.85 w/h). Runs at the top of `harvestCoverFromScan` so out-of-range crops don't pollute the cover cache. 16 unit tests.

**Key files:** `src/lib/coverValidation.ts`, `src/lib/coverImageDb.ts`, `src/lib/coverHarvest.ts`, `src/lib/coverCropValidator.ts`, `src/app/api/cover-images/route.ts`

---

## 4. Multi-Layer Caching Architecture
Redis (backend): eBay prices (12h), metadata (7d), AI analysis (30d), barcodes (6mo), certs (1yr). localStorage (frontend): offline lookups (7d, 30 items LRU), scan history, guest collection. Image hash cache prevents re-analyzing identical photos.

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

**Session 39 addition — hCaptcha Guest Scan Protection:** Invisible hCaptcha gates guest scans **4 and 5 only** (the last two free scans before the limit). Client via `@hcaptcha/react-hcaptcha` with floating badge (`src/components/GuestCaptcha.tsx`), server helper at `src/lib/hcaptcha.ts` with 5s siteverify timeout and dev/prod key swap. Env vars: `HCAPTCHA_SECRET` + `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`.

**Key files:** `src/lib/subscription.ts`, `src/lib/uploadLimits.ts`, `src/lib/hcaptcha.ts`, `src/hooks/useGuestScans.ts`, `src/components/GuestCaptcha.tsx`, `src/app/api/analyze/route.ts`

---

## 6. Subscription & Trial Lifecycle
Three paths: 7-day direct trial (no Stripe, DB-only) → 30-day promo trial (QR code → localStorage flag → Stripe subscription with `trial_period_days: 30`) → paid subscription ($4.99/mo or $49.99/yr). Webhook-driven state machine: created → active/trialing → past_due → canceled → downgrade. Idempotent webhook processing via event ID cache.

**Key files:** `src/lib/subscription.ts`, `src/app/api/billing/`, `src/app/api/webhooks/stripe/route.ts`, `src/lib/promoTrial.ts`

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
AI extracts 12-17 digit UPC → parsed into prefix/item/check/addon components → variant extracted from digits 16-17 → crowd-sourced `barcode_catalog` lookup → low-confidence entries queued for admin review in `admin_barcode_reviews`.

**Key files:** `src/app/api/analyze/route.ts`, `src/lib/db.ts` (barcode catalog functions)

---

## 8b. Cert-First Scan Pipeline (Slabbed Comics)
Dedicated scan pipeline for slabbed/graded comics that bypasses standard cover recognition. Triggered when slab detection AI call returns positive. Five-phase pipeline:

- **Phase 1 — Slab Detection:** `executeSlabDetection()` with Gemini → Anthropic fallback. Quick binary: is this a slab?
- **Phase 2 — Slab Detail Extraction:** `executeSlabDetailExtraction()` reads cert number, grade, grading company, label color (blue/yellow/green/etc.), title, issue, variant, key comments, art comments from the slab label photo
- **Phase 3 — Cert Lookup:** If cert number found, scrapes CGC/CBCS/PGX for verification. `mergeKeyComments()` combines AI-detected comments with cert provider data. `normalizeGradingCompany()` standardizes company names
- **Phase 4 — eBay Pricing:** Grade-specific search with year disambiguation. `filterIrrelevantListings()` removes non-comic results. Q1 conservative pricing. Grade included in search keywords for slabbed results
- **Phase 4.5 — Metadata Cache Gate:** Checks issue-level cache (Redis → Supabase) for creators. If all 3 present (writer, coverArtist, interiorArtist), skips Phase 5 AI call. This is the key cost optimization — after the first scan of any issue, subsequent scans skip the ~0.5¢ AI call
- **Phase 5/5.5 — Focused AI / Cover Harvest:** Phase 5 extracts creators + barcode via AI (only if cache miss). Phase 5.5 runs cover harvest only (when cache hit). End-of-route save persists all data to issue-level cache for future scans. Analytics logged with `scan_path: 'cert-first'` and `barcode_extracted` fields

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
Two listing types: timed auction (1-14 days, proxy bidding) and fixed-price (30-day, accepts offers). Offer negotiation (max 3 rounds, 7-day expiry). Stripe Connect (Express) for seller payouts via destination charges. Transaction fees: 8% free / 5% premium (seller-favorable `Math.floor` rounding). Cron-driven auction processing, listing expiration, and offer expiration.

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

**Key files:** `public/sw.js`, `src/hooks/useOffline.ts`, `src/lib/offlineCache.ts`, `src/lib/storage.ts`

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
- **Preference gating** via `NOTIFICATION_CATEGORY_MAP` (`src/lib/notificationPreferences.ts`): 4 categories (Transactional locked / Marketplace / Social / Marketing). `sendNotificationEmail` + `sendNotificationEmailsBatch` check `profiles.notify_marketplace`/`notify_social`/`notify_marketing` before sending, return skipped count.
- **Resend `batch.send()`** used by cron passes — 50 emails/batch, fed via `mapWithConcurrency(5)` from `src/lib/concurrency.ts`. Unlocks 50+ payment expirations per cron tick without rate-limit issues.
- **UI:** per-category toggles at `/settings/notifications` (GET/PATCH on `/api/settings/notifications`), plus 49 unit tests.

**Session 40 copy polish:**
- **Outbid email — max bid line.** Template now conditionally renders "Your max bid: $X" on both HTML + text variants when `BidActivityEmailData.yourMaxBid` is present. Wired from `currentWinningBid.max_bid` at the `placeBid` call site so bidders can tell if their proxy is still in play.
- **Purchase confirmation email copy.** "added to your collection" → "will be added to your collection once the seller marks it as shipped" — matches ship-gated ownership-transfer timing.
- **Site-wide em dash sweep.** ~55 em dashes (U+2014) removed from user-facing copy across 10 files (all email templates HTML + text, FAQ answers, notification titles/messages, seller-onboarding guide, about/terms/settings, SecondChanceInboxCard, comicFacts, refresh-value error string, collection placeholder glyphs). Context-aware replacements: names followed by dash → comma; sentence break → period; gloss → colon; no-space dash → hyphen. ~224 occurrences intentionally skipped in code comments, console args, AI prompts, internal validator reasons, JSDoc, tests, migrations, and markdown docs.

**Key files:** `src/lib/email.ts`, `src/lib/notificationPreferences.ts`, `src/lib/concurrency.ts`, `src/types/notificationPreferences.ts`, `src/app/api/cron/send-trial-reminders/route.ts`, `src/app/api/cron/send-feedback-reminders/route.ts`, `src/app/api/settings/notifications/route.ts`, `src/app/settings/notifications/page.tsx`

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

**Migrations:**
- `20260423_payment_reminder_tracking.sql` — `payment_reminder_sent_at`, `payment_expired_at` columns + partial index (Session 38)
- `20260423_payment_miss_tracking.sql` — 4 profile columns + `user_flagged` audit enum value + `valid_notification_type` CHECK constraint fix (Session 39)

**Key files:** `src/lib/auctionDb.ts` (`sendPaymentReminders()`, `expireUnpaidAuctions()`), `src/lib/concurrency.ts`, `src/lib/email.ts`, `src/app/api/cron/process-auctions/route.ts`, `src/app/api/checkout/route.ts`, `src/app/api/auctions/[id]/bid/route.ts`, `src/app/api/admin/flagged-users/route.ts`, `src/components/PaymentDeadlineCountdown.tsx`, `src/types/auction.ts` (`calculatePaymentDeadline()`, `PAYMENT_REMINDER_WINDOW_HOURS`)

---

## 22. Second Chance Offer System (Session 39)

Seller-initiated re-offer to the runner-up after an auction expires unpaid.

**Flow:**
1. Auction expires unpaid via `expireUnpaidAuctions()` cron pass; if a runner-up exists, the seller gets email + in-app notification with an "Offer to runner-up" CTA.
2. Seller clicks CTA in `SecondChanceOfferButton` → `POST /api/auctions/[id]/second-chance` → creates `second_chance_offers` row with `expires_at = NOW() + 48h`.
3. Runner-up is notified (email + in-app), sees the offer in `SecondChanceInboxCard` with 48h countdown.
4. **Price = runner-up's last actual bid price** (not their `max_bid`).
5. Accept → `POST /api/second-chance-offers/[id]` → flows into standard `/api/checkout` path (same payment deadline enforcement as a won auction).
6. Decline or ignore → `expireSecondChanceOffers()` cron pass cancels at 48h. **No cascade** — the offer simply ends; it does NOT fall to 3rd place.

**Infrastructure:**
- New table `second_chance_offers` with RLS (migration `20260423_second_chance_offers.sql`)
- New routes: `POST /api/auctions/[id]/second-chance`, `GET /api/second-chance-offers`, `POST/PATCH /api/second-chance-offers/[id]`
- New cron pass `expireSecondChanceOffers` added to `/api/cron/process-auctions` pipeline
- 5 new email templates + 7 new notification types
- Components: `src/components/auction/SecondChanceOfferButton.tsx`, `src/components/auction/SecondChanceInboxCard.tsx`

**Key files:** `src/lib/auctionDb.ts`, `src/app/api/auctions/[id]/second-chance/route.ts`, `src/app/api/second-chance-offers/route.ts`, `src/app/api/second-chance-offers/[id]/route.ts`, `src/components/auction/SecondChanceOfferButton.tsx`, `src/components/auction/SecondChanceInboxCard.tsx`

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

All 82 API routes validate input via a shared helper before any business logic runs.

- **Helper:** `src/lib/validation.ts` — `validateBody(request, schema)`, `validateQuery(request, schema)`, `validateParams(params, schema)`, plus reusable field schemas (`schemas.uuid` / `email` / `url` / `trimmedString` / `positiveInt` / `nonNegativeNumber`)
- **Standardized error:** HTTP 400 with `{error: "Validation failed", details: [{field, issue}]}`
- **`.strict()` support** used on `settings/*` routes to reject unknown fields
- **Scope:**
  - Marketplace + money (31 routes): auctions, offers, listings, checkout, billing, connect, trades, transactions, feedback, reputation
  - User + social + admin (32 routes): username, users, sellers, follows, messages, notifications, settings, age-verification, waitlist, email-capture, watchlist, sharing, location, admin/*
  - Content + scan + lookup (19 routes): analyze, barcode-lookup, cert-lookup, comic-lookup, quick-lookup, import-lookup, con-mode-lookup, key-hunt, cover-*, comics, ebay-prices, titles
- **Dependency:** adds `zod` as a runtime dep

**Key files:** `src/lib/validation.ts`, `package.json` (zod), `src/app/api/**/*.ts` (82 routes instrumented)

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

**Key files:** `src/app/sales/page.tsx`, `src/lib/db.ts` (`markComicAsSold`)

---

## 27. Ask the Professor FAQ Modal (Session 40b/c)

Site-wide FAQ modal surfaced from `Navigation.tsx` (desktop) and `AskProfessor.tsx` (mobile).

- **Session 40b content addition:** "What happens after I buy a comic?" entry explains the payment → seller notified → ship → comic added to collection → feedback window flow. Sets expectations for the ship-gated ownership transfer and answers the "why doesn't it show up yet?" question in plain English.
- **Session 40c UX polish:**
  - **Body scroll lock.** `useEffect` in `Navigation.tsx` sets `document.body.style.overflow = "hidden"` while `showProfessor` is true, with cleanup restoring the previous value. Prevents the underlying page from scrolling once the user reaches the end of the FAQ list.
  - **Internal link → close modal.** Delegated click handler on the FAQ list container closes the modal (`setShowProfessor(false)`) when the click target is inside an `<a>`. Works for the existing Seller Onboarding link and any future FAQ links without per-link wiring.

**Key files:** `src/components/Navigation.tsx`, `src/components/AskProfessor.tsx`
