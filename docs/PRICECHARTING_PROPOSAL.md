# PriceCharting Subscription — Aponte Decision Brief

> **Status: Deferred (pending ROI)**

> **Audience:** Co-founder partner review. Plain-English summary of a $499/yr partner-data subscription decision before Beta launch.
>
> **Asked of you:** A yes/no on subscribing to PriceCharting's Legendary Sub at $499/year. Subscription is cancelable; not a multi-year commitment.

---

## TL;DR

We have a real gap in our pricing data — we show "what people are *asking*" not "what comics actually *sold for*." A $499/year subscription to PriceCharting fills that gap, gives us full CGC grade coverage, and removes three engineering tasks from our pre-launch list. **Recommend subscribing for one year. Decision-cost is low — the harder cost is the engineering time we'd spend NOT having this data.**

---

## The problem we're solving

**Today, we show users prices based on "active eBay listings" — i.e., the asking price someone wants for a comic, not what comics actually sold for.** Asking prices typically run 20-30% higher than reality. We've been compensating with a math hack ("take the lower quartile of asking prices") but it's noisy. When users compare our numbers to actual sold-listing data on eBay or CLZ, ours look slightly off.

**The pricing landscape is consolidating.** GoCollect closed their public API in February. CovrPrice (CLZ's exclusive partner) is targeting a 2027 public API. The only commercially-available "real sold-listing data" partner today is PriceCharting.

---

## What $499/year buys us

| What | Today | With PriceCharting |
|---|---|---|
| Pricing source | eBay active listings (asking prices) | Sold-listing data (gold standard) |
| CGC grade coverage | Limited — "no data" gaps for rare grades | Full 4.0 / 6.0 / 8.0 / 9.2 / 9.4 / 9.8 / 10.0 |
| Sales volume / "Hot Comics" | None | Yearly units-sold per issue, included |
| UPC barcode catalog | Building from scratch | Included for free |
| Update frequency | Real-time (but noisy) | Daily (clean, sold-data-derived) |

---

## What it does NOT buy us

**It does not reduce our per-scan AI costs.** Every cover scan still calls our AI engine ($0.015/scan) for recognition. PriceCharting only replaces the pricing data layer (which was already free via eBay).

In other words: **this is a quality investment, not a cost-savings investment.** Honest framing for the math.

---

## Realistic scan volume — Year 1

We won't have heavy scan volume on day one. Realistic ramp:

| Phase | Scans/day | Notes |
|---|---|---|
| Private Beta (now) | 20-50 | Admin testing, partner trials |
| Public Beta (Months 2-4) | 50-150 | First waves of real users |
| Soft Launch (Months 5-7) | 150-300 | Convention demos, marketing pushes |
| Established (Months 8-12) | 300-600 | Steady-state growth |

**Year-1 expected average: ~180 scans/day, or ~65,000 scans/year.**

---

## Cost-benefit at realistic Year-1 volume

| Item | Annual |
|---|---|
| PriceCharting subscription | -$499 |
| AI scan costs (unchanged — still need cover recognition) | -$975 |
| eBay Browse pricing (was free, now retired) | $0 |
| **Direct savings vs. today** | **$0** |
| **Net additional spend** | **-$499** |

There is **no direct cost savings** from subscribing. The $499 is a quality investment.

If we later build a UPC-barcode bypass (skipping AI recognition for any comic with a UPC), we'd save $0.009/scan averaged. At 65K scans, that's about $585 in AI savings — which would offset most of the $499 subscription. But that requires ~3 extra days of engineering, and the savings don't show up until that build is done.

---

## Why subscribe anyway

1. **Beta-launch credibility.** Users will compare our prices to CLZ + eBay sold-listing data. Being at parity (or honest about freshness — "Updated today") builds trust during the most fragile window of our growth.

2. **Engineering time saved.** We have three things on our pre-launch list that PriceCharting deletes outright:
   - "Better pricing for rare / key books at specific grades"
   - "Build a durable price cache so we don't re-query eBay endlessly"
   - "Foundation for sales-trend graphs (Year 2 feature)"
   
   These would otherwise eat 5-7 days of engineering time. At any rational hourly rate, $499 buys back more than that.

3. **Reversible commitment.** It's an annual subscription. If by month 6 we hate the data, or CovrPrice opens up early, or GoCollect re-opens, we just don't renew. $499 is the cheapest "real test" of a paid pricing partnership we can run.

4. **Cost calibration.** $499/yr = ~$42/mo, or about 4 months of Netlify hosting. It's material but not category-shifting next to development costs and the Stripe transaction fees that scale with us.

---

## Risks worth naming

- **Vendor dependency.** If PriceCharting changes their API or doubles their pricing in year 2, we're either renewing at higher cost or migrating off. Standard partner-relationship risk; mitigated by their long track record (the company has been operating since at least 2014).

- **Data quality unknowns.** We haven't validated their comic coverage depth (Golden Age vs. modern) or update cadence in detail. First 30 days of subscription = quality validation period before we hard-commit our pricing layer to them.

- **Build effort.** Integration is a 2-3 day engineering task. Has to be sequenced into the pre-launch roadmap.

---

## Recommendation

**Subscribe to the $499/yr Legendary tier.** Validate quality in the first 30 days. If the data lives up to claims, this becomes our primary pricing source through full launch. If not, we cancel before renewal and we've spent $499 + ~2 days of engineering to learn what we needed to know.

The decision isn't really $499 vs. $0. It's $499 vs. ~5-7 engineering days spent papering over the gap that PriceCharting fills. The first option is cheaper and faster.

---

## What I need from you

A yes / no / discuss-further before next session. If yes, I'll add the integration as a Pre-Launch backlog item and move on.

*Prepared May 6, 2026. Full vendor analysis lives in `docs/DATA_PARTNERS.md`.*
