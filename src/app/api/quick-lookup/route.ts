import { NextRequest, NextResponse } from "next/server";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { getComicMetadata, saveComicMetadata } from "@/lib/db";
import { MODEL_PRIMARY } from "@/lib/models";
import { normalizeTitle, normalizeIssueNumber } from "@/lib/normalizeTitle";
import { recordScanAnalytics, estimateScanCostCents } from "@/lib/analyticsServer";
import { checkRateLimit, getRateLimitIdentifier, rateLimiters } from "@/lib/rateLimit";
import { validateBody } from "@/lib/validation";

const quickLookupSchema = z.object({
  barcode: z
    .string()
    .trim()
    .min(8, "Barcode must be at least 8 digits")
    .max(17, "Barcode is too long")
    .regex(/^[\d\s-]+$/, "Barcode must contain only digits"),
});

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

    const rawBody = await request.json().catch(() => null);
    const validated = validateBody(quickLookupSchema, rawBody);
    if (!validated.success) return validated.response;
    const { barcode } = validated.data;

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

    const normalizedTitle = normalizeTitle(comicDetails.title || '');
    const normalizedIssue = normalizeIssueNumber(comicDetails.issueNumber || '1');

    // Step 2: Check database for cached data first
    try {
      const dbResult = await getComicMetadata(normalizedTitle, normalizedIssue);
      if (dbResult && dbResult.priceData) {
        // Transition guard: only return eBay-sourced price data
        const dbPriceSource = (dbResult.priceData as Record<string, unknown>)?.priceSource;
        const safePriceData = dbPriceSource === 'ebay' ? {
          estimatedValue: dbResult.priceData.estimatedValue,
          recentSales: dbResult.priceData.recentSales || [],
          mostRecentSale: dbResult.priceData.recentSales?.[0] || null,
          mostRecentSaleDate: dbResult.priceData.mostRecentSaleDate,
          isAveraged: true,
          disclaimer: null,
          gradeEstimates: dbResult.priceData.gradeEstimates,
          baseGrade: 9.4,
        } : null;

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
            priceData: safePriceData,
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

    // Lookup key info only (pricing now handled by eBay Browse API)
    const lookupResponse = await anthropic.messages.create({
      model: MODEL_PRIMARY,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `You are a comic book expert. For "${comicDetails.title}" issue #${comicDetails.issueNumber} (${comicDetails.publisher || "Unknown"}, ${comicDetails.releaseYear || "Unknown"}):

Provide key facts as JSON:
{
  "keyInfo": ["MAJOR key facts only - empty array if none"]
}

Rules:
- keyInfo: ONLY major first appearances, major storyline events, origin stories, iconic costume/item debuts, iconic cover art, or creator milestones. Empty array for regular issues.
- Return ONLY the JSON object, no other text.`,
        },
      ],
    });

    let keyInfo: string[] = [];

    const textContent = lookupResponse.content.find((block) => block.type === "text");
    if (textContent && textContent.type === "text") {
      let jsonText = textContent.text.trim();
      if (jsonText.startsWith("```json")) jsonText = jsonText.slice(7);
      if (jsonText.startsWith("```")) jsonText = jsonText.slice(3);
      if (jsonText.endsWith("```")) jsonText = jsonText.slice(0, -3);

      try {
        const parsed = JSON.parse(jsonText.trim());
        keyInfo = parsed.keyInfo || [];

        // Save keyInfo to database for future lookups
        if (comicDetails.title && comicDetails.issueNumber) {
          try {
            await saveComicMetadata({
              title: normalizedTitle,
              issueNumber: normalizedIssue,
              publisher: comicDetails.publisher,
              releaseYear: comicDetails.releaseYear,
              ...(comicDetails.coverImageUrl ? {
                coverImageUrl: comicDetails.coverImageUrl,
                coverSource: "comicvine",
                coverValidated: false,
              } : {}),
              keyInfo,
            });
          } catch (err) {
            console.error("[quick-lookup] Failed to save metadata:", err);
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
        priceData: null,
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
