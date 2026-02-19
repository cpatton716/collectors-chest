import { NextResponse } from "next/server";

import Anthropic from "@anthropic-ai/sdk";

import { getComicMetadata, saveComicMetadata } from "@/lib/db";
import { MODEL_PRIMARY } from "@/lib/models";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
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
        // Return in the format expected by CSV import
        return NextResponse.json({
          priceData: dbResult.priceData
            ? {
                estimatedValue: dbResult.priceData.estimatedValue,
                recentSales: dbResult.priceData.recentSales || [],
                mostRecentSaleDate: dbResult.priceData.mostRecentSaleDate,
                isAveraged: false,
                disclaimer:
                  dbResult.priceData.disclaimer ||
                  "Values are estimates based on market knowledge.",
                gradeEstimates: dbResult.priceData.gradeEstimates,
              }
            : null,
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

    // Use Claude to get full details including price data
    const message = await anthropic.messages.create({
      model: MODEL_PRIMARY,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a comic book expert and pricing specialist. For the following comic, provide:

Comic: ${comicIdentifier}

Return ONLY a JSON object:
{
  "publisher": "Publisher Name" or null,
  "releaseYear": "YYYY" or null,
  "writer": "Writer Name" or null,
  "coverArtist": "Artist Name" or null,
  "interiorArtist": "Artist Name" or null,
  "estimatedValue": number (average price for 9.4 raw copy) or null,
  "keyInfo": ["MAJOR key facts only - empty if none"],
  "gradeEstimates": [
    { "grade": 9.8, "label": "Near Mint/Mint", "rawValue": price, "slabbedValue": price },
    { "grade": 9.4, "label": "Near Mint", "rawValue": price, "slabbedValue": price },
    { "grade": 8.0, "label": "Very Fine", "rawValue": price, "slabbedValue": price },
    { "grade": 6.0, "label": "Fine", "rawValue": price, "slabbedValue": price },
    { "grade": 4.0, "label": "Very Good", "rawValue": price, "slabbedValue": price },
    { "grade": 2.0, "label": "Good", "rawValue": price, "slabbedValue": price }
  ]
}

For keyInfo, ONLY include facts that significantly impact collector value:
- First appearances of MAJOR characters
- Major storyline events (e.g., "Death of Superman")
- Origin stories of major characters
- Creator milestones

Most issues should have an empty keyInfo array.
Be realistic with prices based on typical eBay sold listings.`,
        },
      ],
    });

    let priceData = null;
    let keyInfo: string[] = [];
    let writer = null;
    let coverArtist = null;
    let interiorArtist = null;
    let detectedPublisher = publisher || null;
    let detectedYear = releaseYear || null;
    let gradeEstimates: { grade: number; label: string; rawValue: number; slabbedValue: number }[] =
      [];

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
        gradeEstimates = Array.isArray(parsed.gradeEstimates) ? parsed.gradeEstimates : [];

        if (parsed.estimatedValue !== null && typeof parsed.estimatedValue === "number") {
          priceData = {
            estimatedValue: parsed.estimatedValue,
            recentSales: [],
            mostRecentSaleDate: null,
            isAveraged: false,
            disclaimer: "Values are estimates based on market knowledge. Actual prices may vary.",
            gradeEstimates,
          };
        }

        if (Array.isArray(parsed.keyInfo)) {
          keyInfo = parsed.keyInfo;
        }

        // 3. Save to database for future lookups (non-blocking)
        saveComicMetadata({
          title: normalizedTitle,
          issueNumber: normalizedIssue,
          publisher: detectedPublisher,
          releaseYear: detectedYear,
          writer,
          coverArtist,
          interiorArtist,
          keyInfo,
          priceData: priceData
            ? {
                estimatedValue: priceData.estimatedValue,
                mostRecentSaleDate: null,
                recentSales: [],
                gradeEstimates,
                disclaimer: priceData.disclaimer,
              }
            : undefined,
        }).catch((err) => {
          console.error("[import-lookup] Failed to save to database:", err);
        });
      }
    } catch {}

    // 4. Try to fetch cover image (non-blocking, best effort)
    let coverImageUrl: string | null = null;
    try {
      coverImageUrl = await fetchCoverImage(normalizedTitle, normalizedIssue, detectedPublisher);
    } catch {}

    return NextResponse.json({
      priceData,
      keyInfo,
      writer,
      coverArtist,
      interiorArtist,
      publisher: detectedPublisher,
      releaseYear: detectedYear,
      coverImageUrl,
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

/**
 * Try to fetch a cover image URL for the comic
 * Uses Comic Vine API with validation to ensure we get the right comic
 */
async function fetchCoverImage(
  title: string,
  issueNumber: string,
  publisher?: string | null
): Promise<string | null> {
  // Normalize title for comparison (lowercase, remove special chars)
  const normalizeForCompare = (str: string) =>
    str.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedTitle = normalizeForCompare(title);
  const normalizedIssue = issueNumber.replace(/^#/, "").trim();

  // Try Comic Vine API if we have a key
  if (process.env.COMIC_VINE_API_KEY) {
    try {
      // Search with just the title first for better results
      const cvResponse = await fetch(
        `https://comicvine.gamespot.com/api/search/?api_key=${process.env.COMIC_VINE_API_KEY}&format=json&query=${encodeURIComponent(title)}&resources=issue&limit=10`,
        {
          headers: { "User-Agent": "CollectorsChest/1.0" },
          signal: AbortSignal.timeout(5000),
        }
      );

      if (cvResponse.ok) {
        const cvData = await cvResponse.json();
        if (cvData.results && cvData.results.length > 0) {
          // Find a result that matches both title and issue number
          for (const result of cvData.results) {
            const volumeName = result.volume?.name || "";
            const resultIssue = result.issue_number || "";
            const normalizedVolume = normalizeForCompare(volumeName);

            // Check if volume name contains our title and issue matches
            if (
              normalizedVolume.includes(normalizedTitle) ||
              normalizedTitle.includes(normalizedVolume)
            ) {
              // Issue number must match
              if (String(resultIssue) === normalizedIssue) {
                if (result.image?.medium_url) {
                  return result.image.medium_url;
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("[import-lookup] Comic Vine error:", err);
    }
  }

  // No fallback to Open Library - better to have no cover than wrong cover
  return null;
}
