import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getProfileByClerkId } from "@/lib/db";
import { confirmReceipt, getTradeById, markAsShipped, updateTradeStatus } from "@/lib/tradingDb";
import { schemas, validateBody, validateParams } from "@/lib/validation";

const paramsSchema = z.object({ tradeId: schemas.uuid });

const tradeStatusEnum = z.enum([
  "proposed",
  "accepted",
  "shipped",
  "completed",
  "cancelled",
  "declined",
]);

const updateTradeBodySchema = z
  .object({
    action: z.enum(["ship", "confirm_receipt"]).optional(),
    status: tradeStatusEnum.optional(),
    trackingCarrier: z.enum(["usps", "ups", "fedex", "dhl", "other"]).optional(),
    trackingNumber: z.string().trim().min(1).max(100).optional(),
    cancelReason: z.string().max(500).optional(),
  })
  .strict()
  .refine((data) => data.action || data.status, {
    message: "Either action or status is required",
  });

// GET - Get trade details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const validatedParams = validateParams(paramsSchema, await params);
    if (!validatedParams.success) return validatedParams.response;
    const { tradeId } = validatedParams.data;
    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const trade = await getTradeById(tradeId, profile.id);
    if (!trade) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    return NextResponse.json({ trade });
  } catch (error) {
    console.error("Error fetching trade:", error);
    return NextResponse.json({ error: "Failed to fetch trade" }, { status: 500 });
  }
}

// PATCH - Update trade (status, shipping info)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const validatedParams = validateParams(paramsSchema, await params);
    if (!validatedParams.success) return validatedParams.response;
    const { tradeId } = validatedParams.data;
    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const rawBody = await request.json().catch(() => null);
    const validatedBody = validateBody(updateTradeBodySchema, rawBody);
    if (!validatedBody.success) return validatedBody.response;
    const { action, status, trackingCarrier, trackingNumber, cancelReason } = validatedBody.data;

    let trade;

    // Handle specific actions
    if (action === "ship") {
      trade = await markAsShipped(tradeId, profile.id, trackingCarrier, trackingNumber);
    } else if (action === "confirm_receipt") {
      trade = await confirmReceipt(tradeId, profile.id);
    } else if (status) {
      // Generic status update
      trade = await updateTradeStatus(tradeId, profile.id, {
        status,
        cancelReason,
      });
    } else {
      return NextResponse.json({ error: "No action or status provided" }, { status: 400 });
    }

    return NextResponse.json({ trade });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update trade";
    console.error("Error updating trade:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
