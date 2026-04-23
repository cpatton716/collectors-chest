import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getProfileByClerkId } from "@/lib/db";
import { followUser, unfollowUser, checkFollowStatus, getFollowCounts } from "@/lib/followDb";
import { schemas, validateParams } from "@/lib/validation";

const paramsSchema = z.object({ userId: schemas.uuid });

interface RouteParams {
  params: Promise<{ userId: string }>;
}

// POST - Follow a user
export async function POST(_request: NextRequest, context: RouteParams) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(clerkId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const rawParams = await context.params;
    const paramsResult = validateParams(paramsSchema, rawParams);
    if (!paramsResult.success) return paramsResult.response;
    const { userId } = paramsResult.data;

    // Prevent self-follow
    if (profile.id === userId) {
      return NextResponse.json({ error: "You cannot follow yourself" }, { status: 400 });
    }

    const result = await followUser(profile.id, userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error following user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Unfollow a user
export async function DELETE(_request: NextRequest, context: RouteParams) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(clerkId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const rawParams = await context.params;
    const paramsResult = validateParams(paramsSchema, rawParams);
    if (!paramsResult.success) return paramsResult.response;
    const { userId } = paramsResult.data;

    const result = await unfollowUser(profile.id, userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error unfollowing user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET - Check follow status and get counts
export async function GET(_request: NextRequest, context: RouteParams) {
  try {
    const { userId: clerkId } = await auth();
    const rawParams = await context.params;
    const paramsResult = validateParams(paramsSchema, rawParams);
    if (!paramsResult.success) return paramsResult.response;
    const { userId } = paramsResult.data;

    // Fetch counts in parallel (always available, even for unauthenticated users)
    const counts = await getFollowCounts(userId);

    // If not authenticated, return not following but include counts
    if (!clerkId) {
      return NextResponse.json({
        isFollowing: false,
        followedAt: null,
        ...counts,
      });
    }

    const profile = await getProfileByClerkId(clerkId);
    if (!profile) {
      return NextResponse.json({
        isFollowing: false,
        followedAt: null,
        ...counts,
      });
    }

    // Check if user is viewing their own profile
    if (profile.id === userId) {
      return NextResponse.json({
        isOwnProfile: true,
        isFollowing: false,
        followedAt: null,
        ...counts,
      });
    }

    const result = await checkFollowStatus(profile.id, userId);

    return NextResponse.json({
      ...result,
      ...counts,
    });
  } catch (error) {
    console.error("[API] Error checking follow status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
