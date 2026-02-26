# Collectors Chest - Comprehensive Evaluation

> **This document is the guiding light for development priorities. It takes precedence over BACKLOG.md.**

*Last Updated: January 28, 2026*

---

## Executive Summary

Collectors Chest is a comic book collection tracking app with AI-powered cover recognition and a new auction marketplace feature. The app is currently in **Private Beta** with public registration disabled.

**Overall Score: 8.4/10**

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

---

## 0. Private Beta Checklist (Before Opening Registration)

> **⚠️ DO NOT open registration until these items are complete**

### Critical (Must Have)

| Item | Status | Notes |
|------|--------|-------|
| **Cloud sync for signed-in users** | ✅ Done | Signed-in users now sync to Supabase; guests use localStorage |
| **Form LLC business entity** | ❌ Missing | Required for liability protection & legal pages |
| Privacy Policy page | ⏳ Content ready | Full content written; placeholders need LLC info |
| Terms of Service page | ⏳ Content ready | Full content written; placeholders need LLC info |
| Acceptable Use Policy page | ⏳ Content ready | Full content written; placeholders need LLC info |
| Cookie & Tracking Policy page | ⏳ Content ready | Full content written; placeholders need LLC info |
| Premium subscription billing | ⏳ Code complete | Waiting on Stripe account setup |
| Stripe Connect for seller payouts | ⏳ Code complete | Enable Connect in Stripe dashboard, configure Express accounts |
| Age gate (18+) for marketplace | ❌ Missing | Buying, selling, bidding, and trading require users to be 18+. Enforce at account level or marketplace entry. |
| Re-enable Clerk bot protection | ✅ Done | Re-enabled Jan 13, 2026 |

### High Priority

| Item | Status | Notes |
|------|--------|-------|
| Connect waitlist to Resend | ✅ Done | API route created, connected to Resend Contacts |
| Test payment flows end-to-end | ❌ Untested | Auction bids, Buy Now, subscription billing |
| Test Stripe Connect seller flow | ❌ Untested | Seller onboarding, sandbox purchase, verify fee split, test payout to seller bank |
| Database backup strategy | ⚠️ Planned | **Upgrade to Supabase Pro ($25/mo) before opening registration** - daily backups + 7-day retention |
| Rate limit on registered user scans | ✅ Done | Free: 10/month, Premium: unlimited |

### Medium Priority

| Item | Status | Notes |
|------|--------|-------|
| Enable live Hottest Books API | ⚠️ Static | `USE_STATIC_LIST = true` in production |
| Verify Resend DNS | ✅ Done | Verified Jan 15, 2026 |
| Cost monitoring alerts | ✅ Done | Metadata cache, admin alert badge, PostHog instrumentation (Feb 19, 2026) |
| Remove waitlist API debug info | ✅ Done | Removed debug object from error responses |

---

## 1. Code Quality & Technical Debt

**Score: 7/10** (up from 4/10)

### Issues Status

| Issue | Severity | Status |
|-------|----------|--------|
| No test suite (`npm test` fails) | 🟡 Medium | Missing |
| ESLint config | 🟢 Fixed | Working with Next.js defaults |
| Viewport/themeColor metadata | 🟢 Fixed | Migrated to `export const viewport` |
| Stripe webhook config export | 🟢 Fixed | Deprecated config removed |
| TypeScript compilation | 🟢 Passing | Clean |
| Production build | 🟢 Passing | Clean |
| Sentry error tracking | 🟢 Added | Production-ready |
| PostHog analytics | 🟢 Added | Tracking enabled |

### Remaining Work

1. **Add test suite** - Important for preventing regressions
   ```
   npm install -D jest @testing-library/react @testing-library/jest-dom
   ```
   - Test auction bid logic
   - Test authentication flows
   - Test payment webhooks

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

**Score: 7/10** (up from 5/10)

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
| Google CSE | Free (100/day) | $0 | $5/1000 queries after free tier (100/day included) |

### Cost Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| AI costs scale with users | 🟡 Medium | ✅ Redis caching implemented |
| Supabase limits | 🟡 Medium | Monitor usage, upgrade path ready |
| Netlify build minutes | 🟡 Medium | Strategic batching |
| eBay rate limits | 🟡 Medium | AI fallback in place |
| Google Cloud billing | 🟢 Low | Personal card linked — switch to business after LLC formed |

### Recommendations
1. **Monitor AI costs** - Add usage tracking dashboard
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

**Score: 8.5/10** (up from 8/10)

| Feature | Status |
|---------|--------|
| Core Collection Management | ✅ Complete |
| AI Cover Recognition | ✅ Complete |
| Price Estimates (eBay) | ✅ Complete |
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
| No tests | 🟡 Medium | Add test suite |
| Limited deploys | 🟡 Medium | Strategic batching |
| Auction fraud potential | 🟡 Medium | Add monitoring |

---

## 11. Launch Readiness

### Overall: 92% Ready

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

### 🔴 Before Opening Registration (See Section 0)

1. **Form LLC Business Entity** ⭐ CRITICAL (DO FIRST)
   - Protects personal assets for marketplace liability
   - Required before finalizing ToS & Privacy Policy
   - ~$100-300 filing fee + potential annual fees
   - Effort: 30 min online, 1-2 weeks processing

2. **Legal pages (ToS, Privacy, AUP, Cookies)** (PARTIALLY BLOCKED BY #1)
   - ✅ Full content written for all 4 pages (`/privacy`, `/terms`, `/acceptable-use`, `/cookies`)
   - ✅ All content verified accurate against codebase (18/20 claims exact match)
   - ✅ Cross-linked footers on all 4 pages
   - ⏳ Placeholder fields remain: [LEGAL BUSINESS NAME], [ADDRESS], [SUPPORT EMAIL], [DATE], [STATE], [STATE/COUNTY]
   - ⏳ Replace placeholders once LLC is formed (see BACKLOG.md)
   - ⏳ Implement 3-listing cap for free users (referenced in ToS but not yet enforced)

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
✅ Completed & Verified: #6 (key info notifications), #7 (reputation updates)
✅ Completed & Verified: #17 (real-time messaging — migrated to Broadcast), #20 (notification icon — supabaseAdmin fix)
📌 Pinned: #2 (wrong covers — needs specific examples)
✅ Closed: #15 (trial button believed working)

**Remaining work:**
- ✅ **#6 & #7 verified** (Feb 19): Key info approval notifications and reputation increment — both passing
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

### 🟡 Next Session Focus

1. **Reactivate Sentry Error Tracking** ✅ Complete
   - Reactivated on free Developer plan (5K errors/month)
   - Added SENTRY_DSN + NEXT_PUBLIC_SENTRY_DSN to Netlify environment variables
   - Verified error reporting is working end-to-end

2. **GoCollect API Integration** ⏸️ BLOCKED
   - ✅ API token created (Jan 27)
   - ✅ `GOCOLLECT_API_KEY` added to `.env.local` and Netlify
   - ⏳ **Waiting on GoCollect to approve API access** (ticket open)
   - ⏳ Review API documentation for endpoints (blocked)
   - ⏳ Implement FMV lookup integration
   - ⏳ Add GoCollect pricing alongside eBay prices

3. **Cover Image Search for CSV Import** ✅ Complete
   - Community cover database (cover_images table) with admin approval
   - Claude-powered search query generation + Google Custom Search
   - CoverReviewQueue modal after CSV import
   - Admin cover queue page at /admin/cover-queue
   - Removed Comic Vine API from import-lookup
   - Single-match auto-approve; multi-match goes to admin queue

4. **Marvel API Integration** ⏸️ BLOCKED
   - ⏳ **Waiting on Marvel developer portal access**
   - ⏳ Integrate comic metadata, covers, and creator info
   - ⏳ Supplement AI recognition with Marvel database lookups

5. **Add "Professor" Persona Throughout Site**
   - Extend the Ask the Professor concept to other areas of the app
   - Consistent branding for AI-powered features

6. **Configure PostHog Dashboard with Scan Cost Insights and Email Alerts**
   - Set up PostHog dashboard with scan cost metrics (cost per scan, daily/weekly spend)
   - Configure email alerts for spending thresholds
   - Visualize cache hit rates and AI call patterns

### ✅ Previously Completed Focus Items

1. **Messaging Phases 2-7** ✅ COMPLETE (Jan 28)
   - Phase 1: Basic DMs ✅
   - Phase 2: Rich Content (images, embedded listings) ✅
   - Phase 3: Block & Report ✅
   - Phase 4: Notification Preferences ✅
   - Phase 5: Real-time Updates ✅
   - Phase 6: Admin Moderation Dashboard ✅
   - Phase 7: AI-Assisted Moderation ✅

2. **Book Trading Feature** ✅ COMPLETE (Jan 28)
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
| 18 | Search by creative team | Feature | Requires Marvel API integration |

---

## 13. Score History

| Date | Overall Score | Key Changes |
|------|---------------|-------------|
| Jan 9, 2026 (AM) | 3.6/10 | Initial evaluation |
| Jan 9, 2026 (PM) | 6.6/10 | +Stats, +Export, +Offline, +Sharing, +PWA, +RLS |
| Jan 11, 2026 (AM) | 6.8/10 | +Auctions, +Payments, -Code quality issues identified |
| Jan 11, 2026 (PM) | 8.2/10 | +Sentry, +PostHog, +Rate limiting, +Redis cache, +Buy Now, +CGC/CBCS enhancements, Fixed all code quality issues |
| Jan 15, 2026 | 8.4/10 | +Premium subscription billing (code complete), +Scan limits for registered users, +Feature gating, +Pricing page |

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
- **AI:** Anthropic Claude (cover recognition, search query generation)
- **Cover Image Search:** Google Custom Search Engine (domain-restricted, 14 comic sites)
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
- `scan_usage` - Scan tracking for analytics (NEW)

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
