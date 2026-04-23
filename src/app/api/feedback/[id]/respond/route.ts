import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getProfileByClerkId } from "@/lib/db";
import { addSellerResponse } from "@/lib/creatorCreditsDb";
import { schemas, validateBody, validateParams } from "@/lib/validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const paramsSchema = z.object({ id: schemas.uuid });

const sellerResponseBodySchema = z
  .object({
    response: schemas.trimmedString(1, 2000),
  })
  .strict();

// POST - Add seller response to negative feedback
export async function POST(request: NextRequest, context: RouteContext) {
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
    const validatedBody = validateBody(sellerResponseBodySchema, rawBody);
    if (!validatedBody.success) return validatedBody.response;

    const result = await addSellerResponse(profile.id, feedbackId, {
      response: validatedBody.data.response,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error adding seller response:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
