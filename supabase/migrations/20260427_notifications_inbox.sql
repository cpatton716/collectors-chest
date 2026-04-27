-- Notifications Inbox v1 (Apr 27, 2026)
-- Adds read_at timestamp + supporting indexes + DELETE RLS policy.
-- Companion migration to 20260427_add_shipped_notification_type.sql.

-- 1. read_at lets us prune old read notifications (30-day cleanup) without
--    losing the timestamp meaning of `is_read`. Backfill = created_at as a
--    best estimate for rows that were already marked read.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ NULL;

UPDATE notifications
   SET read_at = created_at
 WHERE is_read = true AND read_at IS NULL;

-- 2. Cursor pagination uses (user_id, created_at DESC). The existing
--    composite (user_id, is_read, created_at DESC) didn't lead with the
--    columns we filter on first.
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

-- 3. Cleanup cron prunes WHERE read_at IS NOT NULL AND read_at < cutoff.
--    Partial index keeps it tiny.
CREATE INDEX IF NOT EXISTS idx_notifications_cleanup
  ON notifications(read_at) WHERE read_at IS NOT NULL;

-- 4. DELETE RLS policy. Existing schema has SELECT/INSERT/UPDATE policies
--    but not DELETE — the new per-row dismiss button + cron prune both
--    need it. Service-role admin client bypasses RLS regardless, but this
--    is defense-in-depth for any future code path that uses the anon
--    client.
DROP POLICY IF EXISTS "notifications_delete_policy" ON notifications;
CREATE POLICY "notifications_delete_policy" ON notifications
  FOR DELETE USING (
    user_id = public.current_profile_id()
  );
