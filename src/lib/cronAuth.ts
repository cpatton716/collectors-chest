/**
 * Shared cron-secret verification.
 *
 * Every cron route guards on a Bearer token equal to `CRON_SECRET`. Doing the
 * comparison with `===` leaks timing information (early-exit on the first
 * differing byte), so we use `crypto.timingSafeEqual` for a constant-time
 * compare. We also fail closed: when `CRON_SECRET` is unset the request is
 * rejected rather than allowed.
 *
 * Usage:
 *   if (!verifyCronSecret(request)) return cronUnauthorized();
 */
import { createHash, timingSafeEqual } from "crypto";

import { NextResponse } from "next/server";

/**
 * Constant-time comparison of two strings. Hashing both sides first means we
 * compare fixed-length digests, so the comparison can't leak the secret's
 * length and `timingSafeEqual` never throws on mismatched buffer sizes.
 */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Verify the `Authorization: Bearer <CRON_SECRET>` header on a cron request.
 *
 * Fails closed: returns `false` when `CRON_SECRET` is unset/empty, when the
 * header is missing, or when the token doesn't match (constant-time).
 */
export function verifyCronSecret(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  return safeEqual(authHeader, `Bearer ${cronSecret}`);
}

/** Standard 401 response for failed cron auth. */
export function cronUnauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
