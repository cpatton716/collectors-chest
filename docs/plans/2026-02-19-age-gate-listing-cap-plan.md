# Age Gate & Listing Cap UI — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce 18+ age verification on marketplace actions and show free-tier users their listing usage.

**Architecture:** Add `age_confirmed_at` column to profiles. All 5 marketplace API routes check this field and return 403 if null. A reusable Pop Art modal prompts verification client-side. Listing cap is UI-only (enforcement already exists server-side).

**Tech Stack:** Next.js API routes, Supabase, TypeScript, Tailwind CSS (Lichtenstein Pop Art design system)

---

### Task 1: DB Migration + Type Update

**Files:**
- Create: `supabase/migrations/20260219_add_age_confirmed_at.sql`
- Modify: `src/lib/db.ts` (lines 30-51, CachedProfile interface)

**Step 1: Write the migration SQL**

```sql
-- Add age confirmation field to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS age_confirmed_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN profiles.age_confirmed_at IS 'Timestamp when user confirmed they are 18+. NULL means unverified.';
```

**Step 2: Run migration against Supabase**

Run the SQL in the Supabase SQL Editor. Expected: success, no errors.

**Step 3: Add to CachedProfile interface**

In `src/lib/db.ts`, add `age_confirmed_at` to the `CachedProfile` interface. Find the block with `completed_sales_count` (around line 48-50) and add after it:

```typescript
  completed_sales_count?: number;
  age_confirmed_at?: string | null;
```

Since `getProfileByClerkId()` uses `.select("*")`, the new column is automatically returned — no query changes needed.

**Step 4: Commit**

```bash
git add supabase/migrations/20260219_add_age_confirmed_at.sql src/lib/db.ts
git commit -m "feat: add age_confirmed_at column to profiles"
```

---

### Task 2: Age Verification Helper + Tests

**Files:**
- Create: `src/lib/ageVerification.ts`
- Create: `src/lib/__tests__/ageVerification.test.ts`

**Step 1: Write the failing tests**

Create `src/lib/__tests__/ageVerification.test.ts`:

```typescript
import { isAgeVerified, isAgeVerificationError, FREE_LISTING_LIMIT } from "../ageVerification";

describe("ageVerification helpers", () => {
  describe("isAgeVerified", () => {
    it("returns true when age_confirmed_at is set", () => {
      expect(isAgeVerified({ age_confirmed_at: "2026-01-01T00:00:00Z" })).toBe(true);
    });

    it("returns false when age_confirmed_at is null", () => {
      expect(isAgeVerified({ age_confirmed_at: null })).toBe(false);
    });

    it("returns false when age_confirmed_at is undefined", () => {
      expect(isAgeVerified({ age_confirmed_at: undefined })).toBe(false);
    });

    it("returns false when profile is null", () => {
      expect(isAgeVerified(null)).toBe(false);
    });
  });

  describe("isAgeVerificationError", () => {
    it("returns true for AGE_VERIFICATION_REQUIRED error", () => {
      expect(isAgeVerificationError({ error: "AGE_VERIFICATION_REQUIRED" })).toBe(true);
    });

    it("returns false for other errors", () => {
      expect(isAgeVerificationError({ error: "CONNECT_REQUIRED" })).toBe(false);
    });

    it("returns false for non-error responses", () => {
      expect(isAgeVerificationError({ success: true })).toBe(false);
    });

    it("returns false for null/undefined", () => {
      expect(isAgeVerificationError(null)).toBe(false);
      expect(isAgeVerificationError(undefined)).toBe(false);
    });
  });

  describe("FREE_LISTING_LIMIT", () => {
    it("is 3", () => {
      expect(FREE_LISTING_LIMIT).toBe(3);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/__tests__/ageVerification.test.ts`
Expected: FAIL (module not found)

**Step 3: Write the helper module**

Create `src/lib/ageVerification.ts`:

```typescript
/** Number of active listings free-tier users are allowed */
export const FREE_LISTING_LIMIT = 3;

/** Check if a profile has completed age verification */
export function isAgeVerified(
  profile: { age_confirmed_at?: string | null } | null | undefined
): boolean {
  return !!profile?.age_confirmed_at;
}

/** Check if an API error response indicates age verification is required */
export function isAgeVerificationError(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response: any
): boolean {
  return response?.error === "AGE_VERIFICATION_REQUIRED";
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/__tests__/ageVerification.test.ts`
Expected: All 7 tests PASS

**Step 5: Commit**

```bash
git add src/lib/ageVerification.ts src/lib/__tests__/ageVerification.test.ts
git commit -m "feat: age verification helper functions with tests"
```

---

### Task 3: Age Verification API Route

**Files:**
- Create: `src/app/api/age-verification/route.ts`

**Step 1: Create the API route**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, age_confirmed_at")
      .eq("clerk_user_id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Already verified
    if (profile.age_confirmed_at) {
      return NextResponse.json({ alreadyVerified: true });
    }

    // Set age_confirmed_at
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ age_confirmed_at: new Date().toISOString() })
      .eq("id", profile.id);

    if (error) {
      console.error("Age verification update error:", error);
      return NextResponse.json({ error: "Failed to save verification" }, { status: 500 });
    }

    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error("Age verification error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/age-verification/route.ts
git commit -m "feat: age verification API route"
```

---

### Task 4: Add Age Check to Marketplace API Routes

**Files:**
- Modify: `src/app/api/auctions/route.ts` (POST handler, after profile lookup ~line 119)
- Modify: `src/app/api/auctions/[id]/bid/route.ts` (POST handler, after profile lookup ~line 41)
- Modify: `src/app/api/checkout/route.ts` (POST handler, after profile lookup ~line 35)
- Modify: `src/app/api/offers/route.ts` (POST handler, after profile lookup ~line 43)
- Modify: `src/app/api/trades/route.ts` (POST handler, after profile lookup ~line 47)

**Context:** All 5 routes call `getProfileByClerkId(userId)` early in the handler. Since `getProfileByClerkId` uses `.select("*")`, the `age_confirmed_at` field is already returned. We just need to add a check after the profile lookup in each route.

**Step 1: Add age check to each route**

In each of the 5 files, find the profile lookup (the line that calls `getProfileByClerkId` or similar), and add this check immediately after the "profile not found" guard:

```typescript
    // Age verification gate
    if (!profile.age_confirmed_at) {
      return NextResponse.json(
        { error: "AGE_VERIFICATION_REQUIRED", message: "You must confirm you are 18+ to use the marketplace." },
        { status: 403 }
      );
    }
```

**Specific insertion points:**

For `auctions/route.ts`: Insert after the profile-not-found check (~line 119), BEFORE the Connect gate check. The age check should come first since it applies to all marketplace actions.

For `auctions/[id]/bid/route.ts`: Insert after the profile-not-found check (~line 41).

For `checkout/route.ts`: Insert after the profile-not-found check (~line 35).

For `offers/route.ts`: Insert after the profile-not-found check (~line 43).

For `trades/route.ts`: Insert after the profile-not-found check (~line 47).

**Step 2: Run build to verify no type errors**

Run: `npm run typecheck`
Expected: PASS (no errors)

**Step 3: Commit**

```bash
git add src/app/api/auctions/route.ts src/app/api/auctions/*/bid/route.ts src/app/api/checkout/route.ts src/app/api/offers/route.ts src/app/api/trades/route.ts
git commit -m "feat: add age verification gate to all marketplace API routes"
```

---

### Task 5: AgeVerificationModal Component

**Files:**
- Create: `src/components/AgeVerificationModal.tsx`

**Context:** Follow the exact Pop Art modal pattern from `ConnectSetupPrompt.tsx`. The modal has:
- Fixed overlay: `fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4`
- Modal box: `bg-pop-white border-3 border-pop-black shadow-[6px_6px_0px_#000] rounded-lg max-w-md w-full`
- Blue header bar with icon + title
- Body with explanation
- Footer with Cancel + Confirm buttons

**Step 1: Create the modal component**

```tsx
"use client";

import { useState } from "react";
import { ShieldCheck, ArrowRight } from "lucide-react";

interface AgeVerificationModalProps {
  action: string; // e.g., "place a bid", "list an item", "make a purchase"
  onVerified: () => void;
  onDismiss: () => void;
}

export default function AgeVerificationModal({
  action,
  onVerified,
  onDismiss,
}: AgeVerificationModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/age-verification", { method: "POST" });
      const data = await res.json();
      if (res.ok && (data.verified || data.alreadyVerified)) {
        onVerified();
      } else {
        setError("Verification failed. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
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
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="font-comic text-xl text-white">AGE VERIFICATION</h3>
              <p className="text-white/80 text-sm">Marketplace requires 18+</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-gray-700">
            To {action}, you must confirm that you are at least <strong>18 years old</strong>.
          </p>

          <div className="bg-pop-yellow/20 border-2 border-pop-black rounded-lg p-3">
            <p className="font-comic text-sm">
              BY CONFIRMING, YOU ATTEST THAT YOU ARE 18 YEARS OF AGE OR OLDER, AS REQUIRED BY OUR TERMS OF SERVICE.
            </p>
          </div>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t-3 border-pop-black flex gap-3">
          <button
            onClick={onDismiss}
            className="btn-pop btn-pop-white flex-1 py-2 text-sm font-comic"
            disabled={loading}
          >
            NOT NOW
          </button>
          <button
            onClick={handleVerify}
            className="btn-pop btn-pop-green flex-1 py-2 text-sm font-comic flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading ? "VERIFYING..." : "I CONFIRM I'M 18+"}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/AgeVerificationModal.tsx
git commit -m "feat: AgeVerificationModal pop art component"
```

---

### Task 6: Wire Up Age Gate in Marketplace UI

**Files:**
- Modify: `src/components/auction/BidForm.tsx` (or wherever bids are submitted)
- Modify: `src/components/auction/AuctionCard.tsx` or the checkout trigger component
- Modify: `src/components/auction/OfferModal.tsx` (or wherever offers are submitted)
- Modify: `src/components/trading/TradeProposalModal.tsx`
- Modify: `src/app/my-auctions/page.tsx` (for listing creation flow)

**Context:** Each component that makes a marketplace API call needs to handle the `AGE_VERIFICATION_REQUIRED` response. The pattern is:

1. Import `AgeVerificationModal` and `isAgeVerificationError`
2. Add state: `const [showAgeModal, setShowAgeModal] = useState(false)`
3. In the API call error handler, check `if (isAgeVerificationError(data)) { setShowAgeModal(true); return; }`
4. Render the modal: `{showAgeModal && <AgeVerificationModal action="..." onVerified={() => { setShowAgeModal(false); /* retry action */ }} onDismiss={() => setShowAgeModal(false)} />}`

**Step 1: Identify the exact components**

Before implementing, the agent should search for:
- Where `fetch("/api/auctions"` POST is called (listing creation)
- Where `fetch("/api/auctions/` + bid route is called (bidding)
- Where `fetch("/api/checkout"` is called (buying)
- Where `fetch("/api/offers"` POST is called (offers)
- Where `fetch("/api/trades"` POST is called (trades)

Use `grep -r 'fetch.*api/auctions' src/components/` and similar to find exact files and line numbers.

**Step 2: Add age gate handling to each component**

For each component found in Step 1:

a. Add imports:
```typescript
import AgeVerificationModal from "@/components/AgeVerificationModal";
import { isAgeVerificationError } from "@/lib/ageVerification";
```

b. Add state:
```typescript
const [showAgeGate, setShowAgeGate] = useState(false);
```

c. In the existing API call handler, after parsing the JSON response, add:
```typescript
if (!res.ok) {
  const data = await res.json();
  if (isAgeVerificationError(data)) {
    setShowAgeGate(true);
    return;
  }
  // ... existing error handling
}
```

d. Add modal rendering at the end of the component's JSX:
```tsx
{showAgeGate && (
  <AgeVerificationModal
    action="[action description]"
    onVerified={() => {
      setShowAgeGate(false);
      // Retry the original action (re-call the submit function)
    }}
    onDismiss={() => setShowAgeGate(false)}
  />
)}
```

**Step 3: Verify builds**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/
git commit -m "feat: wire up age verification modal in marketplace UI components"
```

---

### Task 7: Listing Cap UI Indicator

**Files:**
- Modify: `src/app/my-auctions/page.tsx`

**Context:** The page already has:
- `activeListings.length` — the current count of active listings
- Subscription tier available via the `/api/connect/status` fetch (in `checkUpsell` function, ~line 53-78)
- A header with "MY LISTINGS" title and "Create Listing" button

**Step 1: Store subscription tier in state**

The page already fetches `/api/connect/status` in the `checkUpsell` effect. Extract the `subscriptionTier` and store it:

Add state:
```typescript
const [subscriptionTier, setSubscriptionTier] = useState<string>("free");
```

In the existing `checkUpsell` function (where `data.subscriptionTier` is already available), add:
```typescript
setSubscriptionTier(data.subscriptionTier || "free");
```

**Step 2: Add listing counter badge to header**

Find the header area (~lines 122-137). After the subtitle `<p>` tag (~line 127), add a conditional badge for free-tier users:

```tsx
{subscriptionTier === "free" && (
  <p className="text-sm mt-1">
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border-2 border-pop-black font-comic text-xs ${
      activeListings.length >= 3
        ? "bg-pop-red text-white"
        : "bg-pop-yellow text-pop-black"
    }`}>
      {activeListings.length} OF 3 LISTINGS USED
    </span>
  </p>
)}
```

**Step 3: Swap Create Listing button at capacity**

Replace the existing "Create Listing" button (~lines 129-136) with a conditional:

```tsx
{subscriptionTier === "free" && activeListings.length >= 3 ? (
  <button
    onClick={() => router.push("/pricing")}
    className="flex items-center gap-2 px-4 py-2 bg-pop-green border-2 border-pop-black text-white font-bold transition-all"
    style={{ boxShadow: "3px 3px 0px #000" }}
  >
    <span className="hidden sm:inline">UPGRADE TO LIST MORE</span>
    <span className="sm:hidden">UPGRADE</span>
  </button>
) : (
  <button
    onClick={() => router.push("/collection")}
    className="flex items-center gap-2 px-4 py-2 bg-pop-blue border-2 border-pop-black text-white font-bold transition-all"
    style={{ boxShadow: "3px 3px 0px #000" }}
  >
    <Plus className="w-4 h-4" />
    <span className="hidden sm:inline">Create Listing</span>
  </button>
)}
```

**Step 4: Verify builds and test**

Run: `npm run typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/my-auctions/page.tsx
git commit -m "feat: listing cap UI indicator for free-tier users"
```

---

### Task 8: Verification & Final Tests

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass (including new ageVerification tests)

**Step 2: Run type check**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 4: Final commit (if any fixes needed)**

If any issues were found and fixed:
```bash
git add -A
git commit -m "fix: resolve issues from age gate verification"
```
