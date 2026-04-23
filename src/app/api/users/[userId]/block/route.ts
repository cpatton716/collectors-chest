import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getProfileByClerkId } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import { schemas, validateParams } from "@/lib/validation";

const paramsSchema = z.object({ userId: schemas.uuid });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
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
    const { userId: blockedId } = paramsResult.data;

    if (profile.id === blockedId) {
      return NextResponse.json({ error: "Cannot block yourself" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("user_blocks").insert({
      blocker_id: profile.id,
      blocked_id: blockedId,
    });

    if (error && error.code !== "23505") {
      // Ignore duplicate key error
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Block error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
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
    const { userId: blockedId } = paramsResult.data;

    await supabaseAdmin
      .from("user_blocks")
      .delete()
      .eq("blocker_id", profile.id)
      .eq("blocked_id", blockedId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unblock error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
