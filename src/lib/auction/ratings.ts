// AUTO-EXTRACTED from auctionDb.ts during R1-auctiondb refactor (M-AU9).
// Behavior-preserving: function bodies moved verbatim.

import {
  SellerProfile,
  SellerRating,
  SubmitRatingInput,
  calculateSellerReputation,
} from "@/types/auction";

import { logAuctionAuditEvent } from "../auditLog";
import { supabase } from "../supabase";

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
    .maybeSingle();

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

  // Audit trail - buyer feedback marks the auction transaction as complete
  // from an audit standpoint (separate from the 7-day auto-complete sweep
  // which is not yet implemented - will be added under auction_completed
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
