-- Fix: Add missing notification types to the CHECK constraint
-- Types missing: key_info_approved, key_info_rejected, listing_cancelled, new_listing_from_followed
-- These were added to auctionDb.ts createNotification() but never to the DB constraint

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS valid_notification_type;

ALTER TABLE notifications ADD CONSTRAINT valid_notification_type
  CHECK (type IN (
    -- Auction types
    'outbid', 'won', 'ended', 'payment_reminder', 'rating_request', 'auction_sold', 'payment_received',
    -- Offer types
    'offer_received', 'offer_accepted', 'offer_rejected', 'offer_countered', 'offer_expired',
    -- Listing types
    'listing_expiring', 'listing_expired', 'listing_cancelled', 'new_listing_from_followed',
    -- Key info types
    'key_info_approved', 'key_info_rejected'
  ));
