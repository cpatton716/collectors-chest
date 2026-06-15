// AUTO-EXTRACTED from auctionDb.ts during R1-auctiondb refactor (M-AU9).
// Behavior-preserving: function bodies moved verbatim.

import {
  Auction,
  Bid,
  ListingType,
  Notification,
  NotificationType,
  Offer,
  OfferStatus,
  SecondChanceOffer,
  calculateSellerReputation,
} from "@/types/auction";
import { ConditionLabel, PriceData } from "@/types/comic";

import { filterCustomKeyInfoForPublic } from "../keyInfoHelpers";

/**
 * Transform database offer to Offer type
 */
export function transformOffer(data: Record<string, unknown>): Offer {
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

export function transformNotificationRow(n: Record<string, unknown>): Notification {
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

// ============================================================================
// TRANSFORM HELPERS
// ============================================================================

export function transformDbAuction(data: Record<string, unknown>): Auction {
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

export function transformDbBid(data: Record<string, unknown>): Bid {
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

export function transformDbSecondChanceOffer(
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
