import { NextRequest, NextResponse } from "next/server";

import { cronUnauthorized, verifyCronSecret } from "@/lib/cronAuth";
import {
  FeedbackEmailData,
  SendNotificationEmailParams,
  sendNotificationEmailsBatch,
} from "@/lib/email";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Cron job to send feedback reminder emails
 * Schedule: Daily
 * Sends reminders at 14 days (first) and 21 days (final) after transaction
 */
export async function POST(request: NextRequest) {
  // Verify cron secret (fail-closed, constant-time)
  if (!verifyCronSecret(request)) return cronUnauthorized();

  const results = { processed: 0, sent: 0, errors: 0 };

  try {
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const twentyOneDaysAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Find due reminders
    const { data: reminders, error: fetchError } = await supabaseAdmin
      .from("feedback_reminders")
      .select(
        `
        *,
        user:profiles!user_id (
          email,
          display_name,
          username
        )
      `
      )
      .is("feedback_left_at", null)
      .limit(100);

    if (fetchError) {
      console.error("[Cron] Failed to fetch reminders:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!reminders || reminders.length === 0) {
      return NextResponse.json({ message: "No reminders to process", results });
    }

    // Filter eligible reminders
    const eligibleReminders = reminders.filter((r) => {
      const createdAt = new Date(r.created_at);
      const lastReminder = r.last_reminder_at ? new Date(r.last_reminder_at) : null;

      // First reminder: 14+ days since creation, no reminders sent yet
      if (r.reminder_count === 0 && createdAt <= fourteenDaysAgo) {
        return true;
      }

      // Final reminder: 21+ days since creation, 7+ days since last reminder
      if (
        r.reminder_count === 1 &&
        createdAt <= twentyOneDaysAgo &&
        lastReminder &&
        lastReminder <= sevenDaysAgo
      ) {
        return true;
      }

      return false;
    });

    // Build one batch of emails instead of N sequential sends (M-EM6). This
    // keeps us under Resend's 10 req/sec rate limit and the Netlify function
    // timeout when many reminders come due on the same day.
    const emails: SendNotificationEmailParams[] = [];
    // Track which reminders to advance, grouped by their CURRENT count so we
    // can bump each group to count+1 in a single .in() update (avoids N+1).
    const firstReminderIds: string[] = []; // current reminder_count === 0 -> 1
    const finalReminderIds: string[] = []; // current reminder_count === 1 -> 2

    for (const reminder of eligibleReminders) {
      results.processed++;

      try {
        const transactionDetails = await getTransactionDetails(
          reminder.transaction_type,
          reminder.transaction_id,
          reminder.user_id
        );

        if (!transactionDetails) {
          console.warn(`[Cron] Transaction not found: ${reminder.transaction_id}`);
          continue;
        }

        const user = reminder.user as {
          email: string;
          display_name: string | null;
          username: string | null;
        };

        if (!user?.email) {
          console.warn(`[Cron] No email for user in reminder ${reminder.id}`);
          continue;
        }

        const emailData: FeedbackEmailData = {
          recipientName: user.display_name || user.username || "Collector",
          otherPartyName: transactionDetails.otherPartyName,
          transactionType: reminder.transaction_type,
          comicTitle: transactionDetails.comicTitle,
          issueNumber: transactionDetails.issueNumber,
          feedbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/feedback?txn=${reminder.transaction_id}&type=${reminder.transaction_type}`,
        };

        emails.push({
          to: user.email,
          type: "feedback_reminder",
          data: emailData,
          // Pass profileId so preference gating runs without an extra
          // email->profile lookup per recipient.
          profileId: reminder.user_id,
        });
        if (reminder.reminder_count === 0) {
          firstReminderIds.push(reminder.id);
        } else {
          finalReminderIds.push(reminder.id);
        }
      } catch (err) {
        console.error(`[Cron] Error processing reminder ${reminder.id}:`, err);
        results.errors++;
      }
    }

    if (emails.length > 0) {
      const batchResult = await sendNotificationEmailsBatch(emails);
      results.sent = batchResult.sent;
      results.errors += batchResult.errors.length;

      if (batchResult.errors.length > 0) {
        console.error("[Cron] Batch send errors:", batchResult.errors);
      }

      // Mark reminders as sent. We advance the reminder regardless of which
      // recipients Resend accepted: a transient per-address failure shouldn't
      // re-spam everyone on the next run, mirroring the prior single-send
      // semantics where any non-success simply skipped the row update.
      // Opted-out recipients are dropped inside the batch helper but their
      // reminder still advances so we don't keep re-evaluating them daily.
      // Two grouped updates instead of N per-row writes (count 0->1, 1->2).
      const nowIso = now.toISOString();
      const markUpdates: Array<PromiseLike<{ error: unknown }>> = [];
      if (firstReminderIds.length > 0) {
        markUpdates.push(
          supabaseAdmin
            .from("feedback_reminders")
            .update({ reminder_count: 1, last_reminder_at: nowIso })
            .in("id", firstReminderIds)
        );
      }
      if (finalReminderIds.length > 0) {
        markUpdates.push(
          supabaseAdmin
            .from("feedback_reminders")
            .update({ reminder_count: 2, last_reminder_at: nowIso })
            .in("id", finalReminderIds)
        );
      }
      const markResults = await Promise.all(markUpdates);
      for (const { error: markError } of markResults) {
        if (markError) console.error("[Cron] Failed to mark reminders as sent:", markError);
      }
    }

    return NextResponse.json({ message: "Feedback reminders processed", results });
  } catch (error) {
    console.error("[Cron] Fatal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET - Allow manual triggering for testing
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not allowed in production" }, { status: 403 });
  }

  // Forward to POST handler for testing
  return POST(request);
}

// Helper type for profile data from Supabase join
type ProfileData = { display_name: string | null; username: string | null } | null;

// Helper to extract profile data from Supabase join (handles array or object)
function extractProfile(data: unknown): ProfileData {
  if (!data) return null;
  if (Array.isArray(data)) {
    return data[0] as ProfileData;
  }
  return data as ProfileData;
}

// Helper to extract comic data from Supabase join
function extractComic(data: unknown): { title: string; issue_number: string } | null {
  if (!data) return null;
  if (Array.isArray(data)) {
    return data[0] as { title: string; issue_number: string } | null;
  }
  return data as { title: string; issue_number: string };
}

async function getTransactionDetails(
  type: string,
  transactionId: string,
  userId: string
): Promise<{ otherPartyName: string; comicTitle: string; issueNumber: string } | null> {
  if (type === "auction") {
    const { data: auction } = await supabaseAdmin
      .from("auctions")
      .select(
        `
        seller_id,
        winner_id,
        comic:comics (title, issue_number),
        seller:profiles!seller_id (display_name, username),
        buyer:profiles!winner_id (display_name, username)
      `
      )
      .eq("id", transactionId)
      .single();

    if (!auction) return null;

    const comic = extractComic(auction.comic);
    const isSeller = auction.seller_id === userId;
    const otherParty = isSeller ? extractProfile(auction.buyer) : extractProfile(auction.seller);

    return {
      otherPartyName: otherParty?.display_name || otherParty?.username || "the other party",
      comicTitle: comic?.title || "Comic",
      issueNumber: comic?.issue_number || "",
    };
  }

  if (type === "trade") {
    const { data: trade } = await supabaseAdmin
      .from("trades")
      .select(
        `
        proposer_id,
        recipient_id,
        proposer:profiles!proposer_id (display_name, username),
        recipient:profiles!recipient_id (display_name, username),
        trade_items (
          comics (title, issue_number)
        )
      `
      )
      .eq("id", transactionId)
      .single();

    if (!trade) return null;

    const isProposer = trade.proposer_id === userId;
    const otherParty = isProposer
      ? extractProfile(trade.recipient)
      : extractProfile(trade.proposer);

    const items = trade.trade_items as Array<{ comics: unknown }> | null;
    const firstComic = items?.[0]?.comics ? extractComic(items[0].comics) : null;

    return {
      otherPartyName: otherParty?.display_name || otherParty?.username || "the other party",
      comicTitle: firstComic?.title || "Comics",
      issueNumber: firstComic?.issue_number || "",
    };
  }

  return null;
}
