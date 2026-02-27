# Bing Image Search API Integration

**Date:** 2026-02-26
**Replaces:** Google Custom Search JSON API (closed to new customers)

## Context

Google CSE was set up on Feb 25 for comic cover image search but returned 403 errors. After investigation, Google's Custom Search JSON API is closed to new customers (deadline Jan 1, 2027 for existing customers). All Google CSE code and env vars have been removed.

## Design

### What We're Building

Replace the removed Google CSE call with Bing Image Search API v7 in the `cover-candidates` endpoint. The existing flow stays the same:

1. Check community cover database (unchanged)
2. Claude generates optimized search query (unchanged)
3. **Bing Image Search** returns up to 8 cover candidates (new)
4. Return candidates to the UI (unchanged)

### Azure Setup

1. Create Azure account at portal.azure.com (free tier includes $200 credit for 30 days)
2. Create a "Bing Search v7" resource (free tier: 1,000 calls/month, 3/sec)
3. Copy API key to `.env.local` and Netlify as `BING_SEARCH_API_KEY`

### Code Changes

**`src/app/api/cover-candidates/route.ts`** (primary change)
- Add `searchBingImages(query)` function
- Endpoint: `https://api.bing.microsoft.com/v7.0/images/search`
- Params: 8 results, safe search strict
- Redis tracking: `usage:bing-image:{date}`

**`src/app/api/admin/usage/route.ts`**
- Add Bing Image Search section (1,000/month free tier)

**`src/app/api/admin/usage/check-alerts/route.ts`**
- Add Bing alert thresholds (70% warning, 90% critical)

**`CLAUDE.md`**
- Add Bing to External APIs and Free Tiers

### Free Tier Limits

- 1,000 transactions/month
- 3 transactions/second
- Image search included

### Cost After Free Tier

- $3 per 1,000 transactions (S1 tier)

## Decision: Skip External Image Search (Feb 26, 2026)

After investigation, Bing Search APIs were also retired (August 11, 2025). Both Google CSE and Bing are dead ends for new customers.

**Alternatives evaluated:**
- Brave Search API — 2,000 free queries/mo, $3/1K after
- SerpAPI — 100 free/mo, $75/mo for 5K (scrapes Google)
- Metron.cloud — Free comic DB API

**Decision:** Skip external image search for now. Rely on:
1. Community cover database (grows as users submit covers)
2. Open Library API (fallback, better for graphic novels)
3. Manual URL paste in edit form

The cover-candidates endpoint still generates AI search queries via Claude and checks the community DB. When a viable image search API emerges, the integration point is ready at line 90 of cover-candidates/route.ts.
