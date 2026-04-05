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
  provider: "anthropic" | "gemini";
  fallbackUsed: boolean;
  fallbackReason: string | null;
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

// Per-provider cost constants (in cents)
const PROVIDER_COSTS = {
  anthropic: { imageAnalysis: 1.5, verification: 0.6, ebay: 0.15 },
  gemini: { imageAnalysis: 0.3, verification: 0.1, ebay: 0.15 },
} as const;

/**
 * Estimate the cost of a scan in cents based on what API calls were made.
 * Provider-aware: Gemini costs less per call than Anthropic.
 */
export function estimateScanCostCents(params: {
  metadataCacheHit: boolean;
  aiCallsMade: number;
  ebayLookup: boolean;
  provider?: "anthropic" | "gemini";
}): number {
  const c = PROVIDER_COSTS[params.provider || "anthropic"];
  let cost = 0;

  if (params.aiCallsMade >= 1) {
    cost += c.imageAnalysis;
  }
  if (params.aiCallsMade >= 2) {
    cost += (params.aiCallsMade - 1) * c.verification;
  }

  if (params.ebayLookup) {
    cost += c.ebay;
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
  provider?: string;
  fallback_used?: boolean;
  fallback_reason?: string | null;
  cover_harvested?: boolean;
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
      provider: record.provider || "anthropic",
      fallback_used: record.fallback_used || false,
      fallback_reason: record.fallback_reason || null,
      cover_harvested: record.cover_harvested ?? false,
    });
  } catch (err) {
    console.error("Failed to record scan analytics:", err);
  }
}
