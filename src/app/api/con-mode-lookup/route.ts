import { NextRequest, NextResponse } from "next/server";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { getComicMetadata, incrementComicLookupCount, saveComicMetadata } from "@/lib/db";
import { MODEL_PRIMARY } from "@/lib/models";
import { recordScanAnalytics, estimateScanCostCents } from "@/lib/analyticsServer";
import { isBrowseApiConfigured, searchActiveListings, convertBrowseToPriceData } from "@/lib/ebayBrowse";
import type { BrowseListingItem } from "@/lib/ebayBrowse";
import { normalizeTitle, normalizeIssueNumber } from "@/lib/normalizeTitle";
import { checkRateLimit, getRateLimitIdentifier, rateLimiters } from "@/lib/rateLimit";
import { runCoverPipeline, shouldRunPipeline } from "@/lib/coverValidation";
import type { CoverPipelineResult } from "@/lib/coverValidation";
import { cacheDelete, generateComicMetadataCacheKey } from "@/lib/cache";
import { validateBody } from "@/lib/validation";

const conModeLookupSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  issueNumber: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .pipe(z.string().min(1, "Issue number is required").max(50)),
  grade: z.coerce.number().min(0.5).max(10).optional(),
  years: z.string().trim().max(20).optional().nullable(),
});

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
    // Rate limit to protect API costs
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
    const validated = validateBody(conModeLookupSchema, rawBody);
    if (!validated.success) return validated.response;
    const { title, issueNumber, grade, years } = validated.data;

    const normalizedTitle = normalizeTitle(title);
    const normalizedIssue = normalizeIssueNumber(issueNumber.toString());
    const selectedGrade = grade || 9.4;
    const seriesYears = years?.trim() || null; // e.g., "1963-2011" for disambiguation

    // 1. Check database cache (fast ~50ms)
    let existingMetadata: Awaited<ReturnType<typeof getComicMetadata>> = null;
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
      // Keep the metadata reference even if priceData wasn't usable
      existingMetadata = dbResult;
    } catch (dbError) {
      console.error("[con-mode-lookup] Database lookup failed, falling back to eBay:", dbError);
      // Continue to eBay lookup
    }

    // 2. Tracking variables for response metadata
    let totalListings: number | undefined;
    let ebaySearchQuery: string | undefined;

    // 3. Try eBay Browse API for active listing data
    let ebayPriceData: ReturnType<typeof convertBrowseToPriceData> = null;
    let browseListings: BrowseListingItem[] = [];

    if (isBrowseApiConfigured()) {
      try {
        const browseResult = await searchActiveListings(
          normalizedTitle,
          normalizedIssue,
          String(selectedGrade),
          false, // raw comics by default for con mode
          undefined, // gradingCompany
          seriesYears?.split("-")[0] || undefined, // start year for disambiguation
        );

        if (browseResult) {
          browseListings = browseResult.listings || [];
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

      // Run cover validation pipeline
      const pipelineRan = shouldRunPipeline(existingMetadata);
      let pipelineResult: CoverPipelineResult | null = null;
      let coverImageUrl: string | null = existingMetadata?.coverImageUrl || null;

      if (pipelineRan) {
        pipelineResult = await runCoverPipeline(
          normalizedTitle,
          normalizedIssue,
          seriesYears?.match(/\d{4}/)?.[0] || null,
          null,
          { ebayListings: browseListings }
        );
        if (pipelineResult.coverUrl) {
          coverImageUrl = pipelineResult.coverUrl;
        }
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
      try {
        await saveComicMetadata({
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
          ...(pipelineRan && {
            coverSource: pipelineResult?.coverSource || undefined,
            coverValidated: pipelineResult?.validated ?? false,
          }),
        });

        // Invalidate Redis cache to prevent stale reads
        const cacheKey = generateComicMetadataCacheKey(normalizedTitle, normalizedIssue);
        await cacheDelete(cacheKey, "comicMetadata");
      } catch (saveErr) {
        console.error("[con-mode-lookup] Failed to save eBay data to database:", saveErr);
      }

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
