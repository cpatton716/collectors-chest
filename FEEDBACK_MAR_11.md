# Partner Meeting - March 11, 2026

## OLD BIZ

### Mar 6 Feedback Items

| # | Issue | Status |
|---|-------|--------|
| #1 | Start Free Trial button non-responsive (Stats page) | **Fixed** (commit f921e1a) |
| #2 | Cover lightbox not showing image on mobile | **Fixed** (commit f921e1a) |
| #3 | Mobile dev server not accessible from phone | **Resolved** (dev-only) |
| #4 | Rework homepage blurb for guest users | **Fixed** — New copy: "Snap a photo of any comic cover to instantly identify it, track what it's worth, and manage your entire collection in one place." |
| #5 | Allow users to hide Cost/Sales/Profit-Loss fields | **Fixed** — Toggle on collection page + Account Settings, persists per-account |
| #6 | Add photo best practices to Professor's FAQ | **Fixed** — New FAQ entry: "Any tips for getting the best scan results?" |
| #7 | Add Sort by Grade to collection page | **Fixed** — "Grade (High to Low)" sort option added |
| #8 | Grade pills on stats link to filtered collection | **Fixed** — Multiselect pills with "View Grades" search button |
| #9 | Add Grading Company filter to collection page | **Fixed** — "All Graders" dropdown added |
| #10 | Grading company counts on stats link to filtered collection | **Fixed** — Clickable counts navigate to filtered collection |
| #11 | Form LLC Business Entity | **Done** |

### Open Business Items

| # | Item | Status | Notes |
|---|------|--------|-------|
| #1 | Legal Pages (ToS, Privacy, AUP, Cookies) | **Open** | LLC done — replace placeholders, send to lawyer for final review. Briefing at `Legal Docs/Legal_Update_Briefing_Feb_2026.md`. |
| #2 | Stripe Account Setup | **Open** | Premium billing code complete, waiting on Stripe account configuration. |
| #3 | Stripe Connect (Seller Payouts) | **Open** | Code complete, needs Connect setup in Stripe dashboard + Express account config. |
| #4 | Premium Subscription Billing | **Open** | Code complete, blocked by Stripe account setup (#2). |
| #5 | Test Payment Flows End-to-End | **Open** | Blocked by Stripe setup. Auction bids, Buy Now, subscription billing. |
| #6 | Test Stripe Connect Seller Flow | **Open** | Blocked by Stripe Connect (#3). Seller onboarding, sandbox purchase, fee split, payout to bank. |
| #7 | Age Gate (18+) for Marketplace | **Complete** | Implemented and verified in production. Modal prompts 18+ confirmation, sets `age_confirmed_at` in DB, invalidates Redis cache. |
| #8 | Database Backup Strategy | **Open** | Upgrade to Supabase Pro ($25/mo) before opening registration. |

---

## NEW BIZ

*(Items added during tonight's meeting)*

| # | Issue | Page/Feature | Severity | Status | Notes |
|---|-------|-------------|----------|--------|-------|
| #1 | Launch tracker | | | Pending | Review Aponte's tracker |
| #2 | Age verification modal loops on confirm | Marketplace / Shop | High | **Fixed** | Redis profile cache not invalidated after age confirmation |
| #3 | Hide AI-generated "Recent Sales" | Comic Detail Modal | Medium | **Fixed** | Fake sales with dates were showing alongside AI estimate disclaimer |
| #4 | Homepage tagline + blurb | Homepage | Low | **Fixed** | Tagline restored, descriptive blurb added as subtitle for guests |
| #5 | Shop listing user's collection shows empty | Public Profile / Shop | Medium | Investigating | Clicking @jsnaponte from shop listing → /u/jsnaponte shows 0 comics. Possible data issue (user may not have added comics to collection). |
| #6 | Make Publisher clickable on Stats page | Stats | Low | Pending | |
| #7 | CONNECT_REQUIRED shows raw error code | Shop Listing Modal | Medium | **Fixed** | Now shows "Please connect your Stripe account before proceeding." |

---

## Notes

