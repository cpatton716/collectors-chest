import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getAdminProfile,
  getProfileById,
  logAdminAction,
  setUserSuspension,
} from "@/lib/adminAuth";
import { invalidateProfileCache } from "@/lib/db";
import { schemas, validateBody, validateParams } from "@/lib/validation";

const paramsSchema = z.object({ id: schemas.uuid });

const suspendSchema = z.object({
  suspend: z.boolean().optional(),
  reason: z.string().max(500).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check admin access
    const adminProfile = await getAdminProfile();
    if (!adminProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rawParams = await params;
    const paramsResult = validateParams(paramsSchema, rawParams);
    if (!paramsResult.success) return paramsResult.response;
    const { id } = paramsResult.data;

    // Parse optional body. Missing body defaults to {suspend: true}.
    let suspend = true;
    let reason: string | undefined;
    const rawBody = await request.json().catch(() => null);
    if (rawBody !== null) {
      const validated = validateBody(suspendSchema, rawBody);
      if (!validated.success) return validated.response;
      if (validated.data.suspend !== undefined) suspend = validated.data.suspend;
      reason = validated.data.reason;
    }

    // Verify user exists
    const profile = await getProfileById(id);
    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent self-suspension
    if (id === adminProfile.id) {
      return NextResponse.json({ error: "Cannot suspend your own account" }, { status: 400 });
    }

    // Update suspension status
    await setUserSuspension(id, suspend, reason);

    // Invalidate profile cache so suspension takes effect immediately
    await invalidateProfileCache(profile.clerk_user_id);

    // Log the action
    await logAdminAction(
      adminProfile.id,
      suspend ? "suspend" : "unsuspend",
      id,
      suspend ? { reason } : { previous_reason: profile.suspended_reason }
    );

    return NextResponse.json({
      success: true,
      message: suspend ? "User suspended" : "User unsuspended",
      is_suspended: suspend,
    });
  } catch (error) {
    console.error("Error updating suspension:", error);
    return NextResponse.json({ error: "Failed to update suspension status" }, { status: 500 });
  }
}
