-- Add Stripe Connect fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_complete BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completed_sales_count INTEGER DEFAULT 0;

-- Index for Connect account lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_connect_account_id
  ON profiles(stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;

-- Function to atomically increment completed_sales_count
CREATE OR REPLACE FUNCTION increment_completed_sales(profile_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET completed_sales_count = COALESCE(completed_sales_count, 0) + 1
  WHERE id = profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
