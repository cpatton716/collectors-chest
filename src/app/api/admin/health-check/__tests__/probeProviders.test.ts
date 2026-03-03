import { probeProvider, buildHealthAlerts } from "../probeProviders";
import type { AIProvider } from "@/lib/providers/types";

// Mock provider that succeeds
function mockProvider(name: "anthropic" | "openai"): AIProvider {
  return {
    name,
    analyzeImage: jest.fn().mockResolvedValue({ title: "test" }),
    verifyAndEnrich: jest.fn().mockResolvedValue({}),
    estimatePrice: jest.fn().mockResolvedValue({}),
    estimateCostCents: jest.fn().mockReturnValue(0),
  } as unknown as AIProvider;
}

// Mock provider that fails
function failingProvider(
  name: "anthropic" | "openai",
  error: string
): AIProvider {
  return {
    name,
    analyzeImage: jest.fn().mockRejectedValue(new Error(error)),
    verifyAndEnrich: jest.fn().mockRejectedValue(new Error(error)),
    estimatePrice: jest.fn().mockRejectedValue(new Error(error)),
    estimateCostCents: jest.fn().mockReturnValue(0),
  } as unknown as AIProvider;
}

describe("probeProvider", () => {
  it("returns healthy for a working provider", async () => {
    const provider = mockProvider("anthropic");
    const result = await probeProvider(provider);
    expect(result.healthy).toBe(true);
    expect(result.provider).toBe("anthropic");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeNull();
  });

  it("returns unhealthy for a failing provider", async () => {
    const provider = failingProvider("anthropic", "403 Forbidden");
    const result = await probeProvider(provider);
    expect(result.healthy).toBe(false);
    expect(result.provider).toBe("anthropic");
    expect(result.error).toContain("403 Forbidden");
  });
});

describe("buildHealthAlerts", () => {
  it("returns empty array when all providers healthy", () => {
    const results = [
      {
        provider: "anthropic" as const,
        healthy: true,
        latencyMs: 200,
        error: null,
      },
      {
        provider: "openai" as const,
        healthy: true,
        latencyMs: 300,
        error: null,
      },
    ];
    expect(buildHealthAlerts(results)).toEqual([]);
  });

  it("returns critical alert when primary (anthropic) is down", () => {
    const results = [
      {
        provider: "anthropic" as const,
        healthy: false,
        latencyMs: 0,
        error: "403 Forbidden",
      },
    ];
    const alerts = buildHealthAlerts(results);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alertType).toBe("critical");
    expect(alerts[0].name).toContain("Anthropic");
  });

  it("returns warning alert when secondary (openai) is down", () => {
    const results = [
      {
        provider: "anthropic" as const,
        healthy: true,
        latencyMs: 200,
        error: null,
      },
      {
        provider: "openai" as const,
        healthy: false,
        latencyMs: 0,
        error: "401 Unauthorized",
      },
    ];
    const alerts = buildHealthAlerts(results);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alertType).toBe("warning");
    expect(alerts[0].name).toContain("OpenAI");
  });

  it("returns critical when both providers down", () => {
    const results = [
      {
        provider: "anthropic" as const,
        healthy: false,
        latencyMs: 0,
        error: "500",
      },
      {
        provider: "openai" as const,
        healthy: false,
        latencyMs: 0,
        error: "500",
      },
    ];
    const alerts = buildHealthAlerts(results);
    expect(alerts).toHaveLength(2);
    expect(alerts.every((a) => a.alertType === "critical")).toBe(true);
  });
});
