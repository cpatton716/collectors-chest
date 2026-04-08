# 30-Day Promo Trial Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/join/trial` landing page that lets convention attendees scan a QR code, sign up, and get a 30-day free Premium trial with card-on-file that auto-converts to Premium Monthly ($4.99/mo).

**Architecture:** The `/join/trial` page is a server-rendered landing page (instant load on convention WiFi) with two small client components for interactivity. It sets a localStorage flag and directs to Clerk sign-up. After sign-up, the existing `/choose-plan` page detects the flag and auto-initiates Stripe checkout with `trial_period_days: 30` on the monthly price. The Stripe webhook writes trial dates directly from Stripe's `trial_end` timestamp (bypassing `startTrial()` to avoid the `hasUsedTrial()` guard). One trial per user enforced by `hasUsedTrial()` at checkout time. No new database columns needed — reuses the existing `trial_started_at` / `trial_ends_at` fields.

**Tech Stack:** Next.js 14 (App Router), Stripe Checkout (subscription mode with trial), Clerk auth, localStorage for promo flag passing, Tailwind CSS with Lichtenstein design language.

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/app/join/trial/page.tsx` | Promo landing page (SERVER component) — static marketing HTML, renders immediately |
| Create | `src/app/join/trial/PromoTrialActivator.tsx` | Client component — sets localStorage flag on mount, redirects signed-in users to `/choose-plan` |
| Create | `src/app/join/trial/PromoTrialCTA.tsx` | Client component — CTA button with loading state on click |
| Create | `src/lib/promoTrial.ts` | Promo trial constants and localStorage helpers |
| Create | `src/lib/__tests__/promoTrial.test.ts` | Unit tests for promo trial helpers |
| Modify | `src/lib/subscription.ts` | Add `isTrialing` param to `upgradeToPremium()`, clear `trial_ends_at` in `downgradeToFree()` |
| Modify | `src/app/api/webhooks/stripe/route.ts` | Write trial dates directly from Stripe data (bypass `startTrial()`), skip $0 trial invoices, preserve `trial_ends_at` for trialing |
| Modify | `src/app/api/billing/checkout/route.ts` | Accept `promoTrial` param, use 30-day trial period on monthly plan, remove `payment_method_types` restriction |
| Modify | `src/app/choose-plan/page.tsx` | Detect promo flag, auto-start 30-day checkout, handle `billing=cancelled` to prevent infinite loop |
| Modify | `src/hooks/useSubscription.ts` | Add promoTrial param to startCheckout, add `trialUsed` to SubscriptionState interface |
| Modify | `src/app/api/billing/status/route.ts` | Add `trialUsed` to the API response |
| Modify | `src/lib/choosePlanHelpers.ts` | Add `getPromoTrialAction()` helper |
| Create | `src/lib/__tests__/choosePlanHelpers.test.ts` | Tests for new promo helper (file may already exist — append if so) |

---

### Task 1: Promo Trial Helper Library

**Files:**
- Create: `src/lib/promoTrial.ts`
- Create: `src/lib/__tests__/promoTrial.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/__tests__/promoTrial.test.ts
import {
  PROMO_TRIAL_DAYS,
  PROMO_TRIAL_STORAGE_KEY,
  setPromoTrialFlag,
  getPromoTrialFlag,
  clearPromoTrialFlag,
} from "../promoTrial";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

beforeEach(() => {
  localStorageMock.clear();
  jest.clearAllMocks();
});

describe("promoTrial constants", () => {
  it("has a 30-day trial period", () => {
    expect(PROMO_TRIAL_DAYS).toBe(30);
  });

  it("has a stable storage key", () => {
    expect(PROMO_TRIAL_STORAGE_KEY).toBe("cc_promo_trial");
  });
});

describe("setPromoTrialFlag", () => {
  it("sets a timestamp in localStorage", () => {
    const before = Date.now();
    setPromoTrialFlag();
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "cc_promo_trial",
      expect.any(String)
    );
    const storedValue = parseInt(localStorageMock.getItem("cc_promo_trial"), 10);
    expect(storedValue).toBeGreaterThanOrEqual(before);
    expect(storedValue).toBeLessThanOrEqual(Date.now());
  });
});

describe("getPromoTrialFlag", () => {
  it("returns true when flag is recent (within 7 days)", () => {
    setPromoTrialFlag(); // sets current timestamp
    expect(getPromoTrialFlag()).toBe(true);
  });

  it("returns false when flag is not set", () => {
    expect(getPromoTrialFlag()).toBe(false);
  });

  it("returns false when flag is expired (older than 7 days)", () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    localStorageMock.setItem("cc_promo_trial", eightDaysAgo.toString());
    expect(getPromoTrialFlag()).toBe(false);
  });

  it("returns false for non-timestamp string values", () => {
    localStorageMock.setItem("cc_promo_trial", "true");
    expect(getPromoTrialFlag()).toBe(false);
  });
});

describe("clearPromoTrialFlag", () => {
  it("removes the flag from localStorage", () => {
    localStorageMock.setItem("cc_promo_trial", "true");
    clearPromoTrialFlag();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("cc_promo_trial");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/__tests__/promoTrial.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/promoTrial.ts

/** Number of free trial days for the QR code promo */
export const PROMO_TRIAL_DAYS = 30;

/** localStorage key for the promo trial flag */
export const PROMO_TRIAL_STORAGE_KEY = "cc_promo_trial";

/** Set the promo trial flag with timestamp (called from /join/trial page) */
export function setPromoTrialFlag(): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(PROMO_TRIAL_STORAGE_KEY, Date.now().toString());
  }
}

/** Check if the promo trial flag is set and not expired (7-day expiration) */
export function getPromoTrialFlag(): boolean {
  if (typeof window !== "undefined") {
    const value = localStorage.getItem(PROMO_TRIAL_STORAGE_KEY);
    if (!value) return false;
    const timestamp = parseInt(value, 10);
    if (isNaN(timestamp)) return false;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - timestamp < sevenDays;
  }
  return false;
}

/** Clear the promo trial flag (called after checkout is initiated) */
export function clearPromoTrialFlag(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(PROMO_TRIAL_STORAGE_KEY);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/__tests__/promoTrial.test.ts`
Expected: PASS — all 7 tests green

- [ ] **Step 5: Commit**

```bash
git add src/lib/promoTrial.ts src/lib/__tests__/promoTrial.test.ts
git commit -m "feat: add promo trial helper library with localStorage flag"
```

---

### Task 2: Webhook Direct-Write for Trial Dates & Subscription Fixes

**Files:**
- Modify: `src/lib/subscription.ts`
- Modify: `src/app/api/webhooks/stripe/route.ts`

The webhook should write trial dates directly from Stripe's `subscription.trial_end`, bypassing `startTrial()`. This avoids the `hasUsedTrial()` guard that silently fails for repeat users, and eliminates drift from recalculating trial days. The existing `startTrial()` remains unchanged — it's still used by the no-card trial path.

- [ ] **Step 1: Update `upgradeToPremium()` to preserve `trial_ends_at` for trialing subscriptions**

Currently `upgradeToPremium()` always sets `trial_ends_at: null`. This overwrites the trial end date when the webhook calls both trial write + upgrade in sequence.

Fix: Accept an optional `isTrialing` parameter and conditionally preserve `trial_ends_at`:

```typescript
export async function upgradeToPremium(
  profileId: string,
  stripeSubscriptionId: string,
  currentPeriodEnd: Date,
  isTrialing: boolean = false
): Promise<void> {
  const updates: Record<string, unknown> = {
    subscription_tier: "premium",
    subscription_status: isTrialing ? "trialing" : "active",
    stripe_subscription_id: stripeSubscriptionId,
    subscription_current_period_end: currentPeriodEnd.toISOString(),
  };

  // Only clear trial_ends_at if not trialing (they converted to paid)
  if (!isTrialing) {
    updates.trial_ends_at = null;
  }

  await supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("id", profileId);
}
```

- [ ] **Step 2: Update `downgradeToFree()` to clear `trial_ends_at`**

Currently `downgradeToFree()` does not clear `trial_ends_at`, which means `isTrialing` could still return true after cancellation. Add `trial_ends_at: null` to the update:

```typescript
export async function downgradeToFree(profileId: string): Promise<void> {
  await supabaseAdmin
    .from("profiles")
    .update({
      subscription_tier: "free",
      subscription_status: "active",
      stripe_subscription_id: null,
      subscription_current_period_end: null,
      trial_ends_at: null,
    })
    .eq("id", profileId);
}
```

- [ ] **Step 3: Update `handleSubscriptionCreated` to write trial dates directly from Stripe**

In `src/app/api/webhooks/stripe/route.ts`, replace the existing `startTrial()` call with a direct DB write using Stripe's `trial_end` timestamp. This approach:
- Writes the exact Stripe trial end date (no drift from recalculation)
- Works even if the user previously used a trial (overwrites stale dates)
- Sets `trial_started_at` which makes `hasUsedTrial()` return true for future checks
- Does NOT go through `startTrial()`'s guard logic

Remove `startTrial` from the import list (it's no longer used in the webhook).

```typescript
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const profile = await getProfileByStripeCustomerId(customerId);

  if (!profile) {
    console.error("No profile found for Stripe customer:", customerId);
    return;
  }

  // Access current_period_end - may be on subscription directly or first item
  const periodEnd =
    (subscription as unknown as { current_period_end?: number }).current_period_end ||
    subscription.items?.data?.[0]?.current_period_end ||
    Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // Default to 30 days
  const currentPeriodEnd = new Date(periodEnd * 1000);

  const isTrialing = subscription.status === "trialing";

  // Record trial dates directly from Stripe (bypass startTrial guard)
  if (isTrialing && subscription.trial_end) {
    const trialEnd = new Date(subscription.trial_end * 1000);
    await supabaseAdmin.from("profiles").update({
      trial_started_at: new Date().toISOString(),
      trial_ends_at: trialEnd.toISOString(),
    }).eq("id", profile.id);
  }

  // Upgrade to premium — preserve trial_ends_at if trialing
  await upgradeToPremium(
    profile.id,
    subscription.id,
    currentPeriodEnd,
    isTrialing
  );
}
```

- [ ] **Step 4: Add $0 trial invoice guard to `handleInvoicePaymentSucceeded`**

When a trial subscription is created, Stripe fires `invoice.payment_succeeded` for the $0 invoice. The handler sets status to "active", overwriting the "trialing" status. Add a guard at the top of the function:

```typescript
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  if (invoice.amount_paid === 0) return; // Skip $0 trial invoices. Note: also skips 100% discount coupon invoices — refine if coupons are ever added.

  // Only process subscription invoices
  const subscriptionId = (invoice as unknown as { subscription?: string | null }).subscription;
  if (!subscriptionId) return;

  // ... rest of existing logic
}
```

- [ ] **Step 5: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/subscription.ts src/app/api/webhooks/stripe/route.ts
git commit -m "fix: webhook writes trial dates directly from Stripe, skip $0 invoices, clear trial on downgrade"
```

---

### Task 3: Update Checkout Route for 30-Day Promo Trial

**Files:**
- Modify: `src/app/api/billing/checkout/route.ts`

The checkout route already supports `withTrial` (7-day). We add a `promoTrial` boolean that overrides the trial period to 30 days and forces the monthly price.

- [ ] **Step 1: Read the current checkout route**

Read: `src/app/api/billing/checkout/route.ts`
Understand the existing `withTrial` logic and where `subscription_data.trial_period_days` is set.

- [ ] **Step 2: Add `promoTrial` support to the request body parsing**

In the body destructuring (around line 60), add `promoTrial` to the existing pattern:

```typescript
const { priceType, withTrial = false, promoTrial = false } = body as {
  priceType: PriceType;
  withTrial?: boolean;
  promoTrial?: boolean;
};
```

- [ ] **Step 3: Add promo trial logic before the checkout session creation**

After the existing `withTrial` block, add promo trial handling. Find the section where `subscription_data` is built and modify to:

```typescript
// Promo trial takes precedence — ignore withTrial if promoTrial is set
const effectiveWithTrial = promoTrial ? false : withTrial;

// Determine trial period
let trialDays: number | undefined;
if (promoTrial && !trialUsed) {
  // 30-day promo trial — always monthly
  trialDays = 30;
} else if (effectiveWithTrial && !trialUsed && effectivePriceType !== "scan_pack") {
  // Standard 7-day trial
  trialDays = 7;
}
```

**Important:** This `trialDays` logic REPLACES the existing `canUseTrial` variable and its associated `if (isSubscription && canUseTrial)` block (which currently adds `subscription_data.trial_period_days: 7`). Remove the `canUseTrial` declaration and the entire block that uses it, then add the `trialDays` logic in its place. Do NOT keep both — they would conflict.

Then use `trialDays` in the `subscription_data`:

```typescript
...(trialDays
  ? { subscription_data: { trial_period_days: trialDays } }
  : {}),
```

- [ ] **Step 4: Force monthly price for promo trial**

Add a guard near the top of the subscription logic:

```typescript
const effectivePriceType = promoTrial ? "monthly" : priceType;
```

**After declaring `effectivePriceType`, replace ALL subsequent references to `priceType` in the route with `effectivePriceType`** — this includes the price lookup (`PRICES[effectivePriceType]`), the subscription check (`effectivePriceType !== "scan_pack"`), the session mode determination, the success URL (`type=${effectivePriceType}`), the metadata (`priceType: effectivePriceType`), and scan pack checks. Do a find-and-replace of `priceType` to `effectivePriceType` for all code AFTER the declaration line. The original `priceType` variable from the request body should only be referenced in the `effectivePriceType` declaration itself.

- [ ] **Step 5: Add promo metadata to checkout session**

Add `promoTrial: "true"` to BOTH the session `metadata` AND `subscription_data.metadata` (so it persists on the subscription object for analytics and support):

```typescript
// In session metadata:
metadata: {
  profileId: profile.id,
  priceType: effectivePriceType,
  ...(promoTrial ? { promoTrial: "true" } : {}),
},

// In subscription_data (when trialDays is set):
subscription_data: {
  trial_period_days: trialDays,
  metadata: {
    profileId: profile.id,
    ...(promoTrial ? { promoTrial: "true" } : {}),
  },
},
```

- [ ] **Step 6: Set dynamic success_url and cancel_url for promo trial**

When `promoTrial` is true, override both URLs:
- `success_url` → `/collection?welcome=promo` (drop them into their collection, not the profile page)
- `cancel_url` → `/choose-plan?billing=cancelled` (includes `billing=cancelled` to prevent infinite back-button loop — see Task 4)

```typescript
const successUrl = promoTrial
  ? `${process.env.NEXT_PUBLIC_APP_URL}/collection?welcome=promo`
  : `${process.env.NEXT_PUBLIC_APP_URL}/profile?billing=success&type=${effectivePriceType}`;

const cancelUrl = promoTrial
  ? `${process.env.NEXT_PUBLIC_APP_URL}/choose-plan?billing=cancelled`
  : `${process.env.NEXT_PUBLIC_APP_URL}/pricing?billing=cancelled`;
```

Use `successUrl` and `cancelUrl` in the `sessionConfig.success_url` and `sessionConfig.cancel_url` fields.

- [ ] **Step 7: Remove `payment_method_types` restriction**

The existing checkout route sets `payment_method_types: ["card"]` which disables Google Pay and Apple Pay. Remove this line entirely. By default, Stripe enables automatic payment methods including Google Pay and Apple Pay when the domain is verified. This is critical for mobile convention sign-ups — one-tap wallet payments dramatically reduce friction.

> **Verification note:** The existing checkout route passes `customer` to the session (not `customer_email`). When a Stripe customer already exists, Stripe auto-fills the email from the customer object. When a new customer is created (Step 2 of the existing route), the email is set via `email: profile.email || undefined`. This means email is always pre-filled on the Stripe checkout page — no additional changes needed.

- [ ] **Step 8: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add src/app/api/billing/checkout/route.ts
git commit -m "feat: support 30-day promo trial in checkout route"
```

---

### Task 4: Update Choose-Plan Page for Promo Auto-Checkout

**Files:**
- Modify: `src/app/choose-plan/page.tsx`
- Modify: `src/lib/choosePlanHelpers.ts`
- Create or Modify: `src/lib/__tests__/choosePlanHelpers.test.ts`

When a user arrives at `/choose-plan` with the promo trial localStorage flag set, the page should auto-initiate the Stripe checkout with the 30-day trial instead of showing the normal plan selection UI.

- [ ] **Step 1: Expose `trialUsed` from billing status API and useSubscription hook**

The choose-plan promo useEffect needs `trialUsed` but the hook only exposes `trialAvailable`. Two changes:

**1a) Add `trialUsed` to the billing status API response.**

In `src/app/api/billing/status/route.ts`, the `trialUsed` value is already computed on line 65 (`const trialUsed = await hasUsedTrial(profile.id);`), but it is only used to derive `trialAvailable` and is NOT included in the JSON response. Add it to the response object:

```typescript
// In the NextResponse.json() response object, add alongside trialAvailable:
trialUsed,
```

**1b) Add `trialUsed: boolean` to the `SubscriptionState` interface in `useSubscription.ts`.**

Add to the interface:
```typescript
trialUsed: boolean;
```

Populate it from the API response in `fetchStatus`:
```typescript
trialUsed: result.trialUsed ?? false,
```

And add `trialUsed: false` to both default state objects (the error fallback and the `!data` return).

- [ ] **Step 2: Write the failing test for the promo helper**

Check if `src/lib/__tests__/choosePlanHelpers.test.ts` already exists. If so, append to it; if not, create it.

```typescript
// Add to choosePlanHelpers tests
import { getPromoTrialAction } from "../choosePlanHelpers";

describe("getPromoTrialAction", () => {
  it('returns "start_promo_checkout" when promo flag is true and trial not used', () => {
    expect(getPromoTrialAction(true, false, false)).toBe(
      "start_promo_checkout"
    );
  });

  it('returns "none" when promo flag is false', () => {
    expect(getPromoTrialAction(false, false, false)).toBe("none");
  });

  it('returns "none" when trial already used', () => {
    expect(getPromoTrialAction(true, true, false)).toBe("none");
  });

  it('returns "none" when already premium', () => {
    expect(getPromoTrialAction(true, false, true)).toBe("none");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- src/lib/__tests__/choosePlanHelpers.test.ts`
Expected: FAIL — `getPromoTrialAction` is not exported

- [ ] **Step 4: Add `getPromoTrialAction` to choosePlanHelpers.ts**

```typescript
/**
 * Determines if the promo trial checkout should auto-start.
 * Returns "start_promo_checkout" if conditions are met, "none" otherwise.
 */
export function getPromoTrialAction(
  hasPromoFlag: boolean,
  trialUsed: boolean,
  isPremium: boolean
): "start_promo_checkout" | "none" {
  if (!hasPromoFlag) return "none";
  if (trialUsed) return "none";
  if (isPremium) return "none";
  return "start_promo_checkout";
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/lib/__tests__/choosePlanHelpers.test.ts`
Expected: PASS

- [ ] **Step 6: Update `SubscriptionState` interface and `startCheckout` in `useSubscription.ts`**

Update the `SubscriptionState` interface in `useSubscription.ts` to include the third param:

```typescript
startCheckout: (
  priceType: "monthly" | "annual" | "scan_pack",
  withTrial?: boolean,
  promoTrial?: boolean
) => Promise<string | null>;
```

Then update the `startCheckout` implementation to accept and forward the `promoTrial` param:

```typescript
// In useSubscription.ts, update startCheckout signature:
const startCheckout = async (
  priceType: string,
  withTrial = false,
  promoTrial = false
) => {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priceType, withTrial, promoTrial }),
  });
  // ... existing redirect logic
};
```

- [ ] **Step 7: Update choose-plan page to detect promo flag and auto-checkout**

Read the current `src/app/choose-plan/page.tsx` first. Then add:

1. Import `getPromoTrialFlag`, `clearPromoTrialFlag` from `promoTrial.ts`
2. Import `getPromoTrialAction` from `choosePlanHelpers.ts`
3. Import `useRef` from React and `Loader2` from `lucide-react`
4. Add state and refs for the promo flow:

```typescript
const promoCheckoutStarted = useRef(false);
const [promoError, setPromoError] = useState(false);
const [promoResolved, setPromoResolved] = useState(false);
const [hasPromoFlag] = useState(() => getPromoTrialFlag());
```

5. Add the promo auto-checkout `useEffect`. This handles:
   - Detecting `billing=cancelled` query param (user hit back from Stripe) and clearing the flag to prevent infinite loop
   - Clearing stale promo flags when user is already premium/trialing (BLOCKER: prevents stale flags from persisting in localStorage)
   - Gating on all conditions being met before starting checkout
   - Using a ref guard to prevent double-invocation from React strict mode
   - Setting `promoResolved` when action is "none" so the loading screen clears

```typescript
// Promo auto-checkout effect
useEffect(() => {
  if (!hasPromoFlag || isLoading || promoCheckoutStarted.current) return;

  // Check if user just returned from Stripe cancel — prevent infinite loop
  const params = new URLSearchParams(window.location.search);
  if (params.get("billing") === "cancelled") {
    // Don't auto-redirect — show normal plan selection so user can choose
    clearPromoTrialFlag();
    setPromoResolved(true);
    return;
  }

  const promoAction = getPromoTrialAction(hasPromoFlag, trialUsed, tier === "premium");

  // Clear stale promo flag if user can't use it (already premium, already used trial)
  if (promoAction === "none") {
    clearPromoTrialFlag();
    setPromoResolved(true);
    return;
  }

  promoCheckoutStarted.current = true;
  startCheckout("monthly", false, true)
    .then((url) => {
      if (url) window.location.href = url;
    })
    .catch(() => {
      setPromoError(true);
      promoCheckoutStarted.current = false;
    });
}, [hasPromoFlag, isLoading, trialUsed, tier, startCheckout]);
```

> **Note:** The promo flag is intentionally NOT cleared before redirecting to Stripe. If the user cancels/navigates back from Stripe checkout, the `billing=cancelled` param on the cancel URL signals the choose-plan page to clear the flag and show the normal plan selection instead of looping.

7. Add promo-specific loading and error render states BEFORE the normal plan cards JSX:

```typescript
// Promo loading state — show while auto-checkout is in progress
if (hasPromoFlag && !promoError && !promoResolved) {
  return (
    <div className="min-h-screen bg-pop-yellow flex items-center justify-center">
      <div className="bg-white border-4 border-pop-black shadow-comic-sm p-6 sm:p-8 text-center max-w-md">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-pop-red" />
        <h2 className="text-xl font-comic font-bold text-pop-black">Setting up your 30-day free trial...</h2>
        <p className="text-gray-600 mt-2">You'll be redirected to enter your payment info.</p>
      </div>
    </div>
  );
}

// Promo error state — show retry button, NOT the normal plan selection
if (hasPromoFlag && promoError) {
  return (
    <div className="min-h-screen bg-pop-yellow flex items-center justify-center">
      <div className="bg-white border-4 border-pop-black shadow-comic-sm p-6 sm:p-8 text-center max-w-md">
        <h2 className="text-xl font-comic font-bold text-pop-black">Something went wrong</h2>
        <p className="text-gray-600 mt-2">We couldn't start your trial. Let's try again.</p>
        <button
          onClick={() => {
            setPromoError(false);
            promoCheckoutStarted.current = false;
          }}
          className="mt-4 bg-pop-red text-white font-bold py-3 px-6 border-2 border-pop-black shadow-comic-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
```

7. Also add a `clearPromoTrialFlag()` call inside the existing redirect guard (the useEffect that checks `tier === 'premium' || isTrialing` and redirects to `/collection`). This ensures the flag is cleaned up even when the promo useEffect never fires because the guard redirects first.

8. The normal plan selection UI (7-day trial / Free buttons) only renders when the promo flag is NOT active OR when `promoResolved` is true, preventing any interaction with the wrong flow
9. **Promo flag cleanup:** The flag is cleared when (a) `billing=cancelled` param is detected (back from Stripe), (b) promo action is "none" (already premium or trial used), or (c) after successful checkout, the user lands on `/collection?welcome=promo` and the flag is never re-checked

- [ ] **Step 8: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add src/app/choose-plan/page.tsx src/lib/choosePlanHelpers.ts src/lib/__tests__/choosePlanHelpers.test.ts src/hooks/useSubscription.ts src/app/api/billing/status/route.ts
git commit -m "feat: auto-start 30-day promo checkout from choose-plan page"
```

---

### Task 5: Build the /join/trial Landing Page

**Files:**
- Create: `src/app/join/trial/page.tsx` (SERVER component — no `"use client"`)
- Create: `src/app/join/trial/PromoTrialActivator.tsx` (client component — localStorage + redirect)
- Create: `src/app/join/trial/PromoTrialCTA.tsx` (client component — CTA button with loading state)

This is the page the QR code links to. The page is **server-rendered** so it displays immediately on slow convention WiFi (no blank screen while JS loads). Two small client components handle the interactive parts.

Architecture:
1. `page.tsx` is a **server component** — renders all the marketing HTML immediately with zero client-side JS required for first paint
2. `PromoTrialActivator.tsx` is a `"use client"` component that: sets the localStorage flag on mount, and redirects signed-in users to `/choose-plan`
3. `PromoTrialCTA.tsx` is a `"use client"` component that: shows a loading state on click to prevent double-taps

- [ ] **Step 1: Review existing page designs for style reference**

Read: `src/app/sign-up/[[...sign-up]]/page.tsx` (for the marketing panel design)
Read: `src/app/pricing/page.tsx` (for plan card styling)
Read: `src/app/about/page.tsx` (for Lichtenstein design patterns)

- [ ] **Step 2: Create the PromoTrialActivator client component**

```tsx
// src/app/join/trial/PromoTrialActivator.tsx
"use client";
import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { setPromoTrialFlag } from "@/lib/promoTrial";

export default function PromoTrialActivator() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setPromoTrialFlag();
  }, []);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/choose-plan");
    }
  }, [isLoaded, isSignedIn, router]);

  return null; // No UI — just side effects
}
```

- [ ] **Step 3: Create the PromoTrialCTA client component**

```tsx
// src/app/join/trial/PromoTrialCTA.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PromoTrialCTA() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  return (
    <button
      onClick={() => {
        setLoading(true);
        router.push("/sign-up");
      }}
      disabled={loading}
      className="block w-full bg-pop-red hover:bg-red-600 active:bg-red-700 text-pop-white font-comic text-xl py-4 px-6 border-3 border-pop-black shadow-comic-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all uppercase tracking-wide disabled:opacity-70"
    >
      {loading ? "Loading..." : "Start Your Free Trial"}
    </button>
  );
}
```

- [ ] **Step 4: Create the server-rendered landing page**

> **Note:** The project defines `border-3` (`3px`) in `tailwind.config.ts` under `borderWidth`. It is safe to use.
>
> **Design notes:** No `rounded-lg` or `rounded-full` — the Lichtenstein design uses sharp corners with thick borders. Use `font-comic` (Bangers is already bold) instead of `font-black` on headings. Use `p-6 sm:p-8` for mobile-friendly padding.

```tsx
// src/app/join/trial/page.tsx
import Link from "next/link";
import PromoTrialActivator from "./PromoTrialActivator";
import PromoTrialCTA from "./PromoTrialCTA";

export default function JoinTrialPage() {
  return (
    <div className="min-h-screen bg-pop-yellow relative overflow-hidden">
      {/* Client component: sets localStorage flag + redirects signed-in users */}
      <PromoTrialActivator />

      {/* Ben-day dots background */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(circle, #000 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        {/* Main card */}
        <div className="bg-pop-white border-4 border-pop-black shadow-comic-sm max-w-md w-full p-6 sm:p-8 text-center">
          {/* Logo / header */}
          <div className="mb-6">
            <h1 className="text-4xl font-comic text-pop-black uppercase tracking-tight">
              Collectors Chest
            </h1>
            <div className="h-1 bg-pop-red w-24 mx-auto mt-2" />
          </div>

          {/* Trial offer */}
          <div className="mb-6">
            <div className="inline-block bg-pop-red text-white font-bold text-sm px-4 py-1 uppercase tracking-wide mb-4 border-2 border-pop-black">
              Convention Special
            </div>
            <h2 className="text-2xl font-comic text-pop-black mb-2">
              30 Days Free
            </h2>
            <p className="text-gray-700 text-lg">
              Get full Premium access to scan, track, and value your comic
              collection.
            </p>
          </div>

          {/* Benefits list */}
          <ul className="text-left space-y-3 mb-6">
            {[
              "Unlimited comic cover scans",
              "Real-time eBay pricing",
              "Collection stats & insights",
              "Key Issue hunting tools",
              "CSV export your collection",
              "Buy, sell & auction comics",
            ].map((benefit) => (
              <li key={benefit} className="flex items-start gap-2">
                <span className="text-pop-red font-bold text-lg mt-0.5">
                  POW!
                </span>
                <span className="text-pop-black font-medium">{benefit}</span>
              </li>
            ))}
          </ul>

          {/* CTA — client component with loading state */}
          <PromoTrialCTA />

          <p className="text-gray-500 text-sm mt-4">
            Credit card required. No charge for 30 days. Then $4.99/mo. Cancel anytime.
          </p>
        </div>

        {/* Already have an account? */}
        <p className="mt-6 text-pop-black font-medium">
          Already have an account?{" "}
          <Link href="/sign-in?redirect_url=/choose-plan" className="underline font-bold hover:text-pop-red active:text-pop-red py-3 px-4 inline-block">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Manual visual check**

Navigate to `http://localhost:3000/join/trial` in the browser.
Verify:
- Page renders immediately (server-rendered — no blank screen)
- Pop-art styling matches site design language (sharp corners, no rounding)
- Benefits list is readable
- CTA button shows loading state on click, then navigates to `/sign-up`
- "Sign in" link has adequate tap target on mobile
- If signed in, redirects to `/choose-plan` (brief flash of page content is acceptable)

- [ ] **Step 7: Commit**

```bash
git add src/app/join/trial/page.tsx src/app/join/trial/PromoTrialActivator.tsx src/app/join/trial/PromoTrialCTA.tsx
git commit -m "feat: add /join/trial promo landing page for QR code sign-ups (server-rendered)"
```

---

### Task 6: End-to-End Flow Verification

**Files:** None (testing only)

- [ ] **Step 1: Verify the full flow in development**

1. Open an incognito/private browser window
2. Navigate to `http://localhost:3000/join/trial`
3. Verify the landing page renders with pop-art styling
4. Click "Start Your Free Trial" → should go to `/sign-up`
5. Sign up with a test account
6. After sign-up → should redirect to `/choose-plan`
7. Choose-plan should auto-initiate Stripe checkout with 30-day trial
8. Complete checkout with Stripe test card `4242 4242 4242 4242`
9. Verify redirect to `/collection?welcome=promo`
10. Verify profile shows Premium tier with trial active

- [ ] **Step 2: Verify one-trial-per-user enforcement**

1. With the same test account, navigate to `/join/trial`
2. Should redirect to `/choose-plan` (already signed in)
3. Choose-plan should redirect to `/collection` (already premium)
4. The `hasUsedTrial()` check prevents re-use

- [ ] **Step 3: Verify existing sign-up flow is unaffected**

1. Open a new incognito window
2. Navigate directly to `/sign-up` (without visiting `/join/trial`)
3. Sign up with a different test account
4. Should redirect to `/choose-plan` with the normal 7-day trial / Free options
5. No promo flag should be set — normal flow preserved

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All tests pass (existing + new promo tests)

> **Note:** No commit for this task — it is testing-only with no file changes.

---

## Notes

- **QR Code generation:** After the feature is deployed, generate a QR code pointing to `https://collectors-chest.com/join/trial` using any QR generator. This is outside the scope of this plan.
- **Future enhancement — per-event tracking:** Add an optional `?ref=heroescon` query param to `/join/trial` that gets stored alongside the promo flag and sent as `metadata.promoRef` in the Stripe checkout session. This enables tracking which events drive the most conversions without changing the core flow or requiring new business cards.
- **Future enhancement — per-event codes:** Build a `/join/[code]` dynamic route that looks up promo configs from a DB table. Each code can have different trial durations, plans, and usage limits.
- **Existing trial interaction:** The 30-day promo trial and the existing 7-day trial share the same `trial_started_at` / `trial_ends_at` columns. Once a user has used either trial, `hasUsedTrial()` returns true and they cannot use the other. This is intentional — one trial per user, regardless of source.
- **Known limitation — client-side promo flag:** Any user can send `promoTrial: true` to the checkout API directly, getting 30 days instead of 7. This is acceptable for MVP — the only "abuse" is an extra 23 days on a first-time trial. Server-side validation (e.g., promo code table lookup) should be added if/when per-event codes are implemented.
- **Stripe webhook writes trial dates directly** from `subscription.trial_end` instead of calling `startTrial()`. This avoids the `hasUsedTrial()` guard (which would silently fail for repeat users) and eliminates drift from recalculating trial days. `startTrial()` is unchanged and still used by the no-card 7-day trial path.
- **$0 trial invoices are skipped** in `handleInvoicePaymentSucceeded` to prevent the "trialing" status from being overwritten by "active" when Stripe fires `invoice.payment_succeeded` for the $0 trial invoice.
- **`downgradeToFree()` now clears `trial_ends_at`** to prevent `isTrialing` from returning true after subscription cancellation.
- **Google Pay / Apple Pay:** The `payment_method_types: ["card"]` restriction has been removed from the checkout session. By default, Stripe enables automatic payment methods including Google Pay and Apple Pay when the domain is verified — critical for mobile convention sign-ups.
- **Infinite back-button loop prevention:** When the user hits "back" from Stripe, they land on `/choose-plan?billing=cancelled`. The promo useEffect detects this param and clears the flag instead of re-initiating checkout.
