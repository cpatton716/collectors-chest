/**
 * Centralized AI model configuration for all providers.
 *
 * Anthropic: Pin to specific version to avoid breaking changes from aliases.
 * OpenAI: Use stable model identifiers.
 */

// Anthropic models (primary provider)
export const MODEL_PRIMARY = "claude-sonnet-4-20250514";
export const MODEL_LIGHTWEIGHT = "claude-haiku-4-5-20251001";

// OpenAI models (fallback provider)
export const OPENAI_PRIMARY = "gpt-4o";
export const OPENAI_LIGHTWEIGHT = "gpt-4o-mini";

// Provider order (first = primary, rest = fallbacks)
export const VISION_PROVIDER_ORDER = ["anthropic", "openai"] as const;
