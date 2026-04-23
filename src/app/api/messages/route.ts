import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { isUserSuspended } from "@/lib/adminAuth";
import { getProfileByClerkId } from "@/lib/db";
import { broadcastNewMessage, getUnreadMessageCount, getUserConversations, sendMessage } from "@/lib/messagingDb";
import { schemas, validateBody } from "@/lib/validation";

const sendMessageSchema = z
  .object({
    recipientId: schemas.uuid,
    content: z.string().max(2000).optional(),
    listingId: schemas.uuid.optional(),
    imageUrls: z.array(z.string().url()).max(10).optional(),
    embeddedListingId: schemas.uuid.optional(),
  })
  .refine(
    (v) => (v.content && v.content.trim().length > 0) || (v.imageUrls && v.imageUrls.length > 0),
    { message: "Message content or image is required", path: ["content"] }
  );

// GET - List user's conversations
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const conversations = await getUserConversations(profile.id);
    const totalUnread = await getUnreadMessageCount(profile.id);

    return NextResponse.json({
      conversations,
      totalUnread,
    });
  } catch (error: unknown) {
    console.error("Error fetching conversations:", error);
    let errorMessage = "Failed to fetch conversations";
    let errorDetails: unknown = null;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack;
    } else if (typeof error === "object" && error !== null) {
      errorDetails = error;
      if ("message" in error) errorMessage = String((error as {message: unknown}).message);
    }

    return NextResponse.json({
      error: errorMessage,
      details: errorDetails
    }, { status: 500 });
  }
}

// POST - Send a new message
export async function POST(request: NextRequest) {
  let debugStep = "start";
  try {
    debugStep = "auth";
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    debugStep = "suspension-check";
    const suspensionStatus = await isUserSuspended(userId);
    if (suspensionStatus.suspended) {
      return NextResponse.json({ error: "Your account has been suspended." }, { status: 403 });
    }

    debugStep = "get-profile";
    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    debugStep = "parse-body";
    const body = await request.json().catch(() => null);
    const validated = validateBody(sendMessageSchema, body);
    if (!validated.success) return validated.response;
    const { recipientId, content, listingId, imageUrls, embeddedListingId } = validated.data;

    debugStep = "send-message";
    const message = await sendMessage(profile.id, {
      recipientId,
      content: content ?? "",
      listingId,
      imageUrls,
      embeddedListingId,
    });

    // Fire-and-forget: broadcast to recipient for real-time updates
    broadcastNewMessage(message.conversationId, recipientId, message).catch(() => {});

    return NextResponse.json({ message }, { status: 201 });
  } catch (error: unknown) {
    // Handle different error types
    let errorMessage = "Unknown error";
    let errorDetails: unknown = null;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack;
    } else if (typeof error === "object" && error !== null) {
      errorDetails = error;
      if ("message" in error) errorMessage = String((error as {message: unknown}).message);
      else if ("error" in error) errorMessage = String((error as {error: unknown}).error);
      else errorMessage = JSON.stringify(error);
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    return NextResponse.json({
      error: errorMessage,
      debugStep,
      details: errorDetails,
      errorType: typeof error,
      errorConstructor: error?.constructor?.name
    }, { status: 500 });
  }
}
