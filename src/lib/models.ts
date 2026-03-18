/**
 * Centralized AI model configuration for all providers.
 *
 * Anthropic: Pin to specific version to avoid breaking changes from aliases.
 * Gemini: Use stable model identifiers.
 */

// Anthropic models (primary provider)
export const MODEL_PRIMARY = "claude-sonnet-4-20250514";
export const MODEL_LIGHTWEIGHT = "claude-haiku-4-5-20251001";

// Gemini models (fallback provider)
export const GEMINI_PRIMARY = "gemini-2.0-flash";

// Provider order (first = primary, rest = fallbacks)
// Gemini first — more accurate for comic cover identification in testing
export const VISION_PROVIDER_ORDER = ["gemini", "anthropic"] as const;
