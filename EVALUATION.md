# Collectors Chest - Comprehensive Evaluation

> Launch readiness scorecard. See `BACKLOG.md` for open work items and `DEV_LOG.md` for session history.

*Last Updated: April 22, 2026*

---

## Executive Summary

Collectors Chest is a comic book collection tracking app with AI-powered cover recognition and a new auction marketplace feature. The app is currently in **Private Beta** with public registration disabled.

**Overall Score: 8.8/10**

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

**Score: 8/10** (up from 7/10)

### Issues Status

| Issue | Severity | Status |
|-------|----------|--------|
| Test suite | 🟢 Good | 584 tests passing (Apr 7, 2026) |
| ESLint config | 🟢 Fixed | Working with Next.js defaults |
| Viewport/themeColor metadata | 🟢 Fixed | Migrated to `export const viewport` |
| Stripe webhook config export | 🟢 Fixed | Deprecated config removed |
| TypeScript compilation | 🟢 Passing | Clean |
| Production build | 🟢 Passing | Clean |
| Sentry error tracking | 🟢 Added | Production-ready |
| PostHog analytics | 🟢 Added | Tracking enabled |

### Remaining Work

1. **Expand test coverage** - Add tests for auction bid logic, authentication flows, payment webhooks

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
| npm audit (dependencies) | ✅ Clean | 0 vulnerabilities (2 new moderate/high auto-resolved via `npm audit fix` during Apr 16 close-up-shop — Next.js high DoS, DOMPurify moderate) |
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
- **Stripe Connect fee split** ✅ Buy Now and auction fee splits validated end-to-end (Apr 21, 2026) — `transfer.created` webhook firing correctly

> ⚠️ Marketplace UX is feature-complete but has known post-purchase gaps: comic ownership transfer (BACKLOG #6, critical), transactions page (missing), and 19 other pre-launch items logged in `BACKLOG.md` during session 36.

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
| Netlify | Personal Plan | $9.54 | Hosting + domain + DNS (billed 13th) |
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
1. **Strategic deploys** - Batch changes, use preview for testing
2. **Pre-populate database** - Cache top 5K comics to reduce AI calls

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
| Email Notifications | ✅ Complete |

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
| Single AI provider dependency | 🟢 Low | Self-healing model pipeline auto-updates deprecated models (bug-fixed Apr 16 to properly handle minor-version bumps, e.g. 4.0 → 4.5 → 4.6). MODEL_PRIMARY proactively upgraded to Sonnet 4.5 (`claude-sonnet-4-5-20250929`) on Apr 16 to pre-empt the announced June 15, 2026 Sonnet 4 retirement. OpenAI fallback available. |
| Limited deploys | 🟡 Medium | Strategic batching |
| Auction fraud potential | 🟡 Medium | Add monitoring |

---

## 11. Launch Readiness

### Overall: 95% Ready

#### Still Pending 🟡
- [ ] Price alerts
- [ ] Pull lists
- [ ] Sales trend graphs
- [ ] Shipping integration

---

## Next Steps

See `BACKLOG.md` for the prioritized list of open items — **21 new pre-launch items added during session 36** (Apr 21, 2026), including critical comic ownership transfer fix (#6) and the missing transactions page.
