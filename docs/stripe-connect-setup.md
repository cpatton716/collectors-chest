# Stripe Connect Setup Guide

**Created:** 2026-04-21 (Session 36)
**Context:** Stripe account verification cleared. Ready to enable Connect for seller marketplace.
**Mode:** Live mode in dashboard; test mode + localhost for end-to-end test.

> **Apr 23, 2026 update:** Dashboard setup below is unchanged. On top of the core Connect flow, the marketplace now also enforces a 48-hour payment deadline after an auction win / offer accept (T-24h reminder cron + auto-cancel cron + Second Chance Offer for runner-up + strike system). None of that requires new Stripe dashboard config — it's implemented in the app and Supabase — but operators should know that `checkout.session.completed` is only one of several ways an auction can leave the "awaiting payment" state.

This guide walks through enabling Stripe Connect Express for the Collectors Chest marketplace. Settings below match exactly what the code expects — don't deviate.

---

## Code references (what the dashboard must match)

| Setting | Value | Code location |
|---|---|---|
| Account type | Express | `src/app/api/connect/create-account/route.ts:42` |
| Capability | `transfers` only | `src/app/api/connect/create-account/route.ts:45` |
| Webhook event | `account.updated` | `src/app/api/webhooks/stripe/route.ts:113` |
| Platform fee | 8% free / 5% premium | `src/lib/subscription.ts:658-662` |
| Return URL | `/api/connect/onboarding-return` | `src/app/api/connect/create-account/route.ts:66` |
| Refresh URL | `/api/connect/onboarding-refresh` | `src/app/api/connect/create-account/route.ts:64` |
| Onboarding trigger | `POST /api/connect/create-account` | Called from Settings → Seller Payments, or ListingModal gate |

---

## Pre-flight check

Before you start, confirm you're in **Live mode** (top-right of Stripe sidebar). Phases 1-6 are done in live mode. Phase 7 switches to test mode for localhost testing.

---

## Phase 1 — Enable Connect + choose account type

**Dashboard path:** `Connect` (left sidebar) → `Get started` (or `Settings → Connect settings` if already partially enabled)

1. **Business model** → **Marketplace** ⚠️ (NOT "Platform")
   - Stripe's UI labels these by flow direction:
     - **Platform** = Buyers → Merchants → Platform (merchants collect payments directly, are merchant-of-record, process cards themselves)
     - **Marketplace** = Buyers → Platform → Merchants (platform collects, distributes funds to sellers)
   - Our code uses **destination charges** (buyer pays our Checkout, platform keeps fee, remainder transferred to seller) and only enables `transfers` capability on Express accounts (sellers can receive but NOT process cards). That's the Marketplace model.
2. **Account type:** → **Express** ← critical. Code uses `type: "express"` at `create-account/route.ts:42`. Do **not** pick Standard or Custom.
3. **Where are your users based?** → **United States only** (you can expand later; US-only reduces KYC friction)

---

## Phase 2 — Platform profile

**Dashboard path:** `Settings → Connect settings → Platform profile`

| Field | Value |
|---|---|
| **Public business name** | Collectors Chest |
| **Platform website** | https://collectors-chest.com |
| **Support email** | patton@rovertown.com (or a support alias you prefer) |
| **Support phone** | Optional but recommended |
| **Industry** | "Online marketplaces" or "Hobby shops / collectibles" |
| **Business description** | "Comic book collection tracking and peer-to-peer auction marketplace" |

---

## Phase 3 — Express account configuration

**Dashboard path:** `Settings → Connect settings → Express settings`

### 3a. Capabilities requested
- ✅ **Transfers** — REQUIRED. Code requests this at `create-account/route.ts:45`.
- ❌ **Card payments** — DO NOT enable. Your platform account processes all cards; sellers only receive transfers. Enabling this on seller accounts will force extra KYC that isn't needed.
- ❌ **Treasury / Issuing / Tax** — leave off.

### 3b. Account types allowed
- ✅ **Individuals** (most comic sellers will be individuals)
- ✅ **Companies** (LLCs, sole props)

### 3c. Payout schedule
- Leave as **Stripe default** (daily auto-payout after 2-day rolling reserve for new accounts). The code doesn't override this, so any change here applies to every seller.

### 3d. Negative balance liability
- **Platform responsible** is the default and lowest-friction for sellers. Switching to "seller responsible" requires sellers to accept an additional agreement during onboarding.

---

## Phase 4 — Branding (what sellers see during onboarding)

**Dashboard path:** `Settings → Connect settings → Branding`

| Field | Value |
|---|---|
| **Icon** | Upload Collectors Chest icon (square, 128×128 min) |
| **Logo** | Upload horizontal logo (wide format) |
| **Brand color** | Your primary yellow/red Lichtenstein color |
| **Accent color** | Secondary |

This is the header sellers see on the Stripe-hosted onboarding page.

---

## Phase 5 — Add the 8th webhook event ⚠️

Per DEV_LOG Session 34, the live webhook had **7 of 8 events** configured. The 8th — `account.updated` — was blocked until Connect was enabled. Now that Connect is on, add it.

**Dashboard path:** `Developers → Webhooks` → click your existing **live-mode** endpoint (points to `https://collectors-chest.com/api/webhooks/stripe`)

1. Click **"Update details"** or the "..." → **Edit details**
2. Scroll to **"Events to send"** → click **"Select events"**
3. Under the **"Connect"** category, check: **`account.updated`**
4. Leave all 7 existing events checked.
5. **Save**

Verify the signing secret (`STRIPE_WEBHOOK_SECRET`) didn't change. If it did, update it in `.env.local` and Netlify.

---

## Phase 6 — Verify environment variables

No new env vars needed. Confirm these are already set in both `.env.local` and Netlify:

- `STRIPE_SECRET_KEY` — `sk_live_...`
- `STRIPE_WEBHOOK_SECRET` — `whsec_...`
- `NEXT_PUBLIC_APP_URL` — `https://collectors-chest.com`

The code does **not** use `STRIPE_CONNECT_CLIENT_ID` (that's only for Standard/OAuth, not Express). Skip it.

---

## Phase 7 — End-to-end test (test mode, localhost)

**Why test mode + localhost:** No real money moves. Uses Stripe's test SSN (`0000`), test bank (`110000000 / 000123456789`), and test cards (`4242...`). No real identity committed. Connect **enablement** is global (set in live mode above, applies to both modes), but Express accounts and webhooks are **separate per-mode** — so test-mode work doesn't pollute production.

### Phase 7a — Swap `.env.local` to test-mode keys

1. In Stripe dashboard, **toggle to Test mode** (top-right — switch turns orange)
2. **Developers → API keys** → copy the **test** `sk_test_...` secret key
3. Open `.env.local`:
   ```bash
   open -a TextEdit "/Users/chrispatton/Coding for Dummies/Comic Tracker/.env.local"
   ```
4. Replace `STRIPE_SECRET_KEY=sk_live_...` with the `sk_test_...` value
5. Replace `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...` with the `pk_test_...` value (same page)
6. **Do NOT change** `STRIPE_WEBHOOK_SECRET` yet — Phase 7b gives you a new one from the CLI
7. Save, then **restart the dev server** (Ctrl+C, then `npm run dev`)

### Phase 7b — Forward webhooks to localhost with Stripe CLI

Webhooks can't reach `localhost:3000` from the internet. Stripe CLI forwards events to your machine.

1. Install Stripe CLI (one-time):
   ```bash
   brew install stripe/stripe-cli/stripe
   ```
2. Authenticate (one-time):
   ```bash
   stripe login
   ```
   Opens a browser → approve the pairing code.
3. Start forwarding (leave running in a separate terminal for the whole test):
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
4. CLI prints:
   ```
   > Ready! Your webhook signing secret is whsec_abc123xyz...
   ```
5. Copy that `whsec_...` into `.env.local` as `STRIPE_WEBHOOK_SECRET` (replacing the live one temporarily). Save, restart dev server.
6. Keep the Stripe CLI terminal visible — watch it to confirm `account.updated` events fire.

### Phase 7c — Walk through seller onboarding

1. Open http://localhost:3000 and **sign in** with a test Clerk account (ideally a second account, not your primary)
2. Navigate to **Settings → Seller Payments**, OR click **Create Listing** on any auction page — the ListingModal has a Connect gate
3. Click **"Set up seller payments"** → hits `POST /api/connect/create-account`, redirects to Stripe Express onboarding
4. On the Stripe-hosted onboarding page, enter these **test values**:

| Field | Value |
|---|---|
| Email | your test email |
| Phone | any real US mobile (you'll get a real SMS code) |
| Business type | **Individual** |
| Legal name / DOB | your real name + DOB (accepted in test mode; nothing real submitted) |
| Address line 1 | `address_full_match` ← Stripe test passthrough |
| City / State / ZIP | any US values (e.g. `San Francisco / CA / 94103`) |
| SSN last 4 | `0000` ← test passthrough |
| Bank routing | `110000000` ← Stripe test bank |
| Bank account | `000123456789` |

5. Submit → Stripe redirects you back to `http://localhost:3000/api/connect/onboarding-return?account_id=acct_...`

### Phase 7d — Verify the onboarding completed

1. **Stripe CLI terminal** — should show an `account.updated` event with `[200 OK]`
2. **Stripe dashboard** → Connect → Accounts → new Express account with **"Charges enabled"** and **"Payouts enabled"** both green
3. **Supabase** → Table editor → `profiles` → find the test account's row → verify:
   - `stripe_connect_account_id` = `acct_...` (matches the account you just created)
   - `stripe_connect_onboarding_complete` = `true`

If any of these three fail, **stop and debug** — don't proceed to the buyer flow until the seller side is clean.

### Phase 7e — Test a purchase (verify the fee split)

1. **Sign out**, then sign in as a **different** test account (the buyer)
2. Find the listing the seller created in 7c (or create one as the seller, then sign back in as buyer)
3. Click **Buy Now** (easier than an auction for a first test)
4. On Stripe checkout, use test card: **`4242 4242 4242 4242`**, any future expiry, any CVC, any ZIP
5. Complete purchase → redirects to a success page
6. **Verify the fee split:**
   - Stripe dashboard (test mode) → **Payments** → click your test payment
   - Scroll to bottom — see a **"Transfer"** to the connected account
   - **Free-tier seller:** transfer = `total × 0.92` (you keep 8%)
   - **Premium-tier seller:** transfer = `total × 0.95` (you keep 5%)
   - Math uses `Math.floor` (seller-favorable rounding)

Example: $20.00 Buy Now by a free-tier seller = seller gets $18.40, platform keeps $1.60.

### Phase 7f — Swap back to live keys

1. In `.env.local`, swap the three values back:
   - `STRIPE_SECRET_KEY` → `sk_live_...`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → `pk_live_...`
   - `STRIPE_WEBHOOK_SECRET` → your original live `whsec_...` (from the live webhook endpoint settings page)
2. Stop Stripe CLI `listen` (Ctrl+C in that terminal) — only needed for local testing
3. Restart dev server
4. **Optional final validation on production:** make a tiny real transaction ($0.50 Buy Now) on collectors-chest.com with a real card to confirm live-mode end-to-end. Refund yourself afterwards. Not strictly necessary if test mode was clean, but a safe confidence check before real sellers onboard.

---

## Phase 8 — After testing passes

1. Update `EVALUATION.md` — move "Stripe Connect for seller payouts" from ⏳ to ✅
2. Update `BACKLOG.md` — mark any pending Connect items as complete
3. Deploy if any code changes were needed (none expected if test mode passed cleanly)
4. Announce to beta users that seller features are live

---

## Pragmatic notes

**What subscription/scan pack testing already proved** (you've done this before):
- `STRIPE_SECRET_KEY` works, Checkout Sessions work, webhook signature verification works, `checkout.session.completed` handler works.

**What's new in Connect** (all untested code paths that require Phase 7):
- Express account creation (`stripe.accounts.create`)
- Onboarding redirect flow (`/api/connect/create-account` → Stripe hosted onboarding → `/api/connect/onboarding-return`)
- `account.updated` webhook handler (writes `stripe_connect_onboarding_complete`)
- Destination charge with `transfer_data.amount` split
- Platform fee tier logic (8% free / 5% premium)
- DB fields on `profiles`: `stripe_connect_account_id`, `stripe_connect_onboarding_complete`
- ListingModal Connect gate

**Testing shortcuts available:**
- Test free-tier fee split only (premium path is identical aside from the `5` constant)
- Buy Now is sufficient — auction bid uses the same `calculateDestinationAmount` helper

**What NOT to skip:**
- Phase 7c-d (onboarding flow + DB + webhook verification) — this is the core new surface area
- Phase 7e at least once — money math bugs are expensive
