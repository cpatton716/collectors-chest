# Age Gate & Listing Cap UI — Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Date:** February 19, 2026

---

## Feature 1: Age Gate (18+ Self-Attestation)

### Goal
Enforce the ToS requirement that marketplace participants must be 18+ without blocking sign-up or browsing.

### Approach: Optional attestation at sign-up + just-in-time gate on marketplace actions

**Sign-up flow:**
- Optional checkbox on the custom sign-up page: "I confirm I am 18 or older"
- If checked → `age_confirmed_at` timestamp saved to profile on creation
- If unchecked → info banner shown: "Without age verification, you won't be able to list, buy, or bid on comics. You can verify later at any time." User can still complete sign-up.

**Browsing (no gate):**
- Anyone can view Shop, Auctions, listing details, prices
- No restrictions on reading/viewing marketplace content

**Marketplace actions (gated):**
- Actions gated: create listing, place bid, checkout/buy, make offer, propose trade
- Check `age_confirmed_at` on the user's profile
- If confirmed → proceed normally
- If NOT confirmed → show AgeVerificationModal
  - Pop Art styled modal: "You must confirm you are 18+ to [action]."
  - Two buttons: "I Confirm I'm 18+" (saves timestamp, retries action) or "Not Now" (blocks action, returns to browsing)

### Database Changes
- Add `age_confirmed_at TIMESTAMPTZ DEFAULT NULL` to `profiles` table
- NULL = not verified, non-null = verified at that timestamp

### API Changes
- New: `POST /api/age-verification` — sets `age_confirmed_at = now()` for the authenticated user
- Modified: Auction creation (`/api/auctions` POST), bidding (`/api/auctions/[id]/bid` POST), checkout (`/api/checkout` POST), offers (`/api/offers` POST), trade proposals (`/api/trades` POST) — all return `403 { error: "AGE_VERIFICATION_REQUIRED" }` if `age_confirmed_at` is null

### UI Changes
- **Sign-up page** (`/src/app/sign-up/[[...sign-up]]/page.tsx`): Add optional checkbox + conditional info banner
- **New component**: `AgeVerificationModal` — reusable Pop Art modal, calls `/api/age-verification`, then retries the blocked action via callback
- **Clerk webhook** (`/api/webhooks/clerk`): If sign-up metadata includes age confirmation, set `age_confirmed_at` on profile creation

### What We're NOT Building
- No browsing restrictions
- No date-of-birth collection
- No ID verification
- No blocking of sign-up flow
- No migration for existing users (only dev account exists)

---

## Feature 2: Listing Cap UI Indicator

### Goal
Show free-tier users their listing usage (X of 3) so they know their limit before hitting an error.

### Existing Implementation
- `canCreateListing()` in `subscription.ts` already enforces: free = 3 max, premium = unlimited
- `getActiveListingCount()` already queries active listing count
- Auction creation POST already calls this check

### UI Changes
- **My Auctions page** (`/src/app/my-auctions/page.tsx`):
  - Free users: Show "X of 3 listings used" badge near the page header
  - Premium users: No badge shown (unlimited)
  - At 3/3 capacity: Replace "Create Listing" button with "Upgrade to List More" CTA linking to `/pricing`
- **Create listing flow**: If at capacity when they navigate to create, show inline message with upgrade link instead of the form

### No API Changes
- All enforcement already exists server-side
- This is purely a UI enhancement

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Age verification method | Self-attestation checkbox | Low friction, legally sufficient (same as eBay, StockX) |
| Sign-up checkbox | Optional | Don't block registration; gate marketplace actions instead |
| Browsing | Ungated | Maximizes engagement; only actions involving money are gated |
| Listing cap enforcement | Already exists | Just adding UI visibility |
| Existing users | No migration | Only dev account exists (private beta) |

## Lichtenstein Pop Art Style Notes
- AgeVerificationModal: `border-3 border-pop-black`, `shadow-[4px_4px_0px_#000]`, `font-comic`
- Info banner on sign-up: `bg-pop-yellow` with `border-pop-black`
- Listing counter badge: Pop art styled pill/badge
- "Upgrade" CTA: `btn-pop btn-pop-green`
