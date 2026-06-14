/**
 * eBay Prices API Endpoint
 *
 * POST /api/ebay-prices
 *
 * Fetches active listings from eBay for comic book pricing.
 * Uses Redis caching (12-hour TTL) to minimize eBay API calls.
 *
 * Request body:
 * {
 *   title: string;        // Comic title (e.g., "Amazing Spider-Man")
 *   issueNumber?: string; // Issue number (e.g., "300")
 *   grade?: number;       // Numeric grade (e.g., 9.8)
 *   isSlabbed?: boolean;  // Whether professionally graded
 *   gradingCompany?: string; // CGC, CBCS, PGX
 * }
 *
 * Response:
 * {
 *   success: boolean;
 *   data: PriceData | null;
 *   source: "ebay" | "cache";
 *   cached: boolean;
 *   error?: string;
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { cacheGet, cacheSet, generateEbayPriceCacheKey } from "@/lib/cache";
import { isBrowseApiConfigured, searchActiveListings, convertBrowseToPriceData } from "@/lib/ebayBrowse";
import { checkRateLimit, getRateLimitIdentifier, rateLimiters } from "@/lib/rateLimit";
import { validateBody, validateQuery } from "@/lib/validation";

import { PriceData } from "@/types/comic";

// Negative-cache TTL: align with the positive eBay price TTL (12h) so a
// "no data" answer isn't re-fetched far more aggressively than a hit. L-PR12.
const EBAY_NEGATIVE_TTL_SECONDS = 60 * 60 * 12;

const ebayPricesBodySchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  issueNumber: z
    .union([z.string(), z.number()])
    .transform((v) => (v === undefined || v === null ? undefined : String(v)))
    .optional()
    .nullable(),
  grade: z.coerce.number().min(0).max(10).optional().nullable(),
  isSlabbed: z.boolean().optional(),
  isGraded: z.boolean().optional(), // Legacy field - maps to isSlabbed
  gradingCompany: z.string().trim().max(20).optional().nullable(),
  year: z
    .union([z.string(), z.number()])
    .transform((v) => (v === undefined || v === null ? undefined : String(v)))
    .optional()
    .nullable(),
});

const ebayPricesQuerySchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  issueNumber: z.string().trim().max(50).optional(),
  issue: z.string().trim().max(50).optional(),
  grade: z.string().trim().optional(),
  isGraded: z.string().optional(),
  gradingCompany: z.string().trim().max(20).optional(),
});

interface EbayPriceResponse {
  success: boolean;
  data: PriceData | null;
  source: "ebay" | "cache" | "none";
  cached: boolean;
  error?: string;
}

/**
 * Core eBay price lookup: Redis cache (positive + negative) → Browse API.
 *
 * Shared by both GET and POST so they validate their own inputs then call this
 * single code path (no GET→POST mock-request round-trip). L-PR11.
 */
export async function fetchEbayPrices(params: {
  title: string;
  issueNumber?: string | null;
  grade?: number | null;
  isSlabbed?: boolean;
  gradingCompany?: string | null;
  year?: string | null;
}): Promise<EbayPriceResponse> {
  const cleanTitle = params.title.trim();
  const cleanIssue = params.issueNumber?.toString().trim();
  const numericGrade = params.grade ? parseFloat(params.grade.toString()) : 9.4;
  const slabbed = Boolean(params.isSlabbed);
  const company = params.gradingCompany?.trim();

  const cacheKey = generateEbayPriceCacheKey(
    cleanTitle,
    cleanIssue || "",
    numericGrade,
    slabbed,
    company
  );

  // 1. Check Redis cache first (positive or negative sentinel)
  const cachedResult = await cacheGet<PriceData | { noData: true }>(cacheKey, "ebayPrice");
  if (cachedResult !== null) {
    if ("noData" in cachedResult) {
      return { success: true, data: null, source: "cache", cached: true };
    }
    return { success: true, data: cachedResult, source: "cache", cached: true };
  }

  // 2. Check if eBay API is configured
  if (!isBrowseApiConfigured()) {
    return {
      success: true,
      data: null,
      source: "none",
      cached: false,
      error: "eBay API not configured",
    };
  }

  // 3. Fetch from eBay Browse API
  const browseResult = await searchActiveListings(
    cleanTitle,
    cleanIssue,
    numericGrade ? String(numericGrade) : undefined,
    slabbed,
    company,
    params.year || undefined
  );
  const priceData = browseResult
    ? convertBrowseToPriceData(browseResult, numericGrade ? String(numericGrade) : undefined, slabbed)
    : null;

  // 4. Cache the result (fire and forget)
  if (priceData && priceData.estimatedValue) {
    cacheSet(cacheKey, priceData, "ebayPrice").catch(() => {});
    return { success: true, data: priceData, source: "ebay", cached: false };
  }

  // Cache negative results to avoid repeated lookups (aligned TTL — L-PR12)
  cacheSet(cacheKey, { noData: true }, "ebayPrice", EBAY_NEGATIVE_TTL_SECONDS).catch(() => {});
  return { success: true, data: null, source: "none", cached: false };
}

export async function POST(request: NextRequest): Promise<NextResponse<EbayPriceResponse>> {
  try {
    // Rate limit to protect eBay API quota (H-PR3)
    const identifier = getRateLimitIdentifier(
      null,
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")
    );
    const { success: rateLimitSuccess, response: rateLimitResponse } = await checkRateLimit(
      rateLimiters.lookup,
      identifier
    );
    if (!rateLimitSuccess && rateLimitResponse) {
      return rateLimitResponse as unknown as NextResponse<EbayPriceResponse>;
    }

    // Parse request body
    const rawBody = await request.json().catch(() => null);
    const validated = validateBody(ebayPricesBodySchema, rawBody);
    if (!validated.success) {
      return validated.response as unknown as NextResponse<EbayPriceResponse>;
    }
    const { title, issueNumber, grade, isSlabbed, isGraded, gradingCompany, year } = validated.data;

    const result = await fetchEbayPrices({
      title,
      issueNumber,
      grade,
      isSlabbed: Boolean(isSlabbed || isGraded), // Support legacy field
      gradingCompany,
      year,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[ebay-prices] Error:", error);

    // Return graceful failure - no pricing data available
    return NextResponse.json({
      success: false,
      data: null,
      source: "none",
      cached: false,
      error: "Failed to fetch eBay prices",
    });
  }
}

/**
 * GET endpoint for simple lookups (URL parameters)
 */
export async function GET(request: NextRequest): Promise<NextResponse<EbayPriceResponse>> {
  try {
    // Rate limit to protect eBay API quota (H-PR3)
    const identifier = getRateLimitIdentifier(
      null,
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")
    );
    const { success: rateLimitSuccess, response: rateLimitResponse } = await checkRateLimit(
      rateLimiters.lookup,
      identifier
    );
    if (!rateLimitSuccess && rateLimitResponse) {
      return rateLimitResponse as unknown as NextResponse<EbayPriceResponse>;
    }

    const validated = validateQuery(ebayPricesQuerySchema, new URL(request.url).searchParams);
    if (!validated.success) {
      return validated.response as unknown as NextResponse<EbayPriceResponse>;
    }
    const { title, issueNumber, issue, grade, isGraded, gradingCompany } = validated.data;

    const result = await fetchEbayPrices({
      title,
      issueNumber: issueNumber || issue,
      grade: grade ? parseFloat(grade) : undefined,
      isSlabbed: isGraded === "true",
      gradingCompany,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[ebay-prices] Error:", error);
    return NextResponse.json({
      success: false,
      data: null,
      source: "none",
      cached: false,
      error: "Failed to fetch eBay prices",
    });
  }
}
