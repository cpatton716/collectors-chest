import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Redis } from "@upstash/redis";
import { z } from "zod";
import { MODEL_LIGHTWEIGHT } from "@/lib/models";
import { getCommunityCovers } from "@/lib/coverImageDb";
import { validateBody } from "@/lib/validation";

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

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const redis = Redis.fromEnv();

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
        content: `You are a comic book expert. Generate the best image search query to find the COVER IMAGE of this comic book. Include era-specific details, key visual elements, or notable cover artists if you know them. Return ONLY the search query string, nothing else.

${context}`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text.trim() : "";

  const today = new Date().toISOString().split("T")[0];
  try {
    await redis.incr(`usage:cover-haiku:${today}`);
    await redis.expire(`usage:cover-haiku:${today}`, 86400 * 2);
  } catch {}

  // Strip quotes if Claude wraps the query
  return text.replace(/^["']|["']$/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => null);
    const validated = validateBody(coverCandidatesSchema, rawBody);
    if (!validated.success) return validated.response;
    const { title, issueNumber, publisher, releaseYear } = validated.data;

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
      publisher ?? undefined,
      releaseYear ?? undefined
    );

    // No external image search API available. Relies on community covers + Open Library fallback.
    const candidates: CoverCandidate[] = [];

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
