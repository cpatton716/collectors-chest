import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { createSecondChanceOffer } from "@/lib/auctionDb";
import { getProfileByClerkId } from "@/lib/db";
import { schemas, validateParams } from "@/lib/validation";

const paramsSchema = z.object({ id: schemas.uuid });

/**
 * POST /api/auctions/:id/second-chance
 *
 * Seller-only. Creates a Second Chance Offer for the runner-up bidder on a
 * cancelled (unpaid) auction. Returns the created or existing offer.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    const { id: auctionId } = validatedParams.data;

    const result = await createSecondChanceOffer(auctionId, profile.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ offer: result.offer });
  } catch (error) {
    console.error("Error creating second-chance offer:", error);
    return NextResponse.json(
      { error: "Failed to create offer" },
      { status: 500 }
    );
  }
}
