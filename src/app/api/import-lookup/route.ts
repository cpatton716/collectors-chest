import { NextResponse } from "next/server";

import Anthropic from "@anthropic-ai/sdk";

import { getComicMetadata, saveComicMetadata } from "@/lib/db";
import { MODEL_PRIMARY } from "@/lib/models";
import { recordScanAnalytics, estimateScanCostCents } from "@/lib/analyticsServer";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const { title, issueNumber, variant, publisher, releaseYear } = await request.json();

    if (!title || !issueNumber) {
      return NextResponse.json(
        { error: "Both title and issue number are needed to look up comic details." },
        { status: 400 }
      );
    }

    const normalizedTitle = title.trim();
    const normalizedIssue = issueNumber.toString().trim();

    // 1. Check database first (fast lookup)
    try {
      const dbResult = await getComicMetadata(normalizedTitle, normalizedIssue);
      if (dbResult) {
        // Return in the format expected by CSV import (no AI pricing — eBay Browse API handles pricing)
        return NextResponse.json({
          priceData: null,
          keyInfo: dbResult.keyInfo || [],
          // Also return metadata for enriching imports
          writer: dbResult.writer,
          coverArtist: dbResult.coverArtist,
          interiorArtist: dbResult.interiorArtist,
          publisher: dbResult.publisher,
          releaseYear: dbResult.releaseYear,
          coverImageUrl: dbResult.coverImageUrl,
          source: "database",
        });
      }
    } catch (dbError) {
      console.error("[import-lookup] Database lookup failed:", dbError);
      // Continue to AI lookup
    }

    // 2. Fall back to Claude API

    // Build the comic identifier string
    const comicIdentifier = `${title} #${issueNumber}${variant ? ` (${variant})` : ""}${publisher ? ` - ${publisher}` : ""}${releaseYear ? ` (${releaseYear})` : ""}`;

    // Use Claude to get metadata and key info (pricing now handled by eBay Browse API)
    const message = await anthropic.messages.create({
      model: MODEL_PRIMARY,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `You are a comic book expert. For the following comic, provide:

Comic: ${comicIdentifier}

Return ONLY a JSON object:
{
  "publisher": "Publisher Name" or null,
  "releaseYear": "YYYY" or null,
  "writer": "Writer Name" or null,
  "coverArtist": "Artist Name" or null,
  "interiorArtist": "Artist Name" or null,
  "keyInfo": ["MAJOR key facts only - empty if none"]
}

For keyInfo, ONLY include facts that significantly impact collector value:
- First appearances of MAJOR characters
- Major storyline events (e.g., "Death of Superman")
- Origin stories of major characters
- Creator milestones

Most issues should have an empty keyInfo array.`,
        },
      ],
    });

    let keyInfo: string[] = [];
    let writer = null;
    let coverArtist = null;
    let interiorArtist = null;
    let detectedPublisher = publisher || null;
    let detectedYear = releaseYear || null;

    // Parse Claude's response
    const responseText = message.content[0].type === "text" ? message.content[0].text : "";

    try {
      // Extract JSON from response
      let jsonText = responseText.trim();
      if (jsonText.startsWith("```json")) jsonText = jsonText.slice(7);
      if (jsonText.startsWith("```")) jsonText = jsonText.slice(3);
      if (jsonText.endsWith("```")) jsonText = jsonText.slice(0, -3);

      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Extract metadata
        writer = parsed.writer || null;
        coverArtist = parsed.coverArtist || null;
        interiorArtist = parsed.interiorArtist || null;
        detectedPublisher = parsed.publisher || publisher || null;
        detectedYear = parsed.releaseYear || releaseYear || null;

        if (Array.isArray(parsed.keyInfo)) {
          keyInfo = parsed.keyInfo;
        }

        // Save metadata to database for future lookups (non-blocking, no price data)
        saveComicMetadata({
          title: normalizedTitle,
          issueNumber: normalizedIssue,
          publisher: detectedPublisher,
          releaseYear: detectedYear,
          writer,
          coverArtist,
          interiorArtist,
          keyInfo,
        }).catch((err) => {
          console.error("[import-lookup] Failed to save to database:", err);
        });
      }
    } catch {}

    // Record scan analytics (fire-and-forget)
    const costCents = estimateScanCostCents({ metadataCacheHit: false, aiCallsMade: 1, ebayLookup: false });
    recordScanAnalytics({
      profile_id: null,
      scan_method: "import-lookup",
      estimated_cost_cents: costCents,
      ai_calls_made: 1,
      metadata_cache_hit: false,
      ebay_lookup: false,
      duration_ms: Date.now() - startTime,
      success: true,
      subscription_tier: "guest",
    }).catch(() => {});

    return NextResponse.json({
      priceData: null,
      keyInfo,
      writer,
      coverArtist,
      interiorArtist,
      publisher: detectedPublisher,
      releaseYear: detectedYear,
      coverImageUrl: null,
      source: "ai",
    });
  } catch (error) {
    console.error("Import lookup error:", error);
    return NextResponse.json(
      {
        error:
          "We couldn't look up details for this comic. The import will continue with the data you provided.",
      },
      { status: 500 }
    );
  }
}