import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

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

    return NextResponse.json({
      metrics,
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
