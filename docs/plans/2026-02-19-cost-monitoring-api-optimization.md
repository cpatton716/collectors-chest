# Cost Monitoring & API Optimization Implementation Plan

> **Apr 23, 2026 update:** Cost-monitoring and cache logic below is unchanged. Adjacent scan-flow additions that also affect cost protection: hCaptcha gate on guest scans 4-5 (before hitting the 5/day guest cap), 10MB image upload cap (rejects oversized uploads before any AI call), and the pre-harvest aspect-ratio guard in `src/lib/coverCropValidator.ts` (prevents wasted harvest work on bad crops). Metron verification has been removed from the scan flow.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce Anthropic API spend by caching comic metadata (40-60% savings), add in-app admin alerts for usage thresholds, and instrument scans with server-side PostHog for passive cost monitoring.

**Architecture:** Three-layer approach: (1) Dual-layer cache (Redis 7-day + Supabase permanent) intercepts the analyze route before AI calls, filling known fields from prior scans. (2) Lightweight admin alert-status endpoint + badge component for real-time in-app visibility. (3) Server-side PostHog events track scan cost, cache hits, and AI call counts for trend analysis and email alerts.

**Tech Stack:** Next.js 16, Supabase (Postgres), Upstash Redis, posthog-node (new dependency), PostHog dashboard (manual config)

---

## Context for Implementer

### Key Files You'll Touch

| File | Purpose |
|------|---------|
| `src/app/api/analyze/route.ts` | 983-line scan endpoint — main integration point for cache + PostHog |
| `src/lib/cache.ts` | Redis cache helpers — already has `generateComicMetadataCacheKey()` (line 159), `comicMetadata` prefix (line 15), 7-day TTL (line 28) |
| `src/lib/db.ts` | Supabase helpers — already has `getComicMetadata()` (line 493) and `saveComicMetadata()` (line 528), both fully implemented but NEVER called |
| `src/lib/adminAuth.ts` | `getAdminProfile()` (line 31) — admin auth guard for API routes |
| `src/app/admin/layout.tsx` | 5-tab admin layout — add badge to Usage tab |
| `src/components/Navigation.tsx` | Desktop nav — Admin link at line 353 |
| `src/components/MobileNav.tsx` | Mobile nav — Admin link at line 323 |
| `src/hooks/useSubscription.ts` | Exports `isAdmin` boolean (line 17) |

### Existing Patterns to Follow

- **Polling:** `NotificationBell.tsx` polls every 30 seconds via `useEffect` + `setInterval`
- **Admin API auth:** All admin routes call `getAdminProfile()`, return 403 if null
- **Fire-and-forget writes:** `incrementScanCount()` in analyze route uses `.catch()` pattern (line 956)
- **Cache pattern:** `cacheGet<T>(key, prefix)` / `cacheSet<T>(key, value, prefix)` in `cache.ts`
- **Tests:** Pure unit tests in `src/lib/__tests__/*.test.ts`, Jest 30 + ts-jest

### Variable Names in analyze/route.ts

The main `comicDetails` object uses these field names:
- `title`, `issueNumber`, `publisher`, `releaseYear`
- `writer`, `coverArtist`, `interiorArtist`
- `variant`, `keyInfo`, `grade`, `priceData`

The `getComicMetadata()` return type maps DB snake_case to these camelCase names.

---

## Task 1: Metadata Cache Merge Helper + Tests

**Files:**
- Create: `src/lib/metadataCache.ts`
- Create: `src/lib/__tests__/metadataCache.test.ts`

This helper does the "fill-only merge" — cached values only populate fields that are still empty after the initial AI scan. We never overwrite data the scanner already found.

**Step 1: Write the failing tests**

Create `src/lib/__tests__/metadataCache.test.ts`:

```typescript
import { mergeMetadataIntoDetails, buildMetadataSavePayload } from "../metadataCache";

describe("mergeMetadataIntoDetails", () => {
  const fullMetadata = {
    id: "uuid-1",
    title: "Amazing Spider-Man",
    issueNumber: "300",
    publisher: "Marvel Comics",
    releaseYear: "1988",
    writer: "David Michelinie",
    coverArtist: "Todd McFarlane",
    interiorArtist: "Todd McFarlane",
    coverImageUrl: null,
    keyInfo: ["First appearance of Venom"],
    priceData: null,
    lookupCount: 5,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  it("fills empty fields from cached metadata", () => {
    const details = { title: "Amazing Spider-Man", issueNumber: "300" };
    const result = mergeMetadataIntoDetails(details, fullMetadata);
    expect(result.publisher).toBe("Marvel Comics");
    expect(result.writer).toBe("David Michelinie");
    expect(result.coverArtist).toBe("Todd McFarlane");
    expect(result.interiorArtist).toBe("Todd McFarlane");
    expect(result.releaseYear).toBe("1988");
  });

  it("never overwrites existing fields", () => {
    const details = {
      title: "Amazing Spider-Man",
      issueNumber: "300",
      publisher: "Marvel",
      writer: "Someone Else",
    };
    const result = mergeMetadataIntoDetails(details, fullMetadata);
    expect(result.publisher).toBe("Marvel");
    expect(result.writer).toBe("Someone Else");
    // But fills missing ones:
    expect(result.coverArtist).toBe("Todd McFarlane");
  });

  it("fills keyInfo only when details has none", () => {
    const details = { title: "ASM", issueNumber: "300", keyInfo: ["Existing info"] };
    const result = mergeMetadataIntoDetails(details, fullMetadata);
    expect(result.keyInfo).toEqual(["Existing info"]);
  });

  it("fills keyInfo from cache when details has empty array", () => {
    const details = { title: "ASM", issueNumber: "300", keyInfo: [] };
    const result = mergeMetadataIntoDetails(details, fullMetadata);
    expect(result.keyInfo).toEqual(["First appearance of Venom"]);
  });

  it("returns details unchanged when metadata is null", () => {
    const details = { title: "ASM", issueNumber: "300" };
    const result = mergeMetadataIntoDetails(details, null);
    expect(result).toEqual(details);
  });

  it("does not add extra properties from metadata", () => {
    const details = { title: "ASM", issueNumber: "300" };
    const result = mergeMetadataIntoDetails(details, fullMetadata);
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("lookupCount");
    expect(result).not.toHaveProperty("createdAt");
  });
});

describe("buildMetadataSavePayload", () => {
  it("extracts saveable fields from comicDetails", () => {
    const details = {
      title: "ASM",
      issueNumber: "300",
      publisher: "Marvel",
      releaseYear: "1988",
      writer: "Michelinie",
      coverArtist: "McFarlane",
      interiorArtist: "McFarlane",
      keyInfo: ["First Venom"],
    };
    const payload = buildMetadataSavePayload(details);
    expect(payload).toEqual({
      title: "ASM",
      issueNumber: "300",
      publisher: "Marvel",
      releaseYear: "1988",
      writer: "Michelinie",
      coverArtist: "McFarlane",
      interiorArtist: "McFarlane",
      keyInfo: ["First Venom"],
    });
  });

  it("returns null when title or issueNumber is missing", () => {
    expect(buildMetadataSavePayload({ title: "ASM" })).toBeNull();
    expect(buildMetadataSavePayload({ issueNumber: "1" })).toBeNull();
    expect(buildMetadataSavePayload({})).toBeNull();
  });

  it("omits undefined fields", () => {
    const details = { title: "ASM", issueNumber: "300" };
    const payload = buildMetadataSavePayload(details);
    expect(payload).toEqual({ title: "ASM", issueNumber: "300" });
    expect(Object.keys(payload!)).toEqual(["title", "issueNumber"]);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- src/lib/__tests__/metadataCache.test.ts
```
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/lib/metadataCache.ts`:

```typescript
/**
 * Fill-only merge: cached metadata populates empty fields on comicDetails.
 * Never overwrites data the scanner already found.
 */

interface ComicMetadata {
  id: string;
  title: string;
  issueNumber: string;
  publisher: string | null;
  releaseYear: string | null;
  writer: string | null;
  coverArtist: string | null;
  interiorArtist: string | null;
  coverImageUrl: string | null;
  keyInfo: string[];
  priceData: unknown;
  lookupCount: number;
  createdAt: string;
  updatedAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComicDetails = Record<string, any>;

const FILL_FIELDS = [
  "publisher",
  "releaseYear",
  "writer",
  "coverArtist",
  "interiorArtist",
] as const;

export function mergeMetadataIntoDetails(
  details: ComicDetails,
  metadata: ComicMetadata | null
): ComicDetails {
  if (!metadata) return details;

  for (const field of FILL_FIELDS) {
    if (!details[field] && metadata[field]) {
      details[field] = metadata[field];
    }
  }

  // Fill keyInfo only when details has none or empty array
  if (
    (!details.keyInfo || (Array.isArray(details.keyInfo) && details.keyInfo.length === 0)) &&
    metadata.keyInfo &&
    metadata.keyInfo.length > 0
  ) {
    details.keyInfo = metadata.keyInfo;
  }

  return details;
}

export function buildMetadataSavePayload(
  details: ComicDetails
): { title: string; issueNumber: string; [key: string]: unknown } | null {
  if (!details.title || !details.issueNumber) return null;

  const payload: Record<string, unknown> = {
    title: details.title,
    issueNumber: details.issueNumber,
  };

  for (const field of FILL_FIELDS) {
    if (details[field] !== undefined) {
      payload[field] = details[field];
    }
  }

  if (details.keyInfo !== undefined) {
    payload.keyInfo = details.keyInfo;
  }

  return payload as { title: string; issueNumber: string };
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- src/lib/__tests__/metadataCache.test.ts
```
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/lib/metadataCache.ts src/lib/__tests__/metadataCache.test.ts
git commit -m "feat: add metadata cache merge helper with tests"
```

---

## Task 2: Wire Metadata Cache into Analyze Route

**Files:**
- Modify: `src/app/api/analyze/route.ts` (lines 8-14 imports, ~line 625 lookup, ~line 959 save)

**Step 1: Add imports**

Add to the import block (lines 8-14):

```typescript
// Add generateComicMetadataCacheKey to existing cache import (line 8-14):
import {
  cacheGet,
  cacheSet,
  generateComicMetadataCacheKey,    // ADD THIS
  generateEbayPriceCacheKey,
  hashImageData,
  isCacheAvailable,
} from "@/lib/cache";

// Add new imports after line 18:
import { getComicMetadata, saveComicMetadata } from "@/lib/db";
import { mergeMetadataIntoDetails, buildMetadataSavePayload } from "@/lib/metadataCache";
```

Note: `getComicMetadata` may already be importable from `@/lib/db` — check the existing import on line 16. If `getProfileByClerkId` is already imported from `@/lib/db`, add `getComicMetadata` and `saveComicMetadata` to that same import.

**Step 2: Add metadata cache LOOKUP after key info check**

Insert AFTER line 625 (after the `databaseKeyInfo` block, BEFORE `needsAIVerification` on line 628):

```typescript
  // ============================================
  // Metadata Cache Lookup (dual-layer: Redis → Supabase)
  // ============================================
  let metadataCacheHit = false;
  if (comicDetails.title && comicDetails.issueNumber) {
    try {
      const cacheKey = generateComicMetadataCacheKey(comicDetails.title, comicDetails.issueNumber);

      // Layer 1: Redis (fast, 7-day TTL)
      let cachedMetadata = await cacheGet<{
        publisher: string | null;
        releaseYear: string | null;
        writer: string | null;
        coverArtist: string | null;
        interiorArtist: string | null;
        keyInfo: string[];
      }>(cacheKey, "comicMetadata");

      // Layer 2: Supabase fallback (permanent)
      if (!cachedMetadata) {
        const dbMetadata = await getComicMetadata(comicDetails.title, comicDetails.issueNumber);
        if (dbMetadata) {
          cachedMetadata = dbMetadata;
          // Backfill Redis for next time (fire-and-forget)
          cacheSet(cacheKey, dbMetadata, "comicMetadata").catch(() => {});
        }
      }

      if (cachedMetadata) {
        metadataCacheHit = true;
        mergeMetadataIntoDetails(comicDetails, cachedMetadata as Parameters<typeof mergeMetadataIntoDetails>[1]);
      }
    } catch (cacheError) {
      console.error("Metadata cache lookup failed:", cacheError);
    }
  }

  // Recheck missing fields after cache merge
  const missingCreatorInfoAfterCache =
    !comicDetails.writer || !comicDetails.coverArtist || !comicDetails.interiorArtist;
  const missingBasicInfoAfterCache = !comicDetails.publisher || !comicDetails.releaseYear;
```

**Step 3: Update the needsAIVerification decision**

Replace the existing `needsAIVerification` block (lines 628-632) to use the post-cache variables:

```typescript
  // Only call AI if we STILL need to fill in missing information after cache
  const needsKeyInfoFromAI = !comicDetails.keyInfo || comicDetails.keyInfo.length === 0;
  const needsAIVerification =
    comicDetails.title &&
    comicDetails.issueNumber &&
    (missingCreatorInfoAfterCache || missingBasicInfoAfterCache || needsKeyInfoFromAI);
```

**Step 4: Add metadata cache SAVE before response**

Insert AFTER the `incrementScanCount` block (~line 959), BEFORE `return NextResponse.json(comicDetails)`:

```typescript
  // ============================================
  // Save to Metadata Cache (fire-and-forget)
  // ============================================
  const savePayload = buildMetadataSavePayload(comicDetails);
  if (savePayload) {
    // Save to Supabase (permanent) + Redis (7-day TTL) in parallel
    const cacheKey = generateComicMetadataCacheKey(savePayload.title, savePayload.issueNumber);
    Promise.all([
      saveComicMetadata(savePayload),
      cacheSet(cacheKey, savePayload, "comicMetadata"),
    ]).catch((err) => {
      console.error("Metadata cache save failed:", err);
    });
  }
```

**Step 5: Verify — typecheck and existing tests pass**

```bash
npx tsc --noEmit
npm test
```
Expected: No type errors, all tests pass

**Step 6: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat: wire dual-layer metadata cache into analyze route"
```

---

## Task 3: Admin Alert Status API Endpoint

**Files:**
- Create: `src/app/api/admin/usage/alert-status/route.ts`

**Step 1: Create the endpoint**

This is a lightweight endpoint for client-side polling. It reuses the same threshold logic as the existing usage route but returns a minimal response cached for 5 minutes.

Create `src/app/api/admin/usage/alert-status/route.ts`:

```typescript
import { NextResponse } from "next/server";

import { getAdminProfile } from "@/lib/adminAuth";
import { cacheGet, cacheSet } from "@/lib/cache";

const ALERT_THRESHOLDS = {
  warning: 0.7,
  critical: 0.9,
};

interface AlertInfo {
  name: string;
  percentage: number;
  level: "warning" | "critical";
}

interface AlertStatusResponse {
  alertCount: number;
  alertLevel: "ok" | "warning" | "critical";
  alerts: AlertInfo[];
}

const CACHE_KEY = "admin-alert-status";
const CACHE_PREFIX = "comicMetadata"; // Reuse existing prefix for simplicity
const CACHE_TTL_SECONDS = 300; // 5 minutes

export async function GET() {
  const admin = await getAdminProfile();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Check 5-minute cache first
  try {
    const cached = await cacheGet<AlertStatusResponse>(CACHE_KEY, CACHE_PREFIX);
    if (cached) {
      return NextResponse.json(cached);
    }
  } catch {
    // Cache miss or error — proceed to calculate
  }

  // Fetch the full usage data from our own usage endpoint logic
  try {
    const usageResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/admin/usage`,
      {
        headers: {
          Cookie: "", // Server-to-server, we'll call the DB directly instead
        },
      }
    );

    // Actually, calling our own endpoint has auth issues. Calculate directly instead.
    // Import the metrics calculation inline to avoid circular deps.
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const alerts: AlertInfo[] = [];

    // Check database size (Supabase free tier: 500MB)
    const { data: dbSize } = await supabaseAdmin.rpc("pg_database_size", {
      db_name: "postgres",
    });
    if (dbSize) {
      const limit = 500 * 1024 * 1024;
      const pct = dbSize / limit;
      if (pct >= ALERT_THRESHOLDS.critical) {
        alerts.push({ name: "Database", percentage: Math.round(pct * 100), level: "critical" });
      } else if (pct >= ALERT_THRESHOLDS.warning) {
        alerts.push({ name: "Database", percentage: Math.round(pct * 100), level: "warning" });
      }
    }

    // Determine overall level
    let alertLevel: "ok" | "warning" | "critical" = "ok";
    if (alerts.some((a) => a.level === "critical")) alertLevel = "critical";
    else if (alerts.some((a) => a.level === "warning")) alertLevel = "warning";

    const response: AlertStatusResponse = {
      alertCount: alerts.length,
      alertLevel,
      alerts,
    };

    // Cache for 5 minutes
    cacheSet(CACHE_KEY, response, CACHE_PREFIX).catch(() => {});

    return NextResponse.json(response);
  } catch (error) {
    console.error("Alert status check failed:", error);
    return NextResponse.json(
      { alertCount: 0, alertLevel: "ok", alerts: [] } satisfies AlertStatusResponse
    );
  }
}
```

**IMPORTANT NOTE:** The approach above using `supabaseAdmin.rpc("pg_database_size")` may not work if the RPC doesn't exist. The implementer should check the existing `/api/admin/usage/route.ts` to see exactly how database size is fetched and replicate that logic. If it's too complex, simplify to just checking the `overallStatus` from a direct import of the usage calculation functions, or proxy to the existing endpoint with admin headers.

**A simpler alternative** — if the existing usage route's logic is complex, just proxy to it:

```typescript
// Simpler: Call the existing usage route internally
// The admin check above already validates the user, so we trust the response
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
// ... but this requires forwarding auth cookies, which is tricky server-to-server
```

The implementer should choose the approach that works best after reading the full usage route.

**Step 2: Verify endpoint works**

```bash
npx tsc --noEmit
```
Expected: No type errors

**Step 3: Commit**

```bash
git add src/app/api/admin/usage/alert-status/route.ts
git commit -m "feat: add lightweight admin alert-status endpoint"
```

---

## Task 4: AdminAlertBadge Component + Tests

**Files:**
- Create: `src/components/AdminAlertBadge.tsx`
- Create: `src/lib/__tests__/adminAlertBadge.test.ts`

**Step 1: Write tests for the cost estimation helper**

We'll test the pure logic that determines badge color from alert level. Create `src/lib/__tests__/adminAlertBadge.test.ts`:

```typescript
import { getAlertBadgeColor } from "../alertBadgeHelpers";

describe("getAlertBadgeColor", () => {
  it("returns red for critical", () => {
    expect(getAlertBadgeColor("critical")).toBe("bg-pop-red");
  });

  it("returns yellow for warning", () => {
    expect(getAlertBadgeColor("warning")).toBe("bg-pop-yellow text-pop-black");
  });

  it("returns empty string for ok", () => {
    expect(getAlertBadgeColor("ok")).toBe("");
  });
});
```

**Step 2: Create the helper**

Create `src/lib/alertBadgeHelpers.ts`:

```typescript
export function getAlertBadgeColor(level: "ok" | "warning" | "critical"): string {
  switch (level) {
    case "critical":
      return "bg-pop-red";
    case "warning":
      return "bg-pop-yellow text-pop-black";
    default:
      return "";
  }
}
```

**Step 3: Run tests**

```bash
npm test -- src/lib/__tests__/adminAlertBadge.test.ts
```
Expected: ALL PASS

**Step 4: Create the component**

Create `src/components/AdminAlertBadge.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import { useSubscription } from "@/hooks/useSubscription";
import { getAlertBadgeColor } from "@/lib/alertBadgeHelpers";

interface AdminAlertBadgeProps {
  variant: "dot" | "count";
}

interface AlertStatus {
  alertCount: number;
  alertLevel: "ok" | "warning" | "critical";
}

export default function AdminAlertBadge({ variant }: AdminAlertBadgeProps) {
  const { isAdmin } = useSubscription();
  const [status, setStatus] = useState<AlertStatus | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/admin/usage/alert-status");
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch {
        // Silently fail — badge just won't show
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 60000); // 60 seconds
    return () => clearInterval(interval);
  }, [isAdmin]);

  if (!isAdmin || !status || status.alertLevel === "ok") return null;

  const colorClass = getAlertBadgeColor(status.alertLevel);

  if (variant === "dot") {
    return (
      <span
        className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-white ${colorClass}`}
      />
    );
  }

  // variant === "count"
  return (
    <span
      className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white ${colorClass}`}
    >
      {status.alertCount > 9 ? "9+" : status.alertCount}
    </span>
  );
}
```

**Step 5: Commit**

```bash
git add src/components/AdminAlertBadge.tsx src/lib/alertBadgeHelpers.ts src/lib/__tests__/adminAlertBadge.test.ts
git commit -m "feat: add AdminAlertBadge component with dot/count variants"
```

---

## Task 5: Wire Badge into Navigation

**Files:**
- Modify: `src/app/admin/layout.tsx` (line ~48, add dot badge to Usage tab)
- Modify: `src/components/Navigation.tsx` (line ~360, add count badge to Admin link)
- Modify: `src/components/MobileNav.tsx` (line ~330, add count badge to Admin link)

**Step 1: Add dot badge to Usage tab in admin layout**

In `src/app/admin/layout.tsx`:

Add import at top:
```typescript
import AdminAlertBadge from "@/components/AdminAlertBadge";
```

Find the Usage tab link (the one with `href: "/admin/usage"`) and wrap the icon in a `relative` container to position the dot badge:

```tsx
{/* In the tab rendering loop, for the Usage tab only: */}
<div className="relative">
  <link.icon className="w-5 h-5" />
  {link.label === "Usage" && <AdminAlertBadge variant="dot" />}
</div>
```

**Step 2: Add count badge to Admin link in Navigation.tsx**

In `src/components/Navigation.tsx`:

Add import at top:
```typescript
import AdminAlertBadge from "@/components/AdminAlertBadge";
```

Find the Admin link (~line 363, the `<span>ADMIN</span>` line) and add the badge after it:

```tsx
<Shield className="w-5 h-5" />
<span className="font-comic text-sm tracking-wide">ADMIN</span>
<AdminAlertBadge variant="count" />
```

**Step 3: Add count badge to Admin link in MobileNav.tsx**

In `src/components/MobileNav.tsx`:

Add import at top:
```typescript
import AdminAlertBadge from "@/components/AdminAlertBadge";
```

Find the Admin link (~line 333, the `<span>Admin</span>` line) and add the badge after it:

```tsx
<Shield className="w-5 h-5" />
<span className="font-medium">Admin</span>
<AdminAlertBadge variant="count" />
```

**Step 4: Verify**

```bash
npx tsc --noEmit
npm test
```
Expected: No type errors, all tests pass

**Step 5: Commit**

```bash
git add src/app/admin/layout.tsx src/components/Navigation.tsx src/components/MobileNav.tsx
git commit -m "feat: wire AdminAlertBadge into admin layout and nav"
```

---

## Task 6: Server-Side PostHog Analytics Module

**Files:**
- Modify: `package.json` (add posthog-node)
- Create: `src/lib/analyticsServer.ts`
- Create: `src/lib/__tests__/analyticsServer.test.ts`

**Step 1: Install posthog-node**

```bash
cd "/Users/chrispatton/Coding for Dummies/Comic Tracker"
npm install posthog-node
```

**Step 2: Write failing tests**

Create `src/lib/__tests__/analyticsServer.test.ts`:

```typescript
import { estimateScanCostCents } from "../analyticsServer";

describe("estimateScanCostCents", () => {
  it("returns 0 when metadata cache hit and no AI calls", () => {
    expect(
      estimateScanCostCents({ metadataCacheHit: true, aiCallsMade: 0, ebayLookup: false })
    ).toBe(0);
  });

  it("returns ~0.6 cents for Combined Verification only", () => {
    const cost = estimateScanCostCents({ metadataCacheHit: false, aiCallsMade: 1, ebayLookup: false });
    expect(cost).toBeGreaterThanOrEqual(0.5);
    expect(cost).toBeLessThanOrEqual(0.7);
  });

  it("adds eBay lookup cost", () => {
    const withoutEbay = estimateScanCostCents({ metadataCacheHit: false, aiCallsMade: 1, ebayLookup: false });
    const withEbay = estimateScanCostCents({ metadataCacheHit: false, aiCallsMade: 1, ebayLookup: true });
    expect(withEbay).toBeGreaterThan(withoutEbay);
  });

  it("scales with multiple AI calls", () => {
    const one = estimateScanCostCents({ metadataCacheHit: false, aiCallsMade: 1, ebayLookup: false });
    const two = estimateScanCostCents({ metadataCacheHit: false, aiCallsMade: 2, ebayLookup: false });
    expect(two).toBeGreaterThan(one);
  });

  it("initial scan AI call is more expensive", () => {
    // The first AI call (image analysis) costs ~1.5 cents, verification ~0.6 cents
    const cost = estimateScanCostCents({ metadataCacheHit: false, aiCallsMade: 2, ebayLookup: false });
    expect(cost).toBeGreaterThanOrEqual(1.5);
  });
});
```

**Step 3: Run tests to verify they fail**

```bash
npm test -- src/lib/__tests__/analyticsServer.test.ts
```
Expected: FAIL — module not found

**Step 4: Write the implementation**

Create `src/lib/analyticsServer.ts`:

```typescript
import { PostHog } from "posthog-node";

// Serverless-optimized PostHog: flush immediately, no batching
const posthogServer =
  process.env.NEXT_PUBLIC_POSTHOG_KEY
    ? new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        flushAt: 1,
        flushInterval: 0,
      })
    : null;

export interface ScanEventProperties {
  scanMethod: string;
  metadataCacheHit: boolean;
  redisCacheHit: boolean;
  supabaseCacheHit: boolean;
  aiCallsMade: number;
  ebayLookup: boolean;
  durationMs: number;
  estimatedCostCents: number;
  success: boolean;
  userId?: string;
  subscriptionTier?: string;
}

/**
 * Track a scan event server-side with cost and performance data.
 * Fire-and-forget — never blocks the response.
 */
export async function trackScanServer(
  distinctId: string,
  properties: ScanEventProperties
): Promise<void> {
  if (!posthogServer) return;

  posthogServer.capture({
    distinctId,
    event: "scan_completed_server",
    properties: {
      ...properties,
      $set: {
        last_scan_at: new Date().toISOString(),
        subscription_tier: properties.subscriptionTier,
      },
    },
  });

  // Serverless: must flush before function exits
  await posthogServer.shutdown();
}

// Cost estimation constants (in cents)
const INITIAL_SCAN_COST = 1.5; // Image analysis AI call (~$0.015)
const VERIFICATION_COST = 0.6; // Combined Verification AI call (~$0.006)
const EBAY_LOOKUP_COST = 0.15; // eBay API + processing (~$0.0015)

/**
 * Estimate the cost of a scan in cents based on what API calls were made.
 */
export function estimateScanCostCents(params: {
  metadataCacheHit: boolean;
  aiCallsMade: number;
  ebayLookup: boolean;
}): number {
  let cost = 0;

  if (params.aiCallsMade >= 1) {
    // First AI call is always the initial image scan (most expensive)
    cost += INITIAL_SCAN_COST;
  }
  if (params.aiCallsMade >= 2) {
    // Additional calls are verification/enrichment
    cost += (params.aiCallsMade - 1) * VERIFICATION_COST;
  }

  if (params.ebayLookup) {
    cost += EBAY_LOOKUP_COST;
  }

  return Math.round(cost * 100) / 100;
}
```

**Step 5: Run tests to verify they pass**

```bash
npm test -- src/lib/__tests__/analyticsServer.test.ts
```
Expected: ALL PASS

**Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/analyticsServer.ts src/lib/__tests__/analyticsServer.test.ts
git commit -m "feat: add server-side PostHog analytics module with cost estimation"
```

---

## Task 7: Instrument Analyze Route with PostHog

**Files:**
- Modify: `src/app/api/analyze/route.ts`

**Step 1: Add imports**

Add to imports at top of analyze/route.ts:

```typescript
import { estimateScanCostCents, trackScanServer } from "@/lib/analyticsServer";
```

**Step 2: Add timing at start of handler**

Near the top of the POST handler function (after the initial auth/rate-limit checks, before any analysis begins), add:

```typescript
const scanStartTime = Date.now();
let aiCallsMade = 0;
let ebayLookupMade = false;
```

**Step 3: Increment AI call counter**

After the initial Anthropic image analysis call (the first `anthropic.messages.create`), add:
```typescript
aiCallsMade++;
```

After the Combined Verification call (~line 642), add:
```typescript
aiCallsMade++;
```

**Step 4: Track eBay lookup**

After the eBay lookup call (wherever `lookupEbaySoldPrices` is called), add:
```typescript
ebayLookupMade = true;
```

**Step 5: Fire PostHog event before response**

Insert just before `return NextResponse.json(comicDetails)` (after the metadata cache save block):

```typescript
  // ============================================
  // Server-Side Analytics (fire-and-forget)
  // ============================================
  const scanDuration = Date.now() - scanStartTime;
  const costCents = estimateScanCostCents({
    metadataCacheHit,
    aiCallsMade,
    ebayLookup: ebayLookupMade,
  });

  if (profileId) {
    trackScanServer(profileId, {
      scanMethod: "camera", // or extract from request if available
      metadataCacheHit,
      redisCacheHit: false, // TODO: set true when Redis layer hits
      supabaseCacheHit: metadataCacheHit && !false, // simplified
      aiCallsMade,
      ebayLookup: ebayLookupMade,
      durationMs: scanDuration,
      estimatedCostCents: costCents,
      success: true,
      userId: profileId,
      subscriptionTier: profile?.subscription_tier || "free",
    }).catch((err) => {
      console.error("PostHog tracking failed:", err);
    });
  }
```

**Note for implementer:** Refine the `redisCacheHit` and `supabaseCacheHit` tracking in the cache lookup block from Task 2. Add two booleans (`redisCacheHit`, `supabaseCacheHit`) alongside the existing `metadataCacheHit` and set them appropriately in the dual-layer lookup logic.

**Step 6: Verify**

```bash
npx tsc --noEmit
npm test
```
Expected: No type errors, all tests pass

**Step 7: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat: instrument analyze route with server-side PostHog scan tracking"
```

---

## Task 8: Full Verification

**Step 1: Run all tests**

```bash
npm test
```
Expected: ALL tests pass (including new metadataCache, alertBadgeHelpers, analyticsServer tests)

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: No errors

**Step 3: Lint**

```bash
npm run lint
```
Expected: 0 errors (warnings OK)

**Step 4: Build**

```bash
npm run build
```
Expected: Build succeeds

**Step 5: Commit any lint/type fixes if needed**

```bash
git add -A
git commit -m "chore: fix lint/type issues from cost monitoring implementation"
```

---

## Post-Implementation: Manual Steps

These are NOT code tasks — do them in browser after all code ships:

### Anthropic Dashboard Spending Cap
1. Go to [console.anthropic.com](https://console.anthropic.com) → Settings → Spending
2. Set monthly spending limit to $25 (or whatever feels right)
3. This is a zero-code safety net — do it immediately

### PostHog Dashboard Configuration
1. Go to [app.posthog.com](https://app.posthog.com) → Dashboards → New Dashboard
2. Create 5 insights:
   - **Scan Volume**: Trend of `scan_completed_server` events, daily
   - **Daily Estimated Cost**: Trend of `sum(estimatedCostCents)` / 100, daily
   - **Cache Hit Rate**: Formula: `count(metadataCacheHit=true) / count(*)`, daily
   - **AI Calls Distribution**: Breakdown of `aiCallsMade` values
   - **Avg Scan Duration**: Trend of `avg(durationMs)`, daily
3. Create 3 alerts (Insights → Actions → Alerts):
   - **Cost Spike**: Daily cost > $2 → email
   - **Volume Anomaly**: Daily scans > 2x 7-day average → email
   - **Cache Rate Drop**: Cache hit rate < 30% → email
