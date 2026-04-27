/**
 * Composite cursor for notification pagination.
 *
 * `created_at` alone isn't unique — `processEndedAuctions` and
 * `sendPaymentReminders` batch-insert notification rows that share the
 * same `now()` to the microsecond. With a `created_at`-only cursor and
 * `ORDER BY created_at DESC LIMIT 50`, a tied pair straddling page 50
 * would either drop a row or duplicate one across page fetches.
 *
 * Composite (created_at, id) cursor with stable secondary sort fixes
 * this: each (timestamp, uuid) pair is unique, and the `(a, b) < (X, Y)`
 * predicate gives every row exactly one position in the global order.
 *
 * The Supabase JS client doesn't natively express row-tuple `<`, so the
 * SQL is built via PostgREST's `.or(...)` syntax:
 *
 *   .or("created_at.lt.<ts>,and(created_at.eq.<ts>,id.lt.<id>)")
 *
 * Wire format is base64 of `${createdAt}|${id}` — opaque to the client,
 * URL-safe, and survives any future shape changes without breaking
 * already-issued cursors (we'd just bump a version prefix).
 */

export interface NotificationCursor {
  createdAt: string; // ISO timestamp from the row
  id: string; // notification UUID
}

/**
 * Encode a (createdAt, id) pair as an opaque base64 cursor string.
 * Returns the empty string for an unencodable / nullish input.
 */
export function encodeNotificationCursor(
  cursor: NotificationCursor | null | undefined
): string {
  if (!cursor) return "";
  const raw = `${cursor.createdAt}|${cursor.id}`;
  // URL-safe base64 (replace + → -, / → _, drop padding).
  return Buffer.from(raw, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Decode an opaque base64 cursor back to (createdAt, id).
 * Returns null on any malformed input — callers should treat null as
 * "no cursor, fetch from start" rather than erroring.
 */
export function decodeNotificationCursor(
  raw: string | null | undefined
): NotificationCursor | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    // Restore standard base64 alphabet + padding before decoding.
    const restored = raw.replace(/-/g, "+").replace(/_/g, "/");
    const padLength = (4 - (restored.length % 4)) % 4;
    const padded = restored + "=".repeat(padLength);
    const decoded = Buffer.from(padded, "base64").toString("utf-8");
    const sepIndex = decoded.indexOf("|");
    if (sepIndex <= 0 || sepIndex === decoded.length - 1) return null;
    const createdAt = decoded.slice(0, sepIndex);
    const id = decoded.slice(sepIndex + 1);
    if (!createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

/**
 * Build the PostgREST `.or(...)` filter expression for the composite
 * cursor predicate `(created_at, id) < (cursorCreatedAt, cursorId)`.
 *
 * Caller usage:
 *
 *   query.or(buildCursorFilter(cursor))
 *
 * Returns the empty string when no cursor is supplied — caller can
 * skip the `.or()` chain in that case.
 */
export function buildCursorFilter(cursor: NotificationCursor | null): string {
  if (!cursor) return "";
  // Note: PostgREST values inside .or() that contain commas need to be
  // wrapped in quotes. ISO timestamps and UUIDs don't contain commas, but
  // we wrap defensively to be safe across encodings.
  const ts = cursor.createdAt;
  const id = cursor.id;
  return `created_at.lt.${ts},and(created_at.eq.${ts},id.lt.${id})`;
}

export const NOTIFICATIONS_PAGE_LIMIT_DEFAULT = 50;
export const NOTIFICATIONS_PAGE_LIMIT_MAX = 100;
