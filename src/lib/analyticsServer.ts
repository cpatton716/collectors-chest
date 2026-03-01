import { PostHog } from "posthog-node";
import { supabaseAdmin } from "@/lib/supabase";

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

// --- Scan Analytics (Supabase) ---

export interface ScanAnalyticsRecord {
  profile_id: string | null;
  scan_method: string;
  estimated_cost_cents: number;
  ai_calls_made: number;
  metadata_cache_hit: boolean;
  ebay_lookup: boolean;
  duration_ms: number;
  success: boolean;
  subscription_tier: string;
  error_type?: string | null;
}

export async function recordScanAnalytics(
  record: ScanAnalyticsRecord
): Promise<void> {
  try {
    await supabaseAdmin.from("scan_analytics").insert({
      profile_id: record.profile_id,
      scan_method: record.scan_method,
      estimated_cost_cents: record.estimated_cost_cents,
      ai_calls_made: record.ai_calls_made,
      metadata_cache_hit: record.metadata_cache_hit,
      ebay_lookup: record.ebay_lookup,
      duration_ms: record.duration_ms,
      success: record.success,
      subscription_tier: record.subscription_tier,
      error_type: record.error_type || null,
    });
  } catch (err) {
    console.error("Failed to record scan analytics:", err);
  }
}
