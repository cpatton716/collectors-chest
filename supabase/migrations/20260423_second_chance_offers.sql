-- ============================================================================
-- Second Chance Offers — lets a seller re-offer a cancelled (unpaid) auction
-- to the runner-up bidder at that bidder's last actual bid price. Runner-up
-- has 48 hours to accept or decline.
-- Date: April 23, 2026
-- ============================================================================

CREATE TABLE IF NOT EXISTS second_chance_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  runner_up_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  offer_price DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ NULL,
  declined_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_second_chance_runner_up
  ON second_chance_offers (runner_up_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_second_chance_auction
  ON second_chance_offers (auction_id);
CREATE INDEX IF NOT EXISTS idx_second_chance_pending_expiry
  ON second_chance_offers (expires_at)
  WHERE status = 'pending';

ALTER TABLE second_chance_offers ENABLE ROW LEVEL SECURITY;

-- Runner-up can read their own offers
CREATE POLICY "Runner-up can read own offers"
  ON second_chance_offers FOR SELECT
  USING (runner_up_profile_id IN (
    SELECT id FROM profiles WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));

-- Seller can read offers for their auctions (via auction FK)
CREATE POLICY "Seller can read offers on their auctions"
  ON second_chance_offers FOR SELECT
  USING (auction_id IN (
    SELECT id FROM auctions WHERE seller_id IN (
      SELECT id FROM profiles WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  ));

-- Allow service role inserts/updates (the lib uses supabaseAdmin, service
-- role bypasses RLS — this is a sanity floor that documents intent).
CREATE POLICY "Service role can insert second chance offers"
  ON second_chance_offers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update second chance offers"
  ON second_chance_offers FOR UPDATE
  USING (true);

COMMENT ON TABLE second_chance_offers IS 'Seller-initiated second-chance offers to the runner-up bidder after the original winner misses their 48-hour payment deadline. Price is the runner-up last actual bid (not max bid). 48-hour accept/decline window.';
COMMENT ON COLUMN second_chance_offers.offer_price IS 'Runner-up last actual bid amount from bids.bid_amount (not max_bid).';
