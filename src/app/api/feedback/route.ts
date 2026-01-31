import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getProfileByClerkId } from "@/lib/db";
import { getUserFeedback, submitFeedback } from "@/lib/reputationDb";
import { SubmitFeedbackInput } from "@/types/reputation";

// GET - Get feedback for a user
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const targetUserId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!targetUserId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

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

    const body = await request.json();
    const input: SubmitFeedbackInput = {
      transactionType: body.transactionType,
      transactionId: body.transactionId,
      revieweeId: body.revieweeId,
      ratingType: body.ratingType,
      comment: body.comment,
    };

    // Validate required fields
    if (!input.transactionType || !input.transactionId || !input.revieweeId || !input.ratingType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate rating type
    if (!["positive", "negative"].includes(input.ratingType)) {
      return NextResponse.json({ error: "Invalid rating type" }, { status: 400 });
    }

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
