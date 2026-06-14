import { NextRequest, NextResponse } from "next/server";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { getComicMetadata, incrementComicLookupCount, saveComicMetadata } from "@/lib/db";
import { lookupKeyInfoWithMeta } from "@/lib/keyComicsDatabase";
import { MODEL_LIGHTWEIGHT } from "@/lib/models";
import { recordScanAnalytics, estimateScanCostCents } from "@/lib/analyticsServer";
import { isBrowseApiConfigured, searchActiveListings, convertBrowseToPriceData } from "@/lib/ebayBrowse";
import type { BrowseListingItem } from "@/lib/ebayBrowse";
import { gradesEqual } from "@/lib/gradePrice";
import { normalizeTitle, normalizeIssueNumber } from "@/lib/normalizeTitle";
import { checkRateLimit, getRateLimitIdentifier, rateLimiters } from "@/lib/rateLimit";
import { runCoverPipeline, shouldRunPipeline } from "@/lib/coverValidation";
import type { CoverPipelineResult } from "@/lib/coverValidation";
import {
  cacheDelete,
  cacheGet,
  cacheSet,
  generateComicMetadataCacheKey,
  generateEbayPriceCacheKey,
} from "@/lib/cache";
import { validateBody } from "@/lib/validation";
import type { PriceData } from "@/types/comic";

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
  /**
   * Confidence metadata for the curated keyInfo lookup. Present only when
   * keyInfo came from the curated DB. UI uses this to render a "verify volume"
   * advisory when matchType === 'year-resolved' (multi-volume disambiguation
   * by AI's reported year - could be misled if AI year is inaccurate).
   *
   * - matchType: 'exact'         → high confidence; render normally
   * - matchType: 'year-resolved' → medium confidence; render ⚠️ advisory
   *
   * matchedYear is the series-START year of the resolved entry (useful for
   * volume context like "Volume started 1963"). totalCandidates lets the UI
   * decide how prominent the advisory should be (e.g., 4-volume Batman #1
   * deserves a louder hint than 2-volume Star Wars #1).
   */
  keyInfoMeta?: {
    matchType: "exact" | "year-resolved";
    matchedYear?: number;
    totalCandidates: number;
  };
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
          (g) => gradesEqual(g.grade, selectedGrade)
        );

        // Curated keyComicsDatabase wins over the cached row - handles stale
        // cache rows where an earlier AI key-info call silently failed and
        // baked an empty array into comic_metadata.key_info.
        const curatedMatch = lookupKeyInfoWithMeta(
          dbResult.title,
          dbResult.issueNumber,
          dbResult.releaseYear ? parseInt(String(dbResult.releaseYear)) : null
        );
        const resolvedKeyInfo =
          curatedMatch && curatedMatch.keyInfo.length > 0
            ? curatedMatch.keyInfo
            : dbResult.keyInfo || [];

        const result: ConModeLookupResult = {
          title: dbResult.title,
          issueNumber: dbResult.issueNumber,
          publisher: dbResult.publisher,
          releaseYear: dbResult.releaseYear,
          grade: selectedGrade,
          averagePrice: gradeEstimate?.rawValue || dbResult.priceData.estimatedValue || null,
          recentSale: dbResult.priceData.recentSales?.[0] || null,
          gradeEstimates: dbResult.priceData.gradeEstimates || [],
          keyInfo: resolvedKeyInfo,
          // Only attach meta when the keyInfo actually came from the curated
          // match (not when we fell through to the cached row's keyInfo).
          keyInfoMeta:
            curatedMatch && curatedMatch.keyInfo.length > 0
              ? {
                  matchType: curatedMatch.matchType,
                  matchedYear: curatedMatch.matchedYear,
                  totalCandidates: curatedMatch.totalCandidates,
                }
              : undefined,
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

    // 3. Try eBay Browse API for active listing data.
    // Wire the same grade-aware Redis ebayPrice cache that /api/ebay-prices uses
    // (H-PR1) so repeated con-mode lookups for the same book+grade don't re-hit
    // eBay. Con mode is raw (not slabbed); the grade is part of the key so the
    // durable cache stays grade-correct (M-PR10).
    let ebayPriceData: ReturnType<typeof convertBrowseToPriceData> = null;
    let browseListings: BrowseListingItem[] = [];

    const ebayCacheKey = generateEbayPriceCacheKey(
      normalizedTitle,
      normalizedIssue,
      selectedGrade,
      false, // raw (con mode)
      undefined,
    );

    if (isBrowseApiConfigured()) {
      try {
        const cachedEbay = await cacheGet<PriceData | { noData: true }>(
          ebayCacheKey,
          "ebayPrice",
        );
        if (cachedEbay !== null) {
          // Cache hit (positive or negative sentinel — M-PR5).
          if (!("noData" in cachedEbay)) {
            ebayPriceData = cachedEbay;
          }
        } else {
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
            if (priceData?.estimatedValue) {
              ebayPriceData = priceData;
              // Persist the priced result under the grade-aware key.
              cacheSet(ebayCacheKey, priceData, "ebayPrice").catch(() => {});
            } else {
              // Cache the noData sentinel so we don't re-hit eBay on a known miss,
              // mirroring /api/ebay-prices (M-PR5). Aligned 12h TTL.
              cacheSet(ebayCacheKey, { noData: true }, "ebayPrice").catch(() => {});
            }

            if (!priceData && browseResult.totalResults > 0) {
              // Below threshold - pass listing count so UI can show "X active listings found"
              totalListings = browseResult.totalResults;
              ebaySearchQuery = browseResult.searchQuery;
            }
          } else {
            // eBay returned nothing usable — cache the negative result too.
            cacheSet(ebayCacheKey, { noData: true }, "ebayPrice").catch(() => {});
          }
        }
      } catch (ebayError) {
        console.error("[con-mode-lookup] eBay Browse lookup failed:", ebayError);
      }
    }

    if (ebayPriceData && ebayPriceData.estimatedValue) {
      // Get the price for the selected grade
      const gradeEstimate = ebayPriceData.gradeEstimates?.find(
        (g) => gradesEqual(g.grade, selectedGrade)
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

      // Prefer curated keyComicsDatabase over an AI call - instant, free,
      // and hand-vetted for the 403+ tracked keys. AI is the fallback for
      // anything not in the curated set.
      let keyInfo: string[] = [];
      let keyInfoMeta: ConModeLookupResult["keyInfoMeta"] = undefined;
      const curatedMatch = lookupKeyInfoWithMeta(
        normalizedTitle,
        normalizedIssue,
        seriesYears?.match(/\d{4}/)?.[0] ? parseInt(seriesYears.match(/\d{4}/)![0]) : null,
      );
      if (curatedMatch && curatedMatch.keyInfo.length > 0) {
        keyInfo = curatedMatch.keyInfo;
        keyInfoMeta = {
          matchType: curatedMatch.matchType,
          matchedYear: curatedMatch.matchedYear,
          totalCandidates: curatedMatch.totalCandidates,
        };
      } else {
        try {
          keyInfo = await fetchKeyInfoFromAI(normalizedTitle, normalizedIssue);
          aiCallsMade++;
        } catch {
          // Ignore key info errors
        }
        // Drift-candidate breadcrumb: when AI confirms key info but our curated
        // DB missed, the most likely cause is a title-format mismatch (cover
        // prominently displays a feature character / subtitle that the AI
        // returned but isn't aliased on the curated entry). Grep server logs
        // for [keyinfo-drift] to surface candidates for new aliases.
        if (keyInfo.length > 0) {
          console.warn(
            `[keyinfo-drift] curated DB miss for likely key issue: title="${normalizedTitle}" issue="${normalizedIssue}" aiKeyInfo=${JSON.stringify(keyInfo)}`,
          );
        }
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
        keyInfoMeta,
        coverImageUrl,
        source: "ebay",
        disclaimer: ebayPriceData.disclaimer || "Based on current eBay listings",
      };

      // Save to database for future lookups.
      // The comic_metadata row is keyed by title|issue only (grade-agnostic), so
      // persist the grade-neutral 9.4 NM base as estimatedValue rather than the
      // selected grade's price — otherwise a later lookup at a *different* grade
      // reads back this grade's number as its base. Per-grade prices are still
      // recoverable from gradeEstimates. M-PR10.
      const baseEstimatedValue =
        ebayPriceData.gradeEstimates?.find((g) => gradesEqual(g.grade, 9.4))?.rawValue ??
        ebayPriceData.estimatedValue;
      try {
        await saveComicMetadata({
          title: normalizedTitle,
          issueNumber: normalizedIssue,
          publisher: null,
          releaseYear: null,
          coverImageUrl,
          keyInfo,
          priceData: {
            estimatedValue: baseEstimatedValue,
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

    // 4. No eBay data available - return null priceData with listing metadata.
    // Still surface curated key info if we have it (collectors care about
    // the "why" even when there's no current price signal).
    const noDataMatch = lookupKeyInfoWithMeta(
      normalizedTitle,
      normalizedIssue,
      seriesYears?.match(/\d{4}/)?.[0] ? parseInt(seriesYears.match(/\d{4}/)![0]) : null,
    );
    let noDataKeyInfo: string[] = noDataMatch?.keyInfo || [];
    let noDataAiCalls = 0;
    // Mirror the eBay-found path: when curated DB misses, ask AI directly
    // so unaliased title variants (esp. CGC slab titles) still surface key
    // collector facts. Without this fallback, "Ultimate Fallout: Spider-Man
    // No More" and similar AI-supplied variants strip keyInfo silently.
    if (noDataKeyInfo.length === 0) {
      try {
        noDataKeyInfo = await fetchKeyInfoFromAI(normalizedTitle, normalizedIssue);
        if (noDataKeyInfo.length > 0) {
          noDataAiCalls = 1;
          console.warn(
            `[keyinfo-drift] no-data path curated miss, AI rescued: title="${normalizedTitle}" issue="${normalizedIssue}" aiKeyInfo=${JSON.stringify(noDataKeyInfo)}`,
          );
        }
      } catch {
        // Ignore — leave keyInfo empty if AI fails.
      }
    }
    const result: ConModeLookupResult = {
      title: normalizedTitle,
      issueNumber: normalizedIssue,
      publisher: null,
      releaseYear: null,
      grade: selectedGrade,
      averagePrice: null,
      recentSale: null,
      gradeEstimates: [],
      keyInfo: noDataKeyInfo,
      keyInfoMeta:
        noDataMatch && noDataMatch.keyInfo.length > 0
          ? {
              matchType: noDataMatch.matchType,
              matchedYear: noDataMatch.matchedYear,
              totalCandidates: noDataMatch.totalCandidates,
            }
          : undefined,
      coverImageUrl: null,
      source: "ebay",
      disclaimer: "No pricing data available at this time.",
      totalListings,
      ebaySearchQuery,
    };

    // Record scan analytics (fire-and-forget)
    const noCostCents = estimateScanCostCents({ metadataCacheHit: false, aiCallsMade: noDataAiCalls, ebayLookup: true });
    recordScanAnalytics({
      profile_id: null,
      scan_method: "con-mode-lookup",
      estimated_cost_cents: noCostCents,
      ai_calls_made: noDataAiCalls,
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
      // Text-only key-info lookup — use the lightweight model (H-SC5).
      model: MODEL_LIGHTWEIGHT,
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
