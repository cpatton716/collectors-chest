import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { getAdminProfile, getProfileById, logAdminAction } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { schemas, validateBody } from "@/lib/validation";

const resetTrialBodySchema = z
  .object({
    targetUserId: schemas.uuid,
  })
  .strict();

/**
 * POST - Reset trial status (ADMIN ONLY)
 *
 * This allows admins to reset a user's trial for testing or support purposes.
 * Clears trial_started_at and trial_ends_at, resetting trial availability.
 *
 * Required body: { targetUserId: string } - the profile ID of the user to reset
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const adminProfile = await getAdminProfile();
    if (!adminProfile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const rawBody = await request.json().catch(() => null);
    const validatedBody = validateBody(resetTrialBodySchema, rawBody);
    if (!validatedBody.success) return validatedBody.response;
    const { targetUserId } = validatedBody.data;

    // Verify target user exists
    const targetProfile = await getProfileById(targetUserId);
    if (!targetProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Reset trial fields
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        trial_started_at: null,
        trial_ends_at: null,
        subscription_status: "active",
        // Keep subscription_tier as-is (stays "free" unless they paid)
      })
      .eq("id", targetUserId);

    if (error) {
      console.error("Error resetting trial:", error);
      return NextResponse.json({ error: "Failed to reset trial" }, { status: 500 });
    }

    // Log admin action
    await logAdminAction(adminProfile.id, "reset_trial", targetUserId, {
      email: targetProfile.email,
    });

    return NextResponse.json({
      success: true,
      message: `Trial has been reset for user ${targetProfile.email || targetUserId}.`,
    });
  } catch (error) {
    console.error("Error resetting trial:", error);
    return NextResponse.json({ error: "Failed to reset trial" }, { status: 500 });
  }
}
