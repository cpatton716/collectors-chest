# Stripe Connect Marketplace Payments - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable automated seller payouts via Stripe Connect destination charges, with platform fee collection and a premium upsell modal after a free seller's 3rd completed sale.

**Architecture:** Buyers pay via Stripe Checkout (existing). Checkout sessions use `transfer_data` to route the seller's share to their connected Stripe account, keeping the platform fee automatically. Sellers onboard via Stripe Connect Express, triggered when they first attempt to list an item. A premium upsell modal displays after every 3rd completed sale for free-tier sellers, showing actual fee savings.

**Tech Stack:** Stripe Connect (Express accounts), Next.js API routes, Supabase (Postgres), React modals with Lichtenstein Pop Art styling.

---

## Task 1: Database Migration — Add Connect Fields to Profiles

**Files:**
- Create: `supabase/migrations/20260219_add_stripe_connect_fields.sql`

**Step 1: Write the migration SQL**

```sql
-- Add Stripe Connect fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_complete BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completed_sales_count INTEGER DEFAULT 0;

-- Index for Connect account lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_connect_account_id
  ON profiles(stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;
```

**Step 2: Run migration against Supabase**

Run the SQL in Supabase dashboard SQL editor (or via CLI if configured).

**Step 3: Update the Profile TypeScript type**

Modify: `src/lib/db.ts` — Add the new columns to the `Profile` interface (around line 30-48):

```typescript
stripe_connect_account_id?: string | null;
stripe_connect_onboarding_complete?: boolean;
completed_sales_count?: number;
```

**Step 4: Commit**

```bash
git add supabase/migrations/20260219_add_stripe_connect_fields.sql src/lib/db.ts
git commit -m "feat: add Stripe Connect fields to profiles schema"
```

---

## Task 2: Stripe Connect Helper Library

**Files:**
- Create: `src/lib/stripeConnect.ts`
- Test: `src/lib/__tests__/stripeConnect.test.ts`

**Step 1: Write the failing tests**

Create `src/lib/__tests__/stripeConnect.test.ts`:

```typescript
import {
  calculateDestinationAmount,
  isConnectOnboardingComplete,
  buildOnboardingReturnUrl,
  buildOnboardingRefreshUrl,
  shouldShowPremiumUpsell,
} from "../stripeConnect";

describe("stripeConnect", () => {
  describe("calculateDestinationAmount", () => {
    it("calculates seller amount for free tier (8% fee)", () => {
      // Sale: $100, free tier (8% fee) → seller gets $92.00
      const result = calculateDestinationAmount(10000, 8);
      expect(result).toEqual({
        sellerAmount: 9200,
        platformFee: 800,
      });
    });

    it("calculates seller amount for premium tier (5% fee)", () => {
      // Sale: $100, premium tier (5% fee) → seller gets $95.00
      const result = calculateDestinationAmount(10000, 5);
      expect(result).toEqual({
        sellerAmount: 9500,
        platformFee: 500,
      });
    });

    it("handles small amounts correctly", () => {
      // Sale: $5.00, 8% fee → fee $0.40, seller $4.60
      const result = calculateDestinationAmount(500, 8);
      expect(result).toEqual({
        sellerAmount: 460,
        platformFee: 40,
      });
    });

    it("rounds fee down to nearest cent (seller-favorable)", () => {
      // Sale: $7.33, 8% fee → fee $0.5864 → rounds to $0.58, seller $6.75
      const result = calculateDestinationAmount(733, 8);
      expect(result.platformFee).toBe(58);
      expect(result.sellerAmount).toBe(675);
    });

    it("handles zero amount", () => {
      const result = calculateDestinationAmount(0, 8);
      expect(result).toEqual({ sellerAmount: 0, platformFee: 0 });
    });
  });

  describe("isConnectOnboardingComplete", () => {
    it("returns true when account ID exists and onboarding is complete", () => {
      expect(
        isConnectOnboardingComplete("acct_123", true)
      ).toBe(true);
    });

    it("returns false when account ID is missing", () => {
      expect(isConnectOnboardingComplete(null, true)).toBe(false);
    });

    it("returns false when onboarding is not complete", () => {
      expect(
        isConnectOnboardingComplete("acct_123", false)
      ).toBe(false);
    });
  });

  describe("shouldShowPremiumUpsell", () => {
    it("returns true after 3rd sale for free tier", () => {
      expect(shouldShowPremiumUpsell("free", 3)).toBe(true);
    });

    it("returns true after 6th sale for free tier", () => {
      expect(shouldShowPremiumUpsell("free", 6)).toBe(true);
    });

    it("returns true after 9th sale for free tier", () => {
      expect(shouldShowPremiumUpsell("free", 9)).toBe(true);
    });

    it("returns false after 1st or 2nd sale", () => {
      expect(shouldShowPremiumUpsell("free", 1)).toBe(false);
      expect(shouldShowPremiumUpsell("free", 2)).toBe(false);
    });

    it("returns false after 4th or 5th sale", () => {
      expect(shouldShowPremiumUpsell("free", 4)).toBe(false);
      expect(shouldShowPremiumUpsell("free", 5)).toBe(false);
    });

    it("never triggers for premium tier", () => {
      expect(shouldShowPremiumUpsell("premium", 3)).toBe(false);
      expect(shouldShowPremiumUpsell("premium", 6)).toBe(false);
    });

    it("returns false for zero sales", () => {
      expect(shouldShowPremiumUpsell("free", 0)).toBe(false);
    });
  });

  describe("buildOnboardingReturnUrl", () => {
    it("builds return URL with account ID", () => {
      const url = buildOnboardingReturnUrl("https://example.com", "acct_123");
      expect(url).toBe(
        "https://example.com/api/connect/onboarding-return?account_id=acct_123"
      );
    });
  });

  describe("buildOnboardingRefreshUrl", () => {
    it("builds refresh URL with account ID", () => {
      const url = buildOnboardingRefreshUrl("https://example.com", "acct_123");
      expect(url).toBe(
        "https://example.com/api/connect/onboarding-refresh?account_id=acct_123"
      );
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/__tests__/stripeConnect.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/lib/stripeConnect.ts`:

```typescript
import type { SubscriptionTier } from "./subscription";

/**
 * Calculate the destination (seller) amount and platform fee in cents.
 * Uses Math.floor on fee so rounding is seller-favorable.
 */
export function calculateDestinationAmount(
  totalCents: number,
  platformFeePercent: number
): { sellerAmount: number; platformFee: number } {
  if (totalCents <= 0) return { sellerAmount: 0, platformFee: 0 };
  const platformFee = Math.floor(totalCents * (platformFeePercent / 100));
  const sellerAmount = totalCents - platformFee;
  return { sellerAmount, platformFee };
}

/**
 * Check if a seller has completed Stripe Connect onboarding.
 */
export function isConnectOnboardingComplete(
  connectAccountId: string | null | undefined,
  onboardingComplete: boolean | undefined
): boolean {
  return !!connectAccountId && !!onboardingComplete;
}

/**
 * Determine whether to show the premium upsell modal.
 * Triggers on every 3rd completed sale (3, 6, 9, ...) for free-tier sellers.
 */
export function shouldShowPremiumUpsell(
  tier: SubscriptionTier | string,
  completedSalesCount: number
): boolean {
  if (tier === "premium" || tier === "trialing") return false;
  if (completedSalesCount <= 0) return false;
  return completedSalesCount % 3 === 0;
}

/**
 * Build the return URL for after Connect onboarding completes.
 */
export function buildOnboardingReturnUrl(
  baseUrl: string,
  accountId: string
): string {
  return `${baseUrl}/api/connect/onboarding-return?account_id=${accountId}`;
}

/**
 * Build the refresh URL for when Connect onboarding link expires.
 */
export function buildOnboardingRefreshUrl(
  baseUrl: string,
  accountId: string
): string {
  return `${baseUrl}/api/connect/onboarding-refresh?account_id=${accountId}`;
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/__tests__/stripeConnect.test.ts`
Expected: All 12 tests PASS

**Step 5: Commit**

```bash
git add src/lib/stripeConnect.ts src/lib/__tests__/stripeConnect.test.ts
git commit -m "feat: add Stripe Connect helper library with tests"
```

---

## Task 3: Connect Onboarding API — Create Account & Start Onboarding

**Files:**
- Create: `src/app/api/connect/create-account/route.ts`

**Step 1: Write the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, stripe_connect_account_id, stripe_connect_onboarding_complete")
      .eq("clerk_id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // If already has a complete Connect account, return early
    if (profile.stripe_connect_account_id && profile.stripe_connect_onboarding_complete) {
      return NextResponse.json({ alreadyComplete: true });
    }

    let accountId = profile.stripe_connect_account_id;

    // Create Connect Express account if none exists
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: profile.email,
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          profile_id: profile.id,
        },
      });
      accountId = account.id;

      // Save to profile
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_connect_account_id: accountId })
        .eq("id", profile.id);
    }

    // Create onboarding link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/api/connect/onboarding-refresh?account_id=${accountId}`,
      return_url: `${baseUrl}/api/connect/onboarding-return?account_id=${accountId}`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error("Connect account creation error:", error);
    return NextResponse.json(
      { error: "Failed to create seller account" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/connect/create-account/route.ts
git commit -m "feat: add Connect account creation and onboarding API route"
```

---

## Task 4: Connect Onboarding Return & Refresh Routes

**Files:**
- Create: `src/app/api/connect/onboarding-return/route.ts`
- Create: `src/app/api/connect/onboarding-refresh/route.ts`

**Step 1: Write the return handler**

Create `src/app/api/connect/onboarding-return/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.redirect(new URL("/settings?connect=error", req.url));
  }

  try {
    // Check account status with Stripe
    const account = await stripe.accounts.retrieve(accountId);
    const isComplete = account.charges_enabled && account.details_submitted;

    // Update profile
    await supabaseAdmin
      .from("profiles")
      .update({ stripe_connect_onboarding_complete: isComplete })
      .eq("stripe_connect_account_id", accountId);

    const status = isComplete ? "success" : "incomplete";
    return NextResponse.redirect(new URL(`/settings?connect=${status}`, req.url));
  } catch (error) {
    console.error("Onboarding return error:", error);
    return NextResponse.redirect(new URL("/settings?connect=error", req.url));
  }
}
```

**Step 2: Write the refresh handler**

Create `src/app/api/connect/onboarding-refresh/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.redirect(new URL("/settings?connect=error", req.url));
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

    // Create a fresh onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/api/connect/onboarding-refresh?account_id=${accountId}`,
      return_url: `${baseUrl}/api/connect/onboarding-return?account_id=${accountId}`,
      type: "account_onboarding",
    });

    return NextResponse.redirect(accountLink.url);
  } catch (error) {
    console.error("Onboarding refresh error:", error);
    return NextResponse.redirect(new URL("/settings?connect=error", req.url));
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/connect/onboarding-return/route.ts src/app/api/connect/onboarding-refresh/route.ts
git commit -m "feat: add Connect onboarding return and refresh handlers"
```

---

## Task 5: Connect Status API Route

**Files:**
- Create: `src/app/api/connect/status/route.ts`

**Step 1: Write the status endpoint**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_onboarding_complete, completed_sales_count")
      .eq("clerk_id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (!profile.stripe_connect_account_id) {
      return NextResponse.json({
        connected: false,
        onboardingComplete: false,
        completedSales: profile.completed_sales_count || 0,
      });
    }

    // Fetch live status from Stripe
    const account = await stripe.accounts.retrieve(
      profile.stripe_connect_account_id
    );

    const isComplete = account.charges_enabled && account.details_submitted;

    // Sync onboarding status if changed
    if (isComplete !== profile.stripe_connect_onboarding_complete) {
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_connect_onboarding_complete: isComplete })
        .eq("stripe_connect_account_id", profile.stripe_connect_account_id);
    }

    return NextResponse.json({
      connected: true,
      onboardingComplete: isComplete,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      completedSales: profile.completed_sales_count || 0,
    });
  } catch (error) {
    console.error("Connect status error:", error);
    return NextResponse.json(
      { error: "Failed to get seller status" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/connect/status/route.ts
git commit -m "feat: add Connect status API route"
```

---

## Task 6: Connect Stripe Dashboard Link

**Files:**
- Create: `src/app/api/connect/dashboard/route.ts`

**Step 1: Write the dashboard link route**

This lets sellers access their Stripe Express dashboard to manage payouts.

```typescript
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_onboarding_complete")
      .eq("clerk_id", userId)
      .single();

    if (!profile?.stripe_connect_account_id || !profile.stripe_connect_onboarding_complete) {
      return NextResponse.json(
        { error: "Seller account not set up" },
        { status: 400 }
      );
    }

    const loginLink = await stripe.accounts.createLoginLink(
      profile.stripe_connect_account_id
    );

    return NextResponse.json({ url: loginLink.url });
  } catch (error) {
    console.error("Dashboard link error:", error);
    return NextResponse.json(
      { error: "Failed to create dashboard link" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/connect/dashboard/route.ts
git commit -m "feat: add Connect Express dashboard link route"
```

---

## Task 7: Modify Checkout to Use Destination Charges

**Files:**
- Modify: `src/app/api/checkout/route.ts`

**Step 1: Update the checkout route**

The existing checkout creates a standard Stripe session. We need to add `transfer_data` to route the seller's share to their connected account.

Key changes to the POST handler (around line 55-95):

1. After fetching the auction, look up the seller's Connect account:

```typescript
// Fetch seller's Connect account
const { data: sellerProfile } = await supabaseAdmin
  .from("profiles")
  .select("stripe_connect_account_id, stripe_connect_onboarding_complete")
  .eq("id", auction.seller_id)
  .single();

if (!sellerProfile?.stripe_connect_account_id || !sellerProfile.stripe_connect_onboarding_complete) {
  return NextResponse.json(
    { error: "Seller has not completed payment setup" },
    { status: 400 }
  );
}
```

2. Calculate the destination amount using the helper:

```typescript
import { calculateDestinationAmount } from "@/lib/stripeConnect";

const totalCents = Math.round(total * 100);
const { sellerAmount } = calculateDestinationAmount(
  totalCents,
  auction.platform_fee_percent
);
```

3. Add `payment_intent_data.transfer_data` to the session creation:

```typescript
payment_intent_data: {
  transfer_data: {
    destination: sellerProfile.stripe_connect_account_id,
    amount: sellerAmount,
  },
},
```

This tells Stripe: "Of the total payment, send `sellerAmount` to the connected account. Keep the rest (platform fee + Stripe processing) in our account."

**Step 2: Verify the build compiles**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/app/api/checkout/route.ts
git commit -m "feat: add destination charges to checkout for Connect payouts"
```

---

## Task 8: Update Webhook — Increment Sales Count & Handle Connect Events

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`

**Step 1: Add sales count increment to auction payment handler**

In the existing `checkout.session.completed` handler for auction payments (around line 151-216), after the sale is recorded and notifications sent, add:

```typescript
// Increment seller's completed sales count
await supabaseAdmin.rpc("increment_completed_sales", {
  profile_id: sellerId,
});
```

**Step 2: Create the Supabase RPC function**

Add to migration `supabase/migrations/20260219_add_stripe_connect_fields.sql`:

```sql
-- Function to atomically increment completed_sales_count
CREATE OR REPLACE FUNCTION increment_completed_sales(profile_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET completed_sales_count = COALESCE(completed_sales_count, 0) + 1
  WHERE id = profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Step 3: Add Connect account update webhook handler**

Add a new case in the webhook event switch (after existing subscription handlers):

```typescript
case "account.updated": {
  const account = event.data.object as Stripe.Account;
  const isComplete = account.charges_enabled && account.details_submitted;

  await supabaseAdmin
    .from("profiles")
    .update({ stripe_connect_onboarding_complete: isComplete })
    .eq("stripe_connect_account_id", account.id);

  break;
}
```

**Step 4: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts supabase/migrations/20260219_add_stripe_connect_fields.sql
git commit -m "feat: increment sales count on payment, handle Connect account.updated webhook"
```

---

## Task 9: Gate Listing Creation on Connect Onboarding

**Files:**
- Modify: `src/app/api/auctions/route.ts` (POST handler, around line 94-213)

**Step 1: Add Connect account check**

After the existing suspension check (around line 112), add a check for Connect onboarding:

```typescript
// Check seller has completed Stripe Connect onboarding
const { data: sellerProfile } = await supabaseAdmin
  .from("profiles")
  .select("stripe_connect_account_id, stripe_connect_onboarding_complete")
  .eq("id", profile.id)
  .single();

if (!sellerProfile?.stripe_connect_account_id || !sellerProfile.stripe_connect_onboarding_complete) {
  return NextResponse.json(
    { error: "CONNECT_REQUIRED", message: "You must set up seller payments before listing items." },
    { status: 403 }
  );
}
```

**Step 2: Commit**

```bash
git add src/app/api/auctions/route.ts
git commit -m "feat: require Connect onboarding before creating listings"
```

---

## Task 10: Seller Onboarding UI Component

**Files:**
- Create: `src/components/auction/ConnectSetupPrompt.tsx`

**Step 1: Write the component**

This component displays when a user tries to create a listing but hasn't set up Connect. It follows the Lichtenstein Pop Art design language.

```tsx
"use client";

import { useState } from "react";
import { CreditCard, ArrowRight, ShieldCheck } from "lucide-react";

export default function ConnectSetupPrompt({
  onClose,
}: {
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/connect/create-account", {
        method: "POST",
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.alreadyComplete) {
        onClose();
        window.location.reload();
      }
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-pop-white border-3 border-pop-black shadow-[6px_6px_0px_#000] rounded-lg max-w-md w-full">
        {/* Header */}
        <div className="bg-pop-blue border-b-3 border-pop-black p-4 rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-comic text-xl text-white">SET UP SELLER PAYMENTS</h2>
              <p className="text-white/80 text-sm">One-time setup to start selling</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-pop-black font-body">
            Before you can list items for sale, you need to connect a bank account
            so you can receive payments from buyers.
          </p>

          <div className="bg-pop-yellow/20 border-2 border-pop-black rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-pop-blue" />
              <span className="font-comic text-sm">SECURE & SIMPLE</span>
            </div>
            <ul className="text-sm font-body space-y-1 ml-7">
              <li>Powered by Stripe — trusted by millions</li>
              <li>Link your bank account or debit card</li>
              <li>Get paid automatically when items sell</li>
              <li>Takes about 5 minutes</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t-3 border-pop-black flex gap-3">
          <button
            onClick={onClose}
            className="btn-pop btn-pop-white flex-1 py-2 text-sm font-comic"
          >
            CANCEL
          </button>
          <button
            onClick={handleSetup}
            disabled={loading}
            className="btn-pop btn-pop-green flex-1 py-2 text-sm font-comic flex items-center justify-center gap-2"
          >
            {loading ? "CONNECTING..." : "SET UP PAYMENTS"}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Integrate into listing creation flow**

Modify the component that handles "Create Listing" to catch the `CONNECT_REQUIRED` error and show this prompt. Check the listing creation form component — likely in `src/components/auction/CreateListingForm.tsx` or similar. When the API returns `{ error: "CONNECT_REQUIRED" }`, show `<ConnectSetupPrompt />` instead of a generic error.

**Step 3: Commit**

```bash
git add src/components/auction/ConnectSetupPrompt.tsx
git commit -m "feat: add Connect setup prompt with pop-art styling"
```

---

## Task 11: Premium Upsell Modal After 3rd Sale

**Files:**
- Create: `src/components/auction/PremiumSellerUpsell.tsx`

**Step 1: Write the upsell modal**

```tsx
"use client";

import { useState } from "react";
import { TrendingUp, X, Zap, Star } from "lucide-react";
import Link from "next/link";

interface PremiumSellerUpsellProps {
  totalFeesPaid: number; // Total fees the seller has paid (in dollars)
  totalSales: number; // Number of completed sales
  currentFeePercent: number; // 8 for free tier
  premiumFeePercent: number; // 5 for premium
  onDismiss: () => void;
}

export default function PremiumSellerUpsell({
  totalFeesPaid,
  totalSales,
  currentFeePercent,
  premiumFeePercent,
  onDismiss,
}: PremiumSellerUpsellProps) {
  const savings = totalFeesPaid * ((currentFeePercent - premiumFeePercent) / currentFeePercent);
  const savingsFormatted = savings.toFixed(2);
  const feesPaidFormatted = totalFeesPaid.toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-pop-white border-3 border-pop-black shadow-[6px_6px_0px_#000] rounded-lg max-w-md w-full relative">
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-pop-black/60 hover:text-pop-black z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-pop-blue to-purple-600 border-b-3 border-pop-black p-5 rounded-t-lg text-center">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <h2 className="font-comic text-2xl text-white">YOU&apos;RE ON A ROLL!</h2>
          <p className="text-white/80 text-sm font-body mt-1">
            {totalSales} sales completed
          </p>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Fee comparison */}
          <div className="bg-pop-yellow/20 border-2 border-pop-black rounded-lg p-4 text-center">
            <p className="font-body text-sm text-pop-black/70 mb-1">
              You&apos;ve paid in seller fees
            </p>
            <p className="font-comic text-3xl text-pop-red">${feesPaidFormatted}</p>
            <p className="font-body text-sm text-pop-black/70 mt-2">
              With Premium, you would have saved
            </p>
            <p className="font-comic text-2xl text-pop-green">${savingsFormatted}</p>
          </div>

          {/* Benefits */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-pop-green rounded-full flex items-center justify-center flex-shrink-0">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-body text-sm">
                <strong>{premiumFeePercent}% seller fees</strong> instead of {currentFeePercent}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-pop-green rounded-full flex items-center justify-center flex-shrink-0">
                <Star className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-body text-sm">
                Unlimited scans, Key Hunt, CSV export & more
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t-3 border-pop-black flex gap-3">
          <button
            onClick={onDismiss}
            className="btn-pop btn-pop-white flex-1 py-2 text-sm font-comic"
          >
            MAYBE LATER
          </button>
          <Link
            href="/pricing"
            className="btn-pop btn-pop-blue flex-1 py-2 text-sm font-comic text-center"
            onClick={onDismiss}
          >
            VIEW PLANS
          </Link>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/auction/PremiumSellerUpsell.tsx
git commit -m "feat: add premium seller upsell modal with pop-art styling"
```

---

## Task 12: Wire Up Upsell Trigger in Payment Success Flow

**Files:**
- Modify: The page that handles payment success (likely the my-auctions page or auction detail page that shows after redirect from Stripe)

**Step 1: Research the payment success page**

The checkout route redirects to `/my-auctions?payment=success&auction={auctionId}` on success. Find the component that reads this query param and shows a success message.

**Step 2: Add upsell logic**

After showing the payment success message (to the SELLER, not the buyer — triggered by webhook), check:

1. Fetch `/api/connect/status` to get `completedSales` count
2. Call `shouldShowPremiumUpsell(tier, completedSales)` from `stripeConnect.ts`
3. If true, calculate fees from sales history and show `<PremiumSellerUpsell />`

The upsell should appear to the **seller** after the sale completes. The trigger point is when the seller views their sold item or receives the "payment received" notification. The exact integration point should be determined by checking the seller's post-sale experience in the app (e.g., notifications page, my-auctions page with sold items).

**Step 3: Fetch seller fee history for the upsell**

Create an API route or add to the connect/status route:

```typescript
// Calculate total fees paid by this seller
const { data: sales } = await supabaseAdmin
  .from("sales")
  .select("sale_price")
  .eq("user_id", profileId);

const totalSalesAmount = sales?.reduce((sum, s) => sum + (s.sale_price || 0), 0) || 0;
const totalFeesPaid = totalSalesAmount * (platformFeePercent / 100);
```

**Step 4: Commit**

```bash
git commit -m "feat: wire up premium upsell trigger after sale completion"
```

---

## Task 13: Seller Payout Settings in Account Page

**Files:**
- Modify: `src/app/settings/page.tsx` (or wherever account settings live)

**Step 1: Add a "Seller Payments" section**

Add a section to the settings page showing Connect status and a link to the Stripe Express dashboard:

```tsx
{/* Seller Payments Section */}
<div className="bg-pop-white border-3 border-pop-black shadow-[4px_4px_0px_#000] rounded-lg p-4">
  <h3 className="font-comic text-lg mb-3">SELLER PAYMENTS</h3>
  {connectStatus.onboardingComplete ? (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-pop-green rounded-full" />
        <span className="font-body text-sm">Payment setup complete</span>
      </div>
      <p className="font-body text-sm text-pop-black/60">
        {connectStatus.completedSales} sales completed
      </p>
      <button
        onClick={handleOpenDashboard}
        className="btn-pop btn-pop-blue py-2 px-4 text-sm font-comic"
      >
        VIEW PAYOUT DASHBOARD
      </button>
    </div>
  ) : connectStatus.connected ? (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-pop-yellow rounded-full" />
        <span className="font-body text-sm">Setup incomplete</span>
      </div>
      <button
        onClick={handleSetupConnect}
        className="btn-pop btn-pop-green py-2 px-4 text-sm font-comic"
      >
        COMPLETE SETUP
      </button>
    </div>
  ) : (
    <div className="space-y-3">
      <p className="font-body text-sm text-pop-black/60">
        Set up payments to start selling comics on the marketplace.
      </p>
      <button
        onClick={handleSetupConnect}
        className="btn-pop btn-pop-green py-2 px-4 text-sm font-comic"
      >
        SET UP SELLER PAYMENTS
      </button>
    </div>
  )}
</div>
```

The `handleOpenDashboard` function calls `POST /api/connect/dashboard` and redirects to the returned URL. The `handleSetupConnect` function calls `POST /api/connect/create-account` and redirects.

**Step 2: Commit**

```bash
git commit -m "feat: add seller payment settings section with Connect status"
```

---

## Task 14: Final Verification & Integration Testing

**Step 1: Run all unit tests**

Run: `npm test`
Expected: All tests pass (existing 248 + new stripeConnect tests)

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Manual testing checklist**

- [ ] Visit settings page — "Seller Payments" section shows "Set Up" state
- [ ] Click "Set Up Seller Payments" — redirects to Stripe Connect onboarding (sandbox)
- [ ] Complete onboarding — redirects back to settings with success status
- [ ] Try to create a listing — succeeds (no CONNECT_REQUIRED error)
- [ ] Without Connect setup, try to create a listing — shows ConnectSetupPrompt
- [ ] Buy an item (sandbox) — payment splits correctly in Stripe dashboard
- [ ] After 3rd sale as free seller — premium upsell modal appears

**Step 6: Commit any remaining fixes**

```bash
git commit -m "fix: address integration testing feedback"
```

---

## Environment Variables

The following env var is already present (`STRIPE_SECRET_KEY`). No new environment variables are needed — Stripe Connect uses the same API key.

However, ensure `NEXT_PUBLIC_APP_URL` is set for building correct return/refresh URLs:

```
NEXT_PUBLIC_APP_URL=https://collectors-chest.com  (production)
NEXT_PUBLIC_APP_URL=http://localhost:3000  (development)
```

---

## Task Dependency Order

```
Task 1 (DB migration) ──┐
Task 2 (Helper lib)  ───┤
                         ├── Task 7 (Modify checkout) ──┐
Task 3 (Create account)─┤                               │
Task 4 (Return/refresh)─┤── Task 9 (Gate listings) ─────┤
Task 5 (Status route) ──┤                               ├── Task 14 (Verification)
Task 6 (Dashboard link)─┤── Task 13 (Settings UI) ──────┤
                         │                               │
Task 8 (Webhook update)─┴── Task 11 (Upsell modal) ─────┤
                             Task 12 (Wire up trigger) ──┘
                             Task 10 (Setup prompt UI) ──┘
```

Tasks 1-6 can be parallelized. Tasks 7-13 have some dependencies. Task 14 is the final gate.
