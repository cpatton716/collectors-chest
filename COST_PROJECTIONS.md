# Collectors Chest - Operating Cost Projections

> Cost estimates for running the application at various scale levels.
> All prices in USD. Updated April 24, 2026.
> **Audit cadence:** reviewed at end of every session (close-up-shop). Any new service added or cost change must land here before commit.

---

## Recent Changes (Audit Log)

| Date | Change | Net Cost Impact |
|------|--------|-----------------|
| Apr 24, 2026 (Session 41) | No new services, tiers, or integrations. Docs-only session: PROD auction-close validation + payment-deadline anchor bug captured to BACKLOG + TECHNICAL_FEATURES.md audit pass (Feature #22 deepened, Feature #20 column-name drift fixed). All services remain on documented free tiers. | $0/mo — no change |
| Apr 23, 2026 (Session 40 a–e) | No new services, tiers, or integrations. Session was all marketplace bug fixes + UX polish + copy sweep surfaced during PROD testing. Confirmed all existing services still on the documented free tiers. | $0/mo — no change |
| Apr 23, 2026 (Sessions 38 + 39) | Added hCaptcha (Pro trial until May 7, 2026, then auto-downgrades to free tier at 1M requests/mo). Removed Metron integration (was using free tier). Added `ZENROWS_API_KEY` env var but CGC-lookup feature deferred post-launch pending ROI review, no current cost. | $0/mo — private beta remains on free tiers |

---

## Quick Summary

| Scale            | Monthly Users | Monthly Cost | Cost/User  |
|------------------|---------------|--------------|------------|
| **Launch**       | 0-100         | $0-20        | Free tier  |
| **Early Growth** | 100-1,000     | $50-150      | $0.05-0.15 |
| **Growth**       | 1,000-10,000  | $200-600     | $0.02-0.06 |
| **Scale**        | 10,000-50,000 | $800-2,500   | $0.02-0.05 |

---

## Current Services

### 1. Netlify (Hosting)

| Tier         | Price        | Includes                              | When to Upgrade        |
|--------------|--------------|---------------------------------------|------------------------|
| Free         | $0/mo        | 100GB bandwidth, 300 build min        | Up to ~5,000 visits/mo |
| **Personal** | **$9.54/mo** | Current plan — hosting + domain + DNS | Current plan           |
| Pro          | $19/mo       | 1TB bandwidth, 1000 build min         | 5,000-50,000 visits/mo |
| Business     | $99/mo       | Custom, priority support              | 50,000+ visits/mo      |

**Current: Personal Plan ($9.54/mo, billed 13th of each month)**
**Projection:**
- Launch (0-1k users): $9.54/mo (current)
- Growth (1k-10k users): $19/mo (upgrade to Pro)
- Scale (10k+ users): $19-99/mo

---

### 2. Supabase (Database + Auth bypass)

| Tier     | Price   | Includes                                | Limits      |
|----------|---------|-----------------------------------------|-------------|
| **Free** | $0/mo   | 500MB DB, 2GB bandwidth, 50k auth users | 2 projects  |
| Pro      | $25/mo  | 8GB DB, 250GB bandwidth, unlimited auth | Per project |
| Team     | $599/mo | Everything unlimited, support           | Enterprise  |

**Current: Free tier**
**Projection:**
- Launch (0-1k users): $0/mo (well within free tier)
- Growth (1k-10k users): $0-25/mo (may hit bandwidth limits)
- Scale (10k+ users): $25-50/mo (need Pro tier)

**Key Limits to Watch:**
- Database size (500MB free) - ~50k-100k comics stored
- Bandwidth (2GB free) - ~20k API requests/day
- Realtime connections (200 concurrent)

---

### 3. Clerk (Authentication)

| Tier       | Price     | Includes                          |
|------------|-----------|-----------------------------------|
| **Free**   | $0/mo     | 10,000 MAU (monthly active users) |
| Pro        | $0.02/MAU | After 10k MAU                     |
| Enterprise | Custom    | SSO, advanced features            |

**Current: Free tier**
**Projection:**
- Launch (0-1k users): $0/mo
- Growth (1k-10k users): $0/mo (still free)
- Scale (10k+ users): $0.02 × (users - 10k)
  - 15k MAU = $100/mo
  - 25k MAU = $300/mo
  - 50k MAU = $800/mo

---

### 4. Anthropic Claude API (AI)

| Model           | Input Cost     | Output Cost    | Typical Scan Cost  |
|-----------------|----------------|----------------|--------------------|
| Claude Sonnet 4 | $3/M tokens    | $15/M tokens   | ~$0.01-0.03/scan   |
| Claude Haiku    | $0.25/M tokens | $1.25/M tokens | ~$0.002-0.005/scan |

**Current: Claude Sonnet 4**
**Actual Cost per Action:**
- Cover scan (vision): ~$0.02-0.05 (image + text)
- Comic lookup (text): ~$0.01-0.02
- Price lookup: ~$0.01

**With Hybrid Caching (Current):**
- First lookup: $0.01-0.03
- Repeat lookups: $0 (cached)
- Cache hit rate estimate: 60-80% after initial growth

**Projection (with caching):**

| Users  | Scans/User/Mo | New Lookups | Cached  | AI Cost         |
|--------|---------------|-------------|---------|-----------------|
| 100    | 10            | 800         | 200     | $16-24/mo       |
| 1,000  | 10            | 5,000       | 5,000   | $100-150/mo     |
| 10,000 | 10            | 20,000      | 80,000  | $400-600/mo     |
| 50,000 | 10            | 50,000      | 450,000 | $1,000-1,500/mo |

**Cost Optimization Options:**
- Switch text lookups to Haiku: -60% on lookup costs
- Pre-populate top 5k comics: -30% on new user costs
- Increase cache TTL: -10-20%

---

## Recommended Services

### 5. Sentry (Error Tracking) - RECOMMENDED

| Tier          | Price  | Includes                          |
|---------------|--------|-----------------------------------|
| **Developer** | $0/mo  | 5k errors/mo, 1 user              |
| Team          | $26/mo | 50k errors/mo, unlimited users    |
| Business      | $80/mo | 100k errors/mo, advanced features |

**Recommendation: Start with Developer (free)**
**Projection:**
- Launch: $0/mo
- Growth: $0-26/mo
- Scale: $26-80/mo

---

### 6. Analytics - RECOMMENDED

#### Option A: Mixpanel

| Tier     | Price   | Includes              |
|----------|---------|-----------------------|
| **Free** | $0/mo   | 20M events/mo         |
| Growth   | $20+/mo | More events, features |

#### Option B: PostHog (Open Source Alternative)

| Tier     | Price | Includes                               |
|----------|-------|----------------------------------------|
| **Free** | $0/mo | 1M events/mo, self-host unlimited      |
| Cloud    | $0/mo | 1M events/mo free, then $0.00031/event |

**Recommendation: PostHog Free or Mixpanel Free**
**Projection:**
- Launch: $0/mo
- Growth: $0/mo
- Scale: $0-50/mo

---

### 7. Upstash Redis (Distributed Cache)

| Tier          | Price              | Includes                |
|---------------|--------------------|-------------------------|
| **Free**      | $0/mo              | 10k commands/day, 256MB |
| Pay-as-you-go | $0.2/100k commands | Scales automatically    |
| Pro           | $10/mo             | 10M commands/mo, 1GB    |

**Recommendation: Start with Free, upgrade to Pay-as-you-go**
**Projection:**
- Launch: $0/mo
- Growth (1k users): $0-5/mo
- Scale (10k users): $10-30/mo

---

### 8. Resend (Transactional Email)

| Tier       | Price  | Includes                 |
|------------|--------|--------------------------|
| **Free**   | $0/mo  | 3,000 emails/mo, 100/day |
| Pro        | $20/mo | 50,000 emails/mo         |
| Enterprise | Custom | Volume pricing           |

**Use Cases:**
- Welcome emails
- Password reset
- Collection milestone notifications
- Re-engagement campaigns

**Projection:**
- Launch: $0/mo (free tier plenty)
- Growth: $0-20/mo
- Scale: $20-40/mo

---

### 9. hCaptcha (Bot Prevention)

| Tier        | Price       | Includes                                                    |
|-------------|-------------|-------------------------------------------------------------|
| **Free**    | $0/mo       | 1M requests/mo, standard challenge                          |
| Pro (trial) | $0 (trial)  | Advanced features, currently on trial through **May 7, 2026** — no payment info provided; auto-downgrades to free tier after trial |
| Pro         | $99/mo      | Only if user opts in post-trial — not planned               |

**Current: Pro trial (free) → will auto-downgrade to Free tier May 7, 2026**

**Use Case:** Triggered on guest scans 4–5 only (not on authenticated users). Expected volume in private beta is well under free-tier limits.

**Projection:**
- Launch: $0/mo (Pro trial, then free tier)
- Growth: $0/mo (1M req/mo covers ~10k users easily)
- Scale: $0/mo until 1M+ challenges/mo

---

### 10. eBay API (Price Data)

| Aspect        | Cost                      |
|---------------|---------------------------|
| API Access    | **Free**                  |
| Rate Limits   | 5,000 calls/day (default) |
| Higher Limits | Apply for increase        |

**Projection: $0/mo** (free API)

**With 24-hour caching:**
- 5,000 calls/day = ~150,000 unique lookups/month
- More than enough for 10k+ users

---

## Cost Projection Scenarios

### Scenario 1: Launch (0-100 users) — **Current scenario**

| Service                   | Cost                                               |
|---------------------------|----------------------------------------------------|
| Netlify Personal          | $9.54                                              |
| Supabase                  | $0 (upgrade to Pro $25/mo triggered at ~500 users) |
| Clerk                     | $0                                                 |
| Anthropic                 | $10-30                                             |
| Sentry                    | $0                                                 |
| Analytics (PostHog)       | $0                                                 |
| Upstash                   | $0                                                 |
| Resend                    | $0                                                 |
| hCaptcha                  | $0 (Pro trial → free tier after May 7, 2026)       |
| eBay API                  | $0                                                 |
| **Total (today)**         | **~$20-40/mo**                                     |
| **Total (at ~500 users)** | **~$45-65/mo**                                     |

---

### Scenario 2: Early Growth (100-1,000 users)

| Service   | Cost           |
|-----------|----------------|
| Netlify   | $0             |
| Supabase  | $0             |
| Clerk     | $0             |
| Anthropic | $50-100        |
| Sentry    | $0             |
| Analytics | $0             |
| Upstash   | $0-5           |
| Resend    | $0             |
| hCaptcha  | $0             |
| eBay API  | $0             |
| **Total** | **$50-105/mo** |

---

### Scenario 3: Growth (1,000-10,000 users)

| Service   | Cost            |
|-----------|-----------------|
| Netlify   | $19             |
| Supabase  | $25             |
| Clerk     | $0              |
| Anthropic | $150-300        |
| Sentry    | $26             |
| Analytics | $0              |
| Upstash   | $10             |
| Resend    | $20             |
| hCaptcha  | $0              |
| eBay API  | $0              |
| **Total** | **$250-400/mo** |

---

### Scenario 4: Scale (10,000-50,000 users)

| Service   | Cost              |
|-----------|-------------------|
| Netlify   | $19-99            |
| Supabase  | $25-50            |
| Clerk     | $100-800          |
| Anthropic | $400-1,000        |
| Sentry    | $80               |
| Analytics | $50               |
| Upstash   | $30               |
| Resend    | $40               |
| hCaptcha  | $0 (free tier)    |
| eBay API  | $0                |
| **Total** | **$750-2,150/mo** |

---

## Cost Optimization Strategies

### Immediate (No Code Changes)
1. **Use Haiku for text lookups** - Save 60% on non-vision AI calls
2. **Extend cache TTL** - 7 days → 14 days for stable data
3. **Lazy load images** - Reduce bandwidth costs

### Short-Term
4. **Pre-populate top 5,000 comics** - One-time ~$100 cost, saves 30%+ ongoing
5. **Implement Redis caching** - Reduce DB calls by 50%+
6. **Add response compression** - Reduce bandwidth 60-70%

### Long-Term
7. **Train custom vision model** - Replace Claude Vision with cheaper custom model
8. **Build barcode database** - Reduce AI calls for known UPCs
9. **Negotiate enterprise rates** - At scale, negotiate with Anthropic/Clerk

---

## Break-Even Analysis

If we implement a premium tier at $5/month:

| Scenario     | Monthly Cost | Premium Users Needed |
|--------------|--------------|----------------------|
| Launch       | $20          | 4 users              |
| Early Growth | $75          | 15 users             |
| Growth       | $325         | 65 users             |
| Scale        | $1,500       | 300 users            |

**Typical conversion rates for freemium:**
- Free → Premium: 2-5%

| Total Users | At 2% Conversion        | At 5% Conversion        |
|-------------|-------------------------|-------------------------|
| 1,000       | 20 premium ($100/mo)    | 50 premium ($250/mo)    |
| 5,000       | 100 premium ($500/mo)   | 250 premium ($1,250/mo) |
| 10,000      | 200 premium ($1,000/mo) | 500 premium ($2,500/mo) |

**Break-even point: ~3,000-5,000 total users** (at 3-4% conversion)

---

## Biggest Cost Drivers

1. **Anthropic AI (40-60% of costs)** - Main variable cost
2. **Clerk Auth (at scale)** - $0.02/MAU adds up
3. **Everything else** - Relatively fixed, predictable

---

## Recommendations

### For Launch
- Stay on all free tiers
- Add Sentry (free) and PostHog (free)
- Budget: **$20-30/mo** (just Anthropic)

### For Growth
- Upgrade Supabase to Pro when needed
- Add Upstash Redis
- Implement cost optimizations
- Budget: **$200-400/mo**

### For Scale
- Negotiate enterprise rates
- Consider self-hosting some services
- Implement all cost optimizations
- Budget: **$1,000-2,000/mo**

---

## Service Decision Matrix

| Service   | Free Tier Limit      | When to Upgrade                  | Priority      |
|-----------|----------------------|----------------------------------|---------------|
| Netlify   | 100GB bandwidth      | 5k+ visits/mo                    | Low           |
| Supabase  | 500MB, 2GB bandwidth | 10k+ comics or 20k+ requests/day | Medium        |
| Clerk     | 10k MAU              | 10k+ MAU                         | High (costly) |
| Anthropic | Pay-per-use          | N/A (always pay)                 | Critical      |
| Sentry    | 5k errors/mo         | Hitting limits                   | Low           |
| PostHog   | 1M events/mo         | Rarely                           | Low           |
| Upstash   | 10k commands/day     | 1k+ daily users                  | Medium        |
| Resend    | 3k emails/mo         | 100+ daily emails                | Low           |
| hCaptcha  | 1M requests/mo       | Very rarely                      | Low           |
| eBay      | 5k calls/day         | Rarely                           | Low           |

---

*This document should be updated quarterly or when significant changes occur.*
