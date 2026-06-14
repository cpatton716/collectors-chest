# Closeout Residual — Owner Action Checklist (2026-06-14)

> All closeout code is **committed locally (5 closeout commits)** and is **unreleased until verified**. The new features ship with SAFE FALLBACKS, so nothing crashes before you complete these steps — but they only fully work once the migration is applied and the items below are done.

---

## 1. Apply the database migration (REQUIRED before the new features fully work)

- [ ] **Apply the migration file:** `supabase/migrations/20260614_audit_closeout.sql` (13 required + 2 optional blocks).
  - Steps: open the **Supabase dashboard → SQL Editor → paste & run**.
  - Until applied, the new code ships **SAFE FALLBACKS** — features degrade gracefully and nothing crashes.

### Verify these 5 assumptions against the live schema BEFORE running (the migration may need a tweak)

- [ ] **1. Money units.** New `sales.platform_fee` / `seller_net` are typed `DECIMAL` (dollars). If the Stripe webhook writes integer **CENTS**, switch those columns to `BIGINT`.
- [ ] **2. Winning-bid unique index.** It fails if any auction already has more than one `is_winning = true` row. **Run the de-dupe query in the file's comment first.**
- [ ] **3. `complete_trade()` assumptions.** Assumes `trade_items.owner_id` is the original owner and that only proposer/recipient participate; assumes `key_hunt_lists.user_id` is a **Clerk text id** joined via `profiles.clerk_user_id`. **Verify against `tradingDb.ts`.**
- [ ] **4. `review_barcode()` assumption.** Assumes `p_admin_id` is a `profiles.id`.
- [ ] **5. `sum_seller_platform_fees()` assumption.** Assumes seller = `sales.user_id` (there is no `seller_id` column).

### After applying

- [ ] Set `profiles.promo_trial_eligible = true` for any account that should receive the **30-day QR promo trial** (the gate **fails closed** without it).

---

## 2. New environment variables (all OPTIONAL — they fall back to `CLERK_SECRET_KEY`)

> Nothing breaks if these are unset, but set dedicated secrets for security.

- [ ] `GUEST_SCAN_SECRET` — signs the guest-scan cookie. (.env.local + Netlify)
- [ ] `PROMO_TRIAL_SECRET` — signs the QR promo token. (.env.local + Netlify)
- [ ] `UNSUBSCRIBE_SECRET` — signs the email unsubscribe token. (.env.local + Netlify)
- [ ] `SUPPORT_EMAIL` — owner-supplied support/unsubscribe inbox (currently a **placeholder in `email.ts`**). **Required** for the email `List-Unsubscribe` mailto + footer to be real.
- [ ] `TEST_EMAIL_RECIPIENT` — for the test-email route (optional).

---

## 3. Dashboard / verification steps

- [ ] **Confirm the Netlify env-var list is complete.** CLAUDE.md's known list was missing ~10 vars the code reads — e.g. `EBAY_APP_ID`, `EBAY_CLIENT_SECRET`, `EBAY_SANDBOX`, `STRIPE_PRICE_*`, `CRON_SECRET`, `ADMIN_EMAIL`, `RESEND_*_AUDIENCE_ID`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] **Stripe Connect:** subscribe `account.updated` on the **production** Stripe webhook, then run a Connect test (**M-MK14**).
- [ ] **Storage cleanup:** confirm the `comic-covers` storage bucket cleanup policy (orphan cleanup now runs on hard delete).
- [ ] **Deprecated route:** confirm **zero traffic** on the deprecated `/api/listings/[id]/purchase` route — then it can be deleted.
- [ ] **Rating-count integrity:** the dead `increment_field` calls were removed (counts are trigger-maintained). Spot-check a few profiles' `positive_ratings` / `negative_ratings`.
- [ ] **ZenRows:** decide whether to enable ZenRows for cert-lookup (currently off / deferred).
- [ ] **Node version:** tell Claude the target Node version to pin (`.nvmrc` / `engines.node`).

---

## 4. Owner-supplied content

- [ ] `/about` page real copy — origin story, team bios, contact/social. (Still placeholder.)
- [ ] Support / unsubscribe inbox address (see `SUPPORT_EMAIL` above).

---

## 5. Device / smoke testing (after migration applied)

See **TEST_CASES.md → "Closeout Test Plan — 2026-06-14"**. Priorities:

- [ ] **Clerk auth** after the SDK bump — test via **prod / ngrok / Mac-Chrome emulator, NOT a phone on a LAN IP** (Clerk fails silently there).
- [ ] **Live AI scan** after the Anthropic SDK bump.
- [ ] **`next/image` grid on iOS Safari** (repaint workaround).
- [ ] **MobileNav** pop-art restyle.
- [ ] **Pinch-to-zoom** — works app-wide, locked on scan.
- [ ] **Guest-scan cap.**
- [ ] **Destination-charge marketplace sale** (test mode).
- [ ] **Skippable bulk Mark-as-Sold** + the revenue/profit "unpriced" disclaimers.
