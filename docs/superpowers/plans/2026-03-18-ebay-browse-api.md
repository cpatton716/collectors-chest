# eBay Browse API Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dead eBay Finding API with the Browse API to show real "Listed Value" pricing from active eBay listings, removing all AI-fabricated price estimates.

**Architecture:** New `ebayBrowse.ts` module handles OAuth 2.0 auth and Browse API calls, converting results to the existing `PriceData` interface. Five API routes swap from the old Finding API to the new Browse API. Six UI components update labels from "Estimate" to "Listed Value" and remove fake "Most Recent Sale" data. AI price fallbacks are removed entirely.

**Tech Stack:** eBay Browse API v1 (REST/JSON), OAuth 2.0 client credentials, Redis caching (Upstash), Next.js API routes, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-03-18-ebay-browse-api-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/ebayBrowse.ts` | OAuth token management, Browse API search, outlier filtering, grade multipliers, PriceData conversion |
| `src/lib/__tests__/ebayBrowse.test.ts` | Unit tests for keyword building, outlier filtering, median calculation, grade multipliers, token caching, response parsing |

### Modified Files
| File | What Changes |
|------|-------------|
| `src/app/api/con-mode-lookup/route.ts` | Swap import from `ebayFinding` → `ebayBrowse`, remove AI price fallback (Tier 3) |
| `src/app/api/analyze/route.ts` | Swap import from `ebayFinding` → `ebayBrowse`, remove AI price fallback |
| `src/app/api/quick-lookup/route.ts` | Remove AI price generation entirely (this route does NOT use ebayFinding — it's purely AI). Add Browse API call or return null pricing |
| `src/app/api/ebay-prices/route.ts` | Swap import, update cache TTL to 12h |
| `src/app/api/hottest-books/route.ts` | Swap import |
| `src/components/KeyHuntPriceResult.tsx` | "Listed Value" labels, remove "Most Recent Sale", remove "Technopathic Estimate", add below-threshold display |
| `src/components/ComicDetailModal.tsx` | "Listed Value" labels, remove AI disclaimers |
| `src/components/ComicDetailsForm.tsx` | "Listed Value" labels, remove AI disclaimers, remove recent sales display |
| `src/components/PublicComicModal.tsx` | Handle empty recentSales, remove AI disclaimers |
| `src/components/KeyHuntHistoryDetail.tsx` | Handle empty recentSale, update labels |
| `src/hooks/useOffline.ts` | Remove "Technopathic Estimate" hardcoded strings |
| `src/app/key-hunt/page.tsx` | Remove "Technopathic Estimate" hardcoded strings, remove `"ai"` from source union type |
| `src/app/api/comic-lookup/route.ts` | Remove AI price generation, return priceData: null |
| `src/app/api/import-lookup/route.ts` | Remove AI price generation, return priceData: null |
| `src/lib/offlineCache.ts` | Make `recentSale` optional in interfaces (always null going forward) |
| `src/types/comic.ts` | Remove `"ai"` from `PriceData.priceSource` union type |
| `src/lib/providers/anthropic.ts` | Remove `estimatePrice()` function (keep rest of file) |
| `src/lib/providers/types.ts` | Remove `PriceEstimationResult` interface; check/remove gemini `estimatePrice` |
| `src/lib/db.ts` | Remove `"ai"` from inline `priceSource` union type at line 491 |
| `src/lib/providers/__tests__/anthropic.test.ts` | Remove `estimatePrice` test blocks |
| `src/lib/providers/__tests__/gemini.test.ts` | Remove `estimatePrice` test blocks |
| `src/lib/__tests__/aiProvider.test.ts` | Remove `estimatePrice` from mock objects |
| `src/app/api/admin/health-check/__tests__/probeProviders.test.ts` | Remove `estimatePrice` from mock objects |
| `src/components/Navigation.tsx` | Update FAQ pricing text from AI estimates to eBay listings |
| `src/app/terms/page.tsx` | Update pricing language — AI estimates no longer provided |
| `src/components/__tests__/trackScan.test.ts` | Remove `priceEstimation` from mock objects |
| `src/app/scan/page.tsx` | Update 'Estimated Value' label to 'Listed Value' |
| `src/lib/csvExport.ts` | Update 'Estimated Value' column header to 'Listed Value' |
| `src/components/GradePricingBreakdown.tsx` | Review column headers for consistency with 'Listed Value' language |

### Deleted Files
| File | Reason |
|------|--------|
| `src/lib/ebayFinding.ts` | Dead code — Finding API decommissioned Feb 2025 |

---

## Task 1: Create `ebayBrowse.ts` — OAuth & Token Caching

**Files:**
- Create: `src/lib/ebayBrowse.ts`
- Create: `src/lib/__tests__/ebayBrowse.test.ts`

- [ ] **Step 1: Write failing tests for OAuth token management**

```typescript
// src/lib/__tests__/ebayBrowse.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { isBrowseApiConfigured } from "@/lib/ebayBrowse";

describe("ebayBrowse", () => {
  describe("isBrowseApiConfigured", () => {
    // Use standard ESM import — isBrowseApiConfigured() reads process.env at call time,
    // so vi.stubEnv() before calling the function works without re-importing.
    it("returns false when EBAY_APP_ID is missing", () => {
      vi.stubEnv("EBAY_APP_ID", "");
      vi.stubEnv("EBAY_CLIENT_SECRET", "test-secret");
      expect(isBrowseApiConfigured()).toBe(false);
    });

    it("returns false when EBAY_CLIENT_SECRET is missing", () => {
      vi.stubEnv("EBAY_APP_ID", "test-id");
      vi.stubEnv("EBAY_CLIENT_SECRET", "");
      expect(isBrowseApiConfigured()).toBe(false);
    });

    it("returns true when both credentials are set", () => {
      vi.stubEnv("EBAY_APP_ID", "test-id");
      vi.stubEnv("EBAY_CLIENT_SECRET", "test-secret");
      expect(isBrowseApiConfigured()).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/__tests__/ebayBrowse.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement OAuth token management and configuration check**

Create `src/lib/ebayBrowse.ts` with:
- `isBrowseApiConfigured()` — checks both `EBAY_APP_ID` and `EBAY_CLIENT_SECRET`
- `getOAuthToken()` — fetches OAuth 2.0 client credentials token from `https://api.ebay.com/identity/v1/oauth2/token` (or sandbox URL if `EBAY_SANDBOX=true`)
- In-memory token cache using eBay's `expires_in` response field (with 1-minute safety margin) and auto-refresh
- Mutex pattern: if a token refresh is already in-flight, subsequent callers await the same promise instead of triggering parallel refreshes
- Base URL constant: production `https://api.ebay.com/buy/browse/v1` vs sandbox `https://api.sandbox.ebay.com/buy/browse/v1`
- All errors logged with `[ebay-browse]` prefix

```typescript
const COMIC_BOOK_CATEGORY_ID = "259104";
const BROADER_CATEGORY_ID = "63";
let cachedToken: { token: string; expiresAt: number } | null = null;
let tokenRefreshPromise: Promise<string | null> | null = null;

export function isBrowseApiConfigured(): boolean {
  return !!(process.env.EBAY_APP_ID && process.env.EBAY_CLIENT_SECRET);
}

function getBaseUrl(): string {
  return process.env.EBAY_SANDBOX === "true"
    ? "https://api.sandbox.ebay.com/buy/browse/v1"
    : "https://api.ebay.com/buy/browse/v1";
}

function getAuthUrl(): string {
  return process.env.EBAY_SANDBOX === "true"
    ? "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
    : "https://api.ebay.com/identity/v1/oauth2/token";
}

async function fetchNewToken(): Promise<string | null> {
  const clientId = process.env.EBAY_APP_ID!;
  const clientSecret = process.env.EBAY_CLIENT_SECRET!;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const response = await fetch(getAuthUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
    });

    if (!response.ok) {
      console.error(`[ebay-browse] OAuth token fetch failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    // Use eBay's expires_in with a 1-minute safety margin instead of hardcoded TTL
    const expiresIn = (data.expires_in || 7200) * 1000;
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + expiresIn - 60_000, // 1 minute safety margin
    };
    return data.access_token;
  } catch (error) {
    console.error("[ebay-browse] OAuth token fetch error:", error);
    return null;
  }
}

async function getOAuthToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  if (tokenRefreshPromise) {
    return tokenRefreshPromise;
  }

  tokenRefreshPromise = fetchNewToken().finally(() => {
    tokenRefreshPromise = null;
  });

  return tokenRefreshPromise;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/__tests__/ebayBrowse.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ebayBrowse.ts src/lib/__tests__/ebayBrowse.test.ts
git commit -m "feat: ebayBrowse OAuth token management and configuration check"
```

---

## Task 2: Create `ebayBrowse.ts` — Keyword Building & Outlier Filtering

**Files:**
- Modify: `src/lib/ebayBrowse.ts`
- Modify: `src/lib/__tests__/ebayBrowse.test.ts`

- [ ] **Step 1: Write failing tests for keyword building**

```typescript
describe("buildSearchKeywords", () => {
  it("builds basic title + issue query", () => {
    expect(buildSearchKeywords({ title: "Amazing Spider-Man", issueNumber: "#300" }))
      .toBe("Amazing Spider-Man 300");
  });

  it("strips apostrophes and colons", () => {
    expect(buildSearchKeywords({ title: "Marvel's Spider-Man: Miles Morales", issueNumber: "1" }))
      .toBe("Marvels Spider-Man Miles Morales 1");
  });

  it("adds grading company and grade for slabbed", () => {
    expect(buildSearchKeywords({
      title: "Batman",
      issueNumber: "423",
      isSlabbed: true,
      gradingCompany: "CGC",
      grade: 9.8,
    })).toBe("Batman 423 CGC 9.8");
  });

  it("defaults to CGC when slabbed without grading company", () => {
    expect(buildSearchKeywords({
      title: "Batman",
      issueNumber: "423",
      isSlabbed: true,
      grade: 9.4,
    })).toBe("Batman 423 CGC 9.4");
  });

  it("formats integer grades with decimal", () => {
    expect(buildSearchKeywords({
      title: "X-Men",
      issueNumber: "1",
      isSlabbed: true,
      gradingCompany: "CBCS",
      grade: 9,
    })).toBe("X-Men 1 CBCS 9.0");
  });

  it("handles title-only query (no issue number)", () => {
    expect(buildSearchKeywords({ title: "Spawn" })).toBe("Spawn");
  });
});
```

- [ ] **Step 2: Write failing tests for outlier filtering and median calculation**

```typescript
describe("filterOutliersAndCalculateMedian", () => {
  it("calculates median for odd number of prices", () => {
    const result = filterOutliersAndCalculateMedian([100, 200, 300]);
    expect(result.medianPrice).toBe(200);
  });

  it("calculates median for even number of prices", () => {
    const result = filterOutliersAndCalculateMedian([100, 200, 300, 400]);
    expect(result.medianPrice).toBe(250);
  });

  it("removes outliers above 3x median", () => {
    const result = filterOutliersAndCalculateMedian([100, 110, 120, 10000]);
    expect(result.filteredPrices).not.toContain(10000);
  });

  it("removes outliers below 0.2x median", () => {
    const result = filterOutliersAndCalculateMedian([1, 100, 110, 120]);
    expect(result.filteredPrices).not.toContain(1);
  });

  it("returns null median when fewer than 3 prices", () => {
    const result = filterOutliersAndCalculateMedian([100, 200]);
    expect(result.medianPrice).toBeNull();
    expect(result.totalResults).toBe(2);
  });

  it("returns null for empty array", () => {
    const result = filterOutliersAndCalculateMedian([]);
    expect(result.medianPrice).toBeNull();
  });

  it("handles single-price array", () => {
    const result = filterOutliersAndCalculateMedian([500]);
    expect(result.medianPrice).toBeNull();
    expect(result.totalResults).toBe(1);
  });

  it("returns null median when filtering removes all but fewer than 3 prices", () => {
    // median of [1, 100, 10000] is 100
    // 1 < 0.2*100=20 (removed), 10000 > 3*100=300 (removed)
    // Only 100 remains, which is < 3 threshold
    const result = filterOutliersAndCalculateMedian([1, 100, 10000]);
    expect(result.medianPrice).toBeNull();
    expect(result.totalResults).toBe(3);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- src/lib/__tests__/ebayBrowse.test.ts`
Expected: FAIL — functions not exported

- [ ] **Step 4: Implement keyword building and outlier filtering**

Add to `src/lib/ebayBrowse.ts`:

```typescript
// Reuse FindingSearchParams shape for keyword building
interface SearchKeywordParams {
  title: string;
  issueNumber?: string;
  grade?: number;
  isSlabbed?: boolean;
  gradingCompany?: string;
}

export function buildSearchKeywords(params: SearchKeywordParams): string {
  const { title, issueNumber, grade, isSlabbed, gradingCompany } = params;

  let keywords = title
    .trim()
    .replace(/[':;]/g, "")
    .replace(/\s+/g, " ");

  if (issueNumber) {
    const cleanIssue = issueNumber.replace(/^#/, "").trim();
    keywords += ` ${cleanIssue}`;
  }

  if (isSlabbed) {
    keywords += ` ${gradingCompany || "CGC"}`;
    if (grade) {
      const formattedGrade = Number.isInteger(grade) ? `${grade}.0` : `${grade}`;
      keywords += ` ${formattedGrade}`;
    }
  }

  return keywords;
}

const MIN_LISTINGS_THRESHOLD = 3;

export function filterOutliersAndCalculateMedian(prices: number[]): {
  medianPrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  filteredPrices: number[];
  totalResults: number;
} {
  if (prices.length === 0) {
    return { medianPrice: null, highPrice: null, lowPrice: null, filteredPrices: [], totalResults: 0 };
  }

  const sorted = [...prices].sort((a, b) => a - b);
  const rawMedian = sorted.length % 2 === 1
    ? sorted[Math.floor(sorted.length / 2)]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

  // Filter outliers using raw median as reference
  const filtered = sorted.filter(
    (p) => p <= rawMedian * 3 && p >= rawMedian * 0.2
  );

  if (filtered.length < MIN_LISTINGS_THRESHOLD) {
    return {
      medianPrice: null,
      highPrice: null,
      lowPrice: null,
      filteredPrices: filtered,
      totalResults: prices.length,
    };
  }

  // Recalculate median on filtered set
  const median = filtered.length % 2 === 1
    ? filtered[Math.floor(filtered.length / 2)]
    : (filtered[filtered.length / 2 - 1] + filtered[filtered.length / 2]) / 2;

  return {
    medianPrice: Math.round(median * 100) / 100,
    highPrice: filtered[filtered.length - 1],
    lowPrice: filtered[0],
    filteredPrices: filtered,
    totalResults: prices.length,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/lib/__tests__/ebayBrowse.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/ebayBrowse.ts src/lib/__tests__/ebayBrowse.test.ts
git commit -m "feat: ebayBrowse keyword building and outlier filtering with median"
```

---

## Task 3: Create `ebayBrowse.ts` — Grade Multipliers & PriceData Conversion

**Files:**
- Modify: `src/lib/ebayBrowse.ts`
- Modify: `src/lib/__tests__/ebayBrowse.test.ts`

- [ ] **Step 1: Write failing tests for grade multipliers**

```typescript
describe("generateGradeEstimates", () => {
  it("generates 6 grade levels", () => {
    const estimates = generateGradeEstimates(100);
    expect(estimates).toHaveLength(6);
  });

  it("uses 9.4 NM as 1.0x multiplier for raw", () => {
    const estimates = generateGradeEstimates(100);
    const nm = estimates.find((e) => e.grade === 9.4);
    expect(nm?.rawValue).toBe(100);
  });

  it("applies slab premium (~30%)", () => {
    const estimates = generateGradeEstimates(100);
    const nm = estimates.find((e) => e.grade === 9.4);
    expect(nm?.slabbedValue).toBe(130);
  });

  it("9.8 is highest multiplier", () => {
    const estimates = generateGradeEstimates(100);
    const nmm = estimates.find((e) => e.grade === 9.8);
    expect(nmm?.rawValue).toBe(250);
  });

  it("2.0 is lowest multiplier", () => {
    const estimates = generateGradeEstimates(100);
    const good = estimates.find((e) => e.grade === 2.0);
    expect(good?.rawValue).toBe(10);
  });
});
```

- [ ] **Step 2: Write failing tests for convertToPriceData**

```typescript
describe("convertBrowseToPriceData", () => {
  it("returns PriceData with median as estimatedValue", () => {
    const result = convertBrowseToPriceData(
      { medianPrice: 200, highPrice: 300, lowPrice: 100, totalResults: 10, searchQuery: "test", listings: [] },
      9.4,
      false
    );
    expect(result?.estimatedValue).toBe(200);
    expect(result?.priceSource).toBe("ebay");
    expect(result?.disclaimer).toBe("Based on current eBay listings");
  });

  it("returns empty recentSales (Browse API has no sold data)", () => {
    const result = convertBrowseToPriceData(
      { medianPrice: 200, highPrice: 300, lowPrice: 100, totalResults: 10, searchQuery: "test", listings: [] },
      9.4,
      false
    );
    expect(result?.recentSales).toEqual([]);
    expect(result?.mostRecentSaleDate).toBeNull();
  });

  it("returns null when medianPrice is null", () => {
    const result = convertBrowseToPriceData(
      { medianPrice: null, highPrice: null, lowPrice: null, totalResults: 1, searchQuery: "test", listings: [] },
      9.4,
      false
    );
    expect(result).toBeNull();
  });

  it("selects correct grade estimate for requested grade", () => {
    const result = convertBrowseToPriceData(
      { medianPrice: 200, highPrice: 300, lowPrice: 100, totalResults: 10, searchQuery: "test", listings: [] },
      9.8,
      false
    );
    // 9.8 raw multiplier is 2.5x, base is at 9.4 (1.0x), so basePrice = 200
    // 9.8 rawValue = 200 * 2.5 = 500
    expect(result?.estimatedValue).toBe(500);
  });

  it("selects slabbed value when isSlabbed is true", () => {
    const result = convertBrowseToPriceData(
      { medianPrice: 200, highPrice: 300, lowPrice: 100, totalResults: 10, searchQuery: "test", listings: [] },
      9.8,
      true
    );
    // 9.8 slab multiplier is 3.0x, basePrice = 200
    expect(result?.estimatedValue).toBe(600);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- src/lib/__tests__/ebayBrowse.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement grade multipliers and PriceData conversion**

Add to `src/lib/ebayBrowse.ts`:

```typescript
import type { PriceData, GradeEstimate } from "@/types/comic";

export function generateGradeEstimates(basePrice: number): GradeEstimate[] {
  const gradeData = [
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

export function convertBrowseToPriceData(
  result: BrowsePriceResult,
  requestedGrade?: number,
  isSlabbed?: boolean
): PriceData | null {
  if (result.medianPrice === null) {
    return null;
  }

  // Assumption: the median listing price is treated as the price for a 9.4 NM raw copy.
  // This is the baseline for grade multipliers because the 9.4 grade has a 1.0x multiplier.
  // NOTE: When the Browse API search is NOT grade-specific (raw comics), the median may
  // include listings across multiple grades. The grade multiplier math treats this median
  // as the 9.4 baseline, which may slightly over- or under-estimate other grades. This is
  // a known trade-off accepted in the design for simplicity.
  const basePrice = result.medianPrice;
  const gradeEstimates = generateGradeEstimates(basePrice);

  let estimatedValue: number | null = basePrice;
  if (requestedGrade && gradeEstimates.length > 0) {
    const gradeEstimate = gradeEstimates.find((g) => g.grade === requestedGrade);
    if (gradeEstimate) {
      estimatedValue = isSlabbed ? gradeEstimate.slabbedValue : gradeEstimate.rawValue;
    }
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/lib/__tests__/ebayBrowse.test.ts`
Expected: PASS

> **Verification note:** Verify `src/lib/gradePrice.ts` still works correctly — it uses `priceData.estimatedValue` which will now come from Browse API median instead of Finding API average. No code changes needed but confirm during testing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ebayBrowse.ts src/lib/__tests__/ebayBrowse.test.ts
git commit -m "feat: ebayBrowse grade multipliers and PriceData conversion"
```

---

## Task 4: Create `ebayBrowse.ts` — Browse API Search & URL Builder

**Files:**
- Modify: `src/lib/ebayBrowse.ts`
- Modify: `src/lib/__tests__/ebayBrowse.test.ts`

- [ ] **Step 1: Write failing tests for Browse API response parsing**

```typescript
describe("parseBrowseResponse", () => {
  it("extracts items from Browse API response format", () => {
    const mockResponse = {
      total: 5,
      itemSummaries: [
        {
          itemId: "v1|123",
          title: "Amazing Spider-Man #300",
          price: { value: "425.00", currency: "USD" },
          condition: "NEW",
          itemWebUrl: "https://www.ebay.com/itm/123",
          image: { imageUrl: "https://i.ebayimg.com/123.jpg" },
          buyingOptions: ["FIXED_PRICE"],
        },
        {
          itemId: "v1|456",
          title: "Amazing Spider-Man #300 CGC 9.4",
          price: { value: "530.00", currency: "USD" },
          condition: "LIKE_NEW",
          itemWebUrl: "https://www.ebay.com/itm/456",
          buyingOptions: ["FIXED_PRICE"],
        },
      ],
    };
    const items = parseBrowseResponse(mockResponse);
    expect(items).toHaveLength(2);
    expect(items[0].price).toBe(425);
    expect(items[0].condition).toBe("NEW");
    expect(items[1].price).toBe(530);
  });

  it("returns empty array for no results", () => {
    const items = parseBrowseResponse({ total: 0 });
    expect(items).toEqual([]);
  });

  it("handles missing optional fields", () => {
    const mockResponse = {
      total: 1,
      itemSummaries: [{
        itemId: "v1|789",
        title: "Test Comic",
        price: { value: "50.00", currency: "USD" },
        condition: "GOOD",
        itemWebUrl: "https://www.ebay.com/itm/789",
        buyingOptions: ["FIXED_PRICE"],
      }],
    };
    const items = parseBrowseResponse(mockResponse);
    expect(items[0].imageUrl).toBeUndefined();
  });
});
```

- [ ] **Step 2: Write failing tests for buildEbaySearchUrl**

```typescript
describe("buildEbaySearchUrl", () => {
  it("builds basic search URL with sold filters", () => {
    const url = buildEbaySearchUrl("Amazing Spider-Man", "300");
    expect(url).toContain("_nkw=Amazing%20Spider-Man%20300");
    expect(url).toContain("LH_Complete=1");
    expect(url).toContain("LH_Sold=1");
  });

  it("includes CGC and grade for slabbed", () => {
    const url = buildEbaySearchUrl("Batman", "423", 9.8, true);
    expect(url).toContain("CGC");
    expect(url).toContain("9.8");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- src/lib/__tests__/ebayBrowse.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement Browse API search, response parsing, and URL builder**

> **Implementation note:** Verify the Browse API filter syntax `priceCurrency:USD,buyingOptions:{FIXED_PRICE}` against eBay's current API documentation during implementation. The curly brace syntax may vary.

> **URLSearchParams encoding note:** `URLSearchParams` will URL-encode `{` and `}` to `%7B` and `%7D`. If the eBay Browse API rejects encoded curly braces, construct the URL string manually: `` `${getBaseUrl()}/item_summary/search?q=${encodeURIComponent(keywords)}&category_ids=${categoryId}&filter=priceCurrency:USD,buyingOptions:{FIXED_PRICE}&limit=30` `` instead of using `URLSearchParams`.

Add to `src/lib/ebayBrowse.ts`:

```typescript
export function parseBrowseResponse(data: Record<string, unknown>): BrowseListingItem[] {
  const summaries = (data.itemSummaries as Record<string, unknown>[]) || [];
  return summaries.map((item) => ({
    itemId: item.itemId as string,
    title: item.title as string,
    price: parseFloat((item.price as { value: string }).value),
    currency: (item.price as { currency: string }).currency,
    condition: (item.condition as string) || "UNKNOWN",
    itemUrl: item.itemWebUrl as string,
    imageUrl: (item.image as { imageUrl?: string })?.imageUrl,
  }));
}

export async function searchActiveListings(
  title: string,
  issueNumber?: string,
  grade?: number,
  isSlabbed?: boolean,
  gradingCompany?: string
): Promise<BrowsePriceResult | null> {
  if (!isBrowseApiConfigured()) {
    console.error("[ebay-browse] Browse API not configured — missing EBAY_APP_ID or EBAY_CLIENT_SECRET");
    return null;
  }

  const token = await getOAuthToken();
  if (!token) {
    return null;
  }

  const keywords = buildSearchKeywords({ title, issueNumber, grade, isSlabbed, gradingCompany });

  // Try with specific category, fall back to no category
  const categoryAttempts = [COMIC_BOOK_CATEGORY_ID, BROADER_CATEGORY_ID, null];

  for (const categoryId of categoryAttempts) {
    const params = new URLSearchParams({
      q: keywords,
      filter: "priceCurrency:USD,buyingOptions:{FIXED_PRICE}",
      limit: "30",
    });
    if (categoryId) {
      params.set("category_ids", categoryId);
    }

    const url = `${getBaseUrl()}/item_summary/search?${params.toString()}`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error(`[ebay-browse] API error ${response.status}: ${errorText}`);
        return null;
      }

      const data = await response.json();
      const listings = parseBrowseResponse(data);

      if (listings.length > 0 || !categoryId) {
        // Got results, or this was our last attempt (no category filter)
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
      }

      // No results with category — try without
      console.log(`[ebay-browse] No results for "${keywords}" in category ${categoryId}, retrying without category`);
    } catch (error) {
      console.error("[ebay-browse] Search error:", error);
      return null;
    }
  }

  return { listings: [], medianPrice: null, highPrice: null, lowPrice: null, totalResults: 0, searchQuery: keywords };
}

export function buildEbaySearchUrl(
  title: string,
  issueNumber?: string,
  grade?: number,
  isSlabbed?: boolean
): string {
  let query = title.trim();

  if (issueNumber) {
    const cleanIssue = issueNumber.replace(/^#/, "").trim();
    query += ` #${cleanIssue}`;
  }

  if (isSlabbed) {
    query += " CGC";
    if (grade) {
      const formattedGrade = Number.isInteger(grade) ? `${grade}.0` : `${grade}`;
      query += ` ${formattedGrade}`;
    }
  }

  const encodedQuery = encodeURIComponent(query);
  return `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}&_sacat=259104&_sop=12&LH_Complete=1&LH_Sold=1`;
}
```

> **Behavioral change note:** The original `buildEbaySearchUrl` in `ebayFinding.ts` used `LH_BIN=1` (Buy It Now only). The new version uses `LH_Complete=1&LH_Sold=1` (sold listings). This is intentional per the spec — the "Recent Sales on eBay" button should link to sold/completed listings for price research. Additionally, the issue number now includes a `#` prefix (`#${cleanIssue}`) for better eBay search results. The original `ebayFinding.ts` version omitted the `#`. This matches the existing inline `buildEbaySearchUrl` in `KeyHuntPriceResult.tsx` (line 92).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/lib/__tests__/ebayBrowse.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/ebayBrowse.ts src/lib/__tests__/ebayBrowse.test.ts
git commit -m "feat: ebayBrowse search, response parsing, and URL builder"
```

---

## Task 5: Update API Route — `con-mode-lookup`

**Files:**
- Modify: `src/app/api/con-mode-lookup/route.ts` (line 8: import, lines 91-315: eBay + AI sections)

- [ ] **Step 1: Swap import from ebayFinding to ebayBrowse**

Change line 8:
```typescript
// OLD:
import { isFindingApiConfigured, lookupEbaySoldPrices } from "@/lib/ebayFinding";
// NEW:
import { isBrowseApiConfigured, searchActiveListings, convertBrowseToPriceData } from "@/lib/ebayBrowse";
```

- [ ] **Step 2: Replace eBay Finding API call with Browse API call**

Replace the `isFindingApiConfigured()` check and `lookupEbaySoldPrices()` call (around lines 91-137) with:
```typescript
if (isBrowseApiConfigured()) {
  const browseResult = await searchActiveListings(title, issueNumber, grade, isSlabbed, gradingCompany);
  if (browseResult) {
    const priceData = convertBrowseToPriceData(browseResult, grade, isSlabbed);
    if (priceData) {
      // Cache and return eBay data
      ebayPriceData = priceData;
    }
  }
}
```

Also pass `browseResult.totalResults` and `browseResult.searchQuery` to the response when `convertBrowseToPriceData` returns null:
```typescript
if (!priceData && browseResult.totalResults > 0) {
  // Below threshold — pass listing count so UI can show "X active listings found"
  return NextResponse.json({
    ...baseResponse,
    priceData: null,
    totalListings: browseResult.totalResults,
    ebaySearchQuery: browseResult.searchQuery,
  });
}
```

- [ ] **Step 3: Remove AI price estimation fallback (Tier 3)**

Remove the Claude API fallback section (lines 181-315 — the entire AI fallback block including scan analytics recording and response return for the AI path — all unreachable without the AI fallback). Keep `fetchKeyInfoFromAI()` call — that provides key issue facts (first appearances, etc.), NOT prices.

Also update fallback disclaimer text at lines 136 and 152 from "Based on recent eBay sold listings" to "Based on current eBay listings" for consistency with Browse API (which uses active listings, not sold listings).

Update stale comment at line 91: 'eBay Finding API for real sold listing data' -> 'eBay Browse API for active listing data'.

- [ ] **Step 4: When no eBay data, return priceData as null and cache the miss**

Ensure that when Browse API returns no data or returns fewer than 3 listings, the route returns `priceData: null` with `totalListings` count so the UI can show "X active listings found" link.

> **"No data" caching:** When Browse API returns no results, cache a "no data" marker in Redis for 1 hour (matching the existing pattern in the codebase). This prevents hammering the eBay API for comics with no listings.

> **Transition window note:** Between deploy and running the SQL migration (Task 13), the database cache path (lines 56-85) may still serve cached `priceSource: 'ai'` data. The SQL migration in Task 13 MUST be run promptly after deploy. Add the guard at line 57, before the DB cache is used: `if (dbResult && dbResult.priceData && dbResult.priceData.priceSource === 'ebay')` — this is the most defensive guard — only eBay-sourced cached data is served from the DB cache. Records with `priceSource: undefined` (pre-migration) or `priceSource: 'ai'` are both skipped. The SQL migration in Task 13 clears these records permanently.

- [ ] **Step 5: Update `ConModeLookupResult` source type**

Update the `ConModeLookupResult` source type at line 34: change `source: "database" | "ebay" | "ai"` to `source: "database" | "ebay"`. The `"ai"` option is no longer possible after removing the AI fallback.

Also add these fields to the `ConModeLookupResult` type:
```typescript
totalListings?: number;
ebaySearchQuery?: string;
```

- [ ] **Step 6: Note semantic changes to ConModeLookupResult**

> **Interface change:** With Browse API, the `ConModeLookupResult` response will have `recentSale` always set to `null` and `source` will never be `"ai"`. Consumers of this route (KeyHuntPriceResult, KeyHuntHistoryDetail) should be aware of this semantic change — they must handle `recentSale: null` gracefully (Task 9 and Task 11 address this).

- [ ] **Step 7: Run the app and verify the route compiles**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 8: Commit**

```bash
git add src/app/api/con-mode-lookup/route.ts
git commit -m "feat: con-mode-lookup route uses Browse API, removes AI price fallback"
```

---

## Task 6: Update API Route — `analyze`

**Files:**
- Modify: `src/app/api/analyze/route.ts` (line 18: import, lines ~701-749: eBay section)

- [ ] **Step 1: Swap import from ebayFinding to ebayBrowse**

Change line 18:
```typescript
// OLD:
import { isFindingApiConfigured, lookupEbaySoldPrices } from "@/lib/ebayFinding";
// NEW:
import { isBrowseApiConfigured, searchActiveListings, convertBrowseToPriceData } from "@/lib/ebayBrowse";
```

- [ ] **Step 2: Replace eBay Finding API call with Browse API**

Replace the `isFindingApiConfigured()` check and `lookupEbaySoldPrices()` call with equivalent Browse API code. Keep the Redis cache pattern (change TTL to 12 hours = `12 * 60 * 60`).

- [ ] **Step 2b: Add transition window guard for Redis cache**

Add a guard in the Redis cache path (around line 714): if cached price data has `priceSource === 'ai'`, treat it as a cache miss and re-fetch from Browse API. This prevents serving stale AI prices during the transition window.

Modify the cache hit check at line 714 to: `if (!('noData' in cachedResult) && (cachedResult as PriceData).priceSource !== 'ai')` — this skips AI-cached entries during the transition window.

> **Redis transition note:** Cached entries with `priceSource: undefined` (from pre-migration eBay Finding API data) will pass this guard and may serve stale Finding API prices. These entries will naturally expire within 24 hours (the current Redis TTL). No additional handling needed — the data is stale but was originally eBay-sourced, not AI-fabricated.

- [ ] **Step 3: Actively clean up dead AI price estimation code**

The analyze/route.ts has three live "Technopathic estimate" disclaimer strings at lines ~830, 837, 842 inside the priceResult processing block — remove them. Also remove the dead `if (false)` block around line ~758 that wraps the old AI price estimation code. Don't just verify it's disabled — actively delete the dead code and stale strings.

**After removing the `if (false)` block (lines 757-874), systematically remove ALL `priceMeta` references:**
- Remove `priceMeta` declaration at line 692 (`let priceMeta = { provider: p1, fallbackUsed: false, fallbackReason: null as string | null }`)
- Remove `priceMeta.fallbackUsed` from the OR chain at line 954 (meta `_meta.fallbackUsed`)
- Remove `priceMeta.fallbackReason` from line 955 (meta `_meta.fallbackReason`)
- Remove `priceMeta.fallbackUsed` from scan analytics at line 973
- Remove `priceMeta.fallbackReason` from scan analytics at line 974
- Remove `priceMeta.fallbackUsed` from line 981
- Remove `priceMeta.fallbackReason` from line 982
- Set `callDetails.priceEstimation: null` at lines 990-992 (keep the field as null for now; it will be removed from the type in Task 12)
- Also update the type annotation at line 65: remove `| 'ai'` from priceSource
- Consider referencing the PriceData type directly rather than redeclaring a narrowed intersection type at line 65
- This intersection type bridge is temporary — after Task 12 narrows the base `PriceData.priceSource` type, the local override at line 65 can be simplified to just use `PriceData` directly

**Type bridge note:** Set `callDetails.priceEstimation` to `null` here (not removed from the type yet — Task 12 Step 4 handles the type narrowing later). This ensures the build passes between tasks.

- [ ] **Step 3b: Update stale comments in analyze/route.ts**

Update stale comments: line 699 ('real sold listings' -> 'active listings'), line 721 ('fall back to AI' -> 'no pricing data shown').

- [ ] **Step 4: Run build to verify**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat: analyze route uses Browse API for pricing"
```

---

## Task 7: Update API Routes — `quick-lookup`, `comic-lookup`, and `import-lookup`

**Files:**
- Modify: `src/app/api/quick-lookup/route.ts` (lines 174-257: AI price generation)
- Modify: `src/app/api/comic-lookup/route.ts` (remove AI price generation)
- Modify: `src/app/api/import-lookup/route.ts` (remove AI price generation)

- [ ] **Step 1: Remove AI price generation from quick-lookup (preserve keyInfo)**

The `quick-lookup` route does NOT use `ebayFinding.ts` — it generates prices purely through Claude AI. The AI prompt asks for BOTH keyInfo AND pricing. Simply deleting the entire section loses keyInfo. Restructure the Claude prompt (lines 174-205) to only ask for `keyInfo` — remove all pricing-related fields (`estimatedValue`, `gradeEstimates`, `recentSale`) from the prompt schema and response parsing. Keep the keyInfo lookup intact. Set `priceData: null` in the response. Remove the pricing disclaimer at line 233.

Add a transition guard in the DB cache path (around line 112): if cached priceData has `priceSource !== 'ebay'` (catches both `'ai'` and `undefined`/`null`), set `priceData: null`. This is more defensive than checking `!== 'ai'` since `quick-lookup` records may have no `priceSource` set.

- [ ] **Step 2: Remove the disclaimer text and fix DB cache disclaimer in quick-lookup**

Remove line ~233: `"Technopathic estimates based on market knowledge. Actual prices may vary."`

Also update the stale disclaimer at line 133 in the database cache return path: change `"Values are estimates based on market knowledge."` to `"Based on current eBay listings"` or null.

For the DB cache path at lines 111-136: if `priceData.priceSource !== 'ebay'`, set `priceData: null` in the response. This ensures only eBay-sourced cached data is returned; AI-sourced cached data is suppressed.

- [ ] **Step 3: Remove AI price generation from comic-lookup**

The `comic-lookup` route generates prices through AI the same way as `quick-lookup`. Update the Claude prompt in `fetchFromClaudeAPI` (lines 229-279) to NOT ask for pricing data — remove the priceData section from the prompt schema. Explicitly remove the local `PriceData` interface (lines 21-27) and the `GradeEstimate` interface (lines 14-19) — these are no longer needed since no pricing data is generated. Also remove the `priceData` field from the `saveComicMetadata` call (lines 145-157) — do not save any price data from this route. Set `priceData: null` in both the DB save and the API response. Remove the pricing disclaimer at lines 314-315. The `source: 'ai'` in the route response at line 173 refers to the metadata origin (the data came from an AI lookup), NOT price estimation. This is accurate and should remain as-is. Only remove pricing-related AI code, not the metadata source indicator.

Add a transition guard in the Redis cache path (around line 91): if cached priceData has `priceSource !== 'ebay'`, set `priceData: null`.

> **Type note:** The local `PriceData` interface (lines 21-27) does not include `priceSource`. Since this interface is being deleted in this step, add the Redis cache guard AFTER deleting the local interface — the cached `ComicLookupResult` object will then use the base `PriceData` type from `comic.ts` which includes `priceSource`. Guard the cache read with: `if (redisCached?.priceData && (redisCached.priceData as Record<string, unknown>).priceSource !== 'ebay') { redisCached.priceData = undefined; }`

Also update the stale disclaimer at lines 116-117 in the DB cache return path: set to `null` — this route does not use eBay, so an eBay disclaimer would be misleading.

- [ ] **Step 4: Remove AI price generation from import-lookup**

The `import-lookup` route also generates prices through AI. Update the Claude prompt (lines 69-108) to NOT request `estimatedValue` or `gradeEstimates`. Remove pricing fields from the response parsing. Set `priceData: null`. The `source: 'ai'` in the route response at line 205 refers to the metadata origin (the data came from an AI lookup), NOT price estimation. This is accurate and should remain as-is. Only remove pricing-related AI code, not the metadata source indicator.

Check `dbResult.priceData.priceSource` on the raw DB result object (at line 32) rather than the reconstructed priceData. Since `import-lookup` never calls eBay, the simplest approach is to always set `priceData: null` in the DB cache response, preserving only keyInfo and metadata. The reconstructed priceData object (lines 35-45) does not include `priceSource`, so checking it on the reconstructed object would always be `undefined`.

Also update the fallback disclaimer at line 43: set to `null` — this route does not use eBay.

- [ ] **Step 5: Run build to verify**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add src/app/api/quick-lookup/route.ts src/app/api/comic-lookup/route.ts src/app/api/import-lookup/route.ts
git commit -m "feat: quick-lookup, comic-lookup, and import-lookup remove AI price generation"
```

---

## Task 8: Update API Routes — `ebay-prices` and `hottest-books`

**Files:**
- Modify: `src/app/api/ebay-prices/route.ts` (line 30: import, lines 118-124: lookup call)
- Modify: `src/app/api/hottest-books/route.ts` (line 8: import, line 110: lookup call)

- [ ] **Step 1: Update ebay-prices route**

Swap import at line 30:
```typescript
import { isBrowseApiConfigured, searchActiveListings, convertBrowseToPriceData } from "@/lib/ebayBrowse";
```
Replace `lookupEbaySoldPrices()` call at lines 118-124 with `searchActiveListings()` + `convertBrowseToPriceData()`. Update Redis cache TTL to 12 hours (`12 * 60 * 60`).

Also fix the no-data cache TTL: change `cacheSet(cacheKey, { noData: true }, "ebayPrice")` (line 137) to `cacheSet(cacheKey, { noData: true }, "ebayPrice", 60 * 60)` to use an explicit 1-hour TTL for no-data results, matching the design spec.

Update the file header JSDoc comment (lines 1-16) from 'Fetches recent sold listings from eBay' to 'Fetches active listings from eBay for comic book pricing'.

Also clean up the stale comment at line 148: `// Return graceful failure - let caller use AI estimates` — change it to `// Return graceful failure - no pricing data available`.

- [ ] **Step 2b: Update default eBay cache TTL in cache.ts**

Update `src/lib/cache.ts` line 27: change `ebayPrice: 60 * 60 * 24` (24 hours) to `ebayPrice: 60 * 60 * 12` (12 hours) to match the design spec. This affects all callers using the `ebayPrice` cache prefix. Add `src/lib/cache.ts` to the Task 8 commit.

- [ ] **Step 2: Update hottest-books route**

Swap import at line 8:
```typescript
import { isBrowseApiConfigured, searchActiveListings, convertBrowseToPriceData } from "@/lib/ebayBrowse";
```
Replace `lookupEbaySoldPrices()` call at line 110 with Browse API equivalent.

The `fetchEbayPrices` function (lines 79-131) currently extracts `{low, mid, high}` from `recentSales`. With Browse API, `recentSales` is empty — call `searchActiveListings` directly (NOT `convertBrowseToPriceData`) and extract `{low, mid, high}` from `BrowsePriceResult`.

**IMPORTANT:** The existing Redis cache stores `PriceData` objects, but the new `fetchEbayPrices` calls `searchActiveListings` directly and reads `BrowsePriceResult` fields. To avoid cache format conflicts: (a) Use a different cache key prefix (e.g., `ebayBrowse:` instead of `ebayPrice:`) to avoid reading stale `PriceData` entries, OR (b) Cache the `{low, mid, high}` result directly with a new key format. The old cache entries will naturally expire. Update the cache read/write logic in the function accordingly.
```typescript
async function fetchEbayPrices(title: string, issueNumber: string): Promise<{ low: number; mid: number; high: number } | null> {
  const cacheKey = `ebayBrowse:hotbooks:${title}:${issueNumber}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    if ('noData' in (cached as Record<string, unknown>)) return null;
    return cached as { low: number; mid: number; high: number };
  }

  const result = await searchActiveListings(title, issueNumber);
  if (!result || result.medianPrice === null) {
    await cacheSet(cacheKey, { noData: true }, "ebayPrice", 60 * 60); // 1h for no-data
    return null;
  }
  const prices = {
    low: result.lowPrice ?? result.medianPrice,
    mid: result.medianPrice,
    high: result.highPrice ?? result.medianPrice,
  };
  await cacheSet(cacheKey, prices, "ebayPrice", 12 * 60 * 60); // 12h TTL
  return prices;
}
```
Note: Uses `ebayBrowse:hotbooks:` cache key prefix to avoid conflicts with stale `PriceData` format entries.

> **Note:** `src/lib/hotBooksData.ts` line 31 types `priceSource` as `string` — this is loose but won't break. Consider tightening in a follow-up.

- [ ] **Step 3: Note about hot_books `data_source: "ai"` — DO NOT REMOVE**

Lines 331-362 of `hottest-books/route.ts` write `price_source: "ai_estimate"` and `data_source: "ai"` to the `hot_books` table. The `data_source: 'ai'` in hot_books refers to how the book list is generated (via AI), not pricing. This is distinct from price estimation and should remain as-is — it's accurate metadata about the list generation method.

- [ ] **Step 4: Run build to verify**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ebay-prices/route.ts src/app/api/hottest-books/route.ts src/lib/cache.ts
git commit -m "feat: ebay-prices and hottest-books routes use Browse API"
```

---

## Task 9: Update UI — `KeyHuntPriceResult.tsx`

**Files:**
- Modify: `src/components/KeyHuntPriceResult.tsx` (lines 89-96: inline buildEbaySearchUrl, line 245-251: Raw/Slabbed labels, line 261: Technopathic disclaimer, lines 268-334: Most Recent Sale section)

- [ ] **Step 1: Change "Raw Value" / "Slabbed Value" labels to "Listed Value"**

Around lines 245-251, update the price label text. Also update the fallback label at line 250: change "Average Price (Last 5 Sales)" to "Listed Value".

- [ ] **Step 2: Remove "Technopathic Estimate" disclaimer**

Remove or replace the disclaimer at line 261. When source is eBay, show: "Based on current eBay listings"

- [ ] **Step 3: Remove "Most Recent Sale" section**

Remove lines 268-334 that display `recentSale` data. This data will always be empty with Browse API.

- [ ] **Step 4: Update default prop and remove AI conditional block**

Update the default prop value at line 70 from `source = "ai"` to `source = "ebay"`. Also remove the `source === "ai"` conditional rendering block at line 257 — this is dead code since source will never be `"ai"`. Also update the prop type definition at line 51: change `source?: "database" | "ebay" | "ai"` to `source?: "database" | "ebay"` — the `"ai"` option is no longer possible after this migration.

- [ ] **Step 5: Add below-threshold display**

When `totalListings` is provided in the API response but `priceData` is null (fewer than 3 listings), show "X active listings found" with a link to eBay search. The `totalListings` and `ebaySearchQuery` fields are passed through from the `ConModeLookupResult` response. Add `totalListings?: number` and `ebaySearchQuery?: string` to the `KeyHuntPriceResultProps` interface.

- [ ] **Step 6: Keep "Recent Sales on eBay" button**

The button at the bottom should remain — it links to sold listings on eBay (intentional, per spec). Keep the inline `buildEbaySearchUrl` function as-is since it correctly links to sold listings with `LH_Complete=1&LH_Sold=1`.

- [ ] **Step 7: Verify visually on localhost**

Open http://localhost:3000 and test Key Hunt price lookup. Verify labels, no AI disclaimers, no "Most Recent Sale".

- [ ] **Step 8: Commit**

```bash
git add src/components/KeyHuntPriceResult.tsx
git commit -m "feat: KeyHuntPriceResult shows Listed Value, removes AI estimates"
```

> **Follow-up consideration:** `buildEbaySearchUrl` now exists in both `ebayBrowse.ts` (module) and `KeyHuntPriceResult.tsx` (inline). Consider consolidating in a future cleanup, but not in this migration.

---

## Task 10: Update UI — `ComicDetailModal.tsx` and `ComicDetailsForm.tsx`

**Files:**
- Modify: `src/components/ComicDetailModal.tsx` (line 606: AI disclaimer, lines 568-597: recent sales)
- Modify: `src/components/ComicDetailsForm.tsx` (line 1366: AI disclaimer, lines 1325-1350: recent sales)

- [ ] **Step 1: Update ComicDetailModal.tsx**

- Replace "Technopathic Estimate" / "AI Estimate" disclaimer text at line 606 with "Based on current eBay listings"
- Update the 'Estimated Value' section heading at line 557 to 'Listed Value'
- Remove or hide the "Most Recent Sale" / recent sales section (lines 568-597) — guard with `recentSales.length > 0` check if not already guarded
- Remove or guard the `mostRecentSaleDate` display block at lines 568-577 — this will always be null with Browse API data
- Update any "Raw Value" / "Slabbed Value" labels to "Listed Value"
- Remove all 4 `priceSource === "ai"` conditional blocks at lines 579, 601, 616, 630. These become dead code since `priceSource` will never be `"ai"`. Simplify the rendering to always show the non-AI path.

- [ ] **Step 2: Update ComicDetailsForm.tsx**

- Replace "Technopathic Estimate" / "AI Estimate" disclaimer text at line 1366
- Update the 'Estimated Value' section heading at line 1309 to 'Listed Value'
- Remove or hide recent sales display (lines 1325-1350)
- Remove or guard the `mostRecentSaleDate` display block at lines 1325-1334
- Update price labels
- Remove all 4 `priceSource === "ai"` conditional blocks at lines 1338, 1361, 1377, 1391. Same treatment as ComicDetailModal — these are dead code.

- [ ] **Step 3: Update scan/page.tsx**

Update `src/app/scan/page.tsx` line 712: change `Estimated Value:{" "}` to `Listed Value:{" "}` (preserve the colon and JSX space formatting). This is a primary user flow — the scan results page. Add to commit.

- [ ] **Step 4: Review GradePricingBreakdown.tsx**

Review `src/components/GradePricingBreakdown.tsx` lines 76-77 and 122. The 'Raw' and 'Slabbed' column headers describe the comic's CONDITION (graded vs ungraded), not the price source. These are accurate and should remain as-is. Explicitly confirm no changes needed after review. If changes ARE needed after review, add the file to the Task 10 commit. If confirmed no changes needed (expected), no commit change required.

> **Below-threshold display note:** The below-threshold display ("X active listings found" with eBay link) is implemented in `KeyHuntPriceResult.tsx` (Task 9 Step 5). For `ComicDetailModal`, `ComicDetailsForm`, and `PublicComicModal`, the existing behavior of not showing a price when `estimatedValue` is null is sufficient — these components already handle null pricing gracefully. The detailed below-threshold UX is specific to the Key Hunt flow.

- [ ] **Step 5: Run build to verify**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add src/components/ComicDetailModal.tsx src/components/ComicDetailsForm.tsx src/app/scan/page.tsx
git commit -m "feat: ComicDetailModal and ComicDetailsForm show Listed Value"
```

---

## Task 11: Update UI — `PublicComicModal.tsx`, `KeyHuntHistoryDetail.tsx`, `useOffline.ts`, `key-hunt/page.tsx`

**Files:**
- Modify: `src/components/PublicComicModal.tsx` (lines 184-214: recent sales)
- Modify: `src/components/KeyHuntHistoryDetail.tsx` (lines 171-228: recent sale section)
- Modify: `src/hooks/useOffline.ts` (lines 155, 159: hardcoded strings)
- Modify: `src/app/key-hunt/page.tsx` (lines 404, 411: hardcoded strings)

- [ ] **Step 1: Update PublicComicModal.tsx**

Guard recent sales section with `recentSales?.length > 0` check. Also remove the `priceSource !== "ai"` guard at line 195 — replace it with the `recentSales?.length > 0` check (which is the correct guard going forward). Remove AI disclaimer text if present. Update the 'Estimated Value' heading at line 173 to 'Listed Value'.

- [ ] **Step 2: Update KeyHuntHistoryDetail.tsx**

Guard recent sale section (lines 171-228) with null check on `entry.priceResult.recentSale`. Update any price labels. Also update the "Average Price" label at line 160 to "Listed Value".

- [ ] **Step 3: Update useOffline.ts**

Replace hardcoded strings:
- Line 155: `source: "Technopathic Estimate"` → `source: "offline"`
- Line 159: `disclaimer: "Technopathic estimate"` → `disclaimer: null`

- [ ] **Step 4: Update key-hunt/page.tsx**

Before updating hardcoded strings, wire up the below-threshold display data flow:
- Add `totalListings?: number` and `ebaySearchQuery?: string` to the `LookupResult` interface (lines 63-76)
- In the con-mode-lookup response handler (around line 356 where `setLookupResult` is called), capture `totalListings` and `ebaySearchQuery` from the API response and include them in the `LookupResult` object
- At lines 873-905 where `<KeyHuntPriceResult>` is rendered, pass `totalListings={result.totalListings}` and `ebaySearchQuery={result.ebaySearchQuery}` as props

Replace ALL four price-related hardcoded strings:
- Line 404: `source: "Technopathic Estimate"` → `source: "offline"` (or appropriate source)
- Line 411: `disclaimer: "Technopathic estimate"` → `disclaimer: null`
- Line 520: `source: "Technopathic Estimate"` → `source: "offline"`
- Line 527: `disclaimer: "Technopathic estimate"` → `disclaimer: null`

Also update the type definition at line 75 to remove `"ai"` from the source union: change `source?: "database" | "ebay" | "ai"` to `source?: "database" | "ebay"`.

> **Note:** Line 595 contains `"technopathic recognition"` which is marketing copy about scanning capability, NOT pricing. Leave it alone — this is a separate branding decision (see "Revert Technopathy" command in CLAUDE.md).

- [ ] **Step 5: Update csvExport.ts**

Update `src/lib/csvExport.ts` line 50: change 'Estimated Value' CSV column header to 'Listed Value'. Add to commit.

- [ ] **Step 6: Update offlineCache.ts interfaces**

Verify that `offlineCache.ts` interfaces at lines 25, 44, and 292 already handle null/undefined `recentSale` (lines 25 and 44 use `| null`, line 292 uses `?`). No type changes needed — confirm existing types are compatible with always-null recentSale data.

- [ ] **Step 7: Update FAQ pricing text in Navigation.tsx**

Update `src/components/Navigation.tsx` line 77 — the FAQ answer about pricing accuracy. Change:
```
"Prices are AI estimates based on recent market trends and eBay sold listings. They provide a solid guideline but actual prices vary based on condition, demand, and where you sell. For the most accurate values, check recent eBay completed sales."
```
To:
```
"Prices are based on current eBay listings and may vary from actual sale prices. For the most accurate values, check recent eBay completed sales."
```

> **Note:** `AskProfessor.tsx` does not exist in the codebase — no duplicate to update.

- [ ] **Step 8: Update terms page pricing language**

Update `src/app/terms/page.tsx` lines 264-270: The terms currently say "When market data is unavailable, the AI may provide an estimated value with an appropriate disclaimer." Change to reflect new reality: pricing comes from current eBay listings only, with no AI fallback. Suggested text: "The Service provides pricing data sourced from current eBay listings. When market data is unavailable, no price is displayed." Add this file to the commit.

- [ ] **Step 9: Run build to verify**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 10: Commit**

```bash
git add src/components/PublicComicModal.tsx src/components/KeyHuntHistoryDetail.tsx src/hooks/useOffline.ts src/app/key-hunt/page.tsx src/components/Navigation.tsx src/lib/offlineCache.ts src/app/terms/page.tsx src/lib/csvExport.ts
git commit -m "feat: remove Technopathic branding from remaining components"
```

---

## Task 12: Delete `ebayFinding.ts`, Remove Dead AI Types & Functions, Run Full Test Suite

**Files:**
- Delete: `src/lib/ebayFinding.ts`
- Modify: `src/lib/providers/anthropic.ts` (remove `estimatePrice()` function only)
- Modify: `src/lib/providers/types.ts` (remove `PriceEstimationResult` interface)
- Modify: `src/types/comic.ts` (remove `"ai"` from `PriceData.priceSource` union)

- [ ] **Step 1: Verify no remaining imports of ebayFinding**

Run: `grep -r "ebayFinding" src/`
Expected: No results (all imports already swapped in Tasks 5-8)

- [ ] **Step 2: Delete the file**

```bash
rm src/lib/ebayFinding.ts
```

- [ ] **Step 3: Remove `estimatePrice()` function from anthropic provider**

In `src/lib/providers/anthropic.ts`, remove the `estimatePrice()` function. Also remove the `buildPriceEstimationPrompt` function (line 141 in anthropic.ts) — it takes `PriceEstimationRequest` as a parameter which will no longer exist. Do NOT delete the whole file — the anthropic provider is still used for cover recognition and other AI features. Only remove the price estimation function and its prompt builder.

- [ ] **Step 4: Remove `PriceEstimationResult` interface from types.ts, clean up AICallType, and check gemini provider**

In `src/lib/providers/types.ts`:
- Remove the `estimatePrice` method from the `AIProvider` interface (line 117).
- Remove both `PriceEstimationResult` and `PriceEstimationRequest` interfaces.
- Remove `"priceEstimation"` from the `AICallType` union (line 111).
- Remove the `priceEstimation` field from `ScanResponseMeta.callDetails` (lines 139-143).

> **Ordering dependency:** Remove `"priceEstimation"` from the `AICallType` union type BEFORE removing the corresponding `case` from the switch statements in `estimateCostCents()`. This prevents a temporary TypeScript exhaustiveness error.
- **After removing `priceEstimation` from `ScanResponseMeta.callDetails` type, also update `analyze/route.ts` to fully remove the `priceEstimation: null` field from the `_meta.callDetails` object (it was set to null in Task 6 as a bridge).**
- Verify no other consumers reference these types before deleting.

In `src/lib/providers/anthropic.ts`:
- Remove `case "priceEstimation"` from `estimateCostCents()` (line 333).

In `src/lib/providers/gemini.ts`:
- Remove the `estimatePrice` method if present.
- Remove `PriceEstimationRequest` and `PriceEstimationResult` imports (lines 20-21) — these imports will break compilation when the types are deleted from `types.ts`.
- Remove `buildPriceEstimationPrompt` import from `gemini.ts` line 10.
- Remove `case "priceEstimation"` from `estimateCostCents()` (line 133).

In test files:
- Remove `estimateCostCents("priceEstimation")` test assertions from `src/lib/providers/__tests__/anthropic.test.ts` (lines 97-98) and `src/lib/providers/__tests__/gemini.test.ts` (lines 50-51).

- [ ] **Step 5: Update `PriceData` interface in comic.ts**

In `src/types/comic.ts`, update the `PriceData` interface at line 58 to remove `"ai"` from the `priceSource` union type: change `priceSource?: "ebay" | "ai"` to `priceSource?: "ebay"`.

> **IMPORTANT:** Do NOT remove `'ai'` from `keyInfoSource` type in `src/types/comic.ts` (line 41) or `src/app/api/analyze/route.ts` (line 60). This refers to key comic facts from AI (first appearances, etc.), which is still used. Only PRICE-related `'ai'` references are being removed.

- [ ] **Step 6: Update `src/lib/db.ts` line 491**

Change `priceSource?: "ebay" | "ai"` to `priceSource?: "ebay"`. Add this file to the commit.

- [ ] **Step 7: Remove `estimatePrice` from test files**

Remove `estimatePrice` test blocks from `src/lib/providers/__tests__/anthropic.test.ts` (lines 231, 233, 263) and `src/lib/providers/__tests__/gemini.test.ts` (lines 153, 167). Remove `estimatePrice` from mock objects in `src/lib/__tests__/aiProvider.test.ts` (lines 21, 27) and `src/app/api/admin/health-check/__tests__/probeProviders.test.ts` (lines 10, 24). Also remove `priceEstimation: null` from mock objects in `src/components/__tests__/trackScan.test.ts` (lines 25, 47). Add all 5 test files to the commit.

Additionally:
- Remove the `buildPriceEstimationPrompt` import from `anthropic.test.ts` line 5
- Remove the entire `describe("buildPriceEstimationPrompt")` block from `anthropic.test.ts` (lines 308-340)
- Remove the `buildPriceEstimationPrompt` mock from `gemini.test.ts` line 21

- [ ] **Step 8: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 9: Run full build**

Run: `npm run build`
Expected: Clean build, no errors

- [ ] **Step 10: Commit**

```bash
git add src/lib/ebayFinding.ts src/lib/providers/anthropic.ts src/lib/providers/gemini.ts src/lib/providers/types.ts src/types/comic.ts src/lib/db.ts src/lib/providers/__tests__/anthropic.test.ts src/lib/providers/__tests__/gemini.test.ts src/lib/__tests__/aiProvider.test.ts src/app/api/admin/health-check/__tests__/probeProviders.test.ts src/components/__tests__/trackScan.test.ts
git commit -m "chore: delete ebayFinding.ts, remove dead AI price types and functions"
```

---

## Task 13: Database Migration & Environment Setup

**Files:**
- No code files — database and environment configuration

- [ ] **Step 1: Prepare SQL migration script**

Create the migration script (run via Supabase dashboard, not committed):
```sql
-- Remove all AI-fabricated price data from cache
-- Run AFTER deploying Browse API code so new lookups repopulate with real eBay data
-- Also clears entries saved without priceSource (e.g., from comic-lookup route)
UPDATE comic_metadata
SET price_data = NULL, price_source = NULL
WHERE price_source = 'ai' OR price_source IS NULL;
```

Copy to clipboard for the user.

- [ ] **Step 2: Add EBAY_CLIENT_SECRET to .env.local**

Open .env.local in TextEdit:
```bash
open -a TextEdit "/Users/chrispatton/Coding for Dummies/Comic Tracker/.env.local"
```

User must add `EBAY_CLIENT_SECRET=<value from eBay Developer Console>`.

Optionally set `EBAY_SANDBOX=true` in `.env.local` for development/testing with eBay's sandbox API.

- [ ] **Step 3: Document Netlify environment variable requirement**

Remind user: `EBAY_CLIENT_SECRET` must be added to Netlify environment variables before deploy.

- [ ] **Step 4: Run `npm run check` for final validation**

Run: `npm run check`
Expected: typecheck + lint + test all pass

- [ ] **Step 5: Final commit (if any remaining changes)**

```bash
git add -A
git commit -m "chore: final cleanup for eBay Browse API migration"
```
