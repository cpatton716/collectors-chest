import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { isUserSuspended } from "@/lib/adminAuth";
import {
  getUnreadNotificationCount,
  getUserNotifications,
  getUserNotificationsPaginated,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/auctionDb";
import { getProfileByClerkId } from "@/lib/db";
import {
  decodeNotificationCursor,
  encodeNotificationCursor,
  NOTIFICATIONS_PAGE_LIMIT_DEFAULT,
  NOTIFICATIONS_PAGE_LIMIT_MAX,
} from "@/lib/notificationCursor";
import { schemas, validateBody, validateQuery } from "@/lib/validation";

const querySchema = z.object({
  unreadOnly: z.enum(["true", "false"]).optional(),
  countOnly: z.enum(["true", "false"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(NOTIFICATIONS_PAGE_LIMIT_MAX).optional(),
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
//
// Query params:
//   countOnly=true     → returns { count } (used by bell polling)
//   unreadOnly=true    → bell-mode list (limit 50, no cursor) of unread only
//   cursor=<base64>    → inbox-mode pagination (composite cursor)
//   limit=<int>        → page size, default 50, capped at 100
//
// When `cursor` or `limit` is supplied, the response is the paginated shape
// `{ notifications, nextCursor, unreadCount }`. Otherwise the legacy bell
// shape `{ notifications, unreadCount }` is returned for backward compat.
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
    const { unreadOnly, countOnly, cursor: rawCursor, limit: rawLimit } = queryResult.data;

    if (countOnly === "true") {
      const count = await getUnreadNotificationCount(profile.id);
      return NextResponse.json({ count });
    }

    // Inbox mode — cursor or explicit limit means the caller wants
    // pagination. Bell mode (no cursor, no limit) keeps its existing shape.
    const isPaginated = rawCursor !== undefined || rawLimit !== undefined;

    if (isPaginated) {
      const cursor = decodeNotificationCursor(rawCursor);
      const limit = rawLimit ?? NOTIFICATIONS_PAGE_LIMIT_DEFAULT;
      const { notifications, nextCursor } = await getUserNotificationsPaginated(
        profile.id,
        cursor,
        limit
      );
      const unreadCount = await getUnreadNotificationCount(profile.id);
      return NextResponse.json({
        notifications,
        nextCursor: encodeNotificationCursor(nextCursor) || null,
        unreadCount,
      });
    }

    const notifications = await getUserNotifications(
      profile.id,
      unreadOnly === "true"
    );
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
      // Pass asOf so notifications that arrive mid-flight are not silently
      // swept. Client-supplied or now() — either way, only existing rows
      // get marked.
      await markAllNotificationsRead(profile.id, new Date());
    } else if (notificationId) {
      await markNotificationRead(notificationId, profile.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking notifications:", error);
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
}
