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

import { supabaseAdmin } from "@/lib/supabase";
import {
  CATEGORY_COLUMN,
  verifyUnsubscribeToken,
  type UnsubscribeCategory,
} from "@/lib/unsubscribeToken";
import { validateQuery } from "@/lib/validation";

// Re-export the shared token helpers so existing importers (and tests) that
// referenced them via this route keep working. The single source of truth now
// lives in `@/lib/unsubscribeToken`. (Names also imported locally above —
// `CATEGORY_COLUMN`, `verifyUnsubscribeToken`, `UnsubscribeCategory` — are
// re-exported below referencing those bindings to avoid a duplicate import.)
export {
  UNSUBSCRIBE_PURPOSE,
  UNSUBSCRIBE_SECRET_NAME,
  UNSUBSCRIBE_TOKEN_TTL_MS,
  buildUnsubscribeUrl,
  mintUnsubscribeToken,
  type UnsubscribeTokenPayload,
} from "@/lib/unsubscribeToken";
export { CATEGORY_COLUMN, verifyUnsubscribeToken, type UnsubscribeCategory };

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
