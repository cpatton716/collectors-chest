import { NextResponse } from "next/server";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";

import { Redis } from "@upstash/redis";

import { getAdminProfile } from "@/lib/adminAuth";

// Service limits (free tier thresholds)
const LIMITS = {
  supabase: {
    database: 500 * 1024 * 1024, // 500MB in bytes
    storage: 1024 * 1024 * 1024, // 1GB in bytes
  },
  upstash: {
    commandsPerDay: 10000,
  },
  clerk: {
    mau: 10000,
  },
  resend: {
    emailsPerMonth: 3000,
  },
  anthropic: {
    // No hard limit, but track spend
    warningThreshold: 5, // $5 remaining
  },
  coverSearch: {
    monthlyBudgetCents: 1000, // $10 budget
  },
  netlify: {
    bandwidthGB: 100, // Personal plan ~100GB/month
  },
};

// Alert thresholds (percentage of limit)
const ALERT_THRESHOLDS = {
  warning: 0.7, // 70%
  critical: 0.9, // 90%
};

interface UsageMetric {
  name: string;
  current: number;
  limit: number;
  unit: string;
  percentage: number;
  status: "ok" | "warning" | "critical";
  dashboard?: string;
}

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

export async function GET() {
  try {
    // Check admin access using centralized helper
    const adminProfile = await getAdminProfile();
    if (!adminProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const metrics: UsageMetric[] = [];
    const errors: string[] = [];

    // 1. Supabase Database Size
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Get row counts upfront (reused for both size estimation and metrics)
      const [comicsResult, auctionsResult, profilesResult] = await Promise.all([
        supabase.from("comics").select("*", { count: "exact", head: true }),
        supabase.from("auction_listings").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
      ]);

      const comicsCount = comicsResult.count || 0;
      const auctionsCount = auctionsResult.count || 0;
      const profilesCount = profilesResult.count || 0;

      // Get database size using pg_database_size
      const { data: sizeData, error: sizeError } = await supabase.rpc("get_database_size");

      if (!sizeError && sizeData !== null) {
        const dbSizeBytes = sizeData;
        const percentage = dbSizeBytes / LIMITS.supabase.database;
        metrics.push({
          name: "Supabase Database",
          current: dbSizeBytes,
          limit: LIMITS.supabase.database,
          unit: "bytes",
          percentage,
          status:
            percentage >= ALERT_THRESHOLDS.critical
              ? "critical"
              : percentage >= ALERT_THRESHOLDS.warning
                ? "warning"
                : "ok",
          dashboard: "https://supabase.com/dashboard",
        });
      } else {
        // Fallback: estimate from table counts (already fetched above)
        // Rough estimate: ~5KB per comic with base64 image
        const estimatedSize = comicsCount * 5000 + auctionsCount * 1000;
        const percentage = estimatedSize / LIMITS.supabase.database;

        metrics.push({
          name: "Supabase Database (estimated)",
          current: estimatedSize,
          limit: LIMITS.supabase.database,
          unit: "bytes",
          percentage,
          status:
            percentage >= ALERT_THRESHOLDS.critical
              ? "critical"
              : percentage >= ALERT_THRESHOLDS.warning
                ? "warning"
                : "ok",
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
        limit: LIMITS.clerk.mau,
        unit: "users",
        percentage: profilesCount / LIMITS.clerk.mau,
        status:
          profilesCount / LIMITS.clerk.mau >= ALERT_THRESHOLDS.critical
            ? "critical"
            : profilesCount / LIMITS.clerk.mau >= ALERT_THRESHOLDS.warning
              ? "warning"
              : "ok",
      });
    } catch (e) {
      errors.push(`Supabase: ${e instanceof Error ? e.message : "Unknown error"}`);
    }

    // 2. Upstash Redis Usage
    try {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });

      // Get info about the Redis instance
      // Note: Upstash doesn't expose daily command count via API
      // We'll track our own usage with a daily counter
      const today = new Date().toISOString().split("T")[0];
      const dailyKey = `usage:commands:${today}`;
      const commandCount = (await redis.get<number>(dailyKey)) || 0;

      // Increment for this request
      await redis.incr(dailyKey);
      await redis.expire(dailyKey, 86400 * 2); // Keep for 2 days

      const percentage = commandCount / LIMITS.upstash.commandsPerDay;
      metrics.push({
        name: "Upstash Redis (today)",
        current: commandCount,
        limit: LIMITS.upstash.commandsPerDay,
        unit: "commands",
        percentage,
        status:
          percentage >= ALERT_THRESHOLDS.critical
            ? "critical"
            : percentage >= ALERT_THRESHOLDS.warning
              ? "warning"
              : "ok",
        dashboard: "https://console.upstash.com",
      });
    } catch (e) {
      errors.push(`Upstash: ${e instanceof Error ? e.message : "Unknown error"}`);
    }

    // 3. Scan counts (Anthropic API usage proxy)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Get scans from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: recentScans } = await supabase
        .from("comics")
        .select("*", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo.toISOString());

      // ~$0.015 per scan
      const estimatedCost = (recentScans || 0) * 0.015;

      metrics.push({
        name: "Scans (last 30 days)",
        current: recentScans || 0,
        limit: 1000, // Arbitrary threshold
        unit: "scans",
        percentage: 0,
        status: "ok",
      });

      metrics.push({
        name: "Estimated API Cost (30 days)",
        current: estimatedCost,
        limit: 10, // $10 budget
        unit: "USD",
        percentage: estimatedCost / 10,
        status: estimatedCost >= 9 ? "critical" : estimatedCost >= 7 ? "warning" : "ok",
        dashboard: "https://console.anthropic.com",
      });
    } catch (e) {
      errors.push(`Scan metrics: ${e instanceof Error ? e.message : "Unknown error"}`);
    }

    // 4. Cover Search Cost (30 days)
    try {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });

      let totalHaikuCalls = 0;
      const now = new Date();
      for (let i = 0; i < 30; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const key = `usage:cover-haiku:${date.toISOString().split("T")[0]}`;
        const count = (await redis.get<number>(key)) || 0;
        totalHaikuCalls += count;
      }
      const coverCostCents = totalHaikuCalls * 0.2; // ~$0.002 per call
      const coverPercentage = coverCostCents / LIMITS.coverSearch.monthlyBudgetCents;
      metrics.push({
        name: "Cover Search Cost (30d)",
        current: coverCostCents / 100,
        limit: LIMITS.coverSearch.monthlyBudgetCents / 100,
        unit: "USD",
        percentage: coverPercentage,
        status:
          coverPercentage >= ALERT_THRESHOLDS.critical
            ? "critical"
            : coverPercentage >= ALERT_THRESHOLDS.warning
              ? "warning"
              : "ok",
      });
    } catch (e) {
      errors.push(`Cover Search: ${e instanceof Error ? e.message : "Unknown error"}`);
    }

    // Netlify Bandwidth
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
          const limitGB = LIMITS.netlify.bandwidthGB;
          const percentage = usedGB / limitGB;
          metrics.push({
            name: "Netlify Bandwidth",
            current: Math.round(usedGB * 100) / 100,
            limit: limitGB,
            unit: "GB",
            percentage,
            status:
              percentage >= ALERT_THRESHOLDS.critical
                ? "critical"
                : percentage >= ALERT_THRESHOLDS.warning
                  ? "warning"
                  : "ok",
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

    return NextResponse.json({
      metrics,
      scanAnalytics,
      errors: errors.length > 0 ? errors : undefined,
      overallStatus,
      thresholds: ALERT_THRESHOLDS,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching usage metrics:", error);
    return NextResponse.json({ error: "Failed to fetch usage metrics" }, { status: 500 });
  }
}
