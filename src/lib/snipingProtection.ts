/**
 * Sniping protection for auctions: when a bid arrives within the final
 * SNIPING_WINDOW_MS of an auction's end_time, extend the end_time by
 * SNIPING_EXTENSION_MS so other bidders have a chance to respond. Caps
 * cumulative extension at MAX_EXTENSION_MS past the originally scheduled
 * end so a sustained back-and-forth can't run an auction indefinitely.
 *
 * Pure helper — no DB I/O. Caller (placeBid in auctionDb.ts) is responsible
 * for stamping `original_end_time` on the first extension and writing the
 * new `end_time` back to the row.
 */

/** Bids landing within this window of `end_time` trigger an extension. */
const SNIPING_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
/** Length of each extension. */
const SNIPING_EXTENSION_MS = 5 * 60 * 1000; // 5 minutes
/** Hard cap on cumulative extension time past the originally scheduled end. */
const MAX_EXTENSION_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Compute the new `end_time` for an auction whose latest bid arrived inside
 * the sniping protection window. Returns undefined if no extension applies
 * (bid was not inside the window OR cap has been reached OR auction already
 * ended).
 */
export function computeSnipingExtension(
  auction: { end_time: string; original_end_time?: string | null },
  now: Date = new Date(),
): string | undefined {
  const endMs = new Date(auction.end_time).getTime();
  const nowMs = now.getTime();
  const remaining = endMs - nowMs;

  // Bid arrived too early (>5 min before end) — no extension.
  if (remaining > SNIPING_WINDOW_MS) return undefined;
  // Auction already ended — placeBid's earlier guard should have caught this.
  if (remaining < 0) return undefined;

  // Cap check: never push end_time more than MAX_EXTENSION_MS past the
  // original scheduled end. The original might be the auction's first
  // recorded end (if no extensions yet) or `original_end_time` (set on
  // first extension).
  const originalEndMs = auction.original_end_time
    ? new Date(auction.original_end_time).getTime()
    : endMs;
  const proposedEndMs = endMs + SNIPING_EXTENSION_MS;
  const capMs = originalEndMs + MAX_EXTENSION_MS;
  const newEndMs = Math.min(proposedEndMs, capMs);

  // If the cap clamps us back to the existing end_time (or earlier), no real
  // extension happens — return undefined so the caller doesn't write a no-op
  // update.
  if (newEndMs <= endMs) return undefined;

  return new Date(newEndMs).toISOString();
}
