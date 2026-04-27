# Collectors Chest - Comprehensive Evaluation

> Launch readiness scorecard. See `BACKLOG.md` for open work items and `DEV_LOG.md` for session history.

*Last Updated: April 24, 2026*

---

## Executive Summary

Collectors Chest is a comic book collection tracking app with AI-powered cover recognition and a new auction marketplace feature. The app is currently in **Private Beta** with public registration disabled.

**Overall Score: 9.2/10** (up from 9.1/10 — Session 40 PROD testing round closed the Buy Now 500 blocker, fixed feedback-eligibility timing, unblocked free-tier sellers' sales view, fixed Active Bids 500, added FMV lookup endpoint for purchased comics, mobile modal sizing, FAQ polish, outbid email maxBid line, em dash sweep)

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
| Test Stripe Connect seller flow | ⚠️ Test mode validated end-to-end Apr 21–22, 2026 — real-money test pending | Seller onboarding, sandbox purchase, fee split, auction + Buy Now paths all validated. Real payout to seller bank still pending. |
| Generate QR code for /join/trial | ✅ Handed off | Third party vendor producing the QR + business cards |
| Database backup strategy | ⚠️ Planned (Post-Launch) | Upgrade to Supabase Pro ($25/mo) when warranted by user growth — not a launch blocker. Interim: manual pg_dump before destructive migrations. See BACKLOG Pending Enhancements. |

### Medium Priority

_(No open Medium items. Hottest Books was removed from scope Apr 22, 2026 — see BACKLOG "Remove Hottest Books Feature" for the code cleanup task.)_

---

## 1. Code Quality & Technical Debt

**Score: 9/10** (up from 8/10)

### Issues Status

| Issue | Severity | Status |
|-------|----------|--------|
| Test suite | 🟢 Good | **730 tests passing** (Apr 23, 2026) |
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

**Score: 9.5/10** (up from 8/10)

| Item | Status | Notes |
|------|--------|-------|
| RLS policies (core tables) | ✅ Good | Production-ready |
| RLS policies (auction tables) | ✅ Good | Properly configured |
| CCPA deletion webhook | ✅ Good | Clerk webhook exists |
| API authentication | ✅ Good | Clerk auth on protected routes |
| Stripe webhook verification | ✅ Good | Signature validation |
| Rate limiting | ✅ Added | Upstash rate limiting on AI & bid routes |
| npm audit (dependencies) | ✅ Clean | 0 vulnerabilities |
| Input validation | ✅ Complete | **Zod schema validation on 82 API routes** (Apr 23, 2026) — UUID format, enum values, length caps, nested shapes. HTTP 400 with standardized `{error, details}` shape on invalid input |
| Image upload size caps | ✅ Complete | 10MB cap enforced on `/api/analyze` + `/api/messages/upload-image` via `src/lib/uploadLimits.ts` (added Apr 23, 2026) |
| CAPTCHA on guest scans | ✅ Complete | **hCaptcha on scans 4–5** (added Session 38/39). Pro trial through May 7, 2026 → auto-downgrades to free tier (1M req/mo) |
| Audit logging | ✅ Complete | **`auction_audit_log` table** with 20 event types + 17 lifecycle wire-ups (Apr 23, 2026). Admin-only RLS. Covers auction/offer/payment/shipment transitions + Stripe webhook |
| Payment-miss strike system | ✅ Complete | First-offense warning email, 2-strikes-in-90-days triggers bid restriction + reputation hit (Apr 23, 2026) — partial fraud mitigation |
| CSRF protection | ⚠️ Implicit | Next.js provides some protection |
| Middleware protection | ⚠️ Minimal | Few routes marked as protected |
| Bid fraud detection | ⚠️ Partial | Strike system covers payment-miss pattern; pattern-based bid anomaly detection is post-launch — see BACKLOG |

### Security Recommendations

Remaining items tracked in BACKLOG.md:
- Advanced bidding fraud detection (pattern-based)
- Middleware protection expansion
- Explicit CSRF tokens on sensitive mutations

---

## 3. Auction Feature Evaluation

**Score: 9.6/10** (up from 9.5/10)

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
- **Second Chance Offer** ✅ Complete — seller-initiated 48h offer to runner-up when winner doesn't pay (Session 39)
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

**Score: 7.5/10** (up from 7/10 — Session 40 polish: mobile modal sizing, FAQ scroll lock + close-on-link, free-tier sales list now visible, em dash sweep for design consistency)

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

**Score: 8/10** (up from 7/10)

### Current Cost Structure

| Service | Tier | Monthly Cost | Notes |
|---------|------|--------------|-------|
| Anthropic API | Pay-per-use | Variable | ~$0.015 per scan (Claude Haiku) |
| Supabase | Free | $0 | 500MB DB, 1GB storage |
| Clerk | Free | $0 | Up to 10K MAU |
| Netlify | Personal Plan | $9.54 | Hosting + domain + DNS (billed 13th) |
| Stripe | Standard | 2.9% + $0.30 | Per transaction |
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

**Score: 8.5/10** (up from 8/10 — Session 40a capped cover-image heights on mobile auction + Buy Now modals so bid details/CTA no longer get pushed below the fold)

| Feature | Status |
|---------|--------|
| PWA installable | ✅ |
| Offline Key Hunt | ✅ |
| Responsive design | ✅ |
| Mobile navigation | ✅ |
| Camera scanning | ✅ |
| Touch interactions | ✅ |
| Mobile auction/listing modal layout | ✅ Fixed Apr 23, 2026 (Session 40a) |
| Haptic feedback | ❌ |
| Batch scanning | ❌ |

---

## 8. Feature Completeness

**Score: 9.4/10** (up from 9.3/10)

| Feature | Status |
|---------|--------|
| Core Collection Management | ✅ Complete |
| AI Cover Recognition | ✅ Complete |
| Listed Value (eBay Browse API) | ✅ Complete |
| Grade-Aware Pricing | ✅ Complete |
| Key Hunt (offline) | ✅ Complete |
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
| Scan Resilience (Multi-Provider) | ✅ Phase 1 Deployed (Mar 3, 2026) |
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
| Auction fees (8%/5%) | Medium | ✅ Ready |
| eBay affiliate links | Low | Not started |

---

## 10. Risk Assessment

### Mitigated Risks ✅
| Risk | Previous | Current |
|------|----------|---------|
| Price credibility | 🔴 Critical | 🟢 Low (eBay API) |
| No competitive moat | 🔴 Critical | 🟢 Low (AI + Auctions + Buy Now) |
| Unsustainable AI costs | 🔴 Critical | 🟢 Low (Redis caching) |
| Security vulnerabilities | 🟡 Medium | 🟢 Low (RLS + rate limiting) |
| No marketplace | 🟡 Medium | 🟢 Low (Auctions + Buy Now) |
| No error tracking | 🔴 High | 🟢 Low (Sentry added) |
| No analytics | 🟡 Medium | 🟢 Low (PostHog added) |

### Active Risks ⚠️
| Risk | Severity | Mitigation |
|------|----------|------------|
| Single AI provider dependency | 🟢 Low | Self-healing model pipeline auto-updates deprecated models. MODEL_PRIMARY on Sonnet 4.5 (`claude-sonnet-4-5-20250929`) pre-empting June 15, 2026 Sonnet 4 retirement. OpenAI + Gemini fallbacks available. |
| Limited deploys | 🟡 Medium | Strategic batching |
| Auction fraud potential | 🟢 Low | **Mitigated Apr 23, 2026**: audit log (20 event types), payment-miss strike system (warn + flag), Zod input validation on 82 routes, hCaptcha on guest scans. Pattern-based bid anomaly detection remains post-launch — see BACKLOG |
| Input validation gaps | 🟢 Low | **Mitigated Apr 23, 2026**: Zod validation sweep closed; remaining risk is basic CSRF + middleware expansion — see BACKLOG |

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
