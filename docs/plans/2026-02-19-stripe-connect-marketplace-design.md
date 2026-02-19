# Stripe Connect Marketplace Payments - Design

> **Date:** February 19, 2026
> **Status:** Approved
> **Scope:** Replace placeholder payment flow with Stripe Connect for automated seller payouts

---

## Problem

Buyers can pay for auction wins and Buy Now purchases via Stripe, but the platform holds the full amount with no payout mechanism to sellers. The platform owner does not want to be a middleman manually managing payouts.

## Decision

Use **Stripe Connect** with destination charges for fully automated marketplace payments:
- Buyer pays via Stripe Checkout (card, Apple Pay, Google Pay)
- Stripe auto-splits: seller receives sale price minus platform fee, platform receives fee
- Seller links a bank account or debit card via Stripe Connect onboarding
- No manual payout management required

**Subscriptions remain on standard Stripe** (separate from Connect).

PayPal/Venmo as buyer payment methods deferred to post-launch based on demand.

---

## Payment Flow

```
Buyer wins auction / clicks Buy Now / offer accepted
    |
    v
Stripe Checkout (destination charge)
    |
    v
Stripe auto-splits payment:
  --> Seller's connected account: sale price - platform fee
  --> Platform account: platform fee (8% free / 5% premium)
    |
    v
Webhook fires:
  --> Auction/listing status updated (paid)
  --> Collection ownership transferred
  --> Seller notified
  --> Buyer notified
    |
    v
Stripe pays out to seller's bank (typically 2 business days)
```

## Seller Onboarding

- Triggered when a user attempts to list their first item for sale
- Redirects to Stripe Connect onboarding (Stripe handles identity verification, bank account collection)
- On completion, `stripe_connect_account_id` stored in `profiles` table
- All future sales automatically pay out to their connected account
- Seller can manage payout settings via Stripe Express dashboard

## Fee Structure (Unchanged)

| Seller Tier | Platform Fee | Stripe Processing |
|-------------|-------------|-------------------|
| Free        | 8%          | 2.9% + $0.30      |
| Premium     | 5%          | 2.9% + $0.30      |

Existing fee calculation logic in `src/lib/subscription.ts` stays as-is.

## Premium Upsell for Free Sellers

- **Trigger:** After 3rd completed sale for free-tier sellers
- **Content:** Shows actual fees paid vs. what they would have paid at premium rate
- **Example:** "You've sold 3 items and paid $12.40 in fees. With Premium, that would have been $7.75 -- a savings of $4.65. Upgrade to save 3% on every future sale."
- **Dismissable:** Yes, re-shows after every 3rd sale (6th, 9th, etc.) while on free tier
- **Location:** Modal after sale completion confirmation
- **CTA:** Links to existing pricing/upgrade page
- **Style:** Lichtenstein Pop Art (consistent with site design language)

## Codebase Changes

### New
- Seller onboarding API route (create Connect account, handle redirect)
- Connect onboarding return/refresh pages
- Connect webhook handlers (`account.updated`, `transfer` events)
- Seller payout status display (in account/profile)
- Premium upsell modal component (Lichtenstein Pop Art style)
- Sale completion count tracking for upsell trigger

### Modified
- Checkout flow: update to use Connect destination charges (`transfer_data`)
- Auction/listing creation: require connected Stripe account to list
- Auction completion webhook: trigger collection transfer + notifications
- `profiles` table: add `stripe_connect_account_id` column

### Unchanged
- Stripe subscription billing (completely separate)
- Fee percentages (8%/5%)
- Auction/Buy Now/Offer UI workflows
- Existing `subscription.ts` fee calculation logic

## UI Design Requirement

All new components must follow the site's Lichtenstein Pop Art aesthetic. Reference existing components (btn-pop variants, font-comic, pop-art borders, halftone patterns) for visual consistency.
