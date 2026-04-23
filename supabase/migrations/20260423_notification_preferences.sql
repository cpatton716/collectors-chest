-- Per-category email notification preferences.
-- Transactional emails are always-on (not stored; always sent).
--
-- Categories:
--   marketplace — bids, outbids, offers, second-chance, new listings, feedback
--   social      — new follower, messages, mentions, message-report outcomes
--   marketing   — product updates, tips, promotions, newsletter
--   transactional — always on (not a column): payment, shipping, account security
--
-- Existing users are opted-in by default; they can opt out via
-- /settings/notifications.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_pref_marketplace BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_pref_social BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_pref_marketing BOOLEAN NOT NULL DEFAULT true;

-- Backfill is implicit via DEFAULT true. New profiles pick up the defaults
-- automatically; no application-side change needed for profile creation.
