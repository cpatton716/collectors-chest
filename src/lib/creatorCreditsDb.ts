/**
 * Creator Credits & Feedback Database Functions
 *
 * Server-side database operations for the creator credits and transaction feedback system.
 * Uses supabaseAdmin to bypass RLS - only use in API routes.
 */

import { supabaseAdmin } from "./supabase";
import {
  TransactionFeedback,
  SubmitFeedbackInput,
  UpdateFeedbackInput,
  SellerResponseInput,
  TransactionType,
  FeedbackEligibility,
  UserCreatorProfile,
  TransactionTrust,
  CreatorBadgeInfo,
  ContributionType,
  CommunityContribution,
  calculateTransactionTrust,
  calculateCreatorBadge,
  isFeedbackEditable,
  isSellerResponseEditable,
} from "@/types/creatorCredits";

// ============================================================================
// DATABASE ROW TYPES (snake_case from Postgres)
// ============================================================================

interface FeedbackRow {
  id: string;
  transaction_type: TransactionType;
  transaction_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating_type: "positive" | "negative";
  comment: string | null;
  seller_response: string | null;
  seller_response_at: string | null;
  created_at: string;
  updated_at: string | null;
  // Joined fields from profiles
  reviewer?: {
    first_name: string | null;
    last_name: string | null;
    username: string | null;
  };
}

interface ProfileRow {
  positive_ratings: number;
  negative_ratings: number;
  community_contribution_count: number;
}

interface ContributionRow {
  id: string;
  user_id: string;
  contribution_type: ContributionType;
  reference_id: string | null;
  created_at: string;
}

// ============================================================================
// TRANSFORM HELPERS
// ============================================================================

/**
 * Transform database row to TransactionFeedback type
 */
export function transformFeedback(row: FeedbackRow): TransactionFeedback {
  const reviewerName =
    row.reviewer?.first_name && row.reviewer?.last_name
      ? `${row.reviewer.first_name} ${row.reviewer.last_name}`
      : row.reviewer?.first_name || row.reviewer?.last_name || undefined;

  return {
    id: row.id,
    transactionType: row.transaction_type,
    transactionId: row.transaction_id,
    reviewerId: row.reviewer_id,
    revieweeId: row.reviewee_id,
    ratingType: row.rating_type,
    comment: row.comment,
    sellerResponse: row.seller_response,
    sellerResponseAt: row.seller_response_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewerName,
    reviewerUsername: row.reviewer?.username || undefined,
  };
}

function transformContribution(row: ContributionRow): CommunityContribution {
  return {
    id: row.id,
    userId: row.user_id,
    contributionType: row.contribution_type,
    referenceId: row.reference_id,
    createdAt: row.created_at,
  };
}

// ============================================================================
// FEEDBACK REMINDERS
// ============================================================================

/**
 * Create feedback reminder records for a completed transaction
 * Called when trades complete or auctions are sold/shipped
 */
export async function createFeedbackReminders(
  transactionType: TransactionType,
  transactionId: string,
  buyerId: string,
  sellerId: string
): Promise<void> {
  const reminders = [
    {
      transaction_type: transactionType,
      transaction_id: transactionId,
      user_id: buyerId,
      role: "buyer",
    },
    {
      transaction_type: transactionType,
      transaction_id: transactionId,
      user_id: sellerId,
      role: "seller",
    },
  ];

  const { error } = await supabaseAdmin
    .from("feedback_reminders")
    .upsert(reminders, { onConflict: "transaction_id,transaction_type,user_id" });

  if (error) {
    console.error("[creatorCreditsDb] Failed to create feedback reminders:", error);
  }
}

// ============================================================================
// FEEDBACK SUBMISSION
// ============================================================================

/**
 * Submit new feedback for a transaction
 * Also marks any pending reminder as complete
 */
export async function submitFeedback(
  reviewerId: string,
  input: SubmitFeedbackInput
): Promise<{ feedback: TransactionFeedback | null; error: string | null }> {
  // Check eligibility first
  const eligibility = await checkFeedbackEligibility(
    reviewerId,
    input.transactionId,
    input.transactionType
  );

  if (!eligibility.canLeaveFeedback) {
    return { feedback: null, error: eligibility.reason || "Not eligible to leave feedback" };
  }

  // Check if feedback already exists
  const { data: existing } = await supabaseAdmin
    .from("transaction_feedback")
    .select("id")
    .eq("transaction_id", input.transactionId)
    .eq("transaction_type", input.transactionType)
    .eq("reviewer_id", reviewerId)
    .single();

  if (existing) {
    return { feedback: null, error: "Feedback already submitted for this transaction" };
  }

  // Insert feedback
  const { data, error } = await supabaseAdmin
    .from("transaction_feedback")
    .insert({
      transaction_type: input.transactionType,
      transaction_id: input.transactionId,
      reviewer_id: reviewerId,
      reviewee_id: input.revieweeId,
      rating_type: input.ratingType,
      comment: input.comment || null,
    })
    .select(
      `
      *,
      reviewer:profiles!reviewer_id(first_name, last_name, username)
    `
    )
    .single();

  if (error) {
    console.error("[creatorCreditsDb] Failed to submit feedback:", error);
    return { feedback: null, error: "Failed to submit feedback" };
  }

  // Update reviewee's rating counts
  const countField = input.ratingType === "positive" ? "positive_ratings" : "negative_ratings";
  await supabaseAdmin.rpc("increment_field", {
    table_name: "profiles",
    field_name: countField,
    row_id: input.revieweeId,
    increment_value: 1,
  });

  // Mark reminder as complete if exists
  await supabaseAdmin
    .from("feedback_reminders")
    .update({ feedback_left_at: new Date().toISOString() })
    .eq("transaction_id", input.transactionId)
    .eq("transaction_type", input.transactionType)
    .eq("user_id", reviewerId)
    .is("feedback_left_at", null);

  return { feedback: transformFeedback(data as FeedbackRow), error: null };
}

/**
 * Update existing feedback within 7-day edit window
 */
export async function updateFeedback(
  reviewerId: string,
  feedbackId: string,
  input: UpdateFeedbackInput
): Promise<{ feedback: TransactionFeedback | null; error: string | null }> {
  // Get existing feedback
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("transaction_feedback")
    .select("*")
    .eq("id", feedbackId)
    .eq("reviewer_id", reviewerId)
    .single();

  if (fetchError || !existing) {
    return { feedback: null, error: "Feedback not found or not authorized" };
  }

  // Check edit window
  if (!isFeedbackEditable(existing.created_at)) {
    return { feedback: null, error: "Feedback can only be edited within 7 days of submission" };
  }

  // Build update object
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.comment !== undefined) {
    updates.comment = input.comment || null;
  }

  // Handle rating type change
  if (input.ratingType !== undefined && input.ratingType !== existing.rating_type) {
    updates.rating_type = input.ratingType;

    // Update reviewee's rating counts (decrement old, increment new)
    const oldField = existing.rating_type === "positive" ? "positive_ratings" : "negative_ratings";
    const newField = input.ratingType === "positive" ? "positive_ratings" : "negative_ratings";

    await supabaseAdmin.rpc("increment_field", {
      table_name: "profiles",
      field_name: oldField,
      row_id: existing.reviewee_id,
      increment_value: -1,
    });

    await supabaseAdmin.rpc("increment_field", {
      table_name: "profiles",
      field_name: newField,
      row_id: existing.reviewee_id,
      increment_value: 1,
    });
  }

  // Update feedback
  const { data, error } = await supabaseAdmin
    .from("transaction_feedback")
    .update(updates)
    .eq("id", feedbackId)
    .select(
      `
      *,
      reviewer:profiles!reviewer_id(first_name, last_name, username)
    `
    )
    .single();

  if (error) {
    console.error("[creatorCreditsDb] Failed to update feedback:", error);
    return { feedback: null, error: "Failed to update feedback" };
  }

  return { feedback: transformFeedback(data as FeedbackRow), error: null };
}

/**
 * Add seller response to negative feedback (48hr edit window)
 */
export async function addSellerResponse(
  sellerId: string,
  feedbackId: string,
  input: SellerResponseInput
): Promise<{ feedback: TransactionFeedback | null; error: string | null }> {
  // Get existing feedback
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("transaction_feedback")
    .select("*")
    .eq("id", feedbackId)
    .eq("reviewee_id", sellerId)
    .single();

  if (fetchError || !existing) {
    return { feedback: null, error: "Feedback not found or not authorized" };
  }

  // Only allow responses to negative feedback
  if (existing.rating_type !== "negative") {
    return { feedback: null, error: "Can only respond to negative feedback" };
  }

  // Check if already responded and within edit window
  if (existing.seller_response_at && !isSellerResponseEditable(existing.seller_response_at)) {
    return { feedback: null, error: "Response can only be edited within 48 hours" };
  }

  // Update with response
  const { data, error } = await supabaseAdmin
    .from("transaction_feedback")
    .update({
      seller_response: input.response,
      seller_response_at: new Date().toISOString(),
    })
    .eq("id", feedbackId)
    .select(
      `
      *,
      reviewer:profiles!reviewer_id(first_name, last_name, username)
    `
    )
    .single();

  if (error) {
    console.error("[creatorCreditsDb] Failed to add seller response:", error);
    return { feedback: null, error: "Failed to add response" };
  }

  return { feedback: transformFeedback(data as FeedbackRow), error: null };
}

// ============================================================================
// FEEDBACK RETRIEVAL
// ============================================================================

/**
 * Get feedback received by a user with pagination
 */
export async function getUserFeedback(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ feedback: TransactionFeedback[]; total: number; error: string | null }> {
  // Get total count
  const { count } = await supabaseAdmin
    .from("transaction_feedback")
    .select("*", { count: "exact", head: true })
    .eq("reviewee_id", userId);

  // Get paginated feedback
  const { data, error } = await supabaseAdmin
    .from("transaction_feedback")
    .select(
      `
      *,
      reviewer:profiles!reviewer_id(first_name, last_name, username)
    `
    )
    .eq("reviewee_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[creatorCreditsDb] Failed to get user feedback:", error);
    return { feedback: [], total: 0, error: "Failed to get feedback" };
  }

  return {
    feedback: (data as FeedbackRow[]).map(transformFeedback),
    total: count || 0,
    error: null,
  };
}

/**
 * Get feedback for a specific transaction
 */
export async function getTransactionFeedback(
  transactionId: string,
  transactionType: TransactionType
): Promise<{ feedback: TransactionFeedback[]; error: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("transaction_feedback")
    .select(
      `
      *,
      reviewer:profiles!reviewer_id(first_name, last_name, username)
    `
    )
    .eq("transaction_id", transactionId)
    .eq("transaction_type", transactionType);

  if (error) {
    console.error("[creatorCreditsDb] Failed to get transaction feedback:", error);
    return { feedback: [], error: "Failed to get feedback" };
  }

  return {
    feedback: (data as FeedbackRow[]).map(transformFeedback),
    error: null,
  };
}

/**
 * Check if a user can leave feedback for a transaction
 */
export async function checkFeedbackEligibility(
  userId: string,
  transactionId: string,
  transactionType: TransactionType
): Promise<FeedbackEligibility> {
  // Check if feedback already exists
  const { data: existing } = await supabaseAdmin
    .from("transaction_feedback")
    .select("id, created_at")
    .eq("transaction_id", transactionId)
    .eq("transaction_type", transactionType)
    .eq("reviewer_id", userId)
    .single();

  if (existing) {
    const editableUntil = new Date(existing.created_at);
    editableUntil.setDate(editableUntil.getDate() + 7);

    return {
      canLeaveFeedback: false,
      reason: "Feedback already submitted",
      feedbackLeftAt: existing.created_at,
      editableUntil: editableUntil.toISOString(),
    };
  }

  // Check transaction-specific eligibility
  switch (transactionType) {
    case "auction":
      return checkAuctionFeedbackEligibility(userId, transactionId);
    case "sale":
      return checkSaleFeedbackEligibility(userId, transactionId);
    case "trade":
      return checkTradeFeedbackEligibility(userId, transactionId);
    default:
      return { canLeaveFeedback: false, reason: "Invalid transaction type" };
  }
}

// ============================================================================
// ELIGIBILITY HELPERS
// ============================================================================

/**
 * Check auction feedback eligibility
 * Seller: after marked shipped or auction completed
 * Buyer: after 7 days OR after marked completed
 */
async function checkAuctionFeedbackEligibility(
  userId: string,
  auctionId: string
): Promise<FeedbackEligibility> {
  const { data: auction, error } = await supabaseAdmin
    .from("auctions")
    .select("seller_id, winner_id, status, shipped_at, completed_at, ended_at")
    .eq("id", auctionId)
    .single();

  if (error || !auction) {
    return { canLeaveFeedback: false, reason: "Auction not found" };
  }

  const isSeller = auction.seller_id === userId;
  const isBuyer = auction.winner_id === userId;

  if (!isSeller && !isBuyer) {
    return { canLeaveFeedback: false, reason: "Not a participant in this auction" };
  }

  // Seller can leave feedback after shipping or completion
  if (isSeller) {
    if (auction.shipped_at || auction.completed_at || auction.status === "completed") {
      return { canLeaveFeedback: true };
    }
    return { canLeaveFeedback: false, reason: "Wait until item is shipped to leave feedback" };
  }

  // Buyer can leave feedback after completion OR 7 days after auction ended
  if (isBuyer) {
    if (auction.completed_at || auction.status === "completed") {
      return { canLeaveFeedback: true };
    }

    if (auction.ended_at) {
      const endedDate = new Date(auction.ended_at);
      const now = new Date();
      const daysSinceEnded = (now.getTime() - endedDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceEnded >= 7) {
        return { canLeaveFeedback: true };
      }

      return {
        canLeaveFeedback: false,
        reason: `Can leave feedback after ${Math.ceil(7 - daysSinceEnded)} more days or when marked complete`,
      };
    }

    return { canLeaveFeedback: false, reason: "Auction has not ended yet" };
  }

  return { canLeaveFeedback: false, reason: "Unknown error" };
}

/**
 * Check sale/listing feedback eligibility
 * Similar logic to auctions
 */
async function checkSaleFeedbackEligibility(
  userId: string,
  listingId: string
): Promise<FeedbackEligibility> {
  const { data: listing, error } = await supabaseAdmin
    .from("listings")
    .select("seller_id, buyer_id, status, shipped_at, completed_at, sold_at")
    .eq("id", listingId)
    .single();

  if (error || !listing) {
    return { canLeaveFeedback: false, reason: "Listing not found" };
  }

  const isSeller = listing.seller_id === userId;
  const isBuyer = listing.buyer_id === userId;

  if (!isSeller && !isBuyer) {
    return { canLeaveFeedback: false, reason: "Not a participant in this sale" };
  }

  // Seller can leave feedback after shipping or completion
  if (isSeller) {
    if (listing.shipped_at || listing.completed_at || listing.status === "completed") {
      return { canLeaveFeedback: true };
    }
    return { canLeaveFeedback: false, reason: "Wait until item is shipped to leave feedback" };
  }

  // Buyer can leave feedback after completion OR 7 days after sale
  if (isBuyer) {
    if (listing.completed_at || listing.status === "completed") {
      return { canLeaveFeedback: true };
    }

    if (listing.sold_at) {
      const soldDate = new Date(listing.sold_at);
      const now = new Date();
      const daysSinceSold = (now.getTime() - soldDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceSold >= 7) {
        return { canLeaveFeedback: true };
      }

      return {
        canLeaveFeedback: false,
        reason: `Can leave feedback after ${Math.ceil(7 - daysSinceSold)} more days or when marked complete`,
      };
    }

    return { canLeaveFeedback: false, reason: "Sale has not been completed yet" };
  }

  return { canLeaveFeedback: false, reason: "Unknown error" };
}

/**
 * Check trade feedback eligibility
 * Both parties can leave feedback after both marked complete
 */
async function checkTradeFeedbackEligibility(
  userId: string,
  tradeId: string
): Promise<FeedbackEligibility> {
  const { data: trade, error } = await supabaseAdmin
    .from("trades")
    .select("initiator_id, recipient_id, status, initiator_completed_at, recipient_completed_at")
    .eq("id", tradeId)
    .single();

  if (error || !trade) {
    return { canLeaveFeedback: false, reason: "Trade not found" };
  }

  const isInitiator = trade.initiator_id === userId;
  const isRecipient = trade.recipient_id === userId;

  if (!isInitiator && !isRecipient) {
    return { canLeaveFeedback: false, reason: "Not a participant in this trade" };
  }

  // Both parties must mark complete before either can leave feedback
  if (trade.status === "completed" || (trade.initiator_completed_at && trade.recipient_completed_at)) {
    return { canLeaveFeedback: true };
  }

  if (isInitiator && !trade.recipient_completed_at) {
    return { canLeaveFeedback: false, reason: "Waiting for trade partner to mark complete" };
  }

  if (isRecipient && !trade.initiator_completed_at) {
    return { canLeaveFeedback: false, reason: "Waiting for trade partner to mark complete" };
  }

  return { canLeaveFeedback: false, reason: "Trade has not been completed" };
}

// ============================================================================
// CREATOR CREDITS RETRIEVAL
// ============================================================================

/**
 * Get full user creator profile (transaction trust + creator credits badge)
 */
export async function getUserCreatorProfile(userId: string): Promise<UserCreatorProfile | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("positive_ratings, negative_ratings, community_contribution_count")
    .eq("id", userId)
    .single();

  if (error || !data) {
    console.error("[creatorCreditsDb] Failed to get user creator profile:", error);
    return null;
  }

  const profile = data as ProfileRow;

  return {
    transactionTrust: calculateTransactionTrust(profile.positive_ratings, profile.negative_ratings),
    creatorBadge: calculateCreatorBadge(profile.community_contribution_count),
  };
}

/** @deprecated Use getUserCreatorProfile instead */
export const getUserReputation = getUserCreatorProfile;

/**
 * Get just transaction trust for a user
 */
export async function getTransactionTrust(userId: string): Promise<TransactionTrust | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("positive_ratings, negative_ratings")
    .eq("id", userId)
    .single();

  if (error || !data) {
    console.error("[creatorCreditsDb] Failed to get transaction trust:", error);
    return null;
  }

  return calculateTransactionTrust(data.positive_ratings, data.negative_ratings);
}

/**
 * Get just creator badge for a user
 */
export async function getCreatorBadge(userId: string): Promise<CreatorBadgeInfo | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("community_contribution_count")
    .eq("id", userId)
    .single();

  if (error || !data) {
    console.error("[creatorCreditsDb] Failed to get creator badge:", error);
    return null;
  }

  return calculateCreatorBadge(data.community_contribution_count);
}

/** @deprecated Use getCreatorBadge instead */
export const getContributorBadge = getCreatorBadge;

// ============================================================================
// COMMUNITY CONTRIBUTIONS (CREATOR CREDITS)
// ============================================================================

/**
 * Record an approved community contribution (awards a creator credit)
 * This is called when a contribution (like key info or cover image) is approved
 */
export async function recordContribution(
  userId: string,
  contributionType: ContributionType,
  referenceId: string | null = null
): Promise<{ contribution: CommunityContribution | null; error: string | null }> {
  // Check for duplicate contribution
  if (referenceId) {
    const { data: existing } = await supabaseAdmin
      .from("community_contributions")
      .select("id")
      .eq("user_id", userId)
      .eq("contribution_type", contributionType)
      .eq("reference_id", referenceId)
      .single();

    if (existing) {
      return { contribution: null, error: "Contribution already recorded" };
    }
  }

  // Insert contribution
  const { data, error } = await supabaseAdmin
    .from("community_contributions")
    .insert({
      user_id: userId,
      contribution_type: contributionType,
      reference_id: referenceId,
    })
    .select()
    .single();

  if (error) {
    console.error("[creatorCreditsDb] Failed to record contribution:", error);
    return { contribution: null, error: "Failed to record contribution" };
  }

  // Increment user's contribution count
  await supabaseAdmin.rpc("increment_field", {
    table_name: "profiles",
    field_name: "community_contribution_count",
    row_id: userId,
    increment_value: 1,
  });

  return { contribution: transformContribution(data as ContributionRow), error: null };
}

/**
 * Get contributions by a user
 */
export async function getUserContributions(
  userId: string,
  limit: number = 50
): Promise<{ contributions: CommunityContribution[]; error: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("community_contributions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[creatorCreditsDb] Failed to get user contributions:", error);
    return { contributions: [], error: "Failed to get contributions" };
  }

  return {
    contributions: (data as ContributionRow[]).map(transformContribution),
    error: null,
  };
}
