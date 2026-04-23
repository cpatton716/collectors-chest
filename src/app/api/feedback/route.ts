import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getProfileByClerkId } from "@/lib/db";
import { getUserFeedback, submitFeedback } from "@/lib/creatorCreditsDb";
import { schemas, validateBody, validateQuery } from "@/lib/validation";

const feedbackQuerySchema = z.object({
  userId: schemas.uuid,
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const submitFeedbackBodySchema = z
  .object({
    transactionType: z.enum(["sale", "auction", "trade"]),
    transactionId: schemas.uuid,
    revieweeId: schemas.uuid,
    ratingType: z.enum(["positive", "negative"]),
    comment: z.string().max(2000).optional(),
  })
  .strict();

// GET - Get feedback for a user
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const validatedQuery = validateQuery(feedbackQuerySchema, request.nextUrl.searchParams);
    if (!validatedQuery.success) return validatedQuery.response;
    const { userId: targetUserId, limit = 20, offset = 0 } = validatedQuery.data;

    const result = await getUserFeedback(targetUserId, limit, offset);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ feedback: result.feedback, total: result.total });
  } catch (error) {
    console.error("[API] Error getting feedback:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Submit feedback for a transaction
export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(clerkId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const rawBody = await request.json().catch(() => null);
    const validatedBody = validateBody(submitFeedbackBodySchema, rawBody);
    if (!validatedBody.success) return validatedBody.response;
    const input = validatedBody.data;

    // Prevent self-feedback
    if (input.revieweeId === profile.id) {
      return NextResponse.json({ error: "Cannot leave feedback for yourself" }, { status: 400 });
    }

    const result = await submitFeedback(profile.id, input);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, feedback: result.feedback });
  } catch (error) {
    console.error("[API] Error submitting feedback:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
