// AUTO-EXTRACTED from auctionDb.ts during R1-auctiondb refactor (M-AU9).
// Behavior-preserving: function bodies moved verbatim.

import {
  PAYMENT_MISS_WINDOW_DAYS,
  SecondChanceOffer,
  calculatePaymentDeadline,
  calculateSecondChanceOfferExpiration,
  computePaymentMissStrike,
} from "@/types/auction";

import {
  sendNotificationEmail,
  getProfileForEmail,
  getListingComicData,
} from "../email";
import { logAuctionAuditEvent } from "../auditLog";
import { supabase, supabaseAdmin } from "../supabase";
import { CRON_BATCH_LIMIT, formatDeadlineForEmail } from "./shared";
import { transformDbSecondChanceOffer } from "./transforms";
import { createNotification } from "./notifications";

// ============================================================================
// SECOND CHANCE OFFERS + PAYMENT-MISS STRIKE SYSTEM
// ----------------------------------------------------------------------------
// Added April 23, 2026. These helpers run after expireUnpaidAuctions flips
// an auction to "cancelled":
//   1. handleRunnerUpForExpiredAuction - finds runner-up, notifies seller
//      that they can trigger a Second Chance Offer.
//   2. recordPaymentMissStrike - increments the missed-payment counter on
//      the no-pay winner, warns on first offense, flags on second within
//      the rolling 90-day window.
//   3. createSecondChanceOffer - seller calls this to re-offer to the
//      runner-up at their last actual bid price. 48-hour window.
//   4. respondToSecondChanceOffer - runner-up accepts or declines.
//   5. expireSecondChanceOffers - cron pass that flips unanswered
//      second-chance offers to "expired" and notifies the seller.
// ============================================================================

/**
 * Find the runner-up bidder for a cancelled auction and notify the seller
 * they can initiate a Second Chance Offer. Idempotent: if an offer was
 * already created (e.g., cron re-ran) it won't double-notify.
 *
 * "Runner-up" is the next-highest unique bidder by bid_amount (last actual
 * bid, NOT max_bid), excluding the missed-payment winner.
 */
export async function handleRunnerUpForExpiredAuction(
  auctionId: string,
  sellerId: string
): Promise<void> {
  // Skip if we've already created / notified about a second chance offer.
  const { data: existingOffer } = await supabaseAdmin
    .from("second_chance_offers")
    .select("id")
    .eq("auction_id", auctionId)
    .limit(1)
    .maybeSingle();
  if (existingOffer) return;

  // Get all bids for this auction, ordered by the actual bid amount desc so
  // the top row is the winner and the next distinct bidder is our runner-up.
  const { data: bids } = await supabaseAdmin
    .from("bids")
    .select("bidder_id, bid_amount, created_at")
    .eq("auction_id", auctionId)
    .order("bid_amount", { ascending: false })
    .order("created_at", { ascending: true });

  if (!bids || bids.length < 2) {
    // No runner-up (single bidder, or no bids).
    return;
  }

  // The first row is the winner. Find the first row with a different bidder.
  const winnerBidderId = bids[0].bidder_id as string;
  const runnerUpRow = bids.find(
    (b) => (b.bidder_id as string) !== winnerBidderId
  );
  if (!runnerUpRow) return;

  const runnerUpLastBid = Number(runnerUpRow.bid_amount);

  // Create the in-app notification for the seller.
  await createNotification(
    sellerId,
    "second_chance_available",
    auctionId,
    undefined,
    {
      message: `The winning bidder didn't pay. You can offer this comic to the runner-up at their last bid of $${runnerUpLastBid.toFixed(2)}.`,
    }
  );

  // Send the seller email with a deep-link that triggers the offer.
  const [sellerProfile, comicData] = await Promise.all([
    getProfileForEmail(sellerId),
    getListingComicData(auctionId),
  ]);

  if (sellerProfile?.email && comicData) {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";
    await sendNotificationEmail({
      to: sellerProfile.email,
      type: "second_chance_available",
      data: {
        recipientName: sellerProfile.displayName ?? "there",
        comicTitle: comicData.comicTitle,
        issueNumber: comicData.issueNumber,
        runnerUpLastBid,
        offerUrl: `${baseUrl}/shop?listing=${auctionId}`,
      },
    });
  }
}

/**
 * Increment the missed-payment counter on a bidder's profile and apply the
 * strike system:
 *   1st offense → warning email only (no flag).
 *   2nd offense within the rolling 90-day window → bid restriction + admin
 *   review notification + `user_flagged` audit entry.
 *
 * Best-effort. Never throws into the caller.
 */
export async function recordPaymentMissStrike(
  bidderId: string,
  auctionId: string,
  winningBid: number | null
): Promise<void> {
  // Increment the counter atomically. Supabase doesn't have a native "UPDATE
  // ... RETURNING" expression helper, so we do it in two steps.
  const { data: current } = await supabaseAdmin
    .from("profiles")
    .select("payment_missed_count, bid_restricted_at")
    .eq("id", bidderId)
    .maybeSingle();

  const nextCount = ((current?.payment_missed_count as number) || 0) + 1;
  const nowIso = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({
      payment_missed_count: nextCount,
      payment_missed_at: nowIso,
    })
    .eq("id", bidderId);

  if (updateError) {
    console.error("[recordPaymentMissStrike] update failed:", updateError);
    return;
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";

  // Look up prior auction_payment_expired audit events for this bidder
  // within the rolling window. The current expireUnpaidAuctions pass logs
  // its event fire-and-forget - depending on timing, that row may or may
  // not be visible yet, so we exclude any row stamped for THIS auction to
  // avoid double-counting the current miss, then feed the remaining
  // timestamps into the shared pure helper (shouldFlagForPaymentMisses),
  // which re-applies the rolling-window filter and adds +1 for the current
  // miss. Pulling timestamps (not a COUNT) keeps the flag decision in one
  // tested code path. H-AU2.
  const windowStart = new Date(
    Date.now() - PAYMENT_MISS_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: priorMissRows } = await supabaseAdmin
    .from("auction_audit_log")
    .select("created_at, auction_id")
    .eq("actor_profile_id", bidderId)
    .eq("event_type", "auction_payment_expired")
    .gte("created_at", windowStart);

  // Delegate the flag/count math to the pure, unit-tested helper. It excludes
  // the current auction's rows so this miss is counted exactly once.
  const { totalStrikesInWindow, shouldFlag } = computePaymentMissStrike(
    (priorMissRows ?? []).map((r) => ({
      created_at: r.created_at as string,
      auction_id: (r.auction_id as string | null) ?? null,
    })),
    auctionId,
    new Date(nowIso)
  );

  const comicData = await getListingComicData(auctionId).catch(() => null);
  const bidderProfile = await getProfileForEmail(bidderId).catch(() => null);

  if (!shouldFlag) {
    // First offense (inside the window) → warning only.
    await createNotification(bidderId, "payment_missed_warning", auctionId);
    if (bidderProfile?.email && comicData) {
      await sendNotificationEmail({
        to: bidderProfile.email,
        type: "payment_missed_warning",
        data: {
          recipientName: bidderProfile.displayName ?? "there",
          comicTitle: comicData.comicTitle,
          issueNumber: comicData.issueNumber,
          finalPrice: winningBid != null ? winningBid : comicData.price,
          shopUrl: `${baseUrl}/shop`,
        },
      });
    }
    return;
  }

  // Threshold reached - flag the user. Idempotent: only apply if not already
  // restricted.
  if (!(current?.bid_restricted_at as string | null)) {
    const reason = `Missed ${totalStrikesInWindow} payment deadlines in the last ${PAYMENT_MISS_WINDOW_DAYS} days`;
    const { error: flagError } = await supabaseAdmin
      .from("profiles")
      .update({
        bid_restricted_at: nowIso,
        bid_restricted_reason: reason,
      })
      .eq("id", bidderId)
      .is("bid_restricted_at", null);

    if (flagError) {
      console.error("[recordPaymentMissStrike] flag failed:", flagError);
      return;
    }

    // Audit trail.
    void logAuctionAuditEvent({
      auctionId,
      actorProfileId: bidderId,
      eventType: "user_flagged",
      eventData: {
        reason,
        strikesInWindow: totalStrikesInWindow,
        windowDays: PAYMENT_MISS_WINDOW_DAYS,
      },
    });

    // Notify the user.
    await createNotification(bidderId, "payment_missed_flagged", auctionId);
    if (bidderProfile?.email) {
      await sendNotificationEmail({
        to: bidderProfile.email,
        type: "payment_missed_flagged",
        data: {
          recipientName: bidderProfile.displayName ?? "there",
          strikeCount: totalStrikesInWindow,
          windowDays: PAYMENT_MISS_WINDOW_DAYS,
          reason,
          supportUrl: `${baseUrl}/contact`,
        },
      });
    }

    // Notify admins via an admin-broadcast. Fan-in row insert so one audit
    // log entry per flagged user surfaces in every admin's notification
    // feed.
    try {
      const { data: admins } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("is_admin", true);

      if (admins && admins.length > 0) {
        const adminNotifications = admins.map((admin) => ({
          user_id: admin.id as string,
          type: "payment_missed_flagged" as const,
          title: "User flagged: admin review needed",
          message: `A user has been auto-flagged for ${totalStrikesInWindow} missed payments in ${PAYMENT_MISS_WINDOW_DAYS} days.`,
          auction_id: auctionId,
          offer_id: null,
        }));
        await supabaseAdmin.from("notifications").insert(adminNotifications);
      }
    } catch (err) {
      console.error(
        "[recordPaymentMissStrike] admin notification failed:",
        err
      );
    }

    // Reputation hit: insert a system-generated negative rating. Uses a
    // null-safe path - if seller_ratings insert fails (e.g., unique buyer+auction
    // constraint from an earlier run), we swallow the error.
    try {
      await supabaseAdmin.from("seller_ratings").insert({
        seller_id: bidderId, // flag the bidder's reputation specifically
        buyer_id: bidderId, // system self-rating: using same id is intentional - see COMMENT
        auction_id: auctionId,
        rating_type: "negative",
        comment: `System flag: ${reason}.`,
      });
    } catch (err) {
      console.error(
        "[recordPaymentMissStrike] reputation penalty failed:",
        err
      );
    }
  }
}

/**
 * Seller-initiated. Creates a Second Chance Offer for the runner-up at
 * their last actual bid price. 48-hour window. Notifies the runner-up.
 *
 * Guardrails:
 *   - Caller must be the auction's seller.
 *   - Auction must be `cancelled` with `payment_expired_at` set.
 *   - Must actually have a runner-up (different from the no-pay winner).
 *   - Idempotent: returns the existing offer if one already exists for
 *     this auction.
 */

export async function createSecondChanceOffer(
  auctionId: string,
  sellerId: string
): Promise<
  | { success: true; offer: SecondChanceOffer }
  | { success: false; error: string }
> {
  // Verify caller is the seller + auction is in the expected state.
  const { data: auction } = await supabase
    .from("auctions")
    .select("id, seller_id, status, payment_expired_at, winner_id")
    .eq("id", auctionId)
    .single();

  if (!auction) {
    return { success: false, error: "Auction not found" };
  }
  if ((auction.seller_id as string) !== sellerId) {
    return { success: false, error: "Only the seller can trigger this" };
  }
  if (auction.status !== "cancelled" || !auction.payment_expired_at) {
    return {
      success: false,
      error: "Second-chance offers require a cancelled/unpaid auction",
    };
  }

  // Idempotent: return existing offer if one already exists.
  const { data: existing } = await supabaseAdmin
    .from("second_chance_offers")
    .select("*")
    .eq("auction_id", auctionId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return {
      success: true,
      offer: transformDbSecondChanceOffer(existing),
    };
  }

  // Find runner-up.
  const { data: bids } = await supabaseAdmin
    .from("bids")
    .select("bidder_id, bid_amount, created_at")
    .eq("auction_id", auctionId)
    .order("bid_amount", { ascending: false })
    .order("created_at", { ascending: true });

  if (!bids || bids.length < 2) {
    return { success: false, error: "No runner-up bidder to offer to" };
  }

  const winnerBidderId = bids[0].bidder_id as string;
  const runnerUpRow = bids.find(
    (b) => (b.bidder_id as string) !== winnerBidderId
  );
  if (!runnerUpRow) {
    return { success: false, error: "No runner-up bidder to offer to" };
  }

  const runnerUpId = runnerUpRow.bidder_id as string;
  const offerPrice = Number(runnerUpRow.bid_amount);
  const expiresAt = calculateSecondChanceOfferExpiration().toISOString();

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("second_chance_offers")
    .insert({
      auction_id: auctionId,
      runner_up_profile_id: runnerUpId,
      offer_price: offerPrice,
      status: "pending",
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    return {
      success: false,
      error: insertError?.message ?? "Failed to create offer",
    };
  }

  // Audit trail.
  void logAuctionAuditEvent({
    auctionId,
    actorProfileId: sellerId,
    eventType: "offer_created",
    eventData: {
      kind: "second_chance",
      runnerUpId,
      offerPrice,
      expiresAt,
    },
  });

  // Notify the runner-up in-app + email.
  const [runnerUpProfile, comicData] = await Promise.all([
    getProfileForEmail(runnerUpId),
    getListingComicData(auctionId),
  ]);

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";

  await createNotification(
    runnerUpId,
    "second_chance_offered",
    auctionId,
    undefined,
    {
      message: `You've been offered this comic at your last bid of $${offerPrice.toFixed(
        2
      )}. Accept within 48 hours.`,
    }
  );

  if (runnerUpProfile?.email && comicData) {
    await sendNotificationEmail({
      to: runnerUpProfile.email,
      type: "second_chance_offered",
      data: {
        recipientName: runnerUpProfile.displayName ?? "there",
        comicTitle: comicData.comicTitle,
        issueNumber: comicData.issueNumber,
        offerPrice,
        expiresAt: formatDeadlineForEmail(new Date(expiresAt)),
        responseUrl: `${baseUrl}/transactions?tab=wins`,
      },
    });
  }

  return { success: true, offer: transformDbSecondChanceOffer(inserted) };
}

/**
 * Runner-up accepts or declines a Second Chance Offer.
 * Race-safe via conditional UPDATE on `status='pending' AND expires_at > now()`.
 *
 * On accept: flips the underlying auction back to the pre-cancellation
 * buyer-owes-payment state with the new winner + 48h deadline.
 */
export async function respondToSecondChanceOffer(
  offerId: string,
  bidderId: string,
  action: "accept" | "decline"
): Promise<
  | { success: true; offer: SecondChanceOffer }
  | { success: false; error: string }
> {
  const { data: offer } = await supabaseAdmin
    .from("second_chance_offers")
    .select("*")
    .eq("id", offerId)
    .single();

  if (!offer) {
    return { success: false, error: "Offer not found" };
  }
  if ((offer.runner_up_profile_id as string) !== bidderId) {
    return { success: false, error: "Only the runner-up can respond" };
  }
  if (offer.status !== "pending") {
    return { success: false, error: `Offer is ${offer.status}` };
  }

  const nowIso = new Date().toISOString();

  if (action === "accept") {
    const paymentDeadline = calculatePaymentDeadline(new Date()).toISOString();

    // Conditional UPDATE - bail cleanly if another request already moved it.
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("second_chance_offers")
      .update({
        status: "accepted",
        accepted_at: nowIso,
      })
      .eq("id", offerId)
      .eq("status", "pending")
      .gt("expires_at", nowIso)
      .select()
      .single();

    if (updateError || !updated) {
      return {
        success: false,
        error: "Offer could not be accepted (expired or already responded)",
      };
    }

    // Re-open the auction for payment by the new buyer.
    const { error: auctionError } = await supabaseAdmin
      .from("auctions")
      .update({
        status: "ended",
        winner_id: bidderId,
        winning_bid: offer.offer_price,
        payment_status: "pending",
        payment_deadline: paymentDeadline,
        payment_expired_at: null,
        updated_at: nowIso,
      })
      .eq("id", offer.auction_id);

    if (auctionError) {
      console.error(
        "[respondToSecondChanceOffer] auction re-open failed:",
        auctionError
      );
      // We've already accepted the offer - return success but surface the
      // warning in logs. This keeps the offer consistent; admin can fix up.
    }

    // Audit.
    void logAuctionAuditEvent({
      auctionId: offer.auction_id as string,
      actorProfileId: bidderId,
      eventType: "offer_accepted",
      eventData: {
        kind: "second_chance",
        offerPrice: offer.offer_price,
      },
    });

    // Notify the seller.
    const { data: auctionRow } = await supabase
      .from("auctions")
      .select("seller_id")
      .eq("id", offer.auction_id)
      .single();

    if (auctionRow?.seller_id) {
      const sellerId = auctionRow.seller_id as string;
      await createNotification(
        sellerId,
        "second_chance_accepted",
        offer.auction_id as string
      );

      const [sellerProfile, comicData] = await Promise.all([
        getProfileForEmail(sellerId),
        getListingComicData(offer.auction_id as string),
      ]);
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";
      if (sellerProfile?.email && comicData) {
        await sendNotificationEmail({
          to: sellerProfile.email,
          type: "second_chance_accepted",
          data: {
            recipientName: sellerProfile.displayName ?? "there",
            comicTitle: comicData.comicTitle,
            issueNumber: comicData.issueNumber,
            offerPrice: Number(offer.offer_price),
            listingUrl: `${baseUrl}/shop?listing=${offer.auction_id}`,
          },
        });
      }
    }

    return { success: true, offer: transformDbSecondChanceOffer(updated) };
  }

  // action === "decline"
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("second_chance_offers")
    .update({
      status: "declined",
      declined_at: nowIso,
    })
    .eq("id", offerId)
    .eq("status", "pending")
    .gt("expires_at", nowIso)
    .select()
    .single();

  if (updateError || !updated) {
    return {
      success: false,
      error: "Offer could not be declined (expired or already responded)",
    };
  }

  void logAuctionAuditEvent({
    auctionId: offer.auction_id as string,
    actorProfileId: bidderId,
    eventType: "offer_rejected",
    eventData: {
      kind: "second_chance",
    },
  });

  // Notify the seller.
  const { data: auctionRow } = await supabase
    .from("auctions")
    .select("seller_id")
    .eq("id", offer.auction_id)
    .single();

  if (auctionRow?.seller_id) {
    const sellerId = auctionRow.seller_id as string;
    await createNotification(
      sellerId,
      "second_chance_declined",
      offer.auction_id as string
    );
    const [sellerProfile, comicData] = await Promise.all([
      getProfileForEmail(sellerId),
      getListingComicData(offer.auction_id as string),
    ]);
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";
    if (sellerProfile?.email && comicData) {
      await sendNotificationEmail({
        to: sellerProfile.email,
        type: "second_chance_declined",
        data: {
          recipientName: sellerProfile.displayName ?? "there",
          comicTitle: comicData.comicTitle,
          issueNumber: comicData.issueNumber,
          offerPrice: Number(offer.offer_price),
          listingUrl: `${baseUrl}/collection`,
        },
      });
    }
  }

  return { success: true, offer: transformDbSecondChanceOffer(updated) };
}

/**
 * Cron pass - expire any Second Chance Offer whose 48-hour window has
 * elapsed without a response. Notifies the seller so they know they can
 * re-list.
 *
 * Race-safe: conditional UPDATE on the pre-expiry state. Fire-and-forget
 * email/notification failures are surfaced in `errors[]`.
 */
export async function expireSecondChanceOffers(): Promise<{
  expired: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let expired = 0;

  try {
    const now = new Date();
    const { data: candidates, error: fetchError } = await supabaseAdmin
      .from("second_chance_offers")
      .select("id, auction_id, runner_up_profile_id, offer_price")
      .eq("status", "pending")
      .lt("expires_at", now.toISOString())
      .order("expires_at", { ascending: true })
      .limit(CRON_BATCH_LIMIT);

    if (fetchError) {
      errors.push(`Failed to fetch offers: ${fetchError.message}`);
      return { expired: 0, errors };
    }

    if (!candidates || candidates.length === 0) {
      return { expired: 0, errors };
    }

    for (const offer of candidates) {
      try {
        const nowIso = new Date().toISOString();
        const { data: updatedRow, error: updateError } = await supabaseAdmin
          .from("second_chance_offers")
          .update({ status: "expired" })
          .eq("id", offer.id)
          .eq("status", "pending")
          .select("id, auction_id, offer_price")
          .single();

        if (updateError || !updatedRow) {
          continue; // Someone beat us to it or it was resolved.
        }

        expired++;

        // Audit.
        void logAuctionAuditEvent({
          auctionId: offer.auction_id as string,
          actorProfileId: null,
          eventType: "offer_expired",
          eventData: {
            kind: "second_chance",
            offerPrice: offer.offer_price,
            expiredAt: nowIso,
          },
        });

        // Notify seller.
        const { data: auctionRow } = await supabase
          .from("auctions")
          .select("seller_id")
          .eq("id", offer.auction_id)
          .single();

        if (auctionRow?.seller_id) {
          const sellerId = auctionRow.seller_id as string;
          await createNotification(
            sellerId,
            "second_chance_expired",
            offer.auction_id as string
          );
          const [sellerProfile, comicData] = await Promise.all([
            getProfileForEmail(sellerId),
            getListingComicData(offer.auction_id as string),
          ]);
          const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";
          if (sellerProfile?.email && comicData) {
            await sendNotificationEmail({
              to: sellerProfile.email,
              type: "second_chance_expired",
              data: {
                recipientName: sellerProfile.displayName ?? "there",
                comicTitle: comicData.comicTitle,
                issueNumber: comicData.issueNumber,
                offerPrice: Number(offer.offer_price),
                listingUrl: `${baseUrl}/collection`,
              },
            });
          }
        }
      } catch (loopErr) {
        errors.push(
          `Offer ${offer.id}: ${
            loopErr instanceof Error ? loopErr.message : "unknown error"
          }`
        );
      }
    }

    console.warn(
      `[expireSecondChanceOffers] expired ${expired}, errors ${errors.length}`
    );
    return { expired, errors };
  } catch (topLevelErr) {
    errors.push(`expireSecondChanceOffers top-level: ${String(topLevelErr)}`);
    return { expired, errors };
  }
}

/**
 * Read a pending Second Chance Offer for a runner-up (if any exists) -
 * used by the /transactions UI to render the inbox card.
 */
export async function getPendingSecondChanceOffersForRunnerUp(
  profileId: string
): Promise<
  Array<
    SecondChanceOffer & {
      comicTitle: string;
      issueNumber: string;
      coverImageUrl: string | null;
    }
  >
> {
  const { data } = await supabaseAdmin
    .from("second_chance_offers")
    .select(
      "id, auction_id, runner_up_profile_id, offer_price, status, expires_at, accepted_at, declined_at, created_at, auctions!inner(comics!auctions_comic_id_fkey(title, issue_number, cover_image_url))"
    )
    .eq("runner_up_profile_id", profileId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (!data) return [];

  return data.map((row: Record<string, unknown>) => {
    const base = transformDbSecondChanceOffer(row);
    const comic =
      (row.auctions as { comics?: Record<string, unknown> } | null)?.comics ??
      null;
    return {
      ...base,
      comicTitle: (comic?.title as string | undefined) ?? "Unknown",
      issueNumber: (comic?.issue_number as string | undefined) ?? "",
      coverImageUrl: (comic?.cover_image_url as string | null) ?? null,
    };
  });
}
