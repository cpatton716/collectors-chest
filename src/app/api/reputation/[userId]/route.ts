import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getUserCreatorProfile, getUserFeedback } from "@/lib/creatorCreditsDb";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

// GET - Get user's full reputation
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const includeFeedback = searchParams.get("includeFeedback") === "true";
    const feedbackLimit = parseInt(searchParams.get("feedbackLimit") || "5");

    const reputation = await getUserCreatorProfile(userId);

    let recentFeedback = undefined;
    if (includeFeedback) {
      recentFeedback = await getUserFeedback(userId, feedbackLimit);
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
