import { CollectionItem } from "./comic";

// ============================================================================
// AUCTION TYPES
// ============================================================================

export type ListingType = "auction" | "fixed_price";
export type AuctionStatus = "active" | "ended" | "sold" | "cancelled";
export type PaymentStatus = "pending" | "paid" | "shipped" | "completed";
export type RatingType = "positive" | "negative";
export type NotificationType =
  | "outbid"
  | "won"
  | "ended"
  | "bid_auction_lost"
  | "new_bid_received"
  | "payment_reminder"
  | "auction_payment_expired"
  | "auction_payment_expired_seller"
  | "rating_request"
  | "auction_sold"
  | "payment_received"
  // Offer types
  | "offer_received"
  | "offer_accepted"
  | "offer_rejected"
  | "offer_countered"
  | "offer_expired"
  // Listing expiration types
  | "listing_expiring"
  | "listing_expired"
  | "listing_cancelled"
  // Follow system
  | "new_listing_from_followed"
  // Community contribution types
  | "key_info_approved"
  | "key_info_rejected";

export type OfferStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "countered"
  | "expired"
  | "auto_rejected";
export type CancelReason = "changed_mind" | "sold_elsewhere" | "price_too_low" | "other";

export interface Auction {
  id: string;
  sellerId: string;
  comicId: string;

  // Listing type
  listingType: ListingType;

  // Pricing
  startingPrice: number; // For fixed_price, this is the sale price
  currentBid: number | null;
  buyItNowPrice: number | null;

  // Timing
  startTime: string;
  endTime: string;

  // Status
  status: AuctionStatus;

  // Winner
  winnerId: string | null;
  winningBid: number | null;

  // Shipping
  shippingCost: number;

  // Additional content
  detailImages: string[];
  description: string | null;

  // Denormalized counts
  bidCount: number;

  // Payment
  paymentStatus: PaymentStatus | null;
  paymentDeadline: string | null;

  // Shipping (Option A — self-reported tracking; Option B adds carrier validation)
  shippedAt: string | null;
  trackingNumber: string | null;
  trackingCarrier: string | null;

  // Offer support (for fixed_price listings)
  acceptsOffers: boolean;
  minOfferAmount: number | null;

  // Expiration (for fixed_price listings - 30 days)
  expiresAt: string | null;

  // Cancel reason (if cancelled)
  cancelReason: CancelReason | null;

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // Joined data (optional, populated when needed)
  comic?: CollectionItem;
  seller?: SellerProfile;
  isWatching?: boolean;
  isSeller?: boolean;
  userBid?: Bid | null;
}

export interface CreateAuctionInput {
  comicId: string;
  listingType?: ListingType; // Defaults to "auction"
  startingPrice: number;
  buyItNowPrice?: number | null;
  durationDays: number;
  shippingCost: number;
  detailImages?: string[];
  description?: string;
  // Scheduled auction support
  startDate?: string; // ISO date string, defaults to now
}

export interface CreateFixedPriceListingInput {
  comicId: string;
  price: number;
  shippingCost: number;
  detailImages?: string[];
  description?: string;
  // Offer support
  acceptsOffers?: boolean;
  minOfferAmount?: number; // Auto-reject offers below this
}

export interface UpdateAuctionInput {
  buyItNowPrice?: number | null;
  description?: string;
  detailImages?: string[];
}

// ============================================================================
// BID TYPES
// ============================================================================

export interface Bid {
  id: string;
  auctionId: string;
  bidderId: string;

  // Amounts
  bidAmount: number;
  maxBid: number;

  // Anonymization
  bidderNumber: number;

  // Status
  isWinning: boolean;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface PlaceBidInput {
  auctionId: string;
  maxBid: number;
}

export interface PlaceBidResult {
  success: boolean;
  message: string;
  bid?: Bid;
  currentBid?: number;
  isHighBidder?: boolean;
  outbidAmount?: number; // If outbid, the amount needed to be high bidder
}

export interface BidHistoryItem {
  bidderNumber: number;
  bidAmount: number;
  createdAt: string;
  isWinning: boolean;
}

// ============================================================================
// OFFER TYPES
// ============================================================================

export interface Offer {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;

  // Amounts
  amount: number;
  counterAmount: number | null;

  // Status
  status: OfferStatus;
  roundNumber: number; // 1-3, max 3 rounds of negotiation

  // Timestamps
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  respondedAt: string | null;

  // Joined data (optional)
  listing?: Auction;
  buyer?: SellerProfile;
  seller?: SellerProfile;
}

export interface CreateOfferInput {
  listingId: string;
  amount: number;
}

export interface RespondToOfferInput {
  offerId: string;
  action: "accept" | "reject" | "counter";
  counterAmount?: number; // Required if action is "counter"
}

export interface OfferResult {
  success: boolean;
  message: string;
  offer?: Offer;
}

// ============================================================================
// WATCHLIST TYPES
// ============================================================================

export interface WatchlistItem {
  id: string;
  userId: string;
  auctionId: string;
  createdAt: string;
  auction?: Auction;
}

// ============================================================================
// SELLER REPUTATION TYPES
// ============================================================================

export interface SellerRating {
  id: string;
  sellerId: string;
  buyerId: string;
  auctionId: string;
  ratingType: RatingType;
  comment: string | null;
  createdAt: string;
}

export interface SellerProfile {
  id: string;
  displayName: string | null;
  publicDisplayName: string | null;
  username: string | null;
  displayPreference: "username_only" | "display_name_only" | "both" | null;
  positiveRatings: number;
  negativeRatings: number;
  sellerSince: string | null;
  // Location (optional, respects privacy settings)
  locationCity: string | null;
  locationState: string | null;
  locationCountry: string | null;
  locationPrivacy: "full" | "state_country" | "country_only" | "hidden" | null;
  // Computed
  totalRatings: number;
  positivePercentage: number;
  reputation: "hero" | "villain" | "neutral";
}

export interface SubmitRatingInput {
  sellerId: string;
  auctionId: string;
  ratingType: RatingType;
  comment?: string;
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  auctionId: string | null;
  isRead: boolean;
  createdAt: string;
}

// ============================================================================
// FILTER & SORT TYPES
// ============================================================================

export interface AuctionFilters {
  status?: AuctionStatus;
  listingType?: ListingType;
  sellerId?: string;
  publisher?: string;
  minPrice?: number;
  maxPrice?: number;
  endingSoon?: boolean; // Within 24 hours
  hasBuyItNow?: boolean;
}

export type AuctionSortBy =
  | "ending_soonest"
  | "ending_latest"
  | "price_low"
  | "price_high"
  | "most_bids"
  | "newest";

export type ListingSortBy = "price_low" | "price_high" | "newest";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate minimum bid. All bids increment by $1.
 */
// ============================================================================
// LISTING STATUS HELPERS
// ============================================================================
//
// The `status` column has historical overlap across Buy Now and Auction flows
// (Buy Now -> "sold" on payment; Auctions -> "ended" at auction end with winner,
// then "sold" on payment). These helpers centralize the "is this listing past
// the active stage?" / "is it completed?" / "is it pending payment?" checks so
// new consumers don't hand-roll `(status === "sold" || status === "ended")`.

/**
 * The listing is past the active/biddable stage: sold, ended (auction
 * closed with or without winner), or cancelled.
 */
export function isListingFinalized(status: AuctionStatus): boolean {
  return status === "sold" || status === "ended" || status === "cancelled";
}

/**
 * The listing has a completed sale — a winner was selected AND payment
 * has cleared. Used to gate feedback + "you purchased this" UI.
 *
 * Implemented as a type predicate so consumers that narrow with it can
 * treat `winnerId` as non-null inside the branch.
 */
export function isListingCompleted<
  T extends { status: AuctionStatus; winnerId?: string | null; paymentStatus?: string | null }
>(listing: T): listing is T & { winnerId: string } {
  return (
    (listing.status === "sold" || listing.status === "ended") &&
    !!listing.winnerId &&
    listing.paymentStatus !== "pending"
  );
}

/**
 * The listing has a winner picked but payment has not cleared yet.
 * Used to show "Complete Payment" CTA + PaymentButton.
 */
export function isListingPendingPayment<
  T extends { status: AuctionStatus; winnerId?: string | null; paymentStatus?: string | null }
>(listing: T): listing is T & { winnerId: string } {
  return (
    (listing.status === "sold" || listing.status === "ended") &&
    !!listing.winnerId &&
    listing.paymentStatus === "pending"
  );
}

export function calculateMinimumBid(currentBid: number | null, startingPrice: number): number {
  // If no current bid, minimum is starting price
  if (currentBid === null) {
    return startingPrice;
  }
  return currentBid + 1;
}

/**
 * Get the bid increment for a given price level.
 * All bids use a flat $1 increment.
 */
export function getBidIncrement(_currentPrice: number): number {
  return 1;
}

/**
 * Validate that a bid amount follows the increment rules
 */
export function isValidBidAmount(
  bidAmount: number,
  currentBid: number | null,
  startingPrice: number
): { valid: boolean; message?: string } {
  const minimumBid = calculateMinimumBid(currentBid, startingPrice);

  if (bidAmount < minimumBid) {
    return {
      valid: false,
      message: `Minimum bid is $${minimumBid.toFixed(2)}`,
    };
  }

  // Check whole dollar amounts only
  if (!Number.isInteger(bidAmount)) {
    return {
      valid: false,
      message: "Bids must be whole dollar amounts",
    };
  }

  return { valid: true };
}

/**
 * Calculate time remaining for an auction
 */
export function calculateTimeRemaining(endTime: string): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  isEnded: boolean;
  isEndingSoon: boolean; // Within 1 hour
  isUrgent: boolean; // Within 10 minutes
} {
  const now = new Date().getTime();
  const end = new Date(endTime).getTime();
  const totalMs = end - now;

  if (totalMs <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalMs: 0,
      isEnded: true,
      isEndingSoon: false,
      isUrgent: false,
    };
  }

  const days = Math.floor(totalMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((totalMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((totalMs % (1000 * 60)) / 1000);

  const oneHour = 60 * 60 * 1000;
  const tenMinutes = 10 * 60 * 1000;

  return {
    days,
    hours,
    minutes,
    seconds,
    totalMs,
    isEnded: false,
    isEndingSoon: totalMs <= oneHour,
    isUrgent: totalMs <= tenMinutes,
  };
}

/**
 * Format time remaining as a human-readable string
 */
export function formatTimeRemaining(endTime: string): string {
  const { days, hours, minutes, seconds, isEnded } = calculateTimeRemaining(endTime);

  if (isEnded) {
    return "Ended";
  }

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

/**
 * Calculate seller reputation from ratings
 */
export function calculateSellerReputation(
  positiveRatings: number,
  negativeRatings: number
): { percentage: number; reputation: "hero" | "villain" | "neutral" } {
  const total = positiveRatings + negativeRatings;

  if (total === 0) {
    return { percentage: 0, reputation: "neutral" };
  }

  const percentage = Math.round((positiveRatings / total) * 100);

  // Hero: 80%+ positive
  // Villain: <50% positive
  // Neutral: 50-79% positive
  let reputation: "hero" | "villain" | "neutral";
  if (percentage >= 80) {
    reputation = "hero";
  } else if (percentage < 50) {
    reputation = "villain";
  } else {
    reputation = "neutral";
  }

  return { percentage, reputation };
}

/**
 * Format price as currency
 */
export function formatPrice(amount: number | null): string {
  if (amount === null) {
    return "-";
  }
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const AUCTION_DURATION_OPTIONS = [
  { value: 1, label: "1 day" },
  { value: 3, label: "3 days" },
  { value: 5, label: "5 days" },
  { value: 7, label: "7 days" },
  { value: 10, label: "10 days" },
  { value: 14, label: "14 days" },
];

export const MIN_STARTING_PRICE = 0.99;
export const MIN_FIXED_PRICE = 0.99;
export const MAX_DETAIL_IMAGES = 4;
export const PAYMENT_WINDOW_HOURS = 48;

/**
 * Hours before payment deadline when the reminder email fires.
 * Kept as a named constant so cron logic and tests agree on the boundary.
 */
export const PAYMENT_REMINDER_WINDOW_HOURS = 24;

/**
 * Compute the payment deadline for a won auction / accepted offer / Buy Now.
 * Pure helper so pricing-side call sites and tests can share a single source
 * of truth for `PAYMENT_WINDOW_HOURS`.
 */
export function calculatePaymentDeadline(fromDate: Date = new Date()): Date {
  const deadline = new Date(fromDate.getTime());
  deadline.setHours(deadline.getHours() + PAYMENT_WINDOW_HOURS);
  return deadline;
}

/**
 * Is an auction's payment deadline inside the reminder window
 * (i.e., the reminder email should fire now)?
 * Returns `true` when `deadline - now <= PAYMENT_REMINDER_WINDOW_HOURS` AND
 * the deadline has not yet passed. Pure function — no side effects.
 */
export function isWithinPaymentReminderWindow(
  paymentDeadline: Date,
  now: Date = new Date()
): boolean {
  const msUntilDeadline = paymentDeadline.getTime() - now.getTime();
  if (msUntilDeadline <= 0) {
    // Deadline has passed — expiration handles this, not reminders.
    return false;
  }
  const reminderWindowMs = PAYMENT_REMINDER_WINDOW_HOURS * 60 * 60 * 1000;
  return msUntilDeadline <= reminderWindowMs;
}
