# Collectors Chest - Operating Cost Projections

> Cost estimates for running the application at various scale levels.
> All prices in USD. Last audited June 14, 2026.
> **Audit cadence:** reviewed at end of every session (close-up-shop). Any new service added or cost change must land here before commit.

---

## Recent Changes (Audit Log)

| Date | Change | Net Cost Impact |
|------|--------|-----------------|
| Jun 14, 2026 (Session 48 — cost-reduction sweep + marketplace destination charges) | **No new paid services.** AI spend trending DOWN: text-only lookups/enrichment switched Sonnet→Haiku (~60–70% cheaper per text call), Anthropic prompt caching added to vision fallback scans, and Gemini reconfirmed PRIMARY vision provider (~5x cheaper than Sonnet). **Supabase storage** growth slowed: user covers now converted to WebP server-side (smaller than the prior ~400KB JPEG) + orphan-cover cleanup on hard delete — pushes the 1GB free-tier cap further out. **Upstash** commands/day reduced: Redis client deduped, `mget` batching, rate-limiter analytics disabled, cache-hit reuse. **PostHog/Sentry** event volume reduced: session recording sampled at 10%, Sentry Replay disabled. Deps removed (`openai`, `@zxing/*`, `html5-qrcode`) — no cost, smaller bundle; Clerk 6.39.5 + Anthropic SDK 0.104 bumps (no cost change). **Stripe marketplace switched to DESTINATION CHARGES** — seller is now merchant-of-record and bears Stripe's 2.9%+$0.30; platform nets a clean `application_fee` (improves marketplace economics in the platform's favor; not a new cost). **PriceCharting Legendary ($499/yr) remains DEFERRED**; **ZenRows still off/deferred** (env var provisioned, no code references it, $0). | Net DOWN — AI/Upstash/PostHog/Sentry all trending lower; Stripe fee burden shifts to sellers; no new spend |
| May 9, 2026 (Session 46 — variant resolver Tier 2 enrichment) | No new services, tiers, or integrations. New variable AI cost line: variant resolver **Tier 2 Haiku enrichment call** (`claude-haiku-4-5-20251001`, text-only, ~150 input + ~96 max output tokens, ~$0.0008/call). Fires only when (a) a barcode was extracted with `addonVariant` present, (b) `barcode_catalog` has no admin-approved name for the `(upc_prefix, addon_issue, addon_variant)` triplet, and (c) the addon implies a variant (not "00"/"01"/"11"). Catalog is empty at launch, so Tier 2 fires on most barcode-confirmed variant scans until admin approvals compound Tier 1 hits. Estimated **$0.02–$0.07/day** at current Beta scan volumes. **Caveat:** known production gap (BACKLOG: Variant Detection — Two-Pass High-Res Barcode OCR Option C3) means the AI rarely extracts the full 17-digit barcode today, so Tier 2 isn't actually firing much in production yet. Real cost materializes once the OCR fix lands. Also: new `comic-covers` Supabase Storage bucket (~400KB/photo) — see Cost Risks below. | +$0.02–$0.07/day (private beta), pending OCR fix |
| May 6, 2026 (Session 45b — post-Session-45-deploy continuation) | No new services, tiers, or integrations. Removed ~297 lines of dead Comic Vine code (orphan `/api/quick-lookup` route, dead PWA shortcut, stale service-worker cache entry, `"comicvine"` literal in `CoverPipelineResult` union). `COMIC_VINE_API_KEY` was never set in any environment — the code path was already non-operational at runtime, so the removal has no cost impact. Added `fetchKeyInfoFromAI` call to the no-data branch of `/api/con-mode-lookup` — at most +1 Anthropic call (~$0.0003) per slabbed-cover scan that misses both eBay AND the curated key DB; negligible at private-beta volume. **PriceCharting Legendary tier ($499/yr) decision still pending Aponte review** (`docs/PRICECHARTING_PROPOSAL.md` shipped for stakeholder sign-off — not committed to spend). | $0/mo — no change |
| May 6, 2026 (Session 45 — alias mechanism + sniping protection + ending-soon reminders + PWA splash) | No new services, tiers, or integrations. Internal-only work: alias mechanism on `keyComicsDatabase` (6 new aliases), `lookupKeyInfoWithMeta` returning year-disambiguation metadata, `snipingProtection.ts` (5-min window/extension, 6h cap), auction ending-soon T-1h cron in `auctionDb.ts` (in-app + email), 2 new email types (`subscription_payment_failed`, `auction_ending_soon_bidder`), `sendBatchWithRetry` with 429 backoff, em-dash purge across 77 files, splash + maskable icon regeneration from single 2732×2732 brand source. Migrations applied: `20260506_cover_head_check.sql`, `20260506_auction_sniping_protection.sql`, `20260506_auction_ending_soon_reminder.sql`. Resend, Supabase, Anthropic, all other services remain on documented tiers. | $0/mo — no change |
| Apr 27, 2026 (Session 42 + 42b–d) | No new services, tiers, or integrations. Six deploys of internal logic: Second Chance flow fixes, **$0.75 platform-fee floor** (closes the sub-$6 platform-loss zone where Stripe processing fees exceeded our percent-fee — free-tier break-even was $5.88, premium $14.29), transaction-fee documentation pass, Notifications Inbox v1 (uses existing Supabase + localStorage cache), pre-existing IDOR hotfix in `markNotificationRead`, three smoke-test fixes. Migrations applied to Supabase: `20260427_add_shipped_notification_type.sql`, `20260427_notifications_inbox.sql`, `20260427_backfill_shipped_notification_type.sql`. All services remain on documented free tiers. | $0/mo — no change (and **net positive going forward**: every small sale now profitable after Stripe fees) |
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

### 4. AI Providers — Gemini (primary) + Anthropic Claude (fallback)

> **Provider order:** Gemini 2.0 Flash is the **PRIMARY** vision provider (`VISION_PROVIDER_ORDER = ["gemini", "anthropic"]` in `src/lib/models.ts`). It is more accurate for comic covers in testing and **~5x cheaper** than Claude. Anthropic Claude Sonnet 4.5 runs only as the **fallback** when Gemini fails. Lightweight text-only lookups/enrichment use Claude Haiku 4.5. AI cost is therefore dominated by Gemini, not Claude.

| Model                       | Role             | Input Cost     | Output Cost    | Typical Scan Cost   |
|-----------------------------|------------------|----------------|----------------|---------------------|
| Gemini 2.0 Flash            | **Primary** (vision) | ~$0.10/M tokens | ~$0.40/M tokens | ~$0.001-0.006/scan  |
| Claude Sonnet 4.5           | Fallback (vision)    | $3/M tokens    | $15/M tokens   | ~$0.01-0.03/scan    |
| Claude Haiku 4.5            | Text-only enrichment | $0.25/M tokens | $1.25/M tokens | ~$0.002-0.005/call  |

**Current: Gemini 2.0 Flash** (primary vision) + **Claude Sonnet 4.5** (`claude-sonnet-4-5-20250929`, vision fallback) + **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`, text-only enrichment)
**Actual Cost per Action (Gemini-primary economics):**
- Cover scan (vision, Gemini primary): ~$0.001-0.006; only escalates to ~$0.02-0.05 on the rare scan that falls back to Claude
- Comic lookup (text): ~$0.001-0.01 (Haiku/Gemini)
- Price lookup: ~$0.001-0.01
- **Variant resolver Tier 2 enrichment (Haiku, text-only): ~$0.0008/call** — fires only when barcode `addonVariant` is present, the `barcode_catalog` has no admin-approved name for that `(upc_prefix, addon_issue, addon_variant)` triplet, and the addon implies a variant (not "00"/"01"/"11"). Self-limiting: as admins approve variant names, Tier 1 catalog hits compound and Tier 2 calls drop. Estimated **$0.02–$0.07/day** at current Beta volumes (will rise once the high-res barcode OCR fix lands — see BACKLOG "Variant Detection — Two-Pass High-Res Barcode OCR Option C3").

**With Hybrid Caching (Current):**
- First lookup (Gemini primary): ~$0.001-0.006; ~$0.01-0.03 only on Claude fallback
- Repeat lookups: $0 (cached)
- Cache hit rate estimate: 60-80% after initial growth
- **Session 48 reductions (active):** all text-only lookups/enrichment now run on Claude Haiku 4.5 instead of Sonnet (~60–70% cheaper per text call); **Anthropic prompt caching** is enabled on the Claude vision-fallback path, cutting input-token cost on the rare Gemini→Claude escalation. Both lower the effective per-action AI cost below the ranges quoted above.

**Projection (with caching, Gemini-primary):** ~5x cheaper than a Claude-primary model. Figures below assume Gemini handles the vast majority of scans, with occasional Claude fallback.

| Users  | Scans/User/Mo | New Lookups | Cached  | AI Cost         |
|--------|---------------|-------------|---------|-----------------|
| 100    | 10            | 800         | 200     | $3-8/mo         |
| 1,000  | 10            | 5,000       | 5,000   | $20-40/mo       |
| 10,000 | 10            | 20,000      | 80,000  | $80-150/mo      |
| 50,000 | 10            | 50,000      | 450,000 | $200-350/mo     |

**Cost Optimization Options:**
- Keep Gemini as primary (already the default): ~5x cheaper than Claude-primary
- Use Haiku for text lookups: -60% on lookup costs vs Sonnet
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
**Session 48 reductions (active):** Sentry Replay disabled — lowers event/replay volume and keeps us further under the 5k errors/mo free cap.
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
**Session 48 reductions (active):** session recording sampled at 10% — cuts captured events well below the 1M/mo free cap.
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
**Session 48 reductions (active):** Redis client deduped, `mget` batching, rate-limiter analytics disabled, and cache-hit reuse — together these cut commands/day, pushing the upgrade-to-paid threshold further out.
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

### 11. Stripe (Payments — Subscriptions + Marketplace)

| Flow | Who Bears Stripe Fee (2.9% + $0.30) | Platform Economics |
|------|--------------------------------------|--------------------|
| **Premium subscriptions** | Platform (standard charge) | Platform pays Stripe's 2.9% + $0.30 on each subscription payment |
| **Marketplace sales (DESTINATION CHARGES — Session 48)** | **Seller** (seller is merchant-of-record) | Platform takes a clean `application_fee`; Stripe's processing fee is borne by the seller, not the platform |

**Session 48 change:** marketplace switched to **destination charges**. The seller is now the merchant-of-record and absorbs Stripe's 2.9% + $0.30 per transaction; the platform collects an `application_fee` on top, with no Stripe-fee drag on platform revenue. This improves marketplace economics in the platform's favor — it is **not a new cost**. A **$0.75 platform-fee floor** (Session 42) still guards small-sale profitability on the platform's application fee.

**Projection:** Stripe cost scales with transaction volume, not user count. Subscription-flow fees remain the platform's; marketplace processing fees are now the seller's.

---

## Cost Projection Scenarios

### Scenario 1: Launch (0-100 users) — **Current scenario**

| Service                   | Cost                                               |
|---------------------------|----------------------------------------------------|
| Netlify Personal          | $9.54                                              |
| Supabase                  | $0 (upgrade to Pro $25/mo triggered at ~500 users) |
| Clerk                     | $0                                                 |
| AI (Gemini primary + Claude fallback) | $3-15                                  |
| Sentry                    | $0                                                 |
| Analytics (PostHog)       | $0                                                 |
| Upstash                   | $0                                                 |
| Resend                    | $0                                                 |
| hCaptcha                  | $0 (Pro trial → free tier after May 7, 2026)       |
| eBay API                  | $0                                                 |
| **Total (today)**         | **~$13-25/mo**                                     |
| **Total (at ~500 users)** | **~$35-55/mo**                                     |

---

### Scenario 2: Early Growth (100-1,000 users)

| Service   | Cost           |
|-----------|----------------|
| Netlify   | $0             |
| Supabase  | $0             |
| Clerk     | $0             |
| AI (Gemini primary + Claude fallback) | $20-40 |
| Sentry    | $0             |
| Analytics | $0             |
| Upstash   | $0-5           |
| Resend    | $0             |
| hCaptcha  | $0             |
| eBay API  | $0             |
| **Total** | **$20-50/mo**  |

---

### Scenario 3: Growth (1,000-10,000 users)

| Service   | Cost            |
|-----------|-----------------|
| Netlify   | $19             |
| Supabase  | $25             |
| Clerk     | $0              |
| AI (Gemini primary + Claude fallback) | $80-150 |
| Sentry    | $26             |
| Analytics | $0              |
| Upstash   | $10             |
| Resend    | $20             |
| hCaptcha  | $0              |
| eBay API  | $0              |
| **Total** | **$180-250/mo** |

---

### Scenario 4: Scale (10,000-50,000 users)

| Service   | Cost              |
|-----------|-------------------|
| Netlify   | $19-99            |
| Supabase  | $25-50            |
| Clerk     | $100-800          |
| AI (Gemini primary + Claude fallback) | $200-400 |
| Sentry    | $80               |
| Analytics | $50               |
| Upstash   | $30               |
| Resend    | $40               |
| hCaptcha  | $0 (free tier)    |
| eBay API  | $0                |
| **Total** | **$550-1,550/mo** |

---

## Cost Risks (Watch List)

Items that are **$0 today** but could push us off a free tier or onto a paid tier as usage grows. Not yet a current cost — flagged so we don't get surprised.

| Risk | Trigger | Estimated Tipping Point | Mitigation |
|------|---------|-------------------------|------------|
| **Supabase Storage — `comic-covers` bucket** | Bucket added Session 46 for user-uploaded book covers. **Session 48:** covers now converted to **WebP server-side** (smaller than the prior ~400KB JPEG) and **orphan covers are cleaned up on hard delete** — both slow growth toward the cap. Free tier still caps at 1GB total Supabase storage. | WebP + orphan cleanup push the tipping point past the prior ~2,500-upload estimate; still trends toward >1GB at scale (~100 active users × 50 books would approach the cap). Watch as cover uploads scale. | Supabase Pro ($25/mo) raises storage to 100GB. WebP conversion + orphan cleanup are now in place; further options: tighten WebP quality (target <150KB), prune duplicates by hash, or move covers to a cheaper object store (R2/S3) once cover count grows. |
| **Variant resolver Tier 2 AI calls** | Currently muted by a known production gap (AI rarely extracts the full 17-digit barcode). Once the two-pass high-res barcode OCR fix lands (BACKLOG "Variant Detection — Option C3"), Tier 2 will fire on most barcode-confirmed variant scans until the catalog fills in. | If post-fix Tier 2 fires on ~500 scans/day at $0.0008/call = **~$0.40/day = $12/mo**. Self-limits as admin approvals populate `barcode_catalog`. | Admin-approve variant names quickly to compound Tier 1 catalog hits. Cap Tier 2 retries per `(upc_prefix, addon_issue, addon_variant)` triplet so a failing AI response doesn't loop. |

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

1. **AI (Gemini primary, Claude fallback)** - Main variable cost. Gemini-primary keeps this ~5x cheaper than a Claude-primary model would; Claude fallback adds cost only on the rare scan Gemini can't handle.
2. **Clerk Auth (at scale)** - $0.02/MAU adds up
3. **Everything else** - Relatively fixed, predictable

---

## Recommendations

### For Launch
- Stay on all free tiers
- Add Sentry (free) and PostHog (free)
- Budget: **$13-25/mo** (mostly Gemini AI + Netlify)

### For Growth
- Upgrade Supabase to Pro when needed
- Add Upstash Redis
- Implement cost optimizations
- Budget: **$180-250/mo**

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
| AI (Gemini + Claude) | Pay-per-use | N/A (always pay; Gemini primary keeps it low) | Critical |
| Sentry    | 5k errors/mo         | Hitting limits                   | Low           |
| PostHog   | 1M events/mo         | Rarely                           | Low           |
| Upstash   | 10k commands/day     | 1k+ daily users                  | Medium        |
| Resend    | 3k emails/mo         | 100+ daily emails                | Low           |
| hCaptcha  | 1M requests/mo       | Very rarely                      | Low           |
| eBay      | 5k calls/day         | Rarely                           | Low           |

---

*This document should be updated quarterly or when significant changes occur.*
