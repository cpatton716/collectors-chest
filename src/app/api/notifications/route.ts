import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { isUserSuspended } from "@/lib/adminAuth";
import {
  getUnreadNotificationCount,
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/auctionDb";
import { getProfileByClerkId } from "@/lib/db";
import { schemas, validateBody, validateQuery } from "@/lib/validation";

const querySchema = z.object({
  unreadOnly: z.enum(["true", "false"]).optional(),
  countOnly: z.enum(["true", "false"]).optional(),
});

const patchSchema = z
  .object({
    notificationId: schemas.uuid.optional(),
    markAll: z.boolean().optional(),
  })
  .refine((v) => v.markAll === true || !!v.notificationId, {
    message: "notificationId or markAll is required",
    path: ["notificationId"],
  });

// GET - Get user's notifications
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const queryResult = validateQuery(querySchema, request.nextUrl.searchParams);
    if (!queryResult.success) return queryResult.response;
    const unreadOnly = queryResult.data.unreadOnly === "true";
    const countOnly = queryResult.data.countOnly === "true";

    if (countOnly) {
      const count = await getUnreadNotificationCount(profile.id);
      return NextResponse.json({ count });
    }

    const notifications = await getUserNotifications(profile.id, unreadOnly);
    const unreadCount = await getUnreadNotificationCount(profile.id);

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

// PATCH - Mark notification(s) as read
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
    const bodyResult = validateBody(patchSchema, body);
    if (!bodyResult.success) return bodyResult.response;
    const { notificationId, markAll } = bodyResult.data;

    if (markAll) {
      await markAllNotificationsRead(profile.id);
    } else if (notificationId) {
      await markNotificationRead(notificationId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking notifications:", error);
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
}
