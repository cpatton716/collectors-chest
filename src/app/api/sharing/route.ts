import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { isUserSuspended } from "@/lib/adminAuth";
import {
  getProfileByClerkId,
  getSharingSettings,
  togglePublicSharing,
  updatePublicProfileSettings,
} from "@/lib/db";
import { validateBody } from "@/lib/validation";

// Allow the 2-char edge case that the prior logic permitted (regex only enforced when len > 2).
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]{1,2}$/;

const toggleSchema = z.object({
  enable: z.boolean(),
  customSlug: z
    .string()
    .min(3, "URL must be between 3 and 30 characters")
    .max(30, "URL must be between 3 and 30 characters")
    .regex(SLUG_REGEX, "URL can only contain lowercase letters, numbers, and hyphens")
    .optional(),
});

const updateSchema = z.object({
  publicDisplayName: z.string().max(50, "Display name must be 50 characters or less").optional(),
  publicBio: z.string().max(200, "Bio must be 200 characters or less").optional(),
  publicSlug: z
    .string()
    .min(3, "URL must be between 3 and 30 characters")
    .max(30, "URL must be between 3 and 30 characters")
    .regex(SLUG_REGEX, "URL can only contain lowercase letters, numbers, and hyphens")
    .optional(),
});

// GET - Get current sharing settings
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

    const settings = await getSharingSettings(profile.id);
    if (!settings) {
      return NextResponse.json({ error: "Settings not found" }, { status: 404 });
    }

    return NextResponse.json({
      isPublic: settings.isPublic,
      publicSlug: settings.publicSlug,
      publicDisplayName: settings.publicDisplayName,
      publicBio: settings.publicBio,
      shareUrl:
        settings.isPublic && settings.publicSlug
          ? `${process.env.NEXT_PUBLIC_APP_URL || ""}/u/${settings.publicSlug}`
          : null,
    });
  } catch (error) {
    console.error("Error getting sharing settings:", error);
    return NextResponse.json({ error: "Failed to get sharing settings" }, { status: 500 });
  }
}

// POST - Toggle public sharing on/off
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is suspended
    const suspensionStatus = await isUserSuspended(userId);
    if (suspensionStatus.suspended) {
      return NextResponse.json({ error: "Your account has been suspended." }, { status: 403 });
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const validated = validateBody(toggleSchema, body);
    if (!validated.success) return validated.response;
    const { enable, customSlug } = validated.data;

    const result = await togglePublicSharing(profile.id, enable, customSlug);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      isPublic: enable,
      publicSlug: result.slug,
      shareUrl:
        enable && result.slug ? `${process.env.NEXT_PUBLIC_APP_URL || ""}/u/${result.slug}` : null,
    });
  } catch (error) {
    console.error("Error toggling public sharing:", error);
    return NextResponse.json({ error: "Failed to update sharing settings" }, { status: 500 });
  }
}

// PATCH - Update public profile settings
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is suspended
    const suspensionStatus = await isUserSuspended(userId);
    if (suspensionStatus.suspended) {
      return NextResponse.json({ error: "Your account has been suspended." }, { status: 403 });
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const validated = validateBody(updateSchema, body);
    if (!validated.success) return validated.response;
    const { publicDisplayName, publicBio, publicSlug } = validated.data;

    const result = await updatePublicProfileSettings(profile.id, {
      publicDisplayName,
      publicBio,
      publicSlug,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating public profile settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
