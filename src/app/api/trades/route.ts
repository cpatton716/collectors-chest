import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getProfileByClerkId } from "@/lib/db";
import { createTrade, getUserTrades } from "@/lib/tradingDb";

import { CreateTradeInput, TradeStatus } from "@/types/trade";

// GET - Get user's trades
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

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const status = statusParam ? (statusParam.split(",") as TradeStatus[]) : undefined;

    const trades = await getUserTrades(profile.id, status);

    return NextResponse.json({ trades, total: trades.length });
  } catch (error) {
    console.error("Error fetching trades:", error);
    return NextResponse.json({ error: "Failed to fetch trades" }, { status: 500 });
  }
}

// POST - Create a new trade proposal
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Age verification gate
    if (!profile.age_confirmed_at) {
      return NextResponse.json(
        { error: "AGE_VERIFICATION_REQUIRED", message: "You must confirm you are 18+ to use the marketplace." },
        { status: 403 }
      );
    }

    const body: CreateTradeInput = await request.json();

    // Validation
    if (!body.recipientId) {
      return NextResponse.json({ error: "Recipient required" }, { status: 400 });
    }
    if (!body.myComicIds?.length || !body.theirComicIds?.length) {
      return NextResponse.json({ error: "Must include comics from both parties" }, { status: 400 });
    }
    if (body.recipientId === profile.id) {
      return NextResponse.json({ error: "Cannot trade with yourself" }, { status: 400 });
    }

    const trade = await createTrade(profile.id, body);

    return NextResponse.json({ trade }, { status: 201 });
  } catch (error) {
    console.error("Error creating trade:", error);
    return NextResponse.json({ error: "Failed to create trade" }, { status: 500 });
  }
}
