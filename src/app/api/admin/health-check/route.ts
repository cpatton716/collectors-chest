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
