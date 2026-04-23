-- ============================================================================
-- Payment Miss Tracking — abuse prevention for winning bidders who skip payment.
--
-- First offense  : logged only; user gets a warning email. No strike.
-- Second offense within rolling 90 days : flagged. Account is bid-restricted
--                                         and routed to admin review.
--
-- The 90-day window is evaluated against auction_audit_log rows with
-- event_type='auction_payment_expired' (fire-and-forget written by the
-- expireUnpaidAuctions cron).
-- Date: April 23, 2026
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS payment_missed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_missed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS bid_restricted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS bid_restricted_reason TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_bid_restricted
  ON profiles (bid_restricted_at)
  WHERE bid_restricted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_payment_missed
  ON profiles (payment_missed_at)
  WHERE payment_missed_at IS NOT NULL;

COMMENT ON COLUMN profiles.payment_missed_count IS 'Lifetime count of missed payment deadlines. First miss is a warning only; second miss within 90 days triggers a bid restriction.';
COMMENT ON COLUMN profiles.payment_missed_at IS 'Timestamp of the most recent missed payment deadline.';
COMMENT ON COLUMN profiles.bid_restricted_at IS 'When set, user cannot place new bids. Cleared manually by admin after review.';
COMMENT ON COLUMN profiles.bid_restricted_reason IS 'Human-readable reason surfaced to the user when a bid is blocked.';

-- Extend the auction audit enum with a `user_flagged` event for when the
-- strike threshold is hit. auditLog.ts must be kept in sync (AuctionAuditEventType).
ALTER TYPE auction_audit_event_type ADD VALUE IF NOT EXISTS 'user_flagged';

-- Extend the notifications CHECK constraint so the new types defined in
-- NotificationType (src/types/auction.ts) can actually be inserted.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS valid_notification_type;

ALTER TABLE notifications ADD CONSTRAINT valid_notification_type
  CHECK (type IN (
    -- Auction types
    'outbid', 'won', 'ended', 'payment_reminder', 'rating_request', 'auction_sold', 'payment_received',
    'auction_payment_expired', 'auction_payment_expired_seller', 'bid_auction_lost', 'new_bid_received',
    -- Offer types
    'offer_received', 'offer_accepted', 'offer_rejected', 'offer_countered', 'offer_expired',
    -- Listing types
    'listing_expiring', 'listing_expired', 'listing_cancelled', 'new_listing_from_followed',
    -- Key info types
    'key_info_approved', 'key_info_rejected',
    -- Second Chance Offer types
    'second_chance_available', 'second_chance_offered', 'second_chance_accepted',
    'second_chance_declined', 'second_chance_expired',
    -- Payment-miss strike system types
    'payment_missed_warning', 'payment_missed_flagged'
  ));
