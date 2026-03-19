/**
 * eBay Browse API integration module.
 *
 * Handles OAuth authentication, active-listing search, outlier filtering,
 * grade multipliers, and PriceData conversion.
 */

import type { PriceData, GradeEstimate } from "@/types/comic";

// ─── Constants ─────────────────────────────────────────────────────
const COMIC_BOOK_CATEGORY_ID = "259104";
const BROADER_CATEGORY_ID = "63";
const MIN_LISTINGS_THRESHOLD = 3;

// ─── Interfaces ────────────────────────────────────────────────────
export interface BrowseListingItem {
  itemId: string;
  title: string;
  price: number;
  currency: string;
  condition: string;
  itemUrl: string;
  imageUrl?: string;
}

export interface BrowsePriceResult {
  listings: BrowseListingItem[];
  medianPrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  totalResults: number;
  searchQuery: string;
}

// ─── Configuration check ──────────────────────────────────────────
export function isBrowseApiConfigured(): boolean {
  return !!(process.env.EBAY_APP_ID && process.env.EBAY_CLIENT_SECRET);
}

// ─── OAuth token management ───────────────────────────────────────
function getBaseUrl(): string {
  return process.env.EBAY_SANDBOX === "true"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";
}

function getAuthUrl(): string {
  return process.env.EBAY_SANDBOX === "true"
    ? "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
    : "https://api.ebay.com/identity/v1/oauth2/token";
}

let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let refreshPromise: Promise<string | null> | null = null;

async function fetchNewToken(): Promise<string | null> {
  const clientId = process.env.EBAY_APP_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  try {
    const res = await fetch(getAuthUrl(), {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
    });

    if (!res.ok) {
      console.error(
        `[ebay-browse] OAuth token request failed: ${res.status} ${res.statusText}`
      );
      return null;
    }

    const data = await res.json();
    cachedToken = data.access_token;
    // Expire 1 minute early as safety margin
    tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
    return cachedToken;
  } catch (err) {
    console.error("[ebay-browse] OAuth token fetch error:", err);
    return null;
  }
}

async function getOAuthToken(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  // Mutex: if a refresh is already in-flight, await it
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = fetchNewToken().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

// ─── Search keyword builder ───────────────────────────────────────
export function buildSearchKeywords(params: {
  title: string;
  issueNumber?: string;
  isSlabbed?: boolean;
  gradingCompany?: string;
  grade?: string;
}): string {
  const { title, issueNumber, isSlabbed, gradingCompany, grade } = params;

  // Strip apostrophes, colons, semicolons
  let cleaned = title.replace(/[':;]/g, "");

  const parts = [cleaned.trim()];

  if (issueNumber) {
    // Strip # prefix
    parts.push(issueNumber.replace(/^#/, ""));
  }

  if (isSlabbed) {
    parts.push(gradingCompany || "CGC");
    if (grade) {
      // Format integer grades with .0
      const gradeNum = parseFloat(grade);
      const formatted = Number.isInteger(gradeNum)
        ? `${gradeNum}.0`
        : grade;
      parts.push(formatted);
    }
  }

  return parts.join(" ");
}

// ─── Outlier filtering and median calculation ─────────────────────
export function filterOutliersAndCalculateMedian(prices: number[]): {
  medianPrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  filteredPrices: number[];
  totalResults: number;
} {
  const totalResults = prices.length;

  if (prices.length === 0) {
    return {
      medianPrice: null,
      highPrice: null,
      lowPrice: null,
      filteredPrices: [],
      totalResults: 0,
    };
  }

  if (prices.length < MIN_LISTINGS_THRESHOLD) {
    return {
      medianPrice: null,
      highPrice: null,
      lowPrice: null,
      filteredPrices: [...prices],
      totalResults,
    };
  }

  // Sort ascending
  const sorted = [...prices].sort((a, b) => a - b);

  // Calculate raw median
  const mid = Math.floor(sorted.length / 2);
  const rawMedian =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];

  // Filter outliers: remove > 3x median or < 0.2x median
  const filtered = sorted.filter(
    (p) => p <= rawMedian * 3 && p >= rawMedian * 0.2
  );

  if (filtered.length < MIN_LISTINGS_THRESHOLD) {
    return {
      medianPrice: null,
      highPrice: null,
      lowPrice: null,
      filteredPrices: filtered,
      totalResults,
    };
  }

  // Recalculate median on filtered set
  const fMid = Math.floor(filtered.length / 2);
  const medianPrice =
    filtered.length % 2 === 0
      ? (filtered[fMid - 1] + filtered[fMid]) / 2
      : filtered[fMid];

  return {
    medianPrice: Math.round(medianPrice * 100) / 100,
    highPrice: filtered[filtered.length - 1],
    lowPrice: filtered[0],
    filteredPrices: filtered,
    totalResults,
  };
}

// ─── Grade multipliers ────────────────────────────────────────────
const GRADE_MULTIPLIERS: {
  grade: number;
  label: string;
  rawMultiplier: number;
  slabMultiplier: number;
}[] = [
  { grade: 9.8, label: "NM/M", rawMultiplier: 2.5, slabMultiplier: 3.0 },
  { grade: 9.4, label: "NM", rawMultiplier: 1.0, slabMultiplier: 1.3 },
  { grade: 8.0, label: "VF", rawMultiplier: 0.55, slabMultiplier: 0.7 },
  { grade: 6.0, label: "F", rawMultiplier: 0.35, slabMultiplier: 0.45 },
  { grade: 4.0, label: "VG", rawMultiplier: 0.2, slabMultiplier: 0.25 },
  { grade: 2.0, label: "G", rawMultiplier: 0.1, slabMultiplier: 0.15 },
];

export function generateGradeEstimates(basePrice: number): GradeEstimate[] {
  return GRADE_MULTIPLIERS.map((gm) => ({
    grade: gm.grade,
    label: gm.label,
    rawValue: Math.round(basePrice * gm.rawMultiplier * 100) / 100,
    slabbedValue: Math.round(basePrice * gm.slabMultiplier * 100) / 100,
  }));
}

// ─── Convert BrowsePriceResult → PriceData ────────────────────────
export function convertBrowseToPriceData(
  result: BrowsePriceResult,
  requestedGrade?: string,
  isSlabbed?: boolean
): PriceData | null {
  if (result.medianPrice === null) return null;

  // Treat median as 9.4 NM baseline
  const gradeEstimates = generateGradeEstimates(result.medianPrice);
  let estimatedValue = result.medianPrice;

  if (requestedGrade) {
    const gradeNum = parseFloat(requestedGrade);
    const match = gradeEstimates.find((e) => e.grade === gradeNum);
    if (match) {
      estimatedValue = isSlabbed ? match.slabbedValue : match.rawValue;
    }
  } else if (isSlabbed) {
    // Default to 9.4 slabbed
    const nm = gradeEstimates.find((e) => e.grade === 9.4);
    if (nm) estimatedValue = nm.slabbedValue;
  }

  return {
    estimatedValue,
    recentSales: [],
    mostRecentSaleDate: null,
    isAveraged: true,
    disclaimer: "Based on current eBay listings",
    gradeEstimates,
    baseGrade: 9.4,
    priceSource: "ebay",
  };
}

// ─── Parse Browse API response ────────────────────────────────────
export function parseBrowseResponse(data: Record<string, unknown>): BrowseListingItem[] {
  const summaries = data.itemSummaries as Array<Record<string, unknown>> | undefined;
  if (!summaries || !Array.isArray(summaries)) return [];

  return summaries.map((item) => {
    const priceObj = item.price as { value: string; currency: string } | undefined;
    const imageObj = item.image as { imageUrl: string } | undefined;

    return {
      itemId: item.itemId as string,
      title: item.title as string,
      price: parseFloat(priceObj?.value ?? "0"),
      currency: priceObj?.currency ?? "USD",
      condition: (item.condition as string) ?? "Unknown",
      itemUrl: item.itemWebUrl as string,
      imageUrl: imageObj?.imageUrl,
    };
  });
}

// ─── Main search function ─────────────────────────────────────────
export async function searchActiveListings(
  title: string,
  issueNumber?: string,
  grade?: string,
  isSlabbed?: boolean,
  gradingCompany?: string
): Promise<BrowsePriceResult | null> {
  if (!isBrowseApiConfigured()) {
    console.error("[ebay-browse] API not configured — missing env vars");
    return null;
  }

  const token = await getOAuthToken();
  if (!token) {
    console.error("[ebay-browse] Failed to obtain OAuth token");
    return null;
  }

  const keywords = buildSearchKeywords({
    title,
    issueNumber,
    isSlabbed,
    gradingCompany,
    grade,
  });

  const baseUrl = getBaseUrl();

  // Category fallback chain: comic books → broader collectibles → none
  const categoryChain = [COMIC_BOOK_CATEGORY_ID, BROADER_CATEGORY_ID, null];

  for (const categoryId of categoryChain) {
    try {
      const filter = "priceCurrency:USD,buyingOptions:{FIXED_PRICE}";

      // Build URL manually to avoid URLSearchParams encoding curly braces
      let url = `${baseUrl}/buy/browse/v1/item_summary/search?q=${encodeURIComponent(keywords)}&filter=${encodeURIComponent(filter)}&limit=30`;
      if (categoryId) {
        url += `&category_ids=${categoryId}`;
      }

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        },
      });

      if (!res.ok) {
        console.error(
          `[ebay-browse] Search failed (category ${categoryId}): ${res.status} ${res.statusText}`
        );
        continue;
      }

      const data = await res.json();
      const listings = parseBrowseResponse(data);

      if (listings.length === 0 && categoryId !== null) {
        // Try broader category
        continue;
      }

      const prices = listings.map((l) => l.price);
      const stats = filterOutliersAndCalculateMedian(prices);

      return {
        listings,
        medianPrice: stats.medianPrice,
        highPrice: stats.highPrice,
        lowPrice: stats.lowPrice,
        totalResults: stats.totalResults,
        searchQuery: keywords,
      };
    } catch (err) {
      console.error(
        `[ebay-browse] Search error (category ${categoryId}):`,
        err
      );
      continue;
    }
  }

  return null;
}

// ─── Browser search URL builder ───────────────────────────────────
export function buildEbaySearchUrl(
  title: string,
  issueNumber?: string,
  grade?: string,
  isSlabbed?: boolean
): string {
  const parts = [title];

  if (issueNumber) {
    parts.push(`#${issueNumber.replace(/^#/, "")}`);
  }

  if (isSlabbed) {
    parts.push("CGC");
    if (grade) {
      const gradeNum = parseFloat(grade);
      parts.push(Number.isInteger(gradeNum) ? `${gradeNum}.0` : grade);
    }
  }

  const query = parts.join(" ");

  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query).replace(/%20/g, "+")}&LH_Complete=1&LH_Sold=1&_sacat=${COMIC_BOOK_CATEGORY_ID}`;
}
