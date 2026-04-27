import {
  Auction,
  AuctionFilters,
  AuctionSortBy,
  Bid,
  BidHistoryItem,
  CancelReason,
  CreateAuctionInput,
  CreateFixedPriceListingInput,
  CreateOfferInput,
  ListingType,
  Notification,
  NotificationType,
  Offer,
  OfferStatus,
  PAYMENT_MISS_WINDOW_DAYS,
  PAYMENT_REMINDER_WINDOW_HOURS,
  PAYMENT_MISS_STRIKE_THRESHOLD,
  PlaceBidResult,
  RespondToOfferInput,
  SecondChanceOffer,
  SellerProfile,
  SellerRating,
  SubmitRatingInput,
  UpdateAuctionInput,
  WatchlistItem,
  calculateMinimumBid,
  calculatePaymentDeadline,
  calculateSecondChanceOfferExpiration,
  calculateSellerReputation,
  getBidIncrement,
} from "@/types/auction";
import { CollectionItem, ConditionLabel, PriceData } from "@/types/comic";

import {
  buildCursorFilter,
  type NotificationCursor,
} from "./notificationCursor";
import {
  sendNotificationEmail,
  sendNotificationEmailsBatch,
  getProfileForEmail,
  getListingComicData,
} from "./email";
import { mapWithConcurrency } from "./concurrency";
import {
  AuditEventInput,
  logAuctionAuditEvent,
  logAuctionAuditEvents,
} from "./auditLog";
import { buildBuyerComicClone, SellerComicRow } from "./cloneSoldComic";
import { createFeedbackReminders } from "./creatorCreditsDb";
import { getAllFollowerIds } from "./followDb";
import { filterCustomKeyInfoForPublic } from "./keyInfoHelpers";
import { getSubscriptionStatus, getTransactionFeePercent } from "./subscription";
import { supabase, supabaseAdmin } from "./supabase";

// ============================================================================
// EMAIL FORMATTING HELPERS
// ============================================================================

/**
 * Render a deadline timestamp for inclusion in transactional emails.
 *
 * Uses America/New_York and includes a short timezone abbreviation
 * (e.g. "EDT", "EST") so recipients can interpret the time without
 * ambiguity. Beta users are US-focused; this is a deliberately simple
 * fix until per-profile timezone preferences land (BACKLOG, post-launch).
 *
 * Example output: "April 26, 2026 at 10:20 AM EDT"
 */
export function formatDeadlineForEmail(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(date);
}

// ============================================================================
// AUCTION CRUD
// ============================================================================

/**
 * Check if a comic already has an active listing
 */
async function hasActiveListing(comicId: string): Promise<boolean> {
  const { data } = await supabase
    .from("auctions")
    .select("id")
    .eq("comic_id", comicId)
    .in("status", ["active", "ended"]) // ended but not sold/cancelled
    .limit(1)
    .single();

  return !!data;
}

/**
 * Create a new auction
 */
export async function createAuction(sellerId: string, input: CreateAuctionInput): Promise<Auction> {
  // Check for duplicate listing
  if (await hasActiveListing(input.comicId)) {
    throw new Error("This comic already has an active listing");
  }

  const listingType = input.listingType || "auction";

  // Get seller's subscription tier and fee at time of listing
  const subscriptionStatus = await getSubscriptionStatus(sellerId);
  const sellerTier = subscriptionStatus?.tier || "free";
  const isTrialing = subscriptionStatus?.isTrialing || false;
  const feePercent = await getTransactionFeePercent(sellerId);

  // Support scheduled auctions with custom start date
  // Note: Date-only strings like "2026-01-24" are parsed as UTC midnight,
  // so we append T00:00:00 to parse as local midnight instead
  const startTime = input.startDate ? new Date(input.startDate + "T00:00:00") : new Date();
  const endTime = new Date(startTime);
  endTime.setDate(endTime.getDate() + input.durationDays);

  const { data, error } = await supabaseAdmin
    .from("auctions")
    .insert({
      seller_id: sellerId,
      comic_id: input.comicId,
      listing_type: listingType,
      starting_price: input.startingPrice,
      buy_it_now_price: input.buyItNowPrice || null,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      shipping_cost: input.shippingCost,
      detail_images: input.detailImages || [],
      description: input.description || null,
      seller_tier: isTrialing ? "premium" : sellerTier, // Treat trialing as premium for fees
      platform_fee_percent: feePercent,
    })
    .select()
    .single();

  if (error) throw error;

  // Set seller_since if first listing
  await supabaseAdmin
    .from("profiles")
    .update({ seller_since: new Date().toISOString() })
    .eq("id", sellerId)
    .is("seller_since", null);

  // Notify followers of new listing
  // Get comic title and cover image for notification
  const { data: comicData } = await supabase
    .from("comics")
    .select("title, issue_number, cover_image_url")
    .eq("id", input.comicId)
    .single();

  if (comicData) {
    const comicTitle = comicData.issue_number
      ? `${comicData.title} #${comicData.issue_number}`
      : comicData.title || "a comic";
    const price = input.startingPrice;
    // Fire and forget - don't block on notification creation
    notifyFollowersOfNewListing(
      sellerId,
      data.id,
      comicTitle,
      price,
      listingType,
      comicData.cover_image_url || undefined
    ).catch((err) => console.error("[auctionDb] Failed to notify followers:", err));
  }

  // Audit trail — fire-and-forget, never blocks the creation path.
  void logAuctionAuditEvent({
    auctionId: data.id,
    actorProfileId: sellerId,
    eventType: "auction_created",
    eventData: {
      listingType,
      startingPrice: input.startingPrice,
      buyItNowPrice: input.buyItNowPrice ?? null,
      durationDays: input.durationDays,
      auctionEndTime: endTime.toISOString(),
      scheduled: !!input.startDate,
    },
  });

  return transformDbAuction(data);
}

/**
 * Create a fixed-price listing
 */
export async function createFixedPriceListing(
  sellerId: string,
  input: CreateFixedPriceListingInput
): Promise<Auction> {
  // Check for duplicate listing
  if (await hasActiveListing(input.comicId)) {
    throw new Error("This comic already has an active listing");
  }

  // Get seller's subscription tier and fee at time of listing
  const subscriptionStatus = await getSubscriptionStatus(sellerId);
  const sellerTier = subscriptionStatus?.tier || "free";
  const isTrialing = subscriptionStatus?.isTrialing || false;
  const feePercent = await getTransactionFeePercent(sellerId);

  // Fixed-price listings expire after 30 days
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { data, error } = await supabaseAdmin
    .from("auctions")
    .insert({
      seller_id: sellerId,
      comic_id: input.comicId,
      listing_type: "fixed_price",
      starting_price: input.price,
      buy_it_now_price: null, // Not applicable for fixed-price
      end_time: expiresAt.toISOString(), // Use same time for end_time
      expires_at: expiresAt.toISOString(),
      shipping_cost: input.shippingCost,
      detail_images: input.detailImages || [],
      description: input.description || null,
      accepts_offers: input.acceptsOffers || false,
      min_offer_amount: input.minOfferAmount || null,
      seller_tier: isTrialing ? "premium" : sellerTier, // Treat trialing as premium for fees
      platform_fee_percent: feePercent,
    })
    .select()
    .single();

  if (error) throw error;

  // Set seller_since if first listing
  await supabaseAdmin
    .from("profiles")
    .update({ seller_since: new Date().toISOString() })
    .eq("id", sellerId)
    .is("seller_since", null);

  // Notify followers of new listing
  // Get comic title and cover image for notification
  const { data: comicData } = await supabase
    .from("comics")
    .select("title, issue_number, cover_image_url")
    .eq("id", input.comicId)
    .single();

  if (comicData) {
    const comicTitle = comicData.issue_number
      ? `${comicData.title} #${comicData.issue_number}`
      : comicData.title || "a comic";
    // Fire and forget - don't block on notification creation
    notifyFollowersOfNewListing(
      sellerId,
      data.id,
      comicTitle,
      input.price,
      "fixed_price",
      comicData.cover_image_url || undefined
    ).catch((err) => console.error("[auctionDb] Failed to notify followers:", err));
  }

  // Audit trail — fire-and-forget.
  void logAuctionAuditEvent({
    auctionId: data.id,
    actorProfileId: sellerId,
    eventType: "auction_created",
    eventData: {
      listingType: "fixed_price",
      price: input.price,
      acceptsOffers: input.acceptsOffers || false,
      minOfferAmount: input.minOfferAmount ?? null,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return transformDbAuction(data);
}

/**
 * Get a single auction by ID
 */
export async function getAuction(auctionId: string, userId?: string): Promise<Auction | null> {
  const { data, error } = await supabase
    .from("auctions")
    .select(
      `
      *,
      comics!auctions_comic_id_fkey(*),
      profiles!auctions_seller_id_fkey(id, display_name, public_display_name, email, positive_ratings, negative_ratings, seller_since, username, display_preference, location_city, location_state, location_country, location_privacy)
    `
    )
    .eq("id", auctionId)
    .single();

  if (error || !data) return null;

  const auction = transformDbAuction(data);

  // Check if user is the seller or watching
  if (userId) {
    auction.isSeller = auction.sellerId === userId;

    const { data: watchData } = await supabase
      .from("auction_watchlist")
      .select("id")
      .eq("auction_id", auctionId)
      .eq("user_id", userId)
      .single();

    auction.isWatching = !!watchData;

    // Get user's current bid
    const { data: bidData } = await supabase
      .from("bids")
      .select("*")
      .eq("auction_id", auctionId)
      .eq("bidder_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (bidData) {
      auction.userBid = transformDbBid(bidData);
    }
  }

  // Populate second-chance state for cancelled auctions so the seller's
  // detail modal can render the "Offer to Runner-up" CTA. Only relevant
  // when the viewer is the seller; skip for everyone else to save round-trips.
  if (auction.status === "cancelled" && auction.isSeller) {
    const secondChanceState = await getAuctionSecondChanceState(auctionId);
    auction.hasRunnerUp = secondChanceState.hasRunnerUp;
    auction.runnerUpLastBid = secondChanceState.runnerUpLastBid;
    auction.secondChanceOfferStatus = secondChanceState.offerStatus;
  }

  return auction;
}

/**
 * For a cancelled auction, return whether a runner-up exists, their last
 * actual bid, and the status of any existing second_chance_offers row.
 *
 * Used by the seller-facing AuctionDetailModal to decide whether to render
 * the "Offer to Runner-up" CTA.
 */
async function getAuctionSecondChanceState(auctionId: string): Promise<{
  hasRunnerUp: boolean;
  runnerUpLastBid: number | null;
  offerStatus: SecondChanceOffer["status"] | null;
}> {
  const [{ data: bids }, { data: offer }] = await Promise.all([
    supabase
      .from("bids")
      .select("bidder_id, bid_amount, created_at")
      .eq("auction_id", auctionId)
      .order("bid_amount", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("second_chance_offers")
      .select("status")
      .eq("auction_id", auctionId)
      .limit(1)
      .maybeSingle(),
  ]);

  const offerStatus =
    (offer?.status as SecondChanceOffer["status"] | undefined) ?? null;

  if (!bids || bids.length < 2) {
    return { hasRunnerUp: false, runnerUpLastBid: null, offerStatus };
  }

  const winnerBidderId = bids[0].bidder_id as string;
  const runnerUpRow = bids.find(
    (b) => (b.bidder_id as string) !== winnerBidderId
  );

  if (!runnerUpRow) {
    return { hasRunnerUp: false, runnerUpLastBid: null, offerStatus };
  }

  return {
    hasRunnerUp: true,
    runnerUpLastBid: Number(runnerUpRow.bid_amount),
    offerStatus,
  };
}

/**
 * Get active auctions with filters and sorting
 * @param followedSellerIds - Optional array of seller IDs to filter by (for "following only" mode)
 */
export async function getActiveAuctions(
  filters: AuctionFilters = {},
  sortBy: AuctionSortBy = "ending_soonest",
  limit = 50,
  offset = 0,
  followedSellerIds?: string[]
): Promise<{ auctions: Auction[]; total: number }> {
  let query = supabase.from("auctions").select(
    `
      *,
      comics!auctions_comic_id_fkey(*)
    `,
    { count: "exact" }
  );

  // When filtering by sellerId, show all statuses (for My Listings page)
  // Otherwise, only show active listings (for Shop page)
  if (filters.sellerId) {
    query = query.eq("seller_id", filters.sellerId);
  } else {
    query = query.eq("status", "active");
    // For auctions, also filter out ended ones (end_time has passed)
    // Fixed-price listings don't have end times so this only affects auctions
    if (filters.listingType === "auction") {
      query = query.gt("end_time", new Date().toISOString());
    }
  }

  // Filter by followed sellers if provided
  if (followedSellerIds && followedSellerIds.length > 0) {
    query = query.in("seller_id", followedSellerIds);
  } else if (followedSellerIds && followedSellerIds.length === 0) {
    // User follows no one, return empty result
    return { auctions: [], total: 0 };
  }

  // Apply filters
  if (filters.listingType) {
    query = query.eq("listing_type", filters.listingType);
  }
  if (filters.minPrice !== undefined) {
    // For fixed_price, use starting_price; for auctions, use current_bid
    if (filters.listingType === "fixed_price") {
      query = query.gte("starting_price", filters.minPrice);
    } else {
      query = query.gte("current_bid", filters.minPrice);
    }
  }
  if (filters.maxPrice !== undefined) {
    if (filters.listingType === "fixed_price") {
      query = query.lte("starting_price", filters.maxPrice);
    } else {
      query = query.lte("current_bid", filters.maxPrice);
    }
  }
  if (filters.hasBuyItNow) {
    query = query.not("buy_it_now_price", "is", null);
  }
  if (filters.endingSoon) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    query = query.lte("end_time", tomorrow.toISOString());
  }

  // Apply sorting
  switch (sortBy) {
    case "ending_soonest":
      query = query.order("end_time", { ascending: true });
      break;
    case "ending_latest":
      query = query.order("end_time", { ascending: false });
      break;
    case "price_low":
      // For fixed-price listings, sort by starting_price
      if (filters.listingType === "fixed_price") {
        query = query.order("starting_price", { ascending: true });
      } else {
        query = query.order("current_bid", { ascending: true, nullsFirst: true });
      }
      break;
    case "price_high":
      if (filters.listingType === "fixed_price") {
        query = query.order("starting_price", { ascending: false });
      } else {
        query = query.order("current_bid", { ascending: false });
      }
      break;
    case "most_bids":
      query = query.order("bid_count", { ascending: false });
      break;
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
  }

  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) throw error;

  return {
    auctions: (data || []).map(transformDbAuction),
    total: count || 0,
  };
}

/**
 * Get auctions by seller
 */
export async function getSellerAuctions(sellerId: string, status?: string): Promise<Auction[]> {
  let query = supabase
    .from("auctions")
    .select(
      `
      *,
      comics!auctions_comic_id_fkey(*)
    `
    )
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map(transformDbAuction);
}

/**
 * Get auctions won by user
 */
export async function getWonAuctions(userId: string): Promise<Auction[]> {
  const { data, error } = await supabase
    .from("auctions")
    .select(
      `
      *,
      comics!auctions_comic_id_fkey(*)
    `
    )
    .eq("winner_id", userId)
    .in("status", ["ended", "sold"])
    .order("end_time", { ascending: false });

  if (error) throw error;

  return (data || []).map(transformDbAuction);
}

/**
 * Update auction
 */
export async function updateAuction(
  auctionId: string,
  sellerId: string,
  updates: UpdateAuctionInput
): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};

  if (updates.buyItNowPrice !== undefined) {
    dbUpdates.buy_it_now_price = updates.buyItNowPrice;
  }
  if (updates.description !== undefined) {
    dbUpdates.description = updates.description;
  }
  if (updates.detailImages !== undefined) {
    dbUpdates.detail_images = updates.detailImages;
  }

  const { error } = await supabase
    .from("auctions")
    .update(dbUpdates)
    .eq("id", auctionId)
    .eq("seller_id", sellerId);

  if (error) throw error;
}

/**
 * Cancel auction/listing (only if no bids for auctions)
 */
export async function cancelAuction(
  auctionId: string,
  sellerId: string,
  reason?: CancelReason
): Promise<{ success: boolean; error?: string }> {
  // Check for existing bids
  const { data: auction } = await supabase
    .from("auctions")
    .select("bid_count, listing_type, status")
    .eq("id", auctionId)
    .eq("seller_id", sellerId)
    .single();

  if (!auction) {
    return { success: false, error: "Listing not found" };
  }

  // Already cancelled - return success
  if (auction.status === "cancelled") {
    return { success: true };
  }

  // For auctions, check that there are no bids
  if (auction.listing_type === "auction" && auction.bid_count > 0) {
    return { success: false, error: "Cannot cancel auction with bids" };
  }

  // For fixed-price listings, get pending offers to notify buyers
  if (auction.listing_type === "fixed_price") {
    const { data: pendingOffers } = await supabase
      .from("offers")
      .select("id, buyer_id")
      .eq("listing_id", auctionId)
      .in("status", ["pending", "countered"]);

    if (pendingOffers && pendingOffers.length > 0) {
      // Update all pending offers to auto_rejected
      await supabaseAdmin
        .from("offers")
        .update({
          status: "auto_rejected",
          updated_at: new Date().toISOString(),
        })
        .eq("listing_id", auctionId)
        .in("status", ["pending", "countered"]);

      // Notify each buyer that the listing was cancelled
      for (const offer of pendingOffers) {
        await createNotification(offer.buyer_id, "listing_cancelled", auctionId, offer.id);
      }
    }
  }

  // Use supabaseAdmin to bypass RLS
  const { error } = await supabaseAdmin
    .from("auctions")
    .update({
      status: "cancelled",
      cancel_reason: reason || null,
    })
    .eq("id", auctionId)
    .eq("seller_id", sellerId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Audit trail — fire-and-forget.
  void logAuctionAuditEvent({
    auctionId,
    actorProfileId: sellerId,
    eventType: "auction_cancelled",
    eventData: {
      reason: reason || null,
      listingType: auction.listing_type,
      cancelledBy: "seller",
    },
  });

  return { success: true };
}

/**
 * Mark a listing as sold outside the app
 * This removes the listing and the comic from collection
 */
export async function markSoldOutsideApp(
  auctionId: string,
  sellerId: string,
  salePrice: number
): Promise<{ success: boolean; error?: string }> {
  // Get the auction details first
  const { data: auction } = await supabase
    .from("auctions")
    .select("comic_id, bid_count, listing_type")
    .eq("id", auctionId)
    .eq("seller_id", sellerId)
    .single();

  if (!auction) {
    return { success: false, error: "Listing not found" };
  }

  // For auctions, check that there are no bids
  if (auction.listing_type === "auction" && auction.bid_count > 0) {
    return { success: false, error: "Cannot mark auction with bids as sold outside app" };
  }

  // Mark listing as sold
  const { error: auctionError } = await supabase
    .from("auctions")
    .update({
      status: "sold",
      winning_bid: salePrice,
      cancel_reason: "sold_elsewhere",
    })
    .eq("id", auctionId)
    .eq("seller_id", sellerId);

  if (auctionError) {
    return { success: false, error: auctionError.message };
  }

  // Delete the comic from collection
  const { error: comicError } = await supabase.from("comics").delete().eq("id", auction.comic_id);

  if (comicError) {
    // Note: Listing is already marked sold, but comic deletion failed
    console.error("Failed to delete comic after marking sold:", comicError);
  }

  return { success: true };
}

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

  // Get current winning bid
  const { data: currentWinningBid } = await supabase
    .from("bids")
    .select("*")
    .eq("auction_id", auctionId)
    .eq("is_winning", true)
    .single();

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

    // Audit trail — fire-and-forget. Proxy max increased without a new bid row.
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
  // auto-incremented display amount `newCurrentBid`) — otherwise the DB
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

  // Update auction
  await supabaseAdmin
    .from("auctions")
    .update({
      current_bid: newCurrentBid,
      bid_count: auction.bid_count + 1,
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
        console.warn(`[Email] outbid skipped — no email on profile ${outbidUserId}`);
      } else if (!comicData) {
        console.warn(`[Email] outbid skipped — no comic data for auction ${auctionId}`);
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
  // No throttle yet — file as follow-up if volume becomes a nuisance.
  if (auction.seller_id !== bidderId) {
    await createNotification(auction.seller_id, "new_bid_received", auctionId);
  }

  // Audit trail — fire-and-forget. Records amount and whether this was a
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
 * Get user's bids across all auctions
 */
export async function getUserBids(userId: string): Promise<Bid[]> {
  const { data, error } = await supabase
    .from("bids")
    .select("*")
    .eq("bidder_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map(transformDbBid);
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

  const { error } = await supabase
    .from("auctions")
    .update({
      status: "sold",
      winner_id: buyerId,
      winning_bid: auction.buy_it_now_price,
      payment_status: "pending",
      payment_deadline: paymentDeadline.toISOString(),
    })
    .eq("id", auctionId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Notify seller
  await createNotification(auction.seller_id, "auction_sold", auctionId);

  // Notify buyer
  await createNotification(buyerId, "won", auctionId);

  // Create feedback reminders for both parties
  await createFeedbackReminders("auction", auctionId, buyerId, auction.seller_id);

  // Audit trail — Buy It Now ends the listing and designates a winner.
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
 * Uses supabaseAdmin throughout — writes span two users' rows, RLS would
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

  // Idempotency: if already sold, webhook is repeating — skip.
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
    // Clone succeeded but seller-row mark failed. Log, don't roll back —
    // buyer has their comic, worst case seller's row is editable until next
    // reconciliation. Better than denying the buyer their purchase.
    console.error("[cloneSoldComicToBuyer] Clone succeeded but failed to mark seller row sold:", markError);
  }

  return { success: true, buyerComicId: buyerRow.id };
}

// ============================================================================
// WATCHLIST
// ============================================================================

/**
 * Add auction to watchlist
 */
export async function addToWatchlist(userId: string, auctionId: string): Promise<void> {
  const { error } = await supabase.from("auction_watchlist").insert({
    user_id: userId,
    auction_id: auctionId,
  });

  // Ignore duplicate errors
  if (error && !error.message.includes("duplicate")) {
    throw error;
  }
}

/**
 * Remove auction from watchlist
 */
export async function removeFromWatchlist(userId: string, auctionId: string): Promise<void> {
  const { error } = await supabase
    .from("auction_watchlist")
    .delete()
    .eq("user_id", userId)
    .eq("auction_id", auctionId);

  if (error) throw error;
}

/**
 * Get user's watchlist
 */
export async function getUserWatchlist(userId: string): Promise<WatchlistItem[]> {
  const { data, error } = await supabase
    .from("auction_watchlist")
    .select(
      `
      *,
      auctions(*, comics!auctions_comic_id_fkey(*))
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((item) => ({
    id: item.id,
    userId: item.user_id,
    auctionId: item.auction_id,
    createdAt: item.created_at,
    auction: item.auctions ? transformDbAuction(item.auctions) : undefined,
  }));
}

/**
 * Check if user is watching an auction
 */
export async function isWatching(userId: string, auctionId: string): Promise<boolean> {
  const { data } = await supabase
    .from("auction_watchlist")
    .select("id")
    .eq("user_id", userId)
    .eq("auction_id", auctionId)
    .single();

  return !!data;
}

// ============================================================================
// OFFERS
// ============================================================================

/**
 * Create a new offer on a fixed-price listing
 */
export async function createOffer(
  buyerId: string,
  input: CreateOfferInput
): Promise<{ success: boolean; offer?: Offer; error?: string }> {
  // Get the listing
  const { data: listing } = await supabase
    .from("auctions")
    .select("*, profiles!auctions_seller_id_fkey(id)")
    .eq("id", input.listingId)
    .eq("status", "active")
    .eq("listing_type", "fixed_price")
    .single();

  if (!listing) {
    return { success: false, error: "Listing not found or no longer available" };
  }

  if (listing.seller_id === buyerId) {
    return { success: false, error: "You cannot make an offer on your own listing" };
  }

  if (!listing.accepts_offers) {
    return { success: false, error: "This listing does not accept offers" };
  }

  // Check if offer is below minimum
  if (listing.min_offer_amount && input.amount < listing.min_offer_amount) {
    // Auto-reject without notifying seller
    return { success: false, error: "Your offer is too low for this listing" };
  }

  // Check for existing pending offer from this buyer
  const { data: existingOffer } = await supabase
    .from("offers")
    .select("id, status, round_number")
    .eq("listing_id", input.listingId)
    .eq("buyer_id", buyerId)
    .in("status", ["pending", "countered"])
    .single();

  if (existingOffer) {
    return { success: false, error: "You already have an active offer on this listing" };
  }

  // Create the offer
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48);

  const { data, error } = await supabase
    .from("offers")
    .insert({
      listing_id: input.listingId,
      buyer_id: buyerId,
      seller_id: listing.seller_id,
      amount: input.amount,
      status: "pending",
      round_number: 1,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // Notify seller
  await createNotification(listing.seller_id, "offer_received", input.listingId, data.id);

  // Send offer_received email (fire and forget)
  (async () => {
    const [recipientProfile, otherProfile, comicData] = await Promise.all([
      getProfileForEmail(listing.seller_id),
      getProfileForEmail(buyerId),
      getListingComicData(input.listingId),
    ]);
    if (recipientProfile?.email && comicData) {
      sendNotificationEmail({
        to: recipientProfile.email,
        type: "offer_received",
        data: {
          buyerName: otherProfile?.displayName ?? "A buyer",
          sellerName: recipientProfile.displayName ?? "Seller",
          comicTitle: comicData.comicTitle,
          issueNumber: comicData.issueNumber,
          amount: input.amount,
          listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${input.listingId}`,
        },
      }).catch((err) => console.error("[Email] offer_received failed:", err));
    }
  })();

  // Audit trail — fire-and-forget.
  void logAuctionAuditEvent({
    auctionId: input.listingId,
    offerId: data.id,
    actorProfileId: buyerId,
    eventType: "offer_created",
    eventData: {
      amount: input.amount,
      roundNumber: 1,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return { success: true, offer: transformOffer(data) };
}

/**
 * Respond to an offer (accept, reject, or counter)
 */
export async function respondToOffer(
  sellerId: string,
  input: RespondToOfferInput
): Promise<{ success: boolean; offer?: Offer; error?: string }> {
  // Get the offer
  const { data: offer } = await supabase
    .from("offers")
    .select("*, auctions(*)")
    .eq("id", input.offerId)
    .eq("seller_id", sellerId)
    .single();

  if (!offer) {
    return { success: false, error: "Offer not found" };
  }

  if (offer.status !== "pending" && offer.status !== "countered") {
    return { success: false, error: "This offer can no longer be modified" };
  }

  const now = new Date().toISOString();

  if (input.action === "accept") {
    // Accept the offer - complete the sale
    const paymentDeadline = calculatePaymentDeadline();

    // Update offer status
    await supabase
      .from("offers")
      .update({ status: "accepted", responded_at: now })
      .eq("id", input.offerId);

    // Update listing to sold
    await supabase
      .from("auctions")
      .update({
        status: "sold",
        winner_id: offer.buyer_id,
        winning_bid: offer.amount,
        payment_status: "pending",
        payment_deadline: paymentDeadline.toISOString(),
      })
      .eq("id", offer.listing_id);

    // Notify buyer
    await createNotification(offer.buyer_id, "offer_accepted", offer.listing_id, input.offerId);

    // Send offer_accepted email (fire and forget)
    (async () => {
      const [recipientProfile, otherProfile, comicData] = await Promise.all([
        getProfileForEmail(offer.buyer_id),
        getProfileForEmail(sellerId),
        getListingComicData(offer.listing_id),
      ]);
      if (recipientProfile?.email && comicData) {
        sendNotificationEmail({
          to: recipientProfile.email,
          type: "offer_accepted",
          data: {
            buyerName: recipientProfile.displayName ?? "Buyer",
            sellerName: otherProfile?.displayName ?? "Seller",
            comicTitle: comicData.comicTitle,
            issueNumber: comicData.issueNumber,
            amount: offer.amount,
            listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${offer.listing_id}`,
          },
        }).catch((err) => console.error("[Email] offer_accepted failed:", err));
      }
    })();

    // Create feedback reminders for both parties (offer acceptance is a "sale")
    await createFeedbackReminders("sale", offer.listing_id, offer.buyer_id, sellerId);

    // Audit trail — fire-and-forget.
    void logAuctionAuditEvent({
      auctionId: offer.listing_id,
      offerId: input.offerId,
      actorProfileId: sellerId,
      eventType: "offer_accepted",
      eventData: {
        amount: offer.amount,
        roundNumber: offer.round_number,
        acceptedBy: "seller",
      },
    });

    return { success: true };
  }

  if (input.action === "reject") {
    await supabase
      .from("offers")
      .update({ status: "rejected", responded_at: now })
      .eq("id", input.offerId);

    // Notify buyer
    await createNotification(offer.buyer_id, "offer_rejected", offer.listing_id, input.offerId);

    // Send offer_rejected email (fire and forget)
    (async () => {
      const [recipientProfile, otherProfile, comicData] = await Promise.all([
        getProfileForEmail(offer.buyer_id),
        getProfileForEmail(sellerId),
        getListingComicData(offer.listing_id),
      ]);
      if (recipientProfile?.email && comicData) {
        sendNotificationEmail({
          to: recipientProfile.email,
          type: "offer_rejected",
          data: {
            buyerName: recipientProfile.displayName ?? "Buyer",
            sellerName: otherProfile?.displayName ?? "Seller",
            comicTitle: comicData.comicTitle,
            issueNumber: comicData.issueNumber,
            amount: offer.amount,
            listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${offer.listing_id}`,
          },
        }).catch((err) => console.error("[Email] offer_rejected failed:", err));
      }
    })();

    // Audit trail — fire-and-forget.
    void logAuctionAuditEvent({
      auctionId: offer.listing_id,
      offerId: input.offerId,
      actorProfileId: sellerId,
      eventType: "offer_rejected",
      eventData: {
        amount: offer.amount,
        roundNumber: offer.round_number,
        rejectedBy: "seller",
      },
    });

    return { success: true };
  }

  if (input.action === "counter") {
    if (!input.counterAmount) {
      return { success: false, error: "Counter amount is required" };
    }

    if (offer.round_number >= 3) {
      return { success: false, error: "Maximum negotiation rounds reached (3)" };
    }

    // Update offer with counter
    const newExpiresAt = new Date();
    newExpiresAt.setHours(newExpiresAt.getHours() + 48);

    const { data: updatedOffer, error } = await supabase
      .from("offers")
      .update({
        status: "countered",
        counter_amount: input.counterAmount,
        round_number: offer.round_number + 1,
        expires_at: newExpiresAt.toISOString(),
        responded_at: now,
      })
      .eq("id", input.offerId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Notify buyer
    await createNotification(offer.buyer_id, "offer_countered", offer.listing_id, input.offerId);

    // Send offer_countered email (fire and forget)
    (async () => {
      const [recipientProfile, otherProfile, comicData] = await Promise.all([
        getProfileForEmail(offer.buyer_id),
        getProfileForEmail(sellerId),
        getListingComicData(offer.listing_id),
      ]);
      if (recipientProfile?.email && comicData) {
        sendNotificationEmail({
          to: recipientProfile.email,
          type: "offer_countered",
          data: {
            buyerName: recipientProfile.displayName ?? "Buyer",
            sellerName: otherProfile?.displayName ?? "Seller",
            comicTitle: comicData.comicTitle,
            issueNumber: comicData.issueNumber,
            amount: offer.amount,
            counterAmount: input.counterAmount,
            listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${offer.listing_id}`,
          },
        }).catch((err) => console.error("[Email] offer_countered failed:", err));
      }
    })();

    // Audit trail — fire-and-forget.
    void logAuctionAuditEvent({
      auctionId: offer.listing_id,
      offerId: input.offerId,
      actorProfileId: sellerId,
      eventType: "offer_countered",
      eventData: {
        originalAmount: offer.amount,
        counterAmount: input.counterAmount,
        roundNumber: offer.round_number + 1,
        counteredBy: "seller",
        expiresAt: newExpiresAt.toISOString(),
      },
    });

    return { success: true, offer: transformOffer(updatedOffer) };
  }

  return { success: false, error: "Invalid action" };
}

/**
 * Respond to a counter-offer (buyer accepts or rejects)
 */
export async function respondToCounterOffer(
  buyerId: string,
  offerId: string,
  action: "accept" | "reject"
): Promise<{ success: boolean; error?: string }> {
  // Get the offer
  const { data: offer } = await supabase
    .from("offers")
    .select("*")
    .eq("id", offerId)
    .eq("buyer_id", buyerId)
    .eq("status", "countered")
    .single();

  if (!offer) {
    return { success: false, error: "Counter-offer not found" };
  }

  const now = new Date().toISOString();

  if (action === "accept") {
    // Accept the counter-offer
    const paymentDeadline = calculatePaymentDeadline();

    await supabase
      .from("offers")
      .update({ status: "accepted", amount: offer.counter_amount, responded_at: now })
      .eq("id", offerId);

    // Update listing to sold
    await supabase
      .from("auctions")
      .update({
        status: "sold",
        winner_id: buyerId,
        winning_bid: offer.counter_amount,
        payment_status: "pending",
        payment_deadline: paymentDeadline.toISOString(),
      })
      .eq("id", offer.listing_id);

    // Notify seller
    await createNotification(offer.seller_id, "offer_accepted", offer.listing_id, offerId);

    // Send offer_accepted email to seller (fire and forget)
    (async () => {
      const [recipientProfile, otherProfile, comicData] = await Promise.all([
        getProfileForEmail(offer.seller_id),
        getProfileForEmail(buyerId),
        getListingComicData(offer.listing_id),
      ]);
      if (recipientProfile?.email && comicData) {
        sendNotificationEmail({
          to: recipientProfile.email,
          type: "offer_accepted",
          data: {
            buyerName: otherProfile?.displayName ?? "Buyer",
            sellerName: recipientProfile.displayName ?? "Seller",
            comicTitle: comicData.comicTitle,
            issueNumber: comicData.issueNumber,
            amount: offer.counter_amount ?? offer.amount,
            listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${offer.listing_id}`,
          },
        }).catch((err) => console.error("[Email] offer_accepted (counter) failed:", err));
      }
    })();

    // Create feedback reminders for both parties (counter-offer acceptance is a "sale")
    await createFeedbackReminders("sale", offer.listing_id, buyerId, offer.seller_id);

    // Audit trail — fire-and-forget.
    void logAuctionAuditEvent({
      auctionId: offer.listing_id,
      offerId,
      actorProfileId: buyerId,
      eventType: "offer_accepted",
      eventData: {
        amount: offer.counter_amount,
        roundNumber: offer.round_number,
        acceptedBy: "buyer",
        counterOffer: true,
      },
    });

    return { success: true };
  }

  if (action === "reject") {
    await supabase
      .from("offers")
      .update({ status: "rejected", responded_at: now })
      .eq("id", offerId);

    // Notify seller
    await createNotification(offer.seller_id, "offer_rejected", offer.listing_id, offerId);

    // Send offer_rejected email to seller (fire and forget)
    (async () => {
      const [recipientProfile, otherProfile, comicData] = await Promise.all([
        getProfileForEmail(offer.seller_id),
        getProfileForEmail(buyerId),
        getListingComicData(offer.listing_id),
      ]);
      if (recipientProfile?.email && comicData) {
        sendNotificationEmail({
          to: recipientProfile.email,
          type: "offer_rejected",
          data: {
            buyerName: otherProfile?.displayName ?? "Buyer",
            sellerName: recipientProfile.displayName ?? "Seller",
            comicTitle: comicData.comicTitle,
            issueNumber: comicData.issueNumber,
            amount: offer.counter_amount ?? offer.amount,
            listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${offer.listing_id}`,
          },
        }).catch((err) => console.error("[Email] offer_rejected (counter) failed:", err));
      }
    })();

    // Audit trail — fire-and-forget.
    void logAuctionAuditEvent({
      auctionId: offer.listing_id,
      offerId,
      actorProfileId: buyerId,
      eventType: "offer_rejected",
      eventData: {
        amount: offer.counter_amount ?? offer.amount,
        roundNumber: offer.round_number,
        rejectedBy: "buyer",
        counterOffer: true,
      },
    });

    return { success: true };
  }

  return { success: false, error: "Invalid action" };
}

/**
 * Get offers for a listing (seller view)
 */
export async function getOffersForListing(listingId: string, sellerId: string): Promise<Offer[]> {
  const { data, error } = await supabase
    .from("offers")
    .select("*, profiles!offers_buyer_id_fkey(id, display_name, public_display_name)")
    .eq("listing_id", listingId)
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map(transformOffer);
}

/**
 * Get offers made by a buyer
 */
export async function getBuyerOffers(buyerId: string): Promise<Offer[]> {
  const { data, error } = await supabase
    .from("offers")
    .select("*, auctions(*)")
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map(transformOffer);
}

/**
 * Transform database offer to Offer type
 */
function transformOffer(data: Record<string, unknown>): Offer {
  return {
    id: data.id as string,
    listingId: data.listing_id as string,
    buyerId: data.buyer_id as string,
    sellerId: data.seller_id as string,
    amount: Number(data.amount),
    counterAmount: data.counter_amount ? Number(data.counter_amount) : null,
    status: data.status as OfferStatus,
    roundNumber: Number(data.round_number),
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    expiresAt: data.expires_at as string,
    respondedAt: (data.responded_at as string) || null,
  };
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * Create a notification
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  auctionId?: string,
  offerId?: string,
  overrides?: { title?: string; message?: string }
): Promise<void> {
  const titles: Record<NotificationType, string> = {
    outbid: "You've been outbid!",
    won: "Congratulations! You won!",
    ended: "Auction ended",
    bid_auction_lost: "Auction ended, you didn't win",
    new_bid_received: "New bid on your auction",
    payment_reminder: "Payment reminder",
    auction_payment_expired: "Auction cancelled: payment window expired",
    auction_payment_expired_seller: "Buyer did not pay in time",
    rating_request: "Leave feedback",
    auction_sold: "Your item sold!",
    payment_received: "Payment received",
    shipped: "Your comic has shipped!",
    // Offer notifications
    offer_received: "New offer received!",
    offer_accepted: "Your offer was accepted!",
    offer_rejected: "Offer declined",
    offer_countered: "Counter-offer received!",
    offer_expired: "Offer expired",
    // Listing expiration notifications
    listing_expiring: "Listing expiring soon",
    listing_expired: "Listing has expired",
    listing_cancelled: "Listing cancelled",
    // Follow system notifications
    new_listing_from_followed: "New listing from someone you follow",
    // Community contribution notifications
    key_info_approved: "Key info approved!",
    key_info_rejected: "Key info not accepted",
    // Second Chance Offer
    second_chance_available: "You can offer to the runner-up",
    second_chance_offered: "Second chance offer received!",
    second_chance_accepted: "Runner-up accepted your offer",
    second_chance_declined: "Runner-up declined your offer",
    second_chance_expired: "Runner-up didn't respond in time",
    // Payment-miss strike system
    payment_missed_warning: "Missed payment window",
    payment_missed_flagged: "Bidding temporarily restricted",
  };

  const messages: Record<NotificationType, string> = {
    outbid: "Someone has placed a higher bid on an auction you're watching.",
    won: "You've won an auction! Complete payment within 48 hours.",
    ended: "An auction you were watching has ended.",
    bid_auction_lost: "An auction you bid on has ended with another winner.",
    new_bid_received: "A bidder placed a new bid on one of your auctions.",
    payment_reminder: "Payment is due soon for your won auction.",
    auction_payment_expired: "Your payment window has expired. The auction has been cancelled.",
    auction_payment_expired_seller: "The winning bidder did not pay within the 48-hour window. The auction has been cancelled and you may re-list the comic.",
    rating_request: "Please leave feedback for your recent purchase.",
    auction_sold: "Your auction has ended with a winning bidder!",
    payment_received: "Payment has been received for your sold item.",
    shipped: "The seller marked your comic as shipped. The comic has been added to your collection.",
    // Offer messages
    offer_received: "Someone has made an offer on your listing. Review and respond.",
    offer_accepted: "The seller has accepted your offer! Complete payment within 48 hours.",
    offer_rejected: "Unfortunately, your offer was not accepted.",
    offer_countered: "The seller has made a counter-offer. Review and respond.",
    offer_expired: "Your offer has expired without a response.",
    // Listing expiration messages
    listing_expiring: "Your listing will expire in 24 hours. Consider renewing.",
    listing_expired: "Your listing has expired. Relist to continue selling.",
    listing_cancelled: "A listing you made an offer on has been cancelled by the seller.",
    // Follow system messages (fallback - dynamic messages created via notifyFollowersOfNewListing)
    new_listing_from_followed: "A seller you follow has listed a new item.",
    // Community contribution messages
    key_info_approved: "Your key info suggestion has been approved and added to the database. Thank you for contributing!",
    key_info_rejected: "Your key info suggestion was reviewed but not accepted. Thank you for contributing!",
    // Second Chance Offer
    second_chance_available: "The winner didn't pay. You can offer the item to the runner-up at their last bid.",
    second_chance_offered: "Good news: the seller has offered this comic to you at your last bid. You have 48 hours to accept or decline.",
    second_chance_accepted: "The runner-up accepted your second-chance offer. Payment is pending.",
    second_chance_declined: "The runner-up declined your second-chance offer. You can re-list the item.",
    second_chance_expired: "The runner-up didn't respond within 48 hours. You can re-list the item.",
    // Payment-miss strike system
    payment_missed_warning: "You missed a 48-hour payment window. This is a friendly warning. Next time may restrict bidding.",
    payment_missed_flagged: "Your bidding privileges are temporarily restricted due to multiple missed payments. Contact support to appeal.",
  };

  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    type,
    title: overrides?.title ?? titles[type],
    message: overrides?.message ?? messages[type],
    auction_id: auctionId || null,
    offer_id: offerId || null,
  });
}

/**
 * Notify all followers when a seller creates a new listing
 * Creates personalized notifications with comic details and price
 * Also sends emails to followers who have email notifications enabled
 */
export async function notifyFollowersOfNewListing(
  sellerId: string,
  listingId: string,
  comicTitle: string,
  price: number,
  listingType: ListingType,
  coverImageUrl?: string
): Promise<void> {
  // Get all follower IDs for this seller
  const followerIds = await getAllFollowerIds(sellerId);

  if (followerIds.length === 0) {
    return; // No followers to notify
  }

  // Get seller's display info for the notification
  const { data: sellerProfile } = await supabase
    .from("profiles")
    .select("username, display_name, public_display_name, display_preference")
    .eq("id", sellerId)
    .single();

  // Determine seller display name for notification
  let sellerDisplayName = "A seller";
  let sellerUsername = "seller";
  if (sellerProfile) {
    const { username, display_name, public_display_name, display_preference } = sellerProfile;
    sellerUsername = username || "seller";
    if (display_preference === "username_only" && username) {
      sellerDisplayName = `@${username}`;
    } else if (display_preference === "display_name_only" && (public_display_name || display_name)) {
      sellerDisplayName = public_display_name || display_name;
    } else if (display_preference === "both" && username) {
      sellerDisplayName = public_display_name || display_name
        ? `${public_display_name || display_name} (@${username})`
        : `@${username}`;
    } else if (username) {
      sellerDisplayName = `@${username}`;
    } else if (public_display_name || display_name) {
      sellerDisplayName = public_display_name || display_name;
    }
  }

  // Format the price
  const formattedPrice = `$${price.toFixed(2)}`;

  // Create notification message based on listing type
  const listingTypeText = listingType === "auction" ? "listed" : "listed";
  const title = "New listing from someone you follow";
  const message = `${sellerDisplayName} ${listingTypeText} ${comicTitle} for ${formattedPrice}`;

  // Create notifications for all followers
  // Using supabaseAdmin to bypass RLS and batch insert
  const notifications = followerIds.map((followerId) => ({
    user_id: followerId,
    type: "new_listing_from_followed" as const,
    title,
    message,
    auction_id: listingId,
    offer_id: null,
  }));

  // Batch insert notifications (Supabase handles this efficiently)
  const { error } = await supabaseAdmin.from("notifications").insert(notifications);

  if (error) {
    console.error("[auctionDb] Failed to notify followers of new listing:", error);
  }

  // Send emails to followers who have email notifications enabled
  // Query follower profiles with email preferences
  const { data: followerProfiles } = await supabaseAdmin
    .from("profiles")
    .select("id, email, msg_email_enabled")
    .in("id", followerIds)
    .eq("msg_email_enabled", true);

  if (!followerProfiles || followerProfiles.length === 0) {
    return; // No followers with email notifications enabled
  }

  // Build listing URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";
  const listingUrl = `${baseUrl}/shop/${listingId}`;

  // Send emails to each follower (fire and forget, don't block on email sending)
  for (const follower of followerProfiles) {
    if (follower.email) {
      sendNotificationEmail({
        to: follower.email,
        type: "new_listing_from_followed",
        data: {
          sellerName: sellerDisplayName,
          sellerUsername,
          comicTitle,
          price,
          listingUrl,
          coverImageUrl,
        },
      }).catch((err) => {
        console.error(`[auctionDb] Failed to send new listing email to ${follower.email}:`, err);
      });
    }
  }
}

/**
 * Get user's notifications
 */
export async function getUserNotifications(
  userId: string,
  unreadOnly = false
): Promise<Notification[]> {
  let query = supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map(transformNotificationRow);
}

function transformNotificationRow(n: Record<string, unknown>): Notification {
  return {
    id: n.id as string,
    userId: n.user_id as string,
    type: n.type as NotificationType,
    title: n.title as string,
    message: n.message as string,
    auctionId: (n.auction_id as string | null) ?? null,
    isRead: n.is_read as boolean,
    readAt: (n.read_at as string | null) ?? null,
    createdAt: n.created_at as string,
  };
}

/**
 * Paginated fetch for the inbox. Cursor-based on (created_at, id) DESC so
 * batch-inserted rows that share a timestamp don't go missing across page
 * boundaries.
 *
 * Returns up to `limit` rows plus a `nextCursor` if more rows exist
 * beyond the current page.
 */
export async function getUserNotificationsPaginated(
  userId: string,
  cursor: NotificationCursor | null,
  limit: number
): Promise<{ notifications: Notification[]; nextCursor: NotificationCursor | null }> {
  let query = supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1); // fetch one extra to detect "more rows beyond"

  if (cursor) {
    query = query.or(buildCursorFilter(cursor));
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data || []).map(transformNotificationRow);
  if (rows.length <= limit) {
    return { notifications: rows, nextCursor: null };
  }

  // We fetched one extra row to peek beyond the page; trim it and emit
  // the cursor for the NEXT page.
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    notifications: page,
    nextCursor: { createdAt: last.createdAt, id: last.id },
  };
}

/**
 * Fetch a single notification by id, scoped to the requesting user. Used
 * by the inbox `?focus=<id>` deep-link to surface a "Notification not
 * found — it may have been cleared" toast when the row has been pruned.
 *
 * Returns null on miss (treat as 404 — don't leak existence).
 */
export async function getNotificationByIdForUser(
  notificationId: string,
  userId: string
): Promise<Notification | null> {
  const { data } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return transformNotificationRow(data);
}

/**
 * Owner-scoped hard delete for a single notification. Returns true on
 * success (row was deleted), false if no matching row was found.
 */
export async function deleteNotificationForUser(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const { error, count } = await supabaseAdmin
    .from("notifications")
    .delete({ count: "exact" })
    .eq("id", notificationId)
    .eq("user_id", userId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/**
 * Cleanup helper for the cron pipeline.
 *
 * - Deletes notifications where read_at is older than 30 days (the user
 *   has acted on them; the row is now noise).
 * - Deletes unread notifications older than 90 days (long-stale; the
 *   user has clearly never engaged).
 *
 * Returns counts so the cron route can log how many rows were pruned.
 * Idempotent — calling repeatedly is safe; subsequent runs return zero.
 */
export async function pruneOldNotifications(): Promise<{
  deletedRead: number;
  deletedUnread: number;
}> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const readResult = await supabaseAdmin
    .from("notifications")
    .delete({ count: "exact" })
    .not("read_at", "is", null)
    .lt("read_at", thirtyDaysAgo);

  const unreadResult = await supabaseAdmin
    .from("notifications")
    .delete({ count: "exact" })
    .eq("is_read", false)
    .lt("created_at", ninetyDaysAgo);

  return {
    deletedRead: readResult.count ?? 0,
    deletedUnread: unreadResult.count ?? 0,
  };
}

/**
 * Mark a single notification as read.
 *
 * Owner-scoped — caller must pass the profile.id of the requesting user so
 * the UPDATE can never affect rows owned by anyone else. supabaseAdmin
 * bypasses RLS, so the .eq("user_id", userId) clause is the actual gate.
 *
 * Sets read_at = NOW() to drive the 30-day cleanup cron.
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<void> {
  await supabaseAdmin
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId);
}

/**
 * Mark all unread notifications for a user as read.
 *
 * Optional `asOf` clamps the UPDATE to notifications that existed at or
 * before that timestamp — prevents silently sweeping a notification that
 * was inserted between the user clicking "Mark all read" and the request
 * landing.
 *
 * Sets read_at = NOW() and narrows the UPDATE to only rows where read_at
 * is still NULL (idempotent — re-runs are no-ops).
 */
export async function markAllNotificationsRead(
  userId: string,
  asOf?: Date
): Promise<void> {
  let query = supabaseAdmin
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_read", false)
    .is("read_at", null);

  if (asOf) {
    query = query.lte("created_at", asOf.toISOString());
  }

  await query;
}

/**
 * Get unread notification count
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) throw error;

  return count || 0;
}

// ============================================================================
// SELLER RATINGS
// ============================================================================

/**
 * Submit a seller rating
 */
export async function submitSellerRating(
  buyerId: string,
  input: SubmitRatingInput
): Promise<{ success: boolean; error?: string }> {
  // Verify buyer won this auction
  const { data: auction } = await supabase
    .from("auctions")
    .select("winner_id, seller_id")
    .eq("id", input.auctionId)
    .single();

  if (!auction || auction.winner_id !== buyerId) {
    return { success: false, error: "You can only rate auctions you won" };
  }

  // Check for existing rating
  const { data: existingRating } = await supabase
    .from("seller_ratings")
    .select("id")
    .eq("buyer_id", buyerId)
    .eq("auction_id", input.auctionId)
    .single();

  if (existingRating) {
    return { success: false, error: "You have already rated this seller" };
  }

  const { error } = await supabase.from("seller_ratings").insert({
    seller_id: input.sellerId,
    buyer_id: buyerId,
    auction_id: input.auctionId,
    rating_type: input.ratingType,
    comment: input.comment || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Audit trail — buyer feedback marks the auction transaction as complete
  // from an audit standpoint (separate from the 7-day auto-complete sweep
  // which is not yet implemented — will be added under auction_completed
  // when that cron is built).
  void logAuctionAuditEvent({
    auctionId: input.auctionId,
    actorProfileId: buyerId,
    eventType: "auction_completed",
    eventData: {
      via: "buyer_feedback",
      ratingType: input.ratingType,
      sellerId: input.sellerId,
    },
  });

  return { success: true };
}

/**
 * Get ratings for a seller
 */
export async function getSellerRatings(sellerId: string, limit = 20): Promise<SellerRating[]> {
  const { data, error } = await supabase
    .from("seller_ratings")
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((r) => ({
    id: r.id,
    sellerId: r.seller_id,
    buyerId: r.buyer_id,
    auctionId: r.auction_id,
    ratingType: r.rating_type as "positive" | "negative",
    comment: r.comment,
    createdAt: r.created_at,
  }));
}

/**
 * Get seller profile with reputation
 */
export async function getSellerProfile(sellerId: string): Promise<SellerProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, public_display_name, username, display_preference, positive_ratings, negative_ratings, seller_since, location_city, location_state, location_country, location_privacy"
    )
    .eq("id", sellerId)
    .single();

  if (error || !data) return null;

  const { percentage, reputation } = calculateSellerReputation(
    data.positive_ratings || 0,
    data.negative_ratings || 0
  );

  return {
    id: data.id,
    displayName: data.display_name,
    publicDisplayName: data.public_display_name,
    username: data.username,
    displayPreference: data.display_preference,
    positiveRatings: data.positive_ratings || 0,
    negativeRatings: data.negative_ratings || 0,
    sellerSince: data.seller_since,
    locationCity: data.location_city,
    locationState: data.location_state,
    locationCountry: data.location_country,
    locationPrivacy: data.location_privacy,
    totalRatings: (data.positive_ratings || 0) + (data.negative_ratings || 0),
    positivePercentage: percentage,
    reputation,
  };
}

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

  // Get all active auctions that have ended
  const { data: endedAuctions, error } = await supabase
    .from("auctions")
    .select("*")
    .eq("status", "active")
    .lt("end_time", new Date().toISOString());

  if (error) {
    return { processed: 0, errors: [error.message] };
  }

  for (const auction of endedAuctions || []) {
    try {
      // Get winning bid
      const { data: winningBid } = await supabase
        .from("bids")
        .select("*")
        .eq("auction_id", auction.id)
        .eq("is_winning", true)
        .single();

      if (winningBid) {
        // Auction has a winner
        const paymentDeadline = calculatePaymentDeadline();

        // Idempotent guard: only transition from 'active' to 'ended'. If the
        // row is already in a finalized state (ended/sold/cancelled) because
        // this cron job already ran — or the auction row was tampered with —
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
          // Another concurrent run already ended this auction — don't re-notify.
          console.warn(`[processEndedAuctions] Skipping ${auction.id}: already finalized.`);
          continue;
        }

        const winnerId = winningBid.bidder_id;

        // Notify winner (in-app) + send auction_won email
        await createNotification(winnerId, "won", auction.id);

        // Notify seller (in-app) + send auction_sold email
        await createNotification(auction.seller_id, "auction_sold", auction.id);

        // Fire-and-forget emails for winner + seller
        (async () => {
          const [winnerProfile, sellerProfile, comicData] = await Promise.all([
            getProfileForEmail(winnerId),
            getProfileForEmail(auction.seller_id),
            getListingComicData(auction.id),
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
        // Do this BEFORE the watcher loop so we can de-dupe — a bidder who
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

        // Audit trail — queue auction_ended + bid_won, flushed at end.
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

        // Audit trail — no-bid auction expires as listing_expired.
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

  // Fire-and-forget batch audit flush — never blocks cron completion.
  void logAuctionAuditEvents(auditEvents);

  return { processed, errors };
}

// ============================================================================
// TRANSFORM HELPERS
// ============================================================================

function transformDbAuction(data: Record<string, unknown>): Auction {
  const comics = data.comics as Record<string, unknown> | undefined;
  const profile = data.profiles as Record<string, unknown> | undefined;

  const auction: Auction = {
    id: data.id as string,
    sellerId: data.seller_id as string,
    comicId: data.comic_id as string,
    listingType: (data.listing_type as ListingType) || "auction",
    startingPrice: Number(data.starting_price),
    currentBid: data.current_bid ? Number(data.current_bid) : null,
    buyItNowPrice: data.buy_it_now_price ? Number(data.buy_it_now_price) : null,
    startTime: data.start_time as string,
    endTime: data.end_time as string,
    status: data.status as Auction["status"],
    winnerId: (data.winner_id as string) || null,
    winningBid: data.winning_bid ? Number(data.winning_bid) : null,
    shippingCost: Number(data.shipping_cost || 0),
    detailImages: (data.detail_images as string[]) || [],
    description: (data.description as string) || null,
    bidCount: Number(data.bid_count || 0),
    paymentStatus: (data.payment_status as Auction["paymentStatus"]) || null,
    paymentDeadline: (data.payment_deadline as string) || null,
    shippedAt: (data.shipped_at as string) || null,
    trackingNumber: (data.tracking_number as string) || null,
    trackingCarrier: (data.tracking_carrier as string) || null,
    acceptsOffers: (data.accepts_offers as boolean) || false,
    minOfferAmount: data.min_offer_amount ? Number(data.min_offer_amount) : null,
    expiresAt: (data.expires_at as string) || null,
    cancelReason: (data.cancel_reason as Auction["cancelReason"]) || null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };

  // Add joined comic data if present
  if (comics) {
    auction.comic = {
      id: comics.id as string,
      comic: {
        id: comics.id as string,
        title: comics.title as string | null,
        issueNumber: comics.issue_number as string | null,
        variant: comics.variant as string | null,
        publisher: comics.publisher as string | null,
        coverArtist: comics.cover_artist as string | null,
        writer: comics.writer as string | null,
        interiorArtist: comics.interior_artist as string | null,
        releaseYear: comics.release_year as string | null,
        confidence: (comics.confidence as "high" | "medium" | "low") || "medium",
        isSlabbed: comics.is_slabbed as boolean,
        gradingCompany: comics.grading_company as "CGC" | "CBCS" | "PGX" | "Other" | null,
        grade: comics.grade as string | null,
        certificationNumber: comics.certification_number as string | null,
        labelType: comics.label_type as string | null,
        pageQuality: comics.page_quality as string | null,
        isSignatureSeries: comics.is_signature_series as boolean,
        signedBy: comics.signed_by as string | null,
        priceData: comics.price_data as PriceData | null,
        keyInfo: (comics.key_info as string[]) || [],
        gradeDate: comics.grade_date as string | null,
        graderNotes: comics.grader_notes as string | null,
      },
      coverImageUrl: comics.cover_image_url as string,
      conditionGrade: comics.condition_grade as number | null,
      conditionLabel: comics.condition_label as ConditionLabel | null,
      isGraded: comics.is_graded as boolean,
      gradingCompany: comics.grading_company as string | null,
      purchasePrice: comics.purchase_price as number | null,
      purchaseDate: comics.purchase_date as string | null,
      notes: comics.notes as string | null,
      forSale: comics.for_sale as boolean,
      forTrade: (comics.for_trade as boolean) || false,
      askingPrice: comics.asking_price as number | null,
      averagePrice: comics.average_price as number | null,
      dateAdded: comics.date_added as string,
      listIds: [],
      isStarred: comics.is_starred as boolean,
      customKeyInfo: filterCustomKeyInfoForPublic(
        (comics.custom_key_info as string[]) || [],
        comics.custom_key_info_status as
          | "pending"
          | "approved"
          | "rejected"
          | null
      ),
      customKeyInfoStatus: comics.custom_key_info_status as "pending" | "approved" | "rejected" | null,
    };
  }

  // Add seller profile if present
  if (profile) {
    const { percentage, reputation } = calculateSellerReputation(
      (profile.positive_ratings as number) || 0,
      (profile.negative_ratings as number) || 0
    );

    // Generate a fallback display name from email if no name is set
    let fallbackName: string | null = null;
    if (
      !profile.display_name &&
      !profile.public_display_name &&
      !profile.username &&
      profile.email
    ) {
      const email = profile.email as string;
      const emailUsername = email.split("@")[0];
      fallbackName = emailUsername;
    }

    auction.seller = {
      id: profile.id as string,
      displayName: (profile.display_name as string | null) || fallbackName,
      publicDisplayName: profile.public_display_name as string | null,
      username: profile.username as string | null,
      displayPreference: profile.display_preference as
        | "username_only"
        | "display_name_only"
        | "both"
        | null,
      positiveRatings: (profile.positive_ratings as number) || 0,
      negativeRatings: (profile.negative_ratings as number) || 0,
      sellerSince: profile.seller_since as string | null,
      locationCity: profile.location_city as string | null,
      locationState: profile.location_state as string | null,
      locationCountry: profile.location_country as string | null,
      locationPrivacy: profile.location_privacy as
        | "full"
        | "state_country"
        | "country_only"
        | "hidden"
        | null,
      totalRatings:
        ((profile.positive_ratings as number) || 0) + ((profile.negative_ratings as number) || 0),
      positivePercentage: percentage,
      reputation,
    };
  }

  return auction;
}

function transformDbBid(data: Record<string, unknown>): Bid {
  return {
    id: data.id as string,
    auctionId: data.auction_id as string,
    bidderId: data.bidder_id as string,
    bidAmount: Number(data.bid_amount),
    maxBid: Number(data.max_bid),
    bidderNumber: Number(data.bidder_number),
    isWinning: data.is_winning as boolean,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
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
    .lt("expires_at", new Date().toISOString());

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

  // Audit trail — batch all offer_expired events.
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
    .lt("expires_at", oneDayFromNow.toISOString());

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
          .single();

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
    .lt("expires_at", now.toISOString());

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

  // Audit trail — batch listing_expired events for fixed-price listings
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
      .is("payment_reminder_sent_at", null);

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
 * Does NOT promote a second-highest bidder — that's out of scope (see
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
      .is("payment_expired_at", null);

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

    // Audit trail — batch auction_payment_expired events for all claimed
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
    // normally — covering the case where the runner-up accepted but didn't
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

    // Phase 4: Per-claimed-auction side effects — runner-up discovery +
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

// ============================================================================
// SECOND CHANCE OFFERS + PAYMENT-MISS STRIKE SYSTEM
// ----------------------------------------------------------------------------
// Added April 23, 2026. These helpers run after expireUnpaidAuctions flips
// an auction to "cancelled":
//   1. handleRunnerUpForExpiredAuction — finds runner-up, notifies seller
//      that they can trigger a Second Chance Offer.
//   2. recordPaymentMissStrike — increments the missed-payment counter on
//      the no-pay winner, warns on first offense, flags on second within
//      the rolling 90-day window.
//   3. createSecondChanceOffer — seller calls this to re-offer to the
//      runner-up at their last actual bid price. 48-hour window.
//   4. respondToSecondChanceOffer — runner-up accepts or declines.
//   5. expireSecondChanceOffers — cron pass that flips unanswered
//      second-chance offers to "expired" and notifies the seller.
// ============================================================================

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

function transformDbSecondChanceOffer(
  row: Record<string, unknown>
): SecondChanceOffer {
  return {
    id: row.id as string,
    auctionId: row.auction_id as string,
    runnerUpProfileId: row.runner_up_profile_id as string,
    offerPrice: Number(row.offer_price),
    status: row.status as SecondChanceOffer["status"],
    expiresAt: row.expires_at as string,
    acceptedAt: (row.accepted_at as string | null) ?? null,
    declinedAt: (row.declined_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/**
 * Find the runner-up bidder for a cancelled auction and notify the seller
 * they can initiate a Second Chance Offer. Idempotent: if an offer was
 * already created (e.g., cron re-ran) it won't double-notify.
 *
 * "Runner-up" is the next-highest unique bidder by bid_amount (last actual
 * bid, NOT max_bid), excluding the missed-payment winner.
 */
async function handleRunnerUpForExpiredAuction(
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
async function recordPaymentMissStrike(
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
    .single();

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
  // its event fire-and-forget — depending on timing, that row may or may
  // not be visible yet, so we count it explicitly via `+1` below and only
  // treat rows with an older timestamp as "prior" here.
  const windowStart = new Date(
    Date.now() - PAYMENT_MISS_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { count: priorStrikesRaw } = await supabaseAdmin
    .from("auction_audit_log")
    .select("id", { count: "exact", head: true })
    .eq("actor_profile_id", bidderId)
    .eq("event_type", "auction_payment_expired")
    .gte("created_at", windowStart);

  const priorStrikes = priorStrikesRaw ?? 0;
  // +1 for the current miss (it may or may not be in the audit log yet).
  const totalStrikesInWindow = priorStrikes + 1;

  const comicData = await getListingComicData(auctionId).catch(() => null);
  const bidderProfile = await getProfileForEmail(bidderId).catch(() => null);

  if (totalStrikesInWindow < PAYMENT_MISS_STRIKE_THRESHOLD) {
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

  // Threshold reached — flag the user. Idempotent: only apply if not already
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
    // null-safe path — if seller_ratings insert fails (e.g., unique buyer+auction
    // constraint from an earlier run), we swallow the error.
    try {
      await supabaseAdmin.from("seller_ratings").insert({
        seller_id: bidderId, // flag the bidder's reputation specifically
        buyer_id: bidderId, // system self-rating: using same id is intentional — see COMMENT
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

    // Conditional UPDATE — bail cleanly if another request already moved it.
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
      // We've already accepted the offer — return success but surface the
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
 * Cron pass — expire any Second Chance Offer whose 48-hour window has
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
      .lt("expires_at", now.toISOString());

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
 * Read a pending Second Chance Offer for a runner-up (if any exists) —
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
