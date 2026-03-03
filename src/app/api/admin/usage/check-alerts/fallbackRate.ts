export interface AlertMetric {
  name: string;
  current: number;
  limit: number;
  percentage: number;
  alertType: "warning" | "critical";
}

export const FALLBACK_THRESHOLDS = {
  warning: 0.1,
  critical: 0.25,
} as const;

interface FallbackCounts {
  total: number;
  fallbackCount: number;
}

export function calculateFallbackRate(
  counts: FallbackCounts
): AlertMetric | null {
  if (counts.total === 0) return null;

  const rate = counts.fallbackCount / counts.total;

  if (rate >= FALLBACK_THRESHOLDS.critical) {
    return {
      name: "AI Fallback Rate (1h)",
      current: counts.fallbackCount,
      limit: counts.total,
      percentage: rate,
      alertType: "critical",
    };
  }

  if (rate >= FALLBACK_THRESHOLDS.warning) {
    return {
      name: "AI Fallback Rate (1h)",
      current: counts.fallbackCount,
      limit: counts.total,
      percentage: rate,
      alertType: "warning",
    };
  }

  return null;
}
