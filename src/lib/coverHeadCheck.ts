/**
 * Periodic HEAD check for cached cover image URLs.
 *
 * Run from the main `/api/cron/process-auctions` tick on a 30-day cycle:
 * picks N approved cover_images that haven't been HEAD-checked recently,
 * issues HEAD requests with a short timeout, and marks dead URLs as rejected
 * so we stop serving them to users.
 *
 * Why 30 days: eBay listing-image CDN URLs are stable for months while a
 * listing is active and may go dark only after the listing closes. Checking
 * monthly catches expired URLs without burning cron time on healthy ones.
 *
 * BACKLOG: "Periodic HEAD Check for Cached eBay URLs" (Mar 20, 2026).
 */

import { supabaseAdmin } from "./supabase";

// Per-batch limits keep the work inside the cron function's time budget.
// At ~500ms HEAD per URL with concurrency-bounded fetches, 50 covers = ~10s.
const HEAD_CHECK_BATCH_SIZE = 50;
const HEAD_TIMEOUT_MS = 5000;
const STALE_AFTER_DAYS = 30;
const HEAD_CONCURRENCY = 5;

export interface HeadCheckResult {
  checked: number;
  alive: number;
  dead: number;
  errors: number;
}

/**
 * Mark cover_images whose HTTP HEAD returns 4xx/5xx as rejected so the
 * scan/serving paths stop returning them. Network errors and timeouts are
 * recorded as `errors` and the row's `last_head_checked_at` is left
 * unchanged so a future cron tick will retry.
 */
export async function checkCoverImageHeadStatus(
  batchSize: number = HEAD_CHECK_BATCH_SIZE,
): Promise<HeadCheckResult> {
  const cutoff = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Pick approved covers whose last_head_checked_at is NULL (never-checked,
  // priority) or older than the staleness window.
  const { data: rows, error } = await supabaseAdmin
    .from("cover_images")
    .select("id, image_url, last_head_checked_at")
    .eq("status", "approved")
    .or(`last_head_checked_at.is.null,last_head_checked_at.lt.${cutoff}`)
    .order("last_head_checked_at", { ascending: true, nullsFirst: true })
    .limit(batchSize);

  if (error) {
    console.error("[cover-head-check] fetch failed:", error);
    return { checked: 0, alive: 0, dead: 0, errors: 1 };
  }
  if (!rows || rows.length === 0) {
    return { checked: 0, alive: 0, dead: 0, errors: 0 };
  }

  const result: HeadCheckResult = { checked: 0, alive: 0, dead: 0, errors: 0 };

  // Bounded concurrency — serialize in groups of HEAD_CONCURRENCY to avoid
  // bursting eBay's CDN with parallel HEAD requests.
  for (let i = 0; i < rows.length; i += HEAD_CONCURRENCY) {
    const slice = rows.slice(i, i + HEAD_CONCURRENCY);
    await Promise.all(
      slice.map(async (row) => {
        result.checked++;
        try {
          const res = await fetch(row.image_url, {
            method: "HEAD",
            // redirect:manual — don't transparently follow a redirect to an
            // arbitrary host (SSRF / dead-CDN masking). A 3xx is treated as a
            // live URL (alive) below since `res.ok` is false for opaqueredirect.
            redirect: "manual",
            signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
          });
          // With redirect:manual a redirect surfaces as an opaqueredirect
          // response (status 0) rather than being followed — treat it as alive,
          // not dead, so we don't reject URLs that legitimately 301/302.
          if (res.ok || res.type === "opaqueredirect" || res.status === 0) {
            result.alive++;
            await supabaseAdmin
              .from("cover_images")
              .update({ last_head_checked_at: new Date().toISOString() })
              .eq("id", row.id);
            return;
          }
          // 4xx (gone, forbidden) or 5xx — treat as dead and reject so the
          // scan/serving paths stop returning this URL. We don't auto-delete
          // because admins may want to audit dead-URL rates before purging.
          if (res.status >= 400) {
            result.dead++;
            await supabaseAdmin
              .from("cover_images")
              .update({
                status: "rejected",
                last_head_checked_at: new Date().toISOString(),
              })
              .eq("id", row.id);
            console.warn(
              `[cover-head-check] dead url marked rejected: id=${row.id} status=${res.status}`,
            );
          }
        } catch (err) {
          // Network blip / timeout — record as error and leave the row's
          // last_head_checked_at NULL/stale so a future tick retries.
          result.errors++;
          if (process.env.NODE_ENV !== "production") {
            console.warn(`[cover-head-check] HEAD threw for id=${row.id}:`, err);
          }
        }
      }),
    );
  }

  return result;
}
