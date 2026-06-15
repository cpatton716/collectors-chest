# Collectors Chest Backlog

## ⭐ Next Session — Main Priority (updated May 9, 2026 post Session 46)

Lead with these when the next session opens.

1. **Variant Detection — Two-Pass High-Res Barcode OCR (Option C3).** ⭐ Highest priority — the variant resolver shipped Session 46 only fires when the AI extracts the full 17-digit barcode (12-digit UPC + 5-digit add-on supplement). In production testing, the AI consistently captures only the 12-digit main UPC and misses the small 5-digit addon, so the resolver never runs and variant stays null. User can't work around this by zooming in on the barcode — that breaks cover identification (the AI returns a totally different book). Needs a server-side second-pass OCR using the original full-resolution image. See "Variant Detection — Two-Pass High-Res Barcode OCR" entry below for full design + acceptance criteria.
2. **PriceCharting subscription decision** — `docs/PRICECHARTING_PROPOSAL.md` shipped Session 45b. Awaiting Aponte yes/no on $499/yr Legendary subscription before integration kicks off. See "PriceCharting Integration" entry below (status: Blocked on stakeholder).
3. **Validate Notifications Inbox remaining manual TEST_CASES.** Defer the Capacitor-specific ones (push-tap deep-link, iOS safe-area) until iOS native ships. The 27 cases added Apr 27 were walked through in Session 45 — confirm any still-open ones land in the next testing pass.

After those: pick from the standing pre-launch list below (FMV graceful fallback, `account.updated` webhook validation, iOS native, Apple Developer enrollment).

---

## Pre-Launch — Critical / High Priority

### Apply 2026-06-14 Closeout Migration + Residual Owner Steps
**Priority:** High (Pre-Launch — top-tier; the closeout build is committed locally but unreleased until these owner steps are done)
**Status:** Pending
**Added:** Jun 14, 2026

The audit close-out build implemented all owner-dependent items except the 6 large refactors (5 closeout commits, committed locally, unreleased). What remains is an owner residual checklist — full detail in **CLOSEOUT_RESIDUAL_2026-06-14.md**. Summary of required steps:
- **Apply the migration** `supabase/migrations/20260614_audit_closeout.sql` (13 required + 2 optional blocks) via Supabase SQL Editor. Until applied, the new code ships SAFE FALLBACKS (degrades gracefully, no crashes).
- **Verify 5 schema assumptions before running:** (1) money units — `sales.platform_fee`/`seller_net` are DECIMAL dollars, switch to BIGINT if the webhook writes cents; (2) winning-bid unique index — run the de-dupe query first if any auction has >1 `is_winning=true`; (3) `complete_trade()` owner/participant + Clerk-id-join assumptions vs tradingDb.ts; (4) `review_barcode()` `p_admin_id` = `profiles.id`; (5) `sum_seller_platform_fees()` seller = `sales.user_id`. After applying, set `profiles.promo_trial_eligible=true` for accounts that should get the 30-day QR promo trial (gate fails closed).
- **Env vars** (all optional — fall back to `CLERK_SECRET_KEY`): `GUEST_SCAN_SECRET`, `PROMO_TRIAL_SECRET`, `UNSUBSCRIBE_SECRET`, plus `SUPPORT_EMAIL` (placeholder in email.ts — required for real unsubscribe mailto/footer) and `TEST_EMAIL_RECIPIENT`.
- **Dashboard verifies:** complete the Netlify env-var list (CLAUDE.md was missing ~10 vars the code reads — EBAY_*, STRIPE_PRICE_*, CRON_SECRET, ADMIN_EMAIL, RESEND_*_AUDIENCE_ID, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_POSTHOG_HOST, NEXT_PUBLIC_SUPABASE_ANON_KEY); subscribe `account.updated` on prod Stripe webhook + Connect test (M-MK14); confirm `comic-covers` bucket cleanup; confirm zero traffic on deprecated `/api/listings/[id]/purchase`; rating-count integrity spot-check; ZenRows on/off decision; pin Node version (.nvmrc/engines.node).
- **Owner-supplied content:** real `/about` copy (origin story, team bios, contact/social — still placeholder); support/unsubscribe inbox address (SUPPORT_EMAIL).
- **Device/smoke tests:** see TEST_CASES.md → "Closeout Test Plan — 2026-06-14" (Clerk auth after SDK bump, live AI scan after Anthropic SDK bump, next/image iOS Safari grid, MobileNav restyle, pinch-zoom, guest-scan cap, destination-charge sale, bulk Mark-as-Sold + unpriced disclaimers).

---

### Execute Audit Remediation + Closeout Test Suite (2026-06-14)
**Priority:** High (Pre-Launch — highest priority; the 2026-06-14 audit fixes AND closeout changes are unreleased until verified)
**Status:** Pending
**Added:** Jun 14, 2026

Manual/device verification of the ~211 autonomous audit fixes shipped 2026-06-14 (commits 04c19f6, e1e6dfe, 43fa943) **plus the audit close-out changes (5 closeout commits)**. TEST_CASES.md now holds **both** an "Audit Remediation Test Plan — 2026-06-14" and a "Closeout Test Plan — 2026-06-14" (per-test device targets: Web / Mobile iOS→Android / Both). Highest regression risk: money paths (Stripe webhook idempotency, atomic Buy-It-Now, offer auto-reject, Connect IDOR, destination-charge sale), security (rate-limited public endpoints, profanity-username fix, guest-scan cap), cover WebP upload, a11y, PWA/service-worker, and the closeout SDK bumps (Clerk auth, Anthropic scan) + pop-art MobileNav / pinch-zoom / iOS-Safari grid changes. Until verified, these changes are unreleased. Note: the closeout test pass is gated on applying the migration first — see "Apply 2026-06-14 Closeout Migration + Residual Owner Steps".

---

### Variant Detection — Two-Pass High-Res Barcode OCR (Option C3)
**Priority:** High (Pre-Launch — variant resolver shipped Session 46 is non-functional in production until this lands)
**Status:** Pending — root cause confirmed in Session 46 production testing; design agreed (Option C3); implementation pending
**Added:** May 9, 2026

**Background (Session 46):** The 3-tier variant resolver (`src/lib/variantResolver.ts`) was shipped May 9, 2026. The pipeline is wired correctly end-to-end: AI extracts barcode → `parseBarcode` decomposes the 17-digit string into `(upcPrefix, itemNumber, checkDigit, addonIssue, addonVariant)` → `resolveVariant` runs Tier 1 (catalog lookup) → Tier 2 (focused AI enrichment) → Tier 3 (deterministic "Cover G" derivation from `addonVariant[0]`). Verified correct against 18 unit tests.

**The breaking gap (production testing, May 9):** The resolver requires `parsedBarcode.addonVariant` to be present (guard clause at `analyze/route.ts:734`). In real scans, the AI consistently extracts only the 12-digit main UPC (e.g., `761941348926`) and misses the 5-digit addon supplement (e.g., `00171`). With no `addonVariant`, the resolver never fires. The variant field stays empty even on books where the addon was clearly visible in the photo (verified: user's Dark Knights Metal #1 photo had `00171` legibly printed but the AI returned only the 12-digit UPC).

**Why "ask the user to zoom in on the barcode" doesn't work:** Tested in Session 46. When the user takes a barcode-focused photo (filling more of the frame with the bottom-left barcode area), the AI loses the cover context and identifies a *totally different book* — because the cover artwork is now cropped out. The user cannot be asked to choose between "good cover identification" (full-cover photo) and "good variant detection" (barcode close-up). Both must work from a single normal scan.

**Why this is a launch-class issue:** The variant feature is the headline of Session 46, and is broken end-to-end in production. Users with multi-variant collections (the most engaged collectors — exactly our target user) will see all variants of an issue stored as identical-looking rows. Worse: they'll re-scan thinking the AI failed, get the same null result, and lose trust in scan recognition.

**Recommended approach: Server-side two-pass barcode OCR (Option C3).**

Architecture:
1. **First pass (unchanged):** AI receives the user-compressed 1200px image and extracts cover details + barcode. Returns a 12-digit UPC most of the time.
2. **Trigger condition:** if the first-pass `barcode.raw` exists but `parseBarcode(raw).addonVariant` is null/undefined (i.e., the AI got 12 digits, not 17), OR if no barcode was detected at all on a book that should have one.
3. **Second pass:** crop the original full-resolution image to the bottom-left quadrant (~25% width × ~15% height for raw books — the typical barcode position; needs adjustment for slabbed books where the barcode is offset by the slab geometry). Send the crop to a fresh AI call with a focused barcode-only prompt: "Extract ALL digits from this UPC barcode including the small 5-digit add-on supplement to the right. Format: full digit string, no spaces."
4. **Splice result back:** if the second-pass barcode is longer than the first-pass barcode AND it parses as a valid 17-digit UPC, replace `comicDetails.barcode.raw` with the new value and re-run `parseBarcode` and `resolveVariant`. Log the upgrade as `[scan] Barcode upgraded: 12->17 digits via second-pass OCR`.

**Critical implementation requirement:** the original full-resolution image MUST be retained server-side for the duration of the analyze call — currently the `/api/analyze` endpoint receives the already-compressed 1200px image from `ImageUpload.tsx` and never sees the full-res original. Options:
- **A. Client-side: send both versions.** `ImageUpload.tsx` sends compressed for first pass + original (or 2400px) for second pass. Doubles upload size; significant on mobile data.
- **B. Server-side: fetch from comic-covers bucket.** After Bug 2 (Session 46), signed-in users' photos are uploaded to `comic-covers` via `/api/comics/upload-cover`. We could upload first, then point AI at the hosted full-res URL for the second pass. Keeps payload single-image but requires reordering the flow (upload-then-scan instead of scan-then-upload).
- **C. Client-side: don't compress before scan.** Send raw camera image to `/api/analyze`. Simplest but biggest payload.
- **D. Client-side barcode pre-extraction with a JS library** (quagga.js, zxing-js) at full camera resolution before any AI call. Lossless, instant, free. Adds a runtime dep (~50KB gzipped for zxing-js). Could be the BEST architecture if accuracy is good — extracts the full 17-digit UPC client-side, sends it as a structured field alongside the compressed image. Then AI never has to OCR digits at all. Worth a focused 30-min spike before committing to (B).

**Recommendation:** spike (D) first — if a client-side barcode library reliably extracts UPC supplements from camera photos, we get lossless extraction with zero AI cost and zero added latency. If accuracy is poor on real scans, fall back to (B) — upload-first-then-scan via the new `comic-covers` bucket. Avoid (A) and (C) — both double client upload bandwidth on mobile.

**Cost impact:** with (D) — zero per scan. With (B) — adds one Haiku call (~$0.0008) only when first pass missed the addon. With (A) or (C) — ~3-4x current scan cost due to larger uncompressed payload tokenization.

**Acceptance criteria:**
- [ ] Re-scanning the user's Dark Knights Metal #1 photo (the failing test case from Session 46) at normal full-cover distance returns a non-null variant and shows the `🔍 Detected from barcode...` hint
- [ ] Books where the barcode is genuinely cropped out of the photo do NOT trigger the second pass (cost guard — only fires when first pass returned a 12-digit barcode)
- [ ] No regression on cover identification accuracy or scan latency for books where first pass already got 17 digits
- [ ] Both raw and slabbed comics are handled (slab cases offset the barcode position; crop coordinates need to account for cert label geometry)
- [ ] Telemetry: log `[scan] Barcode upgraded: N->M digits` when second pass succeeds; log `[scan] Barcode second-pass failed` when it doesn't

**Complementary low-cost addition (~30 min, do in same session):** show the extracted barcode on the review screen as a small text line (e.g., "Detected barcode: `76194134892600171`"), with a "Looks wrong?" link that opens a manual edit. When the AI fails on both passes, the user can paste/type the correct barcode and the resolver re-runs. This is the final-final fallback when OCR genuinely can't read the digits — and it gives users a way to fix variant-resolution failures without re-scanning. Same change exposes the barcode for transparency, which builds trust in the recognition pipeline.

**Files expected:**
- `src/lib/barcodeOcrSecondPass.ts` (new) — focused OCR helper, takes image bytes + crop coordinates, returns digit string
- `src/lib/clientBarcodeScanner.ts` (new, if pursuing D) — wraps zxing-js or equivalent
- `src/app/api/analyze/route.ts` — add the second-pass trigger after first-pass barcode parse, before the resolver call (around line 740)
- `src/components/ImageUpload.tsx` — if pursuing D, integrate client-side barcode extraction + send as structured field
- `src/components/ComicDetailsForm.tsx` — add the "Detected barcode" text + manual-edit affordance (complementary addition)
- `src/lib/__tests__/barcodeOcrSecondPass.test.ts` — unit tests (mocked AI provider)

**Effort estimate:**
- Spike (D) client-side barcode lib accuracy: 30-45 min
- If (D) works: implementation ~1-2 hours including the manual-edit affordance
- If (D) fails: (B) implementation ~3-4 hours including upload-flow reordering, full-res storage handling, and the manual-edit affordance

**Related:**
- Variant resolver (Session 46) — depends on this fix to actually produce variant names
- Cover-image preservation rule (Session 45b) — requires that the original photo isn't mutated before second-pass OCR
- BACKLOG: "Admin UI for Community Variant-Name Approval Queue" — once this lands and variants resolve correctly, the admin queue will start accumulating real entries to review

---

### PriceCharting Integration — Sold-Listing Pricing as Primary Source
**Priority:** High (Pre-Launch — closes the active-vs-sold pricing gap before beta users see prices)
**Status:** **Blocked on stakeholder** — `docs/PRICECHARTING_PROPOSAL.md` shipped Session 45b (May 6, 2026). Awaiting Aponte yes/no on $499/yr Legendary subscription before implementation. Vendor verified May 6 via Patton's account walkthrough.
**Added:** May 6, 2026
**Updated:** May 6, 2026 (Session 45b — proposal doc shipped, awaiting subscription decision)

**Why this matters:** Today our pricing layer aggregates eBay Browse *active listings* (asking prices) and applies a Q1 multiplier to approximate sold prices. PriceCharting gives us *sold-listing-derived* pricing across the full CGC grade range — same data class as CovrPrice + GoCollect, available NOW, no partner gating. This is the gap users notice when comparing our prices to actual market values.

**What we get with the Legendary Sub:**
- API: 1 call/sec, token auth (`?t=<token>`)
- CSV: full catalog daily, 1 download per 10 minutes
- Comic grade fields: Ungraded, 4.0/4.5, 6.0/6.5, 8.0/8.5, 9.2, **9.4**, 9.8, 10.0
- `sales-volume` (yearly units sold), `release-date`, `upc`, `epid` (eBay cross-reference)
- Multi-publisher (Marvel, DC, Image, Indie)

**Architecture (recommended):**

1. **Daily CSV cron** — download full catalog at a fixed UTC time, populate our `comic_metadata.price_data` cache with PriceCharting fields. Replaces eBay-Browse-as-primary-source for cached scans. UI shows "Updated today" timestamp for transparency.
2. **Per-scan API for cache misses** — single `/api/product` call (1/sec rate limit, plenty of headroom at any realistic scan volume). Cache the result for next time.
3. **Keep eBay Browse as a secondary signal** — the active-listing data is still useful as "currently for sale at X" when users want to know recency, separate from FMV.

**This integration solves three open BACKLOG entries simultaneously:**
- ✅ "FMV Lookup — Graceful Fallback for Rare / Key Issues at Exact Grade" (sold-derived data doesn't suffer from thin-listing-count problems)
- ✅ "Durable eBay Price Cache in Supabase" (replaced by PriceCharting cache — same cache concept, materially better data source)
- ✅ "Sales Trend Graphs" prerequisite (yearly `sales-volume` + daily snapshots = time series for free)

**Open verification questions (low-priority, post-subscription):**
1. Cover image URLs in CSV?
2. Golden Age / vintage coverage depth (test: Action Comics #1, Amazing Fantasy #15)?
3. Daily CSV refresh time-of-day (affects when we schedule our cron)?

**Cost calibration:**
- $499/yr = $41.58/mo equivalent
- ~70% cheaper than CovrPrice consumer add-on ($107.40/yr) which CLZ users pay
- Materially cheaper than every other "real partner" option (Ximilar Business 100K $64/mo for recognition-only; CovrPrice 2027 API at unknown B2B pricing; GoCollect closed)
- vs. our current $0.015/scan AI cost: $499/yr breaks even at ~33,000 scans/yr ≈ 90/day. Well below Beta projections.

**Effort estimate:** 2-3 days. New `src/lib/pricecharting.ts` (API client + CSV parser), daily cron in `process-auctions/route.ts`, schema migration for new price-source provenance field, scan pipeline cache-then-API fallback, env var `PRICECHARTING_API_TOKEN` (add to `.env.local` + Netlify before deploy).

**Related:**
- `docs/DATA_PARTNERS.md` — full vendor analysis
- BACKLOG entries this would close: FMV Lookup graceful fallback, Durable eBay Price Cache, Sales Trend Graphs (partial)

---

### Native App Splash Screen — iOS + Android Capacitor Wiring
**Priority:** High (Pre-Launch — first impression on native app launch)
**Status:** Pending — flagged May 6, 2026; assets ready, Capacitor wiring deferred until native shells land
**Added:** May 6, 2026

**What's done (Session 45 — May 6, 2026):**
- Source asset captured at `Splash Screen (figma).png` (585x781 portrait — pop-blue `#0066FF` background with centered Collectors-Chest logo).
- Generator script `scripts/generate-splash-assets.ts` produces 14 derived assets via Sharp: 192/512 app icons (any + maskable), 180px Apple touch icon, and 5 iPhone-sized `apple-touch-startup-image` bitmaps (1284x2778 / 1170x2532 / 1125x2436 / 828x1792 / 750x1334).
- PWA manifest updated: `background_color` set to `#0066FF` so Android Chrome's auto-generated install splash matches the brand. `theme_color` stays yellow (`#FFF200`) for the in-app status bar.
- iOS PWA: `apple-touch-startup-image` link tags wired in `src/app/layout.tsx` for the 5 most common iPhone form factors. iOS users who Add-to-Home-Screen now see the brand splash instead of a blank white screen.

**What's still needed (this entry — gated on native app initiatives):**
- **iOS native (Capacitor):** install `@capacitor/splash-screen` plugin, configure via `capacitor.config.ts` (showSpec, fadeOutDuration, backgroundColor `#0066FF`), generate the iOS-required asset set via `npx capacitor-assets generate --ios` from a 1024x1024 source (will need a higher-res logo OR re-export from Figma at larger scale — current 585x781 is upscale-only).
- **Android native (Capacitor):** same plugin handles both. Generate density buckets (mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi) via `npx capacitor-assets generate --android`. Configure same backgroundColor + fade.
- **Real-device test before submission:** TestFlight (iOS) and internal testing track (Google Play) verification.

**Source asset path:** `Splash Screen (figma).png` (project root).
**Recommendation:** Re-export the Figma at 2048x2048 or 4096x4096 before kicking off native splash work — the current 585x781 source is too small to upscale cleanly to iPad Pro 12.9" splash sizes (2732x2732 base) without softness.

**Effort once native shells exist:** ~2-4 hours including asset re-export, Capacitor plugin install + config, and device testing.

**Blocked on:** iOS Native App + Android Native App (both BACKLOG entries below) — splash wiring happens during native shell setup, not standalone.

**Related:** iOS Native App; Android Native App; PWA splash already shipped (this session).

---

### Shipping Tracking for Sold Items (payment gated on validated tracking)
**Priority:** High (Pre-Launch Blocker — required for Full Launch, NOT Beta)
**Status:** Pending — Option A shipped Apr 22, 2026; Option B (this item) is the full carrier-validated flow
**Added:** Apr 21, 2026
**Updated:** Apr 22, 2026

**Option A shipped (Apr 22, 2026):** Seller self-reports tracking via "Mark as Shipped" form. Ownership transfer now gates on shipment (not payment). Tracking number + carrier are optional, not validated. This is ENOUGH for Beta where testers are trusted, but NOT for Full Launch where real users can ghost on shipping.

**Option B (this item) — required for Full Launch:** Carrier-validated tracking, funds held until validation, auto-refund on 7-day ghost.

After a marketplace sale completes, the seller has no way to record shipping tracking information and the buyer has no way to see shipment status. User: "We need to add a way for the seller to add tracking information to the sale and then alert the buyer when tracking information has been added."

**Critical requirement (confirmed Apr 21, 2026):** Payment to the seller must NOT be released until tracking has been provided AND validated as a real tracking number with a carrier. This is non-negotiable for buyer protection.

**Implementation architecture:**

1. **Capture funds, delay transfer (Stripe Connect "separate charges and transfers" pattern):**
   - Change `/api/checkout/route.ts` from single-step destination charge to two-step: capture into platform account, delay the transfer
   - At checkout completion, `payment_status = "held"` (new status); funds sit in platform account
   - Transfer to seller's Connect account only fires after tracking is validated

2. **Tracking validation via carrier API** — cannot trust self-reported tracking numbers:
   - Integrate with a multi-carrier validation service: **EasyPost** (recommended — supports USPS, UPS, FedEx, DHL, Canada Post in one API) OR individual carrier APIs
   - On seller "Add tracking" submit, hit the validation API to confirm the tracking number is: (a) syntactically valid for the claimed carrier, (b) exists in the carrier's system, (c) associated with a label purchased recently (within last ~14 days of sale)
   - If validation fails, reject the submission with clear error; seller must provide real tracking
   - Store validation timestamp + carrier response for audit

3. **Auto-release payment on validated tracking:**
   - After validation succeeds, trigger `stripe.transfers.create({ destination: sellerConnectAcct, amount: sellerAmount })` for the held funds
   - Update `payment_status = "paid"`, `shipped_at = now`, send buyer `shipment_created` notification with tracking link

4. **Schema additions:**
   - `auctions`: `tracking_carrier`, `tracking_number`, `tracking_url`, `tracking_validated_at`, `shipped_at`, `delivered_at`
   - New `payment_status` enum value: `"held"` (post-checkout, pre-tracking) between `"pending"` (claimed, awaiting buyer payment) and `"paid"` (funds released to seller)
   - Consider separate `shipments` table if we want 1:many (multi-shipment sales, future)

5. **Seller UX:**
   - After checkout completes, seller sees "Payment held — add tracking to receive funds" banner on the sold listing
   - "Add tracking" form collects carrier + tracking number. On submit: validation call → success or actionable error
   - Validation errors show inline, no payout released until resolved
   - Set a deadline: e.g., 7 days from sale to add valid tracking, or order auto-refunds to buyer (protects buyer if seller ghosts)

6. **Buyer UX:**
   - Pre-tracking: Transactions page shows "Payment held — awaiting shipment" state
   - Post-tracking: "View tracking" button + carrier/number surfaced + `shipment_created` notification with link
   - Future: `shipment_delivered` notification via EasyPost's tracking-update webhook (polls carriers for delivery confirmation — don't build yet, Phase 2)

7. **Refund path if seller fails to ship:**
   - Auto-refund policy at 7 days (or configurable) with no valid tracking
   - Refunds go back to buyer's card; no transfer to seller happens
   - Notifications to both parties + logging for dispute support

**Files expected:**
- Schema migration for tracking + held payment status
- `src/lib/auctionDb.ts` or new `src/lib/shipmentsDb.ts` for tracking CRUD
- `src/lib/tracking/easypost.ts` (or equivalent) — carrier validation wrapper
- `src/app/api/shipments/route.ts` POST to create tracking record, validate via carrier, trigger transfer, notify buyer
- `src/app/api/shipments/auto-refund/cron.ts` — scheduled job to auto-refund stale unshipped orders
- `src/components/auction/AddTrackingButton.tsx` (seller-facing, with validation error handling)
- `src/components/TransactionTrackingLink.tsx` (buyer-facing)
- Notification types: `shipment_created`, `shipment_delivered`, `payment_auto_refunded`, `shipping_deadline_approaching`
- Email templates for all four

**Risk to flag:** EasyPost and similar services charge per-request. If we do 10K sales/month and validate each, that's ~10K API calls = maybe $30-50/mo. Budget accordingly.

---

### Validate `account.updated` Webhook Handler in Production
**Priority:** Medium (Pre-Launch)
**Status:** Pending
**Added:** Apr 21, 2026

During Session 36 Stripe Connect testing, the `account.updated` webhook handler at `src/app/api/webhooks/stripe/route.ts:113-123` was NOT exercised because `stripe listen` was running with default settings (`--forward-to` only), which filters out events on connected accounts. The initial onboarding DB state is populated synchronously via `src/app/api/connect/onboarding-return/route.ts:22-28`, so the webhook is a backup mechanism that wasn't validated.

**Why it matters:** If a seller updates their bank info or business details later via the Express Dashboard, the `account.updated` webhook is how our DB stays in sync. If the handler is broken, stale seller data could cause payouts to route incorrectly.

**Validation options:**
- **In test mode:** restart `stripe listen` with `--forward-connect-to localhost:3000/api/webhooks/stripe` AND `--forward-to localhost:3000/api/webhooks/stripe`. Then trigger an account update (e.g., log into the seller's Express Dashboard and change a field). Confirm `account.updated` event fires and our DB reflects the change.
- **In production:** after enabling Connect in live mode, confirm `account.updated` is in the list of events subscribed to the production webhook endpoint. Trigger a test change on a seller account and verify DB update.

**Files:** `src/app/api/webhooks/stripe/route.ts:113-123`

---

### Sign in with Apple + Apple Developer Program Enrollment
**Priority:** Medium (Pre-Launch — not a strict blocker; unblocks iOS downstream)
**Status:** Pending — prerequisite for iOS Native App
**Added:** Apr 6, 2026
**Updated:** Apr 22, 2026

Apple Developer Program enrollment ($99/yr) unlocks two capabilities: **Sign in with Apple** (web-ready, no native app needed) and native iOS distribution (tracked as a separate item). This entry covers the prerequisite enrollment + the web-only Apple Sign-In integration.

**Steps:**
1. Enroll in Apple Developer Program ($99/yr) — identity verification can take days to weeks
2. Create App ID + Services ID for Sign in with Apple
3. Configure domain + return URLs in the Apple portal
4. Replace Clerk's shared Apple OAuth credentials with our own
5. Test sign-up + sign-in flows across iOS Safari + desktop browsers

**Why Pre-Launch but not strict blocker:** Clerk's shared Apple OAuth works today for dev/testing. Replacing with our own before Full Launch is best practice (removes dependency on shared credentials that could change upstream), and Developer Program enrollment is the prerequisite for iOS anyway.

**Effort:** 1-2 days of engineering once Developer Program is approved; enrollment itself may take 1-3 weeks for identity verification.

**Related:** iOS Native App (Apple App Store) — hard-blocked on this item.

---

### iOS Native App (Apple App Store)
**Priority:** High (Pre-Launch Blocker — required for Full Launch, NOT Beta)
**Status:** Pending — brainstorming / design in progress
**Added:** Apr 6, 2026
**Updated:** Apr 22, 2026

**User direction (Apr 22, 2026):** Full Public Launch WILL ship with an iOS native app. This is a Full Launch Blocker — Beta can proceed without it.

Native iOS app via Capacitor wrapping our existing Next.js/PWA codebase. Distributed via Apple App Store. Removes the browser URL bar (prior feedback item #16), unlocks App Store discoverability, enables iOS push notifications (PWA on iOS has weak push support).

**Break-even math:** Native iOS only needs to grow the user base ~4% via App Store discovery to offset Apple's 15% Small Business Program cut (see `docs/native-app-iap-analysis.xlsx`). IAP strategy leaning toward Option A (Apple IAP on iOS + Stripe on Web).

**Steps:**
1. Finalize IAP strategy (Option A vs B vs product-split — partner meeting discussion)
2. Choose wrapper approach (Capacitor recommended — reuses Next.js/PWA codebase)
3. Create iOS App ID + App Store Connect listing (icons, screenshots, privacy policy, age rating)
4. Implement StoreKit receipt validation + entitlement sync with Stripe subscriptions
5. Beta test via TestFlight
6. App Store submission + review (typical 1-7 days, sometimes longer)

**Blocked on:**
- Sign in with Apple + Apple Developer Program Enrollment (separate BACKLOG item)
- IAP strategy decision (partner meeting)

**Timeline note:** Apple App Store review can take 1-7 days; factor into Full Launch scheduling.

**Native-shell UX constraints (must address during native build):**
- **Disable pull-to-refresh on `/notifications`** in the Capacitor wrapper. Browser/PWA accepts both PTR + tap-pill, but native iOS gesture conventions (swipe-back, edge swipes, navigation gestures) conflict with PTR. Only the "tap to refresh" pill should trigger refresh in native shell. (Established as a constraint May 6, 2026 during inbox testing walkthrough.)
- Similar constraint applies to the Android native build — see Android Native App entry.

**Related:** Sign in with Apple (prerequisite); Android Native App (Pending Enhancements — parallel codebase but Post-Launch); Native App Cover Image Search (low-priority polish for once app ships).

---

## Pending Enhancements

### Audit Partial/No items — implemented this session; residual = owner checklist
**Priority:** High (Pre-Launch — the implementation is committed locally; only the owner residual steps remain)
**Status:** Mostly done — code implemented Jun 14, 2026; residual is the owner checklist
**Added:** Jun 14, 2026
**Updated:** Jun 14, 2026 (closeout build)

The 2026-06-14 audit surfaced 64 'Partial' + 4 'No' findings requiring an owner step (DB migrations for atomic-bid unique index / FOR UPDATE RPC, schema NOT-NULL/RLS changes, env vars, Stripe dashboard config, product/copy decisions; full detail in AUDIT_2026-06-14.md → Findings by Priority). **The audit close-out build (5 commits, committed locally, unreleased) implemented all of these owner-dependent items in code except the 6 large refactors** (tracked separately under "Complete 6 deferred audit refactors"). The migration changes are written into `supabase/migrations/20260614_audit_closeout.sql` and the code ships SAFE FALLBACKS until it's applied.

**What remains is the residual owner checklist** — apply the migration (+ 5 schema-assumption checks), set the optional env-var secrets, complete the dashboard verifies (Netlify env vars, Stripe `account.updated`, bucket/route/rating-count checks, ZenRows + Node decisions), and supply the `/about` copy + support-inbox address. All steps are itemized in **CLOSEOUT_RESIDUAL_2026-06-14.md** and rolled up under "Apply 2026-06-14 Closeout Migration + Residual Owner Steps" above.

---

### Cover Edit Modal — Add "Take Photo / Upload" Button
**Priority:** Medium (Post-Launch — natural pair with Bug 2 fix from Session 46)
**Status:** Pending
**Added:** May 9, 2026

**Background:** Session 46 fixed scan covers persisting via the new `comic-covers` Supabase Storage bucket + `uploadCoverImage` helper. But the manual cover edit flow in `ComicDetailsForm.tsx` (the "Edit Comic Details" modal on a collection card) is still **paste-URL only** — there's no way to upload a fresh photo from the device. So the only way to fix a missing or wrong cover today is:
1. Re-scan the comic from scratch (loses notes, edits, list assignments — destructive)
2. Find a hosted cover image online and paste the URL (clunky on mobile, often gives a generic Cover A from Google Images, not the user's actual book)

**The fix:** add a "Take Photo / Upload" button to the cover edit section that calls the existing `uploadCoverImage(dataUri)` helper from Session 46, gets back a hosted URL, and writes that into `coverImageUrl`. Effort estimate ~30 minutes including a small UI tweak.

**Why this matters now:** Users who scanned books before May 9 (the Session 46 deploy) all have null `cover_image_url` for their saved books. Per Session 46 conversation, the user opted to delete-and-rescan affected books rather than build this immediately — but for new users who hit OTHER cover-loss scenarios (e.g., URL paste returns 404 later, edit-cover-by-mistake), there's no graceful recovery. This button gives them one.

**Files expected:**
- `src/components/ComicDetailsForm.tsx` — add a small file picker / take-photo button next to the existing URL paste input. Reuses the existing `ImageUpload` patterns or a slimmed-down version.
- Optional: extract a `<CoverPicker>` component shared by scan/page.tsx + ComicDetailsForm.tsx for consistency.

**Related:** Cover Persistence Pipeline (Session 46) — depends on the same upload endpoint.

---

### Admin UI for Community Variant-Name Approval Queue
**Priority:** Medium (Post-Launch — gates the variant resolver's catalog growth)
**Status:** Pending — schema + write path live; review surface needed
**Added:** May 9, 2026

**Background (Session 46):** The 3-tier variant resolver (`src/lib/variantResolver.ts`) was shipped May 9, 2026 to fix front-cover scans of variant comics being saved with `variant=null` (e.g., Dark Knights Metal #1 variants all looked identical in collection). The resolver's Tier 1 looks up `(upc_prefix, addon_issue, addon_variant)` in `barcode_catalog` for an admin-approved variant name. Tier 2 falls back to a focused AI enrichment call (~$0.0008/scan with Haiku). Tier 3 derives a generic "Cover B" from the addon digits.

Per product requirement, **user-typed variant names land in `barcode_catalog.variant_name` with `variant_name_status='pending'`** and never surface in Tier 1 lookups until an admin approves them. This protects the community catalog from typos/junk entries.

**The gap:** there's no admin UI yet to walk through the pending queue. Until one exists, the Tier 1 catalog stays empty and every barcode-confirmed variant scan pays for a Tier 2 AI call (~$0.0008 each). Acceptable at small scale, but the catalog should compound — one approval per variant means every future scan of that book is free.

**What's needed:**
- Admin page (likely under `/admin/variants` or extend the existing `/admin` dashboard) listing rows from `barcode_catalog` where `variant_name_status='pending' AND variant_name IS NOT NULL`, ordered by `created_at DESC`
- Per-row actions: **Approve** (sets `variant_name_status='approved'`, reviewed_by, reviewed_at), **Reject** (sets to `'rejected'` with optional reason), **Edit + Approve** (lets admin clean up "capullo cover" → "Greg Capullo Variant Cover" before approving)
- Show context: linked comic title/issue/year, full UPC, addon variant code, source (`user`/`ai`/`derived`), submission count for the same `(upc_prefix, addon_issue, addon_variant)` (helps admin batch-approve common variants)
- Bulk approve when multiple submissions agree on the same variant_name string
- API endpoint: `PATCH /api/admin/variant-names/:id` with admin-auth gate
- Unit tests for the approval logic + RLS check

**Index already exists:** `idx_barcode_catalog_variant_pending` (created in `20260509_variant_name_catalog_guard.sql`) keeps the queue fast.

**Effort estimate:** ~3-4 hours. Admin auth plumbing already exists (`src/lib/adminAuth.ts`); follow the patterns in `admin_barcode_reviews` workflow.

**Why not blocking launch:** The resolver still works without the admin UI — it just stays in AI-paid mode. Admin can approve via SQL Editor in the meantime if they want to seed Tier 1 manually (`UPDATE barcode_catalog SET variant_name_status='approved' WHERE id = '...'`).

---

### Route FAB Scan Through In-App Camera (Android Low-Memory Crash Fix)
**Priority:** Medium (Post-Launch)
**Status:** Pending — surfaced in Session 46 DEV_LOG
**Added:** May 27, 2026

**Background (Session 46):** The floating-action-button (FAB) scan path launches the **system camera** to capture a cover photo. On Android, handing off to the system camera app pushes our PWA to the background, and Android's low-memory killer can reap the backgrounded PWA process while the camera is open — when the user returns from the camera, the app reloads/crashes with an effective "low memory" failure and the in-progress scan is lost.

**Documented fix:** Route the FAB scan through the in-app `LiveCameraCapture` component (currently dead-code-pathed) instead of the system camera. Capturing in-app keeps the PWA in the foreground, so the OS doesn't reap it, and the scan flow stays continuous.

**What's needed:**
- Wire the FAB scan trigger to `LiveCameraCapture` rather than the system camera intent / file-input capture.
- Re-activate / un-dead-code the `LiveCameraCapture` path; confirm it still works post-changes.
- Verify on a real Android device that the previously-crashing flow now completes without the low-memory reap.
- Confirm iOS behavior is unaffected (or benefits) by the same in-app capture path.

**Related:** Session 46 mobile collection-UI fixes; Batch Scanning (also benefits from a persistent in-app camera).

---

### Fix CGC Cert Lookup Cloudflare 403 Errors
**Priority:** Medium (Post-Launch)
**Status:** Deferred post-launch pending ZenRows ROI decision
**Added:** Apr 5, 2026
**Updated:** Apr 23, 2026

CGC website (`cgccomics.com/certlookup/`) is blocking cert lookups with Cloudflare bot protection (HTTP 403). The current User-Agent (`"CollectorsChest/1.0"`) is detected as a bot. All cert lookups fail, forcing fallback to the full AI pipeline.

**Root cause:** Cloudflare managed challenge blocks non-browser requests. Even full browser headers via curl return 403 — JS execution is required.

**Validated solution:** ZenRows API with `mode=auto&wait=5000` successfully bypasses Cloudflare and returns full cert data (tested Apr 7, 2026 — cert #3986843008 returned complete HTML with grade, title, publisher, etc.).

**Services tested:**
- ❌ ScraperAPI (standard, premium) — failed against CGC
- ❌ ZenRows (`js_render=true&antibot=true`) — timed out
- ✅ ZenRows (`mode=auto&wait=5000`) — **works**, returns full cert page HTML

**Cost:** 25 credits per request. Free trial: 1,000 credits (14 days). Paid plans start at $49/mo for 250K credits (~10,000 cert lookups). With 1-year Redis cache, ongoing costs should be low.

**Blocked on:**

> **Repriced Apr 23, 2026:** ZenRows pricing bumped $49 → $69/month. Pure break-even on AI-scan savings now requires ~4,600 CGC slab scans/month, unlikely to hit in private beta. Fallback to AI pipeline is confirmed working (users aren't blocked — just slower + ~$0.015 per-scan cost). Decision: defer subscription post-launch; revisit after 2-4 weeks of real scan volume data. If post-launch data shows sustained CGC slab volume that justifies the spend, subscribe and wire the integration (spec below is still accurate, just swap `fetch()` for ZenRows API call in `src/lib/certLookup.ts`).

Partner cost review of ZenRows subscription before implementation.

**Implementation:** Replace `fetch()` in `src/lib/certLookup.ts` `lookupCGCCert()` with ZenRows API call. Env var `ZENROWS_API_KEY` already added to `.env.local`. Needs to be added to Netlify when ready.

**Impact:** Cert-first pipeline falls back to full AI on every slabbed scan, negating cost savings. Also affects existing cert lookup feature for all users.

---

### Pre-populate Top Comics Cache (ZenRows Scrape — Marvel + DC)
**Priority:** Medium (Post-Launch — gated on ZenRows subscription)
**Status:** Pending — defer until Beta → Full Launch transition
**Added:** Apr 22, 2026
**Updated:** Apr 23, 2026

**[CP - 4/23] - Blocked by "Fix CGC Cert Lookup Cloudflare 403 Errors" / ZenRows post-launch decision. One-time scrape burst; defer until ZenRows subscription is active.**

Our AI cover scan pipeline costs ~$0.015/scan. Most scans target popular issues from major publishers. Pre-seeding the `comic_metadata` + `cover_images` tables with the top Marvel + DC catalogs *before* Full Launch skips AI calls for those scans entirely — significant cost reduction at scale.

**User direction (Apr 22, 2026):** *"Yes, but not for Beta Launch. Would like to go ZenRows scraping approach for both Marvel & DC. I'll look into a similar approach for Image and other publishers."*

**Approach:**
- Use ZenRows (already in consideration for CGC cert lookup — shared subscription amortizes cost)
- **Phase 1:** scrape Marvel.com catalog (supersedes existing "Scrape Marvel.com for Cover Images (ZenRows)" backlog item)
- **Phase 2:** scrape DC.com catalog
- **Phase 3 (user follow-up research):** evaluate Image Comics, Dark Horse, and other major publishers
- ETL: normalize scraped metadata into our schema, download + store cover images to Supabase Storage, populate `comic_metadata` and `cover_images`
- One-time batch job; optional periodic re-scrape for new releases (ties into Follow List feature — reuses the release-date data)

**Effort:** 3-5 days scripting per publisher + content review.

**Scale win:** Marvel + DC represent ~70% of typical collector scans — pre-seeding those alone cuts AI costs sharply at Full-Launch volume.

**Related:** Existing "Scrape Marvel.com for Cover Images (ZenRows)" entry — consolidate into this; Follow List (reuses release-date data).

---

### Align Clerk Username Rules with Supabase Regex
**Priority:** Low (residual gap mitigated by webhook sanitizer)
**Status:** Partially closed May 5, 2026 — dashboard portion done. **Decision May 6, 2026: build the custom Clerk signup validator** so users see an inline error at signup ("Username can only contain lowercase letters, numbers, and underscores") instead of the post-signup silent rename. ~2-4 hours UX work.
**Added:** Apr 23, 2026
**Updated:** May 5, 2026

Clerk dashboard currently accepts dashes/periods/uppercase in usernames, but Supabase `profiles.username` enforces `^[a-z0-9_]{3,20}$`. Session 43 (Apr 28) added a sanitizer on the Clerk webhook that rejects invalid characters before upsert + a sync-on-write path that pushes CC usernames back to Clerk.

**Done May 5, 2026 — dashboard tightening (as far as Clerk's UI allows):**
- Min length: 4 (Supabase allows 3 — Clerk slightly more restrictive, fine; new users must pick 4+)
- Max length: 20 (matches Supabase)
- "Allow extended characters" toggle: OFF (blocks `^$!.\`#+~``)

**Limitation (newly discovered May 5, 2026):** Clerk's "Username requirements" dashboard panel ONLY exposes length + the extended-chars toggle. It does NOT let you restrict the *base* allowlist, which still includes `A-Z` (uppercase), `-` (dashes), and `.` (periods) — all of which Supabase rejects. So the dashboard tightening can't fully close the gap.

**Residual options (decide before re-prioritizing):**
1. **Accept current state** — webhook sanitizer + sync-on-write already prevent crashes. The gap is now a UX papercut: a user picks `John-Doe.123` at Clerk signup, sees their Supabase profile silently sanitize to `johndoe123`. No data loss, no errors, just a slight rename surprise. **Recommended for Beta — close this BACKLOG item.**
2. **Build a custom Clerk signup validator** — Clerk SDK lets you validate usernames client-side with `addOnsManager` or via a custom signup form. ~2-4 hours. Gives users a friendly inline error at signup ("Username can only contain lowercase letters, numbers, and underscores") instead of a post-signup rename. **Required only if Beta surfaces user complaints about the silent rename.**

**Impact of accepting current state:** Users get a working profile every time. The username they picked at Clerk may not exactly match what shows up in Collectors Chest URLs/profiles. Most users won't notice (auto-generated usernames typically already match the regex), but power users picking deliberate handles with dashes/periods may.

---

### Android Native App (Google Play Store)
**Priority:** Medium (Post-Launch)
**Status:** Pending
**Added:** Apr 6, 2026
**Updated:** Apr 22, 2026

**User direction (Apr 22, 2026):** Full Public Launch will ship *without* an Android native app. Web PWA is sufficient for Android users at launch (Chrome PWA support is strong — push, install-to-homescreen, offline all work). Android app is a fast-follow after launch, not a blocker.

Android Play Store app built from the same Capacitor project as iOS. Google Play Developer account is $25 one-time; review is typically hours to 2 days (much faster than Apple).

**Why Post-Launch:**
- Android users can use the PWA via Chrome immediately — no distribution gap
- iOS users *need* the native app because iOS Safari PWA support is weaker (no push notifications)
- Capacitor lets us share the codebase, so Android shipping work is incremental (~2-3 days) once iOS is built

**Steps:**
1. Google Play Developer enrollment ($25 one-time)
2. Build Android artifact from the Capacitor project (shares codebase with iOS)
3. Create Play Store listing (reuse iOS screenshots where possible)
4. Implement Play Billing + receipt validation (parallel to StoreKit on iOS)
5. Internal testing track → production rollout

**Effort:** ~2-3 days once iOS native app foundation is built.

**Native-shell UX constraints (must address during native build):**
- **Disable pull-to-refresh on `/notifications`** in the Capacitor wrapper. Browser/PWA accepts both PTR + tap-pill, but native Android gesture conventions (back gesture, navigation drawer swipe) conflict with PTR. Only the "tap to refresh" pill should trigger refresh in native shell. (Established as a constraint May 6, 2026 during inbox testing walkthrough.)

**Related:** iOS Native App (shares Capacitor codebase); IAP strategy applies equally here.

---

### Auction History / Analytics for Sellers
**Priority:** Medium-High (Post-Launch)
**Status:** Pending
**Added:** Apr 22, 2026

Sellers have no dashboard for auction performance — total sales, fees paid, sell-through rate, avg sale price, top-performing listings, busiest day/week. Matters more as sellers list more items: without analytics, they can't optimize pricing or listing strategy, and can't easily pull data for taxes.

**Scope:**
- New `/seller-analytics` page (or tab under My Auctions)
- Metrics: total sales ($ and count), total fees paid, avg sale price, sell-through rate, top category, busiest day/week
- Time-window selector: 7d / 30d / 90d / all-time
- CSV export for tax + record-keeping
- Chart library — reuse whatever we pick for Sales Trend Graphs

**Prerequisite:** "Transactions Page for Buyers" (already in BACKLOG, Pre-Launch Blocker) — analytics builds on the same data model.

---

### Sales Trend Graphs
**Priority:** Medium (Post-Launch)
**Status:** Pending
**Added:** Apr 22, 2026

Competitor CovrPrice differentiates on multi-source price trend graphs. Adding sales trend visualization (individual comic value over time, category-level trends) to comic detail pages + collection dashboard closes that competitive gap.

**Scope:**
- Time-series data: capture eBay sales/prices with timestamps (partial data may already exist in `eBay_price_cache`)
- Pick lightweight chart library — Recharts is the obvious fit for our Next.js stack
- Comic detail page: price history over 6 / 12 / 24 months
- Collection dashboard: total collection value trend
- Integrates with Price Alerts (if added) — plot the user's target threshold on the trend

**Related:** Price Alerts (future Post-Launch); durable eBay price cache (BACKLOG Medium).

---

### Link `/sales` History Rows to Their Listing Modal
**Priority:** Medium (Post-Launch)
**Status:** Pending
**Added:** Apr 22, 2026

On the `/sales` (Sales History) page, clicking a row does nothing on desktop — the existing click handler only surfaces details on mobile (`md:hidden` card). Sellers have no way from here to reach the listing's "Mark as Shipped" flow or tracking details — they have to navigate to `/my-auctions` or find the listing via the notification bell.

**Fix scope:**
1. **Schema migration:** add `auction_id UUID NULL REFERENCES auctions(id) ON DELETE SET NULL` to `sales` table (plus an index)
2. **Webhook:** `handleMarketplacePayment` includes `auction_id` on the `sales` row insert
3. **Backfill:** one-time migration to match existing sales rows to their auctions by `user_id + buyer_id + sale_price + approximate date` (best effort; fine if some stay null)
4. **Sales page:** make each row a `<Link>` to `/shop?listing=<auction_id>` — opens the listing modal where seller can Mark as Shipped / view tracking / leave feedback
5. Consider also a "Pending Shipments" section at top of `/sales` highlighting paid-but-unshipped rows with inline "Ship it" CTA

**Files:**
- `supabase/migrations/…_sales_auction_id.sql`
- `src/app/api/webhooks/stripe/route.ts` — sales insert
- `src/app/sales/page.tsx` — row rendering + possible Pending Shipments section

**Effort:** 1-2 days.

---


### Re-engagement Email Drip Campaign
**Priority:** Medium (Post-Launch)
**Status:** Pending. **Decision May 6, 2026: trigger after 14 days inactive** (balanced — most apps land here as the default).
**Added:** Apr 22, 2026

No re-engagement email flow exists today for users who register but go inactive. Resend is integrated for transactional email (welcome, verification, purchase confirmations) but no drip campaigns for inactive or underutilizing users.

**Proposed sequences:**
- Day 3 post-signup if no scans: "Hey, you haven't scanned yet — here's a tip"
- Day 7: "What you're missing — here's what free users get"
- Day 14: monthly-value recap / first-scan nudge
- Weekly digest for users with watchlists: "3 items you're watching had activity this week"
- 30-day inactivity re-engagement

**Files:** build on existing `src/lib/email/` templates; add a scheduled Netlify function for batch sends; respect `notification_preferences`.

---

### Upgrade Supabase to Pro Tier ($25/mo) — Enable Daily Backups
**Priority:** Medium-High (Post-Launch)
**Status:** Pending — monitor and upgrade when warranted
**Added:** Apr 22, 2026
**Updated:** Apr 22, 2026

Current DB is on Supabase Free tier with NO automated backups. A single bad migration or corruption event has no recovery path. Upgrading to Pro unlocks daily backups + 7-day retention, 8GB DB, and 250GB bandwidth.

**Decision (Apr 22, 2026):** Not a launch blocker. Monitor guest activity and user growth; upgrade when the risk profile justifies the $25/mo (e.g., ~500 users, or sooner if data loss risk materializes). Until then, rely on manual pg_dump exports before risky schema changes.

**Acceptance criteria:**
- Project on Supabase Pro tier ($25/mo billed)
- Daily backups visible in dashboard
- Restore procedure documented in `docs/runbooks/` or similar
- Update `CLAUDE.md` Services table (Supabase row: "Pro" not "Free")
- Update `COST_PROJECTIONS.md` Scenario 1 once triggered

**Interim mitigation:** Take a manual pg_dump before any destructive schema migration on production (e.g., dropping/renaming columns, table splits).

---

### Expand Test Coverage (Bid Logic, Auth, Payment Webhooks)
**Priority:** Medium-High (Post-Launch, ongoing)
**Status:** Pending
**Added:** Apr 22, 2026

Current test suite: **584 passing tests** (per EVALUATION § 1). Known coverage gaps — proxy bidding logic, Clerk auth flows, Stripe webhook handlers. Session 36 RLS silent-failures slipped past because no integration tests exercised the buyer / cron path end-to-end.

**User direction (Apr 22, 2026):** *"NO, but quick follow. How do we validate that the current Test Cases is accurate in regards to the applications current feature set?"*

**Scope (ongoing):**
- Baseline coverage sweep — 3-5 days to add tests for the three target areas (proxy bidding, auth flows, Stripe webhooks)
- Ongoing — write tests as we touch code; enforce via `npm run check:full` pre-commit

**Quick-follow sub-task — TEST_CASES.md audit vs current feature set:**
1. Generate a feature inventory: list every user-facing feature (ARCHITECTURE.md + grep sweep of `src/app` routes + key `src/components`)
2. Cross-reference each feature against TEST_CASES.md — flag features missing documented test coverage
3. Cross-reference each TEST_CASES.md entry against the code — flag tests for features that no longer exist (stale)
4. Produce a delta report: missing coverage + stale tests
5. Refresh TEST_CASES.md to match the current feature set before new test cases are added

**Effort:** Audit 1 day. Baseline coverage sweep 3-5 days. Ongoing thereafter.

---

### Fraud Detection for Bidding Patterns
**Priority:** Medium (Post-Launch)
**Status:** Pending
**Added:** Apr 22, 2026

Detect shill bidding (seller bidding on own auction via alt account), coordinated buyer collusion, bid manipulation (rapid sniping from new accounts), high-value wins by brand-new accounts. Existing `placeBid` has a self-bid guard but is trivially bypassed with alt accounts.

**MVP rules (ship first):**
- Block bids from accounts <7 days old on auctions over $X (configurable threshold)
- Alert admin on auction wins by accounts <14 days old
- Flag repeated max-bid patterns that smell like shilling (same bidder repeatedly pushing to just below the leader's max)
- All suspicious patterns log to audit system (ties into "Audit Logging for Auction Transactions")

**Future (reactive):**
- Build out detection as actual fraud patterns emerge in production — no speculative pre-building
- Consider Stripe Radar or Sift integration if transaction volume warrants

**Effort:** MVP 2-3 days; ongoing as patterns emerge.

**Related:** Audit Logging for Auction Transactions (feeds this system).

---

### Price Alerts
**Priority:** Medium (Post-Launch)
**Status:** Pending
**Added:** Apr 22, 2026

Users set a target price on a watchlist item (e.g., *"Notify me when NM copies of ASM #300 drop below $500"*). System polls prices and fires a notification when the threshold is crossed. Competitive differentiator — Key Collector ($3.99/mo) and CovrPrice ($5/mo) both paywall this. CLZ doesn't have it.

**Recommendation:** gate behind Premium subscription — matches competitor pricing strategy, creates a clear upsell.

**Scope:**
- New `price_alerts` table: user_id, comic_id, target_price, condition (NM / CGC 9.x / etc.), triggered_at, created_at
- Cron job: poll latest prices vs user thresholds, fire notifications when crossed
- New notification type: `price_alert_triggered`
- UI: bell icon on comic detail → "Alert me when price drops below $X"
- Integration with Sales Trend Graphs — plot user's target threshold on the trend line

**Prerequisites:** Durable eBay Price Cache (BACKLOG Medium); existing notification system.

**Effort:** 3-5 days.

---

### Follow List (Series Following + Release Notifications) — "Effort B"
**Priority:** Medium (Post-Launch)
**Status:** Pending
**Added:** Apr 22, 2026

Users flag series they're actively collecting. System tracks upcoming release dates and notifies when new issues drop. Key feature for collectors.

**User direction (Apr 22, 2026):** *"Definitely want to keep effort B. That is going to be key for collectors, which is what we're focusing on."*

**Important terminology:** Competitors (CLZ, Key Collector) call this "pull list," which conflicts with traditional comic-shop pull lists (customer subscription at a physical shop). **Our product terminology: "Follow List."** The shop-integration ask is tracked as a separate item — "Pull List Integration with Local Comic Shops (Effort A)" — Post-Launch Low priority.

**Scope:**
- New `user_series_follows` table: user_id, series_title, publisher, auto_add_to_watchlist (bool), notify_on_release (bool)
- "Follow series" button on comic detail / series detail page
- Release-date source: reuse scraping pipeline from "Pre-populate Top Comics Cache — ZenRows Marvel + DC" (ties together)
- New notification type: `new_issue_released`
- Weekly digest option: "3 issues from your followed series released this week"

**Effort:** 4-6 days.

**Related:** Pre-populate Top Comics Cache (data source — release dates come from same scrape); Pull List Integration (Effort A — separate ask, shop-facing).

---

### Dealer Mode for Conventions
**Priority:** Medium (Post-Launch — Needs Brainstorming)
**Status:** Pending — concept, NOT scoped. Run `/brainstorming` before scoping.
**Added:** May 5, 2026

Convention dealers are a high-value user segment whose workflows our current app doesn't address. Need to design what "Dealer Mode" looks like — likely a different default home, faster bulk-list flows, possibly a different pricing tier. **No spec yet — explicit brainstorming session required before this gets sized.**

**Open questions to bring into brainstorming:**
- What does a dealer's day at a con look like that a collector's doesn't? (Bulk receipt-quick-list, in-person sales, cash-vs-app payment recording, mid-show inventory checks, end-of-show profit summary?)
- Pricing — is this its own subscription tier (Dealer = $19.99/mo?) or a Premium add-on (Dealer Mode toggle inside Premium)?
- Multi-user — does a dealer need staff accounts that can use the same inventory at the same con?
- Offline-heavier — convention WiFi is often awful. Should Dealer Mode pre-cache more aggressively?
- POS-adjacent — do dealers want Stripe Terminal / Square integration to take card payments at the booth?
- "Show this booth" — public-facing dealer profile with their inventory, picked up by con-goers searching titles?
- Inventory bulk-add — bulk import + label-print workflows?

**Competitive note:** No competitor has a dealer-focused mode. CLZ, Key Collector, CovrPrice are all collector-facing. This could be a strong moat.

**Next step:** when prioritized, run `/brainstorming` to scope.

---

### Demo Collection / Sample-Data Mode
**Priority:** Medium (Post-Launch)
**Status:** Pending. **Decision May 6, 2026: surface as "Try the demo" button on homepage** (visible CTA in guest experience to drive discovery). The `/demo` URL also works as a share-link fallback.
**Added:** Apr 22, 2026

Guests can explore the app with a pre-populated sample collection (~12 iconic comics) — `/demo` route or "Demo mode" toggle. Lowers friction for cold visitors who don't have a comic in hand. EVALUATION § 4 Gaps flagged this.

**Scope:**
- Curate sample collection: 12 iconic comics (Detective #27, Amazing Fantasy #15, X-Men #1, etc.) with real cover art + realistic pricing
- Static sample JSON file committed to repo
- Toggle: "View demo collection" on landing page → loads sample into localStorage (guest flow)
- Clear visual indicator: "Demo Mode — Sample Data"
- CTA to convert: "Ready to scan your own? Create an account."

**Effort:** 1-2 days.

---

### Batch Scanning (Rapid-Fire Scan Mode)
**Priority:** Medium (Post-Launch)
**Status:** Pending
**Added:** Apr 22, 2026

Scan a stack of comics in rapid succession without tapping "Scan another" between each. Massive UX win for users cataloging large existing collections.

**Two implementation paths:**

**Option A — Auto-capture loop (recommended):**
- Camera stays active after each scan
- Cover-change detection triggers next capture (computer vision comparison of current frame vs previous)
- User tap to review/confirm each result, or "fast mode" skips review

**Option B — Batch queue:**
- User pans camera over a stack; app captures frames continuously
- Process frames in a background job (async AI calls)
- User reviews and commits results in a batch UI

**Recommendation:** Option A — faster to build, simpler UX. Option B is more powerful but significantly harder (robust cover-detection from arbitrary pan frames, async processing, review UX).

**Effort:** 5-7 days (Option A); 10+ days (Option B).

---

### Pull List Integration with Local Comic Shops ("Effort A")
**Priority:** Low (Post-Launch)
**Status:** Pending
**Added:** Apr 22, 2026

Traditional comic-shop pull list integration — users subscribe to a local shop's pull list (or browse / transfer between shops) via Collectors Chest. Shops receive a weekly pull list of comics to hold for each customer; customers get reminders + shop location info.

**User direction (Apr 22, 2026):** *"I do know a few local shops that I might be able to integrate and get users subscribed to their pull list."*

**Note:** WE ARE NOT A SHOP — but we could play the aggregation / marketplace role between shops and collectors.

**Scope (if pursued):**
- Shop onboarding flow (opt-in shop registration)
- User subscribes to shop's pull list with preferred series
- Weekly automated pull list export for shops (email or POS integration — TBD)
- Notification when new issue lands on customer's pull list
- Shop discovery / directory

**Effort:** High — significant product work. Multi-party coordination (shops have opinions, POS integrations may be needed).

**Related:** Follow List (Effort B — separate, in-app-only; already filed as Medium).

---

### CLZ Comics — Approved Competitor Talking Points (Marketing Content)
**Priority:** Medium (escalated May 5 for tomorrow's partner meeting)
**Status:** Brief drafted, pending Aponte review. Full document at `docs/CLZ_COMPARISON_BRIEF.md`.
**Added:** May 5, 2026
**Updated:** May 5, 2026 (escalated, brief drafted, pricing verified)

User-validated talking points from May 3-4 weekend show (CLZ came up most among comparables). Brief built for: (a) partner sales-strategy meeting, (b) convention-floor sales talking points, (c) future "Why Collectors Chest vs CLZ" page or FAQ embed.

**Verified CLZ pricing (May 5, 2026 — clz.com):**
- CLZ Comics Mobile alone: $1.99/mo or $19.99/yr (catalog only, NO real-time pricing)
- CovrPrice Premium add-on (REQUIRED for actual comic values inside CLZ): $8.95/mo or $89.95/yr
- **Apples-to-apples (catalog + pricing): $10.94/mo** for CLZ
- vs Collectors Chest Premium $4.99/mo all-in → **~half the price**
- Free trial: 7 days (CLZ) vs 30 days (Collectors Chest)

**Approved talking points (verified May 5, 2026 — see brief for full delivery cues):**
1. **Design** — Modern PWA + pop-art aesthetic vs CLZ's legacy desktop port
2. **Cost** — ~half the price apples-to-apples ($4.99 all-in vs $10.94 catalog+pricing). **CRITICAL framing — don't just say "we're cheaper"; reframe to "what it costs to actually USE it."**
3. **Authenticity** — Your real cover photo vs stock catalog image
4. **Free tier + extended trial** — 5 free guest scans + 10/mo free tier + 30-day trial vs 7-day trial only
5. **No-account scanning** — Guest scans on first launch vs CLZ's subscription dialog at first launch

**Done May 5, 2026:**
- Verified CLZ pricing via clz.com + CovrPrice page
- Identified the apples-to-apples reframe (the $1.99 vs $4.99 gotcha — CLZ is actually MORE expensive once you add CovrPrice)
- Authored full sales brief: `docs/CLZ_COMPARISON_BRIEF.md` — TL;DR pitch, pricing tables, refined talking points with delivery cues, common objections + responses, pocket cheat-sheet (printable), source footnotes
- **Feature-set comparison added** to brief — pulled from public CLZ marketing/manual/App Store docs (no credentials used). Side-by-side: where CC wins, where CLZ wins, where both tie, plus strategic gap-closing recommendations (storage location field, back-cover photo upload, signature tracking are easy wins to consider).
- **Built admin-facing tablet "slide" page** at `/admin/clz-comparison` — designed for Aponte to pull up on his tablet during convention conversations. Hero pitch, side-by-side pricing cards, color-coded talking points with floor-pitch delivery cues + pitfall warnings, where-CC-wins / where-CLZ-wins / both-tie tables with verdict icons, expandable common-objection cards, printable pocket cheat-sheet. Linked into admin nav as "vs CLZ" tab (`src/app/admin/clz-comparison/page.tsx` + `src/app/admin/layout.tsx`). User has done CLZ first-launch verification firsthand.

**Remaining open items:**
- Aponte review of the brief and tablet page — flag anything off-brand or factually off
- Decide placement of public-facing version: FAQ embed (next), standalone `/compare/clz` marketing page (later — would unblock SEO + QR-code-on-business-cards play). Admin tablet page is the immediate convention-floor tool.

**Considered gap-closers (low-effort wins surfaced from feature-set audit — see brief for full analysis):**
- Storage box location field (~30 min, real collector value)
- Back cover photo upload (~2 hrs, helpful for slab listings)
- Signature/autograph tracking field (~1 hr)

**Files (if standalone page eventually built):**
- New: `src/app/compare/clz/page.tsx`
- Updated: footer links to `/compare/clz`
- Brief content already in `docs/CLZ_COMPARISON_BRIEF.md` would be the source of truth for the page copy

**Related:** Testimonials / Social Proof on Homepage; Competitive Positioning (EVALUATION § 5); CLAUDE.md branding section.

---

### Resolve npm audit Vulnerabilities (Dependencies)
**Priority:** Low-Medium (Post-Launch maintenance)
**Status:** Pending
**Added:** May 27, 2026

`npm audit --audit-level=high` reports **15 vulnerabilities (7 high, 8 moderate) as of May 27, 2026** in transitive dependencies — notably `ws` (uninitialized memory disclosure) and `resend`'s transitive chain (`resend` → `svix` → `uuid`; also `@sentry/nextjs` → `@sentry/webpack-plugin` → `uuid`). `npm audit fix` is available, but test carefully for breakage before committing — several fixes touch deps inside `resend` and `@sentry/nextjs`, so run the full test + build suite and smoke-test email/error-tracking after applying.

---

### Detail-Modal Mobile Cover Thumbnail — Optional `object-contain` (Zero-Crop)
**Priority:** Low (cosmetic)
**Status:** Pending — optional, user preference
**Added:** May 27, 2026

The mobile detail-modal cover thumbnail (fixed in Session 47) is currently a cropped-to-fill 2:3 box. Open option to switch it to `object-contain` (zero-crop, letterboxed) if the user prefers seeing the full cover edge-to-edge over a tighter framed thumbnail. One-line CSS change; pick the look the user wants.

---

### Testimonials / Social Proof on Homepage
**Priority:** Low (Post-Launch)
**Status:** Pending — defer until 50+ engaged real users
**Added:** Apr 22, 2026

User quotes/reviews on homepage build trust for cold visitors. Currently in private beta with few users — need real engagement data + authentic quotes before adding the section. Placeholder or fake quotes are a trust-killer if discovered.

**Scope (when ready):**
- Solicit quotes from 5-10 engaged users (beta testers + early adopters)
- Homepage section with rotating testimonials
- Optional: link to public collection page of the testimonial author (social proof + link value)

**Effort:** 1 day (content + UI) once real quotes are in hand.

---

### Marketplace Dispute & Refund Workflow
**Priority:** Medium (Post-Launch)
**Status:** Pending
**Added:** Apr 22, 2026

No formal dispute resolution or refund workflow exists for marketplace transactions. Per Stripe Connect platform responsibility (acknowledged Apr 21, 2026 during Connect setup), Collectors Chest handles first-line support for refunds and chargebacks — we need the tooling to back that commitment.

**Scope:**
- Buyer-initiated dispute / refund request UI (on transaction detail page)
- Admin-facing queue to review, approve, or deny disputes
- Stripe refund / transfer-reversal wiring via platform account
- Notification to both buyer and seller on dispute status changes
- Audit log for all dispute actions
- Defined refund policy (full vs partial, timeframe e.g. 14 days from delivery)
- Gate the dispute window on delivery (ties to Shipping Tracking feature)

**Files expected:**
- New `src/app/api/disputes/route.ts` (create / update / list)
- New `src/app/transactions/[id]/dispute/page.tsx` (buyer UI)
- New `src/app/admin/disputes/page.tsx` (admin queue)
- Stripe refund logic in `src/lib/stripeConnect.ts` or equivalent
- New notification types: `dispute_filed`, `dispute_resolved_buyer`, `dispute_resolved_seller`

**Related:** Marketplace Policy Gaps (Pre-Launch — covers policy language); Shipping Tracking (gates dispute window on delivery).

---

### Second Chance Offer — Cascade to Third-Highest Bidder
**Priority:** Low (Post-Launch)
**Status:** Pending
**Added:** Apr 23, 2026

The Second Chance Offer feature shipped today (seller-initiated, 48h window, runner-up's last actual bid). If the runner-up declines or ignores, the offer currently ends and the seller must re-list manually. This item tracks the potential enhancement to cascade automatically to the 3rd-highest bidder, 4th, etc., with a cap (e.g., 3 deep).

Rationale for deferring: Spam risk and unclear conversion value. Wait for post-launch data on how often Second Chance Offers happen and what the accept rate looks like before adding cascade complexity.

---

### FMV Lookup — Graceful Fallback for Rare / Key Issues at Exact Grade
**Priority:** Medium (Pre-Launch — affects key-issue value display)
**Status:** Pending
**Added:** Apr 23, 2026 (Session 40b)

The current eBay Browse path (`searchActiveListings` → `filterIrrelevantListings` → `filterOutliersAndCalculateMedian`) strictly filters listings to the exact grade (`\\b{grade}\\b` regex) and requires `MIN_LISTINGS_THRESHOLD = 3` listings to compute a median. For high-value key issues at uncommon grades (e.g. Hulk #181 CGC 2.5), active eBay listings at exactly that grade are often 0–2 at any given moment, so `refresh-value` returns "No eBay sales data found" even when the user can clearly find a listing on eBay directly. Confirmed in Session 40b PROD testing with collector-patton's Hulk #181 2.5.

Fix directions:
- If <3 listings at exact grade, fall back to broader grade band (e.g., 2.0–3.0) and apply the existing `GRADE_MULTIPLIERS` table to normalize each listing's price to the target grade before computing median.
- Alternatively, relax `MIN_LISTINGS_THRESHOLD` to 1 for exact-grade queries when the book is slabbed and display "based on N listings" with confidence indicator.
- Consider supplementing with sold-listing history (Finding API's `findCompletedItems`) for thicker data — but requires additional eBay API access.

Should ship before public launch since it degrades trust for key-issue collectors.

---

### Per-Profile Timezone Preference for Email Deadlines
**Priority:** Low (Post-Launch)
**Status:** Pending. **Decision May 6, 2026: inline in account settings page** near email preferences (one less route to maintain).
**Added:** Apr 27, 2026 (Session 42)

Session 42 hardcoded `America/New_York` + explicit "EDT"/"EST" abbreviation in transactional email deadline rendering (`formatDeadlineForEmail` in `src/lib/auctionDb.ts`). This is the right call for the US-focused beta — recipients now see "April 26, 2026 at 10:20 AM EDT" instead of an unlabeled UTC time.

Once the user base grows beyond US Eastern, swap to per-profile timezone:
- Add `profiles.timezone` column (text, e.g. `"America/Los_Angeles"`)
- Auto-detect at signup via `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Add a settings selector
- Pass user's tz into `formatDeadlineForEmail(date, timezone)` per email

Deadline display is the only user-facing timestamp that matters today (auction close + payment expiry + second-chance expiry). Other surfaces (notifications page, transactions page) render relative time or browser-locale strings client-side, so this fix only needs to extend to the email layer.

---

### Customizable Initial Message
**Priority:** Low
**Status:** Pending. **Decision May 6, 2026: free-text input** (max 200 chars). No template picker — keep it simple; users type whatever they want.
**Added:** Jan 29, 2026

Allow users to customize the initial message when starting a conversation via the "Message Seller" button. Currently auto-sends "Hi! I'm interested in your listing." without user input.

**Proposed UX:**
- Show a modal/popup when clicking "Message Seller"
- Pre-fill with suggested text but allow editing
- Include listing context (title, image thumbnail) in the modal
- Send button to confirm

**Files to Modify:**
- `src/components/messaging/MessageButton.tsx`
- New: `src/components/messaging/ComposeMessageModal.tsx`

---

### Re-introduce Dedicated Barcode Scanning
**Priority:** Low
**Status:** Pending (Blocked)
**Added:** Feb 4, 2026
**Blocked:** Requires a barcode database to be set up first before this feature can proceed. **Strategy decision blocked on "Research: How CLZ + CovrPrice Implement Barcode Scanning" entry above** (May 5, 2026) — the research may inform whether the curated-database approach is the right path or if a third-party API / public dataset / on-device ML approach is more viable.

Re-enable dedicated barcode scanning feature once the crowd-sourced barcode catalog has sufficient data to provide reliable lookups.

**Context:**
The dedicated barcode scanner was removed on Feb 4, 2026 because:
- Comic Vine API returns garbage data for UPC queries (1.1M wildcard results)
- No reliable external barcode → comic mapping API exists

**Current Approach:**
- Barcodes are now detected during AI cover scans and cataloged
- Building a crowd-sourced `barcode_catalog` database
- Admin review queue for low/medium confidence detections

**Prerequisites to Re-enable:**
1. Barcode catalog has 5,000+ verified entries
2. OR partner with local comic shop to seed data
3. OR find a reliable external UPC database (GoCollect API may provide this)
4. OR Comic Vine fixes their API to support exact UPC matching

**When Ready:**
1. Restore `BarcodeScanner.tsx` component from git history (commit before Feb 4, 2026)
2. Update barcode lookup to query our `barcode_catalog` first
3. Fall back to AI cover scan if barcode not in catalog
4. Re-add "Scan Barcode" option to scan page and Key Hunt

**Spec Document:** `docs/BARCODE_SCANNER_SPEC.md` - Full technical documentation

---

### Activate OpenAI as Fallback Provider for Full Anthropic Outages
**Priority:** Low
**Status:** Deferred to Post-Launch (Mar 9, 2026) — Self-healing pipeline handles model deprecation; OpenAI activation only needed for full Anthropic outages
**Design Doc:** `docs/plans/2026-02-27-scan-resilience-design.md`
**Implementation Plan:** `docs/plans/2026-03-01-scan-resilience-plan.md`

Code implementation is complete (8 commits, 370 tests passing). Deployment and alerting infrastructure are live. Remaining steps:

**Completed:**
- ✅ **Run migration SQL** — `supabase/migrations/20260301_scan_analytics_provider.sql` run in production; `provider`, `fallback_used`, `fallback_reason` columns live
- ✅ **Deploy** — Code pushed to production (Mar 3, 2026)
- ✅ **Add fallback rate alerting (Tier 1)** — `check-alerts` cron extended to query `scan_analytics` for fallback rate; sends Resend email if fallback_used exceeds 10% in the last hour
- ✅ **Add model health check (Tier 2)** — Lightweight scheduled probe at `/api/admin/health-check` makes minimal API call to each provider; sends immediate alert on 403/404

**Remaining:**
1. **Get OpenAI API key** — Pending business account setup at platform.openai.com; requires billing added before key can be generated
2. **Add `OPENAI_API_KEY`** to `.env.local` (local) and Netlify environment variables (production)
3. **Run prompt compatibility study** — Run 10-15 sample comic images through both Anthropic and OpenAI, document quality delta (see design doc "Prompt Compatibility & Validation" section)
4. **End-to-end fallback testing** — Set `ANTHROPIC_API_KEY` to invalid value, verify OpenAI fallback activates; test both keys invalid for graceful error; verify "taking longer" message after 5 seconds
5. **Set up EasyCron entry for `/api/admin/health-check`** — Schedule hourly call with `CRON_SECRET` auth header

**Complexity:** Low — remaining steps are account setup, configuration, and testing.

---

### Add "Professor" Persona Throughout Site
**Priority:** Medium
**Status:** Pending. **Decision May 6, 2026: match existing AskProfessor voice** (same friendly-explainer tone already used in the FAQ modal — consistent across the app).

Create a consistent "Professor" character/persona that provides tips, guidance, and commentary throughout the application. This persona adds personality and makes the app more engaging.

**Areas to Implement:**
- Tooltips and help text
- Empty state messages
- Loading messages / fun facts
- Welcome messages
- Feature explanations
- Error messages (friendly Professor-style guidance)

**Considerations:**
- Design a simple avatar/icon for the Professor
- Define the Professor's voice/tone (knowledgeable but approachable)
- Don't overuse - sprinkle in key moments for delight

---

### Error Reporting System with Creator Credits
**Priority:** Medium
**Status:** Pending
**Added:** Feb 26, 2026

Users can report incorrect data on comics (wrong publisher, year, key info, etc.) via a "Report Error" button. Reports go to an admin queue for review. When admin approves and fixes the data, the reporter earns a Creator Credit.

**Features to Build:**
- "Report Error" button on comic detail views (ComicDetailModal, ComicDetailsForm)
- Error description form (modal/sheet) with dropdown for error category (Wrong Publisher, Wrong Year, Wrong Grade, Key Info Error, etc.)
- Admin review queue at `/admin/reports` showing pending error reports
- Admin dashboard to review, approve/reject, and apply fixes
- Creator Credit wiring system: when admin approves, increment reporter's `creator_credits` and log action in audit trail
- Notification to reporter when their report is approved/rejected

**Database Changes Needed:**
- New table: `error_reports` (id, reporter_id, comic_id, error_category, description, status, created_at, approved_by, approved_at)
- New table: `creator_credits_log` (id, user_id, credit_amount, source, source_id, created_at)
- Add `creator_credits` column to `profiles` table

**Key Files to Create/Modify:**
- New: `src/components/ErrorReportModal.tsx` - Report form
- New: `src/app/admin/reports/page.tsx` - Admin review queue
- New: `src/lib/errorReportDb.ts` - Database helpers
- New: `src/app/api/errors/report/route.ts` - Report submission API
- New: `src/app/api/admin/errors/route.ts` - Admin approval API
- Modify: `src/components/ComicDetailModal.tsx` - Add report button
- Modify: `src/components/ComicDetailsForm.tsx` - Add report button

---

### Missing Metadata Contributions with Creator Credits
**Priority:** Medium
**Status:** Pending
**Added:** Feb 26, 2026

Users can fill in missing comic metadata (writer, cover artist, release year, etc.) and earn Creator Credits after admin approval. This crowdsources completion of incomplete metadata in the database.

**Features to Build:**
- Editable metadata fields on comic detail views for registered users (writer, artist, cover artist, inker, colorist, release year, etc.)
- Submission flow that captures user's changes and submits to admin queue for approval
- Admin review queue at `/admin/contributions` showing pending metadata submissions
- Admin dashboard to review, compare old vs new data, approve/reject, and apply changes
- Creator Credit wiring system: when admin approves, increment contributor's `creator_credits` and log action
- Notification to contributor when their contribution is approved/rejected
- "Contributors" section on comic detail showing who contributed which fields

**Features to Build:**
- User can edit a subset of comic metadata on detail view (marked as "Contribute metadata")
- Submit changes button triggers submission flow
- Form shows original vs proposed values clearly
- Admin review shows change diff and can approve/reject
- Approved contributions auto-update comic and credit user

**Database Changes Needed:**
- New table: `metadata_contributions` (id, contributor_id, comic_id, field_name, old_value, new_value, status, created_at, approved_by, approved_at)
- New table: `creator_credits_log` (id, user_id, credit_amount, source, source_id, created_at) - *shared with Error Reporting System*
- Add `creator_credits` column to `profiles` table
- Track contribution metadata on `comics` table (contributor_id, contributed_fields JSON array)

**Key Files to Create/Modify:**
- New: `src/components/MetadataEditor.tsx` - Editable metadata fields with submission
- New: `src/app/admin/contributions/page.tsx` - Admin review queue
- New: `src/lib/metadataDb.ts` - Database helpers
- New: `src/app/api/contributions/submit/route.ts` - Submission API
- New: `src/app/api/admin/contributions/route.ts` - Admin approval API
- Modify: `src/components/ComicDetailModal.tsx` - Add metadata editor section
- Modify: `src/components/ComicDetailsForm.tsx` - Add metadata editor section

**Note:** Both error reporting and metadata contributions use the same Creator Credit system. Consider creating shared utilities for credit wiring and audit logging.

---

### Expand to Support All Collectibles
**Priority:** Low
**Status:** Pending

Extend the platform beyond comic books to support other collectible categories, transforming the app into a universal collectibles tracker.

**Supported Categories:**
- Funko Pop figures
- Sports cards (baseball, basketball, football, hockey)
- Trading cards (Pokemon, Magic: The Gathering, Yu-Gi-Oh!)
- Action figures
- Vinyl records
- Movies (DVD, Blu-ray, 4K, digital) *(check CLZ Movies for ideation)*
- Video Games (console, PC, retro) *(check CLZ Games for ideation)*
- Music (CDs, vinyl, cassettes) *(check CLZ Music for ideation)*
- Books (first editions, signed copies, rare prints) *(check CLZ Books for ideation)*
- Other collectibles

**Implementation Considerations:**
- Update AI vision prompts to identify collectible type and extract relevant metadata
- Category-specific fields (e.g., card grade, Pop number, set name, ISBN, UPC)
- Category-specific price sources (eBay, TCGPlayer, Pop Price Guide, Discogs, PriceCharting)
- Update UI to accommodate different collectible types
- Allow users to filter collection by category
- Consider renaming app to something more generic (e.g., "Collector's Vault")

**Data Model Changes:**
- Add `collectibleType` field to items
- Dynamic metadata schema based on collectible type
- Category-specific grading scales (PSA for cards, VGA for games, etc.)

---

### Clean Up Copy Throughout the Site
**Priority:** Low
**Status:** Pending (Reviewed Jan 28, 2026 - Acceptable for Launch)

Review and improve all user-facing text throughout the application for consistency, clarity, and brand voice.

**Audit Notes (Jan 28, 2026):**
- Toast messages: Consistent tone, clear success/error messaging
- Empty states: Good user guidance across all pages
- Sign-in prompts: Consistent "Sign in to..." pattern
- Milestone modals: Well-crafted progressive urgency
- Overall: Copy is clean and launch-ready; this is a polish task for post-launch

**Areas for Future Polish:**
- Page titles and descriptions
- Button labels and CTAs
- Error messages and confirmations
- Empty states and placeholder text
- Toast notifications
- Form labels and helper text
- Sign-up prompt modals (milestone prompts for guest users)

---

### Native App: Cover Image Search via Default Browser
**Priority:** Low
**Status:** Pending
**Note:** No external image search API available. Current approach uses manual URL paste. Revisit when native apps are built.

When converting to native mobile apps (iOS/Android), the cover image search feature may need to open the device's default browser for image searches instead of an in-app webview.

**Current Behavior (PWA/Web):**
- User searches for cover images via community DB or Open Library
- User can manually paste a cover image URL from any source
- User pastes copied image URL

**Native App Requirements:**
- Open device's default browser (Safari on iOS, Chrome/default on Android)
- Maintain app state while user is in browser
- Handle return to app gracefully (deep link or app switcher)
- Consider clipboard monitoring to auto-detect copied image URLs (with permission)
- Alternative: In-app browser with "Copy URL" detection

**Platform-Specific Notes:**
- iOS: Use `SFSafariViewController` or `UIApplication.open()` for external browser
- Android: Use `Intent.ACTION_VIEW` or Chrome Custom Tabs
- React Native: `Linking.openURL()` or `react-native-inappbrowser`

**UX Considerations:**
- Clear instructions that user will leave the app temporarily
- "Paste URL" button should be prominent on return
- Consider toast/notification when URL is detected in clipboard

---

### Evaluate Clerk Billing as Stripe Alternative
**Priority:** Low
**Status:** Pending. **Decision May 6, 2026: analysis-only doc** — produce comparison (cost, feature parity, migration effort, risks). No code changes; user reads and decides later. Output: `docs/CLERK_BILLING_EVALUATION.md`.
**Added:** April 2, 2026

Clerk offers subscription/billing services. Investigate whether Clerk Billing could replace or simplify the current Stripe integration for subscription management. Note: Stripe is still likely needed for marketplace payments (seller payouts via Connect), but Clerk might handle the subscription tier management more simply.

**Questions to Research:**
- What does Clerk Billing offer vs Stripe subscriptions?
- Can it handle trial periods, plan upgrades/downgrades?
- Would it reduce integration complexity?
- Does it still require Stripe underneath?

---

### Upgrade Clerk SDK to v7 + Enable Client Trust Status
**Priority:** Low
**Status:** Pending
**Added:** April 2, 2026

Clerk has a pending "Client Trust Status" update that adds `needs_client_trust` sign-in status for second-factor challenges on new devices. Requires `@clerk/nextjs` v7.0.0+ (currently on v6.36.6). This is a major version bump — defer until after launch.

**Warning:** The update notes say custom flows need code changes to handle the new `needs_client_trust` status attribute instead of `client_trust_state`. Review breaking changes before upgrading.

---

### Custom Sign-Up Form (Replace Clerk's Default)
**Priority:** Medium
**Status:** Pending. **Decision May 6, 2026: rebrand to Lichtenstein** — pop-art card with bold black borders, comic typography, matches the rest of the app aesthetic.
**Added:** Apr 6, 2026

Replace Clerk's default `<SignUp />` component with a custom form using Clerk's `useSignUp()` hook. This gives full control over field order, styling, and layout — allowing us to match our Lichtenstein design language and control field order (email → username → password). Currently the browser autofills the email into Clerk's username field, and we cannot reorder fields with the default component.

**Implementation Notes:**
- Use Clerk's `useSignUp()` hook for custom form
- Control field order: email first, then optional username, then password
- Match existing pop-art/Lichtenstein design language
- Keep social login buttons (Google, Apple) at top
- Maintain email verification flow

---

### About Page Copy
**Priority:** Medium
**Status:** Pending
**Added:** Mar 13, 2026

Write "Our Story" origin narrative and "Meet the Team" bios for the About page. Placeholder text is currently highlighted in red. Also complete the "Get in Touch" contact section.

---

### Evaluate Sonnet 4.6 vs Sonnet 4.5 for Comic Cover Recognition
**Priority:** Low (Post-Launch)
**Status:** Pending
**Added:** May 1, 2026

Anthropic retired the 1M context beta on Sonnet 4 / Sonnet 4.5 (May 1, 2026) and surfaced Sonnet 4.6 as the recommended path forward — same price, 1M context now GA. We currently pin `MODEL_PRIMARY = "claude-sonnet-4-5-20250929"` in `src/lib/models.ts`. The retirement does NOT affect us today (no `context-1m` beta header set, all calls cap at `max_tokens: 256–1536`, well under the 200K threshold). But Sonnet 4.5 will eventually follow Sonnet 4 into retirement, so a planned migration is worthwhile.

**What to do:**
1. A/B test Sonnet 4.6 against 4.5 on a representative sample of comic cover scans (~50 covers spanning publishers, eras, slabbed/raw, partial covers).
2. Compare: title accuracy, issue # accuracy, publisher accuracy, latency p50/p95, token usage delta.
3. If 4.6 is at-or-better on accuracy with no regression: flip `MODEL_PRIMARY` to `claude-sonnet-4-6-<date>` and add a DEV_LOG entry.
4. If 4.6 regresses: keep on 4.5, document the eval, set a reminder to re-evaluate before 4.5's retirement date is announced.

**Reminder:** Gemini is currently primary (`VISION_PROVIDER_ORDER = ["gemini", "anthropic"]`); Anthropic is the fallback path. So the impact of any Sonnet flip is on fallback quality, not primary scan accuracy.

**Files to touch:** `src/lib/models.ts:9` (the single pin point).

---

### Expand Curated Key Info DB
**Priority:** Low (post-launch, scan-data-driven)
**Status:** Partially complete — May 5, 2026 seeded +283 canonical entries (404 → 687)
**Added:** Mar 18, 2026
**Updated:** May 5, 2026

**Done May 5, 2026 — upfront seed pass (three rounds, 726 net-new entries: 404 → 1,130):**

**Round 3 (+185 net-new) — modern hot keys, licensed comics, Charlton heroes, recent Image:**
Cates Venom (#1-#4 + Knull origins, Edge of Venomverse, Symbiote Spider-Man), Cates Thor (#1/5/6/13/19, God of Hammers, Donald Blake revival, Black Winter), modern X-Men (Astonishing #1 Whedon, New X-Men #114 Morrison, Wolverine: Origin #1, Old Man Logan #1, All-New Wolverine #1, X-23 #1, Cates Krakoa-era titles, Death/Return of Wolverine, X of Swords, Hellions #1, Way of X #1), modern Spider-Man (Ultimate Comics #1, Spider-Man Miles Morales #1 2016, Champions #1, Ghost-Spider #1, Spider-Boy #1, Friendly Neighborhood Spider-Man #1), modern Avengers (New Avengers #27 Illuminati, Mighty Avengers #1, Young Avengers #1/12, Captain Marvel #1 2014, A-Force #1, Falcon #1, Ironheart #1, World of Wakanda #1, Mockingbird #1, Black Widow #1 2014/2020, Hellcat #1, America Chavez #1, Iceman #1), Star Wars Marvel era (Darth Vader #1/3/5 2015 — Aphra/Triple-Zero/BT-1, Vader #1/3 2017 — Crimson Dawn, Doctor Aphra #1 2016/2020, Bounty Hunters #1, High Republic #1, Star Wars #1 2020), Joker War / Tom King Batman (Batman #1 2011 Snyder, #5/13/21/92/95/100/125, Curse of White Knight, Batman/Catwoman #1, Damned #1, Three Jokers #1, Last Knight on Earth, Detective #1027, Joker #1 2021, Punchline #1, DC Vs Vampires, Batgirls #1, Robins #1, Catwoman #1 2018), modern Justice League (Snyder JL #1, JL Dark v2, Multiversity, Mister Miracle Tom King, Far Sector, Strange Adventures Tom King, WW Dead Earth, Tom Taylor Suicide Squad, Black Adam #1, Wonder Girl #1), Charlton heroes (Captain Atom #78, Blue Beetle #1 1964, Question #1, Peacemaker #1), Vintage westerns/horror (All-Star Western #10 first Jonah Hex, Weird Western Tales #12, Phantom Stranger #1 1969, Spectre #1 1967, Doom Patrol #86, Strange Adventures #205 Deadman, House of Mystery #175 Cain, House of Secrets #81/90 Abel/Eclipso), Vertigo modern (Preacher #5, Y final #60, 100 Bullets #100, Sandman: Overture #1), recent Image (Saga #54 return, I Hate Fairyland #1, Reckless #1, Gunslinger Spawn #1, King Spawn #1, Family Tree, Decorum, Ascender, Once & Future, Stillwater, Made in Korea, Newburn, Murder Falcon, Step by Bloody Step, Two Moons, Kaya, Bone Orchard, Public Domain, I Hate This Place, Twig), Spawn-verse (Sam and Twitch #1, Hellspawn #1, Curse of the Spawn #1), BOOM/Dark Horse/IDW (Mouse Guard, MMPR, Lumberjanes, Wynd, Something Killing Children #15 House of Slaughter, Black Hammer crossovers, B.P.R.D. #1, Buffy Dark Horse, Sonic Archie+IDW, MLP IDW, IDW TMNT #1+#100), more Marvel 2000s+ (MK Spider-Man #1, World War Hulk #1, Punisher MAX #1, Thor: God of Thunder #1/2 first Gorr, Mighty Thor #1 Jane Foster, Unworthy Thor, Earth X #0/Universe X/Paradise X, 1602 #1, Eternals #1 Gaiman/Gillen), modern DC (Action #1006 Bendis, Superman #1 2018 Bendis, Son of Kal-El #1, Superman: Lost, Up in the Sky, Future State Superman/Detective/Next Batman, I Am Batman, Wonder Woman: Historia, Aquaman/Green Arrow/Green Lantern relaunches, New Frontier, Other History of DCU), Vertigo black label (Animal Man N52, Swamp Thing N52), Power Girl debut (All Star #58), Marvel's Voices anthology launches.

**Round 2 (+257 net-new) — second-tier deeper run keys:**
Spider-Man deeper (#15/17/38/39/41/51/75/100/113/134/135/149/161/210/226/248/256/265/287/290/292/294/312/315/317/324/330/345/350/375/400/545/546/583/600/800/900), X-Men deeper (Uncanny #95/96/100/102/104-109/117/122-128/139/140/143/150/155/161/165/166/173/200/205/207/212/213/229/239/251/270/281/300/350; X-Men vol 2 #1/4/5/25/30), Avengers deeper (#29/31/59/66/71/80/89/93/98/100/137/144/162/211/300/400), Hulk deeper (#102/140/162/169/200/347/393), Iron Man (#54/100/120/144/150/225/281), Thor (JIM #97; Thor #126/129/132/134/154/225/339/340), FF deeper (#6/11/57/112/150/232/236/244/265/347/350/371), Daredevil deeper (#8/16/17/200/230/254), Captain America (#112/150/155/180/200/217/337/350/444), Doctor Strange (#169 first solo title; vol 2 #1 1974), Bronze Age (Conan #1/23, Savage Sword #1, Defenders #1, Werewolf by Night #1, Tomb of Dracula #1, Iron Fist #1, Marvel Two-in-One #1, Marvel Team-Up #1, Power Pack #1, Squadron Supreme #1, What If #1), DC Detective (#156/265/439/466/476/500/569/823/871), Batman deeper (#11/16/47/100/121/139/156/200/300/366/407/410/442/475/492/500/680/700), Action/Superman anniversaries (#100/266/300/340/500/654; Superman #100/300/400/423), Adventure (#267/346/352), JLA deeper (#4/22/31/100/200/208), Brave & Bold (#79/85/200), Wonder Woman (#204/288/300), Flash deeper (#106/108/112/117/155/163/175/200/300/350), Green Lantern (#21/40/45/100/172/200), Vertigo/Sandman (Sandman Mystery Theatre #1, Death HCOL #1, Books of Magic #1, Lucifer #1, Hellblazer #27), DC Modern events (Crisis #12, Zero Hour #0, DC One Million #1, Final Night #1, Underworld Unleashed #1, Bloodlines #1, Knightfall #1, Blackest Night #1, Brightest Day #1, Flashpoint #5), Spawn deep cuts (#5/8/10/11/100/200/300), Walking Dead/Saga/Invincible/Chew anniversaries, EC/Mad horror keys (Tales from the Crypt #20, Vault of Horror #12, Weird Fantasy #13, Mad #1).

**Round 1 (+283 net-new) — top canonical seed pass:**
- Added 283 net-new key issues spanning Golden Age (Detective Comics #29/33/38/58/66/359, Marvel Comics #1, Captain America Comics #1, Whiz Comics #2, All-American Comics #16, More Fun Comics #52/53/73/101, Police Comics #1, Adventure Comics #40/48/61/260/283/300, Pep Comics #22, Flash Comics #1/86/104, etc.), Silver Age (Showcase #6/8/17/30/37, Brave and the Bold #25/34/54/60, Mystery in Space #75, Fantastic Four #4/13/17-21/25/36/44/47/51/53/65/66/94, Tales to Astonish #13/35/44/59/62/82, Tales of Suspense #40/48/50/58/59/63, Strange Tales #101/115/126/146, Journey Into Mystery #85/86/112/114, X-Men #5/11/15/17/35/50/54/58/60, Avengers #9/11/25/28/32/55/83, Daredevil #2/10/168, Sgt. Fury #1, Detective Comics #267/298/327/395, Action Comics #276/285, JLA #9/30/35), Bronze Age (Marvel Premiere #1/28, Marvel Spotlight #2/12/32, Special Marvel Edition #15, Iron Fist #14, Captain Marvel #25/27/29, Eternals #2/3/5, Star Wars #1, Transformers #1, G.I. Joe #1/21, House of Secrets #92, Saga of the Swamp Thing #21/37, etc.), Copper Age (Wolverine #1 1988, Marvel Comics Presents #72, Excalibur #1, X-Factor #1, Generation X #1, X-Men #266, Uncanny X-Men #168/171/186/201/210/211/221/248/256/267/268, New Mutants #86, Man of Steel #1, Detective Comics #574/608/647, Action Comics #584/775, Animal Man #1/5, Doom Patrol #19/35, Sandman #2/6/21, Justice League International #1/7, Lobo #1, JLA #1, Kingdom Come #1, Marvels #1, Robin #1 1991), Image/Indie launches (WildC.A.T.s #1, Youngblood #1, Cyberforce #1, ShadowHawk #1, Pitt #1, The Maxx #1, Witchblade #1, The Darkness #1, Gen 13 #1, Stormwatch #1, Astro City #1, The Authority #1, Planetary #1, Hellboy: Seed of Destruction #1, Concrete #1, Stray Bullets #1, Strangers in Paradise #1, Madman #1, Cerebus #1, Love and Rockets #1, Eightball #1, Yummy Fur #1, Hate #1), 2000s+ (Ultimate Spider-Man #1, Ultimate X-Men #1, Ultimates #1, All-New X-Men #1, Hawkeye #1, Captain Marvel #14/17, Star Wars #1 2015, House of X #1, Powers of X #1, Civil War II #1, Invincible Iron Man #1/7/9, Empyre #1, Heroes Reborn #1, Powers #1, Ex Machina #1, American Vampire #1, Wytches #1, Black Hammer #1, Monstress #1, Lazarus #1, Sex Criminals #1, Pretty Deadly #1, Tokyo Ghost #1, Birthright #1, The Boys #1, Manifest Destiny #1, Seven to Eternity #1, Strange Academy #1), DC Modern (Identity Crisis #2, All Star Superman #1, All Star Batman #1, Final Crisis #7, Batman and Robin #1, Batman Incorporated #1/8, Justice League #1 2011, Forever Evil #1, Convergence #1, DC Universe Rebirth #1, Doomsday Clock #1, Heroes in Crisis #1, Batman #1 2016, Batman #50, Detective Comics #1000, Action Comics #1000), Krakoan X-titles (X-Men #1 2019, Marauders #1, Excalibur #1 2019, X-Force #1 2019, Fallen Angels #1, New Mutants #1 2019, S.W.O.R.D. #1).
- Years normalized to series-start convention (e.g. Detective Comics entries all use `year: 1937`, ASM entries all use `year: 1963`).
- Cross-checked + deduped against original 404 entries; resolver ambiguity verified zero.

**Remaining (ongoing — scan-data-driven):**
After Beta has scan volume, build the `npm run keys:gaps` tooling described in the May 5 conversation and run periodic 50-100 issue batches against actual user scans where `comic_metadata.key_info` is empty.

**Cleanup follow-up:** Original DB has duplicate title-spelling variants for `Marvel Super Heroes Secret Wars` vs `Marvel Super-Heroes Secret Wars` (#1 + #8 in both). Title normalization collapses them at lookup time, but the duplicate entries should be merged to one canonical spelling for hygiene. Trivial cleanup, deferred.

**ETL note (relevant to "Pre-populate Top Comics Cache"):** When that BACKLOG item runs the bulk Marvel.com / DC.com scrape, the ETL must layer in `lookupKeyInfo()` from this database so seeded `comic_metadata` rows get the correct `key_info` rather than empty arrays. Adding here as cross-reference; the actual code spec lives under "Pre-populate Top Comics Cache".

---

### Audit Curated Key DB for AI-vs-DB Title-Format Drift (telemetry-driven follow-ups)
**Priority:** Medium (Post-Launch — additional aliases gated on production telemetry)
**Status:** Partially complete — alias mechanism + initial 6 aliases + drift telemetry shipped May 6, 2026 (Session 45). Remaining work is data-driven, not speculative.
**Added:** May 6, 2026
**Updated:** May 6, 2026

**What shipped Session 45 (May 6, 2026):**
- **`aliases?: string[]` field on `KeyComic` interface** (first-class alias support in `keyComicsDatabase.ts`) — map-build registers each entry under canonical AND each alias's normalized title, with dedup so multiple punctuation variants don't create phantom multi-entry ambiguity in `resolveEntry`.
- **6 entries given aliases** — Ultimate Fallout #4 (Miles Morales, PROD-confirmed drift), Tales of Suspense #39 (Iron Man), Journey Into Mystery #83 (Thor), Marvel Premiere #15 (Iron Fist), Marvel Spotlight #5 (Ghost Rider), Strange Tales #110 (Doctor Strange). Pattern: anthology covers where feature-character logo dominates the masthead.
- **`[keyinfo-drift]` telemetry breadcrumb** in `con-mode-lookup/route.ts` — fires `console.warn` when curated DB misses but AI fallback returns key info. Surfaces real drift candidates from production logs (Sentry / Netlify build logs) without storing user data.
- **Audit complete (1,053 entries)** — surfaced 57 colon-subtitled entries, 99 4+ word titles, **82 token-prefix collision pairs**. Conclusion: a fuzzy/token-prefix fallback is unsafe at this scale (Batman alone has 16 collisions; false-positive keyInfo on a $X book is worse than silent miss). Aliases-as-data is the right approach long-term.

**Why fuzzy matching was rejected:** The 82 collision pairs surfaced by the audit (Batman → Batman: White Knight / Batman: Damned / Batman/Catwoman / Batman: Three Jokers; Star Wars → Star Wars: Darth Vader / Doctor Aphra / Bounty Hunters; etc.) make naive "input contains all tokens of canonical" matching dangerous. Wrong keyInfo is more harmful than missing keyInfo for a buying-decision tool.

**Remaining work (post-launch, telemetry-driven):**
1. **Grep production logs weekly for `[keyinfo-drift]` lines** — these are the real drift candidates surfaced by actual scans. Each line includes normalized title + issue + AI's keyInfo response.
2. **For each repeating drift candidate:** verify whether (a) the canonical entry already exists in `keyComicsDatabase.ts` and just needs an alias, or (b) the entry is missing entirely and should be added (different BACKLOG item — "Expand Curated Key Info DB").
3. **Speculative aliases to NOT pre-add without telemetry confirmation:** Hulk #181 → "Wolverine" (collision with Wolverine series #181 if it exists); Saga of the Swamp Thing → "Swamp Thing" (existing duplicate entries already cover the case at #21/#37); first-appearance issues for famous characters (Action #1 → "Superman", Detective #27 → "Batman" — too risky without confirmation that AI actually returns these forms).
4. **Build `npm run keys:audit` tooling later** if telemetry-grep becomes too noisy. Current breadcrumb approach is sufficient at Beta scan volume.

**Why not a synchronous AI canonicalization step:** The `con-mode-lookup` route is in the convention-floor critical path; we cannot afford an extra AI call per scan. Aliases remain zero-cost at lookup time.

**Effort estimate:** ~30 min/quarter for telemetry triage + alias additions. No tooling investment needed at current scale.

**Related:** "Expand Curated Key Info DB" (sibling — adds *new* entries; this entry adds *aliases* to existing entries).

---

### Batch Re-Validation for CSV Imports
**Priority:** Low
**Status:** Pending. **Decision May 6, 2026: auto-on-import (background)** — after CSV import, automatically queue cover validation for missing-cover rows. Fire-and-forget; user gets a notification when done. No manual button needed.
**Added:** Mar 20, 2026

Build a batch re-validation endpoint for CSV-imported comics with missing covers. Allows users to trigger cover validation for entire import batches without requiring individual scans, respecting Gemini rate limits.

---

### Durable eBay Price Cache in Supabase
**Priority:** Medium
**Status:** Pending
**Added:** Apr 5, 2026

Store eBay pricing results in Supabase with a timestamp. Before hitting the eBay API, check if a price exists that's less than 7 days old. Reduces eBay API calls, speeds up scans for popular books, and lowers costs. Requires new table (title, issue, grade, slabbed, price data, fetched_at), lookup logic in the scan pipeline, and a staleness threshold (suggested 7 days).

---

### User-Configurable Default Collection Sort
**Priority:** Low
**Status:** Pending. **Decision May 6, 2026: per-list preference** — each list (Want List, For Sale, etc.) remembers its own default sort.
**Added:** Apr 5, 2026

Let users choose their preferred default sort method for the collection page (date added, title, issue, grade, value). Save preference in user settings. Currently defaults to date added (most recent first).

---

### Diagnostic Scripts Cleanup (Move or Document)
**Priority:** Low (post-launch hygiene)
**Status:** Pending
**Added:** May 6, 2026 (Session 45b)

Three Session 45b diagnostic scripts are committed at the top level of `scripts/` but are one-off / debugging tools, not part of any cron or build pipeline:
- `scripts/inspect-ultimate-fallout-cache.ts`
- `scripts/debug-key-hunt-flow.ts`
- `scripts/debug-notification-prefs.ts`

Two clean-up options:
1. Move them to `scripts/diagnostics/` so the top-level `scripts/` directory only contains scripts referenced from `package.json` or active cron jobs.
2. Add a "Diagnostic / one-off scripts" section to `CLAUDE.md` listing them with a one-line purpose each, so future sessions know they're non-production.

Either approach is fine. Trivial cleanup, no user impact.

---

### Stale Key Hunt History Entries Pre-May-6 Deploy (No keyInfo Chip)
**Priority:** Low (natural attrition over 30-day TTL)
**Status:** Pending
**Added:** May 6, 2026 (Session 45b)

Key Hunt history entries saved before the Session 45b May 6 deploy were stored without `keyInfo` (the field wasn't being persisted). Those rows will continue to render without a key chip until they fall off via the 30-day TTL.

Two options if user feedback materializes:
1. **Backfill migration script** — re-run `lookupKeyInfo()` for each pre-May-6 history row and patch the chip in.
2. **One-time banner** — "Recent scans without key info — clear & re-scan to refresh" displayed once on Key Hunt history.

Recommended: do nothing. Natural attrition over 30 days resolves it without any work. Revisit only if multiple users complain.

---

### PWA iOS Splash Screen Verification (Post-Session-46 Deploy)
**Priority:** Low (verification, not implementation)
**Status:** Pending
**Added:** May 6, 2026 (Session 45b)

Session 45b shipped `apple-touch-startup-image` link tags in `src/app/layout.tsx` for 5 iPhone form factors. User noted the iOS splash loads too fast to see during testing. Confirm the splash actually renders post-deploy:
- Add to Home Screen on a physical iPhone after deploy
- Cold-launch the PWA from the home screen icon
- Confirm the pop-blue (`#0066FF`) splash with logo appears between launch and first paint

If the splash doesn't render, debug the `media` query selectors (resolution + orientation match) and verify the asset files actually deployed to `/icons/`. ~15 min verification once deploy lands.

**Related:** Native App Splash Screen (separate entry — covers the Capacitor wiring for native shells).

---

### Apify GoCollect Scraper — Deferred Evaluation
**Priority:** Low (Future — fallback if PriceCharting doesn't pan out)
**Status:** Pending — only evaluate if PriceCharting subscription is rejected or proves insufficient
**Added:** May 6, 2026 (Session 45b)

Listed in `docs/DATA_PARTNERS.md` as a possible alternative pricing data source. Apify's GoCollect actor scrapes GoCollect public pages for FMV data — could fill the sold-listing-pricing gap if PriceCharting falls through.

**Why deferred:**
- PriceCharting is the preferred path (verified vendor, official API, no scraping legality questions, documented in `docs/PRICECHARTING_PROPOSAL.md`).
- Apify scraping carries TOS risk + reliability risk (GoCollect may break the scrape at any time).
- Only evaluate if Aponte rejects the PriceCharting subscription OR PriceCharting data quality proves inadequate post-integration.

**Related:** PriceCharting Integration (Pre-Launch entry above — primary path); `docs/DATA_PARTNERS.md`.

---

### `comic_metadata` Write Path — Defensive Comment in db.ts:235
**Priority:** Low (documentation only, no behavior change)
**Status:** Pending
**Added:** May 6, 2026 (Session 45b)

Currently SAFE: writes to the shared `comic_metadata` cache table do NOT touch a user's `comics` row, so user-uploaded collection covers are never overwritten by a metadata cache update. Session 45b audit confirmed this.

However, the rule isn't documented in code. Add a short comment block at `src/lib/db.ts:235` (the `comic_metadata` write site) explaining: "This table is the SHARED cache layer. User-collection-photo writes go to `comics.cover_image` — never touch that field from this code path." Prevents a future contributor from accidentally bridging the two write paths.

Tiny task. ~5 minutes.

