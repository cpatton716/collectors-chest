/**
 * Shared service-limit constants, alert thresholds, and date-window helpers for
 * the admin usage dashboard, alert checks, and lightweight alert-status badge.
 *
 * Previously each of `usage/route.ts`, `usage/check-alerts/route.ts`, and
 * `usage/alert-status/route.ts` defined its own copy of LIMITS, thresholds, and
 * the today/week/month window math. Consolidating here keeps a single source of
 * truth and lets the pure helpers be unit-tested (L-AD6).
 */

/** Free-tier service limits and internal spend budgets. */
export const SERVICE_LIMITS = {
  supabase: {
    database: 500 * 1024 * 1024, // 500MB in bytes
    storage: 1024 * 1024 * 1024, // 1GB in bytes
  },
  upstash: {
    commandsPerDay: 10000,
  },
  clerk: {
    mau: 10000,
  },
  resend: {
    emailsPerMonth: 3000,
  },
  anthropic: {
    // No hard limit, but track spend. $10 monthly budget (in dollars).
    monthlyBudget: 10,
    warningThreshold: 5, // $5 remaining
  },
  coverSearch: {
    monthlyBudgetCents: 1000, // $10 budget
  },
  netlify: {
    bandwidthGB: 100, // Personal plan ~100GB/month
  },
} as const;

/** Alert thresholds expressed as a fraction of a limit. */
export const ALERT_THRESHOLDS = {
  warning: 0.7, // 70%
  critical: 0.9, // 90%
} as const;

/** Daily/weekly scan-spend ceilings, in cents. */
export const SCAN_SPEND_LIMITS_CENTS = {
  daily: 300, // $3.00
  weekly: 1500, // $15.00
} as const;

/** Per-cover-search-call Haiku cost estimate, in cents. */
export const COVER_HAIKU_COST_CENTS = 0.2; // ~$0.002 per call

/** Number of trailing days summed for the cover-search 30-day cost metric. */
const COVER_COST_WINDOW_DAYS = 30;

/**
 * Map a usage fraction (current / limit) to an alert status. Shared so the
 * dashboard, cron alert check, and badge endpoint all classify identically.
 */
export function thresholdStatus(percentage: number): "ok" | "warning" | "critical" {
  if (percentage >= ALERT_THRESHOLDS.critical) return "critical";
  if (percentage >= ALERT_THRESHOLDS.warning) return "warning";
  return "ok";
}

export interface UsageWindows {
  /** Start of the current calendar day (local), ISO string. */
  todayStart: string;
  /** Start of the current week (local, Sunday-based), ISO string. */
  weekStart: string;
  /** Start of the current calendar month (local), ISO string. */
  monthStart: string;
  /** 7 days ago from `now`, ISO string. */
  sevenDaysAgo: string;
  /** 30 days ago from `now`, ISO string. */
  thirtyDaysAgo: string;
  /** 90 days ago from `now`, ISO string. */
  ninetyDaysAgo: string;
}

/**
 * Compute the standard set of usage date windows from a reference instant.
 * Pure helper (default `now = new Date()`) so window math is unit-testable and
 * not duplicated across the usage routes.
 *
 * Note: `getDate() - getDay()` can go negative at month boundaries (e.g. the 1st
 * falling mid-week); the Date constructor handles this by rolling back into the
 * previous month, so weekStart is always correct.
 */
export function getUsageWindows(now: Date = new Date()): UsageWindows {
  return {
    todayStart: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
    weekStart: new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString(),
    monthStart: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    sevenDaysAgo: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    thirtyDaysAgo: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    ninetyDaysAgo: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * The earliest of monthStart / weekStart / sevenDaysAgo, used as a single query
 * lower bound so a fetch covers every window without missing data at month
 * boundaries. Pure helper.
 */
export function earliestWindowStart(windows: UsageWindows): string {
  return new Date(
    Math.min(
      new Date(windows.monthStart).getTime(),
      new Date(windows.weekStart).getTime(),
      new Date(windows.sevenDaysAgo).getTime()
    )
  ).toISOString();
}

/** A scan-analytics row reduced to the field needed for spend summation. */
export interface ScanCostRow {
  estimated_cost_cents: number | string | null;
  scanned_at?: string;
}

/**
 * Sum `estimated_cost_cents` across scan rows, optionally only those at/after a
 * boundary ISO timestamp. This is the authoritative cost source (M-AD3) —
 * callers no longer estimate spend from a comics-count × flat-rate proxy.
 */
export function sumScanCostCents(rows: ScanCostRow[], sinceIso?: string): number {
  return rows.reduce((sum, row) => {
    if (sinceIso && (row.scanned_at === undefined || row.scanned_at < sinceIso)) {
      return sum;
    }
    return sum + Number(row.estimated_cost_cents ?? 0);
  }, 0);
}

/** Generate the trailing-`days` `usage:cover-haiku:<YYYY-MM-DD>` Redis keys. */
export function coverHaikuKeys(now: Date = new Date(), days: number = COVER_COST_WINDOW_DAYS): string[] {
  const keys: string[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    keys.push(`usage:cover-haiku:${date.toISOString().split("T")[0]}`);
  }
  return keys;
}

/** Convert summed Haiku call counts to a cost in cents. */
export function coverHaikuCostCents(totalCalls: number): number {
  return totalCalls * COVER_HAIKU_COST_CENTS;
}
