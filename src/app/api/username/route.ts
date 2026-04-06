import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getProfileByClerkId } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import {
  formatUsernameForDisplay,
  normalizeUsername,
  validateUsernameComplete,
} from "@/lib/usernameValidation";

/**
 * GET - Check username availability
 * Query params: ?username=desired_username
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const normalized = normalizeUsername(username);

    // Validate format and check profanity
    const validation = validateUsernameComplete(normalized);
    if (!validation.isValid) {
      return NextResponse.json({
        available: false,
        error: validation.error,
      });
    }

    // Check if username is already taken (exclude current user's own profile)
    const { userId } = await auth();
    let excludeProfileId: string | null = null;
    if (userId) {
      const profile = await getProfileByClerkId(userId);
      if (profile) excludeProfileId = profile.id;
    }

    let query = supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", normalized);
    if (excludeProfileId) {
      query = query.neq("id", excludeProfileId);
    }
    const { data: existing, error } = await query.maybeSingle();

    if (error) {
      console.error("Error checking username:", error);
      return NextResponse.json({ error: "Failed to check username availability" }, { status: 500 });
    }

    return NextResponse.json({
      available: !existing,
      normalized,
      display: formatUsernameForDisplay(normalized),
    });
  } catch (error) {
    console.error("Username check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST - Set or update username
 * Body: { username: string, displayPreference?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { username, displayPreference } = body;

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const normalized = normalizeUsername(username);

    // Validate format and check profanity
    const validation = validateUsernameComplete(normalized);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Get user's profile
    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Check if username is already taken by another user
    const { data: existing, error: checkError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", normalized)
      .neq("id", profile.id)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking username:", checkError);
      return NextResponse.json({ error: "Failed to check username availability" }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
    }

    // Prepare update data
    const updateData: Record<string, string> = {
      username: normalized,
    };

    // Validate and add display preference if provided
    if (displayPreference) {
      const validPreferences = ["username_only", "display_name_only", "both"];
      if (!validPreferences.includes(displayPreference)) {
        return NextResponse.json({ error: "Invalid display preference" }, { status: 400 });
      }
      updateData.display_preference = displayPreference;
    }

    // Update profile
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(updateData)
      .eq("id", profile.id);

    if (updateError) {
      console.error("Error updating username:", updateError);

      // Check for unique constraint violation
      if (updateError.code === "23505") {
        return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
      }

      return NextResponse.json({ error: "Failed to update username" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      username: normalized,
      display: formatUsernameForDisplay(normalized),
      displayPreference: updateData.display_preference || "username_only",
    });
  } catch (error) {
    console.error("Username update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE - Remove username (set to null)
 */
export async function DELETE() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        username: null,
        display_preference: "username_only",
      })
      .eq("id", profile.id);

    if (error) {
      console.error("Error removing username:", error);
      return NextResponse.json({ error: "Failed to remove username" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Username delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
