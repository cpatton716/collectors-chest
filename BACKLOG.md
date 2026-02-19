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
**Status:** Pending

Complete business formation and financial infrastructure before public launch.

**Why It's Important:**
- Marketplace handles money between users - higher liability risk
- Protects personal assets from potential lawsuits
- Required for professional ToS & Privacy Policy
- Enables proper Stripe setup with business verification

**Steps (in order):**

| Step | Task | Time | Notes |
|------|------|------|-------|
| 1 | **Form LLC** | 30 min + 1-7 days processing | ZenBusiness, LegalZoom, or state website ($50-500) |
| 2 | **Get EIN** | 10 min (instant) | IRS.gov - free, requires LLC first |
| 3 | **Open Business Bank Account** | 1-2 hours | Requires LLC docs + EIN, get business debit card |
| 4 | **Set Up Stripe** | 30 min | Use business name, EIN, bank account |
| 5 | **Update Payment Methods** | 30 min | Switch all services to company card |

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
| GoCollect | $9/mo | [gocollect.com](https://gocollect.com) → Billing |

**Estimated Total Cost:** $100-300 filing + ~$30/mo ongoing services
**Estimated Time:** ~2 weeks (mostly waiting for LLC processing)

**Blocks:**
- Privacy Policy & Terms of Service (need business name)
- Live subscription billing
- Marketplace payments

---

### Finalize Legal Pages (Placeholder Replacement)
**Priority:** Critical
**Status:** Pending (Blocked by LLC Formation + Stripe Setup)
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
**Status:** Pending
**Added:** Feb 4, 2026

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
- Fixed: Netlify ($9/mo), GoCollect ($89/yr), Domain ($13.99/yr)
- Variable: Anthropic API (~$0.015/scan), Stripe (2.9% + $0.30)
- Free tiers: Supabase, Clerk, Upstash, Resend, PostHog, Sentry

---

### GoCollect API Integration
**Priority:** High
**Status:** Pending (Awaiting API Key Approval)

Integrate GoCollect API for accurate, market-based pricing data.

**What it replaces:**
- AI price estimates → Real FMV from 600K+ tracked sales
- AI/static hot books → GoCollect Hot 50 (market-driven)
- No price trends → 30/90/365-day trend indicators

**API Details:**
- Tier: Pro ($89/yr annual plan)
- Rate Limit: 100 calls/day
- Endpoints: `/v1/collectibles`, `/v1/insights/item/{id}?grade=X`
- Auth: Bearer token

**Implementation:**
1. Create `src/lib/gocollect.ts` service
2. Replace pricing in `/api/analyze`, `/api/key-hunt-lookup`, `/api/quick-lookup`
3. Add trend indicators to UI (↑↓→)
4. Replace Hottest Books with GoCollect Hot 50
5. Cache responses 24hr in Redis

**Blocked By:** API key approval from GoCollect

---

### Marvel API Integration
**Priority:** High
**Status:** Pending (Awaiting Developer Portal Access)

Integrate Marvel API for accurate comic metadata and high-quality cover images on Marvel titles.

**What it provides:**
- High-resolution cover images (better than user photos)
- Accurate creator credits (writer, artist, cover artist, inker, colorist)
- Character appearance data for key detection
- Publication dates and series info
- Issue descriptions/summaries
- Consistent data format across Marvel catalog

**Benefits:**
- Higher quality cover images than user photos
- Accurate creator credits (currently AI-guessed)
- Reduced storage for user-uploaded images
- Better key issue detection via character appearances

**API Details:**
- Cost: Free
- Rate Limit: 3,000 calls/day
- Auth: MD5 hash (ts + privateKey + publicKey)
- Attribution required: "Data provided by Marvel"
- Example source: https://www.marvel.com/comics/issue/12415/uncanny_x-men_1963_100

**Implementation:**
1. Create `src/lib/marvel.ts` service with hash-based auth
2. Bulk-seed Supabase `marvel_comics` table (~50K comics)
3. Enrich scan results with Marvel data when matched
4. Use Marvel covers as fallback when user photo is poor quality
5. Display attribution on pages using Marvel data

**Considerations:**
- Marvel API only covers Marvel titles (no DC, Image, indie)
- Need to handle non-Marvel publishers separately
- Storage costs for bulk image hosting if we cache covers
- Could expand to DC/others later via different APIs

**Blocked By:** Developer portal access (reached out to Marvel support)

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
**Status:** Pending

Customize the email templates sent by Clerk for authentication flows (welcome, verification, password reset, etc.) to match the Collectors Chest branding.

**Steps (to be detailed when ready):**
- Access Clerk Dashboard email templates
- Customize branding (logo, colors, fonts)
- Update copy/messaging to match app voice
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

When converting to native mobile apps (iOS/Android), the cover image search feature needs to open the device's default browser for Google Image searches instead of an in-app webview.

**Current Behavior (PWA/Web):**
- User taps "Search Google Images" button
- Opens Google in a new tab
- User must use native back arrow/gesture to return to app
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

## Completed

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
**Status:** ✅ Complete (Jan 8, 2026)

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
