import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { validateBody } from "@/lib/validation";

// Cover-search fallback route.
// Despite the name, this does NOT call an image-search API. It builds a Google
// Images search URL from the title/issue/publisher and returns it so the user
// can find a cover manually. `coverUrls` is always returned empty (Open Library
// lookup was removed Session 45 for low single-issue accuracy).
// Note: overlaps with /api/cover-candidates — candidate for consolidation
// post-launch.

const coverSearchSchema = z.object({
  title: z.string().trim().min(1, "Please enter a comic title to search for covers.").max(200),
  issueNumber: z
    .union([z.string(), z.number()])
    .transform((v) => (v === undefined || v === null ? "" : String(v)))
    .optional()
    .nullable(),
  publisher: z.string().trim().max(100).optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => null);
    const validated = validateBody(coverSearchSchema, rawBody);
    if (!validated.success) return validated.response;
    const { title, issueNumber, publisher } = validated.data;

    // Build search query
    const searchQuery =
      `${title} ${issueNumber ? `#${issueNumber}` : ""} ${publisher || ""} comic book cover`.trim();

    // Return a Google Images search URL that the user can use to find a cover
    // manually. Open Library was previously consulted here for graphic-novel
    // hits but had low single-issue accuracy and the response field
    // (`coverUrls`) was never read by the consuming UI — removed Session 45.
    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=isch`;

    return NextResponse.json({
      coverUrls: [],
      searchUrl: googleSearchUrl,
      message: "No covers found. Use the search link to find covers manually.",
    });
  } catch (error) {
    console.error("Error searching for covers:", error);
    return NextResponse.json(
      { error: "We couldn't search for covers right now. Please try again." },
      { status: 500 }
    );
  }
}
