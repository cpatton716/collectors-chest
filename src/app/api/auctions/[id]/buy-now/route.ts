import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { isUserSuspended } from "@/lib/adminAuth";
import { executeBuyItNow } from "@/lib/auctionDb";
import { getProfileByClerkId } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import { schemas, validateParams } from "@/lib/validation";

const paramsSchema = z.object({ id: schemas.uuid });

// POST - Execute Buy It Now
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is suspended
    const suspensionStatus = await isUserSuspended(userId);
    if (suspensionStatus.suspended) {
      return NextResponse.json(
        {
          error: "account_suspended",
          message: "Your account has been suspended.",
          suspended: true,
        },
        { status: 403 }
      );
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Age verification gate — mirrors /bid so a Buy It Now can't bypass the
    // 18+ marketplace requirement. H-AU3.
    if (!profile.age_confirmed_at) {
      return NextResponse.json(
        {
          error: "AGE_VERIFICATION_REQUIRED",
          message: "You must confirm you are 18+ to use the marketplace.",
        },
        { status: 403 }
      );
    }

    // Bid-restriction gate — mirrors /bid. A user flagged by the payment-miss
    // strike system shouldn't be able to commit to a purchase via Buy It Now
    // either. H-AU3.
    const { data: buyer } = await supabaseAdmin
      .from("profiles")
      .select("bid_restricted_at, bid_restricted_reason")
      .eq("id", profile.id)
      .single();

    if (buyer?.bid_restricted_at) {
      return NextResponse.json(
        {
          error: "Purchasing is currently restricted on your account",
          reason: buyer.bid_restricted_reason ?? "Contact support for details",
        },
        { status: 403 }
      );
    }

    const validatedParams = validateParams(paramsSchema, await params);
    if (!validatedParams.success) return validatedParams.response;
    const { id: auctionId } = validatedParams.data;

    const result = await executeBuyItNow(auctionId, profile.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error executing Buy It Now:", error);
    return NextResponse.json({ error: "Failed to complete purchase" }, { status: 500 });
  }
}
