# Finish Scan Resilience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete scan resilience deployment readiness — fallback rate alerting, provider health checks, frontend analytics enhancement, and deploy.

**Architecture:** Extends existing check-alerts cron with a fallback rate metric. Adds a standalone `/api/admin/health-check` route that probes each configured AI provider. Enhances PostHog `comic_scanned` event with provider/fallback data. Deploys scan cost dashboard + resilience code together.

**Tech Stack:** Next.js API routes, Supabase, Resend email, PostHog analytics, Anthropic/OpenAI SDKs

---

### Task 1: Add Fallback Rate Alert to check-alerts

**Files:**
- Modify: `src/app/api/admin/usage/check-alerts/route.ts`
- Test: `src/app/api/admin/usage/__tests__/check-alerts-fallback.test.ts`

**Step 1: Write the failing test**

Create `src/app/api/admin/usage/__tests__/check-alerts-fallback.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// We'll test the fallback rate calculation logic as a pure function
// Extract it from the route for testability

import {
  calculateFallbackRate,
  FALLBACK_THRESHOLDS,
} from "../check-alerts/fallbackRate";

describe("calculateFallbackRate", () => {
  it("returns null when no scans in period", () => {
    const result = calculateFallbackRate({ total: 0, fallbackCount: 0 });
    expect(result).toBeNull();
  });

  it("returns no alert when fallback rate is below warning threshold", () => {
    const result = calculateFallbackRate({ total: 100, fallbackCount: 5 });
    expect(result).toBeNull();
  });

  it("returns warning when fallback rate >= 10%", () => {
    const result = calculateFallbackRate({ total: 100, fallbackCount: 12 });
    expect(result).toEqual({
      name: "AI Fallback Rate (1h)",
      current: 12,
      limit: 100,
      percentage: 0.12,
      alertType: "warning",
    });
  });

  it("returns critical when fallback rate >= 25%", () => {
    const result = calculateFallbackRate({ total: 100, fallbackCount: 30 });
    expect(result).toEqual({
      name: "AI Fallback Rate (1h)",
      current: 30,
      limit: 100,
      percentage: 0.3,
      alertType: "critical",
    });
  });

  it("handles edge case at exactly warning threshold", () => {
    const result = calculateFallbackRate({ total: 10, fallbackCount: 1 });
    expect(result).toEqual({
      name: "AI Fallback Rate (1h)",
      current: 1,
      limit: 10,
      percentage: 0.1,
      alertType: "warning",
    });
  });
});

describe("FALLBACK_THRESHOLDS", () => {
  it("has warning at 10% and critical at 25%", () => {
    expect(FALLBACK_THRESHOLDS.warning).toBe(0.1);
    expect(FALLBACK_THRESHOLDS.critical).toBe(0.25);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/admin/usage/__tests__/check-alerts-fallback.test.ts`
Expected: FAIL — module not found

**Step 3: Write the fallback rate helper**

Create `src/app/api/admin/usage/check-alerts/fallbackRate.ts`:

```typescript
interface AlertMetric {
  name: string;
  current: number;
  limit: number;
  percentage: number;
  alertType: "warning" | "critical";
}

export const FALLBACK_THRESHOLDS = {
  warning: 0.1,
  critical: 0.25,
} as const;

interface FallbackCounts {
  total: number;
  fallbackCount: number;
}

export function calculateFallbackRate(
  counts: FallbackCounts
): AlertMetric | null {
  if (counts.total === 0) return null;

  const rate = counts.fallbackCount / counts.total;

  if (rate >= FALLBACK_THRESHOLDS.critical) {
    return {
      name: "AI Fallback Rate (1h)",
      current: counts.fallbackCount,
      limit: counts.total,
      percentage: rate,
      alertType: "critical",
    };
  }

  if (rate >= FALLBACK_THRESHOLDS.warning) {
    return {
      name: "AI Fallback Rate (1h)",
      current: counts.fallbackCount,
      limit: counts.total,
      percentage: rate,
      alertType: "warning",
    };
  }

  return null;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/admin/usage/__tests__/check-alerts-fallback.test.ts`
Expected: PASS — all 6 tests

**Step 5: Integrate into check-alerts route**

Add to `src/app/api/admin/usage/check-alerts/route.ts`:

1. Add import at top:
```typescript
import { calculateFallbackRate } from "./fallbackRate";
```

2. Add new check block after the scan cost alerts section (before the dedup/email section). Follow the existing try/catch pattern:
```typescript
// 7. Check AI fallback rate (last hour)
try {
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  const { count: totalScans } = await supabase
    .from("scan_analytics")
    .select("*", { count: "exact", head: true })
    .gte("scanned_at", oneHourAgo.toISOString());

  const { count: fallbackScans } = await supabase
    .from("scan_analytics")
    .select("*", { count: "exact", head: true })
    .gte("scanned_at", oneHourAgo.toISOString())
    .eq("fallback_used", true);

  const fallbackAlert = calculateFallbackRate({
    total: totalScans || 0,
    fallbackCount: fallbackScans || 0,
  });

  if (fallbackAlert) {
    alerts.push(fallbackAlert);
  }
} catch (e) {
  console.error("Error checking fallback rate:", e);
}
```

**Step 6: Run all tests**

Run: `npm test`
Expected: All tests pass (370 existing + 6 new)

**Step 7: Commit**

```bash
git add src/app/api/admin/usage/check-alerts/fallbackRate.ts src/app/api/admin/usage/__tests__/check-alerts-fallback.test.ts src/app/api/admin/usage/check-alerts/route.ts
git commit -m "feat: add fallback rate alerting to check-alerts cron"
```

---

### Task 2: Add Provider Health Check Route

**Files:**
- Create: `src/app/api/admin/health-check/route.ts`
- Create: `src/app/api/admin/health-check/probeProviders.ts`
- Test: `src/app/api/admin/health-check/__tests__/probeProviders.test.ts`

**Step 1: Write the failing test**

Create `src/app/api/admin/health-check/__tests__/probeProviders.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { probeProvider, buildHealthAlerts } from "../probeProviders";
import type { AIProvider } from "@/lib/providers/types";

// Mock provider that succeeds
function mockProvider(name: "anthropic" | "openai"): AIProvider {
  return {
    name,
    analyzeImage: vi.fn().mockResolvedValue({ title: "test" }),
    verifyAndEnrich: vi.fn().mockResolvedValue({}),
    estimatePrice: vi.fn().mockResolvedValue({}),
    estimateCostCents: vi.fn().mockReturnValue(0),
  } as unknown as AIProvider;
}

// Mock provider that fails
function failingProvider(
  name: "anthropic" | "openai",
  error: string
): AIProvider {
  return {
    name,
    analyzeImage: vi.fn().mockRejectedValue(new Error(error)),
    verifyAndEnrich: vi.fn().mockRejectedValue(new Error(error)),
    estimatePrice: vi.fn().mockRejectedValue(new Error(error)),
    estimateCostCents: vi.fn().mockReturnValue(0),
  } as unknown as AIProvider;
}

describe("probeProvider", () => {
  it("returns healthy for a working provider", async () => {
    const provider = mockProvider("anthropic");
    const result = await probeProvider(provider);
    expect(result.healthy).toBe(true);
    expect(result.provider).toBe("anthropic");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeNull();
  });

  it("returns unhealthy for a failing provider", async () => {
    const provider = failingProvider("anthropic", "403 Forbidden");
    const result = await probeProvider(provider);
    expect(result.healthy).toBe(false);
    expect(result.provider).toBe("anthropic");
    expect(result.error).toContain("403 Forbidden");
  });
});

describe("buildHealthAlerts", () => {
  it("returns empty array when all providers healthy", () => {
    const results = [
      { provider: "anthropic" as const, healthy: true, latencyMs: 200, error: null },
      { provider: "openai" as const, healthy: true, latencyMs: 300, error: null },
    ];
    expect(buildHealthAlerts(results)).toEqual([]);
  });

  it("returns critical alert when primary (anthropic) is down", () => {
    const results = [
      { provider: "anthropic" as const, healthy: false, latencyMs: 0, error: "403 Forbidden" },
    ];
    const alerts = buildHealthAlerts(results);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alertType).toBe("critical");
    expect(alerts[0].name).toContain("Anthropic");
  });

  it("returns warning alert when secondary (openai) is down", () => {
    const results = [
      { provider: "anthropic" as const, healthy: true, latencyMs: 200, error: null },
      { provider: "openai" as const, healthy: false, latencyMs: 0, error: "401 Unauthorized" },
    ];
    const alerts = buildHealthAlerts(results);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alertType).toBe("warning");
    expect(alerts[0].name).toContain("OpenAI");
  });

  it("returns critical when both providers down", () => {
    const results = [
      { provider: "anthropic" as const, healthy: false, latencyMs: 0, error: "500" },
      { provider: "openai" as const, healthy: false, latencyMs: 0, error: "500" },
    ];
    const alerts = buildHealthAlerts(results);
    expect(alerts).toHaveLength(2);
    expect(alerts.every((a) => a.alertType === "critical")).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/admin/health-check/__tests__/probeProviders.test.ts`
Expected: FAIL — module not found

**Step 3: Write the probe logic**

Create `src/app/api/admin/health-check/probeProviders.ts`:

```typescript
import type { AIProvider } from "@/lib/providers/types";

export interface ProbeResult {
  provider: "anthropic" | "openai";
  healthy: boolean;
  latencyMs: number;
  error: string | null;
}

interface AlertMetric {
  name: string;
  current: number;
  limit: number;
  percentage: number;
  alertType: "warning" | "critical";
}

/**
 * Probe a provider with a minimal analyzeImage call.
 * Uses a tiny base64 1x1 PNG to minimize cost (~0 tokens).
 */
export async function probeProvider(provider: AIProvider): Promise<ProbeResult> {
  const start = Date.now();
  try {
    // Minimal probe — send a tiny image and expect any response
    // Using a 1x1 white PNG (67 bytes)
    const tinyPng =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

    await provider.analyzeImage(
      {
        imageBase64: tinyPng,
        mediaType: "image/png",
        systemPrompt: "Respond with just the word: OK",
        userPrompt: "Health check probe. Respond with: OK",
        maxTokens: 5,
      },
      { signal: AbortSignal.timeout(10000) }
    );

    return {
      provider: provider.name,
      healthy: true,
      latencyMs: Date.now() - start,
      error: null,
    };
  } catch (err) {
    return {
      provider: provider.name,
      healthy: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message.slice(0, 200) : "Unknown error",
    };
  }
}

/**
 * Build alert metrics from probe results.
 * Primary provider (anthropic) down = critical.
 * Secondary provider (openai) down = warning.
 * Both down = both critical.
 */
export function buildHealthAlerts(results: ProbeResult[]): AlertMetric[] {
  const alerts: AlertMetric[] = [];

  for (const result of results) {
    if (result.healthy) continue;

    const isPrimary = result.provider === "anthropic";
    const displayName =
      result.provider === "anthropic" ? "Anthropic" : "OpenAI";

    alerts.push({
      name: `${displayName} Provider Health`,
      current: 0, // unhealthy
      limit: 1, // healthy
      percentage: 0,
      alertType: isPrimary ? "critical" : "warning",
    });
  }

  // If both providers are down, escalate secondary to critical too
  if (results.length > 1 && results.every((r) => !r.healthy)) {
    for (const alert of alerts) {
      alert.alertType = "critical";
    }
  }

  return alerts;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/admin/health-check/__tests__/probeProviders.test.ts`
Expected: PASS — all 6 tests

**Step 5: Write the API route**

Create `src/app/api/admin/health-check/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { getProviders } from "@/lib/aiProvider";
import { probeProvider, buildHealthAlerts } from "./probeProviders";
import type { ProbeResult } from "./probeProviders";

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || "chris@collectors-chest.com";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const providers = getProviders();

  if (providers.length === 0) {
    return NextResponse.json({
      status: "no_providers",
      message: "No AI providers configured",
    });
  }

  // Probe all configured providers in parallel
  const results: ProbeResult[] = await Promise.all(
    providers.map((p) => probeProvider(p))
  );

  // Build alerts for unhealthy providers
  const alerts = buildHealthAlerts(results);

  // Dedup: check if we already sent this alert today
  const today = new Date().toISOString().split("T")[0];
  const newAlerts = [];

  for (const alert of alerts) {
    const { data: existing } = await supabaseAdmin
      .from("usage_alerts")
      .select("id")
      .eq("metric_name", alert.name)
      .eq("alert_type", alert.alertType)
      .eq("sent_date", today)
      .single();

    if (!existing) {
      newAlerts.push(alert);
    }
  }

  // Send email for new alerts
  if (newAlerts.length > 0) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);

      const hasCritical = newAlerts.some((a) => a.alertType === "critical");
      const subject = hasCritical
        ? `🚨 CRITICAL: AI Provider Health Check Failed`
        : `⚠️ WARNING: AI Provider Health Check Issue`;

      const providerDetails = results
        .map(
          (r) => `
          <div style="padding: 12px; margin: 8px 0; background: ${r.healthy ? "#f0fdf4" : "#fef2f2"}; border-left: 4px solid ${r.healthy ? "#16a34a" : "#dc2626"}; border-radius: 4px;">
            <strong>${r.provider}</strong>: ${r.healthy ? "✅ Healthy" : "❌ Down"}
            ${r.latencyMs > 0 ? `(${r.latencyMs}ms)` : ""}
            ${r.error ? `<br/><span style="color: #6b7280; font-size: 13px;">${r.error}</span>` : ""}
          </div>`
        )
        .join("");

      await resend.emails.send({
        from: "Collector's Chest <alerts@collectors-chest.com>",
        to: ADMIN_EMAIL,
        subject,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: ${hasCritical ? "#dc2626" : "#d97706"};">
              ${hasCritical ? "🚨 Provider Health Alert" : "⚠️ Provider Health Warning"}
            </h1>
            <p>AI provider health check results:</p>
            ${providerDetails}
            <p style="margin-top: 16px;">
              <a href="https://collectors-chest.com/admin/usage"
                style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px;">
                View Dashboard
              </a>
            </p>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
              Automated health check from Collector's Chest.
            </p>
          </div>
        `,
      });

      // Record alerts to prevent re-sending
      for (const alert of newAlerts) {
        await supabaseAdmin.from("usage_alerts").insert({
          metric_name: alert.name,
          alert_type: alert.alertType,
          metric_value: alert.current,
          metric_limit: alert.limit,
          percentage: alert.percentage,
        });
      }
    } catch (emailErr) {
      console.error("Failed to send health check email:", emailErr);
    }
  }

  return NextResponse.json({
    status: alerts.length === 0 ? "healthy" : "degraded",
    results: results.map((r) => ({
      provider: r.provider,
      healthy: r.healthy,
      latencyMs: r.latencyMs,
      error: r.error,
    })),
    alertsSent: newAlerts.length,
  });
}
```

**Step 6: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 7: Commit**

```bash
git add src/app/api/admin/health-check/
git commit -m "feat: add standalone provider health check route with probe and alerting"
```

---

### Task 3: Enhance PostHog trackScan with Provider Data

**Files:**
- Modify: `src/components/PostHogProvider.tsx`
- Modify: `src/app/scan/page.tsx`
- Test: `src/components/__tests__/trackScan.test.ts`

**Step 1: Write the failing test**

Create `src/components/__tests__/trackScan.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

// Test the event payload builder (pure function, no PostHog dependency)
import { buildScanEventProps } from "../PostHogProvider";
import type { ScanResponseMeta } from "@/lib/providers/types";

describe("buildScanEventProps", () => {
  it("returns basic props when no meta provided", () => {
    const result = buildScanEventProps("upload", true);
    expect(result).toEqual({
      method: "upload",
      success: true,
      provider: undefined,
      fallbackUsed: undefined,
      fallbackReason: undefined,
    });
  });

  it("includes provider data when meta provided", () => {
    const meta: ScanResponseMeta = {
      provider: "anthropic",
      fallbackUsed: false,
      fallbackReason: null,
      confidence: "high",
      callDetails: {
        imageAnalysis: { provider: "anthropic", fallbackUsed: false },
        verification: null,
        priceEstimation: null,
      },
    };
    const result = buildScanEventProps("camera", true, meta);
    expect(result).toEqual({
      method: "camera",
      success: true,
      provider: "anthropic",
      fallbackUsed: false,
      fallbackReason: null,
    });
  });

  it("includes fallback reason when fallback was used", () => {
    const meta: ScanResponseMeta = {
      provider: "openai",
      fallbackUsed: true,
      fallbackReason: "timeout",
      confidence: "medium",
      callDetails: {
        imageAnalysis: { provider: "openai", fallbackUsed: true },
        verification: null,
        priceEstimation: null,
      },
    };
    const result = buildScanEventProps("upload", true, meta);
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe("timeout");
    expect(result.provider).toBe("openai");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/__tests__/trackScan.test.ts`
Expected: FAIL — `buildScanEventProps` not found

**Step 3: Add the helper and update trackScan**

In `src/components/PostHogProvider.tsx`, add the exported helper function (before the component):

```typescript
import type { ScanResponseMeta } from "@/lib/providers/types";

export function buildScanEventProps(
  method: "camera" | "upload" | "barcode",
  success: boolean,
  meta?: ScanResponseMeta
) {
  return {
    method,
    success,
    provider: meta?.provider,
    fallbackUsed: meta?.fallbackUsed,
    fallbackReason: meta?.fallbackReason,
  };
}
```

Then update the `trackScan` function in the context value to accept optional meta:

```typescript
trackScan: (
  method: "camera" | "upload" | "barcode",
  success: boolean,
  meta?: ScanResponseMeta
) => {
  posthog.capture("comic_scanned", buildScanEventProps(method, success, meta));
},
```

**Step 4: Update scan page to pass _meta to trackScan**

In `src/app/scan/page.tsx`, update the two `trackScan` calls:

Success path (around line 200):
```typescript
analytics.trackScan("upload", true, _meta);
```

Failure path (around line 211) stays unchanged:
```typescript
analytics.trackScan("upload", false);
```

**Step 5: Run test to verify it passes**

Run: `npm test -- src/components/__tests__/trackScan.test.ts`
Expected: PASS — all 3 tests

**Step 6: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 7: Commit**

```bash
git add src/components/PostHogProvider.tsx src/app/scan/page.tsx src/components/__tests__/trackScan.test.ts
git commit -m "feat: enhance PostHog scan tracking with provider and fallback data"
```

---

### Task 4: Quality Check and Deploy

**Files:**
- No new files

**Step 1: Run full quality check**

Run: `npm run check:full`
Expected: typecheck + lint + test + build all pass

**Step 2: Verify test count increased**

Run: `npm test`
Expected: ~385 tests passing (370 + ~15 new)

**Step 3: Deploy to Netlify**

Run: `netlify deploy --prod`
Expected: Successful deployment

Note: The system will run Anthropic-only until OpenAI API key is added later. The orchestrator logs a warning on startup but functions normally with a single provider.

**Step 4: Commit any documentation updates**

Update EVALUATION.md and DEV_LOG.md via close-up-shop workflow.
