/**
 * Centralized Anthropic model configuration.
 *
 * Uses "-latest" aliases so model IDs stay current automatically.
 * Pin to a specific version here if a new release breaks behavior.
 */

/** Primary model for cover analysis, price estimation, and complex tasks */
export const MODEL_PRIMARY = "claude-sonnet-4-latest";

/** Lightweight model for title suggestions, content moderation, and simple tasks */
export const MODEL_LIGHTWEIGHT = "claude-haiku-4-5-20251001";
