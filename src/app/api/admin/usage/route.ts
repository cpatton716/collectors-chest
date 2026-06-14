import { NextResponse } from "next/server";

import { SupabaseClient } from "@supabase/supabase-js";

import { getAdminProfile } from "@/lib/adminAuth";
import { cacheGet, cacheSet } from "@/lib/cache";
import { redis } from "@/lib/redis";
import { supabaseAdmin } from "@/lib/supabase";
import {
  ALERT_THRESHOLDS,
  SCAN_SPEND_LIMITS_CENTS,
  SERVICE_LIMITS,
  coverHaikuCostCents,
  coverHaikuKeys,
  earliestWindowStart,
  getUsageWindows,
  sumScanCostCents,
  thresholdStatus,
} from "@/lib/usageLimits";

interface UsageMetric {
  name: string;
  current: number;
  limit: number;
  unit: string;
  percentage: number;
  status: "ok" | "warning" | "critical";
  dashboard?: string;
}

// Cache the full (heavy) dashboard payload for a short window so repeated admin
// polls don't re-run every Supabase RPC / Netlify fetch on each load (M-AD5).
const CACHE_KEY = "admin-usage-dashboard";
const CACHE_TTL_SECONDS = 60;

// Scan analytics aggregation
async function getScanAnalytics(supabase: SupabaseClient) {
  const windows = getUsageWindows();
  const queryStart = earliestWindowStart(windows);
  const { thirtyDaysAgo, ninetyDaysAgo, sevenDaysAgo, monthStart, weekStart, todayStart } = windows;

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
  const monthScans = allScans.filter((s) => s.scanned_at >= monthStart);

  const avgCost90d = Number(avgCostResult) || 0;

  // Projected monthly cost: use 7-day rolling average for stability
  const last7DayScans = allScans.filter((s) => s.scanned_at >= sevenDaysAgo);
  const last7DayCostCents = sumScanCostCents(last7DayScans);
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
      todaySpendCents: sumScanCostCents(allScans, todayStart),
      todayLimit: SCAN_SPEND_LIMITS_CENTS.daily,
      weekSpendCents: sumScanCostCents(allScans, weekStart),
      weekLimit: SCAN_SPEND_LIMITS_CENTS.weekly,
      monthSpendCents: sumScanCostCents(allScans, monthStart),
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

async function buildUsagePayload() {
  const metrics: UsageMetric[] = [];
  const errors: string[] = [];

  // 1. Supabase Database Size + row counts
  try {
    // Get row counts upfront (reused for both size estimation and metrics)
    const [comicsResult, auctionsResult, profilesResult] = await Promise.all([
      supabaseAdmin.from("comics").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("auction_listings").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
    ]);

    const comicsCount = comicsResult.count || 0;
    const auctionsCount = auctionsResult.count || 0;
    const profilesCount = profilesResult.count || 0;

    // Get database size using pg_database_size
    const { data: sizeData, error: sizeError } = await supabaseAdmin.rpc("get_database_size");

    if (!sizeError && sizeData !== null) {
      const dbSizeBytes = sizeData;
      const percentage = dbSizeBytes / SERVICE_LIMITS.supabase.database;
      metrics.push({
        name: "Supabase Database",
        current: dbSizeBytes,
        limit: SERVICE_LIMITS.supabase.database,
        unit: "bytes",
        percentage,
        status: thresholdStatus(percentage),
        dashboard: "https://supabase.com/dashboard",
      });
    } else {
      // Fallback: estimate from table counts (already fetched above)
      // Rough estimate: ~5KB per comic with base64 image
      const estimatedSize = comicsCount * 5000 + auctionsCount * 1000;
      const percentage = estimatedSize / SERVICE_LIMITS.supabase.database;

      metrics.push({
        name: "Supabase Database (estimated)",
        current: estimatedSize,
        limit: SERVICE_LIMITS.supabase.database,
        unit: "bytes",
        percentage,
        status: thresholdStatus(percentage),
        dashboard: "https://supabase.com/dashboard",
      });
    }

    // Row count metrics (using already-fetched data)
    metrics.push({
      name: "Total Comics in DB",
      current: comicsCount,
      limit: 100000, // Arbitrary high limit for context
      unit: "rows",
      percentage: 0,
      status: "ok",
    });

    metrics.push({
      name: "Total User Profiles",
      current: profilesCount,
      limit: SERVICE_LIMITS.clerk.mau,
      unit: "users",
      percentage: profilesCount / SERVICE_LIMITS.clerk.mau,
      status: thresholdStatus(profilesCount / SERVICE_LIMITS.clerk.mau),
    });
  } catch (e) {
    errors.push(`Supabase: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  // 2. Upstash Redis Usage
  //
  // Read the daily command counter only -- do NOT incr it here. The dashboard
  // (and its pollers) writing to Redis on every load both inflated the metric
  // it's reporting and consumed quota. Real usage is tracked by the request
  // paths that legitimately touch Redis. (M-AD5)
  try {
    if (redis) {
      const today = new Date().toISOString().split("T")[0];
      const dailyKey = `usage:commands:${today}`;
      const commandCount = (await redis.get<number>(dailyKey)) || 0;

      const percentage = commandCount / SERVICE_LIMITS.upstash.commandsPerDay;
      metrics.push({
        name: "Upstash Redis (today)",
        current: commandCount,
        limit: SERVICE_LIMITS.upstash.commandsPerDay,
        unit: "commands",
        percentage,
        status: thresholdStatus(percentage),
        dashboard: "https://console.upstash.com",
      });
    }
  } catch (e) {
    errors.push(`Upstash: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  // 3. Scan spend (Anthropic/Gemini API usage) -- summed from scan_analytics
  //    estimated_cost_cents over the last 30 days rather than a comics-count
  //    proxy (M-AD3). This reflects actual per-call provider costs.
  try {
    const { thirtyDaysAgo } = getUsageWindows();

    const { data: scanRows, count: scanCount } = await supabaseAdmin
      .from("scan_analytics")
      .select("estimated_cost_cents", { count: "exact" })
      .gte("scanned_at", thirtyDaysAgo);

    const spendCents = sumScanCostCents(scanRows || []);
    const spendUsd = spendCents / 100;
    const budgetUsd = SERVICE_LIMITS.anthropic.monthlyBudget;
    const percentage = spendUsd / budgetUsd;

    metrics.push({
      name: "Scans (last 30 days)",
      current: scanCount || 0,
      limit: 1000, // Arbitrary threshold for context
      unit: "scans",
      percentage: 0,
      status: "ok",
    });

    metrics.push({
      name: "Estimated API Cost (30 days)",
      current: Math.round(spendUsd * 100) / 100,
      limit: budgetUsd,
      unit: "USD",
      percentage,
      status: thresholdStatus(percentage),
      dashboard: "https://console.anthropic.com",
    });
  } catch (e) {
    errors.push(`Scan metrics: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  // 4. Cover Search Cost (30 days) -- batch the per-day Redis reads into a
  //    single mget instead of 30 sequential GETs (M-AD4).
  try {
    if (redis) {
      const keys = coverHaikuKeys();
      const counts = (await redis.mget<(number | null)[]>(...keys)) ?? [];
      const totalHaikuCalls = counts.reduce<number>(
        (sum, c) => sum + (Number(c) || 0),
        0
      );
      const coverCostCents = coverHaikuCostCents(totalHaikuCalls);
      const coverPercentage = coverCostCents / SERVICE_LIMITS.coverSearch.monthlyBudgetCents;
      metrics.push({
        name: "Cover Search Cost (30d)",
        current: coverCostCents / 100,
        limit: SERVICE_LIMITS.coverSearch.monthlyBudgetCents / 100,
        unit: "USD",
        percentage: coverPercentage,
        status: thresholdStatus(coverPercentage),
      });
    }
  } catch (e) {
    errors.push(`Cover Search: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  // 5. Netlify Bandwidth
  try {
    const netlifyToken = process.env.NETLIFY_API_TOKEN;
    if (netlifyToken) {
      const accountRes = await fetch(
        "https://api.netlify.com/api/v1/accounts/695e636ba27a6f671da765b4/bandwidth",
        {
          headers: { Authorization: `Bearer ${netlifyToken}` },
          signal: AbortSignal.timeout(5000),
        }
      );
      if (accountRes.ok) {
        const bwData = await accountRes.json();
        const usedGB = (bwData.used || 0) / (1024 * 1024 * 1024);
        const limitGB = SERVICE_LIMITS.netlify.bandwidthGB;
        const percentage = usedGB / limitGB;
        metrics.push({
          name: "Netlify Bandwidth",
          current: Math.round(usedGB * 100) / 100,
          limit: limitGB,
          unit: "GB",
          percentage,
          status: thresholdStatus(percentage),
          dashboard: "https://app.netlify.com/teams/cpatton716/billing/usage",
        });
      }
    }
  } catch (e) {
    errors.push(`Netlify: ${e instanceof Error ? e.message : "Unknown error"}`);
  }

  // Calculate overall status
  const criticalCount = metrics.filter((m) => m.status === "critical").length;
  const warningCount = metrics.filter((m) => m.status === "warning").length;
  const overallStatus = criticalCount > 0 ? "critical" : warningCount > 0 ? "warning" : "ok";

  // Scan analytics aggregation
  let scanAnalytics = null;
  try {
    scanAnalytics = await getScanAnalytics(supabaseAdmin);
  } catch (err) {
    errors.push("Scan analytics: " + (err as Error).message);
  }

  return {
    metrics,
    scanAnalytics,
    errors: errors.length > 0 ? errors : undefined,
    overallStatus,
    thresholds: ALERT_THRESHOLDS,
    checkedAt: new Date().toISOString(),
  };
}

export async function GET() {
  try {
    // Check admin access using centralized helper
    const adminProfile = await getAdminProfile();
    if (!adminProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Serve a short-lived cached payload when available (M-AD5).
    const cached = await cacheGet<Awaited<ReturnType<typeof buildUsagePayload>>>(
      CACHE_KEY,
      "profile"
    );
    if (cached) {
      return NextResponse.json(cached);
    }

    const payload = await buildUsagePayload();

    // Fire-and-forget short TTL cache.
    cacheSet(CACHE_KEY, payload, "profile", CACHE_TTL_SECONDS);

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error fetching usage metrics:", error);
    return NextResponse.json({ error: "Failed to fetch usage metrics" }, { status: 500 });
  }
}
