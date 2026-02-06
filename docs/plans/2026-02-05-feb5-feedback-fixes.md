# Feb 5 Feedback Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 12 user-reported issues from the Feb 5 partner feedback session.

**Architecture:** All fixes are isolated, file-scoped changes — no new services, migrations, or dependencies. Publisher submission (#4) adds one new API route and a small admin UI section. Everything else is edits to existing files.

**Tech Stack:** Next.js, React, TypeScript, Supabase, Tailwind CSS

---

## Task 1: CSV Import — Strip Dollar Signs from Prices (#5)

**Files:**
- Modify: `src/components/CSVImport.tsx:154,166`
- Test: `src/lib/__tests__/csvParsing.test.ts` (create)

**Step 1: Write the failing test**

Create `src/lib/__tests__/csvParsing.test.ts`:
```typescript
import { parseCurrencyValue } from "@/lib/csvHelpers";

describe("parseCurrencyValue", () => {
  it("parses plain number", () => {
    expect(parseCurrencyValue("8.00")).toBe(8.0);
  });
  it("strips dollar sign", () => {
    expect(parseCurrencyValue("$8.00")).toBe(8.0);
  });
  it("strips commas", () => {
    expect(parseCurrencyValue("$1,000.00")).toBe(1000.0);
  });
  it("handles no cents", () => {
    expect(parseCurrencyValue("$25")).toBe(25);
  });
  it("returns undefined for empty string", () => {
    expect(parseCurrencyValue("")).toBeUndefined();
  });
  it("returns undefined for non-numeric", () => {
    expect(parseCurrencyValue("abc")).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/csvParsing.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `src/lib/csvHelpers.ts`:
```typescript
/**
 * Parse a currency string into a number, stripping $ and , characters.
 * Returns undefined for empty/invalid values.
 */
export function parseCurrencyValue(value: string): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[$,]/g, "").trim();
  if (!cleaned) return undefined;
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/csvParsing.test.ts`
Expected: PASS

**Step 5: Apply in CSVImport.tsx**

In `src/components/CSVImport.tsx`:
- Add import: `import { parseCurrencyValue } from "@/lib/csvHelpers";`
- Line 154: Change `row.purchasePrice = value ? parseFloat(value) : undefined;`
  → `row.purchasePrice = parseCurrencyValue(value);`
- Line 166: Change `row.askingPrice = value ? parseFloat(value) : undefined;`
  → `row.askingPrice = parseCurrencyValue(value);`

**Step 6: Run full test suite**

Run: `npm test`
Expected: All tests pass

---

## Task 2: Publisher Dropdown — Alias Mapping + Submission (#4)

**Files:**
- Modify: `src/types/comic.ts` (add alias map + normalize function)
- Modify: `src/components/CSVImport.tsx` (apply normalization on import)
- Modify: `src/components/ComicDetailsForm.tsx` (apply normalization in form, add "Suggest Publisher" UI)
- Create: `src/app/api/admin/publishers/route.ts` (admin endpoint for submissions)
- Modify: `src/app/admin/users/page.tsx` OR create `src/app/admin/publishers/page.tsx` (admin review UI)
- Test: `src/types/__tests__/publisherNormalize.test.ts` (create)

**Step 1: Write the failing test**

Create `src/types/__tests__/publisherNormalize.test.ts`:
```typescript
import { normalizePublisher } from "@/types/comic";

describe("normalizePublisher", () => {
  it("maps DC to DC Comics", () => {
    expect(normalizePublisher("DC")).toBe("DC Comics");
  });
  it("maps Marvel to Marvel Comics", () => {
    expect(normalizePublisher("Marvel")).toBe("Marvel Comics");
  });
  it("maps Image to Image Comics", () => {
    expect(normalizePublisher("Image")).toBe("Image Comics");
  });
  it("maps Dark Horse to Dark Horse Comics", () => {
    expect(normalizePublisher("Dark Horse")).toBe("Dark Horse Comics");
  });
  it("maps IDW to IDW Publishing", () => {
    expect(normalizePublisher("IDW")).toBe("IDW Publishing");
  });
  it("maps BOOM to Boom! Studios", () => {
    expect(normalizePublisher("BOOM")).toBe("Boom! Studios");
  });
  it("maps Boom to Boom! Studios", () => {
    expect(normalizePublisher("Boom")).toBe("Boom! Studios");
  });
  it("maps Dynamite to Dynamite Entertainment", () => {
    expect(normalizePublisher("Dynamite")).toBe("Dynamite Entertainment");
  });
  it("maps Valiant to Valiant Comics", () => {
    expect(normalizePublisher("Valiant")).toBe("Valiant Comics");
  });
  it("maps Archie to Archie Comics", () => {
    expect(normalizePublisher("Archie")).toBe("Archie Comics");
  });
  it("is case-insensitive", () => {
    expect(normalizePublisher("dc")).toBe("DC Comics");
    expect(normalizePublisher("MARVEL")).toBe("Marvel Comics");
  });
  it("passes through exact matches", () => {
    expect(normalizePublisher("DC Comics")).toBe("DC Comics");
    expect(normalizePublisher("Marvel Comics")).toBe("Marvel Comics");
  });
  it("returns null for unknown publishers", () => {
    expect(normalizePublisher("Unknown Press")).toBeNull();
  });
  it("returns null for empty string", () => {
    expect(normalizePublisher("")).toBeNull();
  });
  it("returns null for null", () => {
    expect(normalizePublisher(null)).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/types/__tests__/publisherNormalize.test.ts`
Expected: FAIL

**Step 3: Write implementation in `src/types/comic.ts`**

Add after the `PUBLISHERS` array (after line 165):
```typescript
/**
 * Maps common publisher shorthand/variations to canonical PUBLISHERS values.
 * Case-insensitive lookup. Returns null for unknown publishers.
 */
export const PUBLISHER_ALIASES: Record<string, string> = {
  // DC
  dc: "DC Comics",
  "dc comics": "DC Comics",
  // Marvel
  marvel: "Marvel Comics",
  "marvel comics": "Marvel Comics",
  // Image
  image: "Image Comics",
  "image comics": "Image Comics",
  // Dark Horse
  "dark horse": "Dark Horse Comics",
  "dark horse comics": "Dark Horse Comics",
  // IDW
  idw: "IDW Publishing",
  "idw publishing": "IDW Publishing",
  // Boom
  boom: "Boom! Studios",
  "boom!": "Boom! Studios",
  "boom studios": "Boom! Studios",
  "boom! studios": "Boom! Studios",
  // Dynamite
  dynamite: "Dynamite Entertainment",
  "dynamite entertainment": "Dynamite Entertainment",
  // Valiant
  valiant: "Valiant Comics",
  "valiant comics": "Valiant Comics",
  // Archie
  archie: "Archie Comics",
  "archie comics": "Archie Comics",
};

/**
 * Normalize a publisher name to a canonical value from the PUBLISHERS list.
 * Uses alias mapping for common variations (e.g., "DC" → "DC Comics").
 * Returns null if no mapping exists — unknown publishers are dropped.
 */
export function normalizePublisher(publisher: string | null | undefined): string | null {
  if (!publisher || !publisher.trim()) return null;
  const trimmed = publisher.trim();

  // Check exact match first
  if (PUBLISHERS.includes(trimmed)) return trimmed;

  // Check alias map (case-insensitive)
  const alias = PUBLISHER_ALIASES[trimmed.toLowerCase()];
  return alias || null;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/types/__tests__/publisherNormalize.test.ts`
Expected: PASS

**Step 5: Apply normalization in CSVImport.tsx**

In `src/components/CSVImport.tsx`:
- Add import: `import { normalizePublisher } from "@/types/comic";`
- Find the publisher case in the CSV field mapping (around line 128, case `"publisher"`):
  - Change: `row.publisher = value || undefined;`
  - To: `row.publisher = normalizePublisher(value) || undefined;`

**Step 6: Apply normalization in ComicDetailsForm.tsx**

In `src/components/ComicDetailsForm.tsx`:
- The publisher dropdown (around line 583-594) should check if the stored value matches.
- When the form loads with a publisher value not in PUBLISHERS, normalize it first.
- If normalization returns null (unknown publisher), show the value in the dropdown as-is with "Other" selected plus a text field showing the raw value, and a "Suggest to Admin" link/button.

The form should:
1. On mount/edit: normalize the incoming `comic.publisher` value
2. If normalized → use the normalized value in the dropdown
3. If not normalizable → set dropdown to "Other" and show a small "Suggest Publisher" button
4. Suggest Publisher button: sends a POST to `/api/admin/publishers` with the publisher name

**Step 7: Create publisher suggestion API**

Create `src/app/api/admin/publishers/route.ts`:
```typescript
import { auth } from "@clerk/nextjs/server";
import { createNotification } from "@/lib/auctionDb";
import { supabase } from "@/lib/supabase";

// POST: Submit a publisher suggestion
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { publisherName } = await request.json();
  if (!publisherName?.trim()) {
    return Response.json({ error: "Publisher name required" }, { status: 400 });
  }

  // Store in key_info_submissions table with a special type marker
  // Reuse existing submission infrastructure
  const { error } = await supabase.from("key_info_submissions").insert({
    user_id: userId,
    comic_title: "PUBLISHER_SUGGESTION",
    issue_number: "",
    suggested_key_info: `Publisher suggestion: ${publisherName.trim()}`,
    status: "pending",
  });

  if (error) {
    return Response.json({ error: "Failed to submit" }, { status: 500 });
  }

  return Response.json({ success: true });
}
```

Note: This reuses the existing `key_info_submissions` table to avoid creating a new table. Admin can review these in the Key Info Moderation page (they'll appear with `comic_title: "PUBLISHER_SUGGESTION"`). This is simple and adequate since publisher suggestions will be rare.

**Step 8: Run full test suite**

Run: `npm test`
Expected: All tests pass

---

## Task 3: Sort by Value Fix (#19)

**Files:**
- Modify: `src/app/collection/page.tsx:178-180`

**Step 1: Apply the fix**

In `src/app/collection/page.tsx`, the sort case at line ~178:

Change:
```typescript
case "value":
  return (
    (b.averagePrice || b.purchasePrice || 0) - (a.averagePrice || a.purchasePrice || 0)
  );
```

To:
```typescript
case "value":
  return getComicValue(b) - getComicValue(a);
```

`getComicValue` is already imported at line 34: `import { calculateCollectionValue, getComicValue } from "@/lib/gradePrice";`

**Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass

---

## Task 4: Admin Search Icon Overlap (#10)

**Files:**
- Modify: `src/app/admin/users/page.tsx:375`

**Step 1: Apply the fix**

Change the input className from:
```
className="input-pop pl-12"
```
To:
```
className="input-pop pl-14"
```

This increases left padding from 48px to 56px, giving the 20px icon at `left-3` (12px) enough clearance.

---

## Task 5: Admin Search No Results Message (#11)

**Files:**
- Modify: `src/app/admin/users/page.tsx`

**Step 1: Add hasSearched state**

Near the other state declarations in the component, add:
```typescript
const [hasSearched, setHasSearched] = useState(false);
```

**Step 2: Set hasSearched in the search function**

Find the `searchUsers` function. After the search completes (after `setSearchResults(data)` or equivalent), add:
```typescript
setHasSearched(true);
```

**Step 3: Update the empty state message**

Change the empty results block (around line 405-409):

From:
```tsx
<div className="p-8 text-center">
  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
  <p className="text-gray-500">Search for users by email</p>
</div>
```

To:
```tsx
<div className="p-8 text-center">
  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
  <p className="text-gray-500">
    {hasSearched
      ? `No users found matching "${searchQuery}"`
      : "Search for users by email"}
  </p>
</div>
```

---

## Task 6: Key Info Notifications on Approval/Rejection (#6)

**Files:**
- Modify: `src/types/auction.ts:11-30` (add notification types)
- Modify: `src/lib/auctionDb.ts:1285-1346` (add titles/messages for new types)
- Modify: `src/lib/keyComicsDb.ts:~388,~425` (add notification calls)

**Step 1: Add notification types to `src/types/auction.ts`**

In the `NotificationType` union (line 30), before the closing semicolon, add:
```typescript
  // Community contribution types
  | "key_info_approved"
  | "key_info_rejected";
```

**Step 2: Add titles/messages in `src/lib/auctionDb.ts`**

In the `createNotification` function's `titles` record (around line 1290), add:
```typescript
    key_info_approved: "Key info approved!",
    key_info_rejected: "Key info not accepted",
```

In the `messages` record (around line 1320), add:
```typescript
    key_info_approved: "Your key info suggestion has been approved and added to the database. Thank you for contributing!",
    key_info_rejected: "Your key info suggestion was reviewed but not accepted. Thank you for contributing!",
```

**Step 3: Add notification call in approveSubmission**

In `src/lib/keyComicsDb.ts`, add import at top:
```typescript
import { createNotification } from "./auctionDb";
```

In the `approveSubmission` function, after the submission status update succeeds (after line ~388, before `return { success: true };`), add:
```typescript
    // Notify the submitter
    await createNotification(submission.user_id, "key_info_approved").catch(() => {});
```

**Step 4: Add notification call in rejectSubmission**

In the `rejectSubmission` function, the submitter's `user_id` needs to be fetched. Before the update query, add a select to get the submission:
```typescript
    // Get submission to find the user
    const { data: submission } = await supabase
      .from("key_info_submissions")
      .select("user_id")
      .eq("id", submissionId)
      .single();
```

After the status update succeeds (after line ~425, before `return { success: true };`), add:
```typescript
    // Notify the submitter
    if (submission?.user_id) {
      await createNotification(submission.user_id, "key_info_rejected").catch(() => {});
    }
```

---

## Task 7: Key Info Approval Updates Reputation (#7)

**Files:**
- Modify: `src/lib/keyComicsDb.ts:~388` (add recordContribution call)

**Step 1: Add import**

In `src/lib/keyComicsDb.ts`, add import at top (alongside the createNotification import from Task 6):
```typescript
import { recordContribution } from "./reputationDb";
```

**Step 2: Add recordContribution call**

In the `approveSubmission` function, after the notification call added in Task 6, add:
```typescript
    // Record community contribution for reputation/badge system
    await recordContribution(submission.user_id, "key_info", keyComicId).catch(() => {});
```

The `submission.user_id` is already available from the submission data fetched earlier in the function. The `keyComicId` variable is already in scope from the merge logic above.

---

## Task 8: Public Collection Page Show Profile Name (#9)

**Files:**
- Modify: `src/app/u/[slug]/page.tsx:22`
- Modify: `src/app/u/[slug]/PublicCollectionView.tsx:41`

**Step 1: Update page.tsx metadata fallback**

In `src/app/u/[slug]/page.tsx`, line 22, change:
```typescript
const displayName = profile.publicDisplayName || profile.displayName || "A Collector";
```
To:
```typescript
const displayName = profile.publicDisplayName || profile.displayName || profile.username || slug || "A Collector";
```

**Step 2: Update PublicCollectionView.tsx fallback**

In `src/app/u/[slug]/PublicCollectionView.tsx`, line 41, change:
```typescript
const displayName = profile.publicDisplayName || profile.displayName || "A Collector";
```
To:
```typescript
const displayName = profile.publicDisplayName || profile.displayName || profile.username || "A Collector";
```

The `profile.username` field exists on `PublicProfile` (see `src/lib/db.ts:669`).

Note: The `PublicCollectionView` component doesn't have access to the URL slug, so it uses `profile.username` as the last meaningful fallback before "A Collector".

---

## Task 9: Follow Button on Public Collection Page (#21)

**Files:**
- Modify: `src/app/u/[slug]/PublicCollectionView.tsx:~89-101`

**Step 1: Add imports**

Add to the imports in `PublicCollectionView.tsx`:
```typescript
import { FollowButton } from "@/components/follows";
import { useAuth } from "@clerk/nextjs";
```

**Step 2: Get current user in component**

Inside the component function, add:
```typescript
const { userId } = useAuth();
```

Note: This component must be a client component. Check if it already has `"use client"` at top — if so, proceed. If it's a server component, we need to pass `userId` as a prop from the parent page instead.

**Step 3: Add FollowButton to profile header**

In the profile header section (around line 99, after the "Member since" paragraph), add:
```tsx
{userId && userId !== profile.id && (
  <div className="mt-3">
    <FollowButton userId={profile.id} />
  </div>
)}
```

This shows the follow button only when:
- User is logged in (`userId` exists)
- User is not viewing their own profile (`userId !== profile.id`)

---

## Task 10: Admin Portal Navigation (#13)

**Files:**
- Create: `src/app/admin/layout.tsx`

**Step 1: Create the admin layout**

Create `src/app/admin/layout.tsx`:
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, BarChart3, Key, MessageSquare, ScanLine, ArrowLeft } from "lucide-react";

const adminLinks = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/usage", label: "Usage", icon: BarChart3 },
  { href: "/admin/key-info", label: "Key Info", icon: Key },
  { href: "/admin/barcode-reviews", label: "Barcodes", icon: ScanLine },
  { href: "/admin/moderation", label: "Moderation", icon: MessageSquare },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      {/* Admin Navigation Bar */}
      <div className="border-b-4 border-black" style={{ background: "var(--pop-yellow)" }}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 overflow-x-auto">
              <h2
                className="text-lg font-bold whitespace-nowrap"
                style={{ fontFamily: "var(--font-bangers)" }}
              >
                Admin
              </h2>
              <div className="flex gap-1">
                {adminLinks.map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                        isActive
                          ? "bg-black text-white"
                          : "hover:bg-black/10"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
            <Link
              href="/collection"
              className="flex items-center gap-1 text-sm font-medium hover:underline whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to App
            </Link>
          </div>
        </div>
      </div>

      {/* Page Content */}
      {children}
    </div>
  );
}
```

**Step 2: Remove old admin links from users page**

In `src/app/admin/users/page.tsx`, find and remove the "Admin Links" section at the bottom (around lines 622-638):
```tsx
{/* Admin Links */}
<div className="mt-6 flex gap-4">
  <Link href="/admin/usage" ... >→ Service Usage Monitor</Link>
  <Link href="/admin/key-info" ... >→ Key Info Moderation</Link>
</div>
```

This is now handled by the shared layout nav.

---

## Task 11: Key Hunt Page Pop-Art Styling (#16)

**Files:**
- Modify: `src/app/key-hunt/page.tsx`

**Step 1: Update desktop container styling**

Around line 558, change:
```tsx
<div className="hidden md:block min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
```
To:
```tsx
<div className="hidden md:block min-h-screen" style={{ background: "var(--pop-cream)" }}>
```

**Step 2: Update desktop header section**

Update the header icon container (around line 563) from:
```tsx
<div className="inline-flex items-center justify-center w-20 h-20 bg-amber-500 rounded-2xl shadow-lg mb-6">
```
To:
```tsx
<div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 border-4 border-black shadow-[4px_4px_0px_#000]" style={{ background: "var(--pop-yellow)" }}>
```

Update the h1 title (around line 566) to use comic font:
```tsx
<h1 className="text-4xl font-bold text-gray-900 mb-4" style={{ fontFamily: "var(--font-bangers)" }}>Key Hunt</h1>
```

**Step 3: Update the "Mobile-Only Badge"**

Around line 574, change the badge styling from:
```tsx
<div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 border border-amber-200 rounded-full">
  <Smartphone className="w-5 h-5 text-amber-600" />
  <span className="text-amber-800 font-medium">Mobile Exclusive Feature</span>
```
To:
```tsx
<div className="inline-flex items-center gap-2 px-4 py-2 border-3 border-black rounded-full shadow-[2px_2px_0px_#000]" style={{ background: "var(--pop-yellow)" }}>
  <Smartphone className="w-5 h-5 text-black" />
  <span className="text-black font-bold">Mobile Exclusive Feature</span>
```

**Step 4: Update feature grid cards**

Around line 580, change the feature cards from:
```tsx
<div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
```
To:
```tsx
<div className="comic-panel p-6">
```

Apply this to all 3 feature grid cards in the section.

**Step 5: Update mobile container for scrollability**

Around line 656, change:
```tsx
<div className="md:hidden min-h-screen bg-gray-900">
```
To:
```tsx
<div className="md:hidden min-h-screen bg-gray-900 overflow-y-auto">
```

**Step 6: Update mobile header styling**

Around line 663, change:
```tsx
<div className="bg-gradient-to-b from-amber-500 to-amber-600 px-4 py-6 safe-area-inset-top">
```
To:
```tsx
<div className="px-4 py-6 safe-area-inset-top border-b-4 border-black" style={{ background: "var(--pop-yellow)" }}>
```

Update the mobile header text colors from `text-white` and `text-white/80` to `text-black` and `text-black/70` to be readable on yellow background.

**Step 7: Verify scrollability**

Ensure all content on the mobile view is reachable by scrolling. The `overflow-y-auto` on the outer container should fix the scroll issue. If content is still clipped, check for any inner containers with `h-screen` constraints.

---

## Task 12: Raw/Slabbed Toggle Re-evaluates Value (#18)

**Files:**
- Modify: `src/components/ComicDetailsForm.tsx:~1148-1155`

**Step 1: Verify the current display logic**

The estimated value section (around line 1148) already computes:
```typescript
const gradeAdjustedValue =
  selectedGrade && comic.priceData?.gradeEstimates
    ? calculateValueAtGrade(comic.priceData, selectedGrade, isGraded)
    : comic.priceData.estimatedValue;
```

This uses `isGraded` (the reactive state variable) in the call to `calculateValueAtGrade`. Since `isGraded` is state and this is inside a render function, it SHOULD reactively update when the toggle changes.

**Step 2: Verify the label updates**

Check that the label text (around line 1164) also references `isGraded`:
```tsx
<span className="text-xs font-normal text-gray-500">
  ({isGraded ? "slabbed" : "raw"} {selectedGrade})
</span>
```

If both references use `isGraded` state (not a stale prop), the value should already update. The issue may be that the estimated value display is wrapped in a conditional that doesn't re-render.

**Step 3: Check for stale closure issues**

The estimated value section uses an IIFE pattern:
```tsx
{comic.priceData && comic.priceData.estimatedValue && (() => { ... })()}
```

This IIFE re-executes on every render, so `isGraded` state changes should cause re-calculation. If the value still doesn't update, the issue is likely that `comic.priceData` itself is stale (stored on the comic object, not in state).

**Step 4: If the value doesn't update reactively, add explicit re-calc**

If testing reveals the value doesn't update, add a `useMemo` that depends on `isGraded`:
```typescript
const displayedValue = useMemo(() => {
  if (!comic.priceData?.estimatedValue) return null;
  const selectedGrade = grade ? parseFloat(grade) : null;
  if (selectedGrade && comic.priceData?.gradeEstimates) {
    return calculateValueAtGrade(comic.priceData, selectedGrade, isGraded);
  }
  return comic.priceData.estimatedValue;
}, [comic.priceData, grade, isGraded]);
```

Then use `displayedValue` in the JSX instead of the inline IIFE.

---

## Execution Groups (for parallel subagents)

These tasks have no dependencies on each other and can be executed in parallel:

| Group | Tasks | Theme |
|-------|-------|-------|
| A | 1, 2 | Data parsing (CSV, publisher) |
| B | 3, 4, 5 | Collection + Admin UX |
| C | 6, 7 | Community notifications + reputation |
| D | 8, 9 | Public profile + follows |
| E | 10, 11, 12 | Key Hunt styling + form behavior |

After all groups complete, run `npm test` and `npm run check` to verify everything works together.
