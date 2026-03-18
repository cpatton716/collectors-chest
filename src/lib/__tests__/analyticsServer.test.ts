import { estimateScanCostCents } from "../analyticsServer";

describe("estimateScanCostCents", () => {
  it("returns base cost for a simple scan with no extras", () => {
    const cost = estimateScanCostCents({
      metadataCacheHit: false,
      aiCallsMade: 1,
      ebayLookup: false,
    });
    expect(cost).toBe(1.5);
  });

  it("adds verification cost for additional AI calls", () => {
    const cost = estimateScanCostCents({
      metadataCacheHit: false,
      aiCallsMade: 2,
      ebayLookup: false,
    });
    expect(cost).toBe(2.1);
  });

  it("adds eBay lookup cost", () => {
    const cost = estimateScanCostCents({
      metadataCacheHit: false,
      aiCallsMade: 1,
      ebayLookup: true,
    });
    expect(cost).toBe(1.65);
  });

  it("returns zero cost on cache hit with no AI calls", () => {
    const cost = estimateScanCostCents({
      metadataCacheHit: true,
      aiCallsMade: 0,
      ebayLookup: false,
    });
    expect(cost).toBe(0);
  });

  it("handles full scan with all costs", () => {
    const cost = estimateScanCostCents({
      metadataCacheHit: false,
      aiCallsMade: 3,
      ebayLookup: true,
    });
    expect(cost).toBe(2.85);
  });
});

describe("estimateScanCostCents - provider awareness", () => {
  it("returns Anthropic costs by default (no provider specified)", () => {
    const cost = estimateScanCostCents({
      metadataCacheHit: false,
      aiCallsMade: 1,
      ebayLookup: false,
    });
    expect(cost).toBe(1.5);
  });

  it("returns Anthropic costs when explicitly specified", () => {
    const cost = estimateScanCostCents({
      metadataCacheHit: false,
      aiCallsMade: 2,
      ebayLookup: true,
      provider: "anthropic",
    });
    expect(cost).toBe(2.25); // 1.5 + 0.6 + 0.15
  });

  it("returns lower Gemini costs", () => {
    const cost = estimateScanCostCents({
      metadataCacheHit: false,
      aiCallsMade: 2,
      ebayLookup: true,
      provider: "gemini",
    });
    expect(cost).toBe(0.55); // 0.3 + 0.1 + 0.15
  });

  it("returns 0 for 0 AI calls regardless of provider", () => {
    expect(
      estimateScanCostCents({ metadataCacheHit: false, aiCallsMade: 0, ebayLookup: false, provider: "gemini" })
    ).toBe(0);
  });

  it("handles 3 AI calls with Gemini provider", () => {
    const cost = estimateScanCostCents({
      metadataCacheHit: false,
      aiCallsMade: 3,
      ebayLookup: false,
      provider: "gemini",
    });
    expect(cost).toBe(0.5); // 0.3 + 0.1 + 0.1
  });
});
