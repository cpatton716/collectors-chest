import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getProfileByClerkId } from "@/lib/db";
import { addSellerResponse } from "@/lib/creatorCreditsDb";

interface RouteContext {
  params: Promise<{ id: string }>;
}

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

    const { id: feedbackId } = await context.params;
    const body = await request.json();

    if (!body.response || typeof body.response !== "string") {
      return NextResponse.json({ error: "Response text required" }, { status: 400 });
    }

    const result = await addSellerResponse(profile.id, feedbackId, {
      response: body.response,
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
