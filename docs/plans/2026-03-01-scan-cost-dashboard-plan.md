# Scan Cost Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add scan cost insights, performance metrics, and spend alerts to the Admin > Usage page, powered by a new `scan_analytics` Supabase table.

**Architecture:** Every route that calls Anthropic writes a row to `scan_analytics` via a fire-and-forget insert. The admin usage API aggregates this data with efficient SQL queries (rolling windows, not full-table scans). The existing `check-alerts` cron route checks scan cost thresholds and emails via Resend.

**Tech Stack:** Supabase (Postgres), Next.js API routes, Resend (email), Lucide icons, Tailwind CSS

**Files Created:**
- `supabase/migrations/20260301_scan_analytics.sql`
- `src/lib/scanAnalyticsHelpers.ts`
- `src/lib/__tests__/analyticsServer.test.ts`
- `src/lib/__tests__/scanAnalyticsHelpers.test.ts`

**Files Modified:**
- `src/lib/analyticsServer.ts`
- `src/app/api/analyze/route.ts`
- `src/app/api/quick-lookup/route.ts`
- `src/app/api/con-mode-lookup/route.ts`
- `src/app/api/import-lookup/route.ts`
- `src/app/api/comic-lookup/route.ts`
- `src/app/api/admin/usage/route.ts`
- `src/app/admin/usage/page.tsx`
- `src/app/api/admin/usage/check-alerts/route.ts`

---

### Task 1: Create `scan_analytics` Migration

**Files:**
- Create: `supabase/migrations/20260301_scan_analytics.sql`

**Step 1: Write the migration SQL**

```sql
-- Scan analytics table for cost tracking and performance monitoring
CREATE TABLE IF NOT EXISTS scan_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id text,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  scan_method text NOT NULL DEFAULT 'camera',
  estimated_cost_cents numeric NOT NULL DEFAULT 0,
  ai_calls_made integer NOT NULL DEFAULT 0,
  metadata_cache_hit boolean NOT NULL DEFAULT false,
  ebay_lookup boolean NOT NULL DEFAULT false,
  duration_ms integer NOT NULL DEFAULT 0,
  success boolean NOT NULL DEFAULT true,
  subscription_tier text NOT NULL DEFAULT 'guest',
  error_type text
);

-- Composite index for date-range aggregation (primary query pattern)
CREATE INDEX idx_scan_analytics_scanned_at ON scan_analytics (scanned_at);

-- Index for per-user queries with date filtering
CREATE INDEX idx_scan_analytics_profile ON scan_analytics (profile_id, scanned_at);

-- RLS: admin-only read, service role insert
ALTER TABLE scan_analytics ENABLE ROW LEVEL SECURITY;

-- No select policy for regular users — only service role can read
-- Admin read access handled via supabaseAdmin in API routes

-- Aggregate function for average cost (avoids fetching all rows)
CREATE OR REPLACE FUNCTION get_avg_scan_cost(since timestamptz DEFAULT NULL)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(AVG(estimated_cost_cents), 0)
  FROM scan_analytics
  WHERE (since IS NULL OR scanned_at >= since);
$$;

-- Data retention note: ~1MB/year at 10K scans/month.
-- Revisit if scan volume exceeds 50K/month.
```

**Step 2: Run migration locally**

Run: `npx supabase db push` or apply via Supabase dashboard SQL editor.

**Step 3: Commit**

```bash
git add supabase/migrations/20260301_scan_analytics.sql
git commit -m "feat: add scan_analytics table for cost tracking"
```

---

### Task 2: Create Display Helpers + Tests

**Files:**
- Create: `src/lib/scanAnalyticsHelpers.ts`
- Create: `src/lib/__tests__/scanAnalyticsHelpers.test.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/scanAnalyticsHelpers.test.ts`:

```typescript
import { formatCents, getScanStatus } from "../scanAnalyticsHelpers";

describe("scanAnalyticsHelpers", () => {
  describe("formatCents", () => {
    it("formats zero cents", () => {
      expect(formatCents(0)).toBe("$0.00");
    });

    it("formats whole dollar amounts", () => {
      expect(formatCents(300)).toBe("$3.00");
    });

    it("formats fractional cents", () => {
      expect(formatCents(150)).toBe("$1.50");
    });

    it("formats large amounts", () => {
      expect(formatCents(12345)).toBe("$123.45");
    });
  });

  describe("getScanStatus", () => {
    it("returns ok when under 70%", () => {
      expect(getScanStatus(100, 300)).toBe("ok");
    });

    it("returns warning at 70%", () => {
      expect(getScanStatus(210, 300)).toBe("warning");
    });

    it("returns critical at 90%", () => {
      expect(getScanStatus(270, 300)).toBe("critical");
    });

    it("returns critical when over limit", () => {
      expect(getScanStatus(400, 300)).toBe("critical");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/scanAnalyticsHelpers.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/lib/scanAnalyticsHelpers.ts`:

```typescript
export function formatCents(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

export function getScanStatus(
  current: number,
  limit: number
): "ok" | "warning" | "critical" {
  const pct = current / limit;
  if (pct >= 0.9) return "critical";
  if (pct >= 0.7) return "warning";
  return "ok";
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/scanAnalyticsHelpers.test.ts`
Expected: All 8 tests PASS

**Step 5: Commit**

```bash
git add src/lib/scanAnalyticsHelpers.ts src/lib/__tests__/scanAnalyticsHelpers.test.ts
git commit -m "feat: add scan analytics display helpers with tests"
```

---

### Task 3: Write `recordScanAnalytics` Helper + Tests

**Files:**
- Modify: `src/lib/analyticsServer.ts` (add new function after existing code)
- Create: `src/lib/__tests__/analyticsServer.test.ts`

**Step 1: Write the test for existing `estimateScanCostCents`**

Create `src/lib/__tests__/analyticsServer.test.ts`:

```typescript
import { estimateScanCostCents } from "../analyticsServer";

describe("estimateScanCostCents", () => {
  it("returns base cost for a simple scan with no extras", () => {
    const cost = estimateScanCostCents({
      metadataCacheHit: false,
      aiCallsMade: 1,
      ebayLookup: false,
    });
    // 1 AI call = INITIAL_SCAN_COST = 1.5 cents
    expect(cost).toBe(1.5);
  });

  it("adds verification cost for additional AI calls", () => {
    const cost = estimateScanCostCents({
      metadataCacheHit: false,
      aiCallsMade: 2,
      ebayLookup: false,
    });
    // 1.5 + 0.6 = 2.1 cents
    expect(cost).toBe(2.1);
  });

  it("adds eBay lookup cost", () => {
    const cost = estimateScanCostCents({
      metadataCacheHit: false,
      aiCallsMade: 1,
      ebayLookup: true,
    });
    // 1.5 + 0.15 = 1.65 cents
    expect(cost).toBe(1.65);
  });

  it("returns zero cost on cache hit with no AI calls", () => {
    const cost = estimateScanCostCents({
      metadataCacheHit: true,
      aiCallsMade: 0,
      ebayLookup: false,
    });
    expect(cost).toBe(0);
  });

  it("handles full scan with all costs", () => {
    const cost = estimateScanCostCents({
      metadataCacheHit: false,
      aiCallsMade: 3,
      ebayLookup: true,
    });
    // 1.5 + (2 * 0.6) + 0.15 = 2.85 cents
    expect(cost).toBe(2.85);
  });
});
```

**Step 2: Run test to verify it passes** (testing existing code)

Run: `npm test -- src/lib/__tests__/analyticsServer.test.ts`
Expected: All 5 tests PASS

**Step 3: Write the `recordScanAnalytics` function**

Add to `src/lib/analyticsServer.ts` after the existing `trackScanServer` function.

**IMPORTANT:** Use the shared `supabaseAdmin` singleton from `@/lib/supabase` — do NOT create a new client. This matches every other DB helper in the codebase (`db.ts`, `followDb.ts`, `auctionDb.ts`, etc.).

```typescript
import { supabaseAdmin } from "@/lib/supabase";

// --- Scan Analytics (Supabase) ---

export interface ScanAnalyticsRecord {
  profile_id: string | null;
  scan_method: string;
  estimated_cost_cents: number;
  ai_calls_made: number;
  metadata_cache_hit: boolean;
  ebay_lookup: boolean;
  duration_ms: number;
  success: boolean;
  subscription_tier: string;
  error_type?: string | null;
}

export async function recordScanAnalytics(
  record: ScanAnalyticsRecord
): Promise<void> {
  try {
    await supabaseAdmin.from("scan_analytics").insert({
      profile_id: record.profile_id,
      scan_method: record.scan_method,
      estimated_cost_cents: record.estimated_cost_cents,
      ai_calls_made: record.ai_calls_made,
      metadata_cache_hit: record.metadata_cache_hit,
      ebay_lookup: record.ebay_lookup,
      duration_ms: record.duration_ms,
      success: record.success,
      subscription_tier: record.subscription_tier,
      error_type: record.error_type || null,
    });
  } catch (err) {
    console.error("Failed to record scan analytics:", err);
  }
}
```

**Step 4: Verify build compiles**

Run: `npm run build`
Expected: No type errors

**Step 5: Commit**

```bash
git add src/lib/analyticsServer.ts src/lib/__tests__/analyticsServer.test.ts
git commit -m "feat: add recordScanAnalytics helper with tests"
```

---

### Task 4: Wire Up All Anthropic-Calling Routes

**Files:**
- Modify: `src/app/api/analyze/route.ts`
- Modify: `src/app/api/quick-lookup/route.ts`
- Modify: `src/app/api/con-mode-lookup/route.ts`
- Modify: `src/app/api/import-lookup/route.ts`
- Modify: `src/app/api/comic-lookup/route.ts`

**Step 1: Wire up `/api/analyze` (primary scan route)**

At the top of `src/app/api/analyze/route.ts`, update the existing import:

```typescript
import { trackScanServer, estimateScanCostCents, recordScanAnalytics } from "@/lib/analyticsServer";
```

Find the block near line 1041 where `trackScanServer` is called. Add `recordScanAnalytics` **outside** the `if (profileId)` guard so guest scans are tracked too:

```typescript
// Record to scan_analytics table (fire-and-forget, tracks ALL users including guests)
recordScanAnalytics({
  profile_id: profileId || null,
  scan_method: "camera",
  estimated_cost_cents: costCents,
  ai_calls_made: aiCallsMade,
  metadata_cache_hit: metadataCacheHit,
  ebay_lookup: ebayLookupMade,
  duration_ms: scanDuration,
  success: true,
  subscription_tier: subscriptionTier || "guest",
}).catch((err) => {
  console.error("Scan analytics recording failed:", err);
});
```

**Also add a call in the catch block** (near lines 1060-1080) for failed scans. Failed scans still consume Anthropic credits:

```typescript
// In the catch block, record the failed scan
const failDuration = Date.now() - scanStartTime;
const failCostCents = estimateScanCostCents({
  metadataCacheHit: false,
  aiCallsMade,
  ebayLookup: ebayLookupMade,
});
recordScanAnalytics({
  profile_id: profileId || null,
  scan_method: "camera",
  estimated_cost_cents: failCostCents,
  ai_calls_made: aiCallsMade,
  metadata_cache_hit: false,
  ebay_lookup: ebayLookupMade,
  duration_ms: failDuration,
  success: false,
  subscription_tier: subscriptionTier || "guest",
  error_type: (error as Error)?.message?.substring(0, 100) || "unknown",
}).catch(() => {});
```

**Step 2: Wire up `/api/quick-lookup`**

Add import at top:
```typescript
import { recordScanAnalytics, estimateScanCostCents } from "@/lib/analyticsServer";
```

Find where the Anthropic API call is made (around line 172). After the successful response is built, add:

```typescript
const costCents = estimateScanCostCents({ metadataCacheHit: false, aiCallsMade: 1, ebayLookup: false });
recordScanAnalytics({
  profile_id: profileId || null,
  scan_method: "quick-lookup",
  estimated_cost_cents: costCents,
  ai_calls_made: 1,
  metadata_cache_hit: false,
  ebay_lookup: false,
  duration_ms: Date.now() - startTime,
  success: true,
  subscription_tier: subscriptionTier || "guest",
}).catch(() => {});
```

Add a `const startTime = Date.now();` at the top of the handler if one doesn't exist. Check what variables are available for `profileId` and `subscriptionTier` — adapt to match the route's existing auth pattern.

**Step 3: Wire up `/api/con-mode-lookup`**

Same pattern as quick-lookup, but note this route makes **2 Anthropic calls** (lines 174 and 341). Set `aiCallsMade` accordingly based on how many calls were actually made. Add a counter variable at the top of the handler.

**Step 4: Wire up `/api/import-lookup`**

Same pattern. This route makes 1 Anthropic call. Use `scan_method: "import-lookup"`.

**Step 5: Wire up `/api/comic-lookup`**

Same pattern. This route makes up to 2 Anthropic calls. Use `scan_method: "comic-lookup"`. Track the actual number of calls made.

**Step 6: Verify build**

Run: `npm run build`
Expected: No type errors

**Step 7: Commit**

```bash
git add src/app/api/analyze/route.ts src/app/api/quick-lookup/route.ts src/app/api/con-mode-lookup/route.ts src/app/api/import-lookup/route.ts src/app/api/comic-lookup/route.ts
git commit -m "feat: record scan analytics across all Anthropic-calling routes"
```

---

### Task 5: Add Scan Analytics Queries to Admin Usage API

**Files:**
- Modify: `src/app/api/admin/usage/route.ts`

**Step 1: Update imports**

The existing route creates its own Supabase client inline. Add `supabaseAdmin` from the shared singleton and `SupabaseClient` type to the existing `@supabase/supabase-js` import:

```typescript
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";
```

**Step 2: Add scan analytics query function**

Add this helper function before the GET handler:

```typescript
// Scan analytics aggregation
async function getScanAnalytics(supabase: SupabaseClient) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  // getDate() - getDay() can go negative (e.g., March 1 is a Wednesday → 1-3 = -2).
  // JavaScript's Date constructor handles this correctly by rolling back to the previous month.
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Use the earliest boundary as the query lower bound to avoid missing data
  // at month boundaries (e.g., weekStart can fall in the previous month on the 1st-6th)
  const queryStart = new Date(Math.min(
    new Date(monthStart).getTime(),
    new Date(weekStart).getTime(),
    new Date(sevenDaysAgo).getTime()
  )).toISOString();

  // Fetch scan records from the earliest boundary
  const { data: recentScans } = await supabase
    .from("scan_analytics")
    .select("estimated_cost_cents, ai_calls_made, metadata_cache_hit, ebay_lookup, duration_ms, success, scanned_at")
    .gte("scanned_at", queryStart)
    .order("scanned_at", { ascending: false });

  // Fetch 30-day count for total scans metric
  const { count: totalScans30d } = await supabase
    .from("scan_analytics")
    .select("*", { count: "exact", head: true })
    .gte("scanned_at", thirtyDaysAgo);

  // Use RPC for average cost (avoids fetching all rows)
  const { data: avgCostResult } = await supabase
    .rpc("get_avg_scan_cost", { since: ninetyDaysAgo });

  const allScans = recentScans || [];
  const todayScans = allScans.filter((s) => s.scanned_at >= todayStart);
  const weekScans = allScans.filter((s) => s.scanned_at >= weekStart);
  const monthScans = allScans.filter((s) => s.scanned_at >= monthStart);

  const sumCents = (arr: typeof allScans) =>
    arr.reduce((sum, s) => sum + Number(s.estimated_cost_cents), 0);

  const avgCost90d = Number(avgCostResult) || 0;

  // Projected monthly cost: use 7-day rolling average for stability
  const last7DayScans = allScans.filter((s) => s.scanned_at >= sevenDaysAgo);
  const last7DayCostCents = sumCents(last7DayScans);
  // Daily average over 7 days, projected to 30 days
  const projectedMonthlyCents = last7DayScans.length > 0
    ? Math.round((last7DayCostCents / 7) * 30)
    : null; // null signals "not enough data"

  // Calculate performance metrics from this month's scans
  const successCount = monthScans.filter((s) => s.success === true).length;
  const cacheHitCount = monthScans.filter((s) => s.metadata_cache_hit === true).length;
  const ebayCount = monthScans.filter((s) => s.ebay_lookup === true).length;
  const totalDuration = monthScans.reduce((sum, s) => sum + Number(s.duration_ms || 0), 0);
  const totalAiCalls = monthScans.reduce((sum, s) => sum + Number(s.ai_calls_made || 0), 0);

  return {
    costMetrics: {
      todaySpendCents: sumCents(todayScans),
      todayLimit: 300, // $3.00 in cents
      weekSpendCents: sumCents(weekScans),
      weekLimit: 1500, // $15.00 in cents
      monthSpendCents: sumCents(monthScans),
      avgCostCents: Math.round(avgCost90d * 100) / 100,
      projectedMonthlyCents,
    },
    performanceMetrics: {
      cacheHitRate: monthScans.length > 0 ? Math.round((cacheHitCount / monthScans.length) * 100) : 0,
      avgDurationMs: monthScans.length > 0 ? Math.round(totalDuration / monthScans.length) : 0,
      avgAiCalls: monthScans.length > 0 ? Math.round((totalAiCalls / monthScans.length) * 10) / 10 : 0,
      ebayLookupRate: monthScans.length > 0 ? Math.round((ebayCount / monthScans.length) * 100) : 0,
      successRate: monthScans.length > 0 ? Math.round((successCount / monthScans.length) * 100) : 0,
      totalScans30d: totalScans30d || 0,
    },
  };
}
```

**Step 3: Call it in the GET handler and add to response**

Find where the existing metrics array is built and the response is returned. Add:

```typescript
// After existing metrics are built:
let scanAnalytics = null;
try {
  scanAnalytics = await getScanAnalytics(supabaseAdmin);
} catch (err) {
  errors.push("Scan analytics: " + (err as Error).message);
}
```

Add `scanAnalytics` to the response object:

```typescript
return NextResponse.json({
  metrics,
  scanAnalytics,  // <-- ADD THIS
  errors: errors.length > 0 ? errors : undefined,
  overallStatus,
  thresholds: ALERT_THRESHOLDS,
  checkedAt: new Date().toISOString(),
});
```

**Step 4: Verify build**

Run: `npm run build`
Expected: No type errors

**Step 5: Commit**

```bash
git add src/app/api/admin/usage/route.ts
git commit -m "feat: add scan analytics aggregation to admin usage API"
```

---

### Task 6: Add Scan Analytics Section to Admin Usage Page

**Files:**
- Modify: `src/app/admin/usage/page.tsx`

**Step 1: Update the UsageData type**

Find the type/interface for the fetched data. Add the scan analytics shape:

```typescript
interface ScanAnalytics {
  costMetrics: {
    todaySpendCents: number;
    todayLimit: number;
    weekSpendCents: number;
    weekLimit: number;
    monthSpendCents: number;
    avgCostCents: number;
    projectedMonthlyCents: number | null;
  };
  performanceMetrics: {
    cacheHitRate: number;
    avgDurationMs: number;
    avgAiCalls: number;
    ebayLookupRate: number;
    successRate: number;
    totalScans30d: number;
  };
}
```

Add `scanAnalytics?: ScanAnalytics | null;` to the existing data type.

**Step 2: Add imports**

Add the import for display helpers:
```typescript
import { formatCents, getScanStatus } from "@/lib/scanAnalyticsHelpers";
```

Add any missing Lucide icons to the existing import. Check which are already imported and only add the missing ones from this list: `DollarSign, Clock, Calendar, CalendarDays, TrendingDown, TrendingUp, Zap, Timer, Cpu, Search, CheckCircle, BarChart3`.

Note: Use `Cpu` instead of `Bot` — it's more reliably available across Lucide versions and semantically fits "AI calls."

**Step 3: Add the Scan Analytics section**

After the existing metrics grid section (after the `</div>` that closes the metrics grid), add a new section. Follow the existing Lichtenstein styling: `comic-panel` class, `StatusBadge`, `ProgressBar` components.

**CRITICAL: The existing `ProgressBar` component expects `percentage` as a 0-1 decimal (it multiplies by 100 internally).** Pass raw ratios, NOT pre-multiplied percentages:

```tsx
{/* Scan Analytics Section */}
{data?.scanAnalytics && (
  <div className="mt-8">
    <h2 className="text-2xl font-bangers text-pop-blue mb-4 flex items-center gap-2">
      <DollarSign className="w-6 h-6" />
      Scan Cost Analytics
    </h2>

    {/* Cost Metrics */}
    <h3 className="text-lg font-bangers text-pop-red mb-2">Cost Metrics</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {/* Today's Spend */}
      <div className="comic-panel p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-pop-blue" />
            <span className="font-bold">Today&apos;s Spend</span>
          </div>
          <StatusBadge status={getScanStatus(data.scanAnalytics.costMetrics.todaySpendCents, data.scanAnalytics.costMetrics.todayLimit)} />
        </div>
        <p className="text-2xl font-bangers">
          {formatCents(data.scanAnalytics.costMetrics.todaySpendCents)}
          <span className="text-sm text-gray-500"> / {formatCents(data.scanAnalytics.costMetrics.todayLimit)}</span>
        </p>
        <ProgressBar
          percentage={Math.min(1, data.scanAnalytics.costMetrics.todaySpendCents / data.scanAnalytics.costMetrics.todayLimit)}
          status={getScanStatus(data.scanAnalytics.costMetrics.todaySpendCents, data.scanAnalytics.costMetrics.todayLimit)}
        />
      </div>

      {/* Week's Spend */}
      <div className="comic-panel p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-pop-blue" />
            <span className="font-bold">This Week&apos;s Spend</span>
          </div>
          <StatusBadge status={getScanStatus(data.scanAnalytics.costMetrics.weekSpendCents, data.scanAnalytics.costMetrics.weekLimit)} />
        </div>
        <p className="text-2xl font-bangers">
          {formatCents(data.scanAnalytics.costMetrics.weekSpendCents)}
          <span className="text-sm text-gray-500"> / {formatCents(data.scanAnalytics.costMetrics.weekLimit)}</span>
        </p>
        <ProgressBar
          percentage={Math.min(1, data.scanAnalytics.costMetrics.weekSpendCents / data.scanAnalytics.costMetrics.weekLimit)}
          status={getScanStatus(data.scanAnalytics.costMetrics.weekSpendCents, data.scanAnalytics.costMetrics.weekLimit)}
        />
      </div>

      {/* Month's Spend */}
      <div className="comic-panel p-4">
        <div className="flex items-center gap-2 mb-2">
          <CalendarDays className="w-5 h-5 text-pop-blue" />
          <span className="font-bold">This Month&apos;s Spend</span>
        </div>
        <p className="text-2xl font-bangers">{formatCents(data.scanAnalytics.costMetrics.monthSpendCents)}</p>
      </div>

      {/* Avg Cost Per Scan */}
      <div className="comic-panel p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="w-5 h-5 text-pop-blue" />
          <span className="font-bold">Avg Cost Per Scan</span>
        </div>
        <p className="text-2xl font-bangers">{data.scanAnalytics.costMetrics.avgCostCents.toFixed(1)}&cent;</p>
      </div>

      {/* Projected Monthly */}
      <div className="comic-panel p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-pop-blue" />
          <span className="font-bold">Projected Monthly</span>
        </div>
        <p className="text-2xl font-bangers">
          {data.scanAnalytics.costMetrics.projectedMonthlyCents !== null
            ? formatCents(data.scanAnalytics.costMetrics.projectedMonthlyCents)
            : "Calculating..."}
        </p>
      </div>
    </div>

    {/* Performance Metrics */}
    <h3 className="text-lg font-bangers text-pop-red mb-2">Performance Metrics</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Cache Hit Rate */}
      <div className="comic-panel p-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-5 h-5 text-pop-green" />
          <span className="font-bold">Cache Hit Rate</span>
        </div>
        <p className="text-2xl font-bangers">{data.scanAnalytics.performanceMetrics.cacheHitRate}%</p>
        <ProgressBar percentage={data.scanAnalytics.performanceMetrics.cacheHitRate / 100} status="ok" />
      </div>

      {/* Avg Scan Duration */}
      <div className="comic-panel p-4">
        <div className="flex items-center gap-2 mb-2">
          <Timer className="w-5 h-5 text-pop-green" />
          <span className="font-bold">Avg Scan Duration</span>
        </div>
        <p className="text-2xl font-bangers">{(data.scanAnalytics.performanceMetrics.avgDurationMs / 1000).toFixed(1)}s</p>
      </div>

      {/* AI Calls Per Scan */}
      <div className="comic-panel p-4">
        <div className="flex items-center gap-2 mb-2">
          <Cpu className="w-5 h-5 text-pop-green" />
          <span className="font-bold">AI Calls Per Scan</span>
        </div>
        <p className="text-2xl font-bangers">{data.scanAnalytics.performanceMetrics.avgAiCalls}</p>
      </div>

      {/* eBay Lookup Rate */}
      <div className="comic-panel p-4">
        <div className="flex items-center gap-2 mb-2">
          <Search className="w-5 h-5 text-pop-green" />
          <span className="font-bold">eBay Lookup Rate</span>
        </div>
        <p className="text-2xl font-bangers">{data.scanAnalytics.performanceMetrics.ebayLookupRate}%</p>
      </div>

      {/* Success Rate */}
      <div className="comic-panel p-4">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="w-5 h-5 text-pop-green" />
          <span className="font-bold">Success Rate</span>
        </div>
        <p className="text-2xl font-bangers">{data.scanAnalytics.performanceMetrics.successRate}%</p>
      </div>

      {/* Total Scans (30d) */}
      <div className="comic-panel p-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-5 h-5 text-pop-green" />
          <span className="font-bold">Total Scans (30d)</span>
        </div>
        <p className="text-2xl font-bangers">{data.scanAnalytics.performanceMetrics.totalScans30d}</p>
      </div>
    </div>
  </div>
)}
```

**Step 4: Verify build + manual test**

Run: `npm run build`
Then: Visit `http://localhost:3000/admin/usage` and verify the new section renders.

**Step 5: Commit**

```bash
git add src/app/admin/usage/page.tsx
git commit -m "feat: add scan cost analytics section to admin usage page"
```

---

### Task 7: Extend Check-Alerts with Scan Cost Thresholds

**Files:**
- Modify: `src/app/api/admin/usage/check-alerts/route.ts`

**Step 1: Add `supabaseAdmin` import**

The existing check-alerts route creates its own Supabase client inline (line 51: `const supabase = createClient(...)`). Add the shared singleton import so we can query `scan_analytics`:

```typescript
import { supabaseAdmin } from "@/lib/supabase";
```

**Step 2: Add scan cost alert checks**

Find where the existing alert checks are built (around lines 56-227). The existing array variable is named `alerts` (line 53: `const alerts: AlertMetric[] = [];`). Add two new checks after the existing ones:

```typescript
// --- Scan Cost Alerts (from scan_analytics table) ---
try {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  // getDate() - getDay() can produce negative values at month boundaries.
  // JavaScript Date handles this correctly, rolling back to the previous month.
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();

  // Today's scan spend
  const { data: todayScans } = await supabaseAdmin
    .from("scan_analytics")
    .select("estimated_cost_cents")
    .gte("scanned_at", todayStart);

  const todaySpendCents = (todayScans || []).reduce(
    (sum, s) => sum + Number(s.estimated_cost_cents), 0
  );
  const dailyLimitCents = 300; // $3.00

  if (todaySpendCents >= dailyLimitCents) {
    alerts.push({
      name: "Daily Scan Spend",
      current: todaySpendCents,
      limit: dailyLimitCents,
      percentage: todaySpendCents / dailyLimitCents,
      alertType: todaySpendCents >= dailyLimitCents * 1.5 ? "critical" : "warning",
    });
  }

  // This week's scan spend
  const { data: weekScans } = await supabaseAdmin
    .from("scan_analytics")
    .select("estimated_cost_cents")
    .gte("scanned_at", weekStart);

  const weekSpendCents = (weekScans || []).reduce(
    (sum, s) => sum + Number(s.estimated_cost_cents), 0
  );
  const weeklyLimitCents = 1500; // $15.00

  if (weekSpendCents >= weeklyLimitCents) {
    alerts.push({
      name: "Weekly Scan Spend",
      current: weekSpendCents,
      limit: weeklyLimitCents,
      percentage: weekSpendCents / weeklyLimitCents,
      alertType: weekSpendCents >= weeklyLimitCents * 1.5 ? "critical" : "warning",
    });
  }
} catch (err) {
  console.error("Scan cost alert check failed:", err);
}
```

**Step 3: Update email template for cost alerts**

Find where the email HTML body is built (look for where `alert.current` and `alert.limit` are interpolated). The existing `formatValue` function (around line 267) handles `name.includes("Cost")` but NOT `"Spend"`. Add this formatting BEFORE the HTML interpolation:

```typescript
// Detect cost metrics and format as dollars:
const isCostMetric = alert.name.includes("Spend");
const currentDisplay = isCostMetric
  ? "$" + (alert.current / 100).toFixed(2)
  : alert.current.toLocaleString();
const limitDisplay = isCostMetric
  ? "$" + (alert.limit / 100).toFixed(2)
  : alert.limit.toLocaleString();
```

Then use `currentDisplay` and `limitDisplay` in the email HTML instead of raw `alert.current` and `alert.limit`.

**Step 4: Verify build**

Run: `npm run build`
Expected: No type errors

**Step 5: Commit**

```bash
git add src/app/api/admin/usage/check-alerts/route.ts
git commit -m "feat: add scan cost threshold alerts to check-alerts route"
```

---

### Task 8: Run Full Quality Check + Manual Verification

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass, including new ones from Tasks 2 and 3

**Step 2: Run type check + lint**

Run: `npm run check`
Expected: No errors

**Step 3: Manual verification**

1. Scan a comic at `http://localhost:3000` (or mobile at `http://10.0.0.34:3000`)
2. Visit `http://localhost:3000/admin/usage`
3. Verify the new "Scan Cost Analytics" section appears below existing metrics
4. Verify cost metrics show the scan you just did (Today's Spend should be non-zero)
5. Verify performance metrics populate (cache hit rate, duration, AI calls)
6. Verify "Projected Monthly" shows "Calculating..." if insufficient data, or a dollar amount if enough data exists
7. Verify progress bars render correctly (not overflowing)
8. Check that the success rate reflects both successful and failed scans

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```
