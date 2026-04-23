import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getAdminProfile,
  getProfileById,
  grantPremiumAccess,
  logAdminAction,
} from "@/lib/adminAuth";
import { schemas, validateBody, validateParams } from "@/lib/validation";

const paramsSchema = z.object({ id: schemas.uuid });

const grantPremiumSchema = z.object({
  days: z.number().int().positive().max(365).optional(),
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

    // Parse optional body. An empty / invalid body is allowed (defaults to 30 days).
    let days = 30;
    const rawBody = await request.json().catch(() => null);
    if (rawBody !== null) {
      const validated = validateBody(grantPremiumSchema, rawBody);
      if (!validated.success) return validated.response;
      if (validated.data.days !== undefined) {
        days = validated.data.days;
      }
    }

    // Verify user exists
    const profile = await getProfileById(id);
    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Grant premium access
    const { expiresAt } = await grantPremiumAccess(id, days);

    // Log the action
    await logAdminAction(adminProfile.id, "grant_premium", id, {
      days_granted: days,
      expires_at: expiresAt,
    });

    return NextResponse.json({
      success: true,
      message: `Granted ${days} days of premium access`,
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error("Error granting premium:", error);
    return NextResponse.json({ error: "Failed to grant premium access" }, { status: 500 });
  }
}
