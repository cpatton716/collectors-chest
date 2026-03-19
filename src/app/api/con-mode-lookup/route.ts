import { NextRequest, NextResponse } from "next/server";

import Anthropic from "@anthropic-ai/sdk";

import { getComicMetadata, incrementComicLookupCount, saveComicMetadata } from "@/lib/db";
import { MODEL_PRIMARY } from "@/lib/models";
import { recordScanAnalytics, estimateScanCostCents } from "@/lib/analyticsServer";
import { isBrowseApiConfigured, searchActiveListings, convertBrowseToPriceData } from "@/lib/ebayBrowse";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// NOTE: In-memory caching removed - doesn't work in serverless environments
// Each invocation gets a fresh process, so Map cache never hits.
// Rely on database cache (getComicMetadata) which persists across requests.

interface ConModeLookupResult {
  title: string;
  issueNumber: string;
  publisher: string | null;
  releaseYear: string | null;
  grade: number;
  averagePrice: number | null;
  recentSale: { price: number; date: string } | null;
  gradeEstimates: Array<{
    grade: number;
    label: string;
    rawValue: number;
    slabbedValue: number;
  }>;
  keyInfo: string[];
  coverImageUrl: string | null;
  source: "database" | "ebay";
  disclaimer: string;
  totalListings?: number;
  ebaySearchQuery?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let aiCallsMade = 0;

  try {
    const { title, issueNumber, grade, years } = await request.json();

    if (!title || !issueNumber) {
      return NextResponse.json({ error: "Title and issue number are required." }, { status: 400 });
    }

    const normalizedTitle = title.trim();
    const normalizedIssue = issueNumber.toString().trim();
    const selectedGrade = grade || 9.4;
    const seriesYears = years?.trim() || null; // e.g., "1963-2011" for disambiguation

    // 1. Check database cache (fast ~50ms)
    try {
      const dbResult = await getComicMetadata(normalizedTitle, normalizedIssue);
      if (dbResult && dbResult.priceData && dbResult.priceData.priceSource === 'ebay') {
        // Get price for the selected grade from cached grade estimates
        const gradeEstimate = dbResult.priceData.gradeEstimates?.find(
          (g) => g.grade === selectedGrade
        );

        const result: ConModeLookupResult = {
          title: dbResult.title,
          issueNumber: dbResult.issueNumber,
          publisher: dbResult.publisher,
          releaseYear: dbResult.releaseYear,
          grade: selectedGrade,
          averagePrice: gradeEstimate?.rawValue || dbResult.priceData.estimatedValue || null,
          recentSale: dbResult.priceData.recentSales?.[0] || null,
          gradeEstimates: dbResult.priceData.gradeEstimates || [],
          keyInfo: dbResult.keyInfo || [],
          coverImageUrl: dbResult.coverImageUrl,
          source: "database",
          disclaimer: dbResult.priceData.disclaimer || "Based on current eBay listings",
        };

        // Increment lookup count (non-blocking)
        incrementComicLookupCount(normalizedTitle, normalizedIssue).catch(() => {});

        return NextResponse.json(result);
      }
    } catch (dbError) {
      console.error("[con-mode-lookup] Database lookup failed, falling back to eBay:", dbError);
      // Continue to eBay lookup
    }

    // 2. Tracking variables for response metadata
    let totalListings: number | undefined;
    let ebaySearchQuery: string | undefined;

    // 3. Try eBay Browse API for active listing data
    let ebayPriceData: ReturnType<typeof convertBrowseToPriceData> = null;

    if (isBrowseApiConfigured()) {
      try {
        const browseResult = await searchActiveListings(
          normalizedTitle,
          normalizedIssue,
          String(selectedGrade),
          false, // raw comics by default for con mode
        );

        if (browseResult) {
          const priceData = convertBrowseToPriceData(browseResult, String(selectedGrade), false);
          if (priceData) {
            ebayPriceData = priceData;
          }

          if (!priceData && browseResult.totalResults > 0) {
            // Below threshold — pass listing count so UI can show "X active listings found"
            totalListings = browseResult.totalResults;
            ebaySearchQuery = browseResult.searchQuery;
          }
        }
      } catch (ebayError) {
        console.error("[con-mode-lookup] eBay Browse lookup failed:", ebayError);
      }
    }

    if (ebayPriceData && ebayPriceData.estimatedValue) {
      // Get the price for the selected grade
      const gradeEstimate = ebayPriceData.gradeEstimates?.find(
        (g) => g.grade === selectedGrade
      );

      // Try to fetch a cover image (non-blocking)
      let coverImageUrl: string | null = null;
      try {
        coverImageUrl = await fetchCoverImage(normalizedTitle, normalizedIssue, undefined, seriesYears?.match(/\d{4}/)?.[0]);
      } catch {
        // Ignore cover fetch errors
      }

      // We need key info from AI since eBay doesn't provide that
      let keyInfo: string[] = [];
      try {
        keyInfo = await fetchKeyInfoFromAI(normalizedTitle, normalizedIssue);
        aiCallsMade++;
      } catch {
        // Ignore key info errors
      }

      const result: ConModeLookupResult = {
        title: normalizedTitle,
        issueNumber: normalizedIssue,
        publisher: null, // eBay doesn't provide this reliably
        releaseYear: null,
        grade: selectedGrade,
        averagePrice: gradeEstimate?.rawValue || ebayPriceData.estimatedValue,
        recentSale: ebayPriceData.recentSales?.[0] || null,
        gradeEstimates: ebayPriceData.gradeEstimates || [],
        keyInfo,
        coverImageUrl,
        source: "ebay",
        disclaimer: ebayPriceData.disclaimer || "Based on current eBay listings",
      };

      // Save to database for future lookups
      saveComicMetadata({
        title: normalizedTitle,
        issueNumber: normalizedIssue,
        publisher: null,
        releaseYear: null,
        coverImageUrl,
        keyInfo,
        priceData: {
          estimatedValue: ebayPriceData.estimatedValue,
          mostRecentSaleDate: ebayPriceData.mostRecentSaleDate,
          recentSales: ebayPriceData.recentSales || [],
          gradeEstimates: ebayPriceData.gradeEstimates || [],
          disclaimer: ebayPriceData.disclaimer || "Based on current eBay listings",
          priceSource: "ebay",
        },
      }).catch((err) => {
        console.error("[con-mode-lookup] Failed to save eBay data to database:", err);
      });

      // Record scan analytics (fire-and-forget)
      const ebayCostCents = estimateScanCostCents({ metadataCacheHit: false, aiCallsMade, ebayLookup: true });
      recordScanAnalytics({
        profile_id: null,
        scan_method: "con-mode-lookup",
        estimated_cost_cents: ebayCostCents,
        ai_calls_made: aiCallsMade,
        metadata_cache_hit: false,
        ebay_lookup: true,
        duration_ms: Date.now() - startTime,
        success: true,
        subscription_tier: "guest",
      }).catch(() => {});

      return NextResponse.json(result);
    }

    // 4. No eBay data available — return null priceData with listing metadata
    const result: ConModeLookupResult = {
      title: normalizedTitle,
      issueNumber: normalizedIssue,
      publisher: null,
      releaseYear: null,
      grade: selectedGrade,
      averagePrice: null,
      recentSale: null,
      gradeEstimates: [],
      keyInfo: [],
      coverImageUrl: null,
      source: "ebay",
      disclaimer: "No pricing data available at this time.",
      totalListings,
      ebaySearchQuery,
    };

    // Record scan analytics (fire-and-forget)
    const noCostCents = estimateScanCostCents({ metadataCacheHit: false, aiCallsMade: 0, ebayLookup: true });
    recordScanAnalytics({
      profile_id: null,
      scan_method: "con-mode-lookup",
      estimated_cost_cents: noCostCents,
      ai_calls_made: 0,
      metadata_cache_hit: false,
      ebay_lookup: true,
      duration_ms: Date.now() - startTime,
      success: false,
      subscription_tier: "guest",
    }).catch(() => {});

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in con mode lookup:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

/**
 * Try to fetch a cover image URL for the comic
 * Uses multiple sources with fallbacks
 */
async function fetchCoverImage(
  title: string,
  issueNumber: string,
  publisher?: string,
  releaseYear?: string | null
): Promise<string | null> {
  // Try Comic Vine API if we have a key
  if (process.env.COMIC_VINE_API_KEY) {
    try {
      const searchQuery = releaseYear
        ? `${title} ${issueNumber} ${releaseYear}`
        : `${title} ${issueNumber}`;
      const cvResponse = await fetch(
        `https://comicvine.gamespot.com/api/search/?api_key=${process.env.COMIC_VINE_API_KEY}&format=json&query=${encodeURIComponent(searchQuery)}&resources=issue&limit=1`,
        { headers: { "User-Agent": "CollectorsChest/1.0" } }
      );

      if (cvResponse.ok) {
        const cvData = await cvResponse.json();
        if (cvData.results?.[0]?.image?.medium_url) {
          return cvData.results[0].image.medium_url;
        }
      }
    } catch (e) {}
  }

  // Fallback: Try Open Library (works better for graphic novels)
  try {
    const searchQuery = `${title} ${issueNumber} ${publisher || ""} comic`.trim();
    const olResponse = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(searchQuery)}&limit=3`,
      { signal: AbortSignal.timeout(3000) }
    );

    if (olResponse.ok) {
      const olData = await olResponse.json();
      const docWithCover = olData.docs?.find((doc: { cover_i?: number }) => doc.cover_i);
      if (docWithCover?.cover_i) {
        return `https://covers.openlibrary.org/b/id/${docWithCover.cover_i}-L.jpg`;
      }
    }
  } catch (e) {}

  return null;
}

/**
 * Fetch key collector information from AI
 * Used when eBay provides pricing but we still need key facts
 */
async function fetchKeyInfoFromAI(title: string, issueNumber: string): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return [];
  }

  try {
    const response = await anthropic.messages.create({
      model: MODEL_PRIMARY,
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `For "${title}" issue #${issueNumber}, list ONLY major key collector facts (first appearances, deaths, major storyline events). Return a JSON array of strings. If this is not a key issue, return an empty array []. Return ONLY the JSON array, no other text.`,
        },
      ],
    });

    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      return [];
    }

    let jsonText = textContent.text.trim();
    if (jsonText.startsWith("```json")) jsonText = jsonText.slice(7);
    if (jsonText.startsWith("```")) jsonText = jsonText.slice(3);
    if (jsonText.endsWith("```")) jsonText = jsonText.slice(0, -3);

    const parsed = JSON.parse(jsonText.trim());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
