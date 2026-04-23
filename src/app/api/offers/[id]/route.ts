import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { respondToCounterOffer, respondToOffer } from "@/lib/auctionDb";
import { getProfileByClerkId } from "@/lib/db";
import { schemas, validateBody, validateParams } from "@/lib/validation";

import { MIN_FIXED_PRICE } from "@/types/auction";

const paramsSchema = z.object({ id: schemas.uuid });

const sellerRespondBodySchema = z
  .object({
    action: z.enum(["accept", "reject", "counter"]),
    counterAmount: z.number().positive().max(1_000_000).optional(),
  })
  .strict();

const buyerRespondBodySchema = z
  .object({
    action: z.enum(["accept", "reject"]),
  })
  .strict();

// PATCH - Seller responds to an offer (accept, reject, or counter)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const { id: offerId } = validatedParams.data;

    const rawBody = await request.json().catch(() => null);
    const validatedBody = validateBody(sellerRespondBodySchema, rawBody);
    if (!validatedBody.success) return validatedBody.response;
    const { action, counterAmount } = validatedBody.data;

    // Validate counter amount if countering
    if (action === "counter") {
      if (typeof counterAmount !== "number" || counterAmount < MIN_FIXED_PRICE) {
        return NextResponse.json(
          { error: `Counter amount must be at least $${MIN_FIXED_PRICE}` },
          { status: 400 }
        );
      }
    }

    // Seller responds to offer
    const result = await respondToOffer(profile.id, {
      offerId,
      action,
      counterAmount: action === "counter" ? counterAmount : undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ offer: result.offer });
  } catch (error) {
    console.error("Error responding to offer:", error);
    return NextResponse.json({ error: "Failed to respond to offer" }, { status: 500 });
  }
}

// POST - Buyer responds to a counter-offer (accept or reject only)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const { id: offerId } = validatedParams.data;

    const rawBody = await request.json().catch(() => null);
    const validatedBody = validateBody(buyerRespondBodySchema, rawBody);
    if (!validatedBody.success) return validatedBody.response;
    const { action } = validatedBody.data;

    const result = await respondToCounterOffer(profile.id, offerId, action);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error responding to counter-offer:", error);
    return NextResponse.json({ error: "Failed to respond to counter-offer" }, { status: 500 });
  }
}
