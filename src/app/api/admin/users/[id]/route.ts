import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAdminProfile, getProfileById, getUserScanCount, logAdminAction } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { schemas, validateParams } from "@/lib/validation";

const paramsSchema = z.object({ id: schemas.uuid });

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Get user profile
    const profile = await getProfileById(id);
    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get additional stats
    const scanCount = await getUserScanCount(id);

    // Get comic count
    const { count: comicCount } = await supabaseAdmin
      .from("comics")
      .select("*", { count: "exact", head: true })
      .eq("user_id", id);

    // Log the view action
    await logAdminAction(adminProfile.id, "view_profile", id);

    // Determine trial status
    let trialStatus: "available" | "active" | "expired" = "available";
    if (profile.trial_started_at) {
      if (profile.trial_ends_at && new Date(profile.trial_ends_at) > new Date()) {
        trialStatus = "active";
      } else {
        trialStatus = "expired";
      }
    }

    return NextResponse.json({
      user: {
        ...profile,
        scans_this_month: scanCount,
        comic_count: comicCount || 0,
        trial_status: trialStatus,
      },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}
