import { PostHog } from "posthog-node";
import { supabaseAdmin } from "@/lib/supabase";
import { AI_COST_CENTS, type AICostProvider } from "@/lib/models";

// Serverless: small batch buffer so multiple captures in one invocation share a
// single network flush. We explicitly flush() (not shutdown) after capture so
// the client stays reusable across warm invocations instead of being torn down.
const posthogServer =
  process.env.NEXT_PUBLIC_POSTHOG_KEY
    ? new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        flushAt: 20,
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
 * Fire-and-forget - never blocks the response.
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

  // Deferred flush instead of shutdown(): pushes the buffered event without
  // tearing down the client, so it can be reused across warm invocations.
  await posthogServer.flush();
}

/**
 * Estimate the cost of a scan in cents based on what API calls were made.
 * Provider-aware: Gemini (primary) costs less per call than Anthropic (fallback).
 * Cost constants are centralized in {@link AI_COST_CENTS} (models.ts).
 */
export function estimateScanCostCents(params: {
  metadataCacheHit: boolean;
  aiCallsMade: number;
  ebayLookup: boolean;
  provider?: AICostProvider;
}): number {
  const c = AI_COST_CENTS[params.provider || "gemini"];
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

export interface ScanCostCall {
  /** Logical call type — drives which AI_COST_CENTS slot is used. */
  type: "imageAnalysis" | "verification" | "ebay";
  /** Provider that actually served this call (Gemini primary, Anthropic fallback). */
  provider: AICostProvider;
}

/**
 * Estimate scan cost from an explicit per-call breakdown rather than a flat
 * `aiCallsMade` count. This is more accurate for mixed-provider scans (e.g.
 * Gemini image analysis + Anthropic fallback verification) where each call may
 * have a different provider/cost. Returns the total in cents.
 */
export function estimateScanCostBreakdown(calls: ScanCostCall[]): number {
  const total = calls.reduce((sum, call) => {
    const c = AI_COST_CENTS[call.provider];
    switch (call.type) {
      case "imageAnalysis":
        return sum + c.imageAnalysis;
      case "verification":
        return sum + c.verification;
      case "ebay":
        return sum + c.ebay;
      default:
        return sum;
    }
  }, 0);
  return Math.round(total * 100) / 100;
}

/**
 * Estimate the cost of a text-only AI lookup (titles, publisher, metadata),
 * which uses the cheap Haiku-class model rather than a vision call.
 * Centralizes the per-call text cost so lookup routes stop hardcoding it.
 */
export function estimateTextLookupCostCents(params: {
  aiCallsMade: number;
  ebayLookup?: boolean;
  provider?: AICostProvider;
}): number {
  const c = AI_COST_CENTS[params.provider || "anthropic"];
  let cost = params.aiCallsMade * c.text;
  if (params.ebayLookup) cost += c.ebay;
  return Math.round(cost * 100) / 100;
}

// --- Scan Analytics (Supabase) ---

export type ScanPath =
  | "cert-first-cached"
  | "cert-first-full"
  | "cert-first-fallback"
  | "full-pipeline";

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
  scan_path?: ScanPath;
  barcode_extracted?: boolean;
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
      provider: record.provider || "gemini",
      fallback_used: record.fallback_used || false,
      fallback_reason: record.fallback_reason || null,
      cover_harvested: record.cover_harvested ?? false,
      scan_path: record.scan_path || "full-pipeline",
      barcode_extracted: record.barcode_extracted ?? false,
    });
  } catch (err) {
    console.error("Failed to record scan analytics:", err);
  }
}
