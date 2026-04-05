# Collectors Chest Backlog

## Security - Critical Priority

### Add Rate Limiting to Quick Lookup API
**Priority:** Critical
**Status:** ✅ Complete (Jan 26, 2026)
**File:** `src/app/api/quick-lookup/route.ts`

Added rate limiting (20 requests/min) to protect Anthropic API costs.

---

### Add Rate Limiting & Email Verification to Email Capture API
**Priority:** Critical
**Status:** ✅ Complete (Jan 26, 2026)
**Files:**
- `src/app/api/email-capture/route.ts` - Rate limiting + verification flow
- `src/app/api/email-capture/verify/route.ts` - Verification endpoint
- `src/lib/emailValidation.ts` - MX validation + disposable email detection
- `supabase/migrations/20260126_bonus_scan_claims.sql` - Database schema

**Protections Implemented:**
- Rate limiting (5 requests/min per IP)
- Email verification required before granting bonus scans
- IP tracking to prevent multiple claims per device
- MX record validation to reject invalid domains
- Disposable email blocking
- Honeypot field to catch bots

---

### Fix Verification Email Branding
**Priority:** High
**Status:** ✅ Complete (Feb 13, 2026)
**Added:** Feb 4, 2026

Verified all email templates already use correct "Collectors Chest" branding. No "Collector's Catalog" references remain in code.

---

## Design Review

### Unique Visual Identity
**Priority:** Medium
**Status:** ✅ Complete (Jan 23, 2026)

Implemented Lichtenstein pop-art design theme with distinct visual identity.

**Features Implemented:**
- Pop-art color palette with bold primary colors
- Comic-inspired halftone patterns and Ben-Day dots
- Speech bubble elements and panel-style layouts
- Custom card designs for comics
- Cohesive brand personality throughout UI

**Design Branches Created:**
- `design/pop-art-lichtenstein` ✅ (merged to main)
- `design/retro-futuristic` (alternative option)
- `design/vintage-newsprint` (alternative option)

### Color Palette Refinement
**Priority:** Low
**Status:** ✅ Closed (Feb 18, 2026) — Decided to keep current Lichtenstein pop-art palette. Red & Black alternative was considered but current colorful design better fits the brand.

---

## Pre-Launch Checklist

### Set Up the Business
**Priority:** Critical
**Status:** ✅ Complete (Apr 2, 2026)

Complete business formation and financial infrastructure before public launch.

**Why It's Important:**
- Marketplace handles money between users - higher liability risk
- Protects personal assets from potential lawsuits
- Required for professional ToS & Privacy Policy
- Enables proper Stripe setup with business verification

**Steps (in order):**

| Step | Task | Time | Notes |
|------|------|------|-------|
| 1 | ✅ **Form LLC** | 30 min + 1-7 days processing | ZenBusiness, LegalZoom, or state website ($50-500) |
| 2 | ✅ **Get EIN** | 10 min (instant) | IRS.gov - free, requires LLC first |
| 3 | ✅ **Open Business Bank Account** | 1-2 hours | Requires LLC docs + EIN, get business debit card |
| 4 | ✅ **Set Up Stripe** | 30 min | Use business name, EIN, bank account |
| 5 | ✅ **Update Payment Methods** | 30 min | Netlify, Stripe, Anthropic, Upstash updated (Apr 2, 2026) |

**Step 4 - Stripe Configuration Details:**

Create these products in Stripe Dashboard → Products:

| Product | Price | Type | Notes |
|---------|-------|------|-------|
| Premium Monthly | $4.99/month | Recurring | 7-day free trial enabled |
| Premium Annual | $49.99/year | Recurring | 7-day free trial enabled |
| Scan Pack (10 scans) | $1.99 | One-time | For free users who hit limit |

Environment variables to add (`.env.local` AND Netlify):
```
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_PRICE_PREMIUM_MONTHLY=price_xxx
STRIPE_PRICE_PREMIUM_ANNUAL=price_xxx
STRIPE_PRICE_SCAN_PACK=price_xxx
```

Configure webhook at `https://collectors-chest.com/api/webhooks/stripe` for events:
- `checkout.session.completed`, `checkout.session.expired`
- `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- `invoice.payment_succeeded`, `invoice.payment_failed`

**Step 5 - Services to Update:**

| Service | Cost | Dashboard |
|---------|------|-----------|
| Netlify | $9/mo | [app.netlify.com](https://app.netlify.com) → Billing |
| Domain | $13.99/yr | Via Netlify |
| Anthropic | ~$0.015/scan | [console.anthropic.com](https://console.anthropic.com) → Billing |
| ~~GoCollect~~ | ~~$9/mo~~ | Cancelled — API program discontinued (Feb 2026) |

**Estimated Total Cost:** $100-300 filing + ~$30/mo ongoing services
**Estimated Time:** ~2 weeks (mostly waiting for LLC processing)

**Blocks:**
- Privacy Policy & Terms of Service (need business name)
- Live subscription billing
- Marketplace payments

---

### Finalize Legal Pages (Placeholder Replacement)
**Priority:** Critical
**Status:** ✅ Complete (Mar 13, 2026)
**Added:** Feb 18, 2026

All four legal pages (Terms of Service, Privacy Policy, Acceptable Use Policy, Cookie & Tracking Policy) are deployed with placeholder fields that must be updated once the business is formed and Stripe is configured.

**Placeholders to Replace:**

| Placeholder | Replace With | Source |
|-------------|-------------|--------|
| `[LEGAL BUSINESS NAME]` | LLC name | LLC filing |
| `[ADDRESS]` | Business address | LLC filing |
| `[SUPPORT EMAIL]` | Support email (e.g., support@collectors-chest.com) | Create email alias |
| `[DATE]` | Effective date (launch day or when finalized) | Set at launch |
| `[STATE]` | State of LLC incorporation | LLC filing |
| `[STATE/COUNTY]` | Arbitration venue (state + county) | LLC filing |

**Pages to Update:**
- `/privacy` - Privacy Policy
- `/terms` - Terms of Service
- `/acceptable-use` - Acceptable Use Policy
- `/cookies` - Cookie & Tracking Policy

**Additional Steps:**
1. Replace all placeholders across all 4 pages
2. Set the effective date to the day of public launch
3. Implement the 3-listing cap enforcement for free users (referenced in ToS but not yet in code)
4. Set up Stripe Connect and verify seller payout flow described in ToS Section 4.5
5. Consider attorney review once revenue allows (cheaper to review/refine than draft from scratch)
6. Add age verification gate for marketplace (18+ requirement referenced in ToS Section 1)

**Blocks:** LLC formation, Stripe account setup, Stripe Connect configuration

---

### Free Trial Not Working
**Priority:** High
**Status:** ✅ Complete (Jan 24, 2026)

Fixed free trial functionality to work without Stripe configuration.

**Solution:**
- Created `/api/billing/start-trial` endpoint that directly starts a 7-day trial
- Added `startFreeTrial()` method to `useSubscription` hook
- Updated UI components (ScanLimitBanner, UpgradeModal, FeatureGate, pricing page) to try direct trial first, then fall back to Stripe checkout
- Trial sets `subscription_status: "trialing"` and `trial_ends_at` in database
- Premium features (Key Hunt, CSV Export, Stats, etc.) now accessible during trial

**Files Added:**
- `src/app/api/billing/start-trial/route.ts`

**Files Modified:**
- `src/hooks/useSubscription.ts` - Added `startFreeTrial` action
- `src/components/ScanLimitBanner.tsx` - Uses direct trial
- `src/components/UpgradeModal.tsx` - Uses direct trial
- `src/components/FeatureGate.tsx` - Uses direct trial
- `src/app/pricing/page.tsx` - Uses direct trial

---

### Cost Monitoring & API Optimization
**Priority:** High
**Status:** ✅ Complete (Feb 19, 2026)

Three-layer cost monitoring and API spend reduction system.

**Layer 1 — Metadata Cache (cost reduction):**
- Dual-layer cache (Redis 7-day + Supabase permanent) in analyze route
- Wired existing `comic_metadata` table + `cache.ts` infrastructure (previously unused)
- Fill-only merge: cached values populate empty fields, never overwrite AI results
- Estimated 40-60% reduction in Anthropic API calls for repeat scans

**Layer 2 — Admin Alert Badge (in-app visibility):**
- Lightweight `GET /api/admin/usage/alert-status` endpoint with 5-min Redis cache
- `AdminAlertBadge` component with dot/count variants (60s polling)
- Wired into admin layout (Usage tab), desktop nav, and mobile nav

**Layer 3 — Server-Side PostHog (passive monitoring):**
- Installed `posthog-node` for serverless-optimized server-side tracking
- `analyticsServer.ts` with `trackScanServer()` + `estimateScanCostCents()`
- Instrumented analyze route with timing, AI call counting, cache hit tracking, cost estimation
- PostHog dashboard + email alerts configured manually post-implementation

**Additional:** Set Anthropic dashboard monthly spending cap ($100)

**Files Created:**
- `src/lib/metadataCache.ts`, `src/lib/alertBadgeHelpers.ts`, `src/lib/analyticsServer.ts`
- `src/components/AdminAlertBadge.tsx`
- `src/app/api/admin/usage/alert-status/route.ts`
- Tests: `metadataCache.test.ts`, `alertBadgeHelpers.test.ts`, `analyticsServer.test.ts` (18 new tests)

**Files Modified:**
- `src/app/api/analyze/route.ts` — cache lookup, save, PostHog instrumentation
- `src/app/admin/layout.tsx`, `src/components/Navigation.tsx`, `src/components/MobileNav.tsx` — badge wiring

---

### Reactivate Sentry Error Tracking
**Priority:** High
**Status:** ✅ Complete (Feb 19, 2026)

Reactivated on free Developer plan (5K errors/month). Added SENTRY_DSN and NEXT_PUBLIC_SENTRY_DSN to Netlify environment variables.

**What Sentry Provides:**
- Error tracking and alerts
- Performance monitoring (10% sample rate)
- Session replay on errors (helps reproduce bugs)

**Current State:**
- Sentry is integrated and configured in codebase
- Only enabled in production (`NODE_ENV === "production"`)
- Active on free Developer plan (5K errors/month)

**Files:**
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`

---

### Re-enable Live Hottest Books API
**Priority:** High
**Status:** ✅ Complete (Jan 28, 2026)
**File:** `src/app/api/hottest-books/route.ts`

The `USE_STATIC_LIST` flag has been removed. The API now:
- Fetches hot books from the `hot_books` database table
- Uses eBay Finding API for real-time price data
- Caches results with 24-hour TTL via Redis
- Falls back gracefully when price data is unavailable

---

## Bugs

### Title Autocomplete Returns Empty Suggestions
**Priority:** High
**Status:** ✅ Complete (Feb 18, 2026)
**Added:** Feb 18, 2026

Root cause: deprecated model ID (`claude-haiku-3-5-20241022`) returning 404, then incorrect alias (`claude-haiku-4-5-latest`). Fixed by centralizing all model IDs in `src/lib/models.ts` and pinning `MODEL_LIGHTWEIGHT` to `claude-haiku-4-5-20251001`. Any stale Redis cached empties will expire via TTL.

---

### "More" Dropdown Highlights "Lists" When on Collection Page
**Priority:** Low
**Status:** ✅ Complete (Feb 18, 2026)
**Added:** Feb 18, 2026

The "More" dropdown menu in the top nav incorrectly highlights "Lists" with a yellow background when the user is on the `/collection` page. Lists is not the active page and should not be highlighted.

**Steps to Reproduce:**
1. Navigate to `/collection`
2. Click "... More" in the top nav
3. "Lists" is highlighted yellow as if it's the active item

**Expected:** No item in the dropdown should be highlighted, or "Collection" in the main nav should be the only active indicator.

**File to Investigate:**
- `src/components/Navigation.tsx` — active route matching logic for the More dropdown

---

### Comic Details Not Refreshing When Issue Number Changes
**Priority:** High
**Status:** ✅ Complete (Feb 18, 2026)
**Added:** Feb 18, 2026

Root cause: related to model ID issues causing API failures. Resolved after centralizing model configuration in `src/lib/models.ts`.

---

## Pending Enhancements

### Evaluate Gemini API Costs
**Priority:** Low
**Status:** ✅ Evaluated (Mar 25, 2026)

Evaluated Gemini vs Anthropic costs for cover recognition at scale.

**Key Findings:**
- Gemini 2.0 Flash: ~0.4¢/scan (primary provider)
- Anthropic Claude: ~2.1¢/scan (fallback only)
- Gemini free tier: 1,500 requests/day (~45K/month)
- At 1,000 users × 50 scans = 50K scans/month → ~$200/mo on paid Gemini tier
- Current low volume comfortably fits within free tier

**Monitoring in place:**
- Scan analytics table with per-scan provider/cost tracking
- Admin dashboard (/admin/usage) with daily/weekly/monthly spend
- Email alerts at $3/day and $15/week thresholds
- PostHog provider usage events

**Action item (future):** Add daily Gemini request counter with alerts at 80% (1,200) and 90% (1,350) of free tier limit. Not urgent until volume increases.

---


### Re-price Existing Collection Comics
**Priority:** Medium
**Status:** ✅ Complete (Apr 2, 2026)
**Added:** Mar 19, 2026

After Browse API migration, existing comics show no price until re-looked up. Need an on-demand or batch refresh mechanism to reprice books already in users' collections without requiring manual re-scans.

**Note:** Stale prices were from dead Finding API tied to Development Clerk instance (test data only). New scans use eBay Browse API correctly. No action needed.

---

### Cover Validation: Test Coverage for Error Paths
**Priority:** Medium
**Status:** Pending
**Added:** Mar 20, 2026

Add test coverage for Gemini API error paths: NO/error/rate-limit/ambiguous response handling. Tests should verify graceful degradation and proper fallback behavior when Gemini returns non-200 status codes or ambiguous classifications.

---

### Cover Validation: Distinguish "No Cover" from "Unavailable"
**Priority:** Medium
**Status:** Pending
**Added:** Mar 20, 2026

Add `validated` boolean to `CoverPipelineResult` to distinguish between "no cover found" (user/system action) vs "Gemini unavailable" (transient service issue). This enables smarter client-side UI decisions and re-validation retries.

---

### Per-Event Promo Tracking
**Priority:** Medium
**Status:** ✅ Closed (Apr 2, 2026)
**Added:** Mar 26, 2026

Add `?ref=heroescon` (or similar) query param support to `/join/trial` so convention-specific QR codes can be tracked separately in analytics. Log the ref param to PostHog on page load and associate it with the resulting signup.

> Not needed. Using a single QR code and /join/trial link across all conventions. No plans for per-event tracking at this time.

---

### Per-Event Promo Codes
**Priority:** Medium
**Status:** ✅ Closed (Apr 2, 2026)
**Added:** Mar 26, 2026

Build a `/join/[code]` dynamic route backed by a DB table of promo configs. Each code can define trial length, price, messaging, and expiry date. Enables distinct QR codes per convention without code changes.

> Not needed. Single static QR code for all events. Dynamic promo codes would require a QR code generation service. Revisit only if running different offers at different events.

---

### Welcome Toast for Promo Users
**Priority:** Medium
**Status:** ✅ Complete (Mar 30, 2026)
**Added:** Mar 26, 2026

On `/collection?welcome=promo`, show a dismissible toast or banner: "Your 30-day trial is active!" to confirm the promo checkout succeeded and orient new users.

> Implemented in commit 7946a72. Toast displays on /collection?welcome=promo after promo trial checkout.

---

### Trial Expiration Reminder Email
**Priority:** Medium
**Status:** ✅ Complete (Apr 1, 2026)
**Added:** Mar 26, 2026

Send an automated email a few days before the 30-day promo trial ends reminding users their trial is expiring and prompting them to keep their subscription active. Use Resend + a Supabase-triggered or cron-based job.

> Implemented with pop-art branded email template (TICK TOCK! sound effect), Netlify scheduled function (daily 9 AM Eastern), idempotency guard, and DB migration for trial_reminder_sent_at.

---

### Replace PNG Logo with SVG Version
**Priority:** Medium
**Status:** ✅ Complete (Apr 2, 2026)
**Added:** Mar 27, 2026

ChestIcon component currently uses a PNG (`/icons/icon-512x512.png`) via an `<img>` tag. Once the SVG version of the new Collectors Chest emblem is available (user will provide from Illustrator), convert ChestIcon.tsx back to inline SVG for sharper rendering at all sizes. Also replace `public/favicon.png` with an SVG favicon.

> Clean transparent PNG emblem deployed across all icon touchpoints (ChestIcon, favicon, PWA icons, maskable icons). White pixel artifacts cleaned. iOS Safari text-stroke fix applied.

---

### Auto-Harvest Cover Images from Graded Book Scans
**Priority:** High
**Status:** Code Complete — awaiting manual integration test
**Added:** Feb 26, 2026

Implementation complete (9 code tasks done, 532 tests passing). All cover harvesting logic, image processing, validation, and database integration in place. Ready for manual integration testing with slabbed comic scans to verify end-to-end workflow.

**Design doc:** `docs/plans/2026-02-25-cover-image-harvesting-design.md`
**Implementation Plan:** `docs/superpowers/plans/2026-04-02-cover-image-harvesting.md`

---

### Admin: Remove Incorrect Key Info from Books
**Priority:** High
**Status:** ✅ Complete (Feb 13, 2026)

Implemented two-part solution:
1. **Custom key info sandboxing** - User-added custom key info only shows publicly when admin-approved (status: pending → approved/rejected)
2. **Admin CRUD for key_comics database** - Full search, create, edit, delete for the global key comics database
3. **Unified admin review tab** - Consolidated two separate approval flows into single "Review" tab with source badges

**Design Document:** `docs/plans/2026-02-13-admin-key-info-management-design.md`

**Key Files:**
- `src/lib/keyInfoHelpers.ts` - filterCustomKeyInfoForPublic helper
- `src/lib/keyComicsDb.ts` - CRUD functions for key_comics
- `src/app/api/admin/key-comics/` - Admin CRUD API routes
- `src/app/admin/key-info/page.tsx` - Unified Review + Database tabs

---

### Peer-to-Peer Messaging
**Priority:** Medium
**Status:** ✅ Complete (Jan 27-28, 2026)

Direct messaging between users to facilitate communication around purchases and trades.

**All Phases Complete:**
- Phase 1: Core messaging (conversations, messages, inbox page)
- Phase 2: Rich content (images via Supabase Storage) + entry points + unread badge in nav
- Phase 3: Block & report functionality + content filters
- Phase 4: Notification preferences (email toggles in settings)
- Phase 5: Real-time messaging via Supabase Realtime
- Phase 6: Admin moderation dashboard + auto-flagging
- Phase 7: AI-assisted moderation (scam/spam detection via Claude)

**Design Document:** `docs/plans/2026-01-27-peer-to-peer-messaging-design.md`

**Key Files:**
- `supabase/migrations/20260127_messaging*.sql` (multiple migrations)
- `src/types/messaging.ts`
- `src/lib/messagingDb.ts`
- `src/app/api/messages/` (routes for conversations, images, reports)
- `src/components/messaging/` (7 components)
- `src/app/messages/page.tsx`
- `src/app/settings/notifications/page.tsx`
- `src/app/admin/moderation/page.tsx`

---

### Customizable Initial Message
**Priority:** Low
**Status:** Pending
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

### Evaluate Dynamsoft Barcode Reader SDK
**Priority:** Low
**Status:** ✅ Closed (Feb 19, 2026) — Premature until barcode catalog reaches 5,000+ verified entries. Revisit post-launch.
**Added:** Feb 4, 2026

Evaluate upgrading from html5-qrcode to Dynamsoft Barcode Reader for more reliable barcode scanning, especially for UPC/EAN supplemental (add-on) codes.

**Why Consider:**
- Actively maintained with professional support
- Explicit, documented support for 5-digit add-on codes
- Enterprise-grade reliability
- Clean API: just set `EnableAddOnCode = 1`

**Considerations:**
- Cost: ~$1,249+/year (custom pricing, contact sales)
- 30-day free trial available
- May be overkill if html5-qrcode works well enough

**Resources:**
- [Dynamsoft EAN/UPC Add-On Tutorial](https://www.dynamsoft.com/codepool/scan-ean-upc-and-its-add-on-javascript.html)
- [Pricing Page](https://www.dynamsoft.com/store/dynamsoft-barcode-reader/)

---

### Pre-Seed Barcode Database
**Priority:** Medium
**Status:** ✅ Closed (Feb 19, 2026) — External APIs are not viable. Moving forward with proprietary crowd-sourced catalog.
**Added:** Feb 4, 2026

**Why Closed:**
No reliable external UPC-to-comic API exists. Comic Vine returns 1.1M wildcard results instead of exact matches. Metron.cloud was unreliable (server down). comiccover.org offline. UPCitemdb has zero comic data. Pre-seeding from external sources is a dead end.

**Current Approach:** Proprietary barcode catalog built from user scans. Claude extracts barcodes during cover analysis, stores in `barcode_catalog` table with confidence scoring and admin review. Dedicated barcode scanner will be re-enabled once catalog reaches 5,000+ verified entries. See "Re-introduce Dedicated Barcode Scanning" backlog item for re-enablement criteria.

---

### Barcode Detection in Cover Image Analysis
**Priority:** Medium
**Status:** ✅ Complete (Feb 4, 2026)
**Added:** Feb 4, 2026

When analyzing a cover image, if a barcode is visible in the photo, detect and use it first for faster lookup. Barcode database queries are much faster than Claude Vision analysis.

**Implementation:**
- Modified Claude prompt to extract `barcodeNumber` (12-17 digit UPC) if visible in image
- Barcode data stored in crowd-sourced `barcode_catalog` table
- Low/medium confidence detections go to admin review queue
- High confidence detections auto-approved

**Benefits:**
- Building a proprietary barcode database over time
- Faster results when barcode is visible (catalog lookups are instant)
- More accurate identification (barcode is definitive vs AI interpretation)

**Files Modified:**
- `src/app/api/analyze/route.ts` - Added barcode detection to prompt
- `src/lib/db.ts` - Added `catalogBarcode` function
- `src/types/comic.ts` - Added `BarcodeData` interface

---

### Re-introduce Dedicated Barcode Scanning
**Priority:** Low
**Status:** Pending (Blocked)
**Added:** Feb 4, 2026
**Blocked:** Requires a barcode database to be set up first before this feature can proceed.

Re-enable dedicated barcode scanning feature once the crowd-sourced barcode catalog has sufficient data to provide reliable lookups.

**Context:**
The dedicated barcode scanner was removed on Feb 4, 2026 because:
- Comic Vine API returns garbage data for UPC queries (1.1M wildcard results)
- Metron.cloud has exact UPC matching but server was down
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

### Track Sale Price When Marking Book as Sold
**Priority:** Medium
**Status:** ✅ Complete (Jan 27, 2026)

Track sale prices when marking books as sold, with support for both manual sales and platform marketplace sales.

**Features Implemented:**
- "Mark as Sold" button now available for ALL comics (not just those marked "For Sale")
- Sale price prompt with profit/loss preview
- Platform sales (auctions, buy-now, accepted offers) auto-record via Stripe webhook
- New Sales History page at `/sales` with:
  - Summary cards: total sales, total profit, average profit
  - Sales table with comic info, cost, sale price, profit, date
  - Mobile-responsive design with expandable details
  - Cover image thumbnails
- "Sales" button added to collection page header

**Files Added:**
- `src/app/sales/page.tsx` - Sales History page

**Files Modified:**
- `src/components/ComicDetailModal.tsx` - Show "Mark as Sold" for all comics
- `src/app/api/webhooks/stripe/route.ts` - Auto-record platform sales
- `src/app/collection/page.tsx` - Added Sales navigation button

---

### Auction Cancellation Policy (Books with Bids)
**Priority:** Medium
**Status:** ✅ Complete (Jan 27, 2026)

Implemented comprehensive auction cancellation policy with code enforcement.

**Policy Implemented:**
- Auctions with bids CANNOT be cancelled (enforced in code)
- Auctions without bids CAN be cancelled
- Fixed-price listings CAN be cancelled (offer-makers notified)
- Duplicate listings are PREVENTED (same comic can't have multiple active listings)

**Changes Made:**

1. **Terms of Service** (`src/app/terms/page.tsx`):
   - Added Section 4.5 "Listing Cancellation Policy"
   - Documents all cancellation rules
   - Warns of reputation impact for bad-faith cancellations

2. **Offer Notifications** (`src/lib/auctionDb.ts`):
   - When fixed-price listing is cancelled, all pending offers are auto-rejected
   - Offer-makers receive "listing_cancelled" notification
   - Added new notification type to `src/types/auction.ts`

3. **Duplicate Listing Prevention** (`src/lib/auctionDb.ts`):
   - Added `hasActiveListing()` helper function
   - Both `createAuction` and `createFixedPriceListing` check for existing listings
   - Returns user-friendly error if comic already listed
   - API returns 400 status for duplicate attempts

---

### Book Trading Feature
**Priority:** Medium
**Status:** ✅ Complete (Jan 28, 2026)

Allow two users to agree to exchange books directly without money changing hands.

**All Phases Complete:**
- Phase 1: Foundation (`for_trade` column, trades/trade_items tables, For Trade toggle, Shop tab)
- Phase 2: Trade Workflow (propose, accept, decline, ship, confirm receipt, ownership swap)
- Phase 3: Matching System (Hunt List integration, quality scoring, matches tab)
- Phase 4: Polish & Integration (navigation, filters, "X users want this" badges, auto-removal from Hunt List)

**Design Document:** `docs/plans/2026-01-28-book-trading-design.md`

**Key Files:**
- `supabase/migrations/20260128_trading_phase1.sql`
- `supabase/migrations/20260128_trading_phase3_matching.sql`
- `src/types/trade.ts`
- `src/lib/tradingDb.ts`
- `src/app/api/trades/` (routes for trades, matches)
- `src/app/api/comics/[id]/for-trade/route.ts`
- `src/components/trading/` (TradeCard, TradeMatchCard, TradeProposalModal, TradeableComicCard)
- `src/app/trades/page.tsx`

**Legal/TOS Requirements (to add before launch):**
- Terms of Service must clearly state Collectors Chest is NOT responsible for trades
- Users trade at their own risk
- Platform facilitates connection only, not the transaction itself

---

### Username System for Privacy
**Priority:** Medium
**Status:** ✅ Complete (Jan 17, 2026)

Added username system so sellers can display @username instead of email or real name.

**Implementation:**
- Username validation: 3-20 chars, lowercase, letters/numbers/underscores
- Built-in profanity filter with leetspeak detection (catches @ss, sh1t, etc.)
- Reserved username blocking (admin, support, system, etc.)
- Real-time availability checking with debounce
- Profile Settings UI for setting username
- Seller badges display @username in marketplace

**Files:**
- `src/lib/usernameValidation.ts` - Validation utility
- `src/app/api/username/route.ts` - Check/set API
- `src/components/UsernameSettings.tsx` - Profile UI
- `supabase/migrations/20260117_add_username.sql` - DB migration

---

### User Profile Location
**Priority:** Medium
**Status:** ✅ Complete (Jan 28, 2026)

Add location field to user profiles so collectors can see where books are located when browsing the marketplace or viewing collections.

**Features Implemented:**
- Location fields added to profiles (city, state, country - all optional)
- Privacy control: full, state_country, country_only, or hidden
- Location section in Profile settings (CustomProfilePage)
- LocationBadge component for displaying location (respects privacy)
- Location shown on tradeable comic cards in Shop

**Key Files:**
- `supabase/migrations/20260128_user_location.sql`
- `src/app/api/location/route.ts`
- `src/components/LocationBadge.tsx`
- `src/components/CustomProfilePage.tsx` (updated)
- `src/components/trading/TradeableComicCard.tsx` (updated)
- `src/app/api/trades/available/route.ts` (updated)

---

### Migrate to Next.js Image Component
**Priority:** Medium
**Status:** ✅ Complete (Jan 2026)

Migrated to Next.js `<Image>` component across 15+ components for automatic image optimization, lazy loading, and better Core Web Vitals.

**Files Updated:**
- `src/components/ComicDetailModal.tsx`
- `src/components/ComicDetailsForm.tsx`
- `src/components/ComicImage.tsx`
- `src/components/LiveCameraCapture.tsx`
- `src/components/ImageUpload.tsx`
- `src/components/auction/` components
- And more...

---

### Image Optimization & Resizing
**Priority:** Medium
**Status:** ✅ Complete (Jan 17, 2026)

Implemented client-side image compression to prevent oversized images and reduce storage costs.

**Implementation:**
- Client-side compression targeting 400KB (down from 1.5MB average)
- Created `src/lib/imageOptimization.ts` utility
- Integrated into `ImageUpload.tsx` and `LiveCameraCapture.tsx` components
- Maintains quality while reducing file size by 70-90%

---

### Project Cost Tracking Dashboard
**Priority:** Low
**Status:** ✅ Complete (Jan 28, 2026)

Unified view of all project costs tracked in CLAUDE.md (Option 1 - Simple approach).

**Implementation:**
- All costs documented in CLAUDE.md "Services & Infrastructure" → "Project Costs" section
- Fixed costs, variable costs, and free tier limits all tracked
- Close Up Shop skill (Phase 4c) ensures costs stay updated when new services are added

**Costs Tracked:**
- Fixed: Netlify ($9/mo), ~~GoCollect ($89/yr)~~ (cancelled - discontinued), Domain ($13.99/yr)
- Variable: Anthropic API (~$0.015/scan), Stripe (2.9% + $0.30)
- Free tiers: Supabase, Clerk, Upstash, Resend, PostHog, Sentry

---

### ~~GoCollect API Integration~~ — CANCELLED
**Priority:** ~~High~~ N/A
**Status:** Cancelled - Program Discontinued (Feb 27, 2026)

~~Integrate GoCollect API for accurate, market-based pricing data.~~

**Cancellation Reason:** GoCollect has discontinued their API program. API access is no longer available to new or existing integrators. Pricing will continue to rely on eBay sales data + AI estimates.

**Original plan (for reference):**
- AI price estimates → Real FMV from 600K+ tracked sales
- AI/static hot books → GoCollect Hot 50 (market-driven)
- No price trends → 30/90/365-day trend indicators
- Tier: Pro ($89/yr annual plan), 100 calls/day

---

### ~~Marvel API Integration~~ — CANCELLED
**Priority:** ~~High~~ N/A
**Status:** Cancelled - Program Discontinued (Feb 27, 2026)

~~Integrate Marvel API for accurate comic metadata and high-quality cover images on Marvel titles.~~

**Cancellation Reason:** Marvel has deprecated their Developer program and is no longer granting API access. The developer portal is shut down and no new keys are being issued.

**Original plan (for reference):**
- High-resolution cover images, accurate creator credits, character appearance data
- Free tier, 3K calls/day, MD5 hash auth
- Would have covered Marvel titles only (no DC, Image, indie)

**Alternative approach:** Comic metadata and covers continue to use community cover DB + Open Library API + AI recognition.

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

### Set up Scheduled Functions for Cron Jobs
**Priority:** Medium
**Status:** Pending (Mar 3, 2026)
**Related:** Finish Scan Resilience: Multi-Provider Fallback

Configure scheduled jobs for recurring cron tasks.

> Already using Netlify Scheduled Functions (not EasyCron). check-usage-alerts and send-trial-reminders are configured. Remaining: determine if other cron routes (process-auctions, reset-scans, moderate-messages, send-feedback-reminders) need Netlify scheduled function wrappers.

---

### Sales Flow - Use Actual Transaction Price
**Priority:** High
**Status:** ✅ Complete (Jan 28, 2026)

Stripe Connect integration automatically records actual transaction amounts:
- Auction sales: Uses `winning_bid` from completed auction
- Fixed-price sales: Uses the listing price at checkout
- Manual sales: User enters actual sale price via "Mark as Sold" prompt
- All transactions recorded via Stripe webhook (`/api/webhooks/stripe/route.ts`)

---

### Custom SVG Icons & Branding
**Priority:** High
**Status:** ✅ Complete (Jan 26, 2026)

Custom branding implemented as part of the Lichtenstein pop-art design system.

**Implemented:**
- Custom treasure chest icon for header logo and favicon
- Favicon set for all required sizes
- Pop-art themed visual identity throughout the app
- Consistent brand personality with comic-inspired design elements

---

### Further Optimize Search Results
**Priority:** Medium
**Status:** ✅ Partially Complete (Feb 18, 2026)

Enhance the comic search and lookup experience with additional optimizations.

**Completed:**
- Fuzzy matching for title searches (abbreviation expansion: ASM → Amazing Spider-Man, FF → Fantastic Four, etc.)
- Batch lookups for CSV imports (deduplication + parallel lookups for faster imports)
- Popularity-based suggestions (trending titles shown on empty autocomplete focus)

**Remaining:**
- Search by creative team (writer, artist) — needs Marvel API integration
- Pre-populate common titles in database from external sources — needs data source decision
- Search history and favorites — UX decision needed

---

### eBay API Integration for Price History
**Priority:** Medium
**Status:** ✅ Complete (Jan 2026)

Integrated eBay Browse API for real market data from completed/sold listings.

**Implementation:**
- OAuth 2.0 authentication (`src/lib/ebay.ts`)
- Price lookup for completed listings
- Caching layer to minimize API calls
- Fallback to AI estimates when no eBay data available
- API route: `/src/app/api/ebay-prices/route.ts`

---

### Shop Page for Books For Sale
**Priority:** High
**Status:** ✅ Complete (Jan 26, 2026)

Marketplace page implemented with auctions and buy-now listings.

**Features Implemented:**
- Grid view of all available listings
- Auctions and Buy Now tabs
- Search and filter functionality
- Comic detail view with seller info
- Stripe checkout integration
- Seller ratings system

---

### Auction Feature (Shop)
**Priority:** High
**Status:** COMPLETE (January 10, 2026)

Add eBay-style auction functionality to the Shop, allowing users to list comics for competitive bidding.

**Implementation Summary:**
- Database migration: `/supabase/migrations/20260110_create_auctions.sql`
- Types: `/src/types/auction.ts`
- Database helpers: `/src/lib/auctionDb.ts`
- API routes: `/src/app/api/auctions/`, `/src/app/api/watchlist/`, `/src/app/api/notifications/`, `/src/app/api/sellers/[id]/ratings/`
- UI components: `/src/components/auction/` (AuctionCard, BidForm, BidHistory, etc.)
- Pages: `/src/app/shop/`, `/src/app/my-auctions/`, `/src/app/watchlist/`
- Stripe integration: `/src/app/api/checkout/`, `/src/app/api/webhooks/stripe/`
- Cron job: `/vercel.json` + `/src/app/api/cron/process-auctions/`

**Post-Implementation Notes:**
- Run migration in Supabase before using
- Configure Stripe API keys for payment processing
- Add CRON_SECRET env var for secure cron execution

#### Core Auction Settings
| Setting | Value |
|---------|-------|
| Duration | Flexible 1-14 days (seller chooses) |
| Starting Bid | Minimum $0.99, whole dollars only |
| Buy It Now | Optional - seller can set BIN price |
| Reserve Price | None - starting price is minimum acceptable |
| End Time | Hard end time (no auto-extend for v1) |
| Bid Increments | Whole dollars, minimum $1, bidder chooses amount |
| Proxy Bidding | Yes - system auto-bids up to user's max |

#### Participation & Access
- **Sellers:** Registered users only
- **Bidders:** Registered users only
- **Location:** Separate "Auctions" tab in Shop page

#### Listing Features
- Cover image (required)
- Up to 4 additional detail photos (condition, back cover, etc.)
- Flat-rate shipping set by seller
- Standard comic metadata (title, issue, grade, etc.)

#### Bidding & Bid History
- Bid history shown with anonymized bidders (Bidder 1, Bidder 2, etc.)
- Current high bid and bid count displayed
- Proxy bidding auto-increments to user's max bid

#### Auction Watchlist
- Users can add auctions to watchlist
- Ending-soon notifications for watched auctions

#### Notifications
- **Bidders:** Outbid notification, Won auction notification
- **Sellers:** Auction ended notification

#### Post-Auction Flow
- Winner has 48 hours to complete Stripe checkout
- If no payment: Seller decides (relist, offer to 2nd place, etc.)

#### Cancellation Policy
- Sellers cannot cancel once any bid is placed
- Sellers can cancel before first bid

#### Seller Reputation System
- Hero mask icon (blue/red) for positive feedback (thumbs up)
- Villain helmet icon (maroon/purple) for negative feedback (thumbs down)
- Optional comment with each rating
- Comments filtered for inappropriate language

#### Implementation Phases

**Phase 1: Core Auction Infrastructure**
- Database schema for auctions, bids, watchlist
- Auction creation flow (from collection item)
- Auction listing page with countdown timer
- Basic bidding functionality

**Phase 2: Proxy Bidding & Notifications**
- Proxy bid system (auto-increment to max)
- Email notifications (outbid, won, ended)
- Bid history display (anonymized)

**Phase 3: Watchlist & Search**
- Auction watchlist functionality
- Search/filter auctions in Shop
- Ending-soon sorting

**Phase 4: Payment & Completion**
- Stripe checkout integration for winners
- 48-hour payment window enforcement
- Seller dashboard for auction management

**Phase 5: Reputation System**
- Hero/villain rating icons
- Comment system with content filtering
- Seller reputation display on listings

#### Database Tables Needed
- `auctions` - Auction listings with settings
- `bids` - All bids including proxy max amounts
- `auction_watchlist` - User watchlist
- `seller_ratings` - Reputation feedback

#### Backlog Items (Low Priority)
- [ ] Revisit auto-extend feature for last-minute bids
- [ ] Determine auction monetization (listing fees, final value fees, etc.)

---

### Admin Role & Permissions
**Priority:** Medium
**Status:** ✅ Complete (Jan 26, 2026)

Admin functionality implemented for site management and moderation.

**Features Implemented:**
- Admin authentication via `getAdminProfile()` helper
- User management (view, suspend, delete)
- Admin-only route protection in middleware
- Protected endpoints (trial reset, cron jobs, etc.)
- Key info moderation dashboard
- Audit logging for admin actions

---

### Enhanced Key Info Database
**Priority:** Medium
**Status:** ✅ Complete (Jan 17, 2026)

Built a curated key comics database with community contribution system.

**Implementation:**
- 402 curated key comics seeded to Supabase `key_comics` table
- Database checked FIRST before AI fallback (guaranteed accuracy for known keys)
- Community submission system with moderated queue
- Admin dashboard at `/admin/key-info` for review/approve/reject
- "Suggest Key Info" button in comic detail modal for user contributions

**Files:**
- `src/lib/keyComicsDatabase.ts` - Static 402-entry curated database
- `src/lib/keyComicsDb.ts` - DB-backed lookup with fallback
- `src/app/api/key-info/submit/route.ts` - User submission API
- `src/app/api/admin/key-info/` - Admin moderation APIs
- `src/app/admin/key-info/page.tsx` - Admin dashboard
- `src/components/SuggestKeyInfoModal.tsx` - Submission UI
- `supabase/migrations/20250117_key_info_community.sql` - Schema
- `supabase/migrations/20250117_key_info_seed.sql` - Seed data

---

### Test Password Reset Flows
**Priority:** Medium
**Status:** ✅ Complete (Jan 26, 2026)

Clerk-powered password reset functionality verified and documented in TEST_CASES.md.

**Verified Flows:**
- Request password reset from login page
- Reset email received successfully
- Reset link works and redirects properly
- New password can be set
- User can log in with new password

---

### Add "Professor" Persona Throughout Site
**Priority:** Medium
**Status:** Pending

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

### Hide Cost/Sales/Profit-Loss Fields on Collection Page
**Priority:** Medium
**Status:** ✅ Complete (Mar 11, 2026)
**Added:** Mar 6, 2026
**Source:** User Feedback (Session 16)

Allow users to toggle visibility of Cost, Sales, and Profit/Loss fields on the collection page via a user preference setting. Some users prefer not to see financial data when browsing their collection.

---

### Sort Collection by Grade
**Priority:** Medium
**Status:** ✅ Complete (Mar 11, 2026)
**Added:** Mar 6, 2026
**Source:** User Feedback (Session 16)

Add a "Sort by Grade" option to the collection page sorting controls so users can order their collection by graded condition.

---

### Grade Pills Link to Filtered Collection
**Priority:** Medium
**Status:** ✅ Complete (Mar 11, 2026)
**Added:** Mar 6, 2026
**Source:** User Feedback (Session 16)

Grade pills displayed on the stats page should be clickable links that navigate to the collection page pre-filtered by that grade.

---

### Grading Company Filter on Collection Page
**Priority:** Medium
**Status:** ✅ Complete (Mar 11, 2026)
**Added:** Mar 6, 2026
**Source:** User Feedback (Session 16)

Add a grading company filter (CGC, CBCS, etc.) to the collection page filter controls so users can view only books graded by a specific company.

---

### Grading Company Counts Link to Filtered Collection
**Priority:** Medium
**Status:** ✅ Complete (Mar 11, 2026)
**Added:** Mar 6, 2026
**Source:** User Feedback (Session 16)

Grading company counts shown on the stats page should be clickable links that navigate to the collection page pre-filtered by that grading company.

---

### Expand to Support All Collectibles
**Priority:** Low
**Status:** Pending

Extend the platform beyond comic books to support other collectible categories, transforming the app into a universal collectibles tracker.

**Supported Categories:**
- Funko Pop figures
- Sports cards (baseball, basketball, football, hockey)
- Trading cards (Pokémon, Magic: The Gathering, Yu-Gi-Oh!)
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

### Update Email Formatting
**Priority:** Low
**Status:** ✅ Complete (Apr 1, 2026)

Customize the email templates sent by Clerk for authentication flows (welcome, verification, password reset, etc.) to match the Collectors Chest branding.

**Steps (to be detailed when ready):**
- Access Clerk Dashboard email templates
- Customize branding (logo, colors, fonts)
- Update copy/messaging to match app voice

> All 12 email templates updated with shared pop-art header (COLLECTORS CHEST badge, unique comic sound effects per email type) and footer (tagline, legal links). CTA buttons standardized to blue #0066FF. Email-safe table layouts.
- Test email delivery and rendering across clients

---

### Update "Ask the Professor" FAQ Content
**Priority:** Low
**Status:** ✅ Complete (Feb 18, 2026)

Review and update the FAQ questions and answers in the "Ask the Professor" help feature to match the live production environment and actual user needs.

**Areas to Review:**
- Update questions based on real user feedback
- Ensure answers reflect current app functionality
- Add new FAQs for features added post-launch
- Refine Professor's voice/tone for consistency

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

### Fix TypeScript Errors in Test Files
**Priority:** Low
**Status:** ✅ Complete (Jan 28, 2026)

Test files now use proper factory functions that create complete mock objects satisfying TypeScript types.

**Implementation (Option 3 - Factory Functions):**
- `createGradeEstimates()` - Complete GradeEstimate[] with label property
- `createPriceData()` - Complete PriceData with all required fields
- `createComicDetails()` - Complete ComicDetails with all required fields
- `createCollectionItem()` / `createItem()` - Complete CollectionItem objects

**Files:**
- `src/lib/__tests__/gradePrice.test.ts`
- `src/lib/__tests__/statsCalculator.test.ts`

Both `npm run typecheck` and `npm test` pass without errors.

---

### Key Hunt Scan History
**Priority:** Low
**Status:** ✅ Complete (Jan 2026)

History feature for Key Hunt that saves recent lookups for quick reference.

**Features Implemented:**
- Store last 30 lookups in localStorage (MAX_HISTORY_ITEMS = 30)
- Scrollable history list via "Recent" button in header
- Tap entry to view details or re-lookup with different grade
- Clear history option with confirmation dialog
- Persists across sessions in localStorage
- 7-day TTL for automatic cleanup (HISTORY_TTL_MS)
- Stores: title, issue, grade, price result, timestamp, cover image

**Key Files:**
- `src/lib/offlineCache.ts` - History storage functions
- `src/components/KeyHuntHistoryList.tsx` - History list UI
- `src/components/KeyHuntHistoryDetail.tsx` - Entry detail view
- `src/app/key-hunt/page.tsx` - Integration with "history" flow state

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

### Rework Homepage Blurb for Non-Logged-In Users
**Priority:** Low
**Status:** ✅ Complete (Mar 11, 2026)
**Added:** Mar 6, 2026
**Source:** User Feedback (Session 16)

Revise the homepage blurb/copy shown to non-logged-in visitors to better communicate the value proposition and encourage sign-ups.

---

### Add Photo Best Practices to Professor's FAQ
**Priority:** Low
**Status:** ✅ Complete (Mar 11, 2026)
**Added:** Mar 6, 2026
**Source:** User Feedback (Session 16)

Add a FAQ entry to the Professor's knowledge base covering photo best practices for scanning comic covers (lighting, angle, framing, etc.) to help users get better scan results.

---

### Update ADMIN_EMAIL GitHub Secret
**Priority:** Low
**Status:** ✅ Complete (Apr 2, 2026)
**Added:** Mar 9, 2026

Update ADMIN_EMAIL GitHub secret from personal Gmail to company email (collectors-chest.com) once company email is set up.

**Note:** GitHub secret updated to admin@collectors-chest.com. Code fallbacks in health-check and check-alerts routes also updated. Repo renamed from collectors-catalog to collectors-chest.

---

### Make Publisher Clickable on Stats Page
**Priority:** Low
**Status:** ✅ Complete (Mar 25, 2026)
**Added:** Mar 11, 2026
**Source:** User Feedback (Session 19)

Publisher names/counts on the Stats page should be clickable links that navigate to the collection page pre-filtered by that publisher, similar to how grade pills and grading company counts now deep-link.

---

### Investigate Empty Public Collection for @jsnaponte
**Priority:** Medium
**Status:** ✅ Complete (Apr 2, 2026)
**Added:** Mar 11, 2026
**Source:** User Report (Session 19)

User @jsnaponte reports their public collection page appears empty despite having comics in their collection. Investigate whether this is a data issue, privacy setting, or rendering bug.

> Tested via production. Issue resolved.

---

### Launch Tracker Review
**Priority:** High (Pre-Launch)
**Status:** Pending
**Added:** Mar 11, 2026
**Source:** Partner Meeting (Session 19)
**Target:** Week of April 20, 2026 (partner meeting April 22). Supabase Pro upgrade due by April 23.

Conduct a comprehensive review of launch readiness. Assess feature completeness, UX polish, performance, and outstanding bugs to determine a launch timeline.

---

### Evaluate Clerk Billing as Stripe Alternative
**Priority:** Low
**Status:** Pending
**Added:** April 2, 2026

Clerk offers subscription/billing services. Investigate whether Clerk Billing could replace or simplify the current Stripe integration for subscription management. Note: Stripe is still likely needed for marketplace payments (seller payouts via Connect), but Clerk might handle the subscription tier management more simply.

**Questions to Research:**
- What does Clerk Billing offer vs Stripe subscriptions?
- Can it handle trial periods, plan upgrades/downgrades?
- Would it reduce integration complexity?
- Does it still require Stripe underneath?

---

### Switch Clerk to Production Instance
**Priority:** High (Pre-Launch)
**Status:** Blocked (awaiting Clerk support — ticket submitted Apr 5, 2026)
**Added:** April 2, 2026

Clerk is currently running in Development mode. Before public launch, need to create a Production instance in the Clerk dashboard. This provides production API keys, removes dev branding, and enables real email delivery.

**Steps:**
1. ✅ Create Production instance in Clerk dashboard
2. ✅ Update branding/logos in Production instance
3. ✅ Add DNS CNAME records (5/5 verified)
4. ✅ Configure webhook in Production instance
5. ✅ Update API keys in Netlify env vars + `.env.local` for local testing
6. Test welcome email after SSL propagates for clerk.collectors-chest.com
7. Awaiting Clerk support response (Discord #support post submitted Apr 5, next business day)

**Note:** All 5 DNS CNAME records verified via dig. SSL certificates not provisioned on Clerk's side — TLS handshake failure on clerk.collectors-chest.com and accounts.collectors-chest.com. Production auth is non-functional (Sign In button invisible, no authentication possible). Support ticket filed in Clerk Discord #support forum on Apr 5, 2026 — Clerk closed for weekend, response expected Monday Apr 7.

---

### Upgrade Clerk SDK to v7 + Enable Client Trust Status
**Priority:** Low
**Status:** Pending
**Added:** April 2, 2026

Clerk has a pending "Client Trust Status" update that adds `needs_client_trust` sign-in status for second-factor challenges on new devices. Requires `@clerk/nextjs` v7.0.0+ (currently on v6.36.6). This is a major version bump — defer until after launch.

**Warning:** The update notes say custom flows need code changes to handle the new `needs_client_trust` status attribute instead of `client_trust_state`. Review breaking changes before upgrading.

---

## Completed

### Welcome Email
**Priority:** Medium
**Status:** ✅ Complete (Apr 1, 2026)
**Added:** Apr 1, 2026

Welcome email sent via Resend when new users sign up (Clerk user.created webhook). Pop-art branded with POW! sound effect, feature highlights, 10 free scans callout, and START SCANNING CTA. Gmail/Outlook-safe table layouts.

---

### Wire Offer & Listing Email Notifications
**Priority:** Medium
**Status:** ✅ Complete (Apr 1, 2026)
**Added:** Apr 1, 2026

Wired 9 existing email templates to actually send: 7 offer notifications (received, accepted, rejected, countered, expired, counter-accepted, counter-rejected) and 2 listing expiration notifications (expiring, expired). Fire-and-forget pattern with getProfileForEmail/getListingComicData helpers. All transactional — always send regardless of notification preferences.

---

### Suggest Publisher Bug Fix + Vertigo Publisher
**Priority:** High
**Status:** ✅ Complete (Apr 1, 2026)
**Added:** Apr 1, 2026

Fixed Suggest Publisher button (was silently failing — wrong Supabase client, wrong data type for array column, no error feedback). Added Vertigo as a publisher option with aliases (vertigo, vertigo comics, dc vertigo).

---

### PWA Icon Separation + Apple Touch Icon
**Priority:** Medium
**Status:** ✅ Complete (Apr 1, 2026)
**Added:** Apr 1, 2026

Created separate icon files per context to prevent one change breaking another platform. Dedicated apple-touch-icon (180x180, white bg) for iOS, transparent maskable icons for Android home screen, blue-bg splash icon for Android splash screen. Fixed iOS Safari install instructions.

---

### Cover Image Validation Pipeline
**Priority:** Medium
**Status:** ✅ Complete (Mar 20, 2026)

Gemini-validated covers, eBay image harvesting, and `.ilike()` query fix. Full implementation with validation spec covering MIME types, URL validation (IPv4, regex), caching, and error handling for Gemini API timeouts, rate limits, and ambiguous responses.

**Files:**
- Spec: `docs/superpowers/specs/2026-03-20-cover-validation-spec.md`

---

### eBay Browse API Migration
**Priority:** High
**Status:** ✅ Complete (Mar 19, 2026)

Replaced the decommissioned eBay Finding API (shut down Feb 2025) with the Browse API. All pricing calls previously failed silently and fell back to AI-fabricated estimates. 13 tasks, 32 files affected. Key changes: "Listed Value" sourced from active listings median, AI price fallback removed, 12h cache, database migration to clear fake prices.

**Files:**
- Spec: `docs/superpowers/specs/2026-03-18-ebay-browse-api-design.md`
- Plan: `docs/superpowers/plans/2026-03-18-ebay-browse-api.md`

---

### Sort Collection by Grade
**Priority:** Medium
**Status:** ✅ Complete (Mar 11, 2026)

Added grade sorting option to collection page so users can order by graded condition.

---

### Grade Pills Link to Filtered Collection
**Priority:** Medium
**Status:** ✅ Complete (Mar 11, 2026)

Grade pills on stats page are now clickable, navigating to the collection page pre-filtered by that grade.

---

### Grading Company Filter on Collection Page
**Priority:** Medium
**Status:** ✅ Complete (Mar 11, 2026)

Added grading company filter (CGC, CBCS, etc.) to collection page filter controls.

---

### Grading Company Counts Link to Filtered Collection
**Priority:** Medium
**Status:** ✅ Complete (Mar 11, 2026)

Grading company counts on stats page are now clickable, deep-linking to the collection page filtered by company.

---

### Hide Cost/Sales/Profit-Loss Fields (Show/Hide Financials Toggle)
**Priority:** Medium
**Status:** ✅ Complete (Mar 11, 2026)

Added toggle to show/hide financial columns (Cost, Sales, Profit/Loss) on the collection page.

---

### Rework Homepage Blurb for Non-Logged-In Users
**Priority:** Low
**Status:** ✅ Complete (Mar 11, 2026)

Revised homepage copy for guest visitors to better communicate the value proposition.

---

### Add Photo Best Practices to Professor's FAQ
**Priority:** Low
**Status:** ✅ Complete (Mar 11, 2026)

Added FAQ entry covering photo tips for scanning comic covers (lighting, angle, framing).

---

### Age Verification Cache Fix
**Priority:** Bug Fix
**Status:** ✅ Complete (Mar 11, 2026)

Fixed caching issue with the age verification flow.

---

### AI Fake Sales Hidden
**Priority:** Bug Fix
**Status:** ✅ Complete (Mar 11, 2026)

Hidden AI-generated fake sales data from user-facing views.

---

### CONNECT_REQUIRED User-Friendly Error
**Priority:** Bug Fix
**Status:** ✅ Complete (Mar 11, 2026)

Added a user-friendly error message for CONNECT_REQUIRED Stripe errors instead of showing a raw error.

---

### Cover Image Search System
**Priority:** Medium
**Status:** ✅ Complete (Feb 25-26, 2026)

Cover image sources: community cover DB + Open Library API + manual URL paste. Originally explored external search APIs but none available for new customers.

---

### Grade Normalization Fix
**Priority:** Medium
**Status:** ✅ Complete (Feb 25, 2026)

Fixed grade normalization to ensure consistent grade formatting and comparison across the application (e.g., handling variations like "NM", "9.4", "Near Mint" uniformly).

---

### Footer on All Pages
**Priority:** Low
**Status:** ✅ Complete (Feb 25, 2026)

Added a consistent footer across all pages of the application for improved navigation and branding consistency.

---

### Delete Confirmation Modal Redesign
**Priority:** Medium
**Status:** ✅ Complete (Feb 25, 2026)

Redesigned the delete confirmation modal for a cleaner, more intuitive user experience with clearer messaging and action buttons.

---

### Collection Deletion Safety
**Priority:** High
**Status:** ✅ Complete (Feb 25, 2026)

Added safety measures to collection deletion to prevent accidental data loss, including confirmation steps and protective guardrails.

---

### Single Delete Undo Support
**Priority:** Medium
**Status:** ✅ Complete (Feb 25, 2026)

Added undo support when deleting a single comic from the collection, allowing users to quickly recover accidentally deleted items.

---

### Custom Chest SVG Icon
**Priority:** Low
**Status:** ✅ Complete (Jan 2026)

Designed and implemented a custom treasure chest icon for the Collectors Chest branding.

---

### Key Hunt (Mobile Quick Lookup)
**Priority:** Medium
**Status:** ✅ Complete (Jan 8-9, 2026)

A streamlined mobile interface for quick price lookups at conventions and comic shops.

**Features Implemented:**
- Bottom sheet UI with 3 entry methods: Scan Cover, Scan Barcode, Manual Entry
- Cover scan with auto-detection of slabbed comics and graded labels
- Grade selector for raw comics (6 grades: 9.8, 9.4, 8.0, 6.0, 4.0, 2.0)
- Manual entry with title autocomplete + issue number + grade
- Price result showing average of last 5 sales AND most recent sale
- Recent sale highlighting: 20%+ above avg = red (market cooling), 20%+ below = green (deal)
- Add to Collection and New Lookup buttons
- Mobile utilities FAB combining Key Hunt + Ask the Professor
- Raw and slabbed price differentiation

**Files Created/Updated:**
- `/src/app/key-hunt/page.tsx` - Main Key Hunt page with flow state machine
- `/src/components/ConModeBottomSheet.tsx` - Entry method selection
- `/src/components/GradeSelector.tsx` - Grade selection modal
- `/src/components/ConModeManualEntry.tsx` - Manual title/issue/grade entry
- `/src/components/ConModePriceResult.tsx` - Price result with recent sale highlighting
- `/src/components/MobileUtilitiesFAB.tsx` - Combined FAB for Key Hunt + Ask Professor
- `/src/app/api/key-hunt-lookup/route.ts` - Price lookup API with recent sale data
- `/src/app/api/quick-lookup/route.ts` - Barcode lookup with price data

---

### Fix Barcode Scanner Camera Issues
**Priority:** High
**Status:** ✅ Complete (Jan 8, 2026)

Debug and fix issues with the barcode scanner camera not loading on some devices.

**Fixes Implemented:**
- Explicit camera permission checking via Permissions API
- Pre-emptive permission request before scanner initialization
- Clear state machine (checking → requesting → starting → active → error)
- Detailed error messages for each error type (permission denied, not found, in use, etc.)
- Retry mechanism with "Try Again" button
- "How to Enable Camera" instructions for permission issues
- Fixed DOM timing issues with initialization delays
- Support for multiple barcode formats (UPC-A, UPC-E, EAN-13, EAN-8, CODE-128)
- Visual scanning overlay with animated corners and scan line
- Safe scanner cleanup on unmount

---

### Grade-Aware Pricing
**Priority:** Medium
**Status:** ✅ Complete (Jan 8, 2026)

Provide more accurate valuations based on comic grade.

**Features Implemented:**
- AI-estimated prices for 6 grade levels (9.8, 9.4, 8.0, 6.0, 4.0, 2.0)
- Raw vs slabbed price differentiation
- Live price updates as user selects grade
- Expandable grade breakdown in comic detail views
- Grade interpolation for values between standard grades

**Note:** Currently uses AI estimates. Can be enhanced with real eBay data when API integration is added.

---

### Sign-Up Prompts at Scan Milestones
**Priority:** Medium
**Status:** ✅ Complete (Jan 8, 2026)

Add strategic prompts encouraging guest users to create an account at key moments.

**Features Implemented:**
- After 5th scan: Soft prompt highlighting cloud sync benefits
- Before final (10th) scan: Stronger prompt about limit approaching
- After limit reached: Clear CTA to unlock unlimited scanning
- Milestone tracking persisted in localStorage (shows each prompt only once)
- Attractive modal with benefits list and sign-up CTA

---

### Enhance Mobile Camera Integration
**Priority:** Low
**Status:** ✅ Complete (Jan 8, 2026)

Enhance the mobile camera experience with a live preview interface.

**Features Implemented:**
- Live camera preview via MediaDevices API
- Capture button with photo review before submission
- Retake option before confirming
- Front/rear camera switching on devices with multiple cameras
- Gallery access option for selecting existing photos
- Graceful permission handling with clear error messages
- Fallback to file upload for unsupported browsers

---

### Mobile Gallery Access for Scanning
**Priority:** Medium
**Status:** ✅ Complete (Jan 8, 2026)

Allow mobile users to select images from their photo gallery in addition to using the camera.

**Features Implemented:**
- "Choose from Gallery" button alongside camera option on mobile
- Separate file input without capture attribute for gallery access
- Useful for pre-photographed collections and dim lighting conditions

---

### Enhanced Title Autocomplete
**Priority:** Low
**Status:** ✅ Complete (Jan 8, 2026)

Improve the title search/autocomplete functionality to use contains-search instead of prefix-only matching.

**Features Implemented:**
- Contains-search: Typing "Spider" matches "The Amazing Spider-Man", "Spider-Woman", "Ultimate Spider-Man", etc.
- Fuzzy matching for common typos (Spiderman → Spider-Man, Xmen → X-Men)
- Recent searches shown first with localStorage persistence

---

### Re-evaluate Details When Title/Issue Changes
**Priority:** Low
**Status:** ✅ Complete (Jan 8, 2026)

Automatically trigger a new AI lookup when user manually edits the title or issue number, since the existing metadata may no longer be accurate.

**Features:**
- Detect when title or issue # is changed
- Prompt user: "Would you like to look up details for the updated title/issue?"
- Option to keep existing data or fetch new
- Only clear fields that would change (preserve user-entered notes, purchase price, etc.)

---

### Hottest Books Mobile Improvements
**Priority:** Low
**Status:** ✅ Complete (Jan 8, 2026)

Improve the Professor's Hottest Books experience on mobile devices.

**Features:**
- Auto-scroll to detail panel when book is selected
- Better cover image positioning on smaller screens
- Swipeable cards for navigation between books
- Collapsible detail sections

---

### User Registration & Authentication
**Priority:** High
**Status:** ✅ Complete (Jan 7, 2026)

Implement user registration and authentication to enable multi-user support, data persistence across devices, and marketplace features.

**Recommended Stack:**
- **Authentication:** Clerk (easiest) or NextAuth.js (most flexible)
- **Database:** Supabase (PostgreSQL) or Firebase Firestore

**Core Features:**
- Email/password registration
- Social login (Google, Apple - optional)
- Email verification
- Password reset flow
- Session management
- User profile page

**Database Migration:**
- Migrate from localStorage to cloud database
- Add `userId` to all collections, lists, and sales records
- User profile schema (name, email, avatar, preferences)

**Features Requiring Account Creation:**
> Certain features should be restricted to registered users to encourage sign-up and enable marketplace functionality.

| Feature | Guest Access | Registered User |
|---------|--------------|-----------------|
| Scan comics (AI recognition) | Limited (5-10 scans) | Unlimited |
| View collection | Local only | Cloud-synced across devices |
| Price estimates | Yes | Yes |
| Create custom lists | No | Yes |
| List comics for sale | No | Yes |
| Buy from marketplace | No | Yes |
| Sales history & profit tracking | No | Yes |
| Export collection data | No | Yes |

**Implementation Notes:**
- Show "Create Account" prompts when guests attempt restricted features
- Allow guests to scan a few comics to demonstrate value before requiring signup
- Migrate guest localStorage data to cloud on account creation
- Protected route middleware for authenticated pages

---

### Support File Import
**Priority:** Medium
**Status:** ✅ Complete (Jan 8, 2026)

Allow users to import their existing comic collections from files or other tracking services, making it easy to migrate to Comic Tracker.

**Supported File Formats:**
- CSV (most universal)
- JSON (structured data)
- Excel (.xlsx)
- XML (some apps export this)

**Import Sources to Consider:**
- Generic spreadsheets (user-created)
- CLZ Comics export
- League of Comic Geeks export
- ComicBase export
- GoCollect export

**User Experience:**
- File upload interface with drag-and-drop support
- Preview imported data before committing
- Field mapping UI (map CSV columns to Comic Tracker fields)
- Progress indicator for large imports
- Summary report after import (success count, errors, duplicates)

**Data Handling:**
- Validate required fields (title, issue number at minimum)
- Handle missing/optional fields gracefully
- Normalize data formats (dates, grades, prices)
- Currency handling for purchase prices

**Duplicate Detection:**
- Check for existing comics by title + issue + variant
- Options: skip duplicates, overwrite existing, or import as new
- Show duplicates in preview for user decision

**Grade Mapping:**
- Map different grading scales to internal format
- Support CGC, CBCS, raw grades, and custom scales
- Handle grade notes/labels

**Error Handling:**
- Partial import support (don't fail entire import for one bad row)
- Clear error messages per row
- Export failed rows for user to fix and retry
- Ability to undo/rollback recent import

**Technical Considerations:**
- Client-side file parsing (Papa Parse for CSV, SheetJS for Excel)
- Chunked processing for large files (1000+ comics)
- Memory management for browser-based parsing
- Consider server-side processing for very large imports (requires auth)

**Post-Import Options:**
- Assign all imported comics to a specific list
- Trigger bulk price estimates for imported comics
- Option to fetch cover images for imports without images

---

### Professor's Hottest Books Feature
**Priority:** Medium
**Status:** ✅ Complete (Jan 8, 2026) — Hidden/commented out as of Mar 13, 2026 (available to re-enable)

Weekly market analysis showing the hottest comics based on recent sales activity. Similar to Key Collector's "Hot 10" feature.

**Features:**
- Display top 10 trending comics
- Show key facts (first appearances, significance)
- Price ranges (low/mid/high)
- Recent sale comparisons vs 12-month average
- Link to eBay/marketplace listings

**Data Sources:**
- eBay API for recent sales data
- Claude AI for key facts and significance
- Weekly refresh of hot list

**UI Elements:**
- Cover image thumbnail
- Title, publisher, year
- Key facts section
- Price trend indicators (+/- percentage)
- "Buy it on eBay" affiliate link (future monetization)

---

## Bug Fixes

### Fix CSV Drag & Drop Not Accepting Files
**Priority:** Medium
**Status:** ✅ Complete (Feb 25, 2026)
**Added:** Feb 25, 2026

Dragging a CSV file onto the import drop zone causes the browser to open the file in a new tab instead of accepting the drop. Fixed by adding proper dragover/drop event handlers with `preventDefault()` to the drop zone component.

**Root Cause:**
The drop zone was missing `onDragOver` and `onDrop` event handlers that call `e.preventDefault()` and `e.stopPropagation()`. Without these, the browser falls back to its default behavior of navigating to or opening the dropped file.

**Fix:**
- Added `onDragOver={(e) => e.preventDefault()}` to the drop zone element
- Added `onDrop` handler that calls `e.preventDefault()` before processing `e.dataTransfer.files`
- Verified the fix works across Chrome and Safari on Mac, and Android Chrome

---

### Remove Comic Vine API from Import Lookup
**Priority:** High
**Status:** ✅ Complete (Feb 25, 2026)
**Added:** Feb 25, 2026

The `/src/app/api/import-lookup/route.ts` still references Comic Vine API for cover image lookups during CSV import, but Comic Vine was previously removed from the codebase because their API is unreliable. Remove the `fetchCoverImage()` function and Comic Vine references from import-lookup. Cover images now use the community cover DB, Open Library API, or manual URL paste.

---

### Manual Cover URL Paste → Community Cover Submission
**Priority:** Medium
**Status:** ✅ Complete (Feb 26, 2026)

Users can now paste a cover image URL directly, which gets submitted to the community cover database for approval. Provides a fallback when automated search doesn't find the right cover.

---

### Rename Reputation System to Creator Credits
**Priority:** Medium
**Status:** ✅ Complete (Feb 26, 2026)

Renamed the entire reputation system to "Creator Credits" across the codebase — types, database helpers, components, UI text, and all imports/references.

---

### Award Creator Credits for Approved Cover Submissions
**Priority:** Medium
**Status:** ✅ Complete (Feb 26, 2026)

Users earn Creator Credits when their submitted cover images are approved by admins, incentivizing community contributions to the cover database.

---

### External Image Search API Removal
**Priority:** High
**Status:** ✅ Removed (Feb 26, 2026)

Removed external image search API integration after discovering no providers available for new customers. Cover image search now relies on community cover DB + Open Library API + manual URL paste.

---

### About Page Copy
**Priority:** Medium
**Status:** Pending
**Added:** Mar 13, 2026

Write "Our Story" origin narrative and "Meet the Team" bios for the About page. Placeholder text is currently highlighted in red. Also complete the "Get in Touch" contact section.

---

### Flip Claude/Gemini Provider Order
**Priority:** Medium
**Status:** Pending
**Added:** Mar 18, 2026

Evaluate whether Gemini should be the primary scanner provider instead of Claude, based on production accuracy comparison data. Currently Claude is primary with Gemini as fallback.

---

### Expand Curated Key Info DB
**Priority:** Medium
**Status:** Pending
**Added:** Mar 18, 2026

Add more vintage key issues to the curated key info database based on user scanning patterns. Current DB has 403+ entries — expand with additional silver/bronze/copper age keys that users are frequently scanning.

---

### Native App Wrapper
**Priority:** Low
**Status:** Pending
**Added:** Mar 18, 2026

Create a native app wrapper (PWA or native shell) to hide the browser URL bar and provide a more app-like experience on mobile. Addresses feedback item #16 (browser URL bar showing on public collection).

---

### Remove Open Library from Cover Pipeline
**Priority:** Low
**Status:** Pending
**Added:** Mar 19, 2026

Open Library has low accuracy for single-issue comics and burns Gemini quota on validation attempts. Consider removing entirely in favor of community covers + eBay image harvesting only.

---

### Batch Re-Validation for CSV Imports
**Priority:** Low
**Status:** Pending
**Added:** Mar 20, 2026

Build a batch re-validation endpoint for CSV-imported comics with missing covers. Allows users to trigger cover validation for entire import batches without requiring individual scans, respecting Gemini rate limits.

---

### Periodic HEAD Check for Cached eBay URLs
**Priority:** Low
**Status:** Pending
**Added:** Mar 20, 2026

Implement a 30-day cycle periodic HEAD check for cached eBay image URLs to detect dead links early. Prevents showing broken images to users and triggers re-harvesting if needed.

---

### IPv6 Private Address Checks in URL Validation
**Priority:** Low
**Status:** Pending
**Added:** Mar 20, 2026

Add IPv6 private address range checks (fd00::/8, fe80::/10, ::1) to URL validation. Currently only validates IPv4 loopback and private ranges; should expand for complete private/loopback detection.
