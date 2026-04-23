import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { getBidHistory } from "@/lib/auctionDb";
import { schemas, validateParams } from "@/lib/validation";

const paramsSchema = z.object({ id: schemas.uuid });

// GET - Get bid history for an auction (anonymized)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const validatedParams = validateParams(paramsSchema, await params);
    if (!validatedParams.success) return validatedParams.response;
    const { id: auctionId } = validatedParams.data;

    const bids = await getBidHistory(auctionId);

    return NextResponse.json({ bids });
  } catch (error) {
    console.error("Error fetching bid history:", error);
    return NextResponse.json({ error: "Failed to fetch bid history" }, { status: 500 });
  }
}
