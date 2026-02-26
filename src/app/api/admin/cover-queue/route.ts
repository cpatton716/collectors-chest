import { NextRequest, NextResponse } from "next/server";
import { getAdminProfile } from "@/lib/adminAuth";
import {
  getPendingCovers,
  approveCover,
  rejectCover,
} from "@/lib/coverImageDb";

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
