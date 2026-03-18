import { NextRequest, NextResponse } from "next/server";

import Anthropic from "@anthropic-ai/sdk";

import { getComicMetadata, incrementComicLookupCount, saveComicMetadata } from "@/lib/db";
import { MODEL_PRIMARY } from "@/lib/models";
import { recordScanAnalytics, estimateScanCostCents } from "@/lib/analyticsServer";
import { isFindingApiConfigured, lookupEbaySoldPrices } from "@/lib/ebayFinding";

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
  source: "database" | "ebay" | "ai";
  disclaimer: string;
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
      if (dbResult && dbResult.priceData) {
        // Get price for the selected grade from cached grade estimates
        const gradeEstimate = dbResult.priceData.gradeEstimates?.find(
          (g) => g.grade === selectedGrade
        );

        // Preserve original price source so UI can show AI warnings
        const originalSource = dbResult.priceData.priceSource || "database";

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
          source: originalSource,
          disclaimer: dbResult.priceData.disclaimer || "Values are estimates based on market knowledge. Actual prices may vary.",
        };

        // Increment lookup count (non-blocking)
        incrementComicLookupCount(normalizedTitle, normalizedIssue).catch(() => {});

        return NextResponse.json(result);
      }
    } catch (dbError) {
      console.error("[con-mode-lookup] Database lookup failed, falling back to AI:", dbError);
      // Continue to AI lookup
    }

    // 3. Try eBay Finding API for real sold listing data
    if (isFindingApiConfigured()) {
      try {
        const ebayPriceData = await lookupEbaySoldPrices(
          normalizedTitle,
          normalizedIssue,
          selectedGrade,
          false // raw comics by default for Key Hunt
        );

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
            disclaimer: ebayPriceData.disclaimer || "Based on recent eBay sold listings",
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
              disclaimer: ebayPriceData.disclaimer || "Based on recent eBay sold listings",
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
      } catch (ebayError) {
        console.error("[con-mode-lookup] eBay lookup failed:", ebayError);
        // Continue to AI fallback
      }
    }

    // 4. Fall back to Claude API (slower ~1-2s)

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Price lookup is temporarily unavailable. Please try again later." },
        { status: 500 }
      );
    }

    // Build disambiguation context if years provided
    const seriesContext = seriesYears
      ? `\n\nIMPORTANT: This is specifically the "${normalizedTitle}" series that ran from ${seriesYears}. Many comics have had multiple series with the same name. Make sure your pricing is for the correct series/volume.`
      : "";

    // Get price data from Claude
    aiCallsMade++;
    const lookupResponse = await anthropic.messages.create({
      model: MODEL_PRIMARY,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a comic book pricing expert. For "${normalizedTitle}" issue #${normalizedIssue}:${seriesContext}

Provide pricing data for a ${selectedGrade} grade raw copy as JSON:
{
  "publisher": "Publisher name",
  "releaseYear": "YYYY or null if unknown",
  "averagePrice": number (average of last 5 sales for ${selectedGrade} grade raw copy),
  "recentSale": { "price": number, "date": "YYYY-MM-DD" },
  "gradeEstimates": [
    { "grade": 9.8, "label": "Near Mint/Mint", "rawValue": price, "slabbedValue": price },
    { "grade": 9.4, "label": "Near Mint", "rawValue": price, "slabbedValue": price },
    { "grade": 8.0, "label": "Very Fine", "rawValue": price, "slabbedValue": price },
    { "grade": 6.0, "label": "Fine", "rawValue": price, "slabbedValue": price },
    { "grade": 4.0, "label": "Very Good", "rawValue": price, "slabbedValue": price },
    { "grade": 2.0, "label": "Good", "rawValue": price, "slabbedValue": price }
  ],
  "keyInfo": ["MAJOR key facts only - empty array if none"]
}

Rules:
- averagePrice: The average price from the last 5 sales for a ${selectedGrade} grade RAW copy. Be realistic based on eBay sold listings.
- recentSale: The most recent sale price and date (within last 30 days) for a ${selectedGrade} grade raw copy.
- gradeEstimates: Realistic market values for each grade. Slabbed > raw by 10-30%.
- keyInfo: ONLY major first appearances, major storyline events, origin stories. Empty array for regular issues.
- Return ONLY the JSON object, no other text.`,
        },
      ],
    });

    const textContent = lookupResponse.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      return NextResponse.json(
        { error: "Could not get pricing data. Please try again." },
        { status: 500 }
      );
    }

    let jsonText = textContent.text.trim();
    if (jsonText.startsWith("```json")) jsonText = jsonText.slice(7);
    if (jsonText.startsWith("```")) jsonText = jsonText.slice(3);
    if (jsonText.endsWith("```")) jsonText = jsonText.slice(0, -3);

    try {
      const parsed = JSON.parse(jsonText.trim());

      // Get the price for the selected grade
      const gradeEstimate = parsed.gradeEstimates?.find(
        (g: { grade: number }) => g.grade === selectedGrade
      );

      // Try to fetch a cover image (non-blocking, best effort)
      let coverImageUrl: string | null = null;
      try {
        coverImageUrl = await fetchCoverImage(normalizedTitle, normalizedIssue, parsed.publisher, parsed.releaseYear);
      } catch (_coverError) {}

      const result: ConModeLookupResult = {
        title: normalizedTitle,
        issueNumber: normalizedIssue,
        publisher: parsed.publisher || null,
        releaseYear: parsed.releaseYear || null,
        grade: selectedGrade,
        averagePrice: parsed.averagePrice || gradeEstimate?.rawValue || null,
        recentSale: parsed.recentSale || null,
        gradeEstimates: parsed.gradeEstimates || [],
        keyInfo: parsed.keyInfo || [],
        coverImageUrl,
        source: "ai",
        disclaimer: "Values are estimates based on market knowledge. Actual prices may vary.",
      };

      // 4. Save to database for future lookups (non-blocking)
      saveComicMetadata({
        title: normalizedTitle,
        issueNumber: normalizedIssue,
        publisher: parsed.publisher,
        releaseYear: parsed.releaseYear,
        coverImageUrl,
        keyInfo: parsed.keyInfo || [],
        priceData: {
          estimatedValue: parsed.averagePrice || gradeEstimate?.rawValue || 0,
          mostRecentSaleDate: parsed.recentSale?.date || null,
          recentSales: parsed.recentSale ? [parsed.recentSale] : [],
          gradeEstimates: parsed.gradeEstimates || [],
          disclaimer: "Values are estimates based on market knowledge. Actual prices may vary.",
          priceSource: "ai",
        },
      }).catch((err) => {
        console.error("[con-mode-lookup] Failed to save to database:", err);
      });

      // Record scan analytics (fire-and-forget)
      const aiCostCents = estimateScanCostCents({ metadataCacheHit: false, aiCallsMade, ebayLookup: false });
      recordScanAnalytics({
        profile_id: null,
        scan_method: "con-mode-lookup",
        estimated_cost_cents: aiCostCents,
        ai_calls_made: aiCallsMade,
        metadata_cache_hit: false,
        ebay_lookup: false,
        duration_ms: Date.now() - startTime,
        success: true,
        subscription_tier: "guest",
      }).catch(() => {});

      return NextResponse.json(result);
    } catch {
      console.error("Failed to parse con mode lookup response");
      return NextResponse.json(
        { error: "Could not parse pricing data. Please try again." },
        { status: 500 }
      );
    }
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
