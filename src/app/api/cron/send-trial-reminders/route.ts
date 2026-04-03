import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";
import { sendNotificationEmail } from "@/lib/email";

export async function POST(request: Request) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find users with trials expiring within 3 days who haven't been reminded
    // Filter: app-managed trials only (no Stripe subscription ID)
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const now = new Date();

    const { data: users, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, trial_ends_at")
      .eq("subscription_status", "trialing")
      .is("trial_reminder_sent_at", null)
      .is("stripe_subscription_id", null)
      .gt("trial_ends_at", now.toISOString())
      .lte("trial_ends_at", threeDaysFromNow.toISOString())
      .limit(100);

    if (fetchError) {
      console.error("[Trial Reminders] Query error:", fetchError);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, message: "No reminders to send", sent: 0 });
    }

    // Idempotency guard: mark ALL users as reminded BEFORE sending
    const userIds = users.map((u) => u.id);
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ trial_reminder_sent_at: new Date().toISOString() })
      .in("id", userIds);

    if (updateError) {
      console.error("[Trial Reminders] Update error:", updateError);
      return NextResponse.json({ error: "Failed to mark users" }, { status: 500 });
    }

    // Send emails (fire and forget per user)
    let sent = 0;
    let skipped = 0;

    for (const user of users) {
      if (!user.email) {
        skipped++;
        continue;
      }

      const trialEndsAt = new Date(user.trial_ends_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      sendNotificationEmail({
        to: user.email,
        type: "trial_expiring",
        data: { trialEndsAt },
      }).catch((err) => {
        console.error(`[Trial Reminders] Failed to send to ${user.email}:`, err);
      });

      sent++;
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${sent} trial reminders, skipped ${skipped} (no email)`,
      sent,
      skipped,
    });
  } catch (err) {
    console.error("[Trial Reminders] Unexpected error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
