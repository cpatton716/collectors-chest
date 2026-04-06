import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("msg_push_enabled, msg_email_enabled")
      .eq("clerk_user_id", clerkId)
      .single();

    if (error) {
      console.error("Fetch notification settings error:", error);
      return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
    }

    return NextResponse.json({
      msgPushEnabled: data.msg_push_enabled ?? true,
      msgEmailEnabled: data.msg_email_enabled ?? true,
    });
  } catch (error) {
    console.error("Notification settings GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const updates: Record<string, boolean> = {};

    if (typeof body.msgPushEnabled === "boolean") {
      updates.msg_push_enabled = body.msgPushEnabled;
    }
    if (typeof body.msgEmailEnabled === "boolean") {
      updates.msg_email_enabled = body.msgEmailEnabled;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("profiles").update(updates).eq("clerk_user_id", clerkId);

    if (error) {
      console.error("Update notification settings error:", error);
      return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notification settings PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
