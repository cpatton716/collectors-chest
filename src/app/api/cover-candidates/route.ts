import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getCommunityCovers } from "@/lib/coverImageDb";
import { checkRateLimit, getRateLimitIdentifier, rateLimiters } from "@/lib/rateLimit";
import { validateBody } from "@/lib/validation";

// NOTE: The legacy external image-search design (Bing/Google) was superseded —
// see docs/plans/2026-02-25-cover-image-search-design.md (Superseded). There is
// no external image-search provider wired up; this endpoint resolves covers from
// the community database only and otherwise returns an empty candidate list so
// the user can paste a URL or skip.

const coverCandidatesSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  issueNumber: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .pipe(z.string().min(1, "Issue number is required").max(50)),
  publisher: z.string().trim().max(100).optional().nullable(),
  releaseYear: z
    .union([z.string(), z.number()])
    .transform((v) => (v === undefined || v === null ? undefined : String(v)))
    .optional()
    .nullable(),
});

interface CoverCandidate {
  url: string;
  title: string;
  source: string;
}

export async function POST(request: NextRequest) {
  try {
    // Require an authenticated user — this is a logged-in cover-review feature.
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit (community DB read; previously also burned a Haiku call)
    const identifier = getRateLimitIdentifier(
      userId,
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")
    );
    const { success: rateLimitSuccess, response: rateLimitResponse } =
      await checkRateLimit(rateLimiters.lookup, identifier);
    if (!rateLimitSuccess) return rateLimitResponse!;

    const rawBody = await request.json().catch(() => null);
    const validated = validateBody(coverCandidatesSchema, rawBody);
    if (!validated.success) return validated.response;
    const { title, issueNumber } = validated.data;

    // Step 1: Check community database
    const communityUrl = await getCommunityCovers(title, issueNumber);
    if (communityUrl) {
      return NextResponse.json({
        source: "community",
        candidates: [{ url: communityUrl, title: "Community cover", source: "community" }],
        searchQuery: null,
      });
    }

    // Step 2: No external image-search API available. Return candidates
    // directly (community covers + Open Library fallback handled client-side).
    // The prior Haiku "generate search query" call was removed — its output was
    // unused except as telemetry, so it was pure cost with no benefit.
    const candidates: CoverCandidate[] = [];

    return NextResponse.json({
      source: "search",
      candidates,
      searchQuery: null,
    });
  } catch (error) {
    console.error("Cover candidates error:", error);
    return NextResponse.json(
      { error: "Failed to search for cover images" },
      { status: 500 }
    );
  }
}
