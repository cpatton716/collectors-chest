import { NextRequest, NextResponse } from "next/server";
import { getAdminProfile } from "@/lib/adminAuth";
import {
  getPendingCovers,
  approveCover,
  rejectCover,
} from "@/lib/coverImageDb";
import { supabaseAdmin } from "@/lib/supabase";
import { recordContribution } from "@/lib/creatorCreditsDb";

// GET — fetch pending covers for admin review
export async function GET(request: NextRequest) {
  const adminProfile = await getAdminProfile();
  if (!adminProfile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  try {
    const { covers, total } = await getPendingCovers(page, limit);
    return NextResponse.json({ covers, total, page, limit });
  } catch (error) {
    console.error("Admin cover queue error:", error);
    return NextResponse.json(
      { error: "Failed to fetch cover queue" },
      { status: 500 }
    );
  }
}

// PATCH — approve or reject a cover
export async function PATCH(request: NextRequest) {
  const adminProfile = await getAdminProfile();
  if (!adminProfile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { coverId, action } = body;

    if (!coverId || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "coverId and action (approve|reject) required" },
        { status: 400 }
      );
    }

    if (action === "approve") {
      await approveCover(coverId, adminProfile.id);

      // Award Creator Credits to the submitter (non-blocking)
      try {
        const { data: cover } = await supabaseAdmin
          .from("cover_images")
          .select("submitted_by, title_normalized, issue_number")
          .eq("id", coverId)
          .single();

        if (cover?.submitted_by) {
          const details = [cover.title_normalized, `#${cover.issue_number}`]
            .filter(Boolean)
            .join(" ");
          await recordContribution(cover.submitted_by, "cover_image", coverId);
          // Credit awarded successfully
        }
      } catch (creditError) {
        // Credit failure must not block the approval
        console.error("[cover-queue] Failed to award Creator Credit:", creditError);
      }
    } else {
      await rejectCover(coverId);
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error("Admin cover action error:", error);
    return NextResponse.json(
      { error: "Failed to process cover action" },
      { status: 500 }
    );
  }
}
