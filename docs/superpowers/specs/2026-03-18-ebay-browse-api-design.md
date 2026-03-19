# eBay Browse API Integration — Design Spec

**Date:** 2026-03-18
**Status:** Approved
**Author:** Claude + Chris Patton

## Problem

The eBay Finding API was fully decommissioned in February 2025. Our `ebayFinding.ts` silently fails on every call, causing the app to fall back to AI-generated price estimates that fabricate both prices and "Most Recent Sale" data. Users see fake data presented alongside a "Technopathic Estimate" warning.

## Solution

Replace the dead Finding API with the eBay Browse API to show real pricing from active eBay listings. Remove all AI price estimation fallbacks.

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Price label | "Listed Value" | Neutral term — clearly not a sold price, not claiming to be market value |
| Price calculation | Median of active listings | Filters outlier listings (both too cheap and inflated) |
| AI fallback | None | If no eBay listings found → "No pricing data available". No fabricated prices ever |
| Search strategy | Grade-aware with 24h cache | Separate queries for raw vs slabbed comics, cached aggressively to minimize API calls |

## Architecture

### New File: `src/lib/ebayBrowse.ts`

Replaces `ebayFinding.ts`. Responsibilities:

1. **OAuth 2.0 client credentials flow**
   - Uses `EBAY_APP_ID` (client ID) + new `EBAY_CLIENT_SECRET`
   - Tokens cached in-memory (2-hour TTL, matching eBay's token lifetime)
   - Auto-refresh on expiry

2. **Core function: `searchActiveListings()`**
   - Signature: `searchActiveListings(title, issueNumber?, grade?, isSlabbed?, gradingCompany?) → BrowsePriceResult | null`
   - Endpoint: `GET https://api.ebay.com/buy/browse/v1/item_summary/search`
   - Query params: `q` (search keywords), `category_ids` (259104 for comics), `filter` (price currency USD), `limit` (30)
   - For slabbed: includes grading company + grade in search keywords
   - For raw: searches title + issue only

3. **Outlier filtering**
   - Same median-based approach as Finding API: remove prices > 3x median or < 0.2x median
   - Calculate median, high, low from filtered set

4. **Grade estimate multipliers**
   - Preserve existing grade multiplier table (9.8, 9.4, 8.0, 6.0, 4.0, 2.0)
   - Raw multipliers and slab multipliers (slab ~30% premium)

5. **Configuration check: `isBrowseApiConfigured()`**
   - Returns true only if both `EBAY_APP_ID` and `EBAY_CLIENT_SECRET` are set

6. **URL builder: `buildEbaySearchUrl()`**
   - Keep existing function that builds eBay browser search URLs for "Recent Sales on eBay" button

### Interfaces

```typescript
interface BrowseListingItem {
  itemId: string;
  title: string;
  price: number;
  currency: string;
  condition: string;
  itemUrl: string;
  imageUrl?: string;
}

interface BrowsePriceResult {
  listings: BrowseListingItem[];
  medianPrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  totalResults: number;
  searchQuery: string;
}
```

### Output: Maps to existing `PriceData` interface

```typescript
// Existing interface — no changes needed
interface PriceData {
  estimatedValue: number | null;       // ← median price from Browse API
  recentSales: RecentSale[];           // ← empty array (no sold data)
  mostRecentSaleDate: string | null;   // ← null (no sold data)
  isAveraged: boolean;                 // ← true
  disclaimer: string | null;           // ← "Based on current eBay listings"
  gradeEstimates?: GradeEstimate[];    // ← preserved with multipliers
  baseGrade?: number;                  // ← 9.4
  priceSource?: "ebay" | "ai";        // ← "ebay"
}
```

### Routes Updated (4 files)

1. **`/api/con-mode-lookup/route.ts`**
   - Swap `lookupEbaySoldPrices()` → `searchActiveListings()`
   - Remove AI price estimation fallback (Tier 3)
   - If no eBay data: return `priceData: null`

2. **`/api/analyze/route.ts`**
   - Swap `lookupEbaySoldPrices()` → `searchActiveListings()`
   - Remove AI price estimation fallback
   - If no eBay data: `comicDetails.priceData = null`

3. **`/api/ebay-prices/route.ts`**
   - Swap to new Browse API function
   - Keep 24h Redis cache

4. **`/api/hottest-books/route.ts`**
   - Swap to new Browse API function

### UI Changes

**`KeyHuntPriceResult.tsx` and related components:**

- Change "Raw Value" / "Slabbed Value" labels → "Listed Value"
- Remove "Most Recent Sale" section entirely (no sold data available)
- Remove "Technopathic Estimate" disclaimer and warning styling
- New disclaimer when source is eBay: "Based on current eBay listings"
- When no eBay data: show "No pricing data available" (no AI fallback)
- Keep "Recent Sales on eBay" button (just a URL link, still works)

**`ComicDetailModal.tsx` and `ComicDetailsForm.tsx`:**
- Same label changes: "Listed Value" instead of estimate language
- Remove "Technopathic Estimate" / "AI Estimate" disclaimers
- Show "Based on current eBay listings" when eBay data present
- Show "No pricing data available" when no data

### Environment Variables

- **Existing:** `EBAY_APP_ID` (reused as OAuth client ID)
- **New:** `EBAY_CLIENT_SECRET` (OAuth client secret from eBay Developer Console)
- Must be added to both `.env.local` and Netlify environment variables before deploy

### What Gets Removed

- `src/lib/ebayFinding.ts` — entire file (dead code, Finding API decommissioned)
- AI price estimation code in `con-mode-lookup/route.ts` (Tier 3 fallback)
- AI price estimation code in `analyze/route.ts`
- All "Technopathic Estimate" / "AI Estimate" disclaimer text
- Fake "Most Recent Sale" data generation
- `findCompletedItems` and related Finding API functions

### Caching Strategy

- **OAuth tokens:** In-memory, 2-hour TTL
- **Price data:** Redis cache, 24-hour TTL (existing pattern)
- **"No data" results:** Redis cache, 1-hour TTL (existing pattern — retry sooner)

### Error Handling

- If OAuth token fetch fails → log error, return null (no price data shown)
- If Browse API returns error → log error, return null
- If Browse API returns 0 results → cache "no data" for 1 hour, return null
- No silent failures — all errors logged with `[ebay-browse]` prefix

### Testing

- Unit tests for keyword building, outlier filtering, grade multiplier calculations
- Unit tests for OAuth token caching logic
- Unit tests for response parsing
- Integration testing: manual verification with known comics (ASM #300, Batman #1, etc.)
