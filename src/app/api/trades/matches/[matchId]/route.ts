import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getProfileByClerkId } from "@/lib/db";
import { dismissMatch, markMatchViewed } from "@/lib/tradingDb";
import { schemas, validateBody, validateParams } from "@/lib/validation";

const paramsSchema = z.object({ matchId: schemas.uuid });

const updateMatchBodySchema = z
  .object({
    action: z.enum(["view", "dismiss"]),
  })
  .strict();

// PATCH - Update match (mark as viewed or dismissed)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const validatedParams = validateParams(paramsSchema, await params);
    if (!validatedParams.success) return validatedParams.response;
    const { matchId } = validatedParams.data;
    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const rawBody = await request.json().catch(() => null);
    const validatedBody = validateBody(updateMatchBodySchema, rawBody);
    if (!validatedBody.success) return validatedBody.response;
    const { action } = validatedBody.data;

    if (action === "view") {
      await markMatchViewed(matchId);
    } else {
      // action === "dismiss" (enum guarantees this)
      await dismissMatch(matchId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating match:", error);
    return NextResponse.json({ error: "Failed to update match" }, { status: 500 });
  }
}
