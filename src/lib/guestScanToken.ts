/**
 * Server-issued signed guest cookie + Redis-backed scan accounting (H-SC3, M-SC4).
 *
 * Guests get free scans without an account. The old design trusted a client
 * header (`x-guest-scan-count`) for the limit and captcha gate, which a guest
 * could trivially reset by clearing localStorage or editing the header. This
 * module moves the source of truth server-side:
 *
 *   - On the first guest scan we mint a random id, HMAC-sign it into a cookie
 *     (via signedToken), and set it on the response.
 *   - The id keys a Redis counter (monthly TTL) that we increment per scan.
 *   - The limit + captcha threshold are enforced against the STORED counter,
 *     never the client header (which is now only a display hint).
 *   - Bonus-scan allowance (M-SC4) is also stored server-side per cookie id, so
 *     a guest can't inflate `totalLimit` from the client.
 *
 * Anonymous guests with no cookie + no Redis still get a safe default count of
 * 0 (fail-open for availability — Redis being down must not block scanning),
 * while the per-cookie counter prevents abuse once issued.
 */
import { randomUUID } from "crypto";

import { redis } from "./redis";
import { sign, verify } from "./signedToken";

/** Cookie name carrying the signed guest id. */
export const GUEST_COOKIE_NAME = "cc_guest";

/** Env var holding the guest-cookie signing secret (falls back per signedToken). */
export const GUEST_COOKIE_SECRET_NAME = "GUEST_SCAN_SECRET";

/** Redis key prefix for the per-guest monthly scan counter. */
const GUEST_SCAN_KEY_PREFIX = "guest:scans:";

/** Redis key prefix for the per-guest verified bonus-scan allowance. */
const GUEST_BONUS_KEY_PREFIX = "guest:bonus:";

/** Monthly TTL (seconds) for guest scan counters — resets ~monthly like plans. */
export const GUEST_SCAN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/** Cookie lifetime (seconds) — matches the counter window. */
export const GUEST_COOKIE_MAX_AGE_SECONDS = GUEST_SCAN_TTL_SECONDS;

export interface GuestTokenPayload {
  /** Random opaque guest id. */
  gid: string;
  /** Issued-at epoch ms (audit/debug only; expiry is enforced via cookie maxAge). */
  iat: number;
  [key: string]: unknown;
}

/** Mint a fresh random guest id (opaque, unguessable). */
export function issueGuestToken(): string {
  return randomUUID().replace(/-/g, "");
}

/** Sign a guest id into a cookie value. */
export function signGuestCookie(gid: string): string {
  const payload: GuestTokenPayload = { gid, iat: Date.now() };
  return sign(payload, GUEST_COOKIE_SECRET_NAME);
}

/**
 * Verify a guest cookie value and return its id, or null when missing/tampered.
 * The cookie carries no expiry of its own — the browser maxAge + Redis TTL bound
 * its usefulness — so we only validate the HMAC and shape.
 */
export function verifyGuestCookie(cookieValue: string | null | undefined): string | null {
  const result = verify<GuestTokenPayload>(cookieValue, GUEST_COOKIE_SECRET_NAME);
  if (!result.valid || !result.payload?.gid || typeof result.payload.gid !== "string") {
    return null;
  }
  return result.payload.gid;
}

/** Redis key for a guest's monthly scan counter. */
export function guestScanKey(gid: string): string {
  return `${GUEST_SCAN_KEY_PREFIX}${gid}`;
}

/** Redis key for a guest's verified bonus-scan allowance. */
export function guestBonusKey(gid: string): string {
  return `${GUEST_BONUS_KEY_PREFIX}${gid}`;
}

/**
 * Compute the effective scan allowance for a guest from server-trusted values.
 * base + bonus, with bonus clamped to a sane ceiling so a corrupted/oversized
 * stored value can never grant unlimited scans (M-SC4: never trust an inflated
 * allowance). Returns a non-negative integer.
 */
export function effectiveGuestAllowance(
  baseLimit: number,
  storedBonus: number,
  maxBonus: number
): number {
  const safeBonus = Math.max(0, Math.min(Number.isFinite(storedBonus) ? storedBonus : 0, maxBonus));
  return Math.max(0, baseLimit + safeBonus);
}

/**
 * Decide whether the *next* scan is allowed and whether a captcha is required,
 * from the server-stored completed-scan count. `completed` is the number of
 * scans the guest has already finished (the stored counter value).
 *
 *  - allowed:  completed < allowance
 *  - captcha:  the about-to-run scan is the (threshold+1)th or later, i.e.
 *              completed >= captchaThreshold (matches the legacy 4th/5th gate).
 */
export function evaluateGuestScan(params: {
  completed: number;
  allowance: number;
  captchaThreshold: number;
}): { allowed: boolean; captchaRequired: boolean; remaining: number } {
  const { completed, allowance, captchaThreshold } = params;
  const remaining = Math.max(0, allowance - completed);
  return {
    allowed: completed < allowance,
    captchaRequired: completed >= captchaThreshold && completed < allowance,
    remaining,
  };
}

// ============================================================================
// Redis-backed counters (server source of truth for guest limits)
// ----------------------------------------------------------------------------
// All reads/writes fail open (return 0 / no-throw) when Redis is unavailable so
// an outage degrades to the legacy "anonymous, count 0" behavior rather than
// blocking scanning entirely. Abuse protection still holds whenever Redis is up.
// ============================================================================

/** Read a guest's completed-scan count (0 when unset/unavailable). */
export async function readGuestScans(gid: string): Promise<number> {
  if (!redis) return 0;
  try {
    const value = await redis.get<number | string>(guestScanKey(gid));
    const n = typeof value === "string" ? parseInt(value, 10) : value;
    return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;
  } catch (err) {
    console.error("[guest] readGuestScans failed:", err);
    return 0;
  }
}

/** Read a guest's server-granted bonus-scan allowance (0 when unset/unavailable). */
export async function readGuestBonus(gid: string): Promise<number> {
  if (!redis) return 0;
  try {
    const value = await redis.get<number | string>(guestBonusKey(gid));
    const n = typeof value === "string" ? parseInt(value, 10) : value;
    return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;
  } catch (err) {
    console.error("[guest] readGuestBonus failed:", err);
    return 0;
  }
}

/**
 * Atomically record one completed guest scan, returning the NEW count.
 * Refreshes the monthly TTL on each scan so an active guest's window slides.
 * Falls back to a best-effort value when Redis is unavailable.
 */
export async function incrementGuestScans(gid: string): Promise<number> {
  if (!redis) return 0;
  try {
    const next = await redis.incr(guestScanKey(gid));
    // Refresh TTL each scan (cheap; keeps the window aligned to recent activity).
    await redis.expire(guestScanKey(gid), GUEST_SCAN_TTL_SECONDS);
    return typeof next === "number" ? next : 0;
  } catch (err) {
    console.error("[guest] incrementGuestScans failed:", err);
    return 0;
  }
}
