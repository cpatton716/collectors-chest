import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getProfileByClerkId } from "@/lib/db";

/**
 * GET - Get current user's username
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({
      username: profile.username || null,
      displayPreference: profile.display_preference || "username_only",
      profileId: profile.id,
    });
  } catch (error) {
    console.error("Error fetching username:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
