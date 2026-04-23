import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getProfileByClerkId } from "@/lib/db";
import { getUserMatches, triggerMatchFinding } from "@/lib/tradingDb";
import { schemas, validateBody, validateQuery } from "@/lib/validation";

const matchesQuerySchema = z.object({
  refresh: z.enum(["true", "false"]).optional(),
});

const triggerMatchBodySchema = z
  .object({
    comicId: schemas.uuid.optional(),
  })
  .strict();

// GET - Get user's trade matches (grouped by their comic)
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

    // Optionally trigger match finding first
    const { searchParams } = new URL(request.url);
    const validatedQuery = validateQuery(matchesQuerySchema, searchParams);
    if (!validatedQuery.success) return validatedQuery.response;
    if (validatedQuery.data.refresh === "true") {
      await triggerMatchFinding(profile.id);
    }

    const matches = await getUserMatches(profile.id);

    return NextResponse.json({
      matches,
      total: matches.reduce((sum, g) => sum + g.matches.length, 0),
    });
  } catch (error) {
    console.error("Error fetching matches:", error);
    return NextResponse.json({ error: "Failed to fetch matches" }, { status: 500 });
  }
}

// POST - Trigger match finding for current user
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

    const rawBody = await request.json().catch(() => ({}));
    const validatedBody = validateBody(triggerMatchBodySchema, rawBody);
    if (!validatedBody.success) return validatedBody.response;
    const { comicId } = validatedBody.data;

    const matchesFound = await triggerMatchFinding(profile.id, comicId);

    return NextResponse.json({
      success: true,
      matchesFound,
    });
  } catch (error) {
    console.error("Error triggering match finding:", error);
    return NextResponse.json({ error: "Failed to find matches" }, { status: 500 });
  }
}
