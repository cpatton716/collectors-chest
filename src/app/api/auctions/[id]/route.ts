import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { cancelAuction, getAuction, updateAuction } from "@/lib/auctionDb";
import { getProfileByClerkId } from "@/lib/db";
import { schemas, validateBody, validateParams, validateQuery } from "@/lib/validation";

const idParamsSchema = z.object({ id: schemas.uuid });

const updateAuctionBodySchema = z
  .object({
    buyItNowPrice: z.number().positive().max(1_000_000).nullable().optional(),
    description: z.string().max(5000).optional(),
    detailImages: z.array(z.string().max(2048)).max(4).optional(),
  })
  .strict();

const cancelAuctionQuerySchema = z.object({
  reason: z.enum(["changed_mind", "sold_elsewhere", "price_too_low", "other"]).optional(),
});

// GET - Get single auction
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const validatedParams = validateParams(idParamsSchema, await params);
    if (!validatedParams.success) return validatedParams.response;
    const { id } = validatedParams.data;

    // Optional: get user ID for watchlist/bid status
    let userId: string | undefined;
    try {
      const authResult = await auth();
      if (authResult.userId) {
        const profile = await getProfileByClerkId(authResult.userId);
        userId = profile?.id;
      }
    } catch {
      // Not logged in, continue without user context
    }

    const auction = await getAuction(id, userId);

    if (!auction) {
      return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    }

    return NextResponse.json({ auction });
  } catch (error) {
    console.error("Error fetching auction:", error);
    return NextResponse.json({ error: "Failed to fetch auction" }, { status: 500 });
  }
}

// PATCH - Update auction (seller only)
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

    const validatedParams = validateParams(idParamsSchema, await params);
    if (!validatedParams.success) return validatedParams.response;
    const { id } = validatedParams.data;

    const rawBody = await request.json().catch(() => null);
    const validatedBody = validateBody(updateAuctionBodySchema, rawBody);
    if (!validatedBody.success) return validatedBody.response;
    const { buyItNowPrice, description, detailImages } = validatedBody.data;

    await updateAuction(id, profile.id, {
      buyItNowPrice,
      description,
      detailImages,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating auction:", error);
    return NextResponse.json({ error: "Failed to update auction" }, { status: 500 });
  }
}

// DELETE - Cancel auction (seller only, no bids)
export async function DELETE(
  request: NextRequest,
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

    const validatedParams = validateParams(idParamsSchema, await params);
    if (!validatedParams.success) return validatedParams.response;
    const { id } = validatedParams.data;

    // Get reason from query params (optional)
    const { searchParams } = new URL(request.url);
    const validatedQuery = validateQuery(cancelAuctionQuerySchema, searchParams);
    if (!validatedQuery.success) return validatedQuery.response;
    const reason = validatedQuery.data.reason;

    const result = await cancelAuction(id, profile.id, reason || undefined);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling auction:", error);
    return NextResponse.json({ error: "Failed to cancel auction" }, { status: 500 });
  }
}
