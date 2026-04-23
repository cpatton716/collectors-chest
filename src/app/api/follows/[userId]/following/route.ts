import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getProfileByClerkId } from "@/lib/db";
import { getFollowing } from "@/lib/followDb";
import { schemas, validateParams, validateQuery } from "@/lib/validation";

const paramsSchema = z.object({ userId: schemas.uuid });
const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

interface RouteParams {
  params: Promise<{ userId: string }>;
}

// GET - Get users that this user is following (paginated)
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const rawParams = await context.params;
    const paramsResult = validateParams(paramsSchema, rawParams);
    if (!paramsResult.success) return paramsResult.response;
    const { userId } = paramsResult.data;

    // Parse pagination params from query string
    const { searchParams } = new URL(request.url);
    const queryResult = validateQuery(querySchema, searchParams);
    if (!queryResult.success) return queryResult.response;
    const { limit, offset } = queryResult.data;

    // Get current user ID if authenticated (for isFollowing flag)
    let currentUserId: string | null = null;
    const { userId: clerkId } = await auth();
    if (clerkId) {
      const profile = await getProfileByClerkId(clerkId);
      if (profile) {
        currentUserId = profile.id;
      }
    }

    const result = await getFollowing(userId, currentUserId, limit, offset);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] Error fetching following:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
