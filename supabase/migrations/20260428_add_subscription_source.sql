-- Add subscription_source column to profiles
--
-- Distinguishes how a user obtained Premium access: 'stripe' (paying
-- customer), 'trial' (free 7-day or admin-granted trial), or 'comped'
-- (co-founder / business comp / never expires).
--
-- This is the marker that lets revenue analytics filter out comped accounts
-- (e.g., `WHERE subscription_source <> 'comped'`) and lets future code
-- detect "this is a comped account, do not run trial-conversion or expiry
-- logic on it."
--
-- Stripe webhook safety: comped accounts have stripe_customer_id = NULL,
-- so `getProfileByStripeCustomerId(customerId)` lookups never match them.
-- Stripe events therefore can't accidentally downgrade a comped row.
-- Postgres allows multiple NULLs in a UNIQUE column so this scales.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_source TEXT DEFAULT 'stripe'
    CHECK (subscription_source IN ('stripe', 'comped', 'trial'));

-- Backfill existing rows so the column reflects current reality:
-- - Anyone with a trial timestamp set is/was a trial user
-- - Anyone with an active Stripe subscription is a paying customer
-- - Everyone else stays at the default ('stripe') and will fall through to
--   their natural state (most are free-tier with subscription_tier='free')
UPDATE profiles
   SET subscription_source = 'trial'
 WHERE trial_started_at IS NOT NULL
   AND subscription_source = 'stripe';

UPDATE profiles
   SET subscription_source = 'stripe'
 WHERE stripe_subscription_id IS NOT NULL
   AND trial_started_at IS NULL
   AND subscription_source = 'stripe';

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_source
  ON profiles(subscription_source);

COMMENT ON COLUMN profiles.subscription_source IS
  'How the user obtained their current tier: stripe (paying), trial (7-day or admin-granted with expiry), or comped (co-founder / business comp / never expires)';
