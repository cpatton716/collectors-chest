import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getProfileByClerkId } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import { schemas, validateBody, validateParams } from "@/lib/validation";

const paramsSchema = z.object({ messageId: schemas.uuid });
const reportSchema = z.object({
  reason: z.enum(["spam", "scam", "harassment", "inappropriate", "other"]),
  details: z.string().max(2000).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(clerkId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const rawParams = await params;
    const paramsResult = validateParams(paramsSchema, rawParams);
    if (!paramsResult.success) return paramsResult.response;
    const { messageId } = paramsResult.data;

    const body = await request.json().catch(() => null);
    const bodyResult = validateBody(reportSchema, body);
    if (!bodyResult.success) return bodyResult.response;
    const { reason, details } = bodyResult.data;

    // Verify the message exists
    const { data: message, error: msgError } = await supabaseAdmin
      .from("messages")
      .select("id, conversation_id")
      .eq("id", messageId)
      .single();

    if (msgError || !message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Get the conversation and verify reporter is a participant
    const { data: conv, error: convError } = await supabaseAdmin
      .from("conversations")
      .select("participant_1_id, participant_2_id")
      .eq("id", message.conversation_id)
      .single();

    if (convError || !conv) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Check if user is a participant in the conversation
    if (conv.participant_1_id !== profile.id && conv.participant_2_id !== profile.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Create the report
    const { error } = await supabaseAdmin.from("message_reports").insert({
      message_id: messageId,
      reporter_id: profile.id,
      reason,
      details: details || null,
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "You have already reported this message" },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Report error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
