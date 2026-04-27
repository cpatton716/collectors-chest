import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { cloneSoldComicToBuyer, createNotification } from "@/lib/auctionDb";
import { logAuctionAuditEvent } from "@/lib/auditLog";
import { getProfileByClerkId } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import { schemas, validateBody, validateParams } from "@/lib/validation";

const paramsSchema = z.object({ id: schemas.uuid });

const markShippedBodySchema = z
  .object({
    trackingNumber: z.string().max(100).optional(),
    trackingCarrier: z.string().max(50).optional(),
  })
  .strict();

// POST /api/auctions/[id]/mark-shipped
// Seller marks a sold+paid listing as shipped. Accepts an optional tracking
// number + carrier (self-reported, not validated — Option A per BACKLOG).
// On success: records shipped_at, triggers the comic ownership transfer to
// the buyer, and notifies the buyer that the shipment is on its way.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const validatedParams = validateParams(paramsSchema, await params);
    if (!validatedParams.success) return validatedParams.response;
    const { id: auctionId } = validatedParams.data;

    const rawBody = await request.json().catch(() => ({}));
    const validatedBody = validateBody(markShippedBodySchema, rawBody);
    if (!validatedBody.success) return validatedBody.response;
    const trackingNumber =
      validatedBody.data.trackingNumber && validatedBody.data.trackingNumber.trim().length > 0
        ? validatedBody.data.trackingNumber.trim()
        : null;
    const trackingCarrier =
      validatedBody.data.trackingCarrier && validatedBody.data.trackingCarrier.trim().length > 0
        ? validatedBody.data.trackingCarrier.trim()
        : null;

    // Fetch the auction. Must be the seller, must be sold+paid, must not already be shipped.
    const { data: auction, error: fetchError } = await supabaseAdmin
      .from("auctions")
      .select("id, seller_id, winner_id, comic_id, status, payment_status, shipped_at, winning_bid, current_bid, starting_price")
      .eq("id", auctionId)
      .single();

    if (fetchError || !auction) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (auction.seller_id !== profile.id) {
      return NextResponse.json({ error: "Only the seller can mark this as shipped" }, { status: 403 });
    }

    if (auction.status !== "sold" || auction.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Listing must be sold and paid before it can be marked shipped" },
        { status: 400 }
      );
    }

    if (auction.shipped_at) {
      return NextResponse.json(
        { error: "Listing is already marked as shipped" },
        { status: 400 }
      );
    }

    if (!auction.winner_id || !auction.comic_id) {
      return NextResponse.json(
        { error: "Listing is missing buyer or comic reference" },
        { status: 400 }
      );
    }

    const salePrice =
      (auction.winning_bid as number | null) ||
      (auction.current_bid as number | null) ||
      (auction.starting_price as number | null) ||
      0;

    // Transfer ownership: clone the seller's comic row to the buyer, mark
    // seller's original row as sold. Done BEFORE the auction update so that
    // if the clone fails, shipped_at isn't set (buyer isn't cheated out of
    // their comic while we appear to have shipped).
    const cloneResult = await cloneSoldComicToBuyer({
      sellerComicId: auction.comic_id,
      buyerId: auction.winner_id,
      salePrice,
      auctionId: auction.id,
    });

    if (!cloneResult.success && !cloneResult.skipped) {
      return NextResponse.json(
        { error: `Failed to transfer comic ownership: ${cloneResult.error}` },
        { status: 500 }
      );
    }

    // Mark auction as shipped
    const { error: updateError } = await supabaseAdmin
      .from("auctions")
      .update({
        shipped_at: new Date().toISOString(),
        tracking_number: trackingNumber,
        tracking_carrier: trackingCarrier,
      })
      .eq("id", auctionId);

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to update listing: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Notify buyer their item is on the way. Dedicated `shipped` type so
    // the bell renders a delivery-truck icon (was overloading `ended` which
    // showed a Clock — semantic mismatch fixed Apr 27, 2026).
    await createNotification(auction.winner_id, "shipped", auctionId, undefined, {
      message: trackingNumber
        ? `Tracking: ${trackingCarrier ? trackingCarrier + " " : ""}${trackingNumber}. The comic has been added to your collection.`
        : undefined,
    });

    // Feedback eligibility flips true on shipment, so this is the right
    // moment to prompt both parties. Buyer rates the seller, seller rates
    // the buyer.
    await createNotification(auction.winner_id, "rating_request", auctionId);
    await createNotification(profile.id, "rating_request", auctionId);

    void logAuctionAuditEvent({
      auctionId,
      actorProfileId: profile.id,
      eventType: "shipment_created",
      eventData: {
        tracking_number: trackingNumber ?? null,
        tracking_carrier: trackingCarrier ?? null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[mark-shipped] Error:", error);
    return NextResponse.json({ error: "Failed to mark as shipped" }, { status: 500 });
  }
}
