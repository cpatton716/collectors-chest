-- Add column to track when trial expiration reminder was sent
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_reminder_sent_at TIMESTAMPTZ;
