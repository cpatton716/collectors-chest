import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

import { Redis } from "@upstash/redis";

import { Resend } from "resend";

import { supabaseAdmin } from "@/lib/supabase";
import { calculateFallbackRate, AlertMetric } from "./fallbackRate";

// This endpoint can be called by a cron job to check usage and send alerts
// Protected by a secret key in the request

const CRON_SECRET = process.env.CRON_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "chris@collectors-chest.com";

// Service limits
const LIMITS = {
  supabase: { database: 500 * 1024 * 1024 },
  upstash: { commandsPerDay: 10000 },
  anthropic: { monthlyBudget: 10 },
  coverSearch: {
    monthlyBudgetCents: 1000,
  },
  netlify: {
    bandwidthGB: 100,
  },
};

const ALERT_THRESHOLDS = {
  warning: 0.7,
  critical: 0.9,
};

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const alerts: AlertMetric[] = [];

    // 1. Check database size
    try {
      const { data: sizeData } = await supabase.rpc("get_database_size");
      if (sizeData !== null) {
        const percentage = sizeData / LIMITS.supabase.database;
        if (percentage >= ALERT_THRESHOLDS.critical) {
          alerts.push({
            name: "Supabase Database",
            current: sizeData,
            limit: LIMITS.supabase.database,
            percentage,
            alertType: "critical",
          });
        } else if (percentage >= ALERT_THRESHOLDS.warning) {
          alerts.push({
            name: "Supabase Database",
            current: sizeData,
            limit: LIMITS.supabase.database,
            percentage,
            alertType: "warning",
          });
        }
      }
    } catch (e) {
      console.error("Error checking database size:", e);
    }

    // 2. Check Redis usage
    try {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });

      const today = new Date().toISOString().split("T")[0];
      const dailyKey = `usage:commands:${today}`;
      const commandCount = (await redis.get<number>(dailyKey)) || 0;
      const percentage = commandCount / LIMITS.upstash.commandsPerDay;

      if (percentage >= ALERT_THRESHOLDS.critical) {
        alerts.push({
          name: "Upstash Redis Commands",
          current: commandCount,
          limit: LIMITS.upstash.commandsPerDay,
          percentage,
          alertType: "critical",
        });
      } else if (percentage >= ALERT_THRESHOLDS.warning) {
        alerts.push({
          name: "Upstash Redis Commands",
          current: commandCount,
          limit: LIMITS.upstash.commandsPerDay,
          percentage,
          alertType: "warning",
        });
      }
    } catch (e) {
      console.error("Error checking Redis usage:", e);
    }

    // 3. Check API costs (last 30 days)
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: recentScans } = await supabase
        .from("comics")
        .select("*", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo.toISOString());

      const estimatedCost = (recentScans || 0) * 0.015;
      const percentage = estimatedCost / LIMITS.anthropic.monthlyBudget;

      if (percentage >= ALERT_THRESHOLDS.critical) {
        alerts.push({
          name: "Anthropic API Cost",
          current: estimatedCost,
          limit: LIMITS.anthropic.monthlyBudget,
          percentage,
          alertType: "critical",
        });
      } else if (percentage >= ALERT_THRESHOLDS.warning) {
        alerts.push({
          name: "Anthropic API Cost",
          current: estimatedCost,
          limit: LIMITS.anthropic.monthlyBudget,
          percentage,
          alertType: "warning",
        });
      }
    } catch (e) {
      console.error("Error checking API costs:", e);
    }

    // 4. Check Cover Search cost (last 30 days)
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
      const coverCostCents = totalHaikuCalls * 0.2;
      const coverPercentage =
        coverCostCents / LIMITS.coverSearch.monthlyBudgetCents;

      if (coverPercentage >= ALERT_THRESHOLDS.critical) {
        alerts.push({
          name: "Cover Search Cost (30d)",
          current: coverCostCents / 100,
          limit: LIMITS.coverSearch.monthlyBudgetCents / 100,
          percentage: coverPercentage,
          alertType: "critical" as const,
        });
      } else if (coverPercentage >= ALERT_THRESHOLDS.warning) {
        alerts.push({
          name: "Cover Search Cost (30d)",
          current: coverCostCents / 100,
          limit: LIMITS.coverSearch.monthlyBudgetCents / 100,
          percentage: coverPercentage,
          alertType: "warning" as const,
        });
      }
    } catch (e) {
      console.error("Error checking cover search costs:", e);
    }

    // 5. Check Netlify Bandwidth
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
          const percentage = usedGB / LIMITS.netlify.bandwidthGB;

          if (percentage >= ALERT_THRESHOLDS.critical) {
            alerts.push({
              name: "Netlify Bandwidth",
              current: Math.round(usedGB * 100) / 100,
              limit: LIMITS.netlify.bandwidthGB,
              percentage,
              alertType: "critical" as const,
            });
          } else if (percentage >= ALERT_THRESHOLDS.warning) {
            alerts.push({
              name: "Netlify Bandwidth",
              current: Math.round(usedGB * 100) / 100,
              limit: LIMITS.netlify.bandwidthGB,
              percentage,
              alertType: "warning" as const,
            });
          }
        }
      }
    } catch (e) {
      console.error("Error checking Netlify bandwidth:", e);
    }

    // 6. Scan Cost Alerts (from scan_analytics table)
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

    // 7. Check AI fallback rate (last hour)
    try {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const { count: totalScans } = await supabaseAdmin
        .from("scan_analytics")
        .select("*", { count: "exact", head: true })
        .gte("scanned_at", oneHourAgo.toISOString());

      const { count: fallbackScans } = await supabaseAdmin
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

    // Filter out alerts we've already sent today
    const today = new Date().toISOString().split("T")[0];
    const newAlerts: AlertMetric[] = [];

    for (const alert of alerts) {
      const { data: existingAlert } = await supabase
        .from("usage_alerts")
        .select("id")
        .eq("metric_name", alert.name)
        .eq("alert_type", alert.alertType)
        .eq("sent_date", today)
        .single();

      if (!existingAlert) {
        newAlerts.push(alert);
      }
    }

    // Send email if there are new alerts
    if (newAlerts.length > 0) {
      const resend = new Resend(process.env.RESEND_API_KEY);

      const criticalAlerts = newAlerts.filter((a) => a.alertType === "critical");
      const warningAlerts = newAlerts.filter((a) => a.alertType === "warning");

      const subject =
        criticalAlerts.length > 0
          ? `🚨 CRITICAL: Collector's Chest - Service Limits Alert`
          : `⚠️ WARNING: Collector's Chest - Service Limits Alert`;

      const formatBytes = (bytes: number) => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
      };

      const formatValue = (value: number, name: string) => {
        if (name.includes("Database")) return formatBytes(value);
        if (name.includes("Spend")) return `$${(value / 100).toFixed(2)}`;
        if (name.includes("Cost")) return `$${value.toFixed(2)}`;
        return value.toLocaleString();
      };

      const alertHtml = `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: ${criticalAlerts.length > 0 ? "#dc2626" : "#d97706"};">
            ${criticalAlerts.length > 0 ? "🚨 Critical Alert" : "⚠️ Warning"}
          </h1>

          <p>The following service limits need attention:</p>

          ${newAlerts
            .map(
              (alert) => `
            <div style="padding: 16px; margin: 12px 0; background: ${alert.alertType === "critical" ? "#fef2f2" : "#fffbeb"}; border-left: 4px solid ${alert.alertType === "critical" ? "#dc2626" : "#d97706"}; border-radius: 4px;">
              <h3 style="margin: 0 0 8px 0; color: #111827;">${alert.name}</h3>
              <p style="margin: 0; color: #6b7280;">
                <strong>${formatValue(alert.current, alert.name)}</strong> of ${formatValue(alert.limit, alert.name)}
                (${(alert.percentage * 100).toFixed(1)}%)
              </p>
            </div>
          `
            )
            .join("")}

          <p style="margin-top: 24px;">
            <a href="https://collectors-chest.com/admin/usage"
               style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px;">
              View Dashboard
            </a>
          </p>

          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
            This is an automated alert from Collector's Chest monitoring.
          </p>
        </div>
      `;

      await resend.emails.send({
        from: "Collector's Chest <alerts@collectors-chest.com>",
        to: ADMIN_EMAIL,
        subject,
        html: alertHtml,
      });

      // Record the alerts as sent
      for (const alert of newAlerts) {
        await supabase.from("usage_alerts").insert({
          metric_name: alert.name,
          alert_type: alert.alertType,
          metric_value: alert.current,
          metric_limit: alert.limit,
          percentage: alert.percentage,
        });
      }
    }

    return NextResponse.json({
      checked: true,
      alertsFound: alerts.length,
      alertsSent: newAlerts.length,
      alerts: newAlerts.map((a) => ({
        name: a.name,
        type: a.alertType,
        percentage: `${(a.percentage * 100).toFixed(1)}%`,
      })),
    });
  } catch (error) {
    console.error("Error checking alerts:", error);
    return NextResponse.json({ error: "Failed to check alerts" }, { status: 500 });
  }
}
