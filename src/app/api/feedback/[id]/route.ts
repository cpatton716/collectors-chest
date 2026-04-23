import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getProfileByClerkId } from "@/lib/db";
import { updateFeedback } from "@/lib/creatorCreditsDb";
import { schemas, validateBody, validateParams } from "@/lib/validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const paramsSchema = z.object({ id: schemas.uuid });

const updateFeedbackBodySchema = z
  .object({
    ratingType: z.enum(["positive", "negative"]).optional(),
    comment: z.string().max(2000).optional(),
  })
  .strict();

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

    const validatedParams = validateParams(paramsSchema, await context.params);
    if (!validatedParams.success) return validatedParams.response;
    const { id: feedbackId } = validatedParams.data;

    const rawBody = await request.json().catch(() => null);
    const validatedBody = validateBody(updateFeedbackBodySchema, rawBody);
    if (!validatedBody.success) return validatedBody.response;
    const { ratingType, comment } = validatedBody.data;

    const result = await updateFeedback(profile.id, feedbackId, {
      ratingType,
      comment,
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
