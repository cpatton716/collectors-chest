import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { respondToSecondChanceOffer } from "@/lib/auctionDb";
import { getProfileByClerkId } from "@/lib/db";
import { schemas, validateBody, validateParams } from "@/lib/validation";

const paramsSchema = z.object({ id: schemas.uuid });

const respondBodySchema = z
  .object({
    action: z.enum(["accept", "decline"]),
  })
  .strict();

/**
 * POST /api/second-chance-offers/:id
 * PATCH /api/second-chance-offers/:id
 *
 * Runner-up responds to a second-chance offer. Body: { action }.
 * POST and PATCH are both accepted so callers aren't locked to one verb.
 */
async function handle(
  request: NextRequest,
  params: Promise<{ id: string }>
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getProfileByClerkId(userId);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const validatedParams = validateParams(paramsSchema, await params);
  if (!validatedParams.success) return validatedParams.response;
  const { id: offerId } = validatedParams.data;

  const rawBody = await request.json().catch(() => null);
  const validatedBody = validateBody(respondBodySchema, rawBody);
  if (!validatedBody.success) return validatedBody.response;
  const { action } = validatedBody.data;

  const result = await respondToSecondChanceOffer(offerId, profile.id, action);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ offer: result.offer });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    return await handle(request, params);
  } catch (error) {
    console.error("Error responding to second-chance offer:", error);
    return NextResponse.json(
      { error: "Failed to respond to offer" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    return await handle(request, params);
  } catch (error) {
    console.error("Error responding to second-chance offer:", error);
    return NextResponse.json(
      { error: "Failed to respond to offer" },
      { status: 500 }
    );
  }
}
