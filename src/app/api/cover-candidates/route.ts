import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { MODEL_LIGHTWEIGHT } from "@/lib/models";
import { getCommunityCovers } from "@/lib/coverImageDb";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface CoverCandidate {
  url: string;
  title: string;
  source: string;
}

async function generateSearchQuery(
  title: string,
  issueNumber: string,
  publisher?: string,
  releaseYear?: string
): Promise<string> {
  const context = [
    `Comic: ${title} #${issueNumber}`,
    publisher && `Publisher: ${publisher}`,
    releaseYear && `Year: ${releaseYear}`,
  ]
    .filter(Boolean)
    .join(", ");

  const message = await anthropic.messages.create({
    model: MODEL_LIGHTWEIGHT,
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content: `You are a comic book expert. Generate the best Google Image search query to find the COVER IMAGE of this comic book. Include era-specific details, key visual elements, or notable cover artists if you know them. Return ONLY the search query string, nothing else.

${context}`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text.trim() : "";
  // Strip quotes if Claude wraps the query
  return text.replace(/^["']|["']$/g, "");
}

async function searchGoogleImages(
  query: string
): Promise<CoverCandidate[]> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;

  if (!apiKey || !cx) {
    console.warn("Google CSE not configured — skipping image search");
    return [];
  }

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("searchType", "image");
  url.searchParams.set("num", "8");
  url.searchParams.set("imgType", "photo");
  url.searchParams.set("safe", "active");

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    console.error("Google CSE error:", response.status, await response.text());
    return [];
  }

  const data = await response.json();
  if (!data.items || !Array.isArray(data.items)) return [];

  return data.items.map(
    (item: { link: string; title: string; displayLink: string }) => ({
      url: item.link,
      title: item.title || "",
      source: item.displayLink || "google",
    })
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, issueNumber, publisher, releaseYear } = body;

    if (!title || !issueNumber) {
      return NextResponse.json(
        { error: "title and issueNumber are required" },
        { status: 400 }
      );
    }

    // Step 1: Check community database
    const communityUrl = await getCommunityCovers(title, issueNumber);
    if (communityUrl) {
      return NextResponse.json({
        source: "community",
        candidates: [{ url: communityUrl, title: "Community cover", source: "community" }],
        searchQuery: null,
      });
    }

    // Step 2: Claude generates search query
    const searchQuery = await generateSearchQuery(
      title,
      issueNumber,
      publisher,
      releaseYear
    );

    // Step 3: Google Custom Search
    const candidates = await searchGoogleImages(searchQuery);

    return NextResponse.json({
      source: "search",
      candidates,
      searchQuery,
    });
  } catch (error) {
    console.error("Cover candidates error:", error);
    return NextResponse.json(
      { error: "Failed to search for cover images" },
      { status: 500 }
    );
  }
}
