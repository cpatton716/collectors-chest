import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getProfileByClerkId } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { triggerMatchFinding } from "@/lib/tradingDb";
import { schemas, validateBody, validateParams } from "@/lib/validation";

const forTradeParamsSchema = z.object({
  id: schemas.uuid,
});

const forTradeBodySchema = z.object({
  forTrade: z.boolean(),
});

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

    // Verify comic belongs to user
    const { data: comic, error: fetchError } = await supabase
      .from("comics")
      .select("id, user_id")
      .eq("id", id)
      .single();

    if (fetchError || !comic) {
      return NextResponse.json({ error: "Comic not found" }, { status: 404 });
    }

    if (comic.user_id !== profile.id) {
      return NextResponse.json({ error: "Not your comic" }, { status: 403 });
    }

    // Update for_trade status
    const { error: updateError } = await supabase
      .from("comics")
      .update({ for_trade: forTrade })
      .eq("id", id);

    if (updateError) throw updateError;

    // Trigger match finding if marking as for trade
    if (forTrade) {
      // Fire and forget - don't block the response
      triggerMatchFinding(profile.id, id).catch((err) => {
        console.error("Error triggering match finding:", err);
      });
    }

    return NextResponse.json({ success: true, forTrade });
  } catch (error) {
    console.error("Error updating for_trade:", error);
    return NextResponse.json({ error: "Failed to update trade status" }, { status: 500 });
  }
}
