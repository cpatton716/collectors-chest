# Subscription Tier Structure

> **Reference document for Collectors Chest subscription and monetization model.**
>
> *Last Updated: June 14, 2026*

---

## Overview

Collectors Chest uses a three-tier model designed to maximize conversion while providing genuine value at each level:

1. **Guest** - No registration, taste of the product
2. **Free** - Registered account, core features with limits
3. **Premium** - Full access, power user features

---

## Tier Comparison

| Feature | Guest | Free | Premium |
|---------|-------|------|---------|
| **Registration** | Not required | Required | Required |
| **Scans** | 5 total (lifetime) | 10/month | Unlimited |
| **Storage** | localStorage | Cloud sync | Cloud sync |
| **Collection size** | No limit | No limit | No limit |
| **Shop - Browse** | ✅ | ✅ | ✅ |
| **Shop - Buy/Bid** | ❌ | ✅ | ✅ |
| **Shop - Sell** | ❌ | 3 listings max | Unlimited |
| **Transaction fee** | — | 8% | 5% |
| **CSV Import** | ❌ | ✅ | ✅ |
| **CSV Export** | ❌ | ❌ | ✅ |
| **Key Hunt** | ❌ | ❌ | ✅ |
| **Statistics** | ❌ | Basic | Full |
| **Public Profile** | ❌ | ✅ | ✅ |
| **7-day Trial** | ❌ | ✅ (once) | — |

---

## Detailed Tier Breakdown

### Guest (No Registration)

**Purpose:** Low-friction introduction to the product. Let users experience Technopathic cover recognition without commitment.

| Attribute | Value |
|-----------|-------|
| Scan limit | 5 scans (lifetime, not monthly) |
| Data storage | localStorage only |
| Shop access | Browse only - cannot buy, bid, or sell |
| On signup | Prompt to migrate localStorage collection to cloud |

**Conversion triggers:**
- After 5th scan: Hard wall requiring registration
- Shop purchase/bid attempt: Registration required modal

---

### Free (Registered)

**Purpose:** Core product experience with enough limits to demonstrate Premium value.

| Attribute | Value |
|-----------|-------|
| Scan limit | 10 scans per month |
| Scan reset | 1st of each calendar month |
| Data storage | Cloud sync (Supabase) |
| Collection limit | None |
| Shop - Buying | Full access (auctions + Buy Now) |
| Shop - Selling | Maximum 3 active listings |
| Transaction fee | 8% of sale price |
| CSV | Import only |
| Statistics | Basic (total value, comic count, top publishers) |
| Public profile | Yes (`/u/[username]`) |
| Key Hunt | Not available |
| Premium trial | One 7-day trial per account |
| Scan packs | Can purchase $1.99 for 10 additional scans |

**When scan limit reached, show:**
1. "Your scans reset on [date]"
2. "Start your free 7-day Premium trial"
3. "Buy 10 more scans for $1.99"

---

### Premium (Subscription)

**Purpose:** Full-featured experience for serious collectors and active sellers.

| Attribute | Value |
|-----------|-------|
| Monthly price | $4.99/month |
| Annual price | $49.99/year (~17% discount, 2 months free) |
| Scan limit | Unlimited |
| Data storage | Cloud sync (Supabase) |
| Collection limit | None |
| Shop - Buying | Full access |
| Shop - Selling | Unlimited active listings |
| Transaction fee | 5% of sale price |
| CSV | Import + Export |
| Statistics | Full (trends, insights, value changes, breakdowns) |
| Public profile | Yes |
| Key Hunt | Full offline access |

**Value proposition summary:**
- Unlimited scans (vs 10/month)
- 3% lower transaction fees (saves money for active sellers)
- Key Hunt for conventions
- CSV export for backup/analysis
- Advanced statistics and insights

---

## Premium Trial

### Eligibility
- **Registered Free users only** (not guests)
- **One trial per account** (tracked by user ID)

### Trial Behavior

| Aspect | Behavior |
|--------|----------|
| Duration | 7 days from activation |
| Access during trial | Full Premium features |
| Scans during trial | Unlimited |
| Comics scanned | **Kept in collection** even if trial expires |
| Features after expiry | Reverts to Free tier (loses Key Hunt, Export, Full Stats) |

### 30-Day Promo Trial (QR-Exclusive)

A longer **30-day** Premium trial offered through QR-code campaigns (e.g., convention floor, partner promos) instead of the standard 7-day trial.

| Aspect | Behavior |
|--------|----------|
| Duration | 30 days from activation |
| Eligibility | Gated server-side on `profiles.promo_trial_eligible` |
| Access | Issued via a signed, single-use promo token (never trusted from the request body) |
| One per account | Yes — consuming the token clears eligibility |
| Behavior otherwise | Same as the standard trial (unlimited scans, full Premium, collection kept on expiry) |

### Trial Conversion Prompts

| Timing | Trigger | Message Focus |
|--------|---------|---------------|
| Registration | After email verification | "Start your 7-day Premium trial" |
| Scan limit | When 10/month reached | "Upgrade to Premium for unlimited scans" |
| Feature gate | Attempting Key Hunt, Export, etc. | "This feature is available with Premium" |
| Day 3 | 3 days into trial | "Enjoying Premium? Subscribe to keep access" |
| Day 6 | Day before trial ends | "Your trial ends tomorrow - don't lose your Premium features" |

---

## Scan Pack (À La Carte)

For Free users who hit their monthly limit but aren't ready to subscribe.

| Attribute | Value |
|-----------|-------|
| Price | $1.99 |
| Scans included | 10 |
| Expiration | None (scans don't expire) |
| Availability | Free tier only (Premium has unlimited) |

**Purchase UI includes:** "Or get unlimited scans + Key Hunt + full stats for $4.99/mo"

**Strategic purpose:**
- Breaks "free user" mindset with small payment
- After 2-3 purchases ($4-6 spent), Premium subscription becomes obvious better value
- Validates user's willingness to pay

---

## Transaction Fees

| Tier | Fee | Example ($100 sale) |
|------|-----|---------------------|
| Free | 8% | $8.00 fee, $92.00 to seller |
| Premium | 5% | $5.00 fee, $95.00 to seller |

**Minimum platform fee:** A **$0.75** fee floor applies to every sale. On low-value items the percentage fee is raised to $0.75 so the platform doesn't net a loss after Stripe's per-transaction cost (e.g., a $5 Free-tier sale would be $0.40 at 8% → floored to $0.75).

**Break-even calculation:**
- Premium costs $4.99/month
- 3% fee savings on $166.33 in sales = $4.99
- Sellers moving $166+/month save money with Premium

---

## Statistics Access

### Basic Stats (Free)
- Total collection value
- Total comic count
- Comics by publisher (pie chart)
- Most valuable comic

### Full Stats (Premium)
All basic stats plus:
- Value change over time (30/60/90 day trends)
- "Biggest Increase" insight
- "Best Buy" (highest ROI) insight
- "Biggest Decline" insight
- Graded vs raw breakdown
- Purchase price vs current value analysis
- Detailed publisher/era breakdowns

---

## Feature Gating Reference

Quick reference for which features require upgrade prompts:

| Feature | Guest | Free | Premium |
|---------|-------|------|---------|
| Scan comic | ✅ (5 total) | ✅ (10/mo) | ✅ (unlimited) |
| Save to collection | ❌ (localStorage) | ✅ | ✅ |
| View collection | ❌ | ✅ | ✅ |
| Browse Shop | ✅ | ✅ | ✅ |
| Buy/Bid in Shop | ❌ → Register | ✅ | ✅ |
| List item for sale | ❌ → Register | ✅ (3 max) | ✅ (unlimited) |
| CSV Import | ❌ | ✅ | ✅ |
| CSV Export | ❌ | ❌ → Upgrade | ✅ |
| Key Hunt | ❌ | ❌ → Upgrade | ✅ |
| Full Statistics | ❌ | ❌ → Upgrade | ✅ |
| Public Profile | ❌ | ✅ | ✅ |

---

## Data Migration

### Guest → Free Registration

When a guest registers:
1. Show migration modal: "We found X comics in your browser. Import them to your new account?"
2. Options: "Import All" / "Start Fresh"
3. If import: Copy localStorage comics to Supabase, link to new user ID
4. Clear localStorage after successful migration

### Free → Premium Upgrade

No data migration needed - same account, features unlock immediately.

### Premium → Free Downgrade (Cancellation)

When Premium subscription ends:
1. Collection remains intact (no data loss)
2. Features revert to Free tier limits
3. If over 3 active listings: Oldest listings auto-expire, notify user
4. Key Hunt, Export, Full Stats become gated

---

## Pricing Summary

| Product | Price | Billing |
|---------|-------|---------|
| Premium Monthly | $4.99 | Recurring monthly |
| Premium Annual | $49.99 | Recurring yearly |
| Scan Pack | $1.99 | One-time purchase |
| Transaction Fee (Free) | 8% | Per sale |
| Transaction Fee (Premium) | 5% | Per sale |

---

## Changelog

| Date | Change |
|------|--------|
| Jan 15, 2026 | Initial tier structure defined |
| Jun 14, 2026 | "AI" → "Technopathic" cover-recognition wording; added 30-day QR-exclusive promo trial; documented $0.75 minimum platform fee floor |

---

## Questions?

If there's ambiguity about tier behavior, check this document first. If not covered here, document the decision and update this file.
