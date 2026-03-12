-- Add show_financials preference to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_financials BOOLEAN DEFAULT true;
