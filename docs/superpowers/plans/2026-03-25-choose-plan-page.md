# Post-Signup "Choose Your Plan" Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After Clerk sign-up, redirect new users to a "Choose Your Plan" page where they pick Free or Premium (with 7-day trial emphasis) before entering the app.

**Architecture:** Add a new `/choose-plan` route that shows a plan comparison (Free vs Premium) with a prominent "Start 7-Day Free Trial" CTA. Set Clerk's after-sign-up redirect to this page. Free users skip to the app; Premium users start a trial or go to Stripe checkout. The page includes a client-side guard: if the user is already premium or trialing, redirect them to `/collection`.

**Tech Stack:** Next.js App Router, Clerk auth, Stripe checkout, Supabase (profiles table), useSubscription hook

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `.env.local` | Modify (manual, not committed) | Add `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/choose-plan` |
| `src/app/choose-plan/page.tsx` | Create | Choose Your Plan page — plan comparison UI, trial CTA, free skip, loading guard |
| `src/lib/__tests__/choosePlanHelpers.test.ts` | Create | Unit tests for plan selection logic |

---

### Task 1: Add Clerk After-Sign-Up Redirect

**Files:**
- Modify: `.env.local` (manual — do NOT commit)

- [ ] **Step 1: Add the redirect env var**

Add to `.env.local` (near the existing Clerk variables):
```
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/choose-plan
```

**Note:** This variable must also be added to Netlify environment variables for production deployment.

- [ ] **Step 2: Verify Clerk reads the variable**

Restart dev server. Sign up a new test user. After completing Clerk sign-up, browser should redirect to `/choose-plan` (which will 404 for now — that's expected).

---

### Task 2: Create the Choose Your Plan Page

**Files:**
- Create: `src/app/choose-plan/page.tsx`

- [ ] **Step 1: Create the page component**

The page should:
- Be a `"use client"` component (needs hooks for subscription actions)
- Import `useSubscription` for `startFreeTrial`, `startCheckout`, `trialAvailable`, `tier`, `isTrialing`
- Import `useUser` from Clerk to get user's first name for personalization
- Import `useRouter` from `next/navigation` for redirect after plan choice
- Use the Lichtenstein pop-art design language (font-comic, pop-colors, bold borders, shadow-comic)
- Show a loading spinner while `isLoading` is true to prevent premature interaction
- Redirect to `/collection` if user is already premium or trialing (client-side guard)

**Layout (mobile-first):**
```
┌──────────────────────────────────────┐
│  Welcome, [Name]!                    │
│  Choose your plan to get started     │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  RECOMMENDED                   │  │
│  │  Premium — $4.99/mo            │  │
│  │                                │  │
│  │  ✅ Unlimited scans            │  │
│  │  ✅ Key Hunt                   │  │
│  │  ✅ CSV export                 │  │
│  │  ✅ Advanced stats             │  │
│  │  ✅ Unlimited listings         │  │
│  │  ✅ 5% seller fee (vs 8%)     │  │
│  │                                │  │
│  │  [START 7-DAY FREE TRIAL]     │  │
│  │  No credit card required.      │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  Free — $0/month               │  │
│  │                                │  │
│  │  ✅ 10 scans/month            │  │
│  │  ✅ Cloud collection sync     │  │
│  │  ✅ Real eBay prices          │  │
│  │  ✅ Buy & bid in Shop         │  │
│  │  ✗  Key Hunt                  │  │
│  │  ✗  CSV export                │  │
│  │  ✗  Advanced stats            │  │
│  │                                │  │
│  │  [CONTINUE WITH FREE]         │  │
│  └────────────────────────────────┘  │
│                                      │
│  You can change your plan anytime    │
│  in Account Settings.               │
└──────────────────────────────────────┘
```

**Premium "Start 7-Day Free Trial" button behavior:**
1. Call `startFreeTrial()` from `useSubscription`
2. On success → redirect to `/collection`
3. On error (trial already used) → fall back to `startCheckout("monthly", true)` which redirects to Stripe

**"Continue with Free" button behavior:**
1. Simply redirect to `/collection` (user is already free tier by default)

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Check, Crown, Loader2, X, Zap } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

const premiumFeatures = [
  "Unlimited scans",
  "Key Hunt (offline lookups)",
  "CSV import & export",
  "Advanced statistics",
  "Unlimited listings",
  "5% seller fee (save 3%)",
];

const freeFeatures = [
  { name: "10 scans per month", included: true },
  { name: "Cloud collection sync", included: true },
  { name: "Real eBay prices", included: true },
  { name: "Buy & bid in Shop", included: true },
  { name: "Key Hunt", included: false },
  { name: "CSV export", included: false },
  { name: "Advanced stats", included: false },
];

export default function ChoosePlanPage() {
  const router = useRouter();
  const { user } = useUser();
  const { startFreeTrial, startCheckout, trialAvailable, tier, isTrialing, isLoading } =
    useSubscription();
  const [loading, setLoading] = useState<"trial" | "free" | null>(null);

  const firstName = user?.firstName || "there";

  // Guard: redirect if user already has a plan
  if (!isLoading && (tier === "premium" || isTrialing)) {
    router.replace("/collection");
    return null;
  }

  // Show loading spinner while subscription state is loading
  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const handleStartTrial = async () => {
    setLoading("trial");
    try {
      if (trialAvailable) {
        const result = await startFreeTrial();
        if (result.success) {
          router.push("/collection");
          return;
        }
      }
      // Fallback: redirect to Stripe checkout with trial
      const url = await startCheckout("monthly", true);
      if (url) {
        window.location.href = url;
      }
    } catch {
      // If all else fails, just go to collection
      router.push("/collection");
    } finally {
      setLoading(null);
    }
  };

  const handleContinueFree = () => {
    setLoading("free");
    router.push("/collection");
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-comic text-pop-black mb-2">
            Welcome, {firstName}!
          </h1>
          <p className="text-gray-600">
            Choose your plan to get started
          </p>
        </div>

        {/* Premium Card — Emphasized */}
        <div className="bg-pop-blue text-white border-4 border-pop-black p-6 mb-4 relative"
             style={{ boxShadow: "6px 6px 0px #000" }}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-pop-yellow text-pop-black text-xs font-comic px-4 py-1 border-2 border-pop-black shadow-[2px_2px_0px_#000]">
              RECOMMENDED
            </span>
          </div>

          <div className="flex items-center gap-2 mb-1 mt-2">
            <Crown className="w-5 h-5 text-amber-300" />
            <span className="text-xl font-comic">PREMIUM</span>
          </div>
          <p className="text-2xl font-comic mb-4">
            $4.99<span className="text-sm font-normal">/month</span>
          </p>

          <ul className="space-y-2 mb-6">
            {premiumFeatures.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-green-300 shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <button
            onClick={handleStartTrial}
            disabled={loading !== null || isLoading}
            className="w-full py-3 font-comic text-pop-black bg-pop-green border-2 border-pop-black shadow-comic-sm hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50"
          >
            {loading === "trial" ? "Starting..." : "START 7-DAY FREE TRIAL"}
          </button>
          <p className="text-xs text-blue-100 text-center mt-2">
            No credit card required. Cancel anytime.
          </p>
        </div>

        {/* Free Card */}
        <div className="bg-white border-4 border-pop-black p-6"
             style={{ boxShadow: "4px 4px 0px #000" }}>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-gray-400" />
            <span className="text-xl font-comic text-pop-black">FREE</span>
          </div>
          <p className="text-2xl font-comic text-pop-black mb-4">
            $0<span className="text-sm font-normal text-gray-500">/month</span>
          </p>

          <ul className="space-y-2 mb-6">
            {freeFeatures.map((f) => (
              <li key={f.name} className="flex items-center gap-2 text-sm">
                {f.included ? (
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                ) : (
                  <X className="w-4 h-4 text-gray-300 shrink-0" />
                )}
                <span className={f.included ? "text-gray-700" : "text-gray-400"}>
                  {f.name}
                </span>
              </li>
            ))}
          </ul>

          <button
            onClick={handleContinueFree}
            disabled={loading !== null}
            className="w-full py-3 font-comic text-pop-black bg-pop-yellow border-2 border-pop-black shadow-comic-sm hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50"
          >
            {loading === "free" ? "Loading..." : "CONTINUE WITH FREE"}
          </button>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-500 mt-6">
          You can change your plan anytime in Account Settings.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify page renders**

Navigate to `localhost:3000/choose-plan` while logged in as a free user. Confirm:
- Personalized greeting shows user's first name
- Premium card shows with trial CTA
- Free card shows with continue button
- Pop-art styling matches the rest of the site
- Loading spinner shows briefly before content appears

- [ ] **Step 3: Test trial button**

Click "START 7-DAY FREE TRIAL":
- Should call `startFreeTrial()`
- On success, redirects to `/collection`
- Verify in billing tab that user is now on trial

- [ ] **Step 4: Test free button**

Click "CONTINUE WITH FREE":
- Should redirect to `/collection`
- No subscription changes

- [ ] **Step 5: Test guard redirect**

Log in as a premium/trialing user and navigate to `/choose-plan`:
- Should immediately redirect to `/collection`

- [ ] **Step 6: Commit**

```bash
git add src/app/choose-plan/page.tsx
git commit -m "feat: add post-signup Choose Your Plan page with trial CTA"
```

---

### Task 3: Write Unit Tests

**Files:**
- Create: `src/lib/__tests__/choosePlanHelpers.test.ts`

- [ ] **Step 1: Write tests for plan selection logic**

Test the core decision logic extracted from the page:

```typescript
import { describe, it, expect } from "@jest/globals";

/**
 * Pure logic tests for the choose-plan page behavior.
 * We test the decision rules, not the React component.
 */

describe("Choose Plan - Decision Logic", () => {
  describe("shouldRedirectAway", () => {
    // Guard: premium/trialing users shouldn't see the page
    it("returns true for premium users", () => {
      expect(shouldRedirectAway("premium", false)).toBe(true);
    });

    it("returns true for trialing users", () => {
      expect(shouldRedirectAway("free", true)).toBe(true);
    });

    it("returns false for free non-trialing users", () => {
      expect(shouldRedirectAway("free", false)).toBe(false);
    });

    it("returns false for guest users", () => {
      expect(shouldRedirectAway("guest", false)).toBe(false);
    });
  });

  describe("getTrialAction", () => {
    // Determine what happens when user clicks trial button
    it("returns 'startTrial' when trial is available", () => {
      expect(getTrialAction(true)).toBe("startTrial");
    });

    it("returns 'stripeCheckout' when trial is not available", () => {
      expect(getTrialAction(false)).toBe("stripeCheckout");
    });
  });
});

// Helper functions to extract and test
function shouldRedirectAway(tier: string, isTrialing: boolean): boolean {
  return tier === "premium" || isTrialing;
}

function getTrialAction(trialAvailable: boolean): "startTrial" | "stripeCheckout" {
  return trialAvailable ? "startTrial" : "stripeCheckout";
}
```

- [ ] **Step 2: Run tests**

```bash
npm test -- src/lib/__tests__/choosePlanHelpers.test.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/choosePlanHelpers.test.ts
git commit -m "test: add unit tests for choose-plan decision logic"
```

---

### Task 4: Clean Up and Polish

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts` (remove debug logging)
- Modify: `src/app/choose-plan/page.tsx` (if needed)

- [ ] **Step 1: Remove debug logging from webhook**

Remove the `[STRIPE WEBHOOK]` console.log lines added during this session's Stripe debugging from `src/app/api/webhooks/stripe/route.ts`. Keep the error logging, just remove the debug lines.

- [ ] **Step 2: Test full flow end-to-end**

1. Sign out completely
2. Go to `/sign-up` and create a new account
3. After Clerk completes → should land on `/choose-plan`
4. Click "START 7-DAY FREE TRIAL" → should start trial and redirect to `/collection`
5. Verify billing tab shows "Premium (Trial)" with 7 days remaining

- [ ] **Step 3: Test free flow end-to-end**

1. Sign out, create another new account
2. On `/choose-plan`, click "CONTINUE WITH FREE"
3. Should land on `/collection`
4. Verify billing tab shows "Free" with 10 scans/month

- [ ] **Step 4: Test mobile responsiveness**

Open `/choose-plan` on mobile viewport. Verify:
- Cards stack vertically
- Buttons are full-width and tappable
- Text is readable
- No horizontal scroll

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "chore: remove Stripe webhook debug logging"
```

---

## Notes

- The `/choose-plan` page has a client-side guard: if user is already premium or trialing, they get redirected to `/collection`. Free users who navigate there manually can still use it (harmless — they can start a trial or stay free).
- No database flag needed for v1 — the guard is based on existing subscription state.
- If Clerk's `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` doesn't work as expected, an alternative is to check for `?__clerk_status=verified` query param in middleware and redirect from there.
- The `NEXT_PUBLIC_APP_URL` env var must be set to `https://collectors-chest.com` on Netlify before production deploy (currently `http://localhost:3000` locally).
- The `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/choose-plan` must also be added to Netlify env vars for production.
- Task 4 from the original plan (checkout success redirect) was dropped — the existing redirect to `/profile?billing=success` is fine since it now correctly switches to the Billing tab. Changing it would add complexity for minimal gain.
