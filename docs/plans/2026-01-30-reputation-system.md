# Reputation System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a dual-score reputation system with Transaction Trust (eBay-style percentage) and Community Reputation (contributor badges).

**Architecture:** Extend existing `seller_ratings` table to support sales, auctions, and trades. Create new `transaction_feedback` table for unified feedback with seller responses. Add `community_contributions` table for tracking approved contributions. Display via `ReputationBadge` and `ContributorBadge` components.

**Tech Stack:** Next.js API routes, Supabase (Postgres), Resend email, existing cron infrastructure, React components with Tailwind CSS.

---

## Phase 1: Database Foundation

### Task 1.1: Create Transaction Feedback Table

**Files:**
- Create: `supabase/migrations/20260130_reputation_system.sql`

**Step 1: Write the migration SQL**

```sql
-- ============================================================================
-- REPUTATION SYSTEM MIGRATION
-- ============================================================================
-- Extends the existing seller_ratings concept to support:
-- - Sales, auctions, and trades (unified feedback)
-- - Seller responses to negative feedback
-- - Community contribution tracking
-- - Feedback reminders
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE TRANSACTION FEEDBACK TABLE
-- ============================================================================
-- This table unifies feedback for all transaction types
-- The existing seller_ratings table remains for backward compatibility

CREATE TABLE IF NOT EXISTS transaction_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('sale', 'auction', 'trade')),
  transaction_id UUID NOT NULL,  -- References auctions.id, listings.id, or trades.id
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating_type TEXT NOT NULL CHECK (rating_type IN ('positive', 'negative')),
  comment TEXT,  -- Max 500 chars, enforced in app
  seller_response TEXT,  -- Max 500 chars, for negative feedback only
  seller_response_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each reviewer can only leave one review per transaction
  CONSTRAINT unique_reviewer_transaction UNIQUE (reviewer_id, transaction_id, transaction_type)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_feedback_reviewee ON transaction_feedback(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_feedback_reviewer ON transaction_feedback(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_feedback_transaction ON transaction_feedback(transaction_id, transaction_type);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON transaction_feedback(created_at DESC);

-- ============================================================================
-- STEP 2: CREATE COMMUNITY CONTRIBUTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contribution_type TEXT NOT NULL CHECK (contribution_type IN ('key_info')),
  reference_id UUID,  -- References the approved submission (comics.id for key_info)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contributions_user ON community_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_type ON community_contributions(contribution_type);

-- ============================================================================
-- STEP 3: CREATE FEEDBACK REMINDERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS feedback_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('sale', 'auction', 'trade')),
  transaction_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('buyer', 'seller')),
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  feedback_left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_reminder UNIQUE (transaction_id, transaction_type, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reminders_pending ON feedback_reminders(user_id)
  WHERE feedback_left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reminders_due ON feedback_reminders(last_reminder_at, reminder_count)
  WHERE feedback_left_at IS NULL;

-- ============================================================================
-- STEP 4: ADD COMMUNITY CONTRIBUTION COUNT TO PROFILES
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS community_contribution_count INTEGER DEFAULT 0;

-- ============================================================================
-- STEP 5: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE transaction_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_reminders ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 6: CREATE RLS POLICIES
-- ============================================================================

-- Transaction Feedback: Anyone can read, only reviewer can insert, only participants can update
CREATE POLICY "feedback_select_policy" ON transaction_feedback
  FOR SELECT USING (TRUE);

CREATE POLICY "feedback_insert_policy" ON transaction_feedback
  FOR INSERT WITH CHECK (
    reviewer_id = public.current_profile_id()
  );

CREATE POLICY "feedback_update_policy" ON transaction_feedback
  FOR UPDATE USING (
    reviewer_id = public.current_profile_id()
    OR reviewee_id = public.current_profile_id()
  );

-- Community Contributions: Anyone can read, system inserts (via service role)
CREATE POLICY "contributions_select_policy" ON community_contributions
  FOR SELECT USING (TRUE);

-- Feedback Reminders: Only user can see their own reminders
CREATE POLICY "reminders_select_policy" ON feedback_reminders
  FOR SELECT USING (
    user_id = public.current_profile_id()
  );

-- ============================================================================
-- STEP 7: CREATE TRIGGER FOR CONTRIBUTION COUNT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_contribution_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles
    SET community_contribution_count = community_contribution_count + 1
    WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles
    SET community_contribution_count = GREATEST(community_contribution_count - 1, 0)
    WHERE id = OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_contribution_count ON community_contributions;
CREATE TRIGGER trigger_update_contribution_count
  AFTER INSERT OR DELETE ON community_contributions
  FOR EACH ROW
  EXECUTE FUNCTION update_contribution_count();

-- ============================================================================
-- STEP 8: CREATE TRIGGER FOR FEEDBACK RATING COUNTS
-- ============================================================================
-- Updates the existing positive_ratings/negative_ratings on profiles

CREATE OR REPLACE FUNCTION update_feedback_ratings()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.rating_type = 'positive' THEN
      UPDATE profiles SET positive_ratings = positive_ratings + 1 WHERE id = NEW.reviewee_id;
    ELSE
      UPDATE profiles SET negative_ratings = negative_ratings + 1 WHERE id = NEW.reviewee_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.rating_type != NEW.rating_type THEN
    -- Handle rating type change (within edit window)
    IF NEW.rating_type = 'positive' THEN
      UPDATE profiles SET
        positive_ratings = positive_ratings + 1,
        negative_ratings = GREATEST(negative_ratings - 1, 0)
      WHERE id = NEW.reviewee_id;
    ELSE
      UPDATE profiles SET
        positive_ratings = GREATEST(positive_ratings - 1, 0),
        negative_ratings = negative_ratings + 1
      WHERE id = NEW.reviewee_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_feedback_ratings ON transaction_feedback;
CREATE TRIGGER trigger_update_feedback_ratings
  AFTER INSERT OR UPDATE ON transaction_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_ratings();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
```

**Step 2: Copy migration to clipboard**

Run: `cat supabase/migrations/20260130_reputation_system.sql | pbcopy`

**Step 3: Run migration in Supabase**

Navigate to Supabase SQL Editor and paste. Verify no errors.

**Step 4: Commit**

```bash
git add supabase/migrations/20260130_reputation_system.sql
git commit -m "feat(db): add reputation system tables and triggers"
```

---

### Task 1.2: Add TypeScript Types

**Files:**
- Create: `src/types/reputation.ts`

**Step 1: Write the types file**

```typescript
/**
 * Reputation System Types
 *
 * Dual-score system:
 * 1. Transaction Trust - percentage based on positive/negative feedback
 * 2. Community Reputation - badge tiers based on approved contributions
 */

// ============================================================================
// TRANSACTION FEEDBACK
// ============================================================================

export type TransactionType = "sale" | "auction" | "trade";
export type RatingType = "positive" | "negative";
export type FeedbackRole = "buyer" | "seller";

export interface TransactionFeedback {
  id: string;
  transactionType: TransactionType;
  transactionId: string;
  reviewerId: string;
  revieweeId: string;
  ratingType: RatingType;
  comment: string | null;
  sellerResponse: string | null;
  sellerResponseAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  // Joined fields
  reviewerName?: string;
  reviewerUsername?: string;
}

export interface SubmitFeedbackInput {
  transactionType: TransactionType;
  transactionId: string;
  revieweeId: string;
  ratingType: RatingType;
  comment?: string;
}

export interface UpdateFeedbackInput {
  ratingType?: RatingType;
  comment?: string;
}

export interface SellerResponseInput {
  response: string;
}

// ============================================================================
// COMMUNITY CONTRIBUTIONS
// ============================================================================

export type ContributionType = "key_info";

export interface CommunityContribution {
  id: string;
  userId: string;
  contributionType: ContributionType;
  referenceId: string | null;
  createdAt: string;
}

export type ContributorTier = "none" | "contributor" | "verified" | "top";

export interface ContributorBadgeInfo {
  tier: ContributorTier;
  count: number;
  label: string | null;
}

// ============================================================================
// REPUTATION DISPLAY
// ============================================================================

export interface TransactionTrust {
  positiveCount: number;
  negativeCount: number;
  totalCount: number;
  percentage: number;
  display: TransactionTrustDisplay;
}

export type TransactionTrustDisplay =
  | { type: "new_seller" }
  | { type: "percentage"; percentage: number; count: number; color: "green" | "yellow" | "red" };

export interface UserReputation {
  transactionTrust: TransactionTrust;
  communityBadge: ContributorBadgeInfo;
}

// ============================================================================
// FEEDBACK ELIGIBILITY
// ============================================================================

export interface FeedbackEligibility {
  canLeaveFeedback: boolean;
  reason?: string;
  feedbackLeftAt?: string;
  editableUntil?: string;
}

// ============================================================================
// FEEDBACK REMINDERS
// ============================================================================

export interface FeedbackReminder {
  id: string;
  transactionType: TransactionType;
  transactionId: string;
  userId: string;
  role: FeedbackRole;
  reminderCount: number;
  lastReminderAt: string | null;
  feedbackLeftAt: string | null;
  createdAt: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate transaction trust display from counts
 */
export function calculateTransactionTrust(
  positiveCount: number,
  negativeCount: number
): TransactionTrust {
  const totalCount = positiveCount + negativeCount;

  if (totalCount < 5) {
    return {
      positiveCount,
      negativeCount,
      totalCount,
      percentage: totalCount > 0 ? Math.round((positiveCount / totalCount) * 100) : 0,
      display: { type: "new_seller" },
    };
  }

  const percentage = Math.round((positiveCount / totalCount) * 100);
  let color: "green" | "yellow" | "red";

  if (percentage >= 90) {
    color = "green";
  } else if (percentage >= 70) {
    color = "yellow";
  } else {
    color = "red";
  }

  return {
    positiveCount,
    negativeCount,
    totalCount,
    percentage,
    display: { type: "percentage", percentage, count: totalCount, color },
  };
}

/**
 * Calculate contributor badge tier from count
 */
export function calculateContributorBadge(count: number): ContributorBadgeInfo {
  if (count >= 10) {
    return { tier: "top", count, label: "Top Contributor" };
  }
  if (count >= 5) {
    return { tier: "verified", count, label: "Verified Contributor" };
  }
  if (count >= 1) {
    return { tier: "contributor", count, label: "Contributor" };
  }
  return { tier: "none", count, label: null };
}

/**
 * Check if feedback is still editable (within 7 days)
 */
export function isFeedbackEditable(createdAt: string): boolean {
  const createdDate = new Date(createdAt);
  const now = new Date();
  const daysSinceCreation = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceCreation <= 7;
}

/**
 * Check if seller response is still editable (within 48 hours)
 */
export function isSellerResponseEditable(responseAt: string): boolean {
  const responseDate = new Date(responseAt);
  const now = new Date();
  const hoursSinceResponse = (now.getTime() - responseDate.getTime()) / (1000 * 60 * 60);
  return hoursSinceResponse <= 48;
}
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types/reputation.ts
git commit -m "feat(types): add reputation system type definitions"
```

---

### Task 1.3: Add Reputation Database Functions

**Files:**
- Create: `src/lib/reputationDb.ts`

**Step 1: Write the database helper functions**

```typescript
/**
 * Reputation System Database Functions
 */

import {
  calculateContributorBadge,
  calculateTransactionTrust,
  ContributorBadgeInfo,
  FeedbackEligibility,
  SellerResponseInput,
  SubmitFeedbackInput,
  TransactionFeedback,
  TransactionTrust,
  TransactionType,
  UpdateFeedbackInput,
  UserReputation,
} from "@/types/reputation";

import { supabaseAdmin } from "./supabase";

// ============================================================================
// FEEDBACK SUBMISSION
// ============================================================================

/**
 * Submit feedback for a transaction
 */
export async function submitFeedback(
  reviewerId: string,
  input: SubmitFeedbackInput
): Promise<{ success: boolean; error?: string; feedback?: TransactionFeedback }> {
  // Validate comment length
  if (input.comment && input.comment.length > 500) {
    return { success: false, error: "Comment must be 500 characters or less" };
  }

  // Check if feedback already exists
  const { data: existing } = await supabaseAdmin
    .from("transaction_feedback")
    .select("id")
    .eq("reviewer_id", reviewerId)
    .eq("transaction_id", input.transactionId)
    .eq("transaction_type", input.transactionType)
    .single();

  if (existing) {
    return { success: false, error: "You have already left feedback for this transaction" };
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
    .select()
    .single();

  if (error) {
    console.error("[Reputation] Failed to submit feedback:", error);
    return { success: false, error: error.message };
  }

  // Mark reminder as completed if exists
  await supabaseAdmin
    .from("feedback_reminders")
    .update({ feedback_left_at: new Date().toISOString() })
    .eq("transaction_id", input.transactionId)
    .eq("transaction_type", input.transactionType)
    .eq("user_id", reviewerId);

  return { success: true, feedback: transformFeedback(data) };
}

/**
 * Update existing feedback (within 7-day edit window)
 */
export async function updateFeedback(
  reviewerId: string,
  feedbackId: string,
  input: UpdateFeedbackInput
): Promise<{ success: boolean; error?: string }> {
  // Validate comment length
  if (input.comment && input.comment.length > 500) {
    return { success: false, error: "Comment must be 500 characters or less" };
  }

  // Get existing feedback
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("transaction_feedback")
    .select("*")
    .eq("id", feedbackId)
    .eq("reviewer_id", reviewerId)
    .single();

  if (fetchError || !existing) {
    return { success: false, error: "Feedback not found" };
  }

  // Check edit window (7 days)
  const createdAt = new Date(existing.created_at);
  const now = new Date();
  const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceCreation > 7) {
    return { success: false, error: "Edit window has expired (7 days)" };
  }

  // Update feedback
  const { error } = await supabaseAdmin
    .from("transaction_feedback")
    .update({
      rating_type: input.ratingType ?? existing.rating_type,
      comment: input.comment !== undefined ? input.comment : existing.comment,
      updated_at: new Date().toISOString(),
    })
    .eq("id", feedbackId);

  if (error) {
    console.error("[Reputation] Failed to update feedback:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Add seller response to negative feedback
 */
export async function addSellerResponse(
  sellerId: string,
  feedbackId: string,
  input: SellerResponseInput
): Promise<{ success: boolean; error?: string }> {
  // Validate response length
  if (input.response.length > 500) {
    return { success: false, error: "Response must be 500 characters or less" };
  }

  // Get feedback
  const { data: feedback, error: fetchError } = await supabaseAdmin
    .from("transaction_feedback")
    .select("*")
    .eq("id", feedbackId)
    .eq("reviewee_id", sellerId)
    .single();

  if (fetchError || !feedback) {
    return { success: false, error: "Feedback not found" };
  }

  // Only allow response to negative feedback
  if (feedback.rating_type !== "negative") {
    return { success: false, error: "Can only respond to negative feedback" };
  }

  // Check if already responded and past edit window
  if (feedback.seller_response_at) {
    const responseAt = new Date(feedback.seller_response_at);
    const now = new Date();
    const hoursSinceResponse = (now.getTime() - responseAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceResponse > 48) {
      return { success: false, error: "Response edit window has expired (48 hours)" };
    }
  }

  // Add/update response
  const { error } = await supabaseAdmin
    .from("transaction_feedback")
    .update({
      seller_response: input.response,
      seller_response_at: feedback.seller_response_at || new Date().toISOString(),
    })
    .eq("id", feedbackId);

  if (error) {
    console.error("[Reputation] Failed to add seller response:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============================================================================
// FEEDBACK RETRIEVAL
// ============================================================================

/**
 * Get feedback for a user (received)
 */
export async function getUserFeedback(
  userId: string,
  limit = 20,
  offset = 0
): Promise<TransactionFeedback[]> {
  const { data, error } = await supabaseAdmin
    .from("transaction_feedback")
    .select(`
      *,
      reviewer:profiles!reviewer_id (
        display_name,
        username
      )
    `)
    .eq("reviewee_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[Reputation] Failed to get user feedback:", error);
    return [];
  }

  return data.map((row) => transformFeedback(row));
}

/**
 * Get feedback for a specific transaction
 */
export async function getTransactionFeedback(
  transactionId: string,
  transactionType: TransactionType
): Promise<TransactionFeedback[]> {
  const { data, error } = await supabaseAdmin
    .from("transaction_feedback")
    .select(`
      *,
      reviewer:profiles!reviewer_id (
        display_name,
        username
      )
    `)
    .eq("transaction_id", transactionId)
    .eq("transaction_type", transactionType);

  if (error) {
    console.error("[Reputation] Failed to get transaction feedback:", error);
    return [];
  }

  return data.map((row) => transformFeedback(row));
}

/**
 * Check if user can leave feedback for a transaction
 */
export async function checkFeedbackEligibility(
  userId: string,
  transactionId: string,
  transactionType: TransactionType
): Promise<FeedbackEligibility> {
  // Check if already left feedback
  const { data: existing } = await supabaseAdmin
    .from("transaction_feedback")
    .select("id, created_at")
    .eq("reviewer_id", userId)
    .eq("transaction_id", transactionId)
    .eq("transaction_type", transactionType)
    .single();

  if (existing) {
    const createdAt = new Date(existing.created_at);
    const editableUntil = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();

    return {
      canLeaveFeedback: false,
      reason: "Feedback already submitted",
      feedbackLeftAt: existing.created_at,
      editableUntil: now < editableUntil ? editableUntil.toISOString() : undefined,
    };
  }

  // Check transaction-specific eligibility
  if (transactionType === "auction") {
    return await checkAuctionFeedbackEligibility(userId, transactionId);
  } else if (transactionType === "sale") {
    return await checkSaleFeedbackEligibility(userId, transactionId);
  } else if (transactionType === "trade") {
    return await checkTradeFeedbackEligibility(userId, transactionId);
  }

  return { canLeaveFeedback: false, reason: "Unknown transaction type" };
}

async function checkAuctionFeedbackEligibility(
  userId: string,
  auctionId: string
): Promise<FeedbackEligibility> {
  const { data: auction } = await supabaseAdmin
    .from("auctions")
    .select("seller_id, winner_id, status, payment_status, end_time")
    .eq("id", auctionId)
    .single();

  if (!auction) {
    return { canLeaveFeedback: false, reason: "Auction not found" };
  }

  const isSeller = auction.seller_id === userId;
  const isBuyer = auction.winner_id === userId;

  if (!isSeller && !isBuyer) {
    return { canLeaveFeedback: false, reason: "Not a participant in this auction" };
  }

  if (auction.status !== "sold") {
    return { canLeaveFeedback: false, reason: "Auction not completed" };
  }

  // Seller can leave feedback after payment confirmed and item shipped
  if (isSeller) {
    if (auction.payment_status === "shipped" || auction.payment_status === "completed") {
      return { canLeaveFeedback: true };
    }
    return { canLeaveFeedback: false, reason: "Item must be shipped before leaving feedback" };
  }

  // Buyer can leave feedback 7 days after auction end OR after marking arrived
  if (isBuyer) {
    if (auction.payment_status === "completed") {
      return { canLeaveFeedback: true };
    }

    const endTime = new Date(auction.end_time);
    const now = new Date();
    const daysSinceEnd = (now.getTime() - endTime.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceEnd >= 7) {
      return { canLeaveFeedback: true };
    }

    return {
      canLeaveFeedback: false,
      reason: `Feedback available in ${Math.ceil(7 - daysSinceEnd)} days or when item arrives`
    };
  }

  return { canLeaveFeedback: false };
}

async function checkSaleFeedbackEligibility(
  userId: string,
  listingId: string
): Promise<FeedbackEligibility> {
  const { data: listing } = await supabaseAdmin
    .from("listings")
    .select("seller_id, buyer_id, status, paid_at")
    .eq("id", listingId)
    .single();

  if (!listing) {
    return { canLeaveFeedback: false, reason: "Listing not found" };
  }

  const isSeller = listing.seller_id === userId;
  const isBuyer = listing.buyer_id === userId;

  if (!isSeller && !isBuyer) {
    return { canLeaveFeedback: false, reason: "Not a participant in this sale" };
  }

  if (listing.status !== "sold") {
    return { canLeaveFeedback: false, reason: "Sale not completed" };
  }

  // Similar logic to auctions
  if (listing.paid_at) {
    const paidAt = new Date(listing.paid_at);
    const now = new Date();
    const daysSincePaid = (now.getTime() - paidAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSincePaid >= 7 || (isSeller && listing.status === "sold")) {
      return { canLeaveFeedback: true };
    }
  }

  return { canLeaveFeedback: false, reason: "Feedback not yet available" };
}

async function checkTradeFeedbackEligibility(
  userId: string,
  tradeId: string
): Promise<FeedbackEligibility> {
  const { data: trade } = await supabaseAdmin
    .from("trades")
    .select("proposer_id, recipient_id, status, completed_at")
    .eq("id", tradeId)
    .single();

  if (!trade) {
    return { canLeaveFeedback: false, reason: "Trade not found" };
  }

  const isProposer = trade.proposer_id === userId;
  const isRecipient = trade.recipient_id === userId;

  if (!isProposer && !isRecipient) {
    return { canLeaveFeedback: false, reason: "Not a participant in this trade" };
  }

  // Trade must be completed (both parties confirmed receipt)
  if (trade.status !== "completed" || !trade.completed_at) {
    return { canLeaveFeedback: false, reason: "Trade must be completed by both parties" };
  }

  return { canLeaveFeedback: true };
}

// ============================================================================
// REPUTATION RETRIEVAL
// ============================================================================

/**
 * Get user's full reputation (transaction trust + community badge)
 */
export async function getUserReputation(userId: string): Promise<UserReputation> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("positive_ratings, negative_ratings, community_contribution_count")
    .eq("id", userId)
    .single();

  const positiveCount = profile?.positive_ratings ?? 0;
  const negativeCount = profile?.negative_ratings ?? 0;
  const contributionCount = profile?.community_contribution_count ?? 0;

  return {
    transactionTrust: calculateTransactionTrust(positiveCount, negativeCount),
    communityBadge: calculateContributorBadge(contributionCount),
  };
}

/**
 * Get transaction trust for a user
 */
export async function getTransactionTrust(userId: string): Promise<TransactionTrust> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("positive_ratings, negative_ratings")
    .eq("id", userId)
    .single();

  return calculateTransactionTrust(
    profile?.positive_ratings ?? 0,
    profile?.negative_ratings ?? 0
  );
}

/**
 * Get contributor badge info for a user
 */
export async function getContributorBadge(userId: string): Promise<ContributorBadgeInfo> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("community_contribution_count")
    .eq("id", userId)
    .single();

  return calculateContributorBadge(profile?.community_contribution_count ?? 0);
}

// ============================================================================
// COMMUNITY CONTRIBUTIONS
// ============================================================================

/**
 * Record a community contribution (called when admin approves key info)
 */
export async function recordContribution(
  userId: string,
  contributionType: "key_info",
  referenceId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from("community_contributions")
    .insert({
      user_id: userId,
      contribution_type: contributionType,
      reference_id: referenceId,
    });

  if (error) {
    console.error("[Reputation] Failed to record contribution:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============================================================================
// HELPERS
// ============================================================================

function transformFeedback(row: Record<string, unknown>): TransactionFeedback {
  const reviewer = row.reviewer as { display_name?: string; username?: string } | null;

  return {
    id: row.id as string,
    transactionType: row.transaction_type as TransactionFeedback["transactionType"],
    transactionId: row.transaction_id as string,
    reviewerId: row.reviewer_id as string,
    revieweeId: row.reviewee_id as string,
    ratingType: row.rating_type as TransactionFeedback["ratingType"],
    comment: row.comment as string | null,
    sellerResponse: row.seller_response as string | null,
    sellerResponseAt: row.seller_response_at as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string | null,
    reviewerName: reviewer?.display_name || undefined,
    reviewerUsername: reviewer?.username || undefined,
  };
}
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/reputationDb.ts
git commit -m "feat(lib): add reputation database functions"
```

---

## Phase 2: API Endpoints

### Task 2.1: Create Feedback API Routes

**Files:**
- Create: `src/app/api/feedback/route.ts`
- Create: `src/app/api/feedback/[id]/route.ts`
- Create: `src/app/api/feedback/[id]/respond/route.ts`

**Step 1: Write the main feedback route**

Create `src/app/api/feedback/route.ts`:

```typescript
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getProfileId } from "@/lib/auth";
import { getUserFeedback, submitFeedback } from "@/lib/reputationDb";
import { SubmitFeedbackInput } from "@/types/reputation";

// GET - Get feedback for a user
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const targetUserId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!targetUserId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const feedback = await getUserFeedback(targetUserId, limit, offset);
    return NextResponse.json({ feedback });
  } catch (error) {
    console.error("[API] Error getting feedback:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Submit feedback for a transaction
export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = await getProfileId(clerkId);
    if (!profileId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const body = await request.json();
    const input: SubmitFeedbackInput = {
      transactionType: body.transactionType,
      transactionId: body.transactionId,
      revieweeId: body.revieweeId,
      ratingType: body.ratingType,
      comment: body.comment,
    };

    // Validate required fields
    if (!input.transactionType || !input.transactionId || !input.revieweeId || !input.ratingType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate rating type
    if (!["positive", "negative"].includes(input.ratingType)) {
      return NextResponse.json({ error: "Invalid rating type" }, { status: 400 });
    }

    // Prevent self-feedback
    if (input.revieweeId === profileId) {
      return NextResponse.json({ error: "Cannot leave feedback for yourself" }, { status: 400 });
    }

    const result = await submitFeedback(profileId, input);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, feedback: result.feedback });
  } catch (error) {
    console.error("[API] Error submitting feedback:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: Write the feedback update route**

Create `src/app/api/feedback/[id]/route.ts`:

```typescript
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getProfileId } from "@/lib/auth";
import { updateFeedback } from "@/lib/reputationDb";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH - Update feedback (within 7-day edit window)
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = await getProfileId(clerkId);
    if (!profileId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { id: feedbackId } = await context.params;
    const body = await request.json();

    const result = await updateFeedback(profileId, feedbackId, {
      ratingType: body.ratingType,
      comment: body.comment,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error updating feedback:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 3: Write the seller response route**

Create `src/app/api/feedback/[id]/respond/route.ts`:

```typescript
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getProfileId } from "@/lib/auth";
import { addSellerResponse } from "@/lib/reputationDb";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST - Add seller response to negative feedback
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = await getProfileId(clerkId);
    if (!profileId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { id: feedbackId } = await context.params;
    const body = await request.json();

    if (!body.response || typeof body.response !== "string") {
      return NextResponse.json({ error: "Response text required" }, { status: 400 });
    }

    const result = await addSellerResponse(profileId, feedbackId, {
      response: body.response,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error adding seller response:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/app/api/feedback/
git commit -m "feat(api): add feedback submission and response endpoints"
```

---

### Task 2.2: Create Reputation API Route

**Files:**
- Create: `src/app/api/reputation/[userId]/route.ts`

**Step 1: Write the reputation route**

```typescript
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getUserReputation, getUserFeedback } from "@/lib/reputationDb";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

// GET - Get user's full reputation
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const includeFeedback = searchParams.get("includeFeedback") === "true";
    const feedbackLimit = parseInt(searchParams.get("feedbackLimit") || "5");

    const reputation = await getUserReputation(userId);

    let recentFeedback = undefined;
    if (includeFeedback) {
      recentFeedback = await getUserFeedback(userId, feedbackLimit);
    }

    return NextResponse.json({
      reputation,
      recentFeedback,
    });
  } catch (error) {
    console.error("[API] Error getting reputation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/app/api/reputation/
git commit -m "feat(api): add reputation retrieval endpoint"
```

---

### Task 2.3: Create Feedback Eligibility API Route

**Files:**
- Create: `src/app/api/feedback/eligibility/route.ts`

**Step 1: Write the eligibility check route**

```typescript
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getProfileId } from "@/lib/auth";
import { checkFeedbackEligibility } from "@/lib/reputationDb";
import { TransactionType } from "@/types/reputation";

// GET - Check if user can leave feedback for a transaction
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = await getProfileId(clerkId);
    if (!profileId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const transactionId = searchParams.get("transactionId");
    const transactionType = searchParams.get("transactionType") as TransactionType;

    if (!transactionId || !transactionType) {
      return NextResponse.json({ error: "transactionId and transactionType required" }, { status: 400 });
    }

    if (!["sale", "auction", "trade"].includes(transactionType)) {
      return NextResponse.json({ error: "Invalid transaction type" }, { status: 400 });
    }

    const eligibility = await checkFeedbackEligibility(profileId, transactionId, transactionType);

    return NextResponse.json({ eligibility });
  } catch (error) {
    console.error("[API] Error checking eligibility:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/app/api/feedback/eligibility/
git commit -m "feat(api): add feedback eligibility check endpoint"
```

---

## Phase 3: UI Components

### Task 3.1: Create ReputationBadge Component

**Files:**
- Create: `src/components/reputation/ReputationBadge.tsx`

**Step 1: Write the ReputationBadge component**

```typescript
"use client";

import { Shield, Skull, Star, User } from "lucide-react";

import { TransactionTrust } from "@/types/reputation";

interface ReputationBadgeProps {
  trust: TransactionTrust;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  onClick?: () => void;
}

export function ReputationBadge({
  trust,
  size = "md",
  showCount = true,
  onClick,
}: ReputationBadgeProps) {
  const sizeClasses = {
    sm: "text-xs gap-1 px-1.5 py-0.5",
    md: "text-sm gap-1.5 px-2 py-1",
    lg: "text-base gap-2 px-3 py-1.5",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  // New Seller display
  if (trust.display.type === "new_seller") {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center rounded-full bg-gray-100 ${sizeClasses[size]} ${
          onClick ? "cursor-pointer hover:opacity-80" : ""
        }`}
      >
        <User className={`${iconSizes[size]} text-gray-500`} />
        <span className="font-medium text-gray-600">New Seller</span>
      </div>
    );
  }

  // Percentage-based display
  const { percentage, count, color } = trust.display;

  const colorStyles = {
    green: {
      bg: "bg-green-100",
      text: "text-green-700",
      icon: "text-green-600",
      Icon: Shield,
    },
    yellow: {
      bg: "bg-yellow-100",
      text: "text-yellow-700",
      icon: "text-yellow-600",
      Icon: Star,
    },
    red: {
      bg: "bg-red-100",
      text: "text-red-700",
      icon: "text-red-600",
      Icon: Skull,
    },
  };

  const styles = colorStyles[color];
  const Icon = styles.Icon;

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center rounded-full ${styles.bg} ${sizeClasses[size]} ${
        onClick ? "cursor-pointer hover:opacity-80" : ""
      }`}
    >
      <Icon className={`${iconSizes[size]} ${styles.icon}`} />
      <span className={`font-medium ${styles.text}`}>
        {percentage}% positive
      </span>
      {showCount && (
        <span className={`${styles.text} opacity-75`}>({count})</span>
      )}
    </div>
  );
}

// Compact version for cards
export function ReputationBadgeCompact({
  trust,
  onClick,
}: {
  trust: TransactionTrust;
  onClick?: () => void;
}) {
  if (trust.display.type === "new_seller") {
    return <span className="text-xs text-gray-500">New Seller</span>;
  }

  const { percentage, color } = trust.display;

  const colorStyles = {
    green: { bg: "bg-green-50", text: "text-green-600", Icon: Shield },
    yellow: { bg: "bg-yellow-50", text: "text-yellow-600", Icon: Star },
    red: { bg: "bg-red-50", text: "text-red-600", Icon: Skull },
  };

  const styles = colorStyles[color];
  const Icon = styles.Icon;

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${styles.bg} ${
        onClick ? "hover:opacity-80" : ""
      }`}
    >
      <Icon className={`w-3 h-3 ${styles.text}`} />
      <span className={`text-xs font-medium ${styles.text}`}>{percentage}%</span>
    </button>
  );
}
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/reputation/
git commit -m "feat(ui): add ReputationBadge component"
```

---

### Task 3.2: Create ContributorBadge Component

**Files:**
- Modify: `src/components/reputation/ReputationBadge.tsx` (add to same file)

**Step 1: Add ContributorBadge to the file**

Add to end of `src/components/reputation/ReputationBadge.tsx`:

```typescript
// ============================================================================
// CONTRIBUTOR BADGE
// ============================================================================

import { Award, BadgeCheck, Crown } from "lucide-react";

import { ContributorBadgeInfo } from "@/types/reputation";

interface ContributorBadgeProps {
  badge: ContributorBadgeInfo;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function ContributorBadge({
  badge,
  size = "md",
  showLabel = true,
}: ContributorBadgeProps) {
  if (badge.tier === "none") {
    return null;
  }

  const sizeClasses = {
    sm: "text-xs gap-1 px-1.5 py-0.5",
    md: "text-sm gap-1.5 px-2 py-1",
    lg: "text-base gap-2 px-3 py-1.5",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const tierStyles = {
    contributor: {
      bg: "bg-blue-100",
      text: "text-blue-700",
      icon: "text-blue-600",
      Icon: Award,
    },
    verified: {
      bg: "bg-purple-100",
      text: "text-purple-700",
      icon: "text-purple-600",
      Icon: BadgeCheck,
    },
    top: {
      bg: "bg-amber-100",
      text: "text-amber-700",
      icon: "text-amber-600",
      Icon: Crown,
    },
  };

  const styles = tierStyles[badge.tier as keyof typeof tierStyles];
  if (!styles) return null;

  const Icon = styles.Icon;

  return (
    <div
      className={`inline-flex items-center rounded-full ${styles.bg} ${sizeClasses[size]}`}
      title={`${badge.count} approved contribution${badge.count === 1 ? "" : "s"}`}
    >
      <Icon className={`${iconSizes[size]} ${styles.icon}`} />
      {showLabel && badge.label && (
        <span className={`font-medium ${styles.text}`}>{badge.label}</span>
      )}
    </div>
  );
}

// Icon-only version for inline display
export function ContributorIcon({
  badge,
  size = "sm",
}: {
  badge: ContributorBadgeInfo;
  size?: "sm" | "md";
}) {
  if (badge.tier === "none") {
    return null;
  }

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
  };

  const tierStyles = {
    contributor: { color: "text-blue-500", Icon: Award },
    verified: { color: "text-purple-500", Icon: BadgeCheck },
    top: { color: "text-amber-500", Icon: Crown },
  };

  const styles = tierStyles[badge.tier as keyof typeof tierStyles];
  if (!styles) return null;

  const Icon = styles.Icon;

  return (
    <Icon
      className={`${iconSizes[size]} ${styles.color}`}
      title={badge.label || undefined}
    />
  );
}
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/reputation/ReputationBadge.tsx
git commit -m "feat(ui): add ContributorBadge component"
```

---

### Task 3.3: Create FeedbackModal Component

**Files:**
- Create: `src/components/reputation/FeedbackModal.tsx`

**Step 1: Write the FeedbackModal component**

```typescript
"use client";

import { useState } from "react";

import { ThumbsDown, ThumbsUp, X } from "lucide-react";

import { RatingType, TransactionType } from "@/types/reputation";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionType: TransactionType;
  transactionId: string;
  revieweeId: string;
  revieweeName: string;
  onSubmit: (rating: RatingType, comment: string) => Promise<void>;
}

export function FeedbackModal({
  isOpen,
  onClose,
  transactionType,
  transactionId,
  revieweeId,
  revieweeName,
  onSubmit,
}: FeedbackModalProps) {
  const [rating, setRating] = useState<RatingType | null>(null);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const transactionLabel = {
    sale: "purchase",
    auction: "auction",
    trade: "trade",
  }[transactionType];

  const handleSubmit = async () => {
    if (!rating) {
      setError("Please select a rating");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(rating, comment);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const remainingChars = 500 - comment.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Leave Feedback
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Description */}
        <p className="mb-6 text-sm text-gray-600">
          How was your {transactionLabel} experience with{" "}
          <span className="font-medium">{revieweeName}</span>?
        </p>

        {/* Rating Selection */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => setRating("positive")}
            className={`flex flex-1 flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
              rating === "positive"
                ? "border-green-500 bg-green-50"
                : "border-gray-200 hover:border-green-300"
            }`}
          >
            <ThumbsUp
              className={`h-8 w-8 ${
                rating === "positive" ? "text-green-600" : "text-gray-400"
              }`}
            />
            <span
              className={`font-medium ${
                rating === "positive" ? "text-green-700" : "text-gray-600"
              }`}
            >
              Positive
            </span>
          </button>

          <button
            onClick={() => setRating("negative")}
            className={`flex flex-1 flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
              rating === "negative"
                ? "border-red-500 bg-red-50"
                : "border-gray-200 hover:border-red-300"
            }`}
          >
            <ThumbsDown
              className={`h-8 w-8 ${
                rating === "negative" ? "text-red-600" : "text-gray-400"
              }`}
            />
            <span
              className={`font-medium ${
                rating === "negative" ? "text-red-700" : "text-gray-600"
              }`}
            >
              Negative
            </span>
          </button>
        </div>

        {/* Comment */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Comment (optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share details about your experience..."
            maxLength={500}
            rows={3}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p
            className={`mt-1 text-right text-xs ${
              remainingChars < 50 ? "text-orange-600" : "text-gray-400"
            }`}
          >
            {remainingChars} characters remaining
          </p>
        </div>

        {/* Error */}
        {error && (
          <p className="mb-4 text-sm text-red-600">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !rating}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "Submitting..." : "Submit Feedback"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/reputation/FeedbackModal.tsx
git commit -m "feat(ui): add FeedbackModal component"
```

---

### Task 3.4: Create FeedbackList Component

**Files:**
- Create: `src/components/reputation/FeedbackList.tsx`

**Step 1: Write the FeedbackList component**

```typescript
"use client";

import { formatDistanceToNow } from "date-fns";
import { MessageSquare, ThumbsDown, ThumbsUp } from "lucide-react";

import { TransactionFeedback } from "@/types/reputation";

interface FeedbackListProps {
  feedback: TransactionFeedback[];
  showTransactionType?: boolean;
  emptyMessage?: string;
}

export function FeedbackList({
  feedback,
  showTransactionType = true,
  emptyMessage = "No feedback yet",
}: FeedbackListProps) {
  if (feedback.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">{emptyMessage}</p>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {feedback.map((item) => (
        <FeedbackItem
          key={item.id}
          feedback={item}
          showTransactionType={showTransactionType}
        />
      ))}
    </div>
  );
}

function FeedbackItem({
  feedback,
  showTransactionType,
}: {
  feedback: TransactionFeedback;
  showTransactionType: boolean;
}) {
  const isPositive = feedback.ratingType === "positive";
  const reviewerDisplay = feedback.reviewerUsername
    ? `@${feedback.reviewerUsername}`
    : feedback.reviewerName || "Anonymous";

  const transactionLabels = {
    sale: "Sale",
    auction: "Auction",
    trade: "Trade",
  };

  return (
    <div className="py-4">
      {/* Header */}
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          {isPositive ? (
            <ThumbsUp className="h-4 w-4 text-green-600" />
          ) : (
            <ThumbsDown className="h-4 w-4 text-red-600" />
          )}
          <span className="text-sm font-medium text-gray-900">
            {reviewerDisplay}
          </span>
          {showTransactionType && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              {transactionLabels[feedback.transactionType]}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {formatDistanceToNow(new Date(feedback.createdAt), { addSuffix: true })}
        </span>
      </div>

      {/* Comment */}
      {feedback.comment && (
        <p className="mb-2 text-sm text-gray-700">{feedback.comment}</p>
      )}

      {/* Seller Response */}
      {feedback.sellerResponse && (
        <div className="mt-3 rounded-lg bg-gray-50 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-600">
            <MessageSquare className="h-3 w-3" />
            Seller Response
          </div>
          <p className="text-sm text-gray-700">{feedback.sellerResponse}</p>
        </div>
      )}
    </div>
  );
}

// Summary stats component
export function FeedbackSummary({
  positiveCount,
  negativeCount,
}: {
  positiveCount: number;
  negativeCount: number;
}) {
  const total = positiveCount + negativeCount;
  const percentage = total > 0 ? Math.round((positiveCount / total) * 100) : 0;

  return (
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-2">
        <ThumbsUp className="h-5 w-5 text-green-600" />
        <span className="text-lg font-semibold text-gray-900">{positiveCount}</span>
        <span className="text-sm text-gray-500">positive</span>
      </div>
      <div className="flex items-center gap-2">
        <ThumbsDown className="h-5 w-5 text-red-600" />
        <span className="text-lg font-semibold text-gray-900">{negativeCount}</span>
        <span className="text-sm text-gray-500">negative</span>
      </div>
      {total >= 5 && (
        <div className="ml-auto text-sm text-gray-600">
          <span className="font-semibold">{percentage}%</span> positive
        </div>
      )}
    </div>
  );
}
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/reputation/FeedbackList.tsx
git commit -m "feat(ui): add FeedbackList component"
```

---

### Task 3.5: Create SellerResponseForm Component

**Files:**
- Create: `src/components/reputation/SellerResponseForm.tsx`

**Step 1: Write the SellerResponseForm component**

```typescript
"use client";

import { useState } from "react";

import { isSellerResponseEditable, TransactionFeedback } from "@/types/reputation";

interface SellerResponseFormProps {
  feedback: TransactionFeedback;
  onSubmit: (response: string) => Promise<void>;
}

export function SellerResponseForm({ feedback, onSubmit }: SellerResponseFormProps) {
  const [response, setResponse] = useState(feedback.sellerResponse || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(!feedback.sellerResponse);

  // Only show for negative feedback
  if (feedback.ratingType !== "negative") {
    return null;
  }

  // Check if response can still be edited
  const canEdit = !feedback.sellerResponseAt ||
    isSellerResponseEditable(feedback.sellerResponseAt);

  if (!canEdit && feedback.sellerResponse) {
    return null; // Response exists and can't be edited - show in FeedbackList instead
  }

  const handleSubmit = async () => {
    if (!response.trim()) {
      setError("Response cannot be empty");
      return;
    }

    if (response.length > 500) {
      setError("Response must be 500 characters or less");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(response);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit response");
    } finally {
      setIsSubmitting(false);
    }
  };

  const remainingChars = 500 - response.length;

  if (!isEditing && feedback.sellerResponse) {
    return (
      <div className="mt-3">
        <button
          onClick={() => setIsEditing(true)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Edit your response
        </button>
        <p className="mt-1 text-xs text-gray-500">
          You can edit for 48 hours after posting
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-gray-200 p-4">
      <h4 className="mb-2 text-sm font-medium text-gray-900">
        {feedback.sellerResponse ? "Edit Your Response" : "Respond to This Feedback"}
      </h4>
      <p className="mb-3 text-xs text-gray-500">
        Your response will be publicly visible alongside this feedback.
        {!feedback.sellerResponse && " You can edit it for 48 hours after posting."}
      </p>

      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Share your perspective on this transaction..."
        maxLength={500}
        rows={3}
        className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <p
        className={`mt-1 text-right text-xs ${
          remainingChars < 50 ? "text-orange-600" : "text-gray-400"
        }`}
      >
        {remainingChars} characters remaining
      </p>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3 flex gap-2">
        {feedback.sellerResponse && (
          <button
            onClick={() => {
              setResponse(feedback.sellerResponse || "");
              setIsEditing(false);
            }}
            disabled={isSubmitting}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !response.trim()}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting
            ? "Submitting..."
            : feedback.sellerResponse
              ? "Update Response"
              : "Post Response"}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/reputation/SellerResponseForm.tsx
git commit -m "feat(ui): add SellerResponseForm component"
```

---

### Task 3.6: Create Index Export for Reputation Components

**Files:**
- Create: `src/components/reputation/index.ts`

**Step 1: Create barrel export file**

```typescript
export { ContributorBadge, ContributorIcon, ReputationBadge, ReputationBadgeCompact } from "./ReputationBadge";
export { FeedbackList, FeedbackSummary } from "./FeedbackList";
export { FeedbackModal } from "./FeedbackModal";
export { SellerResponseForm } from "./SellerResponseForm";
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/reputation/index.ts
git commit -m "feat(ui): add reputation components barrel export"
```

---

## Phase 4: Integration

### Task 4.1: Update Admin Custom Key Info Approval to Track Contributions

**Files:**
- Modify: `src/app/api/admin/custom-key-info/[id]/route.ts`

**Step 1: Read current file**

Run: Read tool on `src/app/api/admin/custom-key-info/[id]/route.ts`

**Step 2: Add contribution tracking on approval**

After the successful approval update (around line 73), add:

```typescript
// Record community contribution for the user
await recordContribution(comic.user_id, "key_info", comicId);
```

And add the import at the top:

```typescript
import { recordContribution } from "@/lib/reputationDb";
```

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/app/api/admin/custom-key-info/[id]/route.ts
git commit -m "feat(admin): track community contributions on key info approval"
```

---

### Task 4.2: Add Email Templates for Feedback Reminders

**Files:**
- Modify: `src/lib/email.ts`

**Step 1: Read current file**

Run: Read tool on `src/lib/email.ts`

**Step 2: Add FeedbackEmailData interface and template**

After `MessageEmailData` interface (line 37), add:

```typescript
interface FeedbackEmailData {
  recipientName: string;
  otherPartyName: string;
  transactionType: "sale" | "auction" | "trade";
  comicTitle: string;
  issueNumber: string;
  feedbackUrl: string;
}
```

**Step 3: Add feedback reminder template function**

After `messageReceivedTemplate` function, add:

```typescript
function feedbackReminderTemplate(data: FeedbackEmailData): EmailTemplate {
  const transactionLabel = {
    sale: "purchase",
    auction: "auction",
    trade: "trade",
  }[data.transactionType];

  return {
    subject: `How was your ${transactionLabel}? Leave feedback for ${data.otherPartyName}`,
    html: `
      <h2>Share Your Experience</h2>
      <p>Hi ${data.recipientName},</p>
      <p>Your ${transactionLabel} of <strong>${data.comicTitle} #${data.issueNumber}</strong> with <strong>${data.otherPartyName}</strong> was completed.</p>
      <p>Your feedback helps build trust in our community. It only takes a moment!</p>
      <p><a href="${data.feedbackUrl}" style="display: inline-block; padding: 12px 24px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 8px;">Leave Feedback</a></p>
      <p style="color: #6b7280; font-size: 14px;">If you've already left feedback, you can ignore this email.</p>
    `,
    text: `Hi ${data.recipientName},\n\nYour ${transactionLabel} of ${data.comicTitle} #${data.issueNumber} with ${data.otherPartyName} was completed.\n\nYour feedback helps build trust in our community.\n\nLeave feedback: ${data.feedbackUrl}`,
  };
}
```

**Step 4: Update NotificationEmailType and switch statement**

Add `"feedback_reminder"` to the `NotificationEmailType` union type:

```typescript
export type NotificationEmailType =
  | "offer_received"
  | "offer_accepted"
  | "offer_rejected"
  | "offer_countered"
  | "offer_expired"
  | "listing_expiring"
  | "listing_expired"
  | "message_received"
  | "feedback_reminder";
```

Add case to switch statement in `sendNotificationEmail`:

```typescript
case "feedback_reminder":
  template = feedbackReminderTemplate(data as FeedbackEmailData);
  break;
```

Update the `SendNotificationEmailParams` data type:

```typescript
interface SendNotificationEmailParams {
  to: string;
  type: NotificationEmailType;
  data: OfferEmailData | ListingEmailData | MessageEmailData | FeedbackEmailData;
}
```

**Step 5: Export FeedbackEmailData type**

Add export at bottom of file:

```typescript
export type { FeedbackEmailData };
```

**Step 6: Run TypeScript check**

Run: `npx tsc --noEmit`

**Step 7: Commit**

```bash
git add src/lib/email.ts
git commit -m "feat(email): add feedback reminder email template"
```

---

### Task 4.3: Create Feedback Reminders Cron Job

**Files:**
- Create: `src/app/api/cron/send-feedback-reminders/route.ts`

**Step 1: Write the cron job**

```typescript
import { NextRequest, NextResponse } from "next/server";

import { FeedbackEmailData, sendNotificationEmail } from "@/lib/email";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Cron job to send feedback reminder emails
 *
 * Schedule: Daily
 *
 * Sends reminders at:
 * - 14 days after transaction completion (first reminder)
 * - 21 days after transaction completion (final reminder)
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = {
    processed: 0,
    sent: 0,
    errors: 0,
  };

  try {
    // Get pending reminders that are due
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const twentyOneDaysAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Find reminders where:
    // - No feedback left yet
    // - Either: no reminder sent and created 14+ days ago
    // - Or: 1 reminder sent 7+ days ago and created 21+ days ago
    const { data: reminders, error: fetchError } = await supabaseAdmin
      .from("feedback_reminders")
      .select(`
        *,
        user:profiles!user_id (
          email,
          display_name,
          username
        )
      `)
      .is("feedback_left_at", null)
      .or(`
        and(reminder_count.eq.0,created_at.lte.${fourteenDaysAgo.toISOString()}),
        and(reminder_count.eq.1,last_reminder_at.lte.${sevenDaysAgo.toISOString()},created_at.lte.${twentyOneDaysAgo.toISOString()})
      `)
      .limit(100);

    if (fetchError) {
      console.error("[Cron] Failed to fetch reminders:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!reminders || reminders.length === 0) {
      return NextResponse.json({ message: "No reminders to send", results });
    }

    // Process each reminder
    for (const reminder of reminders) {
      results.processed++;

      try {
        // Get transaction details based on type
        const transactionDetails = await getTransactionDetails(
          reminder.transaction_type,
          reminder.transaction_id,
          reminder.user_id
        );

        if (!transactionDetails) {
          console.warn(`[Cron] Transaction not found: ${reminder.transaction_id}`);
          continue;
        }

        const user = reminder.user as { email: string; display_name: string | null; username: string | null };

        if (!user?.email) {
          console.warn(`[Cron] No email for user in reminder ${reminder.id}`);
          continue;
        }

        // Send email
        const emailData: FeedbackEmailData = {
          recipientName: user.display_name || user.username || "Collector",
          otherPartyName: transactionDetails.otherPartyName,
          transactionType: reminder.transaction_type,
          comicTitle: transactionDetails.comicTitle,
          issueNumber: transactionDetails.issueNumber,
          feedbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/feedback?txn=${reminder.transaction_id}&type=${reminder.transaction_type}`,
        };

        const { success } = await sendNotificationEmail({
          to: user.email,
          type: "feedback_reminder",
          data: emailData,
        });

        if (success) {
          results.sent++;

          // Update reminder
          await supabaseAdmin
            .from("feedback_reminders")
            .update({
              reminder_count: reminder.reminder_count + 1,
              last_reminder_at: now.toISOString(),
            })
            .eq("id", reminder.id);
        } else {
          results.errors++;
        }
      } catch (err) {
        console.error(`[Cron] Error processing reminder ${reminder.id}:`, err);
        results.errors++;
      }
    }

    return NextResponse.json({ message: "Feedback reminders processed", results });
  } catch (error) {
    console.error("[Cron] Fatal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function getTransactionDetails(
  type: string,
  transactionId: string,
  userId: string
): Promise<{ otherPartyName: string; comicTitle: string; issueNumber: string } | null> {
  if (type === "auction") {
    const { data: auction } = await supabaseAdmin
      .from("auctions")
      .select(`
        seller_id,
        winner_id,
        comic:comics (title, issue_number),
        seller:profiles!seller_id (display_name, username),
        buyer:profiles!winner_id (display_name, username)
      `)
      .eq("id", transactionId)
      .single();

    if (!auction) return null;

    const comic = auction.comic as { title: string; issue_number: string };
    const isSeller = auction.seller_id === userId;
    const otherParty = isSeller
      ? (auction.buyer as { display_name: string | null; username: string | null })
      : (auction.seller as { display_name: string | null; username: string | null });

    return {
      otherPartyName: otherParty?.display_name || otherParty?.username || "the other party",
      comicTitle: comic?.title || "Comic",
      issueNumber: comic?.issue_number || "",
    };
  }

  if (type === "trade") {
    const { data: trade } = await supabaseAdmin
      .from("trades")
      .select(`
        proposer_id,
        recipient_id,
        proposer:profiles!proposer_id (display_name, username),
        recipient:profiles!recipient_id (display_name, username),
        trade_items (
          comics (title, issue_number)
        )
      `)
      .eq("id", transactionId)
      .single();

    if (!trade) return null;

    const isProposer = trade.proposer_id === userId;
    const otherParty = isProposer
      ? (trade.recipient as { display_name: string | null; username: string | null })
      : (trade.proposer as { display_name: string | null; username: string | null });

    // Get first comic from trade items
    const items = trade.trade_items as Array<{ comics: { title: string; issue_number: string } }>;
    const firstComic = items?.[0]?.comics;

    return {
      otherPartyName: otherParty?.display_name || otherParty?.username || "the other party",
      comicTitle: firstComic?.title || "Comics",
      issueNumber: firstComic?.issue_number || "",
    };
  }

  // Add sale type handling when listings table supports sold status with buyer_id
  return null;
}
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/app/api/cron/send-feedback-reminders/
git commit -m "feat(cron): add feedback reminder email cron job"
```

---

### Task 4.4: Create Feedback Reminder Records on Transaction Completion

**Files:**
- Modify: `src/lib/auctionDb.ts` (for auction completion)
- Modify: `src/lib/tradingDb.ts` (for trade completion)

**Step 1: Create helper function in reputationDb.ts**

Add to `src/lib/reputationDb.ts`:

```typescript
/**
 * Create feedback reminder records for a completed transaction
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

  await supabaseAdmin
    .from("feedback_reminders")
    .upsert(reminders, { onConflict: "transaction_id,transaction_type,user_id" });
}
```

**Step 2: Add reminder creation to auction sold flow**

In `src/lib/auctionDb.ts`, find where auction status is set to "sold" and add:

```typescript
import { createFeedbackReminders } from "./reputationDb";

// After auction is marked sold with payment status "shipped" or similar
await createFeedbackReminders("auction", auctionId, winnerId, sellerId);
```

**Step 3: Add reminder creation to trade completion flow**

In `src/lib/tradingDb.ts`, in the `completeTrade` or `confirmReceipt` function where `completed_at` is set, add:

```typescript
import { createFeedbackReminders } from "./reputationDb";

// After trade is marked complete
await createFeedbackReminders("trade", tradeId, recipientId, proposerId);
```

**Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/lib/reputationDb.ts src/lib/auctionDb.ts src/lib/tradingDb.ts
git commit -m "feat: create feedback reminders on transaction completion"
```

---

## Phase 5: Display Integration

### Task 5.1: Update SellerBadge to Use New ReputationBadge

**Files:**
- Modify: `src/components/auction/SellerBadge.tsx`

**Step 1: Read current SellerBadge**

Already read in context.

**Step 2: Update to use reputation types**

The existing SellerBadge already displays reputation well. We can optionally add the ContributorIcon next to the seller name. Update the component to optionally show contributor status:

```typescript
// Add import
import { ContributorIcon } from "@/components/reputation";
import { calculateContributorBadge } from "@/types/reputation";

// Update SellerBadgeProps to include contribution count
interface SellerBadgeProps {
  seller: SellerProfile & { communityContributionCount?: number };
  // ... existing props
}

// In the component, after the name span:
{seller.communityContributionCount !== undefined && seller.communityContributionCount > 0 && (
  <ContributorIcon badge={calculateContributorBadge(seller.communityContributionCount)} />
)}
```

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/components/auction/SellerBadge.tsx
git commit -m "feat(ui): add contributor badge to SellerBadge"
```

---

### Task 5.2: Add Reputation Section to Profile Page

**Files:**
- Modify: `src/components/CustomProfilePage.tsx`

This task requires careful integration into the existing profile page. Add a "Reputation" section in the Profile tab showing:

1. Transaction trust score with breakdown
2. Contributor badge (if applicable)
3. Recent feedback received

**Step 1: Read CustomProfilePage**

Use Read tool to examine current structure.

**Step 2: Add reputation data fetching and display**

This will require:
- Adding state for reputation data
- Fetching via `/api/reputation/[userId]`
- Adding a new collapsible section for "Reputation & Feedback"

**Step 3: Run TypeScript check**

**Step 4: Commit**

---

### Task 5.3: Add Feedback Button to Completed Transactions

**Files:**
- Modify auction detail/completion components
- Modify trade completion components

Add a "Leave Feedback" button that appears when `checkFeedbackEligibility` returns `canLeaveFeedback: true`.

---

## Summary

This implementation plan covers:

1. **Phase 1: Database Foundation** - Migration with tables, triggers, and RLS policies
2. **Phase 2: API Endpoints** - Feedback submission, editing, seller responses, eligibility checks
3. **Phase 3: UI Components** - ReputationBadge, ContributorBadge, FeedbackModal, FeedbackList
4. **Phase 4: Integration** - Admin approval tracking, email templates, cron job for reminders
5. **Phase 5: Display Integration** - SellerBadge updates, profile page reputation section

Each task follows TDD principles with clear steps for implementation and verification.
