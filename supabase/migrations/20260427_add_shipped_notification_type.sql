-- Add 'shipped' to the notifications.type CHECK constraint so the
-- mark-shipped route can use a dedicated type instead of overloading 'ended'
-- (which made the bell render a Clock icon for "Your comic has shipped!"
-- notifications). New type allows the bell to show a delivery-truck icon
-- and keeps the deep-link target unchanged.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS valid_notification_type;

ALTER TABLE notifications ADD CONSTRAINT valid_notification_type
  CHECK (type IN (
    -- Auction types
    'outbid', 'won', 'ended', 'payment_reminder', 'rating_request', 'auction_sold', 'payment_received',
    'auction_payment_expired', 'auction_payment_expired_seller', 'bid_auction_lost', 'new_bid_received',
    -- Shipment
    'shipped',
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
