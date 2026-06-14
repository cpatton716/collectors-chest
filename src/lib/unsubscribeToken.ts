/**
 * Unsubscribe-token single source of truth (M-EM4).
 *
 * Both the email sender (`src/lib/email.ts`, which stamps List-Unsubscribe
 * headers) and the unsubscribe route (`src/app/api/unsubscribe/route.ts`, which
 * verifies the link the recipient clicks) import their mint/verify/URL helpers
 * from HERE so the secret name + signed payload shape can never drift apart. A
 * token minted while sending an email therefore always verifies in the route.
 *
 * The token is a SIGNED (HMAC via `signedToken` / B1) payload — the route never
 * trusts a raw profile id in the query string.
 */
import { sign, verify } from "@/lib/signedToken";

/** Env var holding the unsubscribe-token signing secret (falls back per signedToken). */
export const UNSUBSCRIBE_SECRET_NAME = "UNSUBSCRIBE_SECRET";

/** Marker every valid unsubscribe token must carry. */
export const UNSUBSCRIBE_PURPOSE = "unsubscribe";

/** Default unsubscribe-link lifetime — long enough that old emails still work. */
export const UNSUBSCRIBE_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

/** Email preference categories that can be toggled via an unsubscribe link. */
export type UnsubscribeCategory = "marketing" | "marketplace" | "social";

/** Map a category to its `profiles` preference column. */
export const CATEGORY_COLUMN: Record<UnsubscribeCategory, string> = {
  marketing: "email_pref_marketing",
  marketplace: "email_pref_marketplace",
  social: "email_pref_social",
};

/**
 * Coerce an arbitrary category string (e.g. the email layer's `getCategory`
 * result) to a known `UnsubscribeCategory`. Anything we don't recognize — or a
 * `transactional` value that should never carry an unsubscribe link — collapses
 * to "marketing" (the broadest opt-out).
 */
export function normalizeCategory(
  category: string | null | undefined
): UnsubscribeCategory {
  if (category && category in CATEGORY_COLUMN) {
    return category as UnsubscribeCategory;
  }
  return "marketing";
}

export interface UnsubscribeTokenPayload {
  purpose: string;
  /** profiles.id (UUID) to opt out. */
  profileId: string;
  /** Which preference to clear; defaults to "marketing" when absent. */
  category?: UnsubscribeCategory;
  iat: number;
  exp?: number;
  [key: string]: unknown;
}

/**
 * Mint a signed unsubscribe token for an email link/header. Shared by both the
 * email sender and the route so they agree on the contract. Returns a compact
 * URL-safe string suitable for a query param.
 */
export function mintUnsubscribeToken(
  profileId: string,
  category: string = "marketing",
  options?: { ttlMs?: number; now?: number }
): string {
  const now = options?.now ?? Date.now();
  const ttl = options?.ttlMs ?? UNSUBSCRIBE_TOKEN_TTL_MS;
  const payload: UnsubscribeTokenPayload = {
    purpose: UNSUBSCRIBE_PURPOSE,
    profileId,
    category: normalizeCategory(category),
    iat: now,
    exp: now + ttl,
  };
  return sign(payload, UNSUBSCRIBE_SECRET_NAME);
}

/**
 * Build the absolute one-click unsubscribe URL for an email header/footer.
 * Uses NEXT_PUBLIC_APP_URL (falls back to prod domain).
 */
export function buildUnsubscribeUrl(
  profileId: string,
  category: string = "marketing",
  options?: { ttlMs?: number; now?: number }
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";
  const token = mintUnsubscribeToken(profileId, category, options);
  const url = new URL("/api/unsubscribe", appUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

/**
 * Verify an unsubscribe token. Returns the resolved profileId + category on
 * success, or null on any failure (bad signature, wrong purpose, expired,
 * malformed). Never returns a profileId we didn't sign.
 */
export function verifyUnsubscribeToken(
  token: string | null | undefined,
  now: number = Date.now()
): { profileId: string; category: UnsubscribeCategory } | null {
  if (!token) return null;
  const result = verify<UnsubscribeTokenPayload>(token, UNSUBSCRIBE_SECRET_NAME, now);
  if (!result.valid || result.payload?.purpose !== UNSUBSCRIBE_PURPOSE) return null;
  const profileId = result.payload.profileId;
  if (!profileId || typeof profileId !== "string") return null;
  return { profileId, category: normalizeCategory(result.payload.category) };
}
