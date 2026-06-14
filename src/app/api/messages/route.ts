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
    // Log full detail server-side; return a generic message to the client so
    // we never leak stack traces, internal field names, or raw error objects.
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

// User-facing validation errors thrown by sendMessage. These are safe to relay
// to the client (400); anything else is treated as an unexpected server error.
const SEND_MESSAGE_USER_ERRORS = new Set<string>([
  "Message content or image is required",
  "Message is too long (max 2000 characters)",
  "Cannot send message to yourself",
  "You cannot message this user",
]);

// POST - Send a new message
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const suspensionStatus = await isUserSuspended(userId);
    if (suspensionStatus.suspended) {
      return NextResponse.json({ error: "Your account has been suspended." }, { status: 403 });
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const validated = validateBody(sendMessageSchema, body);
    if (!validated.success) return validated.response;
    const { recipientId, content, listingId, imageUrls, embeddedListingId } = validated.data;

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
    // Log full detail server-side only.
    console.error("Error sending message:", error);

    // Relay known validation errors (including content-filter block reasons) to
    // the client; never expose stack traces or internal error shapes.
    if (error instanceof Error) {
      if (
        SEND_MESSAGE_USER_ERRORS.has(error.message) ||
        error.message.endsWith("are not allowed in messages") ||
        error.message === "Message not allowed"
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
