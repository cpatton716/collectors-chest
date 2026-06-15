// Email templates for different notification types
export type EmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

export interface OfferEmailData {
  buyerName: string;
  sellerName: string;
  comicTitle: string;
  issueNumber: string;
  amount: number;
  counterAmount?: number;
  listingUrl: string;
}

export interface ListingEmailData {
  sellerName: string;
  comicTitle: string;
  issueNumber: string;
  price: number;
  expiresIn?: string;
  listingUrl: string;
}

export interface MessageEmailData {
  senderName: string;
  messagePreview: string;
  messagesUrl: string;
}

export interface FeedbackEmailData {
  recipientName: string;
  otherPartyName: string;
  transactionType: "sale" | "auction" | "trade";
  comicTitle: string;
  issueNumber: string;
  feedbackUrl: string;
}

export interface NewListingEmailData {
  sellerName: string;
  sellerUsername: string;
  comicTitle: string;
  price: number;
  listingUrl: string;
  coverImageUrl?: string;
}

export interface WelcomeEmailData {
  collectionUrl: string;
}

export interface BonusScanVerifyEmailData {
  /** Full verification URL the recipient clicks to unlock bonus scans. */
  verifyUrl: string;
}

export interface BonusScanGrantedEmailData {
  /** Deep-link to the scan page so the recipient can start scanning. */
  scanUrl: string;
  /** Link to the sign-up page to upsell a free account. */
  signUpUrl: string;
}

export interface TrialExpiringEmailData {
  trialEndsAt: string;
}

export interface AuctionEndingSoonEmailData {
  recipientName: string;
  comicTitle: string;
  issueNumber: string;
  currentBid: number;
  /** The recipient's own max bid on this auction (proxy bid). */
  yourMaxBid: number;
  /** ISO 8601 — auction's end_time. */
  endTime: string;
  /** Pre-formatted minutes-remaining label, e.g., "in about an hour". */
  timeRemainingLabel: string;
  listingUrl: string;
}

export interface SubscriptionPaymentFailedEmailData {
  /** URL to the Stripe Customer Portal so the user can update their payment method */
  manageBillingUrl: string;
  /** Optional: when Stripe will auto-retry (ISO 8601). When omitted, message
   *  emphasizes manual update without a specific deadline. */
  nextRetryAt?: string;
  /** Optional human-readable reason from Stripe (e.g., "Card declined").
   *  Sanitized at the call site — never raw error strings in the email. */
  failureReason?: string;
}

export interface MarketplaceTransactionEmailData {
  buyerName: string;
  sellerName: string;
  comicTitle: string;
  issueNumber: string;
  variant?: string | null;
  salePrice: number;
  shippingCost?: number;
  total: number;
  transactionType: "buy_now" | "auction";
  listingUrl: string;
  // Shipping address not yet surfaced (needs Shipping Tracking feature - BACKLOG).
  // For now these emails tell both parties a sale is complete; shipping details
  // will be added once the tracking flow ships.
}

export interface BidActivityEmailData {
  recipientName: string;
  comicTitle: string;
  issueNumber: string;
  currentBid: number;
  yourMaxBid?: number;
  listingUrl: string;
  endsIn?: string;
}

export interface AuctionEndEmailData {
  recipientName: string;
  comicTitle: string;
  issueNumber: string;
  finalPrice: number;
  listingUrl: string;
  paymentDeadline?: string; // for winner emails
  transactionsUrl?: string; // for winner: deep-link to Transactions page
}

export interface PaymentReminderEmailData {
  recipientName: string;
  comicTitle: string;
  issueNumber: string;
  finalPrice: number;
  paymentDeadline: string; // formatted for display, e.g. "April 25, 2026, 4:00 PM"
  hoursRemaining: number; // rounded hours until deadline; may be 0 if very close
  listingUrl: string;
  transactionsUrl: string;
}

export interface PaymentExpiredBuyerEmailData {
  recipientName: string;
  comicTitle: string;
  issueNumber: string;
  finalPrice: number;
  listingUrl: string; // link back to /shop to browse more listings
}

export interface PaymentExpiredSellerEmailData {
  recipientName: string;
  comicTitle: string;
  issueNumber: string;
  finalPrice: number;
  listingUrl: string; // link to /collection so the seller can re-list
}

// ============================================================================
// Second Chance Offer + Strike System
// ============================================================================

export interface SecondChanceSellerAvailableEmailData {
  recipientName: string; // seller's display name
  comicTitle: string;
  issueNumber: string;
  runnerUpLastBid: number;
  offerUrl: string; // deep-link the seller clicks to trigger the offer
}

export interface SecondChanceRunnerUpEmailData {
  recipientName: string; // runner-up's display name
  comicTitle: string;
  issueNumber: string;
  offerPrice: number;
  expiresAt: string; // formatted expiration, e.g. "April 25, 2026, 4:00 PM"
  responseUrl: string; // deep-link to /transactions (or inbox card)
}

export interface SecondChanceSellerResultEmailData {
  recipientName: string; // seller's display name
  comicTitle: string;
  issueNumber: string;
  offerPrice: number;
  listingUrl: string; // link back to /collection for re-listing (declined/expired)
}

export interface PaymentMissedWarningEmailData {
  recipientName: string;
  comicTitle: string;
  issueNumber: string;
  finalPrice: number;
  shopUrl: string;
}

export interface PaymentMissedFlaggedEmailData {
  recipientName: string;
  strikeCount: number;
  windowDays: number; // the rolling-window constant for copy
  reason: string;
  supportUrl: string;
}

// ============================================================================
// SEND EMAIL TYPES
// ============================================================================

export type NotificationEmailType =
  | "offer_received"
  | "offer_accepted"
  | "offer_rejected"
  | "offer_countered"
  | "offer_expired"
  | "listing_expiring"
  | "listing_expired"
  | "message_received"
  | "feedback_reminder"
  | "new_listing_from_followed"
  | "welcome"
  | "trial_expiring"
  | "purchase_confirmation"
  | "item_sold"
  | "outbid"
  | "auction_won"
  | "auction_sold"
  | "payment_reminder"
  | "auction_payment_expired"
  | "auction_payment_expired_seller"
  // Second Chance Offer + Strike System (templates appended at bottom of file)
  | "second_chance_available"
  | "second_chance_offered"
  | "second_chance_accepted"
  | "second_chance_declined"
  | "second_chance_expired"
  | "payment_missed_warning"
  | "payment_missed_flagged"
  | "subscription_payment_failed"
  | "auction_ending_soon_bidder"
  | "bonus_scan_verify"
  | "bonus_scan_granted";

export interface SendNotificationEmailParams {
  to: string;
  type: NotificationEmailType;
  data:
    | OfferEmailData
    | ListingEmailData
    | MessageEmailData
    | FeedbackEmailData
    | NewListingEmailData
    | WelcomeEmailData
    | TrialExpiringEmailData
    | MarketplaceTransactionEmailData
    | BidActivityEmailData
    | AuctionEndEmailData
    | PaymentReminderEmailData
    | PaymentExpiredBuyerEmailData
    | PaymentExpiredSellerEmailData
    | SecondChanceSellerAvailableEmailData
    | SecondChanceRunnerUpEmailData
    | SecondChanceSellerResultEmailData
    | PaymentMissedWarningEmailData
    | PaymentMissedFlaggedEmailData
    | SubscriptionPaymentFailedEmailData
    | AuctionEndingSoonEmailData
    | BonusScanVerifyEmailData
    | BonusScanGrantedEmailData;
  /**
   * Optional profile ID for preference gating. When omitted, we look up
   * the profile by email. Pass explicitly in hot paths to avoid the extra
   * round-trip. Transactional emails bypass the lookup entirely.
   */
  profileId?: string | null;
}
