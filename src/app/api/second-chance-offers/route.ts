import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getPendingSecondChanceOffersForRunnerUp } from "@/lib/auctionDb";
import { getProfileByClerkId } from "@/lib/db";

/**
 * GET /api/second-chance-offers
 *
 * Returns all pending Second Chance Offers where the signed-in user is the
 * runner-up. Used by the /transactions Wins tab to render inbox cards.
 */
export async function GET(_request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const offers = await getPendingSecondChanceOffersForRunnerUp(profile.id);
    return NextResponse.json({ offers });
  } catch (error) {
    console.error("Error fetching second-chance offers:", error);
    return NextResponse.json(
      { error: "Failed to fetch offers" },
      { status: 500 }
    );
  }
}
