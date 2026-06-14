/**
 * Shared HMAC sign/verify helper (H-SC3).
 *
 * Stamps an arbitrary JSON payload with a constant-time-verifiable HMAC-SHA256
 * signature over Node's built-in `crypto` — NO new dependency. The output is a
 * compact, URL-safe `<base64url(payload)>.<base64url(sig)>` string suitable for
 * cookies, query params, and email links.
 *
 * Reused by:
 *   - guestScanToken (B1) — signed guest cookie id
 *   - promoTrial + the unsubscribe route (B20) — signed one-time tokens
 *
 * Secret resolution: every caller names the env var that holds its signing
 * secret. To avoid forcing a brand-new required env var into every deploy, the
 * resolver falls back to `CLERK_SECRET_KEY` (always present in this app) when the
 * named secret is unset. The named var still takes precedence so operators can
 * rotate per-purpose secrets independently later.
 */
import { createHmac, timingSafeEqual } from "crypto";

/** Fallback signing secret — always configured (Clerk is mandatory here). */
const FALLBACK_SECRET_NAME = "CLERK_SECRET_KEY";

export interface SignedTokenPayload {
  /** Optional absolute expiry, epoch milliseconds. Enforced by verify(). */
  exp?: number;
  // Arbitrary caller fields.
  [key: string]: unknown;
}

export interface VerifyResult<T extends SignedTokenPayload = SignedTokenPayload> {
  valid: boolean;
  /** Present only when valid === true. */
  payload?: T;
  /** Machine-readable failure cause when valid === false. */
  reason?: "malformed" | "bad-signature" | "expired" | "no-secret";
}

/**
 * Resolve the signing secret for a named env var, falling back to the always-
 * present Clerk secret. Returns null only when neither is configured (so callers
 * fail closed rather than signing with an empty key).
 */
function resolveSecret(secretName: string): string | null {
  const named = process.env[secretName];
  if (named && named.length > 0) return named;
  const fallback = process.env[FALLBACK_SECRET_NAME];
  if (fallback && fallback.length > 0) return fallback;
  return null;
}

function base64UrlEncode(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(normalized, "base64");
}

function hmac(data: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

/**
 * Sign a payload, returning `<base64url(json)>.<base64url(hmac)>`.
 * Throws if no signing secret is configured (a programmer/ops error, not a
 * user-input error — callers should ensure the secret exists at boot).
 */
export function sign(payload: SignedTokenPayload, secretName: string): string {
  const secret = resolveSecret(secretName);
  if (!secret) {
    throw new Error(
      `signedToken.sign: no signing secret (set ${secretName} or ${FALLBACK_SECRET_NAME})`
    );
  }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode(hmac(encodedPayload, secret));
  return `${encodedPayload}.${signature}`;
}

/**
 * Verify a token. Returns `{ valid, payload, reason }`. Fails closed on a
 * tampered payload, a mismatched signature, an expired `exp`, malformed input,
 * or a missing secret. The signature is compared in constant time.
 */
export function verify<T extends SignedTokenPayload = SignedTokenPayload>(
  token: string | null | undefined,
  secretName: string,
  now: number = Date.now()
): VerifyResult<T> {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "malformed" };
  }
  const secret = resolveSecret(secretName);
  if (!secret) return { valid: false, reason: "no-secret" };

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { valid: false, reason: "malformed" };
  }
  const [encodedPayload, providedSig] = parts;

  const expectedSig = hmac(encodedPayload, secret);
  const providedBuf = base64UrlDecode(providedSig);
  // Constant-time compare; lengths must match for timingSafeEqual.
  if (
    providedBuf.length !== expectedSig.length ||
    !timingSafeEqual(providedBuf, expectedSig)
  ) {
    return { valid: false, reason: "bad-signature" };
  }

  let payload: T;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as T;
  } catch {
    return { valid: false, reason: "malformed" };
  }

  if (typeof payload.exp === "number" && now > payload.exp) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, payload };
}
