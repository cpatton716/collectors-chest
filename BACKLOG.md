# Collectors Chest Backlog

## Pre-Launch — Critical / High Priority

### Fix CGC Cert Lookup Cloudflare 403 Errors
**Priority:** High (Pre-Launch Blocker — required for Beta)
**Status:** Pending — ZenRows validated, awaiting cost review
**Added:** Apr 5, 2026
**Updated:** Apr 7, 2026

CGC website (`cgccomics.com/certlookup/`) is blocking cert lookups with Cloudflare bot protection (HTTP 403). The current User-Agent (`"CollectorsChest/1.0"`) is detected as a bot. All cert lookups fail, forcing fallback to the full AI pipeline.

**Root cause:** Cloudflare managed challenge blocks non-browser requests. Even full browser headers via curl return 403 — JS execution is required.

**Validated solution:** ZenRows API with `mode=auto&wait=5000` successfully bypasses Cloudflare and returns full cert data (tested Apr 7, 2026 — cert #3986843008 returned complete HTML with grade, title, publisher, etc.).

**Services tested:**
- ❌ ScraperAPI (standard, premium) — failed against CGC
- ❌ ZenRows (`js_render=true&antibot=true`) — timed out
- ✅ ZenRows (`mode=auto&wait=5000`) — **works**, returns full cert page HTML

**Cost:** 25 credits per request. Free trial: 1,000 credits (14 days). Paid plans start at $49/mo for 250K credits (~10,000 cert lookups). With 1-year Redis cache, ongoing costs should be low.

**Blocked on:** Partner cost review of ZenRows subscription before implementation.

**Implementation:** Replace `fetch()` in `src/lib/certLookup.ts` `lookupCGCCert()` with ZenRows API call. Env var `ZENROWS_API_KEY` already added to `.env.local`. Needs to be added to Netlify when ready.

**Impact:** Cert-first pipeline falls back to full AI on every slabbed scan, negating cost savings. Also affects existing cert lookup feature for all users.

---

### Optimize Scan Pipeline for Slabbed Comics (Cert-First)
**Priority:** High (Pre-Launch Blocker — required for Beta)
**Status:** Implemented (Apr 5, 2026) — effectiveness limited by CGC Cloudflare 403
**Added:** Apr 5, 2026

Pipeline code is complete and deployed. The cert-first path works end-to-end for CBCS and PGX slabs. CGC slabs fall back to the full AI pipeline due to the Cloudflare 403 blocking issue (see "Fix CGC Cert Lookup Cloudflare 403 Errors"). Once ZenRows is deployed, this item is fully complete.

---

### Auto-Harvest Cover Images from Graded Book Scans
**Priority:** High
**Status:** Prompt fixed — needs deploy + re-test
**Added:** Feb 26, 2026
**Updated:** Apr 7, 2026

Pipeline is running end-to-end (7 covers harvested in production), but the AI is returning **wrong crop coordinates**. It's cropping the grade label area (top of slab) instead of the cover artwork (lower portion visible through the case). All 3 tested images show the same pattern: grade number + label info + just the top edge of the cover.

**Root cause:** The `extractSlabDetails()` AI prompt isn't specific enough about what "cover artwork" means. The AI is interpreting "cover" as the top of the slab (which includes the grading label) rather than the comic book cover art visible through the case below the label.

**Fix needed:** Update the AI prompt in `src/lib/providers/anthropic.ts` and `gemini.ts` to explicitly instruct: "The cover artwork is the comic book art visible through the clear slab case BELOW the grading label. Do NOT include the grade label, cert number, or barcode area in the crop coordinates."

**Also consider:** Delete the 7 bad harvested covers from `cover_images` table and Supabase Storage after fixing.

**Design doc:** `docs/plans/2026-02-25-cover-image-harvesting-design.md`
**Implementation Plan:** `docs/superpowers/plans/2026-04-02-cover-image-harvesting.md`

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

### Marketplace Policy Gaps in Guest-Facing Docs (Pre-Launch Blocker)
**Priority:** High (Pre-Launch Blocker)
**Status:** Pending
**Added:** Apr 21, 2026

During Stripe Connect setup, user agreed to three platform responsibilities with Stripe (refunds/chargebacks, seller vetting, first-line support). These are not adequately reflected in guest-facing Terms, FAQ, or marketplace policy pages. **Must be closed before opening the marketplace to real users.**

**Gaps identified (audit run Apr 21, 2026):**

1. **Refunds & chargebacks** — Terms of Service covers subscription refunds only. Marketplace refund/chargeback policy is absent.
   - Add to Terms § Marketplace: "Collectors Chest processes refunds and handles chargeback claims on behalf of the marketplace. Sellers do not directly manage refunds."

2. **Seller vetting / restricted products** — Acceptable Use Policy *prohibits* counterfeits and stolen goods, but nowhere states that Collectors Chest *actively reviews* sellers.
   - Add to Terms § Marketplace: "Collectors Chest reviews seller accounts to ensure compliance with these Terms and applicable law, including restrictions on counterfeit goods, stolen property, and unauthorized merchandise."

3. **First-line support for payment & risk inquiries** — Terms has weak "may facilitate disputes" language only.
   - Rename/expand Terms § 10.1: "Collectors Chest provides first-line support for marketplace payment issues and disputes."

4. **Seller communication (risk/fraud actions)** — Stripe requires the platform to notify sellers when their account is affected by risk or fraud prevention/mitigation actions (Apr 21, 2026 acknowledgement). No current content covers this.
   - Add to Terms § Marketplace (seller-facing): "If your seller account is affected by risk or fraud prevention actions — including holds, reviews, or restrictions — Collectors Chest will notify you with the reason and any steps required to remediate."
   - Consider: internal runbook for how notifications get sent (email template + timing).

5. **Seller remediation (collecting additional info)** — Stripe requires the platform to collect additional seller information when needed to support the account (KYC updates, doc requests, etc.). No current content covers this.
   - Add to Terms § Marketplace (seller-facing): "Collectors Chest may periodically request additional information from you to keep your seller account in good standing. You agree to provide requested information promptly; failure to respond may result in account restrictions."
   - Implementation note: Stripe-hosted onboarding components can collect most remediation data — no custom forms needed.

**Add 3-5 FAQ entries** (in `Navigation.tsx` `faqs` array):
- "What happens if I want a refund on a marketplace purchase?"
- "How does Collectors Chest ensure sellers are legitimate?"
- "Who do I contact if I have a payment problem?"
- "What happens if my seller account is restricted or under review?"
- "Why might Collectors Chest ask me for additional information after I've already signed up as a seller?"

**Optional:** dedicated `/marketplace-policy` or `/seller-guidelines` page for single-URL reference during disputes.

**Files to touch:** `src/app/terms/page.tsx`, `src/components/Navigation.tsx` (FAQ array), optionally new `src/app/marketplace-policy/page.tsx`.

---

### Seller Onboarding Help Page ("How to set up your Stripe seller account")
**Priority:** High (Pre-Launch Blocker)
**Status:** Pending
**Added:** Apr 21, 2026

Build a dedicated help/tutorial page that walks new sellers through the Stripe Connect Express onboarding flow on Collectors Chest. During session 36 while completing the Stripe setup in test mode, user noted that the same questions a real seller will ask — *What business type? What goes in the "your website" field? What if I don't have a website? What information will Stripe ask for?* — deserve proactive documentation.

**Purpose:** Reduce seller drop-off during onboarding and cut first-line support volume. When sellers reach decision points in Stripe's hosted flow, they should have a Collectors-Chest-branded page explaining the context.

**Design principle — LOW BARRIER TO ENTRY:** User priority (Apr 21, 2026): "If the barrier to entry is too high, people will not sign up, so we need to make it as easy as possible." Every design choice on this page and the surrounding flow should be evaluated against: *does this reduce friction or increase it?*

**Specific low-friction tactics to implement:**
1. **Pre-fill from Clerk profile** — pass the seller's email, first/last name, and any existing profile data to Stripe's onboarding (Stripe API supports pre-filled values on account creation). Every prefill is one less field to type.
2. **Explicit time estimate** — "This takes about 5 minutes" at the top of the help page and before the "Set up seller payments" button. Sets expectations.
3. **Upfront "what you'll need" checklist** — before clicking into Stripe, show the user exactly what to have ready (name, phone, bank info) so they don't start and stall.
4. **Save/resume flow** — if the user bails mid-Stripe onboarding, make it trivial to resume. The code already uses `accountLinks.create` which handles this via `refresh_url`, but the UX around returning partway through should be polished (e.g., a "Finish seller setup" banner on their settings page).
5. **Defer onboarding to the last possible moment** — ideally, users should be able to browse and create their collection without ever seeing Stripe onboarding. Only prompt when they're about to list their first item for sale. Current code already gates listing creation on Connect; keep it that way.
6. **Trust cues** — "Your info is encrypted. Stripe handles identity verification; Collectors Chest never sees your SSN or bank details."
7. **Mobile-first design** — the majority of sellers will onboard from mobile. The help page and the flow around it must work cleanly on a 375px-wide viewport.
8. **Progress visibility** — after they return from Stripe, if onboarding is incomplete, show a clear "You're 3/4 done — one more step" nudge rather than forcing them to figure out what's pending.
9. **No unnecessary fields** — only ask for info Stripe actually requires. Never add custom forms on top of Stripe's. Embedded onboarding components can shorten the flow further if basic Stripe-hosted proves too long.
10. **Handle the "no website" case gracefully** — explicitly call it out ("Most hobbyist sellers don't have a website — that's fine, select 'add product description' on Stripe's page").

**Scope (user-facing content only — NO test-mode details):**

1. **Overview:** Why sellers need to complete Stripe onboarding (to receive payouts from sales)
2. **What to have ready before starting:**
   - Legal name + DOB
   - Real US mobile phone for SMS verification
   - Last 4 of SSN (individuals) or EIN (companies)
   - Bank account + routing number for payouts
3. **Step-by-step walkthrough** (mirror the Stripe screens the seller will see):
   - Email & phone verification
   - Business type decision — "Choose Individual if you're a hobbyist collector; choose Company if you have a registered LLC or sole proprietorship"
   - Legal name + website/product description — "Don't have a website? Use the 'product description' option and describe what you sell"
   - Address (must match government records)
   - SSN last 4 (for individuals) — "Stripe uses this for identity verification only; Collectors Chest never sees it"
   - Bank account for payouts — "Payouts typically arrive 2-5 business days after a sale completes"
4. **What happens after onboarding:**
   - How payouts work (Stripe Express Dashboard, payout schedule)
   - How disputes/chargebacks are handled (links back to marketplace policy)
   - How to update bank info later (via Express Dashboard)
5. **Troubleshooting:**
   - "Stripe rejected my info" → link to Stripe support
   - "I want to cancel my seller account" → contact collectors-chest support

**Add FAQ entry** (in `Navigation.tsx` `faqs` array) — link directly to the new page:
- Q: "How do I set up my Stripe seller account?"
- A: "Before you can list comics for sale, you'll need to complete a short onboarding flow with Stripe, our payment processor. This takes ~5 minutes. See our [Seller Onboarding Guide](/seller-onboarding) for a step-by-step walkthrough."

**Files to create:**
- `src/app/seller-onboarding/page.tsx` — new help page (follow Lichtenstein design language; use existing Terms/Privacy page structure as reference)
- `src/components/Navigation.tsx` — add the FAQ entry pointing at `/seller-onboarding`

**Note:** This is DIFFERENT from the "Marketplace Policy Gaps" item above. That one is about legal language in Terms of Service. This one is user-facing help content to reduce onboarding friction.

---

### Payment Deadline Enforcement Test
**Priority:** High (Pre-Launch Blocker)
**Status:** Pending — bundle with real-money Stripe Connect test
**Added:** Apr 22, 2026

Auction payment deadline logic exists in the codebase but has never been exercised end-to-end. Session 36 validated payment *success* flows but did NOT test what happens when a winning bidder misses the payment deadline. Per EVALUATION.md § 3: *"Payment deadline enforcement — ⚠️ Unclear — logic in place but untested."*

**User direction (Apr 22, 2026):** *"Should be tested along with real money test. Please make sure the test cases account for this."*

**Test scenarios to add to TEST_CASES.md:**
1. Winning bidder never pays — verify auction auto-cancels after the deadline
2. Payment attempted after deadline — verify logic correctly rejects or flags the attempt
3. Second-highest bidder fallback (if supported) — verify deadline-miss triggers the promotion path
4. Notifications fire — buyer reminder before deadline, seller cancellation alert after

**Implementation sanity-check:** audit `src/lib/auctionDb.ts` and auction cron handlers for the deadline code path before running live tests.

**Related:** real-money Stripe Connect live-mode test; EVALUATION § 3 Auction Issues & Gaps.

---

### Request Size Limits on Image Uploads
**Priority:** Medium (Pre-Launch Blocker)
**Status:** Pending
**Added:** Apr 22, 2026

Image upload endpoints (scans, covers, profile avatars) currently have no enforced upper size limit on the server side. A malicious or buggy client could POST oversized payloads, leading to OOM, elevated Anthropic API costs on oversized scan inputs, or bloated Supabase Storage bills. EVALUATION.md § 2 Security Recommendations flagged this.

**Scope:**
- Add per-request max-size enforcement at the API route layer for all image upload endpoints (`/api/analyze`, `/api/covers/upload`, profile avatar, any other multipart or base64 image sinks)
- Reasonable limit: **10MB per image** (typical phone photos are 2-5MB; gives headroom without abuse)
- Return HTTP 413 Payload Too Large on exceed, with a user-friendly error message
- Add matching client-side pre-validation to prevent wasted upload attempts

**Files to touch:** every API route that handles multipart/form-data or base64 image payloads. Grep `request.formData()` or `request.json()` with image fields as a starting point.

---

### Remove "Hottest Books" Feature (Codebase Cleanup)
**Priority:** Medium (Pre-Launch Cleanup)
**Status:** Pending
**Added:** Apr 22, 2026

Decision (Apr 22, 2026): do not move forward with the Hottest Books feature at all. Remove all references from the codebase and docs.

**Scope:**
- Audit codebase for all Hottest Books references (components, API routes, constants like `USE_STATIC_LIST`, feature flags, hooks)
- Remove homepage Hottest Books section and any standalone `/hottest-books` page
- Remove associated API routes (e.g., `/api/hottest-books` if present)
- Remove stale constants and flags
- Clean up imports, unit tests, documentation mentions
- EVALUATION.md § 0 Medium Priority row already removed Apr 22, 2026

**Verification:**
- `grep -ri "hottest" src/` should return zero functional hits (may still appear in unrelated contexts — audit each)
- `npm run check:full` must pass (typecheck + lint + build)
- Spot-check the app: homepage, navigation, any known entry points

---

### Strengthen Input Validation Across API Endpoints
**Priority:** Medium (Pre-Launch Blocker — required for Beta)
**Status:** Pending
**Added:** Apr 22, 2026

Auction routes have schema validation; most other API routes accept request bodies with minimal server-side validation. EVALUATION § 2 Security Recommendations flagged this as defense-in-depth against malformed data, stored XSS, and injection attempts.

**User direction (Apr 22, 2026):** Yes — launch blocker.

**Scope:**
- Systematic sweep of all `src/app/api/**/route.ts` endpoints
- Add Zod (or equivalent) schema validation at the top of each handler
- Validate: type, length, format, enum values, required/optional fields
- Standardize error response shape (HTTP 400 with field-specific error messages)
- Prioritize routes accepting free-text, file paths, or URLs (highest injection risk)

**Effort:** 3-5 days.

**Related:** Request Size Limits on Image Uploads (sibling blocker); general API hardening.

---

### CAPTCHA for Guest Scan Limit
**Priority:** Medium (Pre-Launch Blocker — required for Full Launch, NOT Beta)
**Status:** Pending — defer until Beta → Full Launch transition
**Added:** Apr 22, 2026

Guests get 5 free scans tracked in localStorage; clearing localStorage / using incognito bypasses the limit. Each scan costs ~$0.015 in Anthropic API — a bad actor in a loop burns real money. Upstash IP-based rate limiting is live and sufficient for Beta, but abuse risk escalates when public registration opens.

**User direction (Apr 22, 2026):** *"Yes, but not for Beta Launch."*

**Scope:**
- Integrate hCaptcha (recommended — privacy-friendly, GDPR-compliant) or reCAPTCHA v3 free tier
- Challenge trigger: first scan attempt AND at scan-limit wall
- Server-side token verification at the scan endpoint
- Respect existing Upstash rate limit (don't double-gate)

**Effort:** 1-2 days.

---

### Audit Logging for Auction Transactions
**Priority:** Medium (Pre-Launch Blocker — required for Full Launch, NOT Beta)
**Status:** Pending — defer until Beta → Full Launch transition
**Added:** Apr 22, 2026

Immutable backend audit log of every auction state change (bid placed, auction ended, payment captured, transfer created, dispute filed) for compliance, fraud investigation, and debugging. **NOTE:** This is NOT the user-facing transaction history — that's the separate "Transactions Page for Buyers" item (already a Beta Pre-Launch Blocker).

**User direction (Apr 22, 2026):** *"Yes, but not for Beta Launch."*

**Scope:**
- New `auction_audit_log` table: id, event_type, auction_id, user_id, actor_type (user/cron/webhook), payload JSON, created_at
- Instrument every state-change function in `src/lib/auctionDb.ts` to append log rows
- Admin-only viewer at `/admin/audit/auctions` — filter by auction / user / date / event type
- RLS: admin-only read; no update/delete permissions from any client
- Logs are immutable — no updates to existing rows

**Effort:** 2-3 days.

**Related:** Transactions Page for Buyers (user-facing, separate item); Fraud Detection (feeds off audit log).

---

### Pre-populate Top Comics Cache (ZenRows Scrape — Marvel + DC)
**Priority:** Medium (Pre-Launch Blocker — required for Full Launch, NOT Beta)
**Status:** Pending — defer until Beta → Full Launch transition
**Added:** Apr 22, 2026

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

### Remove Metron Integration from Codebase
**Priority:** Low (Pre-Launch Cleanup)
**Status:** Pending
**Added:** Apr 22, 2026

**User direction (Apr 22, 2026):** *"Remove all reference and or mention of Metron. We've looked at their stuff and it was junk. Very unreliable. Unless we know for sure they've improved the quality of their API or you have a strong reason to keep them in the mix, I vote we continue to disregard them in all future contexts that we've already explored their ability to support."*

**Code surface to remove:**
- `src/lib/metronVerify.ts` — verification helper
- `src/lib/__tests__/metronVerify.test.ts` — tests
- Metron usage in `src/app/api/analyze/route.ts` (verification pass)
- Metron usage in `src/lib/coverValidation.ts`
- `METRON_USERNAME` / `METRON_PASSWORD` env vars (.env.local + Netlify)
- `CLAUDE.md` Services & Infrastructure table — Metron row
- Historical spec docs in `docs/engineering-specs/` and `docs/plans/` — leave as-is (historical record, not future-facing)

**Verification:**
- `grep -ri "metron" src/` should return zero functional hits
- `npm run check:full` must pass (typecheck + lint + build)
- Confirm cover validation + AI analyze pipeline still works without Metron verification pass

**Consideration:** If the AI-only pipeline loses meaningful precision without Metron verification, evaluate an alternative (or accept the precision delta). Baseline test: compare scan accuracy before vs after removal on a 50-book sample.

---

### Email Notification Preferences / Opt-Out System
**Priority:** Medium (Pre-Launch Blocker — required for Full Launch, NOT Beta)
**Status:** Pending — defer until Beta → Full Launch transition
**Added:** Apr 22, 2026

No email opt-out mechanism exists today — every notification email fires unconditionally. Safe while users are test accounts / small private beta, but **required before public launch** for CAN-SPAM / GDPR compliance on notification-style emails (outbid, won, new listing from followed, feedback reminder, etc.). Strictly transactional emails (purchase confirmation, payment receipt) can always send, but users must be able to silence the rest.

**Scope:**
- New `notification_preferences` JSON column on `profiles` table (migration):
  - `{ outbid: true, auction_won: true, auction_sold: true, new_listing_from_followed: true, feedback_reminder: true, offer_received: true, offer_status: true, ... }`
  - Default all to `true` for existing users (backwards-compatible)
- Update every call site in `src/lib/auctionDb.ts` and webhook where `sendNotificationEmail(...)` is invoked:
  - Fetch recipient's preferences first
  - Skip send if the corresponding preference is `false`
  - **Always-send categories** (no opt-out): `purchase_confirmation`, `item_sold`, `welcome`, `trial_expiring`
- Settings UI: new section on `/settings` or Profile page listing each notification type with a toggle
- Unsubscribe link in every non-transactional email footer — routes to `/settings?tab=notifications` (deep-link)
- Optional: one-click unsubscribe per type via signed token URL (RFC 8058 compliant — Gmail/Apple increasingly require this)

**Schema migration sketch:**
```sql
ALTER TABLE profiles ADD COLUMN notification_preferences JSONB DEFAULT '{
  "outbid": true,
  "auction_won": true,
  "auction_sold": true,
  "new_listing_from_followed": true,
  "feedback_reminder": true,
  "offer_received": true,
  "offer_status_change": true,
  "payment_reminder": true
}'::jsonb;
```

**Files expected:**
- Migration for `notification_preferences` column
- `src/lib/notificationPreferences.ts` — helper to check prefs before send
- `src/lib/email.ts` — wrap `sendNotificationEmail` with preference check OR have every caller check
- Settings UI component + API route for reading/updating preferences
- Unsubscribe footer partial in email templates

**Effort:** 3-5 days.

**Related:** Marketplace Notification & Email Coverage Gaps (below — those new emails must respect these preferences from day one).

---

### Signature Detection on Cached Scan Path
**Priority:** High (Pre-Launch Blocker — required for Beta)
**Status:** Implemented — effectiveness limited by CGC Cloudflare 403
**Added:** Apr 6, 2026
**Updated:** Apr 7, 2026

When cert lookups work (CBCS/PGX now, CGC after ZenRows fix), signature data comes directly from the cert — `signatures` field and `labelType: "Signature Series"`. This covers the primary use case of detecting signed slabbed books. Once the CGC Cloudflare fix (#1) is deployed, this is effectively resolved for all grading companies.

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

**Related:** Sign in with Apple (prerequisite); Android Native App (Pending Enhancements — parallel codebase but Post-Launch); Native App Cover Image Search (low-priority polish for once app ships).

---

## Pending Enhancements

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

### Hydration Mismatch on "Ask the Professor" Button
**Priority:** Low (Post-Launch)
**Status:** Pending — non-fatal ("Recoverable Error")
**Added:** Apr 22, 2026

React logs a hydration error on initial page load: the server-rendered `<button aria-label="Ask the Professor">` has `className="p-2 bg-pop-blue …"` but the client render adds a leading `mr-4`:

- Server: `p-2 bg-pop-blue border-2 border-pop-black shadow-comic-sm hover:shadow-comi…`
- Client: `p-2 mr-4 bg-pop-blue border-2 border-pop-black shadow-comic-sm hover:shadow…`

Non-fatal — the tree just re-renders on the client — but it's a sign of SSR/client drift. Likely culprit: a conditional className tied to Clerk's `isSignedIn` (which is always false on the server but resolves true on the client), or a responsive class applied by a parent that reads `window` before first paint.

**Files to investigate:**
- `src/components/Navigation.tsx` — the button lives here (line ~395). The only existing conditional is `hidden sm:inline-flex` vs `inline-flex`, which wouldn't add `mr-4`. Something else must be injecting it.
- Possibly a wrapper, a global stylesheet collision, or a browser extension (Grammarly etc. has been known to inject attributes).

**Fix approach:** stabilize the rendered HTML between server + client. Either key the button off a `mounted` state (render `null` until mounted) or move the layout class to a non-Clerk-gated context.

**Repro:** load any page in dev mode with React error overlay enabled — the error surfaces immediately on first load.

---

### Stripe Webhook: Send Resend Email on Failed Payment
**Priority:** Low (Post-Launch)
**Status:** Pending
**Added:** Apr 22, 2026

Existing TODO at `src/app/api/webhooks/stripe/route.ts:505` — when a Stripe payment fails (invoice.payment_failed / payment_intent.payment_failed), we log the event but do not notify the user via email. Buyers who had a card decline, expired card, or other payment issue get no heads-up and can silently drop off.

**Scope:**
- In the failed-payment webhook handler, look up the user's email (via Clerk or profile)
- Send a Resend transactional email: "Your payment for <listing title> could not be processed" with the reason (if Stripe provides it), a retry link, and support contact info
- Respect `notification_preferences` once that system ships (this is borderline transactional so probably always-send)
- Consider also sending an in-app notification for real-time visibility

**Files:**
- `src/app/api/webhooks/stripe/route.ts` — remove the TODO at line ~505, wire in the Resend send
- `src/lib/email/` — new template for failed-payment notification

---

### Re-engagement Email Drip Campaign
**Priority:** Medium (Post-Launch)
**Status:** Pending
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

### Haptic Feedback on Mobile
**Priority:** Medium (Post-Launch — **escalate to Pre-Launch if Option A is confirmed trivial**)
**Status:** Pending
**Added:** Apr 22, 2026

iOS/Android haptic feedback on key interactions (scan success, milestone hit, bid placed, payment complete) adds polish to mobile UX. User direction (Apr 22, 2026): *"No, but if it's super easy, it'd be a great add-value for launch."*

**Two implementation paths:**

**Option A — Web Vibration API (trivial; ~1 hour of work):**
- `navigator.vibrate(100)` at key success events in the web/PWA app
- Limited device support — works on Android Chrome; **does NOT work on iOS Safari** (Apple does not support the Vibration API)
- Deploy as progressive enhancement — silently no-ops on unsupported browsers; zero risk

**Option B — Native Haptics via Capacitor (waits for native apps):**
- Capacitor `Haptics` plugin in the iOS/Android wrappers (see "Apple Sign-In & Native iOS/Android Apps" BACKLOG entry)
- Full iOS + Android support, proper tactile feedback (not just vibration)
- Blocked on native app initiative

**Recommendation:** ship Option A pre-launch as a no-cost polish for Android users. Revisit Option B when native apps land.

**Scope (Option A):**
- Add `navigator.vibrate()` calls at: scan success, collection add, bid placed, outbid, payment complete, milestone hit
- Device settings already honored automatically by the API
- No UI changes

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

### Demo Collection / Sample-Data Mode
**Priority:** Medium (Post-Launch)
**Status:** Pending
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

### Auction Sniping Protection (Auto-Extend on Late Bids)
**Priority:** Medium (Post-Launch)
**Status:** Pending
**Added:** Apr 22, 2026

eBay-style auction sniping — bidders placing winning bids in the final seconds — is not prevented today. Competitors like eBay extend auctions when a bid arrives near the end to keep auctions fair and encourage higher final prices.

**Proposed behavior:**
- If a bid arrives within the last N minutes of an auction (e.g., last 5 min), auto-extend `ends_at` by N minutes
- Cap at a max extension count or time (e.g., no extensions after N hours beyond original end) to prevent runaway auctions
- Display "auction extended!" indicator in UI for active bidders / watchers
- Fire notification to watchers when auction is extended

**Files expected:**
- `src/lib/auctionDb.ts` `placeBid` — add extension logic after successful bid insert
- `src/components/auction/AuctionDetailModal.tsx` — show extended status
- Schema: add `original_ends_at` (immutable, for display) alongside mutable `ends_at`

**Related:** existing `processEndedAuctions` cron (no change expected); watchlist notifications.

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

### Re-introduce Dedicated Barcode Scanning
**Priority:** Low
**Status:** Pending (Blocked)
**Added:** Feb 4, 2026
**Blocked:** Requires a barcode database to be set up first before this feature can proceed.

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
**Status:** Pending
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
**Status:** Pending
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

### Scrape Marvel.com for Cover Images (ZenRows)
**Priority:** Low
**Status:** Pending
**Added:** Apr 7, 2026

Use ZenRows (or similar scraping API) to harvest comic cover images from Marvel's website (https://www.marvel.com/comics). Marvel's deprecated Developer Program means their API is no longer available, but cover images are still publicly accessible on the website. This could replace or supplement Open Library as a cover source in the pipeline.

**Approach:**
- One-time batch scrape of Marvel's comic catalog to pre-seed our `cover_images` / `comic_metadata` database with cover image URLs
- Marvel doesn't have Cloudflare-level bot protection — standard scraping should work
- Crawl their comics listing pages, extract cover image URLs + title/issue metadata, and bulk-insert into our community cover database
- Could also set up a periodic re-scrape (weekly/monthly) to pick up newly released covers
- Goal: When a user scans any Marvel book, we already have the cover image cached — no AI validation needed, no eBay image hunting

**Scale:** Marvel is the largest publisher. Pre-seeding their covers would dramatically improve cover hit rates across the platform.

**Dependencies:** ZenRows subscription (shared with CGC cert lookup if approved). Evaluate whether `mode=auto` is needed or if basic scraping suffices for Marvel.

**Related:** "Remove Open Library from Cover Pipeline" — Marvel scraping could replace Open Library as a more reliable cover source for Marvel titles. Could expand to DC, Image, and other publishers later.

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

### Durable eBay Price Cache in Supabase
**Priority:** Medium
**Status:** Pending
**Added:** Apr 5, 2026

Store eBay pricing results in Supabase with a timestamp. Before hitting the eBay API, check if a price exists that's less than 7 days old. Reduces eBay API calls, speeds up scans for popular books, and lowers costs. Requires new table (title, issue, grade, slabbed, price data, fetched_at), lookup logic in the scan pipeline, and a staleness threshold (suggested 7 days).

---

### User-Configurable Default Collection Sort
**Priority:** Low
**Status:** Pending
**Added:** Apr 5, 2026

Let users choose their preferred default sort method for the collection page (date added, title, issue, grade, value). Save preference in user settings. Currently defaults to date added (most recent first).

---

### IPv6 Private Address Checks in URL Validation
**Priority:** Low
**Status:** Pending
**Added:** Mar 20, 2026

Add IPv6 private address range checks (fd00::/8, fe80::/10, ::1) to URL validation. Currently only validates IPv4 loopback and private ranges; should expand for complete private/loopback detection.
