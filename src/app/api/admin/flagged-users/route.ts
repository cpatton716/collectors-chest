import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabase";
import { validateQuery } from "@/lib/validation";

import { PAYMENT_MISS_WINDOW_DAYS } from "@/types/auction";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

async function isAdmin(clerkUserId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("clerk_user_id", clerkUserId)
    .single();
  return data?.is_admin === true;
}

/**
 * GET /api/admin/flagged-users
 *
 * Admin-only. Returns profiles with `bid_restricted_at IS NOT NULL` along
 * with their strike count (rolling 90-day window) and most recent missed
 * payment timestamp.
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdmin(userId))) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const queryResult = validateQuery(listQuerySchema, searchParams);
    if (!queryResult.success) return queryResult.response;
    const { limit, offset } = queryResult.data;

    const { data: flaggedUsers, error, count } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, clerk_user_id, username, display_name, email, bid_restricted_at, bid_restricted_reason, payment_missed_count, payment_missed_at",
        { count: "exact" }
      )
      .not("bid_restricted_at", "is", null)
      .order("bid_restricted_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching flagged users:", error);
      return NextResponse.json(
        { error: "Failed to fetch flagged users" },
        { status: 500 }
      );
    }

    // For each flagged user, look up actual strikes inside the rolling
    // window from the audit log (source of truth for "was this offense
    // recent?"). Keep the work bounded — up to `limit` users per page.
    const windowStart = new Date(
      Date.now() - PAYMENT_MISS_WINDOW_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const enriched = await Promise.all(
      (flaggedUsers ?? []).map(async (user) => {
        const { count: strikesInWindow } = await supabaseAdmin
          .from("auction_audit_log")
          .select("id", { count: "exact", head: true })
          .eq("actor_profile_id", user.id)
          .eq("event_type", "auction_payment_expired")
          .gte("created_at", windowStart);

        return {
          id: user.id,
          clerkUserId: user.clerk_user_id,
          username: user.username,
          displayName: user.display_name,
          email: user.email,
          bidRestrictedAt: user.bid_restricted_at,
          bidRestrictedReason: user.bid_restricted_reason,
          paymentMissedCount: user.payment_missed_count ?? 0,
          paymentMissedAt: user.payment_missed_at,
          strikesInWindow: strikesInWindow ?? 0,
        };
      })
    );

    return NextResponse.json({
      users: enriched,
      pagination: {
        limit,
        offset,
        total: count ?? 0,
      },
      windowDays: PAYMENT_MISS_WINDOW_DAYS,
    });
  } catch (error) {
    console.error("Error in flagged-users GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch flagged users" },
      { status: 500 }
    );
  }
}
