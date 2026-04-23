import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getProfileByClerkId } from "@/lib/db";
import { checkFeedbackEligibility } from "@/lib/creatorCreditsDb";
import { schemas, validateQuery } from "@/lib/validation";

const eligibilityQuerySchema = z.object({
  transactionId: schemas.uuid,
  transactionType: z.enum(["sale", "auction", "trade"]),
});

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

    const validatedQuery = validateQuery(eligibilityQuerySchema, request.nextUrl.searchParams);
    if (!validatedQuery.success) return validatedQuery.response;
    const { transactionId, transactionType } = validatedQuery.data;

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
