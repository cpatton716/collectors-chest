import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getProfileByClerkId } from "@/lib/db";
import { getUserCreatorProfile, getUserFeedback } from "@/lib/creatorCreditsDb";
import { validateQuery } from "@/lib/validation";

const reputationQuerySchema = z.object({
  includeFeedback: z.enum(["true", "false"]).optional(),
  feedbackLimit: z.coerce.number().int().min(1).max(100).optional(),
});

// GET - Get current user's full reputation
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(clerkId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const validatedQuery = validateQuery(reputationQuerySchema, request.nextUrl.searchParams);
    if (!validatedQuery.success) return validatedQuery.response;
    const includeFeedback = validatedQuery.data.includeFeedback === "true";
    const feedbackLimit = validatedQuery.data.feedbackLimit ?? 5;

    const reputation = await getUserCreatorProfile(profile.id);

    let recentFeedback = undefined;
    if (includeFeedback) {
      recentFeedback = await getUserFeedback(profile.id, feedbackLimit);
    }

    return NextResponse.json({
      reputation,
      recentFeedback,
    });
  } catch (error) {
    console.error("[API] Error getting creator profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
