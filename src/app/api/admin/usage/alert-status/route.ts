import { NextResponse } from "next/server";

import { getAdminProfile } from "@/lib/adminAuth";
import { cacheGet, cacheSet } from "@/lib/cache";
import { redis } from "@/lib/redis";
import { supabaseAdmin } from "@/lib/supabase";
import {
  ALERT_THRESHOLDS,
  SERVICE_LIMITS,
  getUsageWindows,
  sumScanCostCents,
} from "@/lib/usageLimits";

interface Alert {
  name: string;
  percentage: number;
  level: "warning" | "critical";
}

interface AlertStatusResponse {
  alertCount: number;
  alertLevel: "ok" | "warning" | "critical";
  alerts: Alert[];
}

const CACHE_KEY = "admin-alert-status";

// Safe default response for error cases
const SAFE_RESPONSE: AlertStatusResponse = {
  alertCount: 0,
  alertLevel: "ok",
  alerts: [],
};

/**
 * Lightweight polling endpoint for admin alert badge.
 * Checks key service metrics against thresholds.
 * Cached for 5 minutes via the "profile" prefix TTL.
 */
export async function GET() {
  try {
    // Auth check
    const adminProfile = await getAdminProfile();
    if (!adminProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Try cache first (profile prefix = 5 min TTL)
    const cached = await cacheGet<AlertStatusResponse>(CACHE_KEY, "profile");
    if (cached) {
      return NextResponse.json(cached);
    }

    // Calculate fresh alert status
    const alerts: Alert[] = [];

    // 1. Database size
    try {
      const { data: sizeData, error } = await supabaseAdmin.rpc("get_database_size");
      if (!error && sizeData !== null) {
        const percentage = sizeData / SERVICE_LIMITS.supabase.database;
        if (percentage >= ALERT_THRESHOLDS.critical) {
          alerts.push({ name: "Supabase Database", percentage, level: "critical" });
        } else if (percentage >= ALERT_THRESHOLDS.warning) {
          alerts.push({ name: "Supabase Database", percentage, level: "warning" });
        }
      }
    } catch {
      // Silently skip -- don't let one check break the endpoint
    }

    // 2. Redis daily commands (read-only; never incr here -- this is a polling
    //    badge endpoint and must not inflate the metric it reports).
    try {
      if (redis) {
        const today = new Date().toISOString().split("T")[0];
        const commandCount = (await redis.get<number>(`usage:commands:${today}`)) || 0;
        const percentage = commandCount / SERVICE_LIMITS.upstash.commandsPerDay;

        if (percentage >= ALERT_THRESHOLDS.critical) {
          alerts.push({ name: "Upstash Redis Commands", percentage, level: "critical" });
        } else if (percentage >= ALERT_THRESHOLDS.warning) {
          alerts.push({ name: "Upstash Redis Commands", percentage, level: "warning" });
        }
      }
    } catch {
      // Silently skip
    }

    // 3. Anthropic API cost (last 30 days) -- summed from actual
    //    scan_analytics estimated_cost_cents, not a comics-count proxy (M-AD3).
    try {
      const { thirtyDaysAgo } = getUsageWindows();

      const { data: scanRows } = await supabaseAdmin
        .from("scan_analytics")
        .select("estimated_cost_cents")
        .gte("scanned_at", thirtyDaysAgo);

      const estimatedCost = sumScanCostCents(scanRows || []) / 100;
      const percentage = estimatedCost / SERVICE_LIMITS.anthropic.monthlyBudget;

      if (percentage >= ALERT_THRESHOLDS.critical) {
        alerts.push({ name: "Anthropic API Cost", percentage, level: "critical" });
      } else if (percentage >= ALERT_THRESHOLDS.warning) {
        alerts.push({ name: "Anthropic API Cost", percentage, level: "warning" });
      }
    } catch {
      // Silently skip
    }

    // Build response
    const hasCritical = alerts.some((a) => a.level === "critical");
    const response: AlertStatusResponse = {
      alertCount: alerts.length,
      alertLevel: hasCritical ? "critical" : alerts.length > 0 ? "warning" : "ok",
      alerts,
    };

    // Cache for next 5 minutes (fire-and-forget)
    cacheSet(CACHE_KEY, response, "profile");

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in alert-status endpoint:", error);
    // Return safe default -- never break the polling client
    return NextResponse.json(SAFE_RESPONSE);
  }
}
