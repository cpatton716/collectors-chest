/**
 * eBay Finding API Integration for Completed/Sold Listings
 *
 * The Finding API provides access to completed (sold) listings,
 * which is essential for accurate price history data.
 *
 * Environment Variables Required:
 *   EBAY_APP_ID     - Your eBay Developer App ID
 *   EBAY_SANDBOX    - Set to "true" for sandbox, "false" for production
 *
 * eBay Finding API Documentation:
 *   https://developer.ebay.com/Devzone/finding/Concepts/FindingAPIGuide.html
 */
import { GradeEstimate, PriceData, RecentSale } from "@/types/comic";

// ============================================
// Types
// ============================================

export interface FindingSearchParams {
  title: string;
  issueNumber?: string;
  grade?: number;
  isSlabbed?: boolean;
  gradingCompany?: string;
  limit?: number;
}

export interface FindingSoldItem {
  itemId: string;
  title: string;
  price: number;
  currency: string;
  soldDate: string;
  condition: string;
  itemUrl: string;
  imageUrl?: string;
}

export interface FindingPriceResult {
  sales: FindingSoldItem[];
  averagePrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  totalResults: number;
  searchQuery: string;
}

// ============================================
// Configuration
// ============================================

const FINDING_API_SANDBOX_URL = "https://svcs.sandbox.ebay.com/services/search/FindingService/v1";
const FINDING_API_PRODUCTION_URL = "https://svcs.ebay.com/services/search/FindingService/v1";

// eBay category ID for collectible comics
const COMIC_BOOK_CATEGORY_ID = "259104";

// ============================================
// API Client
// ============================================

/**
 * Check if Finding API is configured
 */
export function isFindingApiConfigured(): boolean {
  return !!process.env.EBAY_APP_ID;
}

/**
 * Get the Finding API base URL based on environment
 */
function getFindingApiUrl(): string {
  const isSandbox = process.env.EBAY_SANDBOX === "true";
  return isSandbox ? FINDING_API_SANDBOX_URL : FINDING_API_PRODUCTION_URL;
}

/**
 * Build search keywords for a comic book
 *
 * IMPORTANT: Do NOT include signature series info in the search.
 * Signed copies are rare and would return no results. Always search
 * for the base graded comic (title + issue + grading company + grade).
 */
export function buildSearchKeywords(params: FindingSearchParams): string {
  const { title, issueNumber, grade, isSlabbed, gradingCompany } = params;

  // Clean title: remove special characters that break eBay's Finding API
  // Apostrophes get XML-escaped to &apos; which eBay treats as literal text
  // Colons can be interpreted as search operators
  let keywords = title
    .trim()
    .replace(/[':;]/g, "") // Remove apostrophes, colons, semicolons
    .replace(/\s+/g, " "); // Normalize whitespace

  // Add issue number (without # prefix - eBay searches work better without it)
  if (issueNumber) {
    const cleanIssue = issueNumber.replace(/^#/, "").trim();
    keywords += ` ${cleanIssue}`;
  }

  // Add grading info for slabbed comics
  // Note: We intentionally exclude "Signature Series" to get more results
  if (isSlabbed) {
    if (gradingCompany) {
      keywords += ` ${gradingCompany}`;
    } else {
      // Default to CGC as most common
      keywords += " CGC";
    }
    if (grade) {
      // Format grade with decimal (5.0 not 5) for better eBay matching
      const formattedGrade = Number.isInteger(grade) ? `${grade}.0` : `${grade}`;
      keywords += ` ${formattedGrade}`;
    }
  }

  return keywords;
}

/**
 * Build XML request body for findCompletedItems operation
 */
function buildFindCompletedItemsRequest(keywords: string, limit: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<findCompletedItemsRequest xmlns="http://www.ebay.com/marketplace/search/v1/services">
  <keywords>${escapeXml(keywords)}</keywords>
  <categoryId>${COMIC_BOOK_CATEGORY_ID}</categoryId>
  <itemFilter>
    <name>SoldItemsOnly</name>
    <value>true</value>
  </itemFilter>
  <itemFilter>
    <name>ListingType</name>
    <value>FixedPrice</value>
    <value>Auction</value>
  </itemFilter>
  <sortOrder>EndTimeSoonest</sortOrder>
  <paginationInput>
    <entriesPerPage>${limit}</entriesPerPage>
    <pageNumber>1</pageNumber>
  </paginationInput>
  <outputSelector>SellerInfo</outputSelector>
  <outputSelector>PictureURLLarge</outputSelector>
</findCompletedItemsRequest>`;
}

/**
 * Escape special XML characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Search for completed/sold comic book listings
 */
export async function findCompletedItems(
  params: FindingSearchParams
): Promise<FindingPriceResult | null> {
  if (!isFindingApiConfigured()) {
    return null;
  }

  const appId = process.env.EBAY_APP_ID!;
  const baseUrl = getFindingApiUrl();
  const keywords = buildSearchKeywords(params);
  const limit = params.limit || 30;

  const requestBody = buildFindCompletedItemsRequest(keywords, limit);

  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
        "X-EBAY-SOA-OPERATION-NAME": "findCompletedItems",
        "X-EBAY-SOA-SECURITY-APPNAME": appId,
        "X-EBAY-SOA-RESPONSE-DATA-FORMAT": "JSON",
        "X-EBAY-SOA-GLOBAL-ID": "EBAY-US",
      },
      body: requestBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ebay-finding] Request failed:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    return parseFindingResponse(data, keywords);
  } catch (error) {
    console.error("[ebay-finding] Search failed:", error);
    return null;
  }
}

/**
 * Parse Finding API JSON response
 */
function parseFindingResponse(
  data: Record<string, unknown>,
  searchQuery: string
): FindingPriceResult {
  const items: FindingSoldItem[] = [];

  try {
    // Navigate the nested response structure
    const response = (data.findCompletedItemsResponse as Record<string, unknown>[])?.[0];
    if (!response) {
      return emptyResult(searchQuery);
    }

    const ack = (response.ack as string[])?.[0];
    if (ack !== "Success") {
      const errorMessage = (
        (response.errorMessage as Record<string, unknown>[])?.[0]?.error as Record<
          string,
          unknown
        >[]
      )?.[0]?.message;
      return emptyResult(searchQuery);
    }

    const searchResult = (response.searchResult as Record<string, unknown>[])?.[0];
    const itemArray = (searchResult?.item as Record<string, unknown>[]) || [];
    const totalEntries = parseInt(
      ((searchResult as Record<string, unknown>)?.["@count"] as string) || "0",
      10
    );

    for (const item of itemArray) {
      const sellingStatus = (item.sellingStatus as Record<string, unknown>[])?.[0];
      const currentPrice = (sellingStatus?.currentPrice as Record<string, unknown>[])?.[0];
      const priceValue = parseFloat((currentPrice?.["__value__"] as string) || "0");

      if (priceValue > 0) {
        const listingInfo = (item.listingInfo as Record<string, unknown>[])?.[0];
        const endTime = (listingInfo?.endTime as string[])?.[0] || "";

        const condition = (item.condition as Record<string, unknown>[])?.[0];
        const conditionName = (condition?.conditionDisplayName as string[])?.[0] || "Unknown";

        items.push({
          itemId: (item.itemId as string[])?.[0] || "",
          title: (item.title as string[])?.[0] || "",
          price: priceValue,
          currency: (currentPrice?.["@currencyId"] as string) || "USD",
          soldDate: endTime,
          condition: conditionName,
          itemUrl: (item.viewItemURL as string[])?.[0] || "",
          imageUrl: (item.galleryURL as string[])?.[0],
        });
      }
    }

    return calculatePriceStats(items, totalEntries, searchQuery);
  } catch (error) {
    console.error("[ebay-finding] Error parsing response:", error);
    return emptyResult(searchQuery);
  }
}

/**
 * Create empty result
 */
function emptyResult(searchQuery: string): FindingPriceResult {
  return {
    sales: [],
    averagePrice: null,
    highPrice: null,
    lowPrice: null,
    totalResults: 0,
    searchQuery,
  };
}

/**
 * Calculate price statistics from sold items
 */
function calculatePriceStats(
  items: FindingSoldItem[],
  totalResults: number,
  searchQuery: string
): FindingPriceResult {
  if (items.length === 0) {
    return emptyResult(searchQuery);
  }

  // Sort by date (most recent first)
  items.sort((a, b) => new Date(b.soldDate).getTime() - new Date(a.soldDate).getTime());

  // Filter outliers (remove prices more than 3x the median)
  const prices = items.map((item) => item.price).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)];
  const filteredItems = items.filter(
    (item) => item.price <= median * 3 && item.price >= median * 0.2
  );

  const filteredPrices = filteredItems.map((item) => item.price);
  if (filteredPrices.length === 0) {
    return emptyResult(searchQuery);
  }

  const sum = filteredPrices.reduce((a, b) => a + b, 0);
  const average = Math.round((sum / filteredPrices.length) * 100) / 100;
  const high = Math.max(...filteredPrices);
  const low = Math.min(...filteredPrices);

  return {
    sales: filteredItems,
    averagePrice: average,
    highPrice: high,
    lowPrice: low,
    totalResults,
    searchQuery,
  };
}

// ============================================
// Convert to App Price Data Format
// ============================================

/**
 * Convert Finding API results to our app's PriceData format
 */
export function convertFindingToPriceData(
  result: FindingPriceResult,
  requestedGrade?: number,
  isSlabbed?: boolean
): PriceData | null {
  if (!result || result.sales.length === 0) {
    return null;
  }

  // Convert to RecentSale format
  const recentSales: RecentSale[] = result.sales.slice(0, 10).map((sale) => {
    const saleDate = new Date(sale.soldDate);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    return {
      price: sale.price,
      date: sale.soldDate.split("T")[0],
      source: "eBay",
      isOlderThan6Months: saleDate < sixMonthsAgo,
    };
  });

  const mostRecentSaleDate = recentSales.length > 0 ? recentSales[0].date : null;

  // Generate grade estimates from the average price
  const basePrice = result.averagePrice || 0;
  const gradeEstimates = generateGradeEstimates(basePrice, isSlabbed);

  // Determine the estimated value based on requested grade
  let estimatedValue = result.averagePrice;
  if (requestedGrade && gradeEstimates.length > 0) {
    const gradeEstimate = gradeEstimates.find((g) => g.grade === requestedGrade);
    if (gradeEstimate) {
      estimatedValue = isSlabbed ? gradeEstimate.slabbedValue : gradeEstimate.rawValue;
    }
  }

  return {
    estimatedValue,
    recentSales,
    mostRecentSaleDate,
    isAveraged: recentSales.length > 1,
    disclaimer: `Based on ${result.sales.length} recent eBay sales`,
    gradeEstimates,
    baseGrade: 9.4,
    priceSource: "ebay",
  };
}

/**
 * Generate grade-based price estimates
 * Uses typical comic book price multipliers relative to 9.4 grade
 */
function generateGradeEstimates(basePrice: number, isSlabbed?: boolean): GradeEstimate[] {
  // Multipliers relative to 9.4 raw grade
  const gradeData: {
    grade: number;
    label: string;
    rawMult: number;
    slabMult: number;
  }[] = [
    { grade: 9.8, label: "Near Mint/Mint", rawMult: 2.5, slabMult: 3.0 },
    { grade: 9.4, label: "Near Mint", rawMult: 1.0, slabMult: 1.3 },
    { grade: 8.0, label: "Very Fine", rawMult: 0.55, slabMult: 0.7 },
    { grade: 6.0, label: "Fine", rawMult: 0.35, slabMult: 0.45 },
    { grade: 4.0, label: "Very Good", rawMult: 0.2, slabMult: 0.25 },
    { grade: 2.0, label: "Good", rawMult: 0.1, slabMult: 0.15 },
  ];

  return gradeData.map(({ grade, label, rawMult, slabMult }) => ({
    grade,
    label,
    rawValue: Math.round(basePrice * rawMult * 100) / 100,
    slabbedValue: Math.round(basePrice * slabMult * 100) / 100,
  }));
}

// ============================================
// Main Lookup Function
// ============================================

/**
 * Look up comic prices using eBay Finding API
 * Returns real sold listing data for accurate pricing
 */
export async function lookupEbaySoldPrices(
  title: string,
  issueNumber?: string,
  grade?: number,
  isSlabbed?: boolean,
  gradingCompany?: string
): Promise<PriceData | null> {
  if (!isFindingApiConfigured()) {
    return null;
  }

  const params: FindingSearchParams = {
    title,
    issueNumber,
    grade: isSlabbed ? grade : undefined, // Only include grade for slabbed
    isSlabbed,
    gradingCompany,
    limit: 30,
  };

  const result = await findCompletedItems(params);

  if (!result || result.sales.length === 0) {
    return null;
  }

  return convertFindingToPriceData(result, grade, isSlabbed);
}

// ============================================
// eBay Search URL Builder (for "For Sale Now" link)
// ============================================

/**
 * Build eBay search URL for active listings
 * Opens in user's browser to show current listings
 *
 * Note: Does not include signature series info to get more results
 */
export function buildEbaySearchUrl(
  title: string,
  issueNumber?: string,
  grade?: number,
  isSlabbed?: boolean
): string {
  let query = title.trim();

  if (issueNumber) {
    const cleanIssue = issueNumber.replace(/^#/, "").trim();
    query += ` ${cleanIssue}`;
  }

  if (isSlabbed) {
    query += " CGC";
    if (grade) {
      // Format grade with decimal (5.0 not 5) for better matching
      const formattedGrade = Number.isInteger(grade) ? `${grade}.0` : `${grade}`;
      query += ` ${formattedGrade}`;
    }
  }

  const encodedQuery = encodeURIComponent(query);

  // Build eBay search URL with comic book category filter
  return `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}&_sacat=${COMIC_BOOK_CATEGORY_ID}&_sop=12&LH_BIN=1`;
}
