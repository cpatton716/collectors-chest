/**
 * Centralized AI model configuration for all providers.
 *
 * Provider order is Gemini-primary, Anthropic-fallback (see
 * {@link VISION_PROVIDER_ORDER}) — Gemini Flash is more accurate for comic
 * cover identification in testing and is materially cheaper per call, so it
 * runs first and Anthropic (Claude) is only used as a fallback.
 *
 * Anthropic: Pin to specific version to avoid breaking changes from aliases.
 * Gemini: Use stable model identifiers.
 */

// Anthropic models (fallback provider)
// MODEL_PRIMARY is the higher-quality Claude model used for vision fallback.
// MODEL_LIGHTWEIGHT (Haiku) handles cheap text-only lookups (titles, publisher,
// metadata, cover-search) where vision-grade reasoning isn't required.
export const MODEL_PRIMARY = "claude-sonnet-4-5-20250929";
export const MODEL_LIGHTWEIGHT = "claude-haiku-4-5-20251001";

// Gemini models (primary provider)
export const GEMINI_PRIMARY = "gemini-2.0-flash";

// Provider order (first = primary, rest = fallbacks)
// Gemini first - more accurate for comic cover identification in testing and
// cheaper per call. Anthropic (Claude) is the fallback.
export const VISION_PROVIDER_ORDER = ["gemini", "anthropic"] as const;

/**
 * Centralized per-call, per-provider cost estimates (in US cents).
 *
 * Single source of truth for cost math across analytics and admin usage
 * reporting. Gemini Flash (the primary provider) is materially cheaper than
 * Claude per call, which is the basis of the Gemini-primary economics:
 * - imageAnalysis: a vision call (slab detection / detail extraction)
 * - verification: a follow-up enrichment/verification call
 * - text: a text-only lookup (titles, publisher, metadata) — Haiku-class
 * - ebay: a single eBay Browse price lookup (provider-independent)
 *
 * NOTE: These are estimates for budgeting/alerting, not billed amounts.
 */
export const AI_COST_CENTS = {
  gemini: { imageAnalysis: 0.3, verification: 0.1, text: 0.05, ebay: 0.15 },
  anthropic: { imageAnalysis: 1.5, verification: 0.6, text: 0.08, ebay: 0.15 },
} as const;

export type AICostProvider = keyof typeof AI_COST_CENTS;
