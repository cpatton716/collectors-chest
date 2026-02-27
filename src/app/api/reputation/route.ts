import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getProfileByClerkId } from "@/lib/db";
import { getUserCreatorProfile, getUserFeedback } from "@/lib/creatorCreditsDb";

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

    const searchParams = request.nextUrl.searchParams;
    const includeFeedback = searchParams.get("includeFeedback") === "true";
    const feedbackLimit = parseInt(searchParams.get("feedbackLimit") || "5");

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
