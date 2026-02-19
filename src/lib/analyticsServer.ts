import { PostHog } from "posthog-node";

// Serverless-optimized: flush immediately, no batching
const posthogServer =
  process.env.NEXT_PUBLIC_POSTHOG_KEY
    ? new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        flushAt: 1,
        flushInterval: 0,
      })
    : null;

export interface ScanEventProperties {
  scanMethod: string;
  metadataCacheHit: boolean;
  redisCacheHit: boolean;
  supabaseCacheHit: boolean;
  aiCallsMade: number;
  ebayLookup: boolean;
  durationMs: number;
  estimatedCostCents: number;
  success: boolean;
  userId?: string;
  subscriptionTier?: string;
}

/**
 * Track a scan event server-side with cost and performance data.
 * Fire-and-forget — never blocks the response.
 */
export async function trackScanServer(
  distinctId: string,
  properties: ScanEventProperties
): Promise<void> {
  if (!posthogServer) return;

  posthogServer.capture({
    distinctId,
    event: "scan_completed_server",
    properties,
  });

  await posthogServer.shutdown();
}

// Cost estimation constants (in cents)
const INITIAL_SCAN_COST = 1.5; // Image analysis AI call (~$0.015)
const VERIFICATION_COST = 0.6; // Combined Verification AI call (~$0.006)
const EBAY_LOOKUP_COST = 0.15; // eBay API + processing (~$0.0015)

/**
 * Estimate the cost of a scan in cents based on what API calls were made.
 */
export function estimateScanCostCents(params: {
  metadataCacheHit: boolean;
  aiCallsMade: number;
  ebayLookup: boolean;
}): number {
  let cost = 0;

  if (params.aiCallsMade >= 1) {
    cost += INITIAL_SCAN_COST;
  }
  if (params.aiCallsMade >= 2) {
    cost += (params.aiCallsMade - 1) * VERIFICATION_COST;
  }

  if (params.ebayLookup) {
    cost += EBAY_LOOKUP_COST;
  }

  return Math.round(cost * 100) / 100;
}
