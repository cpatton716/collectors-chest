-- Migration: shipping_tracking_option_a.sql
-- Option A (Beta): seller self-reports tracking to mark a sold listing as shipped.
-- Shipment triggers the ownership transfer (comic clone to buyer) + unlocks
-- feedback eligibility. No carrier validation yet (that's Option B — full
-- Shipping Tracking feature, Pre-Launch Full Launch Blocker in BACKLOG).

-- Shipping state on auctions (covers both auction + fixed_price listings)
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ NULL;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS tracking_number TEXT NULL;
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS tracking_carrier TEXT NULL;

-- Transaction completion marker (feedback eligibility unlocks for buyer after
-- this OR 7 days post-sale). Kept nullable; set manually via admin tooling or
-- future "mark as delivered" flow.
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NULL;

-- `ended_at` was referenced by the existing auction feedback eligibility
-- function. Back-fill from `end_time` for already-ended auctions so eligibility
-- works retroactively. New column mirrors end_time going forward.
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ NULL;
UPDATE auctions
  SET ended_at = end_time
  WHERE ended_at IS NULL AND status IN ('ended', 'sold');

-- Index for shipment-pending queries (seller dashboard + Transactions page)
CREATE INDEX IF NOT EXISTS idx_auctions_payment_pending_ship
  ON auctions (seller_id, shipped_at)
  WHERE payment_status = 'paid' AND shipped_at IS NULL;
