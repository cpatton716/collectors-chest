import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { isUserSuspended } from "@/lib/adminAuth";
import { getProfileByClerkId } from "@/lib/db";
import { getUnreadMessageCount, getUserConversations, sendMessage } from "@/lib/messagingDb";

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
    const body = await request.json();
    const { recipientId, content, listingId, imageUrls, embeddedListingId } = body;

    if (!recipientId) {
      return NextResponse.json({ error: "Recipient ID is required" }, { status: 400 });
    }

    if ((!content || content.trim().length === 0) && (!imageUrls || imageUrls.length === 0)) {
      return NextResponse.json({ error: "Message content or image is required" }, { status: 400 });
    }

    debugStep = "send-message";
    const message = await sendMessage(profile.id, {
      recipientId,
      content,
      listingId,
      imageUrls,
      embeddedListingId,
    });

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
