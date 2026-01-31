import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getProfileByClerkId } from "@/lib/db";
import { getFollowers } from "@/lib/followDb";

interface RouteParams {
  params: Promise<{ userId: string }>;
}

// GET - Get user's followers (paginated)
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const { userId } = await context.params;

    // Parse pagination params from query string
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Get current user ID if authenticated (for isFollowing flag)
    let currentUserId: string | null = null;
    const { userId: clerkId } = await auth();
    if (clerkId) {
      const profile = await getProfileByClerkId(clerkId);
      if (profile) {
        currentUserId = profile.id;
      }
    }

    const result = await getFollowers(userId, currentUserId, limit, offset);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] Error fetching followers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
