import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { isUserSuspended } from "@/lib/adminAuth";
import {
  deleteNotificationForUser,
  getNotificationByIdForUser,
} from "@/lib/auctionDb";
import { getProfileByClerkId } from "@/lib/db";
import { isNonDeletableNotification } from "@/lib/notificationLinks";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  rateLimiters,
} from "@/lib/rateLimit";
import { schemas, validateParams } from "@/lib/validation";

const paramsSchema = z.object({ id: schemas.uuid });

// GET /api/notifications/[id]
//
// Used by the inbox `?focus=<id>` deep-link to surface a "Notification not
// found — it may have been cleared" toast when the row has been pruned or
// belongs to another user. Returns 404 on miss (NOT 403 — don't leak
// existence).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: a Capacitor push handler that taps a stale deep link will
    // 404 here and retry; without a cap that storm could amplify Redis +
    // function-invocation cost. Use the general 30/min bucket keyed on
    // Clerk userId.
    const rateCheck = await checkRateLimit(
      rateLimiters.api,
      getRateLimitIdentifier(userId, null)
    );
    if (!rateCheck.success) return rateCheck.response!;

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const validatedParams = validateParams(paramsSchema, await params);
    if (!validatedParams.success) return validatedParams.response;
    const { id } = validatedParams.data;

    const notification = await getNotificationByIdForUser(id, profile.id);
    if (!notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    return NextResponse.json({ notification });
  } catch (error) {
    console.error("Error fetching notification:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification" },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications/[id]
//
// Per-row dismiss in the inbox. Hard-deletes the row (no soft archive).
// Suspended users are blocked. Moderation/safety types (payment_missed_*,
// auction_payment_expired*) are server-side-blocked from deletion to keep
// the user-visible audit trail intact.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const suspensionStatus = await isUserSuspended(userId);
    if (suspensionStatus.suspended) {
      return NextResponse.json(
        { error: "Your account has been suspended." },
        { status: 403 }
      );
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const validatedParams = validateParams(paramsSchema, await params);
    if (!validatedParams.success) return validatedParams.response;
    const { id } = validatedParams.data;

    // Look up the row first so we can enforce NON_DELETABLE_TYPES and
    // return 404 (not 403) when the id doesn't belong to the caller.
    const existing = await getNotificationByIdForUser(id, profile.id);
    if (!existing) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    if (isNonDeletableNotification(existing.type)) {
      return NextResponse.json(
        {
          error:
            "This notification can't be dismissed. It contains account-safety information.",
        },
        { status: 403 }
      );
    }

    const deleted = await deleteNotificationForUser(id, profile.id);
    if (!deleted) {
      // Race: row was deleted between the read above and the delete here
      // (e.g., the prune cron). Treat as already gone.
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return NextResponse.json(
      { error: "Failed to delete notification" },
      { status: 500 }
    );
  }
}
