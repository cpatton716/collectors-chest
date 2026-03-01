import { NextRequest, NextResponse } from "next/server";

import Anthropic from "@anthropic-ai/sdk";

import { getComicMetadata, saveComicMetadata } from "@/lib/db";
import { MODEL_PRIMARY } from "@/lib/models";
import { recordScanAnalytics, estimateScanCostCents } from "@/lib/analyticsServer";
import { checkRateLimit, getRateLimitIdentifier, rateLimiters } from "@/lib/rateLimit";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const COMIC_VINE_API_KEY = process.env.COMIC_VINE_API_KEY;
const COMIC_VINE_BASE_URL = "https://comicvine.gamespot.com/api";

interface ComicVineIssue {
  id: number;
  name: string | null;
  issue_number: string;
  cover_date: string | null;
  image: {
    original_url: string;
    medium_url: string;
    thumb_url: string;
  } | null;
  volume: {
    id: number;
    name: string;
    publisher?: {
      name: string;
    };
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Rate limit to protect Anthropic API costs
    const identifier = getRateLimitIdentifier(
      null,
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")
    );
    const { success: rateLimitSuccess, response: rateLimitResponse } = await checkRateLimit(
      rateLimiters.lookup,
      identifier
    );
    if (!rateLimitSuccess) return rateLimitResponse;

    const { barcode } = await request.json();

    if (!barcode) {
      return NextResponse.json(
        {
          error:
            "No barcode was detected. Please try scanning again with the barcode clearly visible.",
        },
        { status: 400 }
      );
    }

    // Step 1: Look up comic details from Comic Vine
    let comicDetails: {
      title: string | null;
      issueNumber: string | null;
      publisher: string | null;
      releaseYear: string | null;
      variant: string | null;
      coverImageUrl: string | null;
    } | null = null;

    if (COMIC_VINE_API_KEY) {
      const upcWithoutCheckDigit = barcode.slice(0, -1);
      const searchUrl = `${COMIC_VINE_BASE_URL}/issues/?api_key=${COMIC_VINE_API_KEY}&format=json&filter=upc:${upcWithoutCheckDigit}&field_list=id,name,issue_number,cover_date,image,volume`;

      const response = await fetch(searchUrl, {
        headers: { "User-Agent": "ComicTracker/1.0" },
      });

      if (response.ok) {
        const data = await response.json();

        if (data.error === "OK" && data.results && data.results.length > 0) {
          const issue: ComicVineIssue = data.results[0];
          comicDetails = {
            title: issue.volume?.name || null,
            issueNumber: issue.issue_number || null,
            publisher: issue.volume?.publisher?.name || null,
            releaseYear: issue.cover_date ? issue.cover_date.split("-")[0] : null,
            variant: null,
            coverImageUrl: issue.image?.medium_url || issue.image?.original_url || null,
          };
        }
      }
    }

    if (!comicDetails || !comicDetails.title) {
      return NextResponse.json(
        {
          error:
            "We couldn't find this comic by barcode. This sometimes happens with older or variant issues. Try scanning the cover instead!",
        },
        { status: 404 }
      );
    }

    // Step 2: Check database for cached data first
    try {
      const dbResult = await getComicMetadata(comicDetails.title, comicDetails.issueNumber || "1");
      if (dbResult && dbResult.priceData) {
        return NextResponse.json({
          comic: {
            id: `quick-${Date.now()}`,
            title: comicDetails.title,
            issueNumber: comicDetails.issueNumber,
            variant: comicDetails.variant,
            publisher: dbResult.publisher || comicDetails.publisher,
            releaseYear: dbResult.releaseYear || comicDetails.releaseYear,
            confidence: "high" as const,
            isSlabbed: false,
            gradingCompany: null,
            grade: null,
            isSignatureSeries: false,
            signedBy: null,
            keyInfo: dbResult.keyInfo || [],
            priceData: {
              estimatedValue: dbResult.priceData.estimatedValue,
              recentSales: dbResult.priceData.recentSales || [],
              mostRecentSale: dbResult.priceData.recentSales?.[0] || null,
              mostRecentSaleDate: dbResult.priceData.mostRecentSaleDate,
              isAveraged: true,
              disclaimer: "Values are estimates based on market knowledge.",
              gradeEstimates: dbResult.priceData.gradeEstimates,
              baseGrade: 9.4,
            },
            writer: dbResult.writer,
            coverArtist: dbResult.coverArtist,
            interiorArtist: dbResult.interiorArtist,
          },
          coverImageUrl: dbResult.coverImageUrl || comicDetails.coverImageUrl,
          source: "database",
        });
      }
    } catch (dbError) {
      console.error("[quick-lookup] Database lookup failed:", dbError);
      // Continue to AI lookup
    }

    // Step 3: Fall back to Claude for key info and price data

    if (!process.env.ANTHROPIC_API_KEY) {
      // Return what we have without price data
      return NextResponse.json({
        comic: {
          id: `quick-${Date.now()}`,
          ...comicDetails,
          confidence: "high" as const,
          isSlabbed: false,
          gradingCompany: null,
          grade: null,
          isSignatureSeries: false,
          signedBy: null,
          keyInfo: [],
          priceData: null,
          writer: null,
          coverArtist: null,
          interiorArtist: null,
        },
        coverImageUrl: comicDetails.coverImageUrl,
      });
    }

    // Combined lookup for key info + prices (faster than separate calls)
    const lookupResponse = await anthropic.messages.create({
      model: MODEL_PRIMARY,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a comic book expert. For "${comicDetails.title}" issue #${comicDetails.issueNumber} (${comicDetails.publisher || "Unknown"}, ${comicDetails.releaseYear || "Unknown"}):

Provide key facts and estimated market values as JSON:
{
  "keyInfo": ["MAJOR key facts only - empty array if none"],
  "gradeEstimates": [
    { "grade": 9.8, "label": "Near Mint/Mint", "rawValue": price, "slabbedValue": price },
    { "grade": 9.4, "label": "Near Mint", "rawValue": price, "slabbedValue": price },
    { "grade": 8.0, "label": "Very Fine", "rawValue": price, "slabbedValue": price },
    { "grade": 6.0, "label": "Fine", "rawValue": price, "slabbedValue": price },
    { "grade": 4.0, "label": "Very Good", "rawValue": price, "slabbedValue": price },
    { "grade": 2.0, "label": "Good", "rawValue": price, "slabbedValue": price }
  ],
  "estimatedValue": number (9.4 raw value as default),
  "recentSale": { "price": number, "date": "YYYY-MM-DD" }
}

Rules:
- keyInfo: ONLY major first appearances, major storyline events, origin stories, iconic costume/item debuts, iconic cover art, or creator milestones. Empty array for regular issues.
- Prices: Realistic market values based on recent eBay sold listings. Key issues have larger grade spreads. Slabbed > raw by 10-30%.
- recentSale: Estimate a realistic most recent sale price and date (within last 30 days) for a 9.4 raw copy.
- Return ONLY the JSON object, no other text.`,
        },
      ],
    });

    let keyInfo: string[] = [];
    let priceData = null;

    const textContent = lookupResponse.content.find((block) => block.type === "text");
    if (textContent && textContent.type === "text") {
      let jsonText = textContent.text.trim();
      if (jsonText.startsWith("```json")) jsonText = jsonText.slice(7);
      if (jsonText.startsWith("```")) jsonText = jsonText.slice(3);
      if (jsonText.endsWith("```")) jsonText = jsonText.slice(0, -3);

      try {
        const parsed = JSON.parse(jsonText.trim());
        keyInfo = parsed.keyInfo || [];

        if (parsed.gradeEstimates) {
          priceData = {
            estimatedValue:
              parsed.estimatedValue ||
              parsed.gradeEstimates.find((g: { grade: number }) => g.grade === 9.4)?.rawValue ||
              null,
            recentSales: parsed.recentSale
              ? [{ price: parsed.recentSale.price, date: parsed.recentSale.date }]
              : [],
            mostRecentSale: parsed.recentSale || null,
            mostRecentSaleDate: parsed.recentSale?.date || null,
            isAveraged: true,
            disclaimer: "Technopathic estimates based on market knowledge. Actual prices may vary.",
            gradeEstimates: parsed.gradeEstimates,
            baseGrade: 9.4,
          };

          // Save to database for future lookups (non-blocking)
          if (comicDetails.title && comicDetails.issueNumber) {
            saveComicMetadata({
              title: comicDetails.title,
              issueNumber: comicDetails.issueNumber,
              publisher: comicDetails.publisher,
              releaseYear: comicDetails.releaseYear,
              coverImageUrl: comicDetails.coverImageUrl,
              keyInfo,
              priceData: {
                estimatedValue: priceData.estimatedValue || 0,
                mostRecentSaleDate: parsed.recentSale?.date || null,
                recentSales: parsed.recentSale ? [parsed.recentSale] : [],
                gradeEstimates: parsed.gradeEstimates || [],
                disclaimer: priceData.disclaimer,
              },
            }).catch((err) => {
              console.error("[quick-lookup] Failed to save to database:", err);
            });
          }
        }
      } catch {
        console.error("Failed to parse quick lookup response");
      }
    }

    // Record scan analytics (fire-and-forget, tracks ALL users including guests)
    const costCents = estimateScanCostCents({ metadataCacheHit: false, aiCallsMade: 1, ebayLookup: false });
    recordScanAnalytics({
      profile_id: null,
      scan_method: "quick-lookup",
      estimated_cost_cents: costCents,
      ai_calls_made: 1,
      metadata_cache_hit: false,
      ebay_lookup: false,
      duration_ms: Date.now() - startTime,
      success: true,
      subscription_tier: "guest",
    }).catch(() => {});

    return NextResponse.json({
      comic: {
        id: `quick-${Date.now()}`,
        title: comicDetails.title,
        issueNumber: comicDetails.issueNumber,
        variant: comicDetails.variant,
        publisher: comicDetails.publisher,
        releaseYear: comicDetails.releaseYear,
        confidence: "high" as const,
        isSlabbed: false,
        gradingCompany: null,
        grade: null,
        isSignatureSeries: false,
        signedBy: null,
        keyInfo,
        priceData,
        writer: null,
        coverArtist: null,
        interiorArtist: null,
      },
      coverImageUrl: comicDetails.coverImageUrl,
    });
  } catch (error) {
    console.error("Error in quick lookup:", error);
    return NextResponse.json(
      { error: "Something went wrong while looking up this comic. Please try again." },
      { status: 500 }
    );
  }
}
