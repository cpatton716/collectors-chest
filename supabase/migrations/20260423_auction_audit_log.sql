-- ============================================================================
-- Auction Audit Log — backend-only event trail for auction marketplace
-- Date: April 23, 2026
--
-- Purpose:
--   Dedicated log table for auction lifecycle events (auction created/ended/
--   cancelled/expired/completed, bids placed/won/lost, offers created/
--   accepted/rejected/countered/expired, payment events, shipments, listing
--   expirations). Used by admins for debugging, compliance, and dispute
--   resolution.
--
--   NOT user-facing. Service role writes; admins read via RLS.
--
-- Retention target: 2 years. Pruning (records older than 24 months) is a
-- separate future task and out of scope here.
-- ============================================================================

-- Enum of all event types the log can record. Extend via ALTER TYPE ... ADD VALUE
-- when new events are added.
CREATE TYPE auction_audit_event_type AS ENUM (
  'auction_created',
  'auction_activated',
  'auction_ended',
  'auction_cancelled',
  'auction_payment_expired',
  'auction_completed',
  'bid_placed',
  'bid_won',
  'bid_lost',
  'offer_created',
  'offer_accepted',
  'offer_rejected',
  'offer_countered',
  'offer_expired',
  'payment_initiated',
  'payment_succeeded',
  'payment_failed',
  'payment_refunded',
  'shipment_created',
  'listing_expired'
);

CREATE TABLE IF NOT EXISTS auction_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NULL REFERENCES auctions(id) ON DELETE SET NULL,
  offer_id UUID NULL REFERENCES offers(id) ON DELETE SET NULL,
  actor_profile_id UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  event_type auction_audit_event_type NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes sized for admin-side query patterns: "show everything for this
-- auction", "show everything this actor did", "find all events of type X".
-- Index names are scoped to `auction_audit_log` to avoid collisions with
-- the unrelated admin_audit_log table (which uses idx_audit_log_*).
CREATE INDEX IF NOT EXISTS idx_auction_audit_log_auction
  ON auction_audit_log (auction_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auction_audit_log_offer
  ON auction_audit_log (offer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auction_audit_log_actor
  ON auction_audit_log (actor_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auction_audit_log_event_type
  ON auction_audit_log (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auction_audit_log_created_at
  ON auction_audit_log (created_at DESC);

-- RLS: admins only (end users should never read this table directly)
ALTER TABLE auction_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read auction audit log"
  ON auction_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        AND profiles.is_admin = true
    )
  );

-- Service role bypasses RLS anyway; this policy is a sanity floor that
-- documents intent — the lib helpers use supabaseAdmin (service role).
CREATE POLICY "Service role can insert auction audit log"
  ON auction_audit_log FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE auction_audit_log IS 'Backend audit trail for auction marketplace events. 2-year retention target. Admin-only reads.';
COMMENT ON COLUMN auction_audit_log.auction_id IS 'Optional FK to auctions; SET NULL on delete so audit history survives row cleanup.';
COMMENT ON COLUMN auction_audit_log.offer_id IS 'Optional FK to offers; SET NULL on delete so audit history survives row cleanup.';
COMMENT ON COLUMN auction_audit_log.actor_profile_id IS 'Profile who triggered the event (bidder/buyer/seller). NULL for system-initiated events (cron).';
COMMENT ON COLUMN auction_audit_log.event_data IS 'Arbitrary event-specific JSON. No PII (no names, addresses, payment details). IDs and amounts only.';
