import { NextRequest, NextResponse } from "next/server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";

import { getProfileByClerkId } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import {
  formatUsernameForDisplay,
  normalizeUsername,
  validateUsernameComplete,
} from "@/lib/usernameValidation";
import { validateBody, validateQuery } from "@/lib/validation";

// Supabase DB constraint: username must match ^[a-z0-9_]{3,20}$
// Surfacing the regex here gives clean 400 errors instead of DB constraint violations.
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

const usernameQuerySchema = z.object({
  username: z
    .string()
    .min(1, "Username is required")
    .max(50, "Username is too long"),
});

const setUsernameSchema = z.object({
  username: z
    .string()
    .min(1, "Username is required")
    .max(50, "Username is too long"),
  displayPreference: z.enum(["username_only", "display_name_only", "both"]).optional(),
});

/**
 * Sync the username to Clerk after a successful Supabase write.
 *
 * Supabase is the source of truth for Collectors Chest. Clerk is secondary —
 * if this call fails (rate limit, Clerk-side validation rejection, etc.) we
 * log and swallow the error so the user's save still appears successful.
 *
 * Pass `null` to clear Clerk's username (mirrors DELETE behavior). Clerk's
 * typed SDK declares `username` as `string | undefined`, but the underlying
 * BAPI accepts `null` to clear the field — we cast accordingly.
 */
async function syncUsernameToClerk(clerkUserId: string, username: string | null): Promise<void> {
  try {
    const clerk = await clerkClient();
    await clerk.users.updateUser(clerkUserId, {
      username: username as string | undefined,
    });
  } catch (err) {
    console.error("[profile] Clerk username sync failed:", err);
  }
}

/**
 * GET - Check username availability
 * Query params: ?username=desired_username
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const validated = validateQuery(usernameQuerySchema, searchParams);
    if (!validated.success) return validated.response;

    const { username } = validated.data;
    const normalized = normalizeUsername(username);

    // Post-normalization regex check mirrors the Supabase DB constraint.
    if (!USERNAME_REGEX.test(normalized)) {
      return NextResponse.json({
        available: false,
        error: "Username must be 3-20 lowercase letters, digits, or underscores",
      });
    }

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

    const body = await request.json().catch(() => null);
    const validated = validateBody(setUsernameSchema, body);
    if (!validated.success) return validated.response;

    const { username, displayPreference } = validated.data;
    const normalized = normalizeUsername(username);

    // Post-normalization regex check mirrors the Supabase DB constraint (^[a-z0-9_]{3,20}$).
    if (!USERNAME_REGEX.test(normalized)) {
      return NextResponse.json(
        { error: "Username must be 3-20 lowercase letters, digits, or underscores" },
        { status: 400 }
      );
    }

    // Validate format and check profanity (includes the regex above plus profanity + reserved)
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

    // displayPreference was already validated by Zod enum
    if (displayPreference) {
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

    // Mirror the username to Clerk so the UserButton popover stays in sync.
    // Errors here are logged but do not fail the request — Supabase is source of truth.
    await syncUsernameToClerk(userId, normalized);

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

    // Clear the username in Clerk as well. Errors are logged but non-fatal.
    await syncUsernameToClerk(userId, null);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Username delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
