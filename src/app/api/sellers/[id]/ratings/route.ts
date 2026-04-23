import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getSellerProfile, getSellerRatings, submitSellerRating } from "@/lib/auctionDb";
import { getProfileByClerkId } from "@/lib/db";
import { schemas, validateBody, validateParams, validateQuery } from "@/lib/validation";

import { RatingType } from "@/types/auction";

const paramsSchema = z.object({ id: schemas.uuid });
const ratingsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});
const submitRatingSchema = z.object({
  auctionId: schemas.uuid,
  ratingType: z.enum(["positive", "negative"]),
  comment: z.string().max(500).optional(),
});

// GET - Get seller ratings
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rawParams = await params;
    const paramsResult = validateParams(paramsSchema, rawParams);
    if (!paramsResult.success) return paramsResult.response;
    const { id: sellerId } = paramsResult.data;

    const queryResult = validateQuery(ratingsQuerySchema, request.nextUrl.searchParams);
    if (!queryResult.success) return queryResult.response;
    const { limit } = queryResult.data;

    const [profile, ratings] = await Promise.all([
      getSellerProfile(sellerId),
      getSellerRatings(sellerId, limit),
    ]);

    if (!profile) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    return NextResponse.json({
      seller: profile,
      ratings,
    });
  } catch (error) {
    console.error("Error fetching seller ratings:", error);
    return NextResponse.json({ error: "Failed to fetch seller ratings" }, { status: 500 });
  }
}

// POST - Submit seller rating
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

    const rawParams = await params;
    const paramsResult = validateParams(paramsSchema, rawParams);
    if (!paramsResult.success) return paramsResult.response;
    const { id: sellerId } = paramsResult.data;

    const body = await request.json().catch(() => null);
    const bodyResult = validateBody(submitRatingSchema, body);
    if (!bodyResult.success) return bodyResult.response;
    const { auctionId, ratingType, comment } = bodyResult.data;

    const result = await submitSellerRating(profile.id, {
      sellerId,
      auctionId,
      ratingType: ratingType as RatingType,
      comment,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error submitting rating:", error);
    return NextResponse.json({ error: "Failed to submit rating" }, { status: 500 });
  }
}
