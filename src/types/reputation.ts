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
