# Collectors Chest - Comprehensive Evaluation

> **This document is the guiding light for development priorities. It takes precedence over BACKLOG.md.**

*Last Updated: March 20, 2026*

---

## Executive Summary

Collectors Chest is a comic book collection tracking app with AI-powered cover recognition and a new auction marketplace feature. The app is currently in **Private Beta** with public registration disabled.

**Overall Score: 8.8/10**

**Current Status: PRIVATE BETA**
- Site is live at collectors-chest.com
- Public registration is DISABLED (waitlist only)
- Existing accounts (developer) still work
- Guests can use 5 free scans (sign up for 10/month)

**Key Changes Since Last Evaluation:**
- ✅ Fixed all code quality issues (ESLint, viewport metadata, Stripe webhook)
- ✅ Added Sentry error tracking
- ✅ Added rate limiting (Upstash)
- ✅ Added PostHog analytics
- ✅ Added Redis caching (Upstash)
- ✅ Completed "Buy Now" fixed-price listings
- ✅ Enhanced CGC/CBCS cert lookup with full grading details
- ✅ PWA icons fixed (maskable icons, shortcut icons)
- ✅ Offers system API routes
- ✅ Email notifications via Resend
- ✅ **DISABLED PUBLIC REGISTRATION** (private beta mode)
- ⏳ **Premium subscription billing** (code complete, pending Stripe setup)
- ✅ Scan limits for registered users (10/month free, unlimited premium)
- ✅ Feature gating (Key Hunt, CSV Export, Stats, Listings)
- ✅ Pricing page with tier comparison
- ✅ Upgrade modals and trial prompts
- ✅ **Scan Cost Dashboard** — scan_analytics table, per-route cost recording, admin usage page with cost metrics and threshold alerts
- ✅ **Scan Resilience Phase 1** — Multi-provider fallback (Anthropic → OpenAI), provider abstraction layer, per-call fallback, dynamic timeout budget, error classification, 386 tests passing
- ✅ **Scan Resilience monitoring & deploy** — Fallback rate alerting (check-alerts cron), provider health checks (/api/admin/health-check), PostHog provider tracking, deployed to production (Mar 3, 2026)
- ✅ **Scan resilience design reviewed** — 2 rounds of Sr. Engineering review (24 findings incorporated)
- ✅ **Branding finalized** — Tagline ("Scan comics. Track value. Collect smarter.") and mission statement approved and deployed across hero, meta, sign-up, nav, and new About page
- ✅ **About page** — New page with placeholder sections for Our Story, team, and contact info
- ✅ **Mar 6 partner feedback (all 11 items)** — Code fixes for #1-#10, LLC done (#11)
- ✅ **Age verification infinite loop fix** — Redis cache invalidation for modal state
- ✅ **Hidden AI-generated fake "Recent Sales"** from comic detail modals
- ✅ **Guest homepage restored** — Tagline + descriptive blurb for non-logged-in users
- ✅ **CONNECT_REQUIRED error fix** — Raw error replaced with user-friendly message
- ✅ **Show/hide financials toggle** — Collection page + account settings toggle for Cost/Sales/Profit-Loss
- ✅ **Grade sort + grading company filter** — Collection page sorting by grade, grading company filter
- ✅ **Grade multiselect pills** — Stats page grade pills link to filtered collection
- ✅ **Grading company clickable counts** — Stats page counts deep-link to filtered collection
- ✅ **FEEDBACK_MAR_11.md** — Partner meeting document created for Mar 11 session
- ✅ **Legal pages finalized** — All 4 legal pages updated with Twisted Jester LLC business info, replacing all placeholders
- ✅ **Ben-day dots accents** — Added scattered pop art dot patterns to About, Homepage, and Pricing pages
- ✅ **Hottest Books hidden** — Removed from homepage, commented out in navigation (not ready for launch)
- ✅ **Navigation dropdown scroll fix** — More menu now scrollable on short viewports
- ✅ **Mar 18 feedback — all 21 items addressed** (Mar 18, 2026) — 19 done, 1 deferred (native app), 1 deferred (scanning conversation)
- ✅ **Key Info overhaul** — keyInfoSource tracking, year disambiguation for 403+ curated entries, production data migration (117 reviewed, 53 replaced, 12 cleared)
- ✅ **Scanner: SHA-256 image hash** — Fixed Chamber of Chills #13 fallback bug
- ✅ **Scanner: atomic scan limit enforcement** — Fixed race condition allowing >10 scans
- ✅ **Scanner: AI price source persistence** — Price source tracked correctly
- ✅ **Gemini fallback provider** — Claude → Gemini chain, low-confidence auto-fallback, "Cerebro" badge
- ✅ **Metron API integration** — Non-blocking verification layer (8 tests)
- ✅ **Merged system prompt** — Vintage/foil/variant expertise added
- ✅ **Comic Vine year disambiguation** — Cover search includes year for multi-volume titles
- ✅ **UI fixes batch** — Hot Books link, scan limit error, self-follow prevention, logo red fix, notifications overflow, Key Hunt autofocus, scroll-to-top, select button label, financial toggle race condition, Android layout, public page pop-art styling, action buttons wrapping
- ✅ **Unlimited signatures for raw books** — Signature field added for non-slabbed books
- ✅ **Variant detection in scan prompt** — AI now detects variant/edition details
- ✅ **Foil cover UI tip** — Visual indicator for foil covers
- ✅ **Curated DB enrichment** — 16 copper/modern age keys fleshed out with variant/edition details
- ✅ **Admin email updated** — All 4 legal pages updated to admin@collectors-chest.com (Mar 18, 2026)
- ✅ **eBay Browse API migration** — Dead Finding API replaced with Browse API. Real pricing from active eBay listings. 32 files, 33 new tests, 421 total tests passing. Deployed Mar 19, 2026.
- ✅ **eBay Finding API confirmed dead** — Decommissioned Feb 2025, all calls silently failing. Current prices are AI-fabricated (Mar 18, 2026)
- ✅ **"Listed Value" labels** — All "Estimated Value", "AI Estimate", "Technopathic Estimate" labels replaced with "Listed Value" across all components
- ✅ **AI price estimation removed** — All fabricated price code deleted. No more fake prices.
- ✅ **ebayFinding.ts deleted** — 484 lines of dead code removed
- ✅ **CSV export fix** — Base64 image data excluded from Cover Image URL column
- ✅ **Manual entry scroll fix** — Auto-scroll to first field on manual entry
- ✅ **Cover image validation pipeline** — Full implementation complete (Mar 20, 2026). Two-stage pipeline: candidate gathering (Community → eBay → Open Library) + Gemini 2.0 Flash vision validation. Query fix (.ilike→.eq), shared title normalization, Redis cache alignment. 11 commits, 38 new tests (459 total), 15 files changed. DB migration ready (pre-deploy).

---

## 0. Private Beta Checklist (Before Opening Registration)

> **⚠️ DO NOT open registration until these items are complete**

### Critical (Must Have)

| Item | Status | Notes |
|------|--------|-------|
| **Cloud sync for signed-in users** | ✅ Done | Signed-in users now sync to Supabase; guests use localStorage |
| **Form LLC business entity** | ✅ Done | Completed (Mar 11, 2026) |
| Privacy Policy page | ✅ Done | LLC placeholders replaced with Twisted Jester LLC info (Mar 13, 2026) |
| Terms of Service page | ✅ Done | LLC placeholders replaced with Twisted Jester LLC info (Mar 13, 2026) |
| Acceptable Use Policy page | ✅ Done | LLC placeholders replaced with Twisted Jester LLC info (Mar 13, 2026) |
| Cookie & Tracking Policy page | ✅ Done | LLC placeholders replaced with Twisted Jester LLC info (Mar 13, 2026) |
| Premium subscription billing | ⏳ Code complete | Waiting on Stripe account setup |
| Stripe Connect for seller payouts | ⏳ Code complete | Enable Connect in Stripe dashboard, configure Express accounts |
| Age gate (18+) for marketplace | ✅ Done | Age verification modal with Redis cache (Mar 11, 2026) |
| Re-enable Clerk bot protection | ✅ Done | Re-enabled Jan 13, 2026 |

### High Priority

| Item | Status | Notes |
|------|--------|-------|
| Connect waitlist to Resend | ✅ Done | API route created, connected to Resend Contacts |
| Test payment flows end-to-end | ❌ Untested | Auction bids, Buy Now, subscription billing |
| Test Stripe Connect seller flow | ❌ Untested | Seller onboarding, sandbox purchase, verify fee split, test payout to seller bank |
| Database backup strategy | ⚠️ Planned | **Upgrade to Supabase Pro ($25/mo) before opening registration** - daily backups + 7-day retention |
| Rate limit on registered user scans | ✅ Done | Free: 10/month, Premium: unlimited |
| Replace dead eBay Finding API | ✅ Done — Browse API deployed Mar 19, 2026 | Browse API integration plan written + reviewed. Deployed Mar 19, 2026. 32 files affected |

### Medium Priority

| Item | Status | Notes |
|------|--------|-------|
| Enable live Hottest Books API | ⚠️ Static | `USE_STATIC_LIST = true` in production |
| Verify Resend DNS | ✅ Done | Verified Jan 15, 2026 |
| Cost monitoring alerts | ✅ Done | Metadata cache, admin alert badge, PostHog instrumentation (Feb 19, 2026). Scan Cost Dashboard added (Mar 1, 2026) — scan_analytics table, admin usage page with cost metrics & threshold alerts. Deployed Mar 3, 2026. |
| Remove waitlist API debug info | ✅ Done | Removed debug object from error responses |

---

## 1. Code Quality & Technical Debt

**Score: 8/10** (up from 7/10)

### Issues Status

| Issue | Severity | Status |
|-------|----------|--------|
| Test suite | 🟢 Good | 459 tests passing (Mar 20, 2026) |
| ESLint config | 🟢 Fixed | Working with Next.js defaults |
| Viewport/themeColor metadata | 🟢 Fixed | Migrated to `export const viewport` |
| Stripe webhook config export | 🟢 Fixed | Deprecated config removed |
| TypeScript compilation | 🟢 Passing | Clean |
| Production build | 🟢 Passing | Clean |
| Sentry error tracking | 🟢 Added | Production-ready |
| PostHog analytics | 🟢 Added | Tracking enabled |

### Remaining Work

1. ~~**Add test suite**~~ ✅ Done — 421 tests passing (Mar 19, 2026)
2. **Expand test coverage** - Add tests for auction bid logic, authentication flows, payment webhooks

---

## 2. Security Posture

**Score: 8/10** (up from 6/10)

| Item | Status | Notes |
|------|--------|-------|
| RLS policies (core tables) | ✅ Good | Production-ready |
| RLS policies (auction tables) | ✅ Good | Properly configured |
| CCPA deletion webhook | ✅ Good | Clerk webhook exists |
| API authentication | ✅ Good | Clerk auth on protected routes |
| Stripe webhook verification | ✅ Good | Signature validation |
| Rate limiting | ✅ Added | Upstash rate limiting on AI & bid routes |
| Input validation | ⚠️ Basic | Auction routes have validation, others minimal |
| CSRF protection | ⚠️ Implicit | Next.js provides some protection |
| Middleware protection | ⚠️ Minimal | Few routes marked as protected |

### Security Recommendations

**Medium Priority:**
1. Strengthen input validation across all endpoints
2. Add request size limits for image uploads
3. Add audit logging for auction transactions
4. Implement fraud detection for bidding patterns
5. Add CAPTCHA for guest scan limits (prevent bypass)

---

## 3. Auction Feature Evaluation

**Score: 8/10** (up from 7/10)

### What's Working Well
- eBay-style proxy bidding system
- Seller reputation with positive/negative ratings
- Watchlist functionality
- Payment integration via Stripe
- In-app notifications system
- Cron job for processing ended auctions
- Good database schema with RLS
- **Buy Now fixed-price listings** ✅ NEW

### Issues & Gaps

| Issue | Severity | Notes |
|-------|----------|--------|
| No dispute resolution | 🟡 Medium | Need buyer protection |
| Stripe Connect (pending) | 🟡 Medium | Seller payouts via Connect — needs onboarding flow + setup |
| No shipping tracking | 🟡 Medium | Manual coordination |
| Payment deadline enforcement | ⚠️ Unclear | Logic in place but untested |
| Auction sniping protection | ❌ Missing | No auto-extend on last-minute bids |

### Recommendations
1. Implement auction time extension on late bids
2. Add dispute/refund workflow
3. Add shipping integration (EasyPost API)
4. Add auction history/analytics for sellers

---

## 4. User Experience & Onboarding

**Score: 7/10**

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
| Netlify | Free | $0 | 300 build minutes/month |
| Stripe | Standard | 2.9% + $0.30 | Per transaction |
| eBay API | Free | $0 | Rate limited |
| Upstash Redis | Free | $0 | 10K commands/day |
| Sentry | Free | $0 | 5K errors/month |
| PostHog | Free | $0 | 1M events/month |
### Cost Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| AI costs scale with users | 🟡 Medium | ✅ Redis caching implemented |
| Supabase limits | 🟡 Medium | Monitor usage, upgrade path ready |
| Netlify build minutes | 🟡 Medium | Strategic batching |
| eBay rate limits | 🟡 Medium | AI fallback in place |
### Recommendations
1. ~~**Monitor AI costs** - Add usage tracking dashboard~~ ✅ Done (Scan Cost Dashboard — Mar 1, 2026)
2. **Strategic deploys** - Batch changes, use preview for testing
3. **Pre-populate database** - Cache top 5K comics to reduce AI calls

---

## 7. Mobile Experience

**Score: 8/10**

| Feature | Status |
|---------|--------|
| PWA installable | ✅ |
| Offline Key Hunt | ✅ |
| Responsive design | ✅ |
| Mobile navigation | ✅ |
| Camera scanning | ✅ |
| Touch interactions | ✅ |
| Haptic feedback | ❌ |
| Batch scanning | ❌ |

---

## 8. Feature Completeness

**Score: 8.7/10** (up from 8.5/10)

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
| Auction Marketplace | ✅ Complete |
| Fixed-Price Listings (Buy Now) | ✅ Complete |
| CGC/CBCS Cert Lookup | ✅ Enhanced |
| Error Tracking (Sentry) | ✅ Complete |
| Analytics (PostHog) | ✅ Complete |
| Redis Caching | ✅ Complete |
| Rate Limiting | ✅ Complete |
| Subscription Billing | ⏳ Code Complete (needs Stripe) |
| Feature Gating | ✅ Complete |
| Pricing Page | ✅ Complete |
| Scan Cost Dashboard | ✅ Complete |
| Scan Resilience (Multi-Provider) | ✅ Phase 1 Deployed (Mar 3, 2026) |
| Price Alerts | ❌ Not Started |
| Pull Lists | ❌ Not Started |
| Email Notifications | ❌ Not Started |

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
| ~~No tests~~ | ~~🟡 Medium~~ | ✅ 421 tests passing (Mar 19, 2026) |
| Single AI provider dependency | 🟢 Low | Self-healing model pipeline auto-updates deprecated models. OpenAI fallback available. |
| Limited deploys | 🟡 Medium | Strategic batching |
| Auction fraud potential | 🟡 Medium | Add monitoring |

---

## 11. Launch Readiness

### Overall: 95% Ready

#### Blockers (Must Fix Before Launch) 🔴
- [x] ~~Add error tracking (Sentry)~~ ✅ Done
- [x] ~~Fix ESLint configuration~~ ✅ Done
- [x] ~~Fix deprecated viewport metadata~~ ✅ Done
- [x] ~~Add basic test coverage for critical paths~~ ✅ Done
- [x] ~~Rate limiting on API routes~~ ✅ Done

#### Should Have for Launch 🟡
- [x] ~~Analytics (PostHog)~~ ✅ Done
- [x] ~~Email capture for non-converting guests (Resend)~~ ✅ Done
- [x] ~~Complete "Buy Now" listings in Shop~~ ✅ Done
- [x] ~~Redis caching (Upstash)~~ ✅ Done

#### Nice to Have Post-Launch 🟢
- [ ] Price alerts
- [ ] Pull lists
- [ ] Sales trend graphs
- [ ] Shipping integration

---

## 12. Priority Action Items

> **These items take precedence over BACKLOG.md**

### ✅ Recently Completed
- **Self-healing model pipeline** — GitHub Actions daily check, vision probe, auto-update with rollback, single test pass, guardrailed deploy via git push
1. ~~**Fix critical code issues**~~ ✅ (ESLint, viewport, Stripe webhook)
2. ~~**Add Sentry error tracking**~~ ✅
3. ~~**Add rate limiting**~~ ✅ (Upstash)
4. ~~**Add analytics**~~ ✅ (PostHog)
5. ~~**Complete Shop "Buy Now"**~~ ✅
6. ~~**Redis caching (Upstash)**~~ ✅
7. ~~**Enhanced CGC/CBCS cert lookup**~~ ✅
8. ~~**PWA Icons**~~ ✅ (maskable + shortcuts)
9. ~~**Offers System**~~ ✅ (API routes, modals)
10. ~~**Email integration**~~ ✅ (Resend setup)
11. ~~**Disable public registration**~~ ✅ (Private Beta mode)
12. ~~**Real-time messaging fix**~~ ✅ (Supabase Broadcast migration — 7 files, instant messages without refresh)
13. ~~**Notification display fix**~~ ✅ (supabaseAdmin for all read functions, RLS bypass)
14. ~~**Search optimization**~~ ✅ (3 features: fuzzy matching with 34 abbreviations, batch CSV imports, popularity-based suggestions)
15. ~~**Site icon replacement**~~ ✅ (New blue comic-style chest design across all icon files)
16. ~~**FAQ update**~~ ✅ (Ask the Professor expanded to 20 questions, font fix)
17. ~~**Cover image search system**~~ ✅ (Community DB + Open Library + manual URL paste) (Feb 25-26, 2026)
18. ~~**Comic Vine removal from import-lookup**~~ ✅ (Feb 25, 2026)
19. ~~**CSV drag-and-drop fix**~~ ✅ (Feb 25, 2026)
20. ~~**Collection deletion safety**~~ ✅ (Blocks delete if active shop listing) (Feb 25, 2026)
21. ~~**Single delete soft delete + undo toast**~~ ✅ (Feb 25, 2026)
22. ~~**Grade normalization fix**~~ ✅ (Feb 25, 2026)
23. ~~**Footer on all pages**~~ ✅ (Feb 25, 2026)
24. ~~**Delete confirmation overlay modal**~~ ✅ (Feb 25, 2026)
25. ~~**Undo toast timer fix**~~ ✅ (Feb 25, 2026)
26. ~~**Scan Resilience monitoring & deploy**~~ ✅ (Mar 3, 2026) — Fallback rate alerting, provider health checks, PostHog provider tracking, deployed to production
27. ~~**Mar 6 partner feedback — all 11 items**~~ ✅ (Mar 11, 2026) — Code fixes #1-#10, LLC formed #11
28. ~~**Age verification infinite loop fix**~~ ✅ (Mar 11, 2026) — Redis cache invalidation
29. ~~**Hidden AI-generated fake Recent Sales**~~ ✅ (Mar 11, 2026)
30. ~~**Guest homepage restored**~~ ✅ (Mar 11, 2026) — Tagline + descriptive blurb
31. ~~**CONNECT_REQUIRED error fix**~~ ✅ (Mar 11, 2026) — User-friendly message
32. ~~**Show/hide financials toggle**~~ ✅ (Mar 11, 2026) — Collection page + account settings
33. ~~**Grade sort + grading company filter**~~ ✅ (Mar 11, 2026) — Collection page
34. ~~**Grade multiselect pills + grading company deep links**~~ ✅ (Mar 11, 2026) — Stats page
35. ~~**Legal pages — replace LLC placeholders**~~ ✅ (Mar 13, 2026) — All 4 pages updated with Twisted Jester LLC info
36. ~~**Ben-day dots accents across guest pages**~~ ✅ (Mar 13, 2026) — About, Homepage, Pricing
37. ~~**Hottest Books hidden from homepage + nav**~~ ✅ (Mar 13, 2026)
38. ~~**Mar 18 feedback — all 21 items**~~ ✅ (Mar 18, 2026) — 19 done, 1 deferred (native app), 1 deferred (scanning conversation)
39. ~~**Key Info overhaul + production data migration**~~ ✅ (Mar 18, 2026) — keyInfoSource tracking, year disambiguation, 117 comics reviewed
40. ~~**SHA-256 image hash (Chamber of Chills fix)**~~ ✅ (Mar 18, 2026)
41. ~~**Atomic scan limit enforcement**~~ ✅ (Mar 18, 2026) — Fixed race condition
42. ~~**Gemini fallback provider**~~ ✅ (Mar 18, 2026) — Claude → Gemini chain, "Cerebro" badge
43. ~~**Metron API verification layer**~~ ✅ (Mar 18, 2026) — 8 tests
44. ~~**Comic Vine year disambiguation**~~ ✅ (Mar 18, 2026)
45. ~~**Unlimited signatures for raw books**~~ ✅ (Mar 18, 2026)
46. ~~**Variant detection + foil cover UI**~~ ✅ (Mar 18, 2026)
47. ~~**Curated DB enrichment (16 copper/modern keys)**~~ ✅ (Mar 18, 2026)
48. ~~**UI fixes batch (13 items)**~~ ✅ (Mar 18, 2026) — Logo, notifications, autofocus, scroll, Android layout, etc.
49. ~~**Comic Vine barcode lookup removed**~~ ✅ (Mar 18, 2026) — Unreliable external UPC data
50. ~~**AI price estimation disabled**~~ ✅ (Mar 18, 2026) — Was showing fake prices as real data
51. ~~**Gemini provider wired as primary**~~ ✅ (Mar 18, 2026) — Was never actually first despite config
52. ~~**Barcode catalog lookup integrated into scan pipeline**~~ ✅ (Mar 18, 2026)
53. ~~**eBay search query fix for special characters**~~ ✅ (Mar 18, 2026)
54. ~~**eBay Browse API migration**~~ ✅ (Mar 19, 2026)
55. ~~**"Listed Value" labels across all components**~~ ✅ (Mar 19, 2026)
56. ~~**AI price estimation removed**~~ ✅ (Mar 19, 2026)
57. ~~**ebayFinding.ts deleted**~~ ✅ (Mar 19, 2026)
58. ~~**CSV base64 export fix**~~ ✅ (Mar 19, 2026)
59. ~~**Manual entry scroll fix**~~ ✅ (Mar 19, 2026)
60. ~~**eBay Developer account verified**~~ ✅ (Mar 19, 2026)

### Recommended Next Steps
1. **Implement cover image validation pipeline** — Design spec complete, implementation plan needed. Fixes wrong cover images across the app.
2. **Re-price existing collection** — After Browse API deploy, existing comics show no price. Need mechanism to refresh prices on demand or via batch.
3. **Session 21 feedback re-test** — 3 items still broken, 8 need retest from production mobile testing
4. **Validate Gemini as primary provider in production**
5. **Stripe account setup + payment testing**

### 🔴 Before Opening Registration (See Section 0)

1. ~~**Form LLC Business Entity**~~ ✅ DONE (Mar 11, 2026)

2. **Legal pages (ToS, Privacy, AUP, Cookies)** ✅ DONE (Mar 13, 2026)
   - ✅ Full content written for all 4 pages (`/privacy`, `/terms`, `/acceptable-use`, `/cookies`)
   - ✅ All content verified accurate against codebase (18/20 claims exact match)
   - ✅ Cross-linked footers on all 4 pages
   - ✅ **Legal update briefing created** (Feb 27, 2026) — covers Creator Credits, Community Cover DB, Age Verification, Google CSE removal. Saved to `Legal Docs/Legal_Update_Briefing_Feb_2026.md`. Ready for lawyer review.
   - ✅ All placeholders replaced with Twisted Jester LLC info (Mar 13, 2026)
   - ⏳ Implement 3-listing cap for free users (referenced in ToS but not yet enforced)
   - ⏳ **Pending lawyer review** of briefing before finalizing legal page updates

3. **Premium subscription billing** ⏳ CODE COMPLETE
   - ✅ Database migration (subscription fields, scan tracking, fee columns)
   - ✅ Core logic (`src/lib/subscription.ts`)
   - ✅ Billing API routes (checkout, portal, status)
   - ✅ Stripe webhook handlers
   - ✅ Scan enforcement (guest 5, free 10/month)
   - ✅ Feature gating (Key Hunt, CSV Export, Stats, Listings)
   - ✅ UI components (pricing page, upgrade modal, trial prompts)
   - ✅ Transaction fees (8% free, 5% premium)
   - ⏳ **Waiting on:** Stripe account setup (see BACKLOG.md)
   - ⏳ Stripe Connect setup for seller payouts (onboarding flow, payout configuration)

4. **Test payment flows end-to-end**
   - Test auction bid flow
   - Test Buy Now flow
   - Test Stripe webhooks
   - Test Stripe Connect seller onboarding and payout flow
   - Effort: 0.5 session

### 🟠 Feb 5 Feedback Items (21 items — see FEEDBACK_FEB_5.md)

**Session 6 Progress:** 17 Tested, 2 Completed — Needs Testing, 1 Pinned, 1 Closed

✅ Tested: #1, #3, #4, #5, #8, #9, #10, #11, #12, #13, #14, #16, #18, #19, #21
✅ Completed & Verified: #6 (key info notifications), #7 (Creator Credits updates, formerly "reputation")
✅ Completed & Verified: #17 (real-time messaging — migrated to Broadcast), #20 (notification icon — supabaseAdmin fix)
📌 Pinned: #2 (wrong covers — needs specific examples)
✅ Closed: #15 (trial button believed working)

**Remaining work:**
- ✅ **#6 & #7 verified** (Feb 19): Key info approval notifications and Creator Credits increment (formerly "reputation") — both passing
- **Investigation needed**: Wrong cover images (#2 — needs specific examples from user)

### 🟠 Feb 10 Mobile Testing Feedback (14 items — all resolved)

✅ All 14 items fixed and deployed. User confirmed all tested/working.

Items addressed:
1. Share modal copy button overflow on mobile
2. Public profile "Marvel Comics" stat overflow
3. Mobile message badge (unread count in MobileNav)
4. Messages landing page auto-select on mobile
5. Inquiry message details + clickable URLs in messages
6. Report flag visibility (yellow → red)
7. Admin menu missing from mobile nav + admin nav layout
8. Collection filters mobile layout
9. Shop page pop-art styling
10. Shop dropdown chevron visibility
11. Shop tab button sizing
12. Account settings pop-art styling
13. Key Hunt routing for non-premium users
14. Technopathic estimate duplicate text

### ✅ Feb 13 Session Completed

- **Admin Key Info Management** - Custom key info sandboxing, CRUD for key_comics database, unified review tab
- **Fixed critical bug** - Custom key info not saving on comic updates (missing fields in updateComic)
- **Fixed stats** - Approved/Rejected counts now combine both submission sources

### ✅ Feb 18 Session Completed

- **Real-time messaging** - Migrated to Supabase Broadcast (7 files), instant messages without refresh
- **Notification display fix** - supabaseAdmin for all read functions, bypasses RLS
- **Search optimization** - Abbreviation expansion (34 abbrevs), batch CSV imports, popularity-based suggestions
- **Site icons** - New blue comic-style chest design replacing old brown chest
- **FAQ update** - Ask the Professor expanded to 20 questions with font fix
- **Per-item approve/reject** - Custom key info with color-coded buttons
- **Bug fixes** - Model IDs centralized, nav dropdown active state, DB constraint for partially_approved
- **18 new unit tests** (248 total)

### ✅ Feb 27 Session Completed

- **Legal update briefing for lawyer** - Created comprehensive briefing covering Creator Credits system, Community Cover Database, Age Verification data, Google CSE removal. Saved to `Legal Docs/Legal_Update_Briefing_Feb_2026.md`.
- **Close Up Shop skill rewrite** - Rewrote end-of-session skill to prevent skipped steps — added mandatory task tracking, concrete grep commands for code cleanup, verification checkpoints.

### ✅ Mar 1 Session Completed

- **Scan Cost Dashboard** - Added `scan_analytics` table, recording cost data across all AI routes (analyze, quick-lookup, con-mode-lookup, titles/suggest). Admin usage page with cost metrics, provider breakdown, and configurable threshold alerts.
- **Scan Resilience Phase 1** - Multi-provider fallback system (Anthropic primary → OpenAI secondary). Provider abstraction layer, per-call fallback, dynamic timeout budget, error classification (transient vs permanent). 370 tests passing.
- **Scan resilience design review** - 2 rounds of Senior Engineering review with 24 findings incorporated into the design and implementation.
- **Remaining scan resilience work** added to BACKLOG as "Finish Scan Resilience" — OpenAI API key setup, Netlify env vars, prompt compatibility study, end-to-end testing, deploy, fallback rate email alerts (Tier 1), model health check probes (Tier 2).
- **Deployed Mar 3, 2026** — scan resilience + scan cost dashboard shipped to production

### ✅ Mar 3 Session Completed

- **Fallback rate alerting** — Added to check-alerts cron (warning threshold 10%, critical threshold 25%), email notifications on breach
- **Provider health check route** — `/api/admin/health-check` probes AI providers directly and sends email alerts on failures
- **PostHog scan tracking enhanced** — Provider name and fallback metadata now included in scan events
- **Deployed to production** — Scan resilience + scan cost dashboard shipped; Supabase migration for scan_analytics provider columns run in production
- **386 tests passing** (16 new this session)

### ✅ Mar 6 Session Completed

- **Fixed "Start Free Trial" button non-responsive on stats page** — FeatureGate loading/error states were preventing button interaction
- **Fixed cover lightbox not showing on mobile** — ComicDetailModal cover image tap now opens lightbox correctly
- **Created FEEDBACK_MAR_6.md** — 10 feedback items documented from partner testing session

### ✅ Mar 11 Session Completed (Session 19)

- **All 11 Mar 6 partner feedback items addressed** — #1-#10 code fixes, #11 LLC formed
- **Age verification modal infinite loop fix** — Redis cache invalidation resolved infinite re-render
- **Hidden AI-generated fake "Recent Sales"** — Removed misleading AI-fabricated sales data from comic detail modals
- **Guest homepage restored** — Tagline and descriptive blurb visible for non-logged-in users
- **CONNECT_REQUIRED error fix** — Raw Stripe error replaced with user-friendly message
- **Show/hide financials toggle** — New toggle in collection page and account settings to hide Cost, Sales, and Profit-Loss columns
- **Grade sort + grading company filter** — Collection page can now sort by grade and filter by grading company
- **Grade multiselect pills** — Stats page grade pills now link to filtered collection views
- **Grading company clickable counts** — Stats page grading company counts deep-link to filtered collection
- **FEEDBACK_MAR_11.md created** — Partner meeting document for upcoming session

### ✅ Mar 13 Session Completed (Session 20)

- **Legal pages finalized** — All 4 legal pages (Privacy Policy, Terms of Service, Acceptable Use Policy, Cookie & Tracking Policy) updated with Twisted Jester LLC business info, replacing all placeholders
- **Ben-day dots accents** — Added scattered pop art dot patterns to About, Homepage, and Pricing pages
- **Hottest Books removed from homepage, commented out in navigation** — Feature not ready for launch
- **Navigation dropdown scroll fix** — More menu now scrollable on short viewports
- **About page placeholder text highlighted in red** — Outstanding placeholder sections visually flagged for future content

### 🟡 Next Session Focus (Session 21)

1. **Make Publisher clickable on Stats page** (NEW BIZ #6 from Mar 11 feedback)
   - Publisher counts on stats page should link to filtered collection view
   - Similar pattern to grading company clickable counts completed in session 19

2. **Investigate empty public collection for @jsnaponte** (NEW BIZ #5 from Mar 11 feedback)
   - User reports their public collection appears empty
   - Debug data visibility / sharing permissions

3. **Stripe account setup + payment testing**
   - Set up Stripe account with LLC info
   - Test auction bid flow, Buy Now flow, webhooks
   - Set up Stripe Connect for seller payouts
   - Effort: ~1 session

4. **Database backup strategy**
   - Evaluate Supabase Pro ($25/mo) for daily backups + 7-day retention
   - Critical before opening registration

5. **Launch tracker review** (NEW BIZ #1 from Mar 11 feedback)
   - Review private beta checklist and assess readiness to open registration
   - LLC done, age gate done, legal pages done — remaining blockers: Stripe, backups

6. **Implement auto-harvest cover images from graded book scans** (design doc exists)
   - Design doc: `docs/plans/2026-02-25-cover-image-harvesting-design.md`
   - Harvest cover images from graded book scans during AI analysis
   - Feeds into community cover DB (primary cover source)

7. **Fill in About page content** (Medium Priority)
   - Write "Our Story" section with founding narrative
   - Add "Meet the Team" bios and photos
   - Complete "Contact" section with support email / form

8. **Add "Professor" Persona Throughout Site**
   - Extend the Ask the Professor concept to other areas of the app
   - Consistent branding for AI-powered features

9. **Test self-healing pipeline failure path**
   - Use a fake/invalid model ID to trigger the full discover → update → deploy → smoke test flow
   - Verify rollback behavior works correctly when the vision probe fails

### ✅ Completed Focus Items (Archived)

- ~~**Address Mar 6 Partner Feedback**~~ ✅ All 11 items completed (Mar 11, 2026)
- ~~**Scan Resilience: Multi-Provider Fallback**~~ ✅ Phase 1 DEPLOYED (Mar 3, 2026)
- ~~**Configure PostHog Dashboard**~~ ✅ SUPERSEDED by Scan Cost Dashboard (Mar 1, 2026)
- ~~**Verify external image search API**~~ ❌ REMOVED (Feb 26, 2026) — pivoted to community DB + Open Library + manual paste
- ~~**Revisit beta mode planning**~~ → Rolled into Launch tracker review (#6 above)

### ✅ Feb 25 Session Completed

- **Cover image search system** - Community cover DB + Open Library API + manual URL paste
- **Collection deletion safety** - Blocks delete if active shop listing exists
- **Single delete soft delete + undo toast** - Non-destructive deletion with undo option
- **CSV drag-and-drop fix** - Resolved file upload issues
- **Grade normalization fix** - Consistent grade handling
- **Footer on all pages** - Site-wide footer added
- **Delete confirmation overlay modal** - User confirmation before destructive actions
- **Undo toast timer fix** - Corrected countdown behavior
- **Comic Vine removal** - Removed from import-lookup, replaced by community DB + Open Library
- **Deployed Feb 25, 2026**

### ✅ Previously Completed Focus Items

1. **Reactivate Sentry Error Tracking** ✅ Complete (Feb 19, 2026)
   - Reactivated on free Developer plan (5K errors/month)
   - Added SENTRY_DSN + NEXT_PUBLIC_SENTRY_DSN to Netlify environment variables

2. **Cover Image Search for CSV Import** ✅ Complete (Feb 25-26, 2026)
   - Community cover database (cover_images table) with admin approval
   - Open Library API for cover lookups
   - Manual URL paste → community cover submission with Creator Credits
   - CoverReviewQueue modal after CSV import
   - Admin cover queue page at /admin/cover-queue
   - Removed Comic Vine API from import-lookup
   - Single-match auto-approve; multi-match goes to admin queue
   - **Note:** No external image search APIs available; using community DB + Open Library + manual paste.

3. **Messaging Phases 2-7** ✅ COMPLETE (Jan 28)
   - Phase 1: Basic DMs ✅
   - Phase 2: Rich Content (images, embedded listings) ✅
   - Phase 3: Block & Report ✅
   - Phase 4: Notification Preferences ✅
   - Phase 5: Real-time Updates ✅
   - Phase 6: Admin Moderation Dashboard ✅
   - Phase 7: AI-Assisted Moderation ✅

4. **Book Trading Feature** ✅ COMPLETE (Jan 28)
   - ✅ Mark comics as "For Trade" from collection
   - ✅ For Trade tab in Shop showing tradeable comics
   - ✅ Hunt List matching system with quality scoring
   - ✅ TradeProposalModal for multi-comic trades
   - ✅ Full trade workflow (propose → accept → ship → complete)
   - ✅ Automatic ownership swap on completion
   - ✅ Auto-remove from Hunt List when received
   - ✅ /trades page with Matches, Active, History tabs
   - ✅ Trades link in navigation

### Post-Launch Revisit Items

> Consolidated list of features and improvements deferred to post-launch. Review after initial traction.

| # | Item | Category | Notes |
|---|------|----------|-------|
| 1 | PayPal/Venmo payment options | Payments | Revisit if users request alternative payment methods |
| 2 | Price alerts | Feature | Key Collector differentiator — notify when values spike/drop |
| 3 | Pull lists | Feature | Series tracking with auto-add for new issues |
| 4 | Sales trend graphs | Feature | CovrPrice-style visual price history |
| 5 | Shipping integration (EasyPost) | Marketplace | Label generation, tracking numbers |
| 6 | Dispute/refund workflow | Marketplace | Buyer protection for bad transactions |
| 7 | Auction sniping protection | Marketplace | Auto-extend on last-minute bids |
| 8 | Demo mode for guests | Onboarding | Explore app with sample data before scanning |
| 9 | Social proof / testimonials | Marketing | User reviews on homepage |
| 10 | Native mobile apps (iOS/Android) | Platform | Capacitor or React Native wrapper — needs developer accounts post-LLC |
| 11 | Dedicated barcode scanning | Feature | Re-enable when barcode catalog reaches 5,000+ verified entries |
| 12 | Dynamsoft Barcode Reader SDK | Feature | Evaluate if html5-qrcode proves unreliable at scale |
| 13 | Customizable initial message | Messaging | Let users edit "I'm interested" default when messaging sellers |
| 14 | Professor persona expansion | UX | Tips, empty states, loading messages throughout app |
| 15 | Expand to all collectibles | Platform | Funko Pops, sports cards, trading cards, etc. |
| 16 | Custom email templates (Clerk) | Branding | Match email formatting to Collectors Chest design |
| 17 | Copy polish pass | UX | Comprehensive review of all user-facing text |
| 18 | Search by creative team | Feature | Deferred — Marvel API no longer available |

---

## 13. Score History

| Date | Overall Score | Key Changes |
|------|---------------|-------------|
| Jan 9, 2026 (AM) | 3.6/10 | Initial evaluation |
| Jan 9, 2026 (PM) | 6.6/10 | +Stats, +Export, +Offline, +Sharing, +PWA, +RLS |
| Jan 11, 2026 (AM) | 6.8/10 | +Auctions, +Payments, -Code quality issues identified |
| Jan 11, 2026 (PM) | 8.2/10 | +Sentry, +PostHog, +Rate limiting, +Redis cache, +Buy Now, +CGC/CBCS enhancements, Fixed all code quality issues |
| Jan 15, 2026 | 8.4/10 | +Premium subscription billing (code complete), +Scan limits for registered users, +Feature gating, +Pricing page |
| Feb 25, 2026 | 8.4/10 | +Cover image search (community DB + Open Library), +Collection deletion safety, +Soft delete with undo, +Grade normalization, +Footer, +CSV fix. Deployed Feb 25, 2026 |
| Feb 27, 2026 | 8.4/10 | +Legal update briefing for lawyer review, +Close Up Shop skill rewrite with mandatory tracking |
| Mar 1, 2026 | 8.5/10 | +Scan Cost Dashboard (admin usage page with cost metrics & alerts), +Scan Resilience Phase 1 (multi-provider fallback, 370 tests), +2 rounds Sr. Engineering design review |
| Mar 3, 2026 | 8.5/10 | +Scan resilience deployed with monitoring (fallback rate alerting, provider health checks, PostHog provider tracking), +386 tests |
| Mar 6, 2026 | 8.5/10 | +Fixed Start Free Trial button, +Fixed cover lightbox on mobile, +Created FEEDBACK_MAR_6.md |
| Mar 11, 2026 | 8.7/10 | +All 11 Mar 6 feedback items, +LLC formed, +Age gate, +Show/hide financials, +Grade sort/filter, +Grading company deep links, +Guest homepage fix |
| Mar 13, 2026 | 8.7/10 | +Legal pages finalized, +Ben-day dots polish, +Hottest Books hidden |
| Mar 19, 2026 | 8.8/10 | +eBay Browse API (real pricing), +Listed Value labels, +AI estimation removed, +CSV fix, +Manual entry scroll |

---

## 14. Performance & Cost Optimization Plan

> **Added: January 21, 2026** - Comprehensive optimization to improve response times, reduce costs, and consolidate services.

### Overview

| Metric | Current | Target | Impact |
|--------|---------|--------|--------|
| Anthropic cost/scan | ~$0.015 | ~$0.008 | 47% reduction |
| Scan response time | 4-8 seconds | 1-2 seconds | 75% faster |
| Profile DB queries/session | ~25 | ~5 | 80% reduction |
| Services with dual implementations | 3 | 0 | Cleaner codebase |

---

### Phase 1: Quick Wins (1-2 hours) ✅ COMPLETED

| Task | File(s) | Impact | Status |
|------|---------|--------|--------|
| Reduce Anthropic max_tokens allocations | `/src/app/api/analyze/route.ts` | 10-15% cost savings | ✅ Done |
| Switch title suggestions to Haiku model | `/src/app/api/titles/suggest/route.ts` | 60% cost on endpoint | ✅ Done |
| Fix duplicate query in admin/usage | `/src/app/api/admin/usage/route.ts` | Fewer DB calls | ✅ Done |
| Remove broken in-memory cache | `/src/app/api/con-mode-lookup/route.ts` | Fixes non-functional code | ✅ Done |

---

### Phase 2: Medium Effort (3-4 hours) ✅ COMPLETED

| Task | File(s) | Impact | Status |
|------|---------|--------|--------|
| Combine Anthropic Calls 2+3+4 | `/src/app/api/analyze/route.ts` | 30-35% cost savings | ✅ Done |
| Add image hash caching for AI analysis | `/src/app/api/analyze/route.ts`, `/src/lib/cache.ts` | 5-10% savings on retries | ✅ Done |
| Add barcode lookup caching (Comic Vine) | `/src/app/api/barcode-lookup/route.ts` | Prevent repeat API calls | ✅ Done |
| Add cert lookup caching (CGC/CBCS) | `/src/lib/certLookup.ts` | Permanent cache for immutable data | ✅ Done |

---

### Phase 3: Architecture (4-6 hours) ✅ COMPLETED

| Task | File(s) | Impact | Status |
|------|---------|--------|--------|
| Remove Supabase cache layer (use Redis only) | `/src/app/api/analyze/route.ts`, `/src/app/api/ebay-prices/route.ts` | Simpler, faster | ✅ Done |
| Consolidate eBay API implementations | Deleted `/src/lib/ebay.ts`, kept `/src/lib/ebayFinding.ts` | 568 lines removed | ✅ Done |
| Add profile caching layer | `/src/lib/db.ts`, `/src/lib/cache.ts` | 5-min Redis cache | ✅ Done |
| Implement ISR for hot books | `/src/app/hottest-books/page.tsx`, `/src/lib/hotBooksData.ts` | 1-hour revalidation | ✅ Done |
| Fix hottest-books internal HTTP call | `/src/app/api/hottest-books/route.ts` | Direct library call | ✅ Done |

---

### Phase 4: Final Polish ✅ COMPLETED

| Task | File(s) | Impact | Status |
|------|---------|--------|--------|
| Add database performance indexes | `/supabase/migrations/20260121_performance_indexes.sql` | Faster queries | ✅ Done |
| Add title autocomplete caching | `/src/app/api/titles/suggest/route.ts` | Reduce AI calls | ✅ Done |

---

### Service Consolidation Plan ✅ COMPLETED

**Resolved Redundancies:**

| Situation | Resolution | Status |
|-----------|------------|--------|
| Dual eBay cache (Redis + Supabase) | Redis only | ✅ Done |
| Dual eBay APIs (Browse + Finding) | Single Finding API implementation | ✅ Done |
| Broken in-memory cache (con-mode-lookup) | Removed | ✅ Done |
| Broken in-memory cache (titles/suggest) | Replaced with Redis | ✅ Done |

**Services to Keep:**
- ✅ Supabase - Database (remove caching role)
- ✅ Clerk - Auth
- ✅ Stripe - Payments
- ✅ Anthropic - AI (optimize usage)
- ✅ Upstash Redis - Caching & rate limiting
- ✅ Resend - Email
- ✅ PostHog - Analytics
- ⚠️ Sentry - Error tracking (evaluate usage)

---

### Caching Strategy (Target State)

| Data | Cache Location | TTL | Notes |
|------|----------------|-----|-------|
| eBay prices | Redis only | 24 hours | Remove Supabase cache |
| Comic metadata | Redis | 7 days | Keep existing |
| AI analysis | Redis (by image hash) | 30 days | NEW - add caching |
| Barcode lookups | Redis | 6 months | NEW - immutable data |
| Cert lookups | Redis | Permanent | NEW - certificates don't change |
| User profiles | Redis | 5-10 minutes | NEW - session-level cache |
| Title autocomplete | Redis | 24 hours | NEW - reduce AI calls |

---

### Anthropic API Optimization Details

**Current Flow (4+ calls per scan):**
```
1. Image Analysis (always) - 1024 tokens
2. Creator Lookup (if missing) - 512 tokens
3. Verification (if missing) - 512 tokens
4. Key Info (if not in DB) - 1024 tokens
5. Price Estimation (if eBay fails) - 1024 tokens
```

**Optimized Flow (1-2 calls per scan):**
```
1. Image Analysis (always) - 1024 tokens
2. Combined Verification (if missing) - 512 tokens (merges calls 2+3+4)
3. Price Estimation (if eBay fails) - 512 tokens
```

**Token Allocation Changes:**
| Call | Current max_tokens | Optimized | Actual usage |
|------|-------------------|-----------|--------------|
| Image Analysis | 1024 | 1024 | ~400 tokens |
| Creator Lookup | 512 | MERGED | ~100 tokens |
| Verification | 512 | MERGED | ~150 tokens |
| Key Info | 1024 | MERGED | ~100 tokens |
| Combined Verification | N/A | 512 | ~300 tokens |
| Price Estimation | 1024 | 512 | ~200 tokens |

---

### Database Index Recommendations

Add these indexes for faster queries:
```sql
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_key_hunt_lists_lookup ON key_hunt_lists(title_normalized, issue_number, user_id);
CREATE INDEX idx_hot_books_updated ON hot_books(prices_updated_at);
CREATE INDEX idx_comics_profile_created ON comics(profile_id, created_at);
```

---

### Success Metrics

| Metric | Before | After | Measurement |
|--------|--------|-------|-------------|
| Anthropic cost/scan | $0.015 | $0.008 | Admin usage dashboard |
| Scan response time | 4-8s | 1-2s | PostHog timing events |
| Cache hit rate | ~30% | ~70% | Redis metrics |
| DB queries/session | ~25 | ~5 | Supabase logs |

---

## Appendix A: Architecture Overview

### Tech Stack
- **Frontend:** Next.js 16.1.1, React 18, Tailwind CSS
- **Backend:** Next.js API Routes, Supabase
- **Auth:** Clerk
- **Payments:** Stripe
- **AI:** Anthropic Claude primary, OpenAI fallback (cover recognition, search query generation) — multi-provider resilience layer
- **Cover Image Search:** Community cover DB + Open Library API + manual URL paste
- **Hosting:** Netlify

### Database Tables
- `profiles` - User accounts (+ subscription fields)
- `comics` - Collection items
- `lists` - Custom lists
- `comic_lists` - Junction table
- `sales` - Sale records
- `comic_metadata` - Shared lookup cache
- `ebay_price_cache` - eBay price cache
- `auctions` - Auction listings (+ seller_tier, platform_fee_percent)
- `bids` - Bid history
- `auction_watchlist` - User watchlists
- `seller_ratings` - Reputation system
- `notifications` - In-app notifications
- `scan_usage` - Scan tracking for analytics
- `scan_analytics` - Scan cost tracking per AI call (provider, model, tokens, cost, route) (NEW - Mar 1, 2026)

### API Routes (33 total)
- 9 core routes (analyze, lookup, import, etc.)
- 8 auction routes (CRUD, bidding, watchlist)
- 4 webhook routes (Clerk, Stripe, cron)
- 9 supporting routes (notifications, ratings, etc.)
- 3 cover image routes (cover-candidates, cover-images, admin/cover-queue)

---

## Appendix B: Competitor Research Sources

- [CLZ Comics](https://clz.com/comics) - Barcode scanning, CovrPrice integration
- [Key Collector Comics](https://www.keycollectorcomics.com/) - Price alerts, hot keys
- [CovrPrice](https://covrprice.com/) - FMV pricing, sales trends
