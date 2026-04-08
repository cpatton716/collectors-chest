# eBay Browse API Integration — Design Spec

**Date:** 2026-03-18
**Status:** Approved (Rev 2 — updated April 5, 2026 with implementation details)
**Author:** Claude + Chris Patton

## Problem

The eBay Finding API was fully decommissioned in February 2025. Our `ebayFinding.ts` silently fails on every call, causing the app to fall back to AI-generated price estimates that fabricate both prices and "Most Recent Sale" data. Users see fake data presented alongside a "Technopathic Estimate" warning.

## Solution

Replace the dead Finding API with the eBay Browse API to show real pricing from active eBay listings. Remove all AI price estimation fallbacks.

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Price label | "Listed Value" | Neutral term — clearly not a sold price, not claiming to be market value |
| Price calculation | Lower quartile (Q1) of active listings | Deliberate change from Finding API code which used mean. Q1 better approximates actual sale prices since active listing ask prices consistently overshoot sold prices. Outlier filtering (>3x median, <0.2x median) applied first, then Q1 index = floor(filtered.length / 4) |
| AI fallback | None | If no eBay listings found → "No pricing data available". No fabricated prices ever. Key info AI calls (`fetchKeyInfoFromAI()`) are preserved — only price estimation AI is removed |
| Search strategy | Grade-aware with 12h cache | Separate queries for raw vs slabbed comics, cached aggressively to minimize API calls. Active listings change more frequently than sold data, so 12h TTL balances freshness with API budget |
| Listing type filter | `FIXED_PRICE` only | Exclude auctions — current bid prices skew median low and don't represent actual market value |
| Minimum listing threshold | 3 listings | Below 3 listings: show "X active listings found" with eBay link, no price displayed. Prevents unreliable medians from tiny sample sizes |

## Architecture

### New File: `src/lib/ebayBrowse.ts`

Replaces `ebayFinding.ts`. Responsibilities:

1. **OAuth 2.0 client credentials flow**
   - Uses `EBAY_APP_ID` (client ID) + new `EBAY_CLIENT_SECRET`
   - Tokens cached in-memory (2-hour TTL, matching eBay's token lifetime)
   - Auto-refresh on expiry

2. **Core function: `searchActiveListings()`**
   - Signature: `searchActiveListings(title, issueNumber?, grade?, isSlabbed?, gradingCompany?, year?) → BrowsePriceResult | null`
   - Endpoint: `GET https://api.ebay.com/buy/browse/v1/item_summary/search`
   - Query params: `q` (search keywords), `category_ids` (259104 for comics), `filter` (price currency USD, `buyingOptions:{FIXED_PRICE}` — excludes auctions whose current bid prices skew median low), `limit` (30)
   - **Category ID fallback:** 259104 (Collectible Comics) may need verification against Browse API taxonomy. If 259104 returns 0 results, retry with broader category 63 (Comic Books). If that also returns 0, retry without category filter as a last resort.
   - **Search keyword construction:** `title + issueNumber + [gradingCompany + grade if slabbed] + [year if provided]`. Year is appended to help disambiguate comics with common titles (e.g., "Batman #1 2016" vs "Batman #1 1940").
   - For slabbed: includes grading company + grade in search keywords
   - For raw: searches title + issue only

3. **Irrelevant listing filtering (pre-price)**
   - `filterIrrelevantListings()` removes listings before price calculation:
     - **Signed/SS copies** — excluded via regex (`signed`, `signature series`, `autograph`, `ss`)
     - **Newsstand variants** — different pricing tier, excluded
     - **Wrong-title matches** — listing must contain the normalized search title; rejects different series with shared substrings (e.g., "Web of Spider-Man" filtered when searching "Spider-Man") using series prefix detection
     - **Grade filtering for slabbed** — when `isSlabbed` and `grade` are provided, only keep listings mentioning the exact grade as a standalone number (e.g., `\b9\.4\b`)

4. **Outlier filtering & minimum threshold**
   - Remove prices > 3x median or < 0.2x median
   - Calculate lower quartile Q1 (not median, not mean) from filtered set: `Q1 index = floor(filtered.length / 4)`. Q1 better approximates actual sale prices since ask prices consistently overshoot sold prices.
   - High and low from filtered set
   - **Minimum 3 listings required** to calculate and return a Q1 "Listed Value". Below 3: return `medianPrice: null` with `totalResults` set to actual count so UI can show "X active listings found" with an eBay link

4. **Grade estimate multipliers**
   - Preserve existing grade multiplier table (9.8, 9.4, 8.0, 6.0, 4.0, 2.0)
   - Raw multipliers and slab multipliers (slab ~30% premium)

5. **Configuration check: `isBrowseApiConfigured()`**
   - Returns true only if both `EBAY_APP_ID` and `EBAY_CLIENT_SECRET` are set

6. **URL builder: `buildEbaySearchUrl()`**
   - Moved from `ebayFinding.ts` into this new `ebayBrowse.ts` file
   - Keep existing function that builds eBay browser search URLs for "Recent Sales on eBay" button

### Interfaces

```typescript
interface BrowseListingItem {
  itemId: string;
  title: string;
  price: number;
  currency: string;
  condition: string;       // Browse API returns enum values: "NEW", "LIKE_NEW", "VERY_GOOD", "GOOD", "ACCEPTABLE", "FOR_PARTS_OR_NOT_WORKING"
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

### Routes Updated (5 files)

1. **`/api/con-mode-lookup/route.ts`**
   - Swap `lookupEbaySoldPrices()` → `searchActiveListings()`
   - Remove AI price estimation fallback (Tier 3)
   - If no eBay data: return `priceData: null`

2. **`/api/analyze/route.ts`**
   - Swap `lookupEbaySoldPrices()` → `searchActiveListings()`
   - Remove AI price estimation fallback
   - If no eBay data: `comicDetails.priceData = null`

3. **`/api/quick-lookup/route.ts`**
   - This route does NOT use `ebayFinding.ts` — it generates prices purely through AI (Claude)
   - Remove AI price generation entirely. Either add Browse API call for real pricing, or remove pricing from this route altogether (it's a barcode-based lookup)
   - Remove `disclaimer: "AI-estimated values based on market knowledge."` text

4. **`/api/ebay-prices/route.ts`**
   - Swap to new Browse API function
   - Keep 12h Redis cache

5. **`/api/hottest-books/route.ts`**
   - Swap to new Browse API function

### UI Changes

**`KeyHuntPriceResult.tsx` and related components:**

- Change "Raw Value" / "Slabbed Value" labels → "Listed Value"
- Remove "Most Recent Sale" section entirely (no sold data available)
- Remove "Technopathic Estimate" disclaimer and warning styling
- New disclaimer when source is eBay: "Based on current eBay listings"
- When no eBay data: show "No pricing data available" (no AI fallback)
- **Below-threshold display:** When fewer than 3 listings exist, show "X active listings found" with a link to eBay so users have something actionable (no price displayed)
- Keep "Recent Sales on eBay" button — this intentionally links to SOLD listings (`LH_Complete=1&LH_Sold=1`), showing actual transaction history which is most useful for collectors, even though our Listed Value comes from active listings
- The inline `buildEbaySearchUrl` in this component should keep pointing to sold listings

**`ComicDetailModal.tsx` and `ComicDetailsForm.tsx`:**
- Same label changes: "Listed Value" instead of estimate language
- Remove "Technopathic Estimate" / "AI Estimate" disclaimers
- Show "Based on current eBay listings" when eBay data present
- Show "No pricing data available" when no data

**`useOffline.ts` (offline hook):**
- Hardcodes "Technopathic Estimate" branding in price data construction
- Update to match new approach: no AI pricing, use "Listed Value" language
- Remove all "Technopathic Estimate" / "AI Estimate" disclaimer text
- When constructing offline price data, use "Based on current eBay listings" or null

**`PublicComicModal.tsx` and `KeyHuntHistoryDetail.tsx`:**
- Both consume `recentSales` and `mostRecentSaleDate` from `PriceData`
- Same label updates: "Listed Value" instead of estimate language
- Same disclaimer changes: remove AI/Technopathic warnings, show "Based on current eBay listings"
- Handle null `recentSales`/`mostRecentSaleDate` gracefully (these will always be empty/null with Browse API)

### Environment Variables

- **Existing:** `EBAY_APP_ID` (reused as OAuth client ID)
- **New:** `EBAY_CLIENT_SECRET` (OAuth client secret from eBay Developer Console)
- **Optional:** `EBAY_SANDBOX` — when set to `"true"`, use sandbox base URL (`https://api.sandbox.ebay.com/buy/browse/v1/...`) instead of production (`https://api.ebay.com/buy/browse/v1/...`). Useful for development and testing without consuming production quota.
- Must be added to both `.env.local` and Netlify environment variables before deploy

### What Gets Removed

- `src/lib/ebayFinding.ts` — entire file (dead code, Finding API decommissioned)
- AI price estimation code in `con-mode-lookup/route.ts` (Tier 3 fallback)
- AI price estimation code in `analyze/route.ts`
- AI price generation code in `quick-lookup/route.ts` (generates prices purely through Claude, not via ebayFinding.ts)
- All "Technopathic Estimate" / "AI Estimate" disclaimer text (including hardcoded strings in `useOffline.ts`)
- Fake "Most Recent Sale" data generation
- `findCompletedItems` and related Finding API functions

### Database Migration

One-time cleanup to remove fabricated AI prices from the database:

- Clear all entries in `comic_metadata` where `priceSource = 'ai'`
- This removes cached AI-generated prices so they are never served again
- Can be run as a SQL script or directly in the Supabase dashboard:
  ```sql
  -- Remove all AI-fabricated price data from cache
  -- Also clears entries saved without priceSource (e.g., from comic-lookup route)
  UPDATE comic_metadata
  SET price_data = NULL, price_source = NULL
  WHERE price_source = 'ai' OR price_source IS NULL;
  ```
- Run this migration AFTER deploying the Browse API code, so new lookups repopulate with real eBay data

### Rate Limits

- **Browse API default:** 5,000 calls/day
- **Mitigation:** 12-hour Redis caching on price data means each unique comic query hits eBay at most twice per day. Even with hundreds of unique lookups, usage stays well within the 5,000/day limit.
- **"No data" caching:** 1-hour TTL ensures failed lookups retry sooner without excessive API calls.

### Caching Strategy

- **OAuth tokens:** In-memory, 2-hour TTL
- **Price data:** Redis cache, 12-hour TTL (active listings change more frequently than sold data)
- **"No data" results:** Redis cache, 1-hour TTL (existing pattern — retry sooner)

### Error Handling

- If OAuth token fetch fails → log error, return null (no price data shown)
- If Browse API returns error → log error, return null
- If Browse API returns 0 results → cache "no data" for 1 hour, return null
- No silent failures — all errors logged with `[ebay-browse]` prefix

### Testing

- Unit tests for keyword building (including year parameter), irrelevant listing filtering (signed, newsstand, wrong-title, grade), outlier filtering, Q1 calculation, grade multiplier calculations
- Unit tests for OAuth token caching logic
- Unit tests for response parsing
- Integration testing: manual verification with known comics (ASM #300, Batman #1, etc.)
