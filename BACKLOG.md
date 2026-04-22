# Collectors Chest Backlog

## Pre-Launch — Critical / High Priority

### Fix CGC Cert Lookup Cloudflare 403 Errors
**Priority:** High
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
**Priority:** High
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

### Marketplace UX / Purchase Flow Cleanup (5 bugs found during Apr 21 testing)
**Priority:** High (Pre-Launch Blocker)
**Status:** Pending (1 of 5 temporarily patched; rest open)
**Added:** Apr 21, 2026

During Stripe Connect Phase 7e testing (Buy Now purchase flow with test accounts), five issues surfaced that collectively make the marketplace unfit for public launch:

**1. Buy Now flow never triggers Stripe Checkout** 🔴 Critical
   - `POST /api/listings/[id]/purchase` only marks the listing as `status: sold, payment_status: pending` — no Stripe Checkout Session is created
   - The `PaymentButton` component exists (`src/components/auction/PaymentButton.tsx`) and properly calls `/api/checkout` which creates destination-charge sessions, but it was NOT rendered anywhere in the UI before Apr 21
   - **Temp patch (Apr 21):** added conditional PaymentButton render to `ListingDetailModal.tsx` when viewer is the buyer and payment is pending. Unblocks testing but doesn't address the broader flow
   - **RLS silent-fail bug also fixed Apr 21:** `purchaseFixedPriceListing` in `auctionDb.ts:876` used the regular `supabase` client for the status update, which the buyer didn't have RLS permission to execute. Update silently failed with no error; API returned success; UI showed "Purchase Complete" but DB was unchanged. Fixed by switching to `supabaseAdmin` (auth is already verified at the API layer).
   - **Proper fix:** Restructure Buy Now to go directly to Stripe Checkout on click (no intermediate "reserve" state), matching the typical e-commerce pattern. Users shouldn't need to click Buy Now, then hunt for a Pay Now button.
   - **Alternative (if reserve-first pattern is intentional):** Show a clear "Complete Payment" CTA on the buyer's home or notifications page, and auto-redirect them there after the initial claim.
   - **Audit needed:** scan the rest of `auctionDb.ts` and other server-side DB modules for similar `supabase.from(...).update(...)` patterns where the acting user wouldn't have RLS permission — these are all silent-failure landmines.

**2. "Purchase Complete!" shown when payment is pending** 🔴 Critical
   - `ListingDetailModal.tsx:369` hardcodes a green checkmark "Purchase Complete!" after `POST /api/listings/[id]/purchase` succeeds — but payment hasn't happened yet
   - Misleading to buyers; makes it unclear whether they need to take further action
   - **Temp patch (Apr 21):** added paymentStatus check to show "Item reserved — complete payment" with amber styling + PaymentButton when paymentStatus is pending
   - **Proper fix:** tied to #1 — if Buy Now goes straight to Stripe Checkout, this UI state goes away entirely

**3. Notifications use generic "auction" language for Buy Now purchases** 🟡 Medium
   - `src/lib/auctionDb.ts:1461, 1465`: the `won` type says "You've won an auction!" and `auction_sold` says "Your auction has ended with a winning bidder!"
   - Both are used for Buy Now purchases too (`purchaseFixedPriceListing` at lines 892, 895), causing the copy to lie about the listing type
   - **Fix:** either add separate notification types (e.g., `buy_now_purchased`, `item_sold_fixed_price`) OR parametrize the existing types to check the listing's `listing_type` and render conditional copy

**4. Books don't transfer between collections after purchase** 🟡 Medium
   - When a buyer completes a purchase, the comic still shows in the seller's collection; there's no "pending purchases" state visible to the buyer
   - Expected behavior: *after payment confirms* (not after claim), the comic should move from seller's "active" collection to "sold history" and into buyer's "pending delivery" → eventually "owned collection"
   - Pre-payment state needs a placeholder — e.g., buyer sees "Pending delivery" card with payment/tracking status
   - Ties into webhook handling — `checkout.session.completed` handler must update ownership, not `purchase` endpoint

**5. Age verification modal copy is hard to read** 🟢 Low
   - `AgeVerificationModal.tsx:60-64`: all-caps comic font inside a yellow box with low contrast
   - Change to normal body font, proper sentence case, lighter visual weight. Keep the legal attestation but make it readable.

**6. Comic ownership does not transfer to buyer's collection after payment** 🔴 Critical
   - After `checkout.session.completed` fires, `handleAuctionPayment` in `src/app/api/webhooks/stripe/route.ts:164+` updates auction `payment_status = paid` and inserts a `sales` row for the seller, but never transfers comic ownership to the buyer
   - Result: buyer pays, money moves, but the comic stays in the seller's collection indefinitely
   - **Design question to resolve:** should we (a) update the comic row's owner (loses seller's collection history), (b) duplicate the comic row for buyer (preserves history, duplicates data), or (c) use a separate `owned_comics` junction table (cleanest but requires schema changes)?
   - Option (b) is likely the right call — preserves seller's "sold history" view AND gives buyer a fresh comic they can edit/grade/resell later
   - Files: `src/app/api/webhooks/stripe/route.ts` handleAuctionPayment, plus whatever schema is needed for cloning comic data with new owner

**7. Feedback notification has no deep-link** 🟡 Medium
   - `rating_request` notification is created for completed transactions, but notifications currently render as plain text — clicking them does nothing
   - User cannot figure out where to leave feedback
   - Fix: every notification should have a target URL (`href` column on notifications table, or derive from `auction_id`/`offer_id`). UI should wrap text in a `<Link>` or route on click
   - For `rating_request` specifically, link to the listing detail modal with the feedback form expanded: `/shop?listing=<id>&leave-feedback=true` (or similar)

**8. Checkout success_url redirected buyer to /my-auctions (seller-view)** 🟡 Medium
   - **Temp patch (Apr 21):** changed `checkout/route.ts:124` to `/collection?purchase=success&auction=<id>` and `cancel_url` to `/shop?listing=<id>&payment=cancelled`
   - **Proper fix:** once the `/transactions` page exists (see separate backlog item), redirect there instead

**9. URL `?tab=buy-now` param overrides listing type in modal** 🟡 Medium
   - When the shop page URL has `?tab=buy-now`, the ListingDetailModal renders listings with Buy Now UI regardless of their actual `listing_type`. Auctions appear as fixed-price listings with a "Buy Now for $X" button that would fail on click (self-sale guard stops sellers from clicking their own).
   - Reproduction: seller navigates to their own auction listing via a link that carries `tab=buy-now` (probably from the buy-now tab of some listing-browse view).
   - **Root cause:** the modal's rendering logic trusts the URL tab parameter instead of the listing's canonical `listing_type` field.
   - **Fix:** in `ListingDetailModal` (or wherever the tab-aware render decision lives), key the UI off `listing.listing_type` ("auction" / "fixed_price") rather than URL params. URL `tab` should only control which tab is selected on the browse page, not individual modal rendering.

**10. Another RLS silent-fail in `placeBid`** 🔴 Critical
   - `src/lib/auctionDb.ts` `placeBid` used the regular `supabase` client for the bid INSERT and all bid/auction UPDATEs. Buyers don't have RLS insert permission on the `bids` table, so Supabase rejected with `"new row violates row-level security policy for table \"bids\""`.
   - **Patched Apr 21:** 4 writes switched to `supabaseAdmin` (bid update for same-bidder max, mark-not-winning update, auction current_bid update, bid insert, auction bid_count update).
   - **Confirms the "Audit needed" line in bug #1:** *all* `supabase.from(...).update/insert/delete` calls in server-side DB modules need an audit for RLS issues. Add to the audit checklist; don't rely on catching these one-at-a-time via manual testing.

**11. RLS silent-fail in `processEndedAuctions` (cron processor)** 🔴 Critical
   - `src/lib/auctionDb.ts` `processEndedAuctions` line 1834 and 1867 used regular `supabase` client for UPDATEs to set `status: "ended"` and populate winner fields. Cron has no user context (anon role), so RLS silently rejected the updates.
   - **Observable symptom:** cron returned `processed: 1` with no errors, but the auction remained `status: active` with `winner_id: null`. The "processed" count only reflected that the loop iterated over the auction, not that the update succeeded.
   - **Patched Apr 21:** switched both updates to `supabaseAdmin`. Also reinforces the RLS audit priority — every cron/webhook/server-side handler is prone to this pattern.

**14. No transactional emails sent for marketplace transactions** 🟡 Medium (Pre-Launch)
   - After a successful purchase (Buy Now or auction win + payment), neither buyer nor seller receives a transactional email
   - In-app notifications fire correctly but email is silent — Resend integration exists (see DEV_LOG welcome-email work) but no marketplace transaction emails are wired
   - Missing emails:
     - Buyer: "Purchase confirmation" — comic, amount paid, shipping address, seller info, payment receipt/link
     - Seller: "Item sold" — what sold, payment received, shipping address, reminder to ship + add tracking (tied to shipping-tracking feature)
     - Both: "Payment received" (optional — covered by sold/purchased emails)
     - Future (after shipping feature): "Tracking added", "Item shipped", "Delivered"
   - Add to `src/lib/email/` (wherever Resend templates live) + hook into `handleCheckoutCompleted` / `handleAuctionPayment` in `webhooks/stripe/route.ts`
   - Respect user email preferences (`notification_preferences` if that exists)

**15. Duplicate notifications possible from cron re-processing (now mitigated)** 🟢 Low
   - During Apr 21 testing, the winner received 3 duplicate "You won!" notifications and the seller received 3 "Your auction has ended" notifications. Root cause: while the `processEndedAuctions` RLS bug (#11) was still live, the cron was idempotent in loop iteration but not in side effects — each run sent new notifications without checking if the auction was already processed.
   - **Already largely fixed by bug #11 patch:** once status transitions to `"ended"` via `supabaseAdmin`, the next cron run's `.eq("status", "active")` filter excludes the row. No duplicate processing.
   - **Residual risk:** race conditions between concurrent cron runs (Netlify Scheduled Functions typically don't overlap, but not guaranteed). Add defensive check at start of auction processing loop: SELECT status again under row-lock or with optimistic concurrency before sending notifications.
   - Also consider: deduplicate notifications in the DB (unique constraint on `user_id + type + auction_id` for `won` / `auction_sold` types) so future bugs can't spam users.

**13. Auction vs Buy Now use different post-sale `status` values** 🟡 Medium
   - Buy Now (`purchaseFixedPriceListing`) → `status: "sold"`
   - Auction (`processEndedAuctions`) → `status: "ended"`
   - Both set `payment_status: "pending"`, but the divergent `status` value means UI conditionals that check `status === "sold"` break for auctions. Found via ListingDetailModal showing "This listing is no longer available" for auction winners on Apr 21 testing.
   - **Patched (Apr 21):** ListingDetailModal conditionals now check `(status === "sold" || status === "ended")`.
   - **Proper fix:** normalize to a single value — e.g., `status: "sold"` universally once payment is pending, and `status: "ended"` only for unsold-expired auctions (no winner). Requires schema migration + update all consumers. OR consider splitting: add `listing_state: "active" | "sold_pending_payment" | "paid_pending_shipment" | "shipped" | "delivered" | "cancelled"` as a clean state machine separate from the legacy `status` field.

**12. `expireOffers` broken relationship error** 🟡 Medium
   - Every cron run produces: `"Failed to fetch expired offers: Could not find a relationship between 'auctions' and 'collection_items' in the schema cache"`.
   - Appears to be a stale or invalid Supabase join definition in `expireOffers` — either the relationship was renamed/dropped or the function is querying a column that doesn't exist on `collection_items`.
   - Not blocking auction processing (the cron continues past this error), but spams error logs and means no offers will ever auto-expire.
   - Fix: inspect `expireOffers` in `auctionDb.ts`, verify the join path against the current schema, either repair the join or refactor to multiple separate queries.

**Files involved:**
- `src/app/api/listings/[id]/purchase/route.ts` — rethink flow (see #1)
- `src/components/auction/ListingDetailModal.tsx` — lines 366-403 temp-patched
- `src/components/auction/PaymentButton.tsx` — fine as-is
- `src/lib/auctionDb.ts` — lines 852-901 (`purchaseFixedPriceListing`), 1459-1482 (notification templates)
- `src/components/AgeVerificationModal.tsx` — lines 60-64
- `src/app/api/webhooks/stripe/route.ts` — `checkout.session.completed` handler (verify it flips payment_status and triggers collection transfer)

---

### Shipping Tracking for Sold Items (payment gated on validated tracking)
**Priority:** High (Post-Launch — add soon after MVP opens)
**Status:** Pending
**Added:** Apr 21, 2026
**Updated:** Apr 21, 2026

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

### "Transactions" Page for Buyers (Purchases + Bids)
**Priority:** High (Pre-Launch Blocker — currently NO way for buyers to see pending purchases)
**Status:** Pending
**Added:** Apr 21, 2026

During Apr 21 Stripe Connect testing, user discovered that **buyers have no place to see items they've purchased but not yet paid for**. The `/my-auctions` page is the seller's view of their own listings. There's no buyer-side equivalent.

User's exact ask: *"We need to have a menu in the more dropdown that is specific to transactions or purchases. Let's just use transactions for now, but give them a list of anything they bought and/or bid on."*

**Proposed scope:**
- New page: `src/app/transactions/page.tsx`
- Tabs: **Purchases** (Buy Now items), **Auction Wins**, **Active Bids**, **Offers Made**
- Each entry shows: comic image, title, seller, price, status (Pending Payment / Paid / Shipped / Completed), action CTA
- Pending-payment entries get a prominent **"Complete Payment"** button that opens the listing modal (or directly to PaymentButton / Stripe Checkout)
- Add `{ href: "/transactions", label: "Transactions", icon: Wallet }` to both `registeredSecondaryLinks` in `Navigation.tsx` (desktop More dropdown) and `registeredDrawerItems` in `MobileNav.tsx` (mobile drawer)
- Mirror link for guests: `"/sign-in?redirect=/transactions"` in `guestSecondaryLinks` / `guestDrawerItems`

**Backend:**
- New API route `GET /api/transactions?type=purchases|wins|bids|offers` that returns the current user's transactions
- Filter `auctions` table by `winner_id = current_user_id` for purchases/wins; filter `bids` table for active bids; filter `offers` for offers made
- Keep this fast: it'll be in the nav drop and many users will click it reflexively

**Related deep-link:** notifications that mention "You've won / Your item sold / Payment required" should deep-link directly to the relevant listing modal (e.g., `/transactions?listing=<id>` or `/shop?listing=<id>`). Currently notifications are dead-ends.

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

### Enable Stripe Connect in Live Mode
**Priority:** High (Pre-Launch)
**Status:** In Progress — sandbox walkthrough underway (Apr 21, 2026)
**Added:** Apr 6, 2026
**Updated:** Apr 21, 2026

Stripe Connect setup in test/sandbox mode is actively being walked through. Once sandbox walkthrough is complete and end-to-end Phase 7 testing passes, repeat the same wizard in Live mode and deploy.

**Session 36 progress (Apr 21, 2026):**
1. ✅ Stripe account identity verification cleared
2. ✅ Created `docs/stripe-connect-setup.md` with 8-phase walkthrough
3. ✅ Corrected "Platform" → "Marketplace" business model selection (destination charges + `transfers` capability = Marketplace, not Platform)
4. 🟡 Currently walking through integration choices wizard
5. ❌ Not yet: Phases 2-4 (platform profile, Express settings, branding) in test mode
6. ❌ Not yet: Phase 7 end-to-end localhost test
7. ❌ Not yet: repeat for Live mode

**Blocked discovery (Apr 21):** Initial "Set up seller payments" call returned `You can only create new accounts if you've signed up for Connect` — confirmed Connect enablement and test-mode dashboard walkthrough are required before the code paths work.

**Reference:** Full step-by-step in `docs/stripe-connect-setup.md`.

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

### Launch Tracker Review
**Priority:** High (Pre-Launch)
**Status:** Pending
**Added:** Mar 11, 2026
**Source:** Partner Meeting (Session 19)
**Target:** Week of April 20, 2026 (partner meeting April 22). Supabase Pro upgrade due by April 23.

Conduct a comprehensive review of launch readiness. Assess feature completeness, UX polish, performance, and outstanding bugs to determine a launch timeline.

---

### Signature Detection on Cached Scan Path
**Priority:** High (Pre-Launch)
**Status:** Implemented — effectiveness limited by CGC Cloudflare 403
**Added:** Apr 6, 2026
**Updated:** Apr 7, 2026

When cert lookups work (CBCS/PGX now, CGC after ZenRows fix), signature data comes directly from the cert — `signatures` field and `labelType: "Signature Series"`. This covers the primary use case of detecting signed slabbed books. Once the CGC Cloudflare fix (#1) is deployed, this is effectively resolved for all grading companies.

---

### Apple Sign-In & Native iOS/Android Apps
**Priority:** High (Pre-Launch)
**Status:** Brainstorming — design in progress (Apr 20, 2026)
**Added:** Apr 6, 2026
**Updated:** Apr 20, 2026

Bundled effort: Apple Developer Program enrollment ($99/yr) unlocks both Sign in with Apple and native iOS distribution. Building native apps for iOS + Android is a meaningful acquisition-channel play; break-even math shows native only needs to grow the user base ~4% to offset Apple's 15% Small Business Program cut (see `docs/native-app-iap-analysis.xlsx`). IAP strategy leaning toward Option A (Apple IAP on iOS + Stripe on Android/Web).

**Steps:**
1. Enroll in Apple Developer Program ($99/yr) + Google Play Developer ($25 one-time)
2. Create App IDs, configure Sign in with Apple, replace Clerk's shared Apple OAuth credentials
3. Finalize IAP strategy (Option A vs B vs product-split); review model with partner
4. Choose wrapper approach (Capacitor recommended — reuses Next.js/PWA codebase) — design doc pending
5. Implement StoreKit + Play Billing + receipt validation / entitlement sync with Stripe
6. App Store and Play Store submissions (icons, screenshots, privacy policy, review responses)

**Blocked on:** IAP strategy decision (partner meeting week of Apr 20), Apple Developer Program enrollment.

**Related:** "Native App Wrapper" (consolidated into this item), "Native App: Cover Image Search via Default Browser" (low-priority UX polish for once wrappers ship).

---

### Native App Wrapper
**Priority:** High (Pre-Launch)
**Status:** Consolidated into "Apple Sign-In & Native iOS/Android Apps"
**Added:** Mar 18, 2026
**Updated:** Apr 20, 2026

Originally a standalone ask to hide the browser URL bar via a PWA or native shell (feedback item #16 — browser URL bar showing on public collection). Now rolled into the full native-apps initiative above, which delivers the same UX improvement plus App Store distribution.

---

## Pending Enhancements

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
