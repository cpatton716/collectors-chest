// AUTO-EXTRACTED from auctionDb.ts during R1-auctiondb refactor (M-AU9).
// Behavior-preserving: function bodies moved verbatim.

import {
  PAYMENT_REMINDER_WINDOW_HOURS,
  calculatePaymentDeadline,
} from "@/types/auction";

import {
  sendNotificationEmail,
  sendNotificationEmailsBatch,
  getProfileForEmail,
  getListingComicData,
} from "../email";
import { mapWithConcurrency } from "../concurrency";
import {
  AuditEventInput,
  logAuctionAuditEvents,
} from "../auditLog";
import { createFeedbackReminders } from "../creatorCreditsDb";
import { supabase, supabaseAdmin } from "../supabase";
import { CRON_BATCH_LIMIT, formatDeadlineForEmail } from "./shared";
import { createNotification } from "./notifications";
import {
  handleRunnerUpForExpiredAuction,
  recordPaymentMissStrike,
} from "./secondChance";

// ============================================================================
// CRON / BACKGROUND PROCESSING
// ============================================================================


/**
 * Process ended auctions
 * Called by cron job every minute
 */
export async function processEndedAuctions(): Promise<{
  processed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let processed = 0;
  // Audit events accumulated across the batch. Flushed once at end to keep
  // this out of the per-auction hot path.
  const auditEvents: AuditEventInput[] = [];

  // Get active auctions that have ended (capped per tick — M-AU7). Join the
  // comic title/issue so the per-auction email path doesn't re-query it via
  // getListingComicData (M-EM3).
  const { data: endedAuctions, error } = await supabase
    .from("auctions")
    .select(
      "*, comics!auctions_comic_id_fkey(title, issue_number)"
    )
    .eq("status", "active")
    .lt("end_time", new Date().toISOString())
    .order("end_time", { ascending: true })
    .limit(CRON_BATCH_LIMIT);

  if (error) {
    return { processed: 0, errors: [error.message] };
  }

  for (const auction of endedAuctions || []) {
    try {
      // Get winning bid (zero bids → maybeSingle avoids PGRST116 noise)
      const { data: winningBid } = await supabase
        .from("bids")
        .select("*")
        .eq("auction_id", auction.id)
        .eq("is_winning", true)
        .maybeSingle();

      if (winningBid) {
        // Anchor the 48h payment window to auction.end_time, not the cron run
        // time - cron lag (5-10 min typical, but observed up to ~3h42m on
        // Apr 24, 2026) would otherwise stretch the marketed "48h from
        // auction close" window proportionally.
        const paymentDeadline = calculatePaymentDeadline(
          new Date(auction.end_time)
        );

        // Idempotent guard: only transition from 'active' to 'ended'. If the
        // row is already in a finalized state (ended/sold/cancelled) because
        // this cron job already ran - or the auction row was tampered with -
        // skip notifications + emails. The extra `.eq("status", "active")`
        // makes the UPDATE a no-op when the row has already moved on, and
        // `.select()` lets us detect that via row count.
        // supabaseAdmin: cron runs with no user context; anon client would be blocked by RLS.
        const { data: updatedRows } = await supabaseAdmin
          .from("auctions")
          .update({
            status: "ended",
            winner_id: winningBid.bidder_id,
            winning_bid: winningBid.bid_amount,
            payment_status: "pending",
            payment_deadline: paymentDeadline.toISOString(),
            ended_at: new Date().toISOString(),
          })
          .eq("id", auction.id)
          .eq("status", "active")
          .select("id");

        if (!updatedRows || updatedRows.length === 0) {
          // Another concurrent run already ended this auction - don't re-notify.
          console.warn(`[processEndedAuctions] Skipping ${auction.id}: already finalized.`);
          continue;
        }

        const winnerId = winningBid.bidder_id;

        // Notify winner (in-app) + send auction_won email
        await createNotification(winnerId, "won", auction.id);

        // Notify seller (in-app) + send auction_sold email
        await createNotification(auction.seller_id, "auction_sold", auction.id);

        // Fire-and-forget emails for winner + seller. Comic title/issue come
        // from the joined candidate row (M-EM3) instead of a per-auction
        // getListingComicData round-trip.
        const joinedComic = (auction.comics as
          | { title?: string | null; issue_number?: string | null }
          | null) ?? null;
        const comicData = joinedComic
          ? {
              comicTitle: joinedComic.title || "Unknown",
              issueNumber: joinedComic.issue_number || "",
              price: Number(auction.starting_price) || 0,
            }
          : null;
        (async () => {
          const [winnerProfile, sellerProfile] = await Promise.all([
            getProfileForEmail(winnerId),
            getProfileForEmail(auction.seller_id),
          ]);
          if (!comicData) return;
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";
          const listingUrl = `${baseUrl}/shop?listing=${auction.id}`;
          const finalPrice = winningBid.bid_amount;

          if (winnerProfile?.email) {
            sendNotificationEmail({
              to: winnerProfile.email,
              type: "auction_won",
              data: {
                recipientName: winnerProfile.displayName ?? "there",
                comicTitle: comicData.comicTitle,
                issueNumber: comicData.issueNumber,
                finalPrice,
                listingUrl,
                paymentDeadline: formatDeadlineForEmail(paymentDeadline),
                transactionsUrl: `${baseUrl}/transactions?tab=wins`,
              },
            }).catch((err) => console.error("[Email] auction_won failed:", err));
          }

          if (sellerProfile?.email) {
            sendNotificationEmail({
              to: sellerProfile.email,
              type: "auction_sold",
              data: {
                recipientName: sellerProfile.displayName ?? "there",
                comicTitle: comicData.comicTitle,
                issueNumber: comicData.issueNumber,
                finalPrice,
                listingUrl,
              },
            }).catch((err) => console.error("[Email] auction_sold failed:", err));
          }
        })();

        // Notify losing bidders (distinct bidders excluding the winner).
        // Do this BEFORE the watcher loop so we can de-dupe - a bidder who
        // also watchlisted the auction gets the more specific
        // `bid_auction_lost` notification, not the generic `ended`.
        const alreadyNotified = new Set<string>();
        const { data: losingBidRows } = await supabase
          .from("bids")
          .select("bidder_id")
          .eq("auction_id", auction.id)
          .neq("bidder_id", winnerId);

        const losingBidders = new Set<string>();
        for (const row of losingBidRows || []) {
          if (row.bidder_id !== auction.seller_id) {
            losingBidders.add(row.bidder_id as string);
          }
        }
        for (const bidderId of losingBidders) {
          await createNotification(bidderId, "bid_auction_lost", auction.id);
          alreadyNotified.add(bidderId);
          auditEvents.push({
            auctionId: auction.id,
            actorProfileId: bidderId,
            eventType: "bid_lost",
            eventData: { winningBid: winningBid.bid_amount },
          });
        }

        // Notify watchers (excluding winner, seller, and anyone already
        // notified as a losing bidder)
        const { data: watchers } = await supabase
          .from("auction_watchlist")
          .select("user_id")
          .eq("auction_id", auction.id);

        for (const watcher of watchers || []) {
          const uid = watcher.user_id as string;
          if (uid === winnerId) continue;
          if (uid === auction.seller_id) continue;
          if (alreadyNotified.has(uid)) continue;
          await createNotification(uid, "ended", auction.id);
        }

        // Create feedback reminders for both parties
        await createFeedbackReminders("auction", auction.id, winnerId, auction.seller_id);

        // Audit trail - queue auction_ended + bid_won, flushed at end.
        auditEvents.push({
          auctionId: auction.id,
          actorProfileId: null,
          eventType: "auction_ended",
          eventData: {
            via: "cron_natural_end",
            winnerId,
            winningBid: winningBid.bid_amount,
            paymentDeadline: paymentDeadline.toISOString(),
          },
        });
        auditEvents.push({
          auctionId: auction.id,
          actorProfileId: winnerId,
          eventType: "bid_won",
          eventData: {
            winningBid: winningBid.bid_amount,
          },
        });
      } else {
        // No bids, just end it (admin: cron has no user context)
        await supabaseAdmin.from("auctions").update({ status: "ended" }).eq("id", auction.id);

        // Audit trail - no-bid auction expires as listing_expired.
        auditEvents.push({
          auctionId: auction.id,
          actorProfileId: null,
          eventType: "listing_expired",
          eventData: {
            via: "cron_natural_end",
            reason: "no_bids",
          },
        });
      }

      processed++;
    } catch (e) {
      errors.push(`Auction ${auction.id}: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  // Fire-and-forget batch audit flush - never blocks cron completion.
  void logAuctionAuditEvents(auditEvents);

  return { processed, errors };
}

// ============================================================================
// EXPIRATION FUNCTIONS (called by cron job)
// ============================================================================

/**
 * Expire old offers (48 hour expiration)
 * Also creates notifications and sends emails for expired offers
 */
export async function expireOffers(): Promise<{ expired: number; errors: string[] }> {
  const errors: string[] = [];

  // Get offers that need to expire. Comic data is fetched separately via
  // getListingComicData() below when building email payloads, so no join needed here.
  const { data: expiredOffers, error: fetchError } = await supabase
    .from("offers")
    .select("id, buyer_id, seller_id, listing_id, amount, status")
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true })
    .limit(CRON_BATCH_LIMIT);

  if (fetchError) {
    errors.push(`Failed to fetch expired offers: ${fetchError.message}`);
    return { expired: 0, errors };
  }

  if (!expiredOffers || expiredOffers.length === 0) {
    return { expired: 0, errors };
  }

  // Update offers to expired status
  const { error: updateError } = await supabase
    .from("offers")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .in(
      "id",
      expiredOffers.map((o) => o.id)
    );

  if (updateError) {
    errors.push(`Failed to update expired offers: ${updateError.message}`);
    return { expired: 0, errors };
  }

  // Audit trail - batch all offer_expired events.
  void logAuctionAuditEvents(
    expiredOffers.map((offer) => ({
      auctionId: offer.listing_id,
      offerId: offer.id,
      actorProfileId: null,
      eventType: "offer_expired" as const,
      eventData: { amount: offer.amount },
    }))
  );

  // Create notifications for expired offers
  for (const offer of expiredOffers) {
    try {
      // Notify buyer their offer expired
      await createNotification(offer.buyer_id, "offer_expired", offer.listing_id, offer.id);

      // Send offer_expired email (fire and forget)
      (async () => {
        const [recipientProfile, otherProfile, comicData] = await Promise.all([
          getProfileForEmail(offer.buyer_id),
          getProfileForEmail(offer.seller_id),
          getListingComicData(offer.listing_id),
        ]);
        if (recipientProfile?.email && comicData) {
          sendNotificationEmail({
            to: recipientProfile.email,
            type: "offer_expired",
            data: {
              buyerName: recipientProfile.displayName ?? "Buyer",
              sellerName: otherProfile?.displayName ?? "Seller",
              comicTitle: comicData.comicTitle,
              issueNumber: comicData.issueNumber,
              amount: offer.amount,
              listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${offer.listing_id}`,
            },
          }).catch((err) => console.error("[Email] offer_expired failed:", err));
        }
      })();
    } catch (err) {
      errors.push(`Failed to create notification for offer ${offer.id}: ${err}`);
    }
  }

  return { expired: expiredOffers.length, errors };
}

/**
 * Expire old fixed-price listings (30 day expiration)
 * Also creates notifications for expiring/expired listings
 */
export async function expireListings(): Promise<{
  expired: number;
  expiring: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const now = new Date();
  const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Get listings expiring within 24 hours (for warning notification)
  const { data: expiringListings } = await supabase
    .from("auctions")
    .select("id, seller_id")
    .eq("listing_type", "fixed_price")
    .eq("status", "active")
    .gt("expires_at", now.toISOString())
    .lt("expires_at", oneDayFromNow.toISOString())
    .order("expires_at", { ascending: true })
    .limit(CRON_BATCH_LIMIT);

  let expiringCount = 0;
  if (expiringListings && expiringListings.length > 0) {
    for (const listing of expiringListings) {
      try {
        // Check if we already sent expiring notification
        const { data: existingNotif } = await supabase
          .from("notifications")
          .select("id")
          .eq("auction_id", listing.id)
          .eq("type", "listing_expiring")
          .limit(1)
          .maybeSingle();

        if (!existingNotif) {
          await createNotification(listing.seller_id, "listing_expiring", listing.id);
          // Send listing expiring email to seller (fire and forget)
          (async () => {
            const [sellerProfile, comicData] = await Promise.all([
              getProfileForEmail(listing.seller_id),
              getListingComicData(listing.id),
            ]);
            if (sellerProfile?.email && comicData) {
              sendNotificationEmail({
                to: sellerProfile.email,
                type: "listing_expiring",
                data: {
                  sellerName: sellerProfile.displayName,
                  comicTitle: comicData.comicTitle,
                  issueNumber: comicData.issueNumber,
                  price: comicData.price,
                  expiresIn: "within 24 hours",
                  listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${listing.id}`,
                },
              }).catch((err) => console.error("[Email] listing_expiring failed:", err));
            }
          })();
          expiringCount++;
        }
      } catch (err) {
        errors.push(`Failed to notify expiring listing ${listing.id}: ${err}`);
      }
    }
  }

  // Get listings that have expired
  const { data: expiredListings, error: fetchError } = await supabase
    .from("auctions")
    .select("id, seller_id")
    .eq("listing_type", "fixed_price")
    .eq("status", "active")
    .lt("expires_at", now.toISOString())
    .order("expires_at", { ascending: true })
    .limit(CRON_BATCH_LIMIT);

  if (fetchError) {
    errors.push(`Failed to fetch expired listings: ${fetchError.message}`);
    return { expired: 0, expiring: expiringCount, errors };
  }

  if (!expiredListings || expiredListings.length === 0) {
    return { expired: 0, expiring: expiringCount, errors };
  }

  // Update listings to cancelled status
  const { error: updateError } = await supabase
    .from("auctions")
    .update({ status: "cancelled", updated_at: now.toISOString() })
    .in(
      "id",
      expiredListings.map((l) => l.id)
    );

  if (updateError) {
    errors.push(`Failed to update expired listings: ${updateError.message}`);
    return { expired: 0, expiring: expiringCount, errors };
  }

  // Audit trail - batch listing_expired events for fixed-price listings
  // that timed out after 30 days.
  void logAuctionAuditEvents(
    expiredListings.map((listing) => ({
      auctionId: listing.id,
      actorProfileId: null,
      eventType: "listing_expired" as const,
      eventData: { reason: "fixed_price_30_day_expiry" },
    }))
  );

  // Create notifications for expired listings
  for (const listing of expiredListings) {
    try {
      await createNotification(listing.seller_id, "listing_expired", listing.id);
      // Send listing expired email to seller (fire and forget)
      (async () => {
        const [sellerProfile, comicData] = await Promise.all([
          getProfileForEmail(listing.seller_id),
          getListingComicData(listing.id),
        ]);
        if (sellerProfile?.email && comicData) {
          sendNotificationEmail({
            to: sellerProfile.email,
            type: "listing_expired",
            data: {
              sellerName: sellerProfile.displayName,
              comicTitle: comicData.comicTitle,
              issueNumber: comicData.issueNumber,
              price: comicData.price,
              listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${listing.id}`,
            },
          }).catch((err) => console.error("[Email] listing_expired failed:", err));
        }
      })();
    } catch (err) {
      errors.push(`Failed to create notification for listing ${listing.id}: ${err}`);
    }
  }

  return { expired: expiredListings.length, expiring: expiringCount, errors };
}


// ============================================================================
// PAYMENT DEADLINE ENFORCEMENT (Gaps 1 + 3)
// ============================================================================

/**
 * Max parallel profile/comic-data lookups when preparing batched emails.
 * Keeps Supabase under 5 concurrent reads per cron tick.
 */
const EMAIL_PREP_CONCURRENCY = 5;
//
// Two cron passes work together to enforce the 48-hour payment window:
//
//   sendPaymentReminders()    fires once per auction at T-24h (or sooner,
//                             if the cron didn't run exactly at T-24h).
//                             Idempotency: auctions.payment_reminder_sent_at
//                             is stamped by a conditional UPDATE.
//
//   expireUnpaidAuctions()    fires after the deadline passes. Flips the
//                             auction to status='cancelled' and stamps
//                             payment_expired_at. Notifies BOTH parties
//                             so the seller knows they can re-list and
//                             the buyer knows they will not be charged.
//                             Idempotency: conditional UPDATE on the
//                             pre-expiry state (status='ended' +
//                             payment_status='pending' + payment_expired_at
//                             IS NULL) with .select() to detect 0-row updates
//                             from concurrent cron runs.
//
// Both use supabaseAdmin: cron has no user context, so anon+RLS writes
// would silently no-op (see Sessions 36–37 debugging lessons).

/**
 * Send a payment reminder to winners whose payment deadline is within
 * PAYMENT_REMINDER_WINDOW_HOURS and who haven't been reminded yet.
 *
 * Race-safe: stamps `payment_reminder_sent_at` via a conditional UPDATE
 * so duplicate cron runs cannot double-send.
 */
export async function sendPaymentReminders(): Promise<{
  reminded: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let reminded = 0;

  try {
    const now = new Date();
    const reminderWindowEnd = new Date(
      now.getTime() + PAYMENT_REMINDER_WINDOW_HOURS * 60 * 60 * 1000
    );

    // Fetch candidate auctions: ended, pending payment, deadline inside
    // the reminder window, and reminder not yet sent.
    const { data: candidates, error: fetchError } = await supabaseAdmin
      .from("auctions")
      .select("id, seller_id, winner_id, winning_bid, payment_deadline")
      .eq("status", "ended")
      .eq("payment_status", "pending")
      .gt("payment_deadline", now.toISOString())
      .lte("payment_deadline", reminderWindowEnd.toISOString())
      .is("payment_reminder_sent_at", null)
      .order("payment_deadline", { ascending: true })
      .limit(CRON_BATCH_LIMIT);

    if (fetchError) {
      errors.push(`Failed to fetch reminder candidates: ${fetchError.message}`);
      console.error("[sendPaymentReminders] fetch error:", fetchError);
      return { reminded: 0, errors };
    }

    if (!candidates || candidates.length === 0) {
      console.warn("[sendPaymentReminders] processed 0, skipped 0, errors 0");
      return { reminded: 0, errors };
    }

    let skipped = 0;

    // Phase 1: Conditional UPDATE per auction (race-safe). Must stay serial
    // so each auction is claimed atomically before we commit to sending.
    // We collect claimed auctions here and fan out notifications/emails
    // after the loop.
    const claimed: Array<{
      id: string;
      winner_id: string;
      winning_bid: number | null;
      payment_deadline: string;
    }> = [];

    for (const auction of candidates) {
      try {
        if (!auction.winner_id) {
          // Defensive: payment_status=pending on status=ended should imply a
          // winner, but skip gracefully if the DB is in a weird state.
          skipped++;
          continue;
        }

        if (!auction.payment_deadline) {
          // Can't send a reminder without a deadline.
          skipped++;
          continue;
        }

        // Conditional UPDATE: only stamp if reminder not already sent.
        // If another cron run beat us to it, select() returns 0 rows and
        // we skip the send.
        const { data: claimedRows, error: claimError } = await supabaseAdmin
          .from("auctions")
          .update({ payment_reminder_sent_at: new Date().toISOString() })
          .eq("id", auction.id)
          .is("payment_reminder_sent_at", null)
          .select("id");

        if (claimError) {
          errors.push(
            `Auction ${auction.id}: claim error ${claimError.message}`
          );
          continue;
        }

        if (!claimedRows || claimedRows.length === 0) {
          // Another invocation already sent the reminder.
          skipped++;
          continue;
        }

        claimed.push({
          id: auction.id,
          winner_id: auction.winner_id,
          winning_bid:
            auction.winning_bid != null ? Number(auction.winning_bid) : null,
          payment_deadline: auction.payment_deadline,
        });
        reminded++;
      } catch (loopErr) {
        errors.push(
          `Auction ${auction.id}: ${
            loopErr instanceof Error ? loopErr.message : "Unknown error"
          }`
        );
      }
    }

    // Phase 2: Batch-insert in-app notifications (one Supabase round-trip).
    let notificationsInserted = 0;
    if (claimed.length > 0) {
      const notificationRows = claimed.map((a) => ({
        user_id: a.winner_id,
        type: "payment_reminder" as const,
        title: "Payment reminder",
        message: "Payment is due soon for your won auction.",
        auction_id: a.id,
        offer_id: null,
      }));

      const { error: notifError } = await supabaseAdmin
        .from("notifications")
        .insert(notificationRows);

      if (notifError) {
        errors.push(`Batch notification insert failed: ${notifError.message}`);
        console.error(
          "[sendPaymentReminders] batch notification insert error:",
          notifError
        );
      } else {
        notificationsInserted = notificationRows.length;
      }
    }

    // Phase 3: Build email params in parallel (bounded), then send via
    // Resend batch API.
    let emailsSent = 0;
    let emailBatches = 0;
    if (claimed.length > 0) {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";

      const emailParamsOrNull = await mapWithConcurrency(
        claimed,
        EMAIL_PREP_CONCURRENCY,
        async (a) => {
          try {
            const [winnerProfile, comicData] = await Promise.all([
              getProfileForEmail(a.winner_id),
              getListingComicData(a.id),
            ]);

            if (!winnerProfile?.email || !comicData) {
              return null;
            }

            const deadlineDate = new Date(a.payment_deadline);
            const hoursRemaining = Math.max(
              0,
              Math.round(
                (deadlineDate.getTime() - new Date().getTime()) /
                  (60 * 60 * 1000)
              )
            );

            return {
              to: winnerProfile.email,
              type: "payment_reminder" as const,
              data: {
                recipientName: winnerProfile.displayName ?? "there",
                comicTitle: comicData.comicTitle,
                issueNumber: comicData.issueNumber,
                finalPrice:
                  a.winning_bid != null ? a.winning_bid : comicData.price,
                paymentDeadline: formatDeadlineForEmail(deadlineDate),
                hoursRemaining,
                listingUrl: `${baseUrl}/shop?listing=${a.id}`,
                transactionsUrl: `${baseUrl}/transactions?tab=wins`,
              },
            };
          } catch (err) {
            errors.push(
              `Auction ${a.id}: email prep failed ${String(err)}`
            );
            return null;
          }
        }
      );

      const emailParams = emailParamsOrNull.filter(
        (p): p is NonNullable<typeof p> => p != null
      );

      if (emailParams.length > 0) {
        const result = await sendNotificationEmailsBatch(emailParams);
        emailsSent = result.sent;
        emailBatches = result.batches;
        for (const e of result.errors) errors.push(e);
      }
    }

    console.warn(
      `[sendPaymentReminders] processed ${reminded}, skipped ${skipped}, ` +
        `sent ${notificationsInserted} notifications in ${
          notificationsInserted > 0 ? 1 : 0
        } batch, sent ${emailsSent} emails across ${emailBatches} batches, ` +
        `errors ${errors.length}`
    );
    return { reminded, errors };
  } catch (topLevelErr) {
    errors.push(
      `sendPaymentReminders top-level failure: ${String(topLevelErr)}`
    );
    console.error("[sendPaymentReminders] top-level failure:", topLevelErr);
    return { reminded, errors };
  }
}

// ===========================================================================
// Auction Ending Soon Reminder (T-1h to losing bidders)
// ---------------------------------------------------------------------------
// Cron-fired pass that nudges active bidders who placed a bid but are not
// currently winning. Primary re-engagement audience for auctions — most
// auction revenue happens in the final hour. Watchlist users (secondary)
// are NOT yet wired in; deferred to a follow-up.
//
// Idempotency: each auction's `reminder_sent_at` is conditionally stamped
// before fan-out. Duplicate cron runs cannot double-send.
// ===========================================================================

const ENDING_SOON_WINDOW_MINUTES = 60;

function formatTimeRemainingLabel(minutes: number): string {
  if (minutes <= 5) return "in just a few minutes";
  if (minutes <= 15) return "in about 15 minutes";
  if (minutes <= 30) return "in about half an hour";
  if (minutes <= 50) return "in about 45 minutes";
  return "in about an hour";
}

export async function sendAuctionEndingSoonReminders(): Promise<{
  reminded: number;
  notified: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let reminded = 0;
  let notified = 0;

  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + ENDING_SOON_WINDOW_MINUTES * 60 * 1000);

    const { data: candidates, error: fetchError } = await supabaseAdmin
      .from("auctions")
      .select("id, seller_id, current_bid, end_time")
      .eq("status", "active")
      .gt("end_time", now.toISOString())
      .lte("end_time", windowEnd.toISOString())
      .is("reminder_sent_at", null)
      .order("end_time", { ascending: true })
      .limit(CRON_BATCH_LIMIT);

    if (fetchError) {
      errors.push(`Failed to fetch ending-soon candidates: ${fetchError.message}`);
      return { reminded: 0, notified: 0, errors };
    }
    if (!candidates || candidates.length === 0) {
      return { reminded: 0, notified: 0, errors };
    }

    // Phase 1: claim each auction atomically.
    const claimed: Array<{
      id: string;
      seller_id: string;
      current_bid: number | null;
      end_time: string;
    }> = [];

    for (const auction of candidates) {
      try {
        const { data: claimedRows, error: claimError } = await supabaseAdmin
          .from("auctions")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", auction.id)
          .is("reminder_sent_at", null)
          .select("id");

        if (claimError) {
          errors.push(`Auction ${auction.id}: claim error ${claimError.message}`);
          continue;
        }
        if (!claimedRows || claimedRows.length === 0) continue;

        claimed.push({
          id: auction.id,
          seller_id: auction.seller_id,
          current_bid: auction.current_bid != null ? Number(auction.current_bid) : null,
          end_time: auction.end_time,
        });
        reminded++;
      } catch (loopErr) {
        errors.push(
          `Auction ${auction.id}: ${loopErr instanceof Error ? loopErr.message : String(loopErr)}`,
        );
      }
    }

    if (claimed.length === 0) return { reminded, notified, errors };

    // Phase 2: per-claimed-auction, find losing bidders. We need each
    // bidder's max_bid for the email. Bids table has one winning row per
    // auction (is_winning=true) plus losing rows; we want the latter,
    // grouped by bidder_id with their highest max_bid.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";

    // Aggregate work per auction — bounded concurrency so we don't fan out
    // hundreds of DB round-trips at once.
    const perAuctionWork = await mapWithConcurrency(
      claimed,
      EMAIL_PREP_CONCURRENCY,
      async (a) => {
        try {
          const { data: bidders } = await supabaseAdmin
            .from("bids")
            .select("bidder_id, max_bid")
            .eq("auction_id", a.id)
            .eq("is_winning", false);

          if (!bidders || bidders.length === 0) return null;

          // Dedupe by bidder_id taking max max_bid (handles multiple losing bids per user)
          const byBidder = new Map<string, number>();
          for (const b of bidders) {
            if (b.bidder_id === a.seller_id) continue; // never email seller
            const prev = byBidder.get(b.bidder_id);
            const next = Number(b.max_bid);
            if (prev == null || next > prev) byBidder.set(b.bidder_id, next);
          }
          if (byBidder.size === 0) return null;

          const comicData = await getListingComicData(a.id);
          if (!comicData) return null;

          // Batch-fetch every losing bidder's display fields in ONE query
          // instead of a getProfileForEmail round-trip per bidder. M-SO4.
          const bidderIds = Array.from(byBidder.keys());
          const { data: bidderProfiles } = await supabaseAdmin
            .from("profiles")
            .select("id, email, display_name, username")
            .in("id", bidderIds);
          const profileById = new Map<
            string,
            { email: string | null; displayName: string }
          >();
          for (const p of bidderProfiles ?? []) {
            profileById.set(p.id as string, {
              email: (p.email as string | null) ?? null,
              displayName:
                (p.display_name as string | null) ||
                (p.username as string | null) ||
                "Collector",
            });
          }

          const minutesRemaining = Math.max(
            1,
            Math.round((new Date(a.end_time).getTime() - Date.now()) / 60000),
          );
          const timeLabel = formatTimeRemainingLabel(minutesRemaining);

          // In-app notification rows + email param prep — built together to
          // avoid re-iterating bidders.
          const notificationRows: Array<{
            user_id: string;
            type: "auction_ending_soon_bidder";
            title: string;
            message: string;
            auction_id: string;
            offer_id: null;
          }> = [];
          const emailParams: Array<Parameters<typeof sendNotificationEmailsBatch>[0][number]> = [];

          for (const [bidderId, maxBid] of byBidder) {
            notificationRows.push({
              user_id: bidderId,
              type: "auction_ending_soon_bidder",
              title: "Auction ending soon",
              message: `${comicData.comicTitle} #${comicData.issueNumber} closes ${timeLabel}. You've been outbid.`,
              auction_id: a.id,
              offer_id: null,
            });

            const profile = profileById.get(bidderId);
            if (profile?.email) {
              emailParams.push({
                to: profile.email,
                type: "auction_ending_soon_bidder",
                data: {
                  recipientName: profile.displayName ?? "there",
                  comicTitle: comicData.comicTitle,
                  issueNumber: comicData.issueNumber,
                  currentBid: a.current_bid != null ? a.current_bid : comicData.price,
                  yourMaxBid: maxBid,
                  endTime: a.end_time,
                  timeRemainingLabel: timeLabel,
                  listingUrl: `${baseUrl}/shop?listing=${a.id}`,
                },
                profileId: bidderId,
              });
            }
          }

          return { notificationRows, emailParams };
        } catch (err) {
          errors.push(`Auction ${a.id}: ending-soon prep failed ${String(err)}`);
          return null;
        }
      },
    );

    const allNotificationRows = perAuctionWork.flatMap((w) => (w ? w.notificationRows : []));
    const allEmailParams = perAuctionWork.flatMap((w) => (w ? w.emailParams : []));

    // Phase 3: batch insert notifications.
    if (allNotificationRows.length > 0) {
      const { error: notifError } = await supabaseAdmin
        .from("notifications")
        .insert(allNotificationRows);
      if (notifError) {
        errors.push(`Batch notification insert failed: ${notifError.message}`);
      } else {
        notified = allNotificationRows.length;
      }
    }

    // Phase 4: batch send emails.
    if (allEmailParams.length > 0) {
      const result = await sendNotificationEmailsBatch(allEmailParams);
      for (const e of result.errors) errors.push(e);
    }

    console.warn(
      `[sendAuctionEndingSoonReminders] reminded=${reminded} notified=${notified} emails=${allEmailParams.length} errors=${errors.length}`,
    );
    return { reminded, notified, errors };
  } catch (topLevelErr) {
    errors.push(`sendAuctionEndingSoonReminders top-level failure: ${String(topLevelErr)}`);
    return { reminded, notified, errors };
  }
}


/**
 * Expire auctions whose 48-hour payment window has passed.
 *
 * Transitions status: 'ended' → 'cancelled'. Stamps payment_expired_at.
 * Notifies BOTH parties (winner and seller) so the seller knows they
 * can re-list and the winner knows they will not be charged.
 *
 * Race-safe: conditional UPDATE on the pre-expiry state. If another cron
 * invocation got there first, the UPDATE returns 0 rows and we skip all
 * side effects.
 *
 * Does NOT promote a second-highest bidder - that's out of scope (see
 * BACKLOG).
 */
export async function expireUnpaidAuctions(): Promise<{
  expired: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let expired = 0;

  try {
    const now = new Date();

    const { data: candidates, error: fetchError } = await supabaseAdmin
      .from("auctions")
      .select("id, seller_id, winner_id, winning_bid, payment_deadline, ended_at")
      .eq("status", "ended")
      .eq("payment_status", "pending")
      .lt("payment_deadline", now.toISOString())
      .is("payment_expired_at", null)
      .order("payment_deadline", { ascending: true })
      .limit(CRON_BATCH_LIMIT);

    if (fetchError) {
      errors.push(`Failed to fetch expiry candidates: ${fetchError.message}`);
      console.error("[expireUnpaidAuctions] fetch error:", fetchError);
      return { expired: 0, errors };
    }

    if (!candidates || candidates.length === 0) {
      console.warn("[expireUnpaidAuctions] processed 0, skipped 0, errors 0");
      return { expired: 0, errors };
    }

    let skipped = 0;

    // Phase 1: Conditional UPDATE per auction (race-safe). Must stay serial
    // so each auction is claimed atomically before we commit side effects.
    const claimed: Array<{
      id: string;
      seller_id: string;
      winner_id: string | null;
      winning_bid: number | null;
    }> = [];

    for (const auction of candidates) {
      try {
        // Conditional UPDATE: only flip if still in the pre-expiry state.
        // If a concurrent run beat us, select() returns 0 rows.
        const nowIso = new Date().toISOString();
        const { data: updatedRows, error: updateError } = await supabaseAdmin
          .from("auctions")
          .update({
            status: "cancelled",
            payment_expired_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", auction.id)
          .eq("status", "ended")
          .eq("payment_status", "pending")
          .is("payment_expired_at", null)
          .select("id");

        if (updateError) {
          errors.push(
            `Auction ${auction.id}: update error ${updateError.message}`
          );
          continue;
        }

        if (!updatedRows || updatedRows.length === 0) {
          skipped++;
          continue;
        }

        claimed.push({
          id: auction.id,
          seller_id: auction.seller_id,
          winner_id: auction.winner_id ?? null,
          winning_bid:
            auction.winning_bid != null ? Number(auction.winning_bid) : null,
        });
        expired++;
      } catch (loopErr) {
        errors.push(
          `Auction ${auction.id}: ${
            loopErr instanceof Error ? loopErr.message : "Unknown error"
          }`
        );
      }
    }

    // Audit trail - batch auction_payment_expired events for all claimed
    // auctions. Fire-and-forget so it never blocks the cron's user-visible
    // notifications/emails.
    if (claimed.length > 0) {
      void logAuctionAuditEvents(
        claimed.map((a) => ({
          auctionId: a.id,
          actorProfileId: null,
          eventType: "auction_payment_expired" as const,
          eventData: {
            winnerId: a.winner_id,
            winningBid: a.winning_bid,
          },
        }))
      );
    }

    // Phase 1.5: Per-auction "suppress seller cancellation" decision. If a
    // runner-up exists AND no second_chance_offers row has been created yet,
    // we'll defer the seller's cancellation messaging in favor of the
    // second_chance_available email fired in Phase 4. After the runner-up
    // flow has completed (offer accepted/declined/expired), a second_chance_
    // offers row exists and a subsequent expiry sends the cancellation
    // normally - covering the case where the runner-up accepted but didn't
    // pay within their own 48h window.
    //
    // Failure mode is "fail open": on error, we send the cancellation email.
    // A documented double-email is safer than silent loss.
    const suppressSellerCancellation = new Map<string, boolean>();
    if (claimed.length > 0) {
      await Promise.all(
        claimed.map(async (a) => {
          try {
            const suppress = await shouldSuppressSellerCancellationEmail(a.id);
            suppressSellerCancellation.set(a.id, suppress);
          } catch (err) {
            errors.push(
              `Auction ${a.id}: suppression check failed ${String(err)}`
            );
            suppressSellerCancellation.set(a.id, false);
          }
        })
      );
    }

    // Phase 2: Batch-insert notifications for BOTH parties in a single
    // Supabase round-trip.
    let notificationsInserted = 0;
    if (claimed.length > 0) {
      const notificationRows: Array<{
        user_id: string;
        type:
          | "auction_payment_expired"
          | "auction_payment_expired_seller";
        title: string;
        message: string;
        auction_id: string;
        offer_id: null;
      }> = [];

      for (const a of claimed) {
        if (a.winner_id) {
          notificationRows.push({
            user_id: a.winner_id,
            type: "auction_payment_expired",
            title: "Auction cancelled: payment window expired",
            message:
              "Your payment window has expired. The auction has been cancelled.",
            auction_id: a.id,
            offer_id: null,
          });
        }
        if (!suppressSellerCancellation.get(a.id)) {
          notificationRows.push({
            user_id: a.seller_id,
            type: "auction_payment_expired_seller",
            title: "Buyer did not pay in time",
            message:
              "The winning bidder did not pay within the 48-hour window. The auction has been cancelled and you may re-list the comic.",
            auction_id: a.id,
            offer_id: null,
          });
        }
      }

      if (notificationRows.length > 0) {
        const { error: notifError } = await supabaseAdmin
          .from("notifications")
          .insert(notificationRows);

        if (notifError) {
          errors.push(
            `Batch notification insert failed: ${notifError.message}`
          );
          console.error(
            "[expireUnpaidAuctions] batch notification insert error:",
            notifError
          );
        } else {
          notificationsInserted = notificationRows.length;
        }
      }
    }

    // Phase 3: Prep email params in parallel (bounded), then send via
    // Resend batch API. Up to two emails per auction (buyer + seller).
    let emailsSent = 0;
    let emailBatches = 0;
    if (claimed.length > 0) {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";

      type EmailParam = Parameters<typeof sendNotificationEmailsBatch>[0][number];

      const perAuctionEmails = await mapWithConcurrency(
        claimed,
        EMAIL_PREP_CONCURRENCY,
        async (a): Promise<EmailParam[]> => {
          try {
            const [winnerProfile, sellerProfile, comicData] = await Promise.all([
              a.winner_id
                ? getProfileForEmail(a.winner_id)
                : Promise.resolve(null),
              getProfileForEmail(a.seller_id),
              getListingComicData(a.id),
            ]);

            if (!comicData) return [];

            const finalPrice =
              a.winning_bid != null ? a.winning_bid : comicData.price;

            const out: EmailParam[] = [];

            if (winnerProfile?.email) {
              out.push({
                to: winnerProfile.email,
                type: "auction_payment_expired",
                data: {
                  recipientName: winnerProfile.displayName ?? "there",
                  comicTitle: comicData.comicTitle,
                  issueNumber: comicData.issueNumber,
                  finalPrice,
                  listingUrl: `${baseUrl}/shop`,
                },
              });
            }

            if (
              sellerProfile?.email &&
              !suppressSellerCancellation.get(a.id)
            ) {
              out.push({
                to: sellerProfile.email,
                type: "auction_payment_expired_seller",
                data: {
                  recipientName: sellerProfile.displayName ?? "there",
                  comicTitle: comicData.comicTitle,
                  issueNumber: comicData.issueNumber,
                  finalPrice,
                  listingUrl: `${baseUrl}/collection`,
                },
              });
            }

            return out;
          } catch (err) {
            errors.push(
              `Auction ${a.id}: email prep failed ${String(err)}`
            );
            return [];
          }
        }
      );

      const emailParams = perAuctionEmails.flat();

      if (emailParams.length > 0) {
        const result = await sendNotificationEmailsBatch(emailParams);
        emailsSent = result.sent;
        emailBatches = result.batches;
        for (const e of result.errors) errors.push(e);
      }
    }

    // Phase 4: Per-claimed-auction side effects - runner-up discovery +
    // payment-miss strike handling. Best-effort: side-effect failures must
    // never roll back the auction cancellation itself.
    if (claimed.length > 0) {
      for (const a of claimed) {
        try {
          await handleRunnerUpForExpiredAuction(a.id, a.seller_id);
        } catch (err) {
          errors.push(
            `Auction ${a.id}: runner-up lookup failed ${String(err)}`
          );
        }
        if (a.winner_id) {
          try {
            await recordPaymentMissStrike(
              a.winner_id,
              a.id,
              a.winning_bid ?? null
            );
          } catch (err) {
            errors.push(
              `Auction ${a.id}: strike handling failed ${String(err)}`
            );
          }
        }
      }
    }

    console.warn(
      `[expireUnpaidAuctions] processed ${expired}, skipped ${skipped}, ` +
        `sent ${notificationsInserted} notifications in ${
          notificationsInserted > 0 ? 1 : 0
        } batch, sent ${emailsSent} emails across ${emailBatches} batches, ` +
        `errors ${errors.length}`
    );
    return { expired, errors };
  } catch (topLevelErr) {
    errors.push(
      `expireUnpaidAuctions top-level failure: ${String(topLevelErr)}`
    );
    console.error("[expireUnpaidAuctions] top-level failure:", topLevelErr);
    return { expired, errors };
  }
}

/**
 * Decide whether to suppress the seller's "buyer did not pay, listing
 * cancelled" notification + email for a freshly cancelled auction.
 *
 * Returns true (suppress) iff:
 *   - a runner-up exists in the bids table, AND
 *   - no second_chance_offers row exists for this auction yet.
 *
 * The second_chance_available email/notification fired by Phase 4 covers
 * this case. Returns false in all other branches:
 *   - No runner-up → seller gets the standard cancellation messaging.
 *   - second_chance_offers row exists → we've already been through the
 *     runner-up flow once. A fresh expiry now means the runner-up accepted
 *     and didn't pay within their own 48h window, so the cancellation
 *     messaging is the right next signal for the seller.
 */
async function shouldSuppressSellerCancellationEmail(
  auctionId: string
): Promise<boolean> {
  const { data: existingOffer } = await supabaseAdmin
    .from("second_chance_offers")
    .select("id")
    .eq("auction_id", auctionId)
    .limit(1)
    .maybeSingle();
  if (existingOffer) return false;

  const { data: bids } = await supabaseAdmin
    .from("bids")
    .select("bidder_id")
    .eq("auction_id", auctionId)
    .order("bid_amount", { ascending: false })
    .order("created_at", { ascending: true });

  if (!bids || bids.length < 2) return false;

  const winnerBidderId = bids[0].bidder_id as string;
  return bids.some((b) => (b.bidder_id as string) !== winnerBidderId);
}
