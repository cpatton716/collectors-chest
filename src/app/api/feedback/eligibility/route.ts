import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getProfileByClerkId } from "@/lib/db";
import { checkFeedbackEligibility } from "@/lib/reputationDb";
import { TransactionType } from "@/types/reputation";

// GET - Check if user can leave feedback for a transaction
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(clerkId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const transactionId = searchParams.get("transactionId");
    const transactionType = searchParams.get(
      "transactionType"
    ) as TransactionType;

    if (!transactionId || !transactionType) {
      return NextResponse.json(
        { error: "transactionId and transactionType required" },
        { status: 400 }
      );
    }

    if (!["sale", "auction", "trade"].includes(transactionType)) {
      return NextResponse.json(
        { error: "Invalid transaction type" },
        { status: 400 }
      );
    }

    const eligibility = await checkFeedbackEligibility(
      profile.id,
      transactionId,
      transactionType
    );

    return NextResponse.json({ eligibility });
  } catch (error) {
    console.error("[API] Error checking eligibility:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
