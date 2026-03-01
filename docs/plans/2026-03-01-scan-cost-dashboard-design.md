# Scan Cost Dashboard Design

> **Date:** March 1, 2026
> **Status:** Approved
> **Goal:** Add scan cost insights, performance metrics, and spend alerts to Admin > Usage page

---

## Overview

Enhance the existing Admin > Usage page with detailed scan analytics powered by a new `scan_analytics` Supabase table. Add email alerts via Resend when Anthropic scan costs exceed daily/weekly thresholds.

---

## 1. Data Layer

### New Table: `scan_analytics`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK, default gen_random_uuid() |
| `profile_id` | text | Clerk user ID (nullable for guests) |
| `scanned_at` | timestamptz | default now() |
| `scan_method` | text | camera, upload, barcode, quick-lookup |
| `estimated_cost_cents` | numeric | Cost in cents (1.5 base) |
| `ai_calls_made` | int | Number of Anthropic API calls |
| `metadata_cache_hit` | boolean | Was comic metadata cached? |
| `ebay_lookup` | boolean | Did eBay API get called? |
| `duration_ms` | int | Total scan time in milliseconds |
| `success` | boolean | Did scan complete successfully? |
| `subscription_tier` | text | guest, free, premium |

### Indexes

- `idx_scan_analytics_scanned_at` on `scanned_at` (for date range aggregation)
- `idx_scan_analytics_profile` on `profile_id` (for per-user queries)

### RLS Policy

- Admin-only read access (matches existing admin pattern)
- Insert from service role only (server-side writes)

### Write Path

At the end of `/api/analyze/route.ts`, where `trackScanServer()` already fires, also insert a row into `scan_analytics`. Fire-and-forget (don't await, don't block the response).

### Retention

Keep all rows. Even 10K scans/month is ~1MB/year — negligible.

---

## 2. Admin > Usage Page Enhancements

Add a new "Scan Analytics" section below the existing metrics grid.

### Cost Metrics

| Metric | Display | Query |
|--------|---------|-------|
| Today's Spend | $X.XX / $3.00 (progress bar) | SUM(estimated_cost_cents) WHERE scanned_at >= today |
| This Week's Spend | $X.XX / $15.00 (progress bar) | SUM(estimated_cost_cents) WHERE scanned_at >= start of week |
| This Month's Spend | $X.XX (no limit) | SUM(estimated_cost_cents) WHERE scanned_at >= start of month |
| Avg Cost Per Scan | X.X cents | AVG(estimated_cost_cents) all time |
| Projected Monthly Cost | ~$X.XX | today's avg rate x 30 |

### Performance Metrics

| Metric | Display | Query |
|--------|---------|-------|
| Cache Hit Rate | XX% (progress bar, higher = better) | AVG(metadata_cache_hit::int) * 100 |
| Avg Scan Duration | X.Xs | AVG(duration_ms) / 1000 |
| AI Calls Per Scan | X.X avg | AVG(ai_calls_made) |
| eBay Lookup Rate | XX% | AVG(ebay_lookup::int) * 100 |
| Success Rate | XX% | AVG(success::int) * 100 |
| Total Scans (30d) | NNN | COUNT WHERE last 30 days |

### Styling

Same Lichtenstein card styling as existing metrics. Status badges on cost metrics (OK < 70%, Warning 70-90%, Critical > 90% of threshold).

---

## 3. Email Alerts

### Thresholds (Moderate Tier)

- Daily spend >= $3.00 -> alert email
- Weekly spend >= $15.00 -> alert email

### Implementation

Extend the existing `check-alerts` API route (`/api/admin/usage/check-alerts`):

1. Query `scan_analytics` for today's total and this week's total
2. If threshold exceeded AND no alert sent today for that type -> send email via Resend
3. Record alert in existing `usage_alerts` table to prevent repeats

### Email Content

Simple text email:
- Subject: "Collectors Chest: Daily scan spend alert"
- Body: "Daily scan spend: $3.45 (threshold: $3.00). 230 scans processed today. View details at collectors-chest.com/admin/usage"

No new cron job needed — piggybacks on existing alert-checking cron.

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/analyticsServer.ts` | Add `recordScanAnalytics()` helper |
| `src/app/api/analyze/route.ts` | Insert row into `scan_analytics` after scan (success + failure paths) |
| `src/app/api/quick-lookup/route.ts` | Record scan analytics for quick lookups |
| `src/app/api/con-mode-lookup/route.ts` | Record scan analytics for con mode lookups |
| `src/app/api/import-lookup/route.ts` | Record scan analytics for import lookups |
| `src/app/api/comic-lookup/route.ts` | Record scan analytics for comic lookups |
| `src/app/api/admin/usage/route.ts` | Add scan analytics queries to response |
| `src/app/admin/usage/page.tsx` | Add Scan Analytics section with cost + performance cards |
| `src/app/api/admin/usage/check-alerts/route.ts` | Add scan cost threshold checks |

## Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/20260301_scan_analytics.sql` | Table, indexes, RLS, aggregate function |
| `src/lib/scanAnalyticsHelpers.ts` | Display helpers (formatCents, getScanStatus) |
| `src/lib/__tests__/analyticsServer.test.ts` | Cost estimation tests |
| `src/lib/__tests__/scanAnalyticsHelpers.test.ts` | Display helper tests |
