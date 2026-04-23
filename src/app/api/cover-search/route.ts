import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { validateBody } from "@/lib/validation";

// Comic Vine API for cover images
// Note: You'll need a Comic Vine API key for production use
// For now, we'll use a fallback approach

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

    // For now, return a Google Images search URL that the user can use
    // In production, you'd integrate with Comic Vine API or similar
    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=isch`;

    // Try to fetch from Open Library (free, no API key needed)
    // This works better for graphic novels/collected editions
    const openLibraryUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(title)}&limit=5`;

    let coverUrls: string[] = [];

    try {
      const olResponse = await fetch(openLibraryUrl);
      if (olResponse.ok) {
        const olData = await olResponse.json();
        coverUrls = olData.docs
          .filter((doc: { cover_i?: number }) => doc.cover_i)
          .slice(0, 5)
          .map(
            (doc: { cover_i: number }) => `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
          );
      }
    } catch {}

    return NextResponse.json({
      coverUrls,
      searchUrl: googleSearchUrl,
      message:
        coverUrls.length > 0
          ? "Found potential covers"
          : "No covers found. Use the search link to find covers manually.",
    });
  } catch (error) {
    console.error("Error searching for covers:", error);
    return NextResponse.json(
      { error: "We couldn't search for covers right now. Please try again." },
      { status: 500 }
    );
  }
}
