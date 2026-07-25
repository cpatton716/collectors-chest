// AUTO-EXTRACTED from auctionDb.ts during R1-auctiondb refactor (M-AU9).
// Behavior-preserving: function bodies moved verbatim.

import {
  Auction,
  AuctionFilters,
  AuctionSortBy,
  CancelReason,
  CreateAuctionInput,
  CreateFixedPriceListingInput,
  SecondChanceOffer,
  UpdateAuctionInput,
} from "@/types/auction";

import { logAuctionAuditEvent } from "../auditLog";
import { getSubscriptionStatus, getTransactionFeePercent } from "../subscription";
import { supabase, supabaseAdmin } from "../supabase";
import { AUCTION_COLUMNS, COMIC_COLUMNS, AUCTION_WITH_COMIC_SELECT } from "./columns";
import { transformDbAuction, transformDbBid } from "./transforms";
import { createNotification, notifyFollowersOfNewListing } from "./notifications";

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
    .maybeSingle();

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

  // Audit trail - fire-and-forget, never blocks the creation path.
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

  // Audit trail - fire-and-forget.
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
      ${AUCTION_COLUMNS},
      comics!auctions_comic_id_fkey(${COMIC_COLUMNS}),
      profiles!auctions_seller_id_fkey(id, display_name, public_display_name, email, positive_ratings, negative_ratings, seller_since, username, display_preference, location_city, location_state, location_country, location_privacy)
    `
    )
    .eq("id", auctionId)
    .single();

  if (error || !data) return null;

  // Cast: explicit column-list select defeats Supabase's literal-only type
  // parser (see getActiveAuctions).
  const auction = transformDbAuction(data as unknown as Record<string, unknown>);

  // Check if user is the seller or watching
  if (userId) {
    auction.isSeller = auction.sellerId === userId;

    const { data: watchData } = await supabase
      .from("auction_watchlist")
      .select("id")
      .eq("auction_id", auctionId)
      .eq("user_id", userId)
      .maybeSingle();

    auction.isWatching = !!watchData;

    // Get user's current bid
    const { data: bidData } = await supabase
      .from("bids")
      .select("*")
      .eq("auction_id", auctionId)
      .eq("bidder_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

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
    // Must use supabaseAdmin: second_chance_offers RLS gates SELECT on
    // current_setting('request.jwt.claims') which our Clerk-authed sessions
    // do not provide. Caller already verified auction.isSeller before reaching
    // here, so service-role read is owner-scoped at the call site.
    supabaseAdmin
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
  let query = supabase
    .from("auctions")
    .select(AUCTION_WITH_COMIC_SELECT, { count: "exact" });

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
    // Cast: the explicit column-list select is built from a constant string,
    // which Supabase's literal-only type parser can't introspect, so it
    // widens rows to a parser-error type. transformDbAuction reads loosely.
    auctions: ((data as unknown as Record<string, unknown>[]) || []).map(
      transformDbAuction
    ),
    total: count || 0,
  };
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
    .select("listing_type, status")
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

  // For auctions, check that there are no bids. Query the bids table directly
  // rather than trusting the cached bid_count column — a stale/incorrect
  // counter must never let a seller cancel an auction that actually has bids.
  // L-AU10.
  if (auction.listing_type === "auction") {
    const { count: bidCount } = await supabase
      .from("bids")
      .select("id", { count: "exact", head: true })
      .eq("auction_id", auctionId);

    if ((bidCount ?? 0) > 0) {
      return { success: false, error: "Cannot cancel auction with bids" };
    }
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

      // Notify each buyer that the listing was cancelled. Fan out in parallel
      // rather than awaiting each insert serially. L-AU11.
      await Promise.all(
        pendingOffers.map((offer) =>
          createNotification(offer.buyer_id, "listing_cancelled", auctionId, offer.id)
        )
      );
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

  // Audit trail - fire-and-forget.
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
