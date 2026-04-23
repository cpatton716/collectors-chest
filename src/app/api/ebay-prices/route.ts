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
import { validateBody, validateQuery } from "@/lib/validation";

import { PriceData } from "@/types/comic";

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

export async function POST(request: NextRequest): Promise<NextResponse<EbayPriceResponse>> {
  try {
    // Parse request body
    const rawBody = await request.json().catch(() => null);
    const validated = validateBody(ebayPricesBodySchema, rawBody);
    if (!validated.success) {
      return validated.response as unknown as NextResponse<EbayPriceResponse>;
    }
    const { title, issueNumber, grade, isSlabbed, isGraded, gradingCompany, year } = validated.data;

    const cleanTitle = title.trim();
    const cleanIssue = issueNumber?.toString().trim();
    const numericGrade = grade ? parseFloat(grade.toString()) : 9.4;
    const slabbed = Boolean(isSlabbed || isGraded); // Support legacy field
    const company = gradingCompany?.trim();

    // Generate cache key
    const cacheKey = generateEbayPriceCacheKey(
      cleanTitle,
      cleanIssue || "",
      numericGrade,
      slabbed,
      company
    );

    // 1. Check Redis cache first
    const cachedResult = await cacheGet<PriceData | { noData: true }>(cacheKey, "ebayPrice");
    if (cachedResult !== null) {
      if ("noData" in cachedResult) {
        return NextResponse.json({
          success: true,
          data: null,
          source: "cache",
          cached: true,
        });
      }
      return NextResponse.json({
        success: true,
        data: cachedResult,
        source: "cache",
        cached: true,
      });
    }

    // 2. Check if eBay API is configured
    if (!isBrowseApiConfigured()) {
      return NextResponse.json({
        success: true,
        data: null,
        source: "none",
        cached: false,
        error: "eBay API not configured",
      });
    }

    // 3. Fetch from eBay Browse API
    const browseResult = await searchActiveListings(cleanTitle, cleanIssue, numericGrade ? String(numericGrade) : undefined, slabbed, company, year || undefined);
    const priceData = browseResult ? convertBrowseToPriceData(browseResult, numericGrade ? String(numericGrade) : undefined, slabbed) : null;

    // 4. Cache the result (fire and forget)
    if (priceData && priceData.estimatedValue) {
      cacheSet(cacheKey, priceData, "ebayPrice").catch(() => {});
      return NextResponse.json({
        success: true,
        data: priceData,
        source: "ebay",
        cached: false,
      });
    } else {
      // Cache negative results to avoid repeated lookups
      cacheSet(cacheKey, { noData: true }, "ebayPrice", 60 * 60).catch(() => {});
      return NextResponse.json({
        success: true,
        data: null,
        source: "none",
        cached: false,
      });
    }
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
  const validated = validateQuery(ebayPricesQuerySchema, new URL(request.url).searchParams);
  if (!validated.success) {
    return validated.response as unknown as NextResponse<EbayPriceResponse>;
  }
  const { title, issueNumber, issue, grade, isGraded, gradingCompany } = validated.data;
  const resolvedIssue = issueNumber || issue;

  // Create a mock request with the body
  const mockRequest = new NextRequest(request.url, {
    method: "POST",
    body: JSON.stringify({
      title,
      issueNumber: resolvedIssue,
      grade: grade ? parseFloat(grade) : undefined,
      isGraded: isGraded === "true",
      gradingCompany,
    }),
  });

  return POST(mockRequest);
}
