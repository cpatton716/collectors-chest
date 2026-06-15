// AUTO-EXTRACTED from auctionDb.ts during R1-auctiondb refactor (M-AU9).
// Behavior-preserving: function bodies moved verbatim.

// ============================================================================
// EMAIL FORMATTING HELPERS
// ============================================================================

/**
 * Render a deadline timestamp for inclusion in transactional emails.
 *
 * Uses America/New_York and includes a short timezone abbreviation
 * (e.g. "EDT", "EST") so recipients can interpret the time without
 * ambiguity. Beta users are US-focused; this is a deliberately simple
 * fix until per-profile timezone preferences land (BACKLOG, post-launch).
 *
 * Example output: "April 26, 2026 at 10:20 AM EDT"
 */
export function formatDeadlineForEmail(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(date);
}

/**
 * Upper bound on the number of rows any single cron pass will claim per tick.
 * Cron runs every minute, so a backlog drains across successive ticks rather
 * than letting one invocation fan out an unbounded number of DB round-trips,
 * emails, and notifications (which can blow the function time budget). M-AU7 /
 * M-MK13. The DB-side ORDER BY that would make this deterministic across ticks
 * for natural-end processing is left as-is; the cap alone bounds blast radius.
 */
export const CRON_BATCH_LIMIT = 200;
