-- Migration: comic_sold_tracking.sql
-- Adds ownership-transfer + seller-read-only support for marketplace purchases.
--
-- When a Buy Now or auction payment completes, the webhook clones the seller's
-- `comics` row into a fresh row for the buyer, and marks the seller's original
-- row as sold via these columns. Rows with sold_at IS NOT NULL become read-only
-- (enforced at the server layer in src/lib/db.ts).

-- 1. Track when a comic was sold and to whom
ALTER TABLE comics ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ NULL;
ALTER TABLE comics ADD COLUMN IF NOT EXISTS sold_to_profile_id UUID NULL REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE comics ADD COLUMN IF NOT EXISTS sold_via_auction_id UUID NULL REFERENCES auctions(id) ON DELETE SET NULL;

-- 2. Index for sold-history queries (seller viewing their own sold comics)
CREATE INDEX IF NOT EXISTS idx_comics_sold_history
  ON comics (user_id, sold_at DESC)
  WHERE sold_at IS NOT NULL;

-- 3. Index for buyer lookup (who bought this comic)
CREATE INDEX IF NOT EXISTS idx_comics_sold_to_profile
  ON comics (sold_to_profile_id)
  WHERE sold_to_profile_id IS NOT NULL;

-- 4. Index for tracking which listing generated which sold comic row
CREATE INDEX IF NOT EXISTS idx_comics_sold_via_auction
  ON comics (sold_via_auction_id)
  WHERE sold_via_auction_id IS NOT NULL;
