import type { AIProvider } from "@/lib/providers/types";

export interface ProbeResult {
  provider: "anthropic" | "gemini";
  healthy: boolean;
  latencyMs: number;
  error: string | null;
}

interface AlertMetric {
  name: string;
  current: number;
  limit: number;
  percentage: number;
  alertType: "warning" | "critical";
}

/**
 * Probe a provider with a minimal analyzeImage call.
 * Uses a tiny base64 1x1 PNG to minimize cost (~0 tokens).
 */
export async function probeProvider(provider: AIProvider): Promise<ProbeResult> {
  const start = Date.now();
  try {
    // Tiny 1x1 transparent PNG — minimal token cost
    const tinyPng =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

    await provider.analyzeImage(
      { base64Data: tinyPng, mediaType: "image/png" },
      { signal: AbortSignal.timeout(10_000) }
    );

    return {
      provider: provider.name,
      healthy: true,
      latencyMs: Date.now() - start,
      error: null,
    };
  } catch (err) {
    return {
      provider: provider.name,
      healthy: false,
      latencyMs: Date.now() - start,
      error:
        err instanceof Error ? err.message.slice(0, 200) : "Unknown error",
    };
  }
}

/**
 * Build alert metrics from probe results.
 * Primary provider (anthropic) down = critical.
 * Secondary provider (gemini) down = warning.
 * Both down = both critical.
 */
export function buildHealthAlerts(results: ProbeResult[]): AlertMetric[] {
  const alerts: AlertMetric[] = [];

  for (const result of results) {
    if (result.healthy) continue;

    const isPrimary = result.provider === "anthropic";
    const displayName =
      result.provider === "anthropic" ? "Anthropic" : "Gemini";

    alerts.push({
      name: `${displayName} Provider Health`,
      current: 0,
      limit: 1,
      percentage: 0,
      alertType: isPrimary ? "critical" : "warning",
    });
  }

  // If both providers are down, escalate secondary to critical too
  if (results.length > 1 && results.every((r) => !r.healthy)) {
    for (const alert of alerts) {
      alert.alertType = "critical";
    }
  }

  return alerts;
}
