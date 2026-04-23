-- ============================================================================
-- Payment deadline enforcement — tracking columns + index
-- Date: April 23, 2026
--
-- Purpose:
--   Adds the two columns the payment-deadline cron needs to be idempotent:
--
--   1. payment_reminder_sent_at — stamped when the T-24h reminder email
--      fires. A NULL value means "reminder has not been sent yet"; the
--      cron uses this in a WHERE clause so repeated invocations can't
--      re-send the reminder.
--   2. payment_expired_at — stamped when the post-deadline expiration
--      pass flips the auction to `status='cancelled'` because the
--      winner missed their payment window. Serves as an audit trail
--      AND as a race-safe guard (UPDATE … WHERE payment_expired_at IS NULL).
--
-- Plus a partial index on (payment_deadline) filtered to the rows we
-- actually scan every cron run — ended auctions awaiting payment.
-- ============================================================================

ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS payment_reminder_sent_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS payment_expired_at TIMESTAMPTZ NULL;

-- Partial index for the reminder + expiration cron queries. Keeps the scan
-- narrow on auction tables that grow over time.
CREATE INDEX IF NOT EXISTS idx_auctions_pending_payment_deadline
  ON auctions (payment_deadline)
  WHERE status = 'ended' AND payment_status = 'pending';
