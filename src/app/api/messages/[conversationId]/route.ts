import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getProfileByClerkId } from "@/lib/db";
import { getConversationMessages } from "@/lib/messagingDb";
import { schemas, validateParams } from "@/lib/validation";

const paramsSchema = z.object({ conversationId: schemas.uuid });

// GET - Get messages for a specific conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const rawParams = await params;
    const paramsResult = validateParams(paramsSchema, rawParams);
    if (!paramsResult.success) return paramsResult.response;
    const { conversationId } = paramsResult.data;

    const result = await getConversationMessages(conversationId, profile.id);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching messages:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (errorMessage === "Access denied") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (errorMessage === "Conversation not found") {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    let errorDetails: unknown = null;
    if (typeof error === "object" && error !== null) {
      errorDetails = error;
    }
    return NextResponse.json({
      error: "Failed to fetch messages",
      message: errorMessage,
      details: errorDetails
    }, { status: 500 });
  }
}
