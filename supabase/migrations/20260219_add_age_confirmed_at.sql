-- Add age confirmation field to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS age_confirmed_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN profiles.age_confirmed_at IS 'Timestamp when user confirmed they are 18+. NULL means unverified.';
