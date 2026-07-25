// AUTO-EXTRACTED from auctionDb.ts during R1-auctiondb refactor (M-AU9).
// Behavior-preserving: function bodies moved verbatim.

import {
  BidHistoryItem,
  PlaceBidResult,
  calculateMinimumBid,
  calculatePaymentDeadline,
  getBidIncrement,
} from "@/types/auction";

import {
  sendNotificationEmail,
  getProfileForEmail,
  getListingComicData,
} from "../email";
import { computeSnipingExtension } from "../snipingProtection";
import { logAuctionAuditEvent, logAuctionAuditEvents } from "../auditLog";
import { buildBuyerComicClone, SellerComicRow } from "../cloneSoldComic";
import { createFeedbackReminders } from "../creatorCreditsDb";
import { supabase, supabaseAdmin } from "../supabase";
import { transformDbBid } from "./transforms";
import { createNotification } from "./notifications";

// ============================================================================
// BIDDING
// ============================================================================

/**
 * Place a bid with proxy bidding logic
 */
export async function placeBid(
  auctionId: string,
  bidderId: string,
  maxBid: number
): Promise<PlaceBidResult> {
  // Get auction details
  const { data: auction, error: auctionError } = await supabase
    .from("auctions")
    .select("*")
    .eq("id", auctionId)
    .single();

  if (auctionError || !auction) {
    return { success: false, message: "Auction not found" };
  }

  if (auction.status !== "active") {
    return { success: false, message: "Auction has ended" };
  }

  if (new Date(auction.end_time) < new Date()) {
    return { success: false, message: "Auction has ended" };
  }

  if (auction.seller_id === bidderId) {
    return { success: false, message: "You cannot bid on your own auction" };
  }

  // Validate bid amount
  const currentBid = auction.current_bid;
  const minimumBid = calculateMinimumBid(currentBid, auction.starting_price);

  if (maxBid < minimumBid) {
    return {
      success: false,
      message: `Minimum bid is $${minimumBid.toFixed(2)}`,
    };
  }

  if (!Number.isInteger(maxBid)) {
    return { success: false, message: "Bids must be whole dollar amounts" };
  }

  // Get current winning bid (none on the first bid → maybeSingle avoids
  // PGRST116 noise).
  const { data: currentWinningBid } = await supabase
    .from("bids")
    .select("*")
    .eq("auction_id", auctionId)
    .eq("is_winning", true)
    .maybeSingle();

  // Get bidder's existing bids to determine bidder number
  const { data: existingBids } = await supabase
    .from("bids")
    .select("bidder_number")
    .eq("auction_id", auctionId)
    .eq("bidder_id", bidderId)
    .limit(1);

  let bidderNumber: number;
  if (existingBids && existingBids.length > 0) {
    bidderNumber = existingBids[0].bidder_number;
  } else {
    // Get max bidder number
    const { data: maxBidderData } = await supabase
      .from("bids")
      .select("bidder_number")
      .eq("auction_id", auctionId)
      .order("bidder_number", { ascending: false })
      .limit(1);

    bidderNumber = maxBidderData?.[0]?.bidder_number ? maxBidderData[0].bidder_number + 1 : 1;
  }

  // Proxy bidding logic
  let newCurrentBid: number;
  let isHighBidder: boolean;
  let outbidUserId: string | null = null;

  if (!currentWinningBid) {
    // First bid
    newCurrentBid = auction.starting_price;
    isHighBidder = true;
  } else if (currentWinningBid.bidder_id === bidderId) {
    // Same bidder increasing max
    if (maxBid <= currentWinningBid.max_bid) {
      return {
        success: false,
        message: `Your max bid is already $${currentWinningBid.max_bid}`,
      };
    }

    // Update existing bid (admin: buyer lacks RLS permission on bids row-level writes)
    await supabaseAdmin
      .from("bids")
      .update({ max_bid: maxBid, updated_at: new Date().toISOString() })
      .eq("id", currentWinningBid.id);

    // Audit trail - fire-and-forget. Proxy max increased without a new bid row.
    void logAuctionAuditEvent({
      auctionId,
      actorProfileId: bidderId,
      eventType: "bid_placed",
      eventData: {
        bidAmount: auction.current_bid,
        maxBid,
        previousMaxBid: currentWinningBid.max_bid,
        isHighBidder: true,
        isProxy: true,
        proxyMaxIncrease: true,
        bidderNumber,
      },
    });

    return {
      success: true,
      message: "Max bid updated successfully",
      currentBid: auction.current_bid,
      isHighBidder: true,
    };
  } else {
    // New bidder competing with existing high bidder
    const increment = getBidIncrement(currentBid || auction.starting_price);

    if (maxBid > currentWinningBid.max_bid) {
      // New bidder wins
      newCurrentBid = Math.min(currentWinningBid.max_bid + increment, maxBid);
      isHighBidder = true;
      outbidUserId = currentWinningBid.bidder_id;

      // Mark old bid as not winning
      await supabaseAdmin.from("bids").update({ is_winning: false }).eq("id", currentWinningBid.id);
    } else if (maxBid === currentWinningBid.max_bid) {
      // Tie goes to first bidder
      newCurrentBid = maxBid;
      isHighBidder = false;
    } else {
      // Existing bidder still wins
      newCurrentBid = maxBid + increment;
      if (newCurrentBid > currentWinningBid.max_bid) {
        newCurrentBid = currentWinningBid.max_bid;
      }
      isHighBidder = false;

      // Update current bid amount
      await supabaseAdmin.from("auctions").update({ current_bid: newCurrentBid }).eq("id", auctionId);
    }
  }

  // For a losing bid, bid_amount must equal the bidder's own max (not the
  // auto-incremented display amount `newCurrentBid`) - otherwise the DB
  // `valid_max_bid` check constraint (max_bid >= bid_amount) rejects the
  // insert, since newCurrentBid = maxBid + increment > maxBid. The auction's
  // current_bid column still tracks the display amount separately.
  const bidAmountToRecord = isHighBidder ? newCurrentBid : maxBid;

  // Create new bid (admin: buyers lack RLS insert permission on bids table)
  const { data: newBid, error: bidError } = await supabaseAdmin
    .from("bids")
    .insert({
      auction_id: auctionId,
      bidder_id: bidderId,
      bid_amount: bidAmountToRecord,
      max_bid: maxBid,
      bidder_number: bidderNumber,
      is_winning: isHighBidder,
    })
    .select()
    .single();

  if (bidError) {
    // Translate common DB constraint errors into user-friendly messages.
    // Raw Postgres strings (e.g. "new row for relation …violates check
    // constraint …") should never reach the UI.
    let friendly = "Something went wrong placing your bid. Please try again.";
    if (bidError.message?.includes("valid_max_bid")) {
      friendly = "Your max bid must be at least the current bid plus the increment.";
    } else if (bidError.message?.includes("row-level security")) {
      friendly = "You don't have permission to bid on this auction.";
    }
    console.error("[placeBid] DB error:", bidError);
    return { success: false, message: friendly };
  }

  // Sniping protection: if this bid landed inside the final SNIPING_WINDOW_MS
  // of the auction, extend `end_time` by SNIPING_EXTENSION_MS to give other
  // bidders a chance to respond. Caps at MAX_EXTENSION_MS past the original
  // end so a sustained back-and-forth can't run an auction indefinitely.
  // First extension stamps `original_end_time` so UI / audit can show both.
  let extendedTo: string | undefined;
  const newEndTime = computeSnipingExtension(auction);
  if (newEndTime) {
    extendedTo = newEndTime;
  }

  // Update auction
  await supabaseAdmin
    .from("auctions")
    .update({
      current_bid: newCurrentBid,
      bid_count: auction.bid_count + 1,
      ...(extendedTo && {
        end_time: extendedTo,
        // Stamp original_end_time on first extension only — subsequent
        // extensions preserve the original.
        ...(auction.original_end_time == null && { original_end_time: auction.end_time }),
      }),
    })
    .eq("id", auctionId);

  // Send outbid notification + email
  if (outbidUserId) {
    await createNotification(outbidUserId, "outbid", auctionId);

    try {
      const [outbidProfile, comicData] = await Promise.all([
        getProfileForEmail(outbidUserId),
        getListingComicData(auctionId),
      ]);
      if (!outbidProfile?.email) {
        console.warn(`[Email] outbid skipped - no email on profile ${outbidUserId}`);
      } else if (!comicData) {
        console.warn(`[Email] outbid skipped - no comic data for auction ${auctionId}`);
      } else {
        const result = await sendNotificationEmail({
          to: outbidProfile.email,
          type: "outbid",
          data: {
            recipientName: outbidProfile.displayName ?? "there",
            comicTitle: comicData.comicTitle,
            issueNumber: comicData.issueNumber,
            currentBid: newCurrentBid,
            yourMaxBid: currentWinningBid?.max_bid,
            listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop?listing=${auctionId}`,
          },
        });
        if (!result.success) {
          console.error(`[Email] outbid to ${outbidProfile.email} failed:`, result.error);
        }
      }
    } catch (err) {
      console.error("[Email] outbid unexpected error:", err);
    }
  }

  // Notify seller of new bid activity (in-app only; no email).
  // No throttle yet - file as follow-up if volume becomes a nuisance.
  if (auction.seller_id !== bidderId) {
    await createNotification(auction.seller_id, "new_bid_received", auctionId);
  }

  // Audit trail - fire-and-forget. Records amount and whether this was a
  // proxy bid (maxBid != displayed bid) so admins can reconstruct auction
  // history during disputes.
  void logAuctionAuditEvent({
    auctionId,
    actorProfileId: bidderId,
    eventType: "bid_placed",
    eventData: {
      bidAmount: bidAmountToRecord,
      maxBid,
      currentBid: newCurrentBid,
      isHighBidder,
      isProxy: maxBid > newCurrentBid,
      bidderNumber,
      outbidUserId,
    },
  });

  return {
    success: true,
    message: isHighBidder ? "You are the high bidder!" : "You have been outbid",
    bid: transformDbBid(newBid),
    currentBid: newCurrentBid,
    isHighBidder,
    outbidAmount: isHighBidder ? undefined : minimumBid,
    extendedTo,
  };
}

/**
 * Get bid history for an auction (anonymized)
 */
export async function getBidHistory(auctionId: string): Promise<BidHistoryItem[]> {
  const { data, error } = await supabase
    .from("bids")
    .select("bidder_number, bid_amount, created_at, is_winning")
    .eq("auction_id", auctionId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((bid) => ({
    bidderNumber: bid.bidder_number,
    bidAmount: bid.bid_amount,
    createdAt: bid.created_at,
    isWinning: bid.is_winning,
  }));
}

/**
 * Execute Buy It Now
 */
export async function executeBuyItNow(
  auctionId: string,
  buyerId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: auction } = await supabase
    .from("auctions")
    .select("*")
    .eq("id", auctionId)
    .eq("status", "active")
    .single();

  if (!auction) {
    return { success: false, error: "Auction not found or has ended" };
  }

  if (!auction.buy_it_now_price) {
    return { success: false, error: "Buy It Now not available" };
  }

  if (auction.seller_id === buyerId) {
    return { success: false, error: "You cannot buy your own item" };
  }

  // End auction with buyer as winner
  const paymentDeadline = calculatePaymentDeadline();

  // Atomic status guard: only transition from 'active' to 'sold'. The extra
  // .eq("status", "active") makes the UPDATE a no-op if a concurrent bid/BIN
  // already finalized the row, and .select() lets us detect that via zero
  // rows so two buyers can't both "win" the same Buy It Now. supabaseAdmin
  // mirrors the rest of the money-path writes (RLS would otherwise block the
  // buyer-scoped update). A DB-level guard (FOR UPDATE / status-CHECK) is the
  // fully robust fix but requires a migration — deferred. H-AU3.
  const { data: soldRows, error } = await supabaseAdmin
    .from("auctions")
    .update({
      status: "sold",
      winner_id: buyerId,
      winning_bid: auction.buy_it_now_price,
      payment_status: "pending",
      payment_deadline: paymentDeadline.toISOString(),
    })
    .eq("id", auctionId)
    .eq("status", "active")
    .select("id");

  if (error) {
    return { success: false, error: error.message };
  }

  if (!soldRows || soldRows.length === 0) {
    // Lost the race — another bid or Buy It Now already finalized this listing.
    return { success: false, error: "This listing is no longer available" };
  }

  // Notify seller
  await createNotification(auction.seller_id, "auction_sold", auctionId);

  // Notify buyer
  await createNotification(buyerId, "won", auctionId);

  // Create feedback reminders for both parties
  await createFeedbackReminders("auction", auctionId, buyerId, auction.seller_id);

  // Audit trail - Buy It Now ends the listing and designates a winner.
  // Log auction_ended + bid_won as a compact pair.
  void logAuctionAuditEvents([
    {
      auctionId,
      actorProfileId: buyerId,
      eventType: "auction_ended",
      eventData: {
        via: "buy_it_now",
        winningBid: auction.buy_it_now_price,
        winnerId: buyerId,
        paymentDeadline: paymentDeadline.toISOString(),
      },
    },
    {
      auctionId,
      actorProfileId: buyerId,
      eventType: "bid_won",
      eventData: {
        via: "buy_it_now",
        winningBid: auction.buy_it_now_price,
      },
    },
  ]);

  return { success: true };
}

// ============================================================================
// MARKETPLACE FULFILLMENT (post-payment ownership transfer)
// ============================================================================

// `buildBuyerComicClone` and `SellerComicRow` live in ./cloneSoldComic (pure
// helpers, no Supabase/Resend deps) so unit tests can exercise them without
// booting the full DB stack.

/**
 * Transfer ownership of a sold comic: insert a new row for the buyer and
 * mark the seller's original row as sold (read-only in their sold history).
 *
 * Uses supabaseAdmin throughout - writes span two users' rows, RLS would
 * reject partial operations. Safe to use in webhook / cron context where the
 * caller is already authenticated at the API boundary.
 *
 * Idempotency: if the seller's row already has a `sold_at` timestamp, this
 * is a repeated webhook delivery and we skip to avoid duplicate clones.
 */
export async function cloneSoldComicToBuyer(params: {
  sellerComicId: string;
  buyerId: string;
  salePrice: number;
  auctionId: string;
}): Promise<{ success: boolean; buyerComicId?: string; skipped?: boolean; error?: string }> {
  const { sellerComicId, buyerId, salePrice, auctionId } = params;

  // Fetch the seller's row
  const { data: seller, error: fetchError } = await supabaseAdmin
    .from("comics")
    .select("*")
    .eq("id", sellerComicId)
    .single();

  if (fetchError || !seller) {
    return { success: false, error: `Seller's comic row not found: ${fetchError?.message}` };
  }

  // Idempotency: if already sold, webhook is repeating - skip.
  if (seller.sold_at) {
    return { success: true, skipped: true };
  }

  // Insert buyer's clone
  const clonePayload = buildBuyerComicClone(seller as SellerComicRow, buyerId, salePrice);
  const { data: buyerRow, error: insertError } = await supabaseAdmin
    .from("comics")
    .insert(clonePayload)
    .select("id")
    .single();

  if (insertError || !buyerRow) {
    return { success: false, error: `Failed to clone comic for buyer: ${insertError?.message}` };
  }

  // Mark seller's original row as sold (read-only going forward)
  const { error: markError } = await supabaseAdmin
    .from("comics")
    .update({
      sold_at: new Date().toISOString(),
      sold_to_profile_id: buyerId,
      sold_via_auction_id: auctionId,
      for_sale: false,
    })
    .eq("id", sellerComicId);

  if (markError) {
    // Clone succeeded but seller-row mark failed. Log, don't roll back -
    // buyer has their comic, worst case seller's row is editable until next
    // reconciliation. Better than denying the buyer their purchase.
    console.error("[cloneSoldComicToBuyer] Clone succeeded but failed to mark seller row sold:", markError);
  }

  return { success: true, buyerComicId: buyerRow.id };
}
