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
  PlaceBidResult,
  RespondToOfferInput,
  SellerProfile,
  SellerRating,
  SubmitRatingInput,
  UpdateAuctionInput,
  WatchlistItem,
  calculateMinimumBid,
  calculateSellerReputation,
  getBidIncrement,
} from "@/types/auction";
import { CollectionItem, ConditionLabel, PriceData } from "@/types/comic";

import { sendNotificationEmail, getProfileForEmail, getListingComicData } from "./email";
import { createFeedbackReminders } from "./creatorCreditsDb";
import { getAllFollowerIds } from "./followDb";
import { filterCustomKeyInfoForPublic } from "./keyInfoHelpers";
import { getSubscriptionStatus, getTransactionFeePercent } from "./subscription";
import { supabase, supabaseAdmin } from "./supabase";

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
      comics(*),
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

  return auction;
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
      comics(*)
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
      comics(*)
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
      comics(*)
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

    // Update existing bid
    await supabase
      .from("bids")
      .update({ max_bid: maxBid, updated_at: new Date().toISOString() })
      .eq("id", currentWinningBid.id);

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
      await supabase.from("bids").update({ is_winning: false }).eq("id", currentWinningBid.id);
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
      await supabase.from("auctions").update({ current_bid: newCurrentBid }).eq("id", auctionId);
    }
  }

  // Create new bid
  const { data: newBid, error: bidError } = await supabase
    .from("bids")
    .insert({
      auction_id: auctionId,
      bidder_id: bidderId,
      bid_amount: newCurrentBid,
      max_bid: maxBid,
      bidder_number: bidderNumber,
      is_winning: isHighBidder,
    })
    .select()
    .single();

  if (bidError) {
    return { success: false, message: bidError.message };
  }

  // Update auction
  await supabase
    .from("auctions")
    .update({
      current_bid: newCurrentBid,
      bid_count: auction.bid_count + 1,
    })
    .eq("id", auctionId);

  // Send outbid notification
  if (outbidUserId) {
    await createNotification(outbidUserId, "outbid", auctionId);
  }

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
  const paymentDeadline = new Date();
  paymentDeadline.setHours(paymentDeadline.getHours() + 48);

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

  return { success: true };
}

/**
 * Purchase a fixed-price listing
 */
export async function purchaseFixedPriceListing(
  listingId: string,
  buyerId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: listing } = await supabase
    .from("auctions")
    .select("*")
    .eq("id", listingId)
    .eq("status", "active")
    .eq("listing_type", "fixed_price")
    .single();

  if (!listing) {
    return { success: false, error: "Listing not found or no longer available" };
  }

  if (listing.seller_id === buyerId) {
    return { success: false, error: "You cannot buy your own item" };
  }

  // Complete the purchase
  const paymentDeadline = new Date();
  paymentDeadline.setHours(paymentDeadline.getHours() + 48);

  const { error } = await supabase
    .from("auctions")
    .update({
      status: "sold",
      winner_id: buyerId,
      winning_bid: listing.starting_price, // The fixed price
      payment_status: "pending",
      payment_deadline: paymentDeadline.toISOString(),
    })
    .eq("id", listingId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Notify seller
  await createNotification(listing.seller_id, "auction_sold", listingId);

  // Notify buyer
  await createNotification(buyerId, "won", listingId);

  // Create feedback reminders for both parties (fixed_price uses "sale" transaction type)
  await createFeedbackReminders("sale", listingId, buyerId, listing.seller_id);

  return { success: true };
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
      auctions(*, comics(*))
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
    const paymentDeadline = new Date();
    paymentDeadline.setHours(paymentDeadline.getHours() + 48);

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
    const paymentDeadline = new Date();
    paymentDeadline.setHours(paymentDeadline.getHours() + 48);

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
  offerId?: string
): Promise<void> {
  const titles: Record<NotificationType, string> = {
    outbid: "You've been outbid!",
    won: "Congratulations! You won!",
    ended: "Auction ended",
    payment_reminder: "Payment reminder",
    rating_request: "Leave feedback",
    auction_sold: "Your item sold!",
    payment_received: "Payment received",
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
  };

  const messages: Record<NotificationType, string> = {
    outbid: "Someone has placed a higher bid on an auction you're watching.",
    won: "You've won an auction! Complete payment within 48 hours.",
    ended: "An auction you were watching has ended.",
    payment_reminder: "Payment is due soon for your won auction.",
    rating_request: "Please leave feedback for your recent purchase.",
    auction_sold: "Your auction has ended with a winning bidder!",
    payment_received: "Payment has been received for your sold item.",
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
  };

  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    type,
    title: titles[type],
    message: messages[type],
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

  return (data || []).map((n) => ({
    id: n.id,
    userId: n.user_id,
    type: n.type as NotificationType,
    title: n.title,
    message: n.message,
    auctionId: n.auction_id,
    isRead: n.is_read,
    createdAt: n.created_at,
  }));
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  await supabaseAdmin.from("notifications").update({ is_read: true }).eq("id", notificationId);
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  await supabaseAdmin
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
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
        const paymentDeadline = new Date();
        paymentDeadline.setHours(paymentDeadline.getHours() + 48);

        await supabase
          .from("auctions")
          .update({
            status: "ended",
            winner_id: winningBid.bidder_id,
            winning_bid: winningBid.bid_amount,
            payment_status: "pending",
            payment_deadline: paymentDeadline.toISOString(),
          })
          .eq("id", auction.id);

        // Notify winner
        await createNotification(winningBid.bidder_id, "won", auction.id);

        // Notify seller
        await createNotification(auction.seller_id, "auction_sold", auction.id);

        // Notify watchers
        const { data: watchers } = await supabase
          .from("auction_watchlist")
          .select("user_id")
          .eq("auction_id", auction.id);

        for (const watcher of watchers || []) {
          if (watcher.user_id !== winningBid.bidder_id && watcher.user_id !== auction.seller_id) {
            await createNotification(watcher.user_id, "ended", auction.id);
          }
        }

        // Create feedback reminders for both parties
        await createFeedbackReminders("auction", auction.id, winningBid.bidder_id, auction.seller_id);
      } else {
        // No bids, just end it
        await supabase.from("auctions").update({ status: "ended" }).eq("id", auction.id);
      }

      processed++;
    } catch (e) {
      errors.push(`Auction ${auction.id}: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

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

  // Get offers that need to expire with related data for emails
  const { data: expiredOffers, error: fetchError } = await supabase
    .from("offers")
    .select(
      `
      id, buyer_id, seller_id, listing_id, amount, status,
      auctions!inner(id, comic_id, collection_items!inner(id, comic))
    `
    )
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
