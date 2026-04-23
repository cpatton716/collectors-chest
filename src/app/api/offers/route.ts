import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { createOffer, getBuyerOffers } from "@/lib/auctionDb";
import { getProfileByClerkId } from "@/lib/db";
import { schemas, validateBody } from "@/lib/validation";

import { MIN_FIXED_PRICE } from "@/types/auction";

const createOfferBodySchema = z
  .object({
    listingId: schemas.uuid,
    amount: z.number().positive().max(1_000_000),
  })
  .strict();

// GET - Get buyer's offers
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const offers = await getBuyerOffers(profile.id);

    return NextResponse.json({ offers });
  } catch (error) {
    console.error("Error fetching offers:", error);
    return NextResponse.json({ error: "Failed to fetch offers" }, { status: 500 });
  }
}

// POST - Create a new offer
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Age verification gate
    if (!profile.age_confirmed_at) {
      return NextResponse.json(
        { error: "AGE_VERIFICATION_REQUIRED", message: "You must confirm you are 18+ to use the marketplace." },
        { status: 403 }
      );
    }

    const rawBody = await request.json().catch(() => null);
    const validatedBody = validateBody(createOfferBodySchema, rawBody);
    if (!validatedBody.success) return validatedBody.response;
    const { listingId, amount } = validatedBody.data;

    if (amount < MIN_FIXED_PRICE) {
      return NextResponse.json(
        { error: `Offer must be at least $${MIN_FIXED_PRICE}` },
        { status: 400 }
      );
    }

    const result = await createOffer(profile.id, { listingId, amount });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ offer: result.offer }, { status: 201 });
  } catch (error) {
    console.error("Error creating offer:", error);
    return NextResponse.json({ error: "Failed to create offer" }, { status: 500 });
  }
}
