# Collectors Chest - Comprehensive Evaluation

> Launch readiness scorecard. See `BACKLOG.md` for open work items and `DEV_LOG.md` for session history.

*Last Updated: October 4, 2026 (Session 51)*

---

## Executive Summary

Collectors Chest is a comic book collection tracking app with AI-powered cover recognition and a new auction marketplace feature. The app is currently in **Private Beta** with public registration disabled.

**Overall Score: 9.7/10** (up from 9.6/10 — Session 48 (June 14, 2026) was a security + quality hardening pass: public AI endpoints now auth + rate-limited, cron fail-open fixed, server-side admin gate (layout + middleware), Connect onboarding IDOR closed, RLS-scoped clients, image-host allowlist (SSRF), Clerk upgraded to 6.39.5 clearing the high-severity authz-bypass advisory, guest scans server-enforced. Accessibility leveled up — ComicDetailModal + 17 overlay modals are now proper dialogs (Escape/focus-trap/SR), global reduced-motion + focus-visible, pinch-zoom re-enabled, WCAG-AA contrast. Testing grew +509 tests to 1,423 across 85 suites (auction money engine + many helpers now covered). Cost/unit economics improved — text lookups moved Sonnet→Haiku, Gemini primary, prompt caching, session-recording sampling, server-side WebP covers, marketplace destination charges so the platform nets a clean fee. God-modules (auctionDb, email) decomposed, oversized components split, dead code removed, 0 circular deps. Session 50 (Jul 25, 2026) strengthened the codebase further: 12 of 13 npm-audit advisories resolved (Next.js 16.2.11, sharp 0.35.3), all knip dead-code findings cleared (0 remaining), offline-queue event-name bug fixed, support-email constant unified. Residual: 1 dev-only npm-audit advisory (brace-expansion — accepted, BACKLOG); Variant Name Resolver two-pass barcode OCR still deferred (BACKLOG #1); real-money Stripe Connect payout test still pending.)

**Prior (Session 46, May 9, 2026):** shipped + deployed two fixes: (1) **Scan Cover Persistence** — signed-in users' FAB scan photos now persist via the new `comic-covers` Supabase bucket, eliminating the universal "?" placeholder regression for all signed-in users; (2) **3-Tier Variant Name Resolver** — new `src/lib/variantResolver.ts` with catalog → AI → derived tiers, wired into `/api/analyze`, with admin-approval guard for community variant names and a new schema field on `barcode_catalog`. Important production gap surfaced during testing: the resolver requires the AI to extract a full 17-digit barcode (12-digit UPC + 5-digit add-on), but production scans only capture 12 digits, so the resolver doesn't fire in prod yet — tracked in BACKLOG as "Variant Detection — Two-Pass High-Res Barcode OCR (Option C3)" and is the top priority for next session. 850/850 tests passing.)

**Session 51 (Oct 4, 2026) — pre-deploy smoke test surfaced production issues; deploy ON HOLD** (BACKLOG "Deploy Hold — Resume Pre-Deploy Checklist"). Production is on a retired Gemini model (every scan falls back to Claude Sonnet), the For Trade tab and the shared `comic_metadata` cache have been broken in production (all fixed locally, pending deploy), the marketplace Stripe fee bearer is unverified, and `npm audit` now reports a critical Next.js RCE advisory. Local dev shares the production database.

**Current Status: PRIVATE BETA**
- Site is live at collectors-chest.com
- Public registration is DISABLED (waitlist only)
- Existing accounts (developer) still work
- Guests can use 5 free scans (sign up for 10/month)

---

## 0. Private Beta Checklist (Before Opening Registration)

> **Do NOT open registration until these items are complete**

### Critical (Must Have)

✅ All critical items complete except:

| Item | Status | Notes |
|------|--------|-------|
| Stripe Connect for seller payouts | ✅ Live mode enabled Apr 21, 2026 - ready for real-money test | Enable Connect in Stripe dashboard, configure Express accounts |

### High Priority

✅ Most high-priority items complete. Remaining:

| Item | Status | Notes |
|------|--------|-------|
| Test payment flows end-to-end | ✅ Validated Apr 22, 2026 | Auction + Buy Now E2E in localhost/sandbox. Real-money test still pending after deploy. |
| Test Stripe Connect seller flow | ⚠️ Destination-charge model now in code (Session 48) — real-money test pending; **fee bearer UNVERIFIED (Session 51)** | Marketplace moved to Stripe destination charges on the premise the platform nets a clean fee — Stripe docs indicate the platform may pay processing fees on destination charges; see BACKLOG "Pricing FAQ Fee Copy Wrong (Destination Charges)" (Stripe destination-charge fee bearer verification). Seller onboarding, sandbox purchase, fee split, auction + Buy Now paths validated in test mode. Real payout to seller bank still pending — see BACKLOG. |
| Generate QR code for /join/trial | ✅ Handed off | Third party vendor producing the QR + business cards |
| Database backup strategy | ⚠️ Planned (Post-Launch) | Upgrade to Supabase Pro ($25/mo) when warranted by user growth — not a launch blocker. Interim: manual pg_dump before destructive migrations. See BACKLOG Pending Enhancements. |

### Medium Priority

_(No open Medium items. Hottest Books was removed from scope Apr 22, 2026 — see BACKLOG "Remove Hottest Books Feature" for the code cleanup task.)_

---

## 1. Code Quality & Technical Debt

**Score: 9.7/10** (Session 50 (Jul 25, 2026) cleared ALL knip dead-code findings (2 unused files, 95 unused exports, 12 unused types → 0), fixed a latent offline-queue event-name bug, unified the support-email constant, and reconfirmed 0 circular deps. npm-audit residual is now a single dev-only accepted advisory — see Security section. Earlier — Session 48 (June 14, 2026) decomposed god-modules (`auctionDb`, email), split oversized components, and grew the test suite +509 to **1,423 tests across 85 suites** (auction money engine + many helpers now covered); Session 47 was a mobile collection-UI fix + PROD-validation pass; Session 46 added `src/lib/variantResolver.ts` (3-tier catalog → AI → derived) + signed-in cover-persistence helpers (`src/lib/uploadCoverImage.ts`, `/api/comics/upload-cover`).)

### Issues Status

| Issue | Severity | Status |
|-------|----------|--------|
| Test suite | 🟢 Good | **1,423 tests passing across 85 suites** (+509 this session — auction money engine + many helpers now covered; verified Session 48, June 14, 2026). Manual device test pass still pending — see BACKLOG test-suite item |
| ESLint config | 🟢 Fixed | Working with Next.js defaults |
| Viewport/themeColor metadata | 🟢 Fixed | Migrated to `export const viewport` |
| Stripe webhook config export | 🟢 Fixed | Deprecated config removed |
| TypeScript compilation | 🟢 Passing | Clean |
| Production build | 🟢 Passing | Clean |
| Sentry error tracking | 🟢 Added | Production-ready |
| PostHog analytics | 🟢 Added | Tracking enabled |
| API input validation | 🟢 Complete | **Zod validation sweep across 82 routes** (Apr 23, 2026) — marketplace, user/social/admin, content/scan/lookup. Shared `src/lib/validation.ts` helper with `validateBody`/`validateQuery`/`validateParams` + standardized `{error, details:[{field, issue}]}` response shape |

### Remaining Work

1. **Expand test coverage** - Hook coverage, component coverage for auction flows

---

## 2. Security Posture

**Score: 9.8/10** (up from 9.6/10 — Session 48 (June 14, 2026) was a security hardening pass: public AI endpoints now require auth + rate limiting, the ended-auction cron fail-open was closed, a server-side admin gate added at both layout and middleware, the Stripe Connect onboarding IDOR fixed, DB clients RLS-scoped, an image-host allowlist added to block SSRF, Clerk upgraded to 6.39.5 (clears the high-severity authz-bypass advisory), and guest scan limits are now server-enforced. Session 50 (Jul 25, 2026) resolved 12 of 13 npm-audit advisories (Next.js 16.2.11, sharp 0.35.3 override, lockfile fixes); the lone residual is a dev-only brace-expansion advisory — accepted, tracked in BACKLOG. CSRF + middleware-expansion items remain partial; pattern-based bid-fraud detection is post-launch.)

> ⚠️ **Session 51 (Oct 4, 2026):** new npm-audit advisories (1 critical Next.js RCE, 45 high) — BACKLOG "Security: npm audit — 52 vulnerabilities"; local dev shares the production DB — BACKLOG "Local Dev Shares the Production Supabase Database"; CSRF now has its own BACKLOG entry.

| Item | Status | Notes |
|------|--------|-------|
| RLS policies (core tables) | ✅ Good | Production-ready |
| RLS policies (auction tables) | ✅ Good | Properly configured |
| RLS-scoped DB clients | ✅ Added Jun 14, 2026 | Clients scoped to RLS context (Session 48) |
| CCPA deletion webhook | ✅ Good | Clerk webhook exists |
| API authentication | ✅ Good | Clerk auth on protected routes |
| Public AI endpoints auth + rate limit | ✅ Added Jun 14, 2026 | Public AI endpoints now require auth + rate limiting; guest scan limits server-enforced (Session 48) |
| Server-side admin gate | ⚠️ Regression fixed locally (Oct 4, 2026) — pending deploy | Admin check enforced at layout + middleware (Session 48). Unpushed commit `3ba698a` crashed every `/admin` page (Clerk `auth()` inside `clerkMiddleware`); fixed locally + owner-verified, must ship with the unpushed commits — see BACKLOG "Deploy Hold — Resume Pre-Deploy Checklist" |
| Connect onboarding IDOR | ✅ Closed Jun 14, 2026 | Stripe Connect onboarding no longer addressable by another user's account id (Session 48) |
| Cron fail-open | ✅ Closed Jun 14, 2026 | Ended-auction cron no longer proceeds when auth secret is missing/invalid (Session 48) |
| SSRF / image-host allowlist | ✅ Added Jun 14, 2026 | Remote image fetches restricted to an allowlist of hosts (Session 48) |
| Clerk authz-bypass advisory | ✅ Cleared Jun 14, 2026 | Upgraded Clerk to 6.39.5 — clears high-severity authz-bypass advisory (Session 48) |
| Stripe webhook verification | ✅ Good | Signature validation |
| Rate limiting | ✅ Added | Upstash rate limiting on AI & bid routes |
| npm audit (dependencies) | ❌ Critical advisory (Oct 4, 2026) | **52 vulnerabilities (1 critical, 45 high)** published since Session 50: `next` 16.2.11 RCE advisories (GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4), `sharp` <0.35.4, `qs`, `smol-toml` — upgrade before next deploy, see BACKLOG "Security: npm audit — 52 vulnerabilities (1 critical, 45 high)". Prior: Session 50 (Jul 25, 2026) resolved 12 of 13 advisories: Next.js 16.1.1→16.2.11 (5 advisories incl. middleware bypass, cache poisoning, DoS), sharp 0.33.5→0.35.3 via npm override (4 libvips CVEs), plus dompurify/fast-uri/js-yaml/uuid/svix/ws/qs/babel lockfile fixes. Remaining: 1 dev-only brace-expansion DoS advisory in the dev toolchain (eslint/prettier-plugin/depcheck) — accepted risk, no production exposure. See BACKLOG "Accepted Dev-Only npm Audit Residual (brace-expansion)" |
| Input validation | ✅ Complete | **Zod schema validation on 82 API routes** (Apr 23, 2026) — UUID format, enum values, length caps, nested shapes. HTTP 400 with standardized `{error, details}` shape on invalid input |
| Image upload size caps | ✅ Complete | 10MB cap enforced on `/api/analyze` + `/api/messages/upload-image` via `src/lib/uploadLimits.ts` (added Apr 23, 2026) |
| CAPTCHA on guest scans | ✅ Complete | **hCaptcha on scans 4–5** (added Session 38/39). Pro trial through May 7, 2026 → auto-downgrades to free tier (1M req/mo) |
| Audit logging | ✅ Complete | **`auction_audit_log` table** with 20 event types + 17 lifecycle wire-ups (Apr 23, 2026). Admin-only RLS. Covers auction/offer/payment/shipment transitions + Stripe webhook |
| Payment-miss strike system | ✅ Complete | First-offense warning email, 2-strikes-in-90-days triggers bid restriction + reputation hit (Apr 23, 2026) — partial fraud mitigation |
| Trade matches IDOR | ✅ Closed Apr 28, 2026 | `/api/trades/matches/[matchId]` PATCH was updating by row id only; now scoped by `user_a_id`/`user_b_id` predicate (Session 43 RLS-bypass audit) |
| Notifications GET rate limit | ✅ Added Apr 28, 2026 | `GET /api/notifications/:id` now rate-limited — Capacitor retry-storm guard (Session 43) |
| Second Chance Offer RLS read | ✅ Closed May 5, 2026 | `getAuctionSecondChanceState` was using anon Supabase client to read `second_chance_offers` (RLS keys off Supabase JWT — Clerk-authed sessions don't provide it). Switched to `supabaseAdmin` (Session 44). Reinforces "Clerk-authed server reads of RLS tables = admin client" pattern. |
| CSRF protection | ⚠️ Implicit | Clerk session cookies + JSON bodies only; Origin/Referer checks on state-changing routes — see BACKLOG "CSRF Protection for State-Changing API Routes" |
| Dev/prod database separation | ⚠️ Shared (Oct 4, 2026) | Local dev points at the **production** Supabase project — local testing writes real data; see BACKLOG "Local Dev Shares the Production Supabase Database" (also "Remove Commented-Out LIVE Keys from `.env.local`") |
| Middleware protection | ✅ Improved Jun 14, 2026 | Server-side admin gate now enforced in middleware + layout (Session 48); broader route-coverage expansion still tracked in BACKLOG |
| Bid fraud detection | ⚠️ Partial | Strike system covers payment-miss pattern; pattern-based bid anomaly detection is post-launch — see BACKLOG |

### Security Recommendations

Remaining items tracked in BACKLOG.md:
- Advanced bidding fraud detection (pattern-based)
- Middleware protection expansion
- Explicit CSRF tokens on sensitive mutations

---

## 3. Auction Feature Evaluation

**Score: 9.7/10** (up from 9.6/10 — Session 44 closed the production-affecting Second Chance "Offer to Runner-up" button RLS-anon-read bug; the seller CTA now actually renders for sellers whose winners didn't pay, completing the documented Session 42 wiring.)

### What's Working Well
- eBay-style proxy bidding system
- Seller reputation with positive/negative ratings
- Watchlist functionality
- Payment integration via Stripe
- In-app notifications system
- Cron job for processing ended auctions
- Good database schema with RLS
- **Buy Now fixed-price listings** ✅ PROD-validated end-to-end Apr 23, 2026 (Session 40a hotfix resolved Stripe 2048-char image URL cap; full flow — checkout, payment, ship, ownership transfer, emails — verified in 40b)
- **Stripe Connect fee split** ✅ Validated end-to-end (Apr 21, 2026) — `transfer.created` webhook firing correctly
- **Payment deadline enforcement** ✅ Complete — checkout-time deadline guard, T-24h reminder cron, expire-unpaid-auctions cron, live countdown UI (Sessions 38 + 39)
- **Second Chance Offer** ✅ Complete — seller-initiated 48h offer to runner-up when winner doesn't pay (Session 39); seller CTA now wired into `AuctionDetailModal` + Phase 3 cancellation email mutex preventing the contradictory "cancelled, relist ready" email from firing alongside (Session 42); confirm-dialog "Send Offer" button moved blue → green for clarity (Session 42b); RLS-anon-read bug fixed May 5, 2026 — `getAuctionSecondChanceState` now uses `supabaseAdmin`, restoring the "Offer to Runner-up" button render in production (Session 44)
- **Notifications Inbox v1** ✅ Complete — full `/notifications` page (Session 42d), infinite scroll + per-row dismiss + Mark All Read + offline cache + 30/90-day auto-prune cron + Capacitor-ready deep-link contract. Pre-existing `markNotificationRead` IDOR patched in same commit. Dedicated `shipped` notification type + Truck icon.
- **Marketplace Fee Floor** ✅ Complete — $0.75 minimum platform fee on every sale closes the sub-$6 platform-loss zone (free-tier break-even was $5.88, premium was $14.29). Above $9.38 (8%) / $15.00 (5%) the floor is invisible. Documented in pricing FAQ + Navigation Ask the Professor + Terms 4.5 + TECHNICAL_FEATURES.md Feature #11.
- **Payment-Miss Strike System** ✅ Complete — warn on 1st offense, bid restriction on 2 strikes within 90 days (Session 39)
- **Shipping tracking (Option A)** ✅ Mark-as-shipped with carrier + tracking number, fires buyer notification (Session 37)
- **Auction audit log** ✅ Complete — 20 event types covering full lifecycle (Session 39)
- **Feedback eligibility timing** ✅ Fixed Apr 23, 2026 — `rating_request` now fires at shipment (not payment) + `useFeedbackEligibility` re-queries on shipped/submit so button renders/hides correctly (Session 40b/40c)
- **Outbid email content** ✅ Fixed Apr 23, 2026 — "Your max bid: $X" line now rendered (Session 40b)
- **Active Bids tab** ✅ Fixed Apr 23, 2026 — `bid_amount` column fix resolved 500 on `/transactions?tab=bids` (Session 40d)

### Issues & Gaps

| Issue | Severity | Notes |
|-------|----------|--------|
| No dispute resolution | 🟡 Medium | Buyer protection — tracked in BACKLOG |
| Auction sniping protection | 🟡 Medium | No auto-extend on last-minute bids — tracked in BACKLOG |
| Shipping tracking Option B | 🟡 Medium | EasyPost integration + 10-day auto-refund — deferred to dedicated session, see BACKLOG |

See BACKLOG.md for open auction/marketplace work.

---

## 4. User Experience & Onboarding

**Score: 8.8/10** (up from 8.7/10 — Session 47 PROD-validated the Session 46 cover-persistence pipeline end-to-end on iPhone + Android for the first time (May 27, 2026); confirmed FAB scan photos persist to the `comic-covers` Supabase bucket and render on My Collection cards instead of the "?" placeholder. Session 47 also resolved a cluster of mobile collection-UI bugs — squished detail-modal cover thumbnail, two-line "Add Book" button, blank/cut-off grid covers on iOS Safari first paint, overlapping multi-select header, action bar hidden behind the floating nav, and the iOS double-tap checkbox. Session 46 had fixed the production-affecting "?" placeholder bug for ALL signed-in users (FAB scan photos now persist via `/api/comics/upload-cover` and `src/lib/uploadCoverImage.ts`); Variant Name resolver also shipped but stays blocked by a 12-vs-17-digit barcode OCR gap in production — see BACKLOG "Variant Detection — Two-Pass High-Res Barcode OCR (Option C3)".)

### Guest Experience Flow
1. Land on home page → see features & "How It Works"
2. Scan first comic → immediate value visibility
3. Milestone prompts at scans 2, 3, 4 → conversion nudges
4. Hit limit at 5 → sign-up wall (free account gets 10/month)

### What's Working
- Clear value proposition on homepage
- Progressive milestone prompts with benefits
- Well-designed SignUpPromptModal
- Guest scan count visible

### Gaps

| Issue | Status | Impact |
|-------|--------|--------|
| Email capture | ✅ Done | Bonus scans for email at limit |
| No re-engagement | ❌ Missing | Can't recover churned guests |
| No social proof | ⚠️ Partial | No reviews/testimonials |
| No demo mode | ❌ Missing | Can't explore without scanning |

### Recommendations
1. **Email capture before wall** - Offer "save progress" option
2. **Add Resend integration** - Email capture and drip campaigns
3. **Demo collection** - Let users explore with sample data
4. **Add testimonials** - Social proof on homepage

---

## 5. Competitive Positioning (Updated)

**Score: 7/10**

### 2026 Competitor Landscape

| Feature | Us | CLZ Comics | Key Collector | CovrPrice |
|---------|-----|------------|---------------|-----------|
| **Pricing** | Free + Premium | $1.99/mo | $3.99/mo | $5/mo |
| AI Cover Recognition | ✅ Unique | ❌ | ❌ | ❌ |
| Barcode Scanning | ⚠️ Basic | ✅ 99% rate | ⚠️ Limited | ❌ |
| Offline Mode | ✅ Key Hunt | ✅ Full | ✅ Full | ❌ |
| Real-Time Pricing | ✅ eBay API | ✅ CovrPrice | ✅ | ✅ Multi-source |
| Price Alerts | ❌ | ❌ | ✅ | ✅ |
| Pull Lists | ❌ | ✅ | ✅ Auto-add | ❌ |
| Marketplace/Auctions | ✅ New! | ❌ | ❌ | ❌ |
| PWA/Installable | ✅ | ❌ | ✅ | ❌ |
| Collection Stats | ✅ | ✅ | ⚠️ | ✅ |
| Graded Pricing | ✅ | ✅ $90/yr | ✅ Preview | ✅ |
| Sales Trend Graphs | ❌ | ⚠️ | ❌ | ✅ |
| Public Profiles | ✅ | ❌ | ❌ | ❌ |

### Our Unique Advantages
1. **AI Cover Recognition** - No competitor has this
2. **Built-in Marketplace** - Auction system is unique
3. **Free tier generosity** - 5 guest + 10/month free vs 7-day trials
4. **Modern PWA** - Better mobile experience
5. **Key Hunt mode** - Convention-optimized lookup

### Competitive Gaps to Address
1. **Price alerts** - Key Collector differentiator
2. **Pull lists** - Series tracking with auto-add
3. **Barcode database** - CLZ has 99% success rate
4. **Sales trend graphs** - CovrPrice specialty

---

## 6. Operating Costs & Efficiency

**Score: 8.5/10** (up from 8/10 — Session 48 (June 14, 2026) cut unit costs: text lookups moved Sonnet→Haiku, Gemini set as primary, prompt caching enabled, session-recording sampling added, and covers now served as server-side WebP. Marketplace switched to Stripe destination charges so the platform nets a clean fee. Cost projections corrected.)

### Current Cost Structure

| Service | Tier | Monthly Cost | Notes |
|---------|------|--------------|-------|
| Google Gemini (`gemini-3.5-flash-lite`) | Pay-per-use | Variable | **Primary** vision provider, ~$0.0016/scan measured (~$0.30/M in, $2.50/M out). Replaced retired `gemini-2.0-flash` in Session 51 — ⚠️ until deployed, prod falls back to Claude Sonnet on every scan (elevated Anthropic spend); see BACKLOG "Gemini Vision Model Retired" |
| Anthropic API | Pay-per-use | Variable | ~$0.015 per scan (vision fallback); Session 48 moved text lookups Sonnet→Haiku, made Gemini primary, and enabled prompt caching to cut per-call cost. Session 46 added small Tier-2 AI variant-name lookup on barcode-catalog miss — incremental cost negligible (only fires on cache miss when full 17-digit barcode is present, rare today pending OCR fix) |
| Supabase | Free | $0 | 500MB DB, 1GB storage |
| Clerk | Free | $0 | Up to 10K MAU |
| Netlify | Personal Plan | $9.54 | Hosting + domain + DNS (billed 13th) |
| Stripe | Standard | 2.9% + $0.30 | Per transaction. ⚠️ Marketplace destination-charge fee bearer unverified (seller vs platform) — see BACKLOG "Pricing FAQ Fee Copy Wrong (Destination Charges)" |
| eBay API | Free | $0 | Rate limited |
| Upstash Redis | Free | $0 | 10K commands/day |
| Sentry | Free | $0 | 5K errors/month |
| PostHog | Free | $0 | 1M events/month |
| hCaptcha | Pro trial → Free | $0 | Trial through May 7, 2026; then free tier (1M req/mo) |
| Resend | Free | $0 | 3K emails/mo |

### Cost Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| AI costs scale with users | 🟡 Medium | ✅ Redis caching implemented |
| Supabase limits | 🟡 Medium | Monitor usage, upgrade path ready |
| Netlify build minutes | 🟡 Medium | Strategic batching |
| eBay rate limits | 🟡 Medium | AI fallback in place |

### Recommendations
1. **Strategic deploys** - Batch changes, use preview for testing
2. **Pre-populate database** - Cache top 5K comics to reduce AI calls

---

## 7. Mobile Experience

**Score: 9.3/10** (up from 9.1/10 — Session 48 (June 14, 2026) was an accessibility level-up: `ComicDetailModal` + 17 overlay modals are now proper dialogs (Escape-to-close, focus trapping, screen-reader semantics), global reduced-motion support and `focus-visible` styling added, pinch-zoom re-enabled, and contrast brought to WCAG-AA. Earlier — Session 47 cleared a batch of mobile collection-UI bugs device-validated on iPhone + Android: detail-modal cover thumbnail no longer squished (bad `h-30` class), "Add Book" button no longer wraps on iOS, grid covers no longer blank/cut-off on iOS Safari first paint, multi-select header no longer overlaps Cancel, action bar no longer hidden behind the floating bottom nav, and the iOS two-tap checkbox fixed via Tailwind `hoverOnlyWhenSupported`.)

| Feature | Status |
|---------|--------|
| PWA installable | ✅ |
| Offline Key Hunt | ✅ |
| Responsive design | ✅ Collection-page mobile layout bugs (cover thumbnail, Add Book button, grid first-paint, multi-select header/action bar) fixed + device-validated iPhone + Android May 27, 2026 (Session 47) |
| Mobile navigation | ✅ Floating bottom nav now hides during multi-select so the action bar isn't obscured (Session 47) |
| Camera scanning | ✅ |
| Touch interactions | ✅ iOS sticky-hover double-tap on checkboxes fixed globally via Tailwind `hoverOnlyWhenSupported` (Session 47) |
| Accessible dialogs | ✅ Added Jun 14, 2026 — `ComicDetailModal` + 17 overlay modals are now proper dialogs (Escape/focus-trap/SR semantics) (Session 48) |
| Reduced motion + focus-visible | ✅ Added Jun 14, 2026 — global `prefers-reduced-motion` support + `focus-visible` styling (Session 48) |
| Pinch-zoom / WCAG-AA contrast | ✅ Jun 14, 2026 — pinch-zoom re-enabled, contrast brought to WCAG-AA (Session 48) |
| Mobile auction/listing modal layout | ✅ Fixed Apr 23, 2026 (Session 40a) |
| Cover lightbox (tap-to-zoom) | ✅ Added May 5, 2026 (Session 44) — reusable `CoverLightbox`, wired into Key Hunt |
| Haptic feedback | ❌ |
| Batch scanning | ❌ |

---

## 8. Feature Completeness

**Score: 9.7/10** (Session 46 (May 9, 2026) shipped two features: Scan Cover Persistence (signed-in users — fully functional in production) and 3-Tier Variant Name Resolver (code-complete, but doesn't fire in prod yet because AI scans capture only 12-digit UPC, not the 17-digit barcode the resolver needs — see BACKLOG "Variant Detection — Two-Pass High-Res Barcode OCR (Option C3)").)

| Feature | Status |
|---------|--------|
| Core Collection Management | ✅ Complete — filter UX refactored Apr 28, 2026 (mobile bottom-sheet drawer + active chips); mobile collection-UI bug cluster fixed + device-validated May 27, 2026 (Session 47) |
| AI Cover Recognition | ⚠️ Production on retired Gemini model (Oct 4, 2026) — every scan falls back to Claude Sonnet; fixed locally (`gemini-3.5-flash-lite`), pending deploy — see BACKLOG "Gemini Vision Model Retired". Prior: signed-in scan covers persist via `comic-covers` Supabase bucket (Session 46); PROD-validated end-to-end on iPhone + Android May 27, 2026 (Session 47) |
| Variant Name Resolver (3-tier) | ⚠️ Code-complete, blocked in prod — see BACKLOG "Variant Detection — Two-Pass High-Res Barcode OCR (Option C3)" (production AI captures only 12-digit UPC, not the 17-digit barcode the resolver needs to match `barcode_catalog`) |
| Listed Value (eBay Browse API) | ✅ Complete |
| Grade-Aware Pricing | ✅ Complete |
| Key Hunt (offline) | ✅ Complete — KEY ISSUE chips on scanned books + 3-tier resolver + 1,130-entry curated DB (May 5, 2026, Session 44) |
| CSV Import/Export | ✅ Complete |
| Cover Image Search (CSV Import) | ✅ Complete |
| Collection Statistics | ✅ Complete |
| Public Sharing | ✅ Complete |
| PWA Support | ✅ Complete |
| Auction Marketplace | ✅ Complete — PROD-validated Apr 23, 2026 (outbid + close paths) |
| Fixed-Price Listings (Buy Now) | ✅ Complete — PROD-validated end-to-end Apr 23, 2026 (Session 40a/40b: checkout → payment → ship → ownership transfer → emails) |
| Feedback System | ✅ Complete — timing + re-fetch fixed Apr 23, 2026 (Session 40b/40c) |
| Sales Page (Free Tier Visibility) | ✅ Complete — list always visible, stats gated behind upgrade CTA, Cost+Profit columns gated; data persisted for retroactive stats on upgrade (Session 40d/40e) |
| FMV Lookup for Purchased Comics | ⚠️ Partial — `POST /api/comics/[id]/refresh-value` endpoint + UI button shipped; eBay `MIN_LISTINGS_THRESHOLD = 3` at exact grade still misses rare/key issues. Pre-launch tuning tracked in BACKLOG ("FMV Lookup — Graceful Fallback for Rare / Key Issues at Exact Grade") |
| CGC/CBCS Cert Lookup | ✅ Enhanced (ZenRows-backed lookup deferred post-launch) |
| Error Tracking (Sentry) | ✅ Complete |
| Analytics (PostHog) | ✅ Complete |
| Redis Caching | ✅ Complete |
| Rate Limiting | ✅ Complete |
| Subscription Billing | ⏳ Code Complete (needs Stripe) |
| Feature Gating | ✅ Complete |
| Pricing Page | ✅ Complete |
| Scan Cost Dashboard | ✅ Complete |
| Scan Resilience (Multi-Provider) | ✅ Phase 1 Deployed (Mar 3, 2026) — fallback worked as designed when Gemini 2.0 Flash retired, but the failover was silent (alerting suggestion in BACKLOG "Gemini Vision Model Retired") |
| Comic Metadata Cache (`comic_metadata`) | ⚠️ Broken in production since Jan 10, 2026 (RLS blocked anon-client writes); fixed locally (service-role client), pending deploy — see BACKLOG "Scan Metadata Not Saving (`comic_metadata` RLS)" |
| Trading (For Trade tab / trade matches) | ⚠️ Broken in production since launch (nonexistent `estimated_value` column → 500 masked as empty list); fixed locally, pending deploy + browser re-test — see BACKLOG "For Trade Tab Broken (`estimated_value` Column)" |
| Email Notifications | ✅ Complete |
| Email Notification Preferences | ✅ Complete — 4-category toggles (Transactional locked, Marketplace/Social/Marketing togglable), `/settings/notifications` (Apr 23, 2026) |
| CAPTCHA (guest scan bot prevention) | ✅ Complete — hCaptcha on scans 4–5 (Apr 23, 2026) |
| Payment Deadline Enforcement | ✅ Complete — 5 of 6 gaps closed; second-highest-bidder promotion covered by Second Chance Offer |
| Second Chance Offer | ✅ Complete — seller-initiated single-level 48h offer to runner-up (Apr 23, 2026) |
| Payment-Miss Strike System | ✅ Complete — warn on 1st, flag at 2-in-90-days (Apr 23, 2026) |
| Auction Audit Log | ✅ Complete — 20 event types + admin-only RLS (Apr 23, 2026) |
| Shipping Tracking (Option A) | ✅ Complete — mark-as-shipped with carrier + tracking (Session 37) |
| Shipping Tracking (Option B, EasyPost) | ⏳ Deferred post-launch — see BACKLOG |
| Price Alerts | ❌ Not Started |
| Pull Lists | ❌ Not Started |

---

## 9. Monetization Readiness

**Score: 7/10** (up from 5/10)

### Current State
- Guest tier: 5 scans (localStorage)
- Free tier: 10 scans/month (cloud sync)
- Premium tier: Unlimited ($4.99/mo or $49.99/yr)
- Scan packs: $1.99 for 10 scans
- Auction marketplace (8% free / 5% premium transaction fee)
- ⏳ Stripe account setup pending
- ⏳ Stripe Connect for automated seller payouts (pending)
- Comp Premium for co-founder accounts via `subscription_source` column added Apr 28 — preserves analytics filterability (`WHERE subscription_source <> 'comped'`).

### Premium Tier Value Props (Ready)
- Unlimited scans
- Advanced statistics
- Public collection sharing
- CSV export
- Offline Key Hunt
- Priority AI lookups
- Real eBay prices
- Auction selling

### Revenue Projection
| Stream | Potential | Implementation |
|--------|-----------|----------------|
| Premium subscription ($4.99/mo) | High | ⏳ Code ready, needs Stripe |
| Scan packs ($1.99/10 scans) | Medium | ⏳ Code ready, needs Stripe |
| Auction fees (8%/5%) | Medium | ⚠️ Ready, fee model unverified — Stripe destination-charge fee bearer + Terms 4.5 shipping mismatch, see BACKLOG "Pricing FAQ Fee Copy Wrong (Destination Charges)" |
| eBay affiliate links | Low | Not started |

---

## 10. Risk Assessment

### Mitigated Risks ✅
| Risk | Previous | Current |
|------|----------|---------|
| Price credibility | 🔴 Critical | 🟢 Low (eBay API) |
| No competitive moat | 🔴 Critical | 🟢 Low (AI + Auctions + Buy Now) |
| Unsustainable AI costs | 🔴 Critical | 🟢 Low (Redis caching) |
| Security vulnerabilities | 🟡 Medium | 🟢 Low (RLS + rate limiting; Session 48 hardening: auth+rate-limit on public AI endpoints, cron fail-open closed, server-side admin gate, Connect IDOR fix, SSRF allowlist, Clerk 6.39.5 advisory cleared) |
| No marketplace | 🟡 Medium | 🟢 Low (Auctions + Buy Now) |
| No error tracking | 🔴 High | 🟢 Low (Sentry added) |
| No analytics | 🟡 Medium | 🟢 Low (PostHog added) |

### Active Risks ⚠️
| Risk | Severity | Mitigation |
|------|----------|------------|
| Single AI provider dependency | 🟡 Medium | **Oct 4, 2026:** Gemini primary (`gemini-2.0-flash`) was retired 2026-06-01 and prod silently fell back to Sonnet on every scan — fixed locally, pending deploy (BACKLOG "Gemini Vision Model Retired"). Self-healing model pipeline auto-updates deprecated models. MODEL_PRIMARY on Sonnet 4.5 (`claude-sonnet-4-5-20250929`) pre-empting June 15, 2026 Sonnet 4 retirement. OpenAI + Gemini fallbacks available. |
| Limited deploys | 🟡 Medium | Strategic batching |
| Shared dev/prod database | 🟡 Medium | Local dev writes to the production Supabase project — see BACKLOG "Local Dev Shares the Production Supabase Database" |
| Marketplace fee economics | 🟡 Medium | Stripe destination-charge fee bearer unverified; platform may net `application_fee − Stripe fee` — see BACKLOG "Pricing FAQ Fee Copy Wrong (Destination Charges)" |
| Auction fraud potential | 🟢 Low | **Mitigated Apr 23, 2026**: audit log (20 event types), payment-miss strike system (warn + flag), Zod input validation on 82 routes, hCaptcha on guest scans. Pattern-based bid anomaly detection remains post-launch — see BACKLOG |
| Input validation gaps | 🟢 Low | **Mitigated Apr 23, 2026**: Zod validation sweep closed; remaining risk is basic CSRF + middleware expansion — see BACKLOG "CSRF Protection for State-Changing API Routes" |
| RLS-anon-read pattern (Clerk-authed reads vs Supabase RLS) | 🟢 Low | Surfaced May 5, 2026 via Second Chance bug — Clerk-authed server reads of RLS-protected tables must use `supabaseAdmin`. Codebase pattern now reinforced; future occurrences should be caught in review. Broader audit of similar paths tracked in BACKLOG. |

---

## 11. Launch Readiness

### Overall: 99% Ready

**Private beta launch target: Sunday April 26, 2026.**

#### Remaining items (tracked in BACKLOG.md)
- Real-money Stripe Connect live-mode test (on deck, user-scheduled)
- CGC cert lookup via ZenRows (deferred post-launch, unblocks 3 other BACKLOG items)
- Apple Developer enrollment (1–3 week lead time, post-launch)
- Price Alerts, Pull Lists, Sales Trend Graphs (post-launch enhancements)
- Shipping Tracking Option B — EasyPost + 10-day auto-refund (post-launch)

See `BACKLOG.md` for the full prioritized list of open items.

_Deployed May 1, 2026 — Session 43 bundle (payment-deadline anchor, trade_matches IDOR fix, notifications GET rate-limit, My Collection filter UX refactor, comp Premium for co-founders)._

_Session 44 changes (May 5, 2026, not yet deployed): Second Chance "Offer to Runner-up" RLS-anon-read fix, Key Hunt KEY ISSUE chips + 3-tier resolver, curated DB expansion 404 → 1,130, `CoverLightbox` component, admin-only `/clz-comparison` page, partner-shareable CLZ comparison brief, TECHNICAL_FEATURES.md Key Hunt section update, Clerk dashboard username rules tightened._

_Deployed May 9, 2026 — Session 46 bundle: Scan Cover Persistence (`comic-covers` Supabase bucket + `/api/comics/upload-cover` + `src/lib/uploadCoverImage.ts` — fixes universal "?" placeholder for signed-in users), 3-Tier Variant Name Resolver (`src/lib/variantResolver.ts` wired into `/api/analyze`, with admin-approval guard for community variant names — blocked in prod by 12-vs-17-digit OCR gap, see BACKLOG)._

_Deployed May 27, 2026 — Session 47 bundle: Session 46 cover-persistence pipeline PROD-validated end-to-end on iPhone + Android (first user verification), plus a cluster of mobile collection-UI fixes (detail-modal cover thumbnail, "Add Book" button wrap, iOS Safari grid first-paint, multi-select header overlap, action bar behind floating nav, iOS double-tap checkbox)._

_Session 48 changes (June 14, 2026, not yet deployed): security hardening (auth + rate limit on public AI endpoints, cron fail-open fix, server-side admin gate at layout + middleware, Connect onboarding IDOR fix, RLS-scoped clients, image-host allowlist for SSRF, Clerk 6.39.5 clearing the authz-bypass advisory, server-enforced guest scans), accessibility level-up (ComicDetailModal + 17 modals as proper dialogs, global reduced-motion + focus-visible, pinch-zoom re-enabled, WCAG-AA contrast), +509 tests (now 1,423 across 85 suites), cost cuts (text lookups Sonnet→Haiku, Gemini primary, prompt caching, session-recording sampling, server WebP covers, marketplace destination charges), and code-quality cleanup (auctionDb/email god-modules decomposed, oversized components split, dead code removed, 0 circular deps). Residual: 1 transitive npm-audit high (BACKLOG), Variant Resolver two-pass barcode OCR deferred (BACKLOG #1), real-money Stripe Connect payout test pending._

_Session 51 (Oct 4, 2026): pre-deploy smoke test found 5 production/regression bugs (Gemini model retired, For Trade 500, `comic_metadata` RLS writes, mark-as-sold cover deletion, pricing FAQ fee copy) — all fixed locally, uncommitted; admin middleware crash fixed; deploy ON HOLD pending Stripe fee-bearer verification + npm-audit Next/sharp upgrade (BACKLOG "Deploy Hold — Resume Pre-Deploy Checklist")._

_Session 50 changes (Jul 25, 2026, not yet deployed): codebase strengthening — 12 of 13 npm-audit advisories resolved (Next.js 16.1.1→16.2.11 incl. middleware bypass/cache poisoning/DoS, sharp 0.33.5→0.35.3 via npm override clearing 4 libvips CVEs, dompurify/fast-uri/js-yaml/uuid/svix/ws/qs/babel lockfile fixes; lone residual is a dev-only brace-expansion advisory, accepted — see BACKLOG), all knip dead-code findings cleared (2 unused files, 95 unused exports, 12 unused types → 0), latent offline-queue event-name bug fixed, support-email constant unified, 0 circular deps confirmed, 1,423 tests passing (85 suites)._
