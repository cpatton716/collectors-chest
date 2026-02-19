import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getProfileByClerkId } from "@/lib/db";
import { markMessagesAsRead } from "@/lib/messagingDb";
import { supabaseAdmin } from "@/lib/supabase";

// POST - Mark all messages in a conversation as read for the current user
export async function POST(
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

    const { conversationId } = await params;

    // Verify user is a participant
    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("participant_1_id, participant_2_id")
      .eq("id", conversationId)
      .single();

    if (!conv || (conv.participant_1_id !== profile.id && conv.participant_2_id !== profile.id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await markMessagesAsRead(conversationId, profile.id);

    // Fire-and-forget: broadcast unread-update so the current user's badge decreases
    try {
      const userChannel = supabaseAdmin.channel(`user:${profile.id}:messages`);
      await userChannel.send({
        type: "broadcast",
        event: "unread-update",
        payload: {},
      });
      supabaseAdmin.removeChannel(userChannel);
    } catch {
      // Non-critical: don't fail the request if broadcast fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 });
  }
}
