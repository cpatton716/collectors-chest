-- Backfill: existing shipment notifications were created with type='ended'
-- (the old mark-shipped route overloaded the auction-ended type and supplied
-- a custom title). After the dedicated 'shipped' type was added in
-- 20260427_add_shipped_notification_type.sql, new rows use the right type
-- but old rows still render with the Clock icon in the bell. Re-tag them
-- so they pick up the Truck icon retroactively.
--
-- Title match is precise — `createNotification` uses "Auction ended" as the
-- default title for type='ended', and mark-shipped is the only call site
-- that overrode it to "Your comic has shipped!"
--
-- Idempotent: re-running is a no-op once the rows have flipped.

UPDATE notifications
   SET type = 'shipped'
 WHERE type = 'ended'
   AND title = 'Your comic has shipped!';
