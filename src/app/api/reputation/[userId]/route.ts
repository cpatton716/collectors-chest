import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getUserCreatorProfile, getUserFeedback } from "@/lib/creatorCreditsDb";
import { schemas, validateParams, validateQuery } from "@/lib/validation";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

const paramsSchema = z.object({ userId: schemas.uuid });

const reputationQuerySchema = z.object({
  includeFeedback: z.enum(["true", "false"]).optional(),
  feedbackLimit: z.coerce.number().int().min(1).max(100).optional(),
});

// GET - Get user's full reputation
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const validatedParams = validateParams(paramsSchema, await context.params);
    if (!validatedParams.success) return validatedParams.response;
    const { userId } = validatedParams.data;

    const validatedQuery = validateQuery(reputationQuerySchema, request.nextUrl.searchParams);
    if (!validatedQuery.success) return validatedQuery.response;
    const includeFeedback = validatedQuery.data.includeFeedback === "true";
    const feedbackLimit = validatedQuery.data.feedbackLimit ?? 5;

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
