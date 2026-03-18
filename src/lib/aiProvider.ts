// src/lib/aiProvider.ts
// Fallback orchestrator for multi-provider AI calls.
// Each AI call is independently wrapped with per-call fallback.
// If Anthropic fails on Call 2, we retry Call 2 on Gemini — we do NOT re-run Call 1.

import { AnthropicProvider } from "./providers/anthropic";
import { GeminiProvider } from "./providers/gemini";
import type { AIProvider, CallResult, ErrorReason } from "./providers/types";
import { NON_RETRYABLE_ERRORS } from "./providers/types";
import { VISION_PROVIDER_ORDER } from "./models";

// ── Safe Provider Construction ──
// Guard: missing API keys must NOT crash the app on cold start.
// Provider order is controlled by VISION_PROVIDER_ORDER in models.ts
const availableProviders: Record<string, AIProvider | null> = {
  anthropic: process.env.ANTHROPIC_API_KEY ? new AnthropicProvider() : null,
  gemini: process.env.GEMINI_API_KEY ? new GeminiProvider() : null,
};

const providers: AIProvider[] = VISION_PROVIDER_ORDER
  .map((name) => availableProviders[name])
  .filter((p): p is AIProvider => p !== null);

if (providers.length === 0) {
  console.error(
    "[aiProvider] CRITICAL: No AI providers configured. All scans will fail."
  );
} else if (providers.length === 1) {
  console.warn(
    `[aiProvider] Only ${providers[0].name} configured. No fallback available.`
  );
}

/** Get the configured provider list (used by the analyze route) */
export function getProviders(): AIProvider[] {
  return providers;
}

// ── Error Classification ──

export function classifyError(error: unknown): ErrorReason {
  if (error instanceof DOMException && error.name === "TimeoutError")
    return "timeout";

  const status = (error as { status?: number })?.status;
  if (status === 400) return "bad_request";
  if (status === 401 || status === 403) return "auth_error";
  if (status === 404) return "model_not_found";
  if (status === 429) return "rate_limited";
  if (status && status >= 500) return "server_error";

  const message = (error as Error)?.message?.toLowerCase() || "";
  if (message.includes("content policy") || message.includes("safety"))
    return "content_policy";

  return "unknown";
}

// ── Dynamic Budget ──

const HARD_DEADLINE_MS = 25_000; // 1s safety before Netlify's 26s limit

export function getRemainingBudget(
  scanStartTime: number,
  reserveMs: number = 4000
): number {
  const elapsed = Date.now() - scanStartTime;
  return Math.max(0, HARD_DEADLINE_MS - elapsed - reserveMs);
}

// ── Per-Call Fallback ──

export async function executeWithFallback<T>(
  callFn: (provider: AIProvider, signal: AbortSignal) => Promise<T>,
  primaryTimeoutMs: number,
  fallbackTimeoutMs: number,
  callLabel: string,
  providerList: AIProvider[] = providers
): Promise<CallResult<T>> {
  let lastReason: ErrorReason | null = null;
  let lastRawError: string | null = null;

  for (let i = 0; i < providerList.length; i++) {
    const provider = providerList[i];
    const timeoutMs = i === 0 ? primaryTimeoutMs : fallbackTimeoutMs;
    const signal = AbortSignal.timeout(timeoutMs);

    try {
      const result = await callFn(provider, signal);
      return {
        result,
        provider: provider.name,
        fallbackUsed: i > 0,
        fallbackReason: i > 0 ? lastReason : null,
        fallbackRawError: i > 0 ? lastRawError : null,
      };
    } catch (error) {
      const reason = classifyError(error);
      const rawMessage =
        (error as Error)?.message?.slice(0, 200) || "unknown error";

      console.error(
        `[${provider.name}:${callLabel}] failed (${reason}): ${rawMessage}`
      );

      lastReason = reason;
      lastRawError = rawMessage;

      // Don't fallback for client errors — same input will fail on both
      if (NON_RETRYABLE_ERRORS.includes(reason)) {
        throw error;
      }

      // If this is the last provider, throw
      if (i === providerList.length - 1) {
        throw error;
      }
      // Otherwise, continue to next provider
    }
  }

  throw new Error(`All providers exhausted for ${callLabel}`);
}
