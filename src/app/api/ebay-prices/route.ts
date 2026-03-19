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

import { cacheGet, cacheSet, generateEbayPriceCacheKey } from "@/lib/cache";
import { isBrowseApiConfigured, searchActiveListings, convertBrowseToPriceData } from "@/lib/ebayBrowse";

import { PriceData } from "@/types/comic";

interface EbayPriceRequest {
  title: string;
  issueNumber?: string;
  grade?: number;
  isSlabbed?: boolean;
  isGraded?: boolean; // Legacy field - maps to isSlabbed
  gradingCompany?: string;
}

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
    const body = await request.json();
    const { title, issueNumber, grade, isSlabbed, isGraded, gradingCompany } =
      body as EbayPriceRequest;

    // Validate required fields
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          source: "none",
          cached: false,
          error: "Title is required",
        },
        { status: 400 }
      );
    }

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
    const browseResult = await searchActiveListings(cleanTitle, cleanIssue, numericGrade ? String(numericGrade) : undefined, slabbed, company);
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
  const { searchParams } = new URL(request.url);

  const title = searchParams.get("title");
  const issueNumber = searchParams.get("issueNumber") || searchParams.get("issue");
  const grade = searchParams.get("grade");
  const isGraded = searchParams.get("isGraded") === "true";
  const gradingCompany = searchParams.get("gradingCompany");

  if (!title) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        source: "none",
        cached: false,
        error: "Title is required",
      },
      { status: 400 }
    );
  }

  // Create a mock request with the body
  const mockRequest = new NextRequest(request.url, {
    method: "POST",
    body: JSON.stringify({
      title,
      issueNumber,
      grade: grade ? parseFloat(grade) : undefined,
      isGraded,
      gradingCompany,
    }),
  });

  return POST(mockRequest);
}
