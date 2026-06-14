import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getProfileByClerkId } from "@/lib/db";
import { isRedisAvailable, redis } from "@/lib/redis";
import { supabaseAdmin } from "@/lib/supabase";
import { triggerMatchFinding } from "@/lib/tradingDb";
import { schemas, validateBody, validateParams } from "@/lib/validation";

const forTradeParamsSchema = z.object({
  id: schemas.uuid,
});

const forTradeBodySchema = z.object({
  forTrade: z.boolean(),
});

// H-MK8: debounce the fire-and-forget match trigger. find_trade_matches is a
// relatively expensive SECURITY DEFINER scan (column-fix + functional indexes
// land in the closeout migration); marking several comics for trade in quick
// succession - or re-toggling the same one - would otherwise fire it on every
// request. We set a short-lived "recently triggered" key per (user, comic) and
// skip re-triggering while it's live. Redis-best-effort: if Redis is absent we
// fall through and trigger normally (no regression pre-Redis).
const MATCH_DEBOUNCE_PREFIX = "debounce:match:";
const MATCH_DEBOUNCE_TTL_SECONDS = 30;

/**
 * Returns true if a match-trigger for this (user, comic) should proceed, atomically
 * claiming the debounce window. Uses SET NX EX so concurrent toggles only let
 * one through. Fails OPEN (returns true) when Redis is unavailable so matching
 * still runs.
 */
async function shouldTriggerMatch(profileId: string, comicId: string): Promise<boolean> {
  if (!isRedisAvailable() || !redis) return true;
  try {
    const key = `${MATCH_DEBOUNCE_PREFIX}${profileId}:${comicId}`;
    // NX => only set if absent; returns "OK" when it claimed the window, null otherwise.
    const claimed = await redis.set(key, "1", { nx: true, ex: MATCH_DEBOUNCE_TTL_SECONDS });
    return claimed === "OK";
  } catch (err) {
    console.error("[for-trade] match debounce check failed:", err);
    return true; // fail open
  }
}

// PATCH - Toggle for_trade status
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawParams = await params;
    const paramsValidated = validateParams(forTradeParamsSchema, rawParams);
    if (!paramsValidated.success) return paramsValidated.response;
    const { id } = paramsValidated.data;

    const rawBody = await request.json().catch(() => null);
    const bodyValidated = validateBody(forTradeBodySchema, rawBody);
    if (!bodyValidated.success) return bodyValidated.response;
    const { forTrade } = bodyValidated.data;

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Verify comic belongs to user. supabaseAdmin bypasses RLS, so we MUST
    // assert ownership explicitly here (and on the update filter below).
    const { data: comic, error: fetchError } = await supabaseAdmin
      .from("comics")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !comic) {
      return NextResponse.json({ error: "Comic not found" }, { status: 404 });
    }

    if (comic.user_id !== profile.id) {
      return NextResponse.json({ error: "Not your comic" }, { status: 403 });
    }

    // Update for_trade status (double-scoped by owner as defense-in-depth).
    const { error: updateError } = await supabaseAdmin
      .from("comics")
      .update({ for_trade: forTrade })
      .eq("id", id)
      .eq("user_id", profile.id);

    if (updateError) throw updateError;

    // Trigger match finding if marking as for trade (debounced - H-MK8).
    if (forTrade) {
      // Fire and forget - don't block the response. Skip if a recent trigger for
      // this (user, comic) is still within the debounce window.
      void (async () => {
        try {
          if (await shouldTriggerMatch(profile.id, id)) {
            await triggerMatchFinding(profile.id, id);
          }
        } catch (err) {
          console.error("Error triggering match finding:", err);
        }
      })();
    }

    return NextResponse.json({ success: true, forTrade });
  } catch (error) {
    console.error("Error updating for_trade:", error);
    return NextResponse.json({ error: "Failed to update trade status" }, { status: 500 });
  }
}
