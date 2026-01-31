import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getProfileByClerkId } from "@/lib/db";
import { updateFeedback } from "@/lib/reputationDb";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH - Update feedback (within 7-day edit window)
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(clerkId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { id: feedbackId } = await context.params;
    const body = await request.json();

    const result = await updateFeedback(profile.id, feedbackId, {
      ratingType: body.ratingType,
      comment: body.comment,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, feedback: result.feedback });
  } catch (error) {
    console.error("[API] Error updating feedback:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
