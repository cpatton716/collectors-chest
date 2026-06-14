/**
 * One-click email unsubscribe (M-EM4 route half / L-PAY17).
 *
 * Non-transactional emails carry `List-Unsubscribe` / `List-Unsubscribe-Post`
 * headers and a "Manage email preferences" footer link pointing here (the
 * headers themselves are added in B24's email.ts). This route verifies a SIGNED
 * unsubscribe token (HMAC via signedToken / B1 — never trusts a raw profile id
 * in the query string) and flips the relevant email preference off.
 *
 * Two entry points:
 *   - POST  → RFC 8058 one-click (what Gmail/Apple Mail call automatically when
 *             the user taps the native "Unsubscribe" affordance). Returns 200.
 *   - GET   → human clicking the footer link. Redirects to the settings page
 *             with a status message so the UX is friendly.
 *
 * The token's `category` selects which preference column to clear; absent /
 * unknown categories default to `marketing` (the broadest opt-out).
 */
import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { sign, verify } from "@/lib/signedToken";
import { supabaseAdmin } from "@/lib/supabase";
import { validateQuery } from "@/lib/validation";

/** Env var holding the unsubscribe-token signing secret (falls back per signedToken). */
export const UNSUBSCRIBE_SECRET_NAME = "UNSUBSCRIBE_SECRET";

/** Marker every valid unsubscribe token must carry. */
export const UNSUBSCRIBE_PURPOSE = "unsubscribe";

/** Default unsubscribe-link lifetime — long enough that old emails still work. */
export const UNSUBSCRIBE_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

/** Email preference categories that can be toggled via an unsubscribe link. */
export type UnsubscribeCategory = "marketing" | "marketplace" | "social";

/** Map a category to its `profiles` preference column. */
const CATEGORY_COLUMN: Record<UnsubscribeCategory, string> = {
  marketing: "email_pref_marketing",
  marketplace: "email_pref_marketplace",
  social: "email_pref_social",
};

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
 * Mint a signed unsubscribe token for an email link/header. Shared with B24's
 * email.ts (imported from here) so the route and the sender agree on the
 * contract. Returns a compact URL-safe string suitable for a query param.
 */
export function mintUnsubscribeToken(
  profileId: string,
  category: UnsubscribeCategory = "marketing",
  options?: { ttlMs?: number; now?: number }
): string {
  const now = options?.now ?? Date.now();
  const ttl = options?.ttlMs ?? UNSUBSCRIBE_TOKEN_TTL_MS;
  const payload: UnsubscribeTokenPayload = {
    purpose: UNSUBSCRIBE_PURPOSE,
    profileId,
    category,
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
  category: UnsubscribeCategory = "marketing",
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
  const category: UnsubscribeCategory =
    result.payload.category && result.payload.category in CATEGORY_COLUMN
      ? result.payload.category
      : "marketing";
  return { profileId, category };
}

const unsubscribeQuerySchema = z.object({
  token: z.string().min(1, "Unsubscribe token is required").max(1024),
});

/**
 * Apply the opt-out: flip the category's preference column to false. Returns
 * true on success. Best-effort — a missing column / row is treated as failure
 * by the caller's messaging but never throws.
 */
async function applyUnsubscribe(
  profileId: string,
  category: UnsubscribeCategory
): Promise<boolean> {
  const column = CATEGORY_COLUMN[category];
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ [column]: false })
    .eq("id", profileId);

  if (error) {
    console.error("[unsubscribe] Failed to update preference:", error);
    return false;
  }
  return true;
}

/**
 * POST — RFC 8058 one-click unsubscribe. Mail clients POST here automatically;
 * always answer 200 so the native affordance reports success, but only mutate
 * on a valid token.
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const verified = verifyUnsubscribeToken(searchParams.get("token"));
    if (verified) {
      await applyUnsubscribe(verified.profileId, verified.category);
    }
    // One-click expects a 2xx regardless; do not leak token validity.
    return new NextResponse(null, { status: 200 });
  } catch (err) {
    console.error("[unsubscribe] POST error:", err);
    return new NextResponse(null, { status: 200 });
  }
}

/**
 * GET — human clicks the footer link. Verify, apply, and redirect to the
 * notification settings page with a friendly status message.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryResult = validateQuery(unsubscribeQuerySchema, searchParams);
    if (!queryResult.success) {
      return redirectWithStatus("error");
    }

    const verified = verifyUnsubscribeToken(queryResult.data.token);
    if (!verified) {
      return redirectWithStatus("invalid");
    }

    const ok = await applyUnsubscribe(verified.profileId, verified.category);
    return redirectWithStatus(ok ? "success" : "error", verified.category);
  } catch (err) {
    console.error("[unsubscribe] GET error:", err);
    return redirectWithStatus("error");
  }
}

/** Redirect to the notification settings page carrying an unsubscribe status. */
function redirectWithStatus(
  status: "success" | "invalid" | "error",
  category?: UnsubscribeCategory
): NextResponse {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";
  const url = new URL("/settings/notifications", appUrl);
  url.searchParams.set("unsubscribe", status);
  if (category) url.searchParams.set("category", category);
  return NextResponse.redirect(url.toString());
}
