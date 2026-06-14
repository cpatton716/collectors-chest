import {
  estimateScanCostCents,
  estimateTextLookupCostCents,
  estimateScanCostBreakdown,
} from "../analyticsServer";

// NOTE: As of the Gemini-primary remediation, the DEFAULT provider for
// estimateScanCostCents is "gemini" (the configured primary), not "anthropic".
describe("estimateScanCostCents (default = gemini-primary)", () => {
  it("returns Gemini base cost for a simple scan with no extras", () => {
    const cost = estimateScanCostCents({
      metadataCacheHit: false,
      aiCallsMade: 1,
      ebayLookup: false,
    });
    expect(cost).toBe(0.3);
  });

  it("adds verification cost for additional AI calls", () => {
    const cost = estimateScanCostCents({
      metadataCacheHit: false,
      aiCallsMade: 2,
      ebayLookup: false,
    });
    expect(cost).toBe(0.4); // 0.3 + 0.1
  });

  it("adds eBay lookup cost", () => {
    const cost = estimateScanCostCents({
      metadataCacheHit: false,
      aiCallsMade: 1,
      ebayLookup: true,
    });
    expect(cost).toBe(0.45); // 0.3 + 0.15
  });

  it("returns zero cost on cache hit with no AI calls", () => {
    const cost = estimateScanCostCents({
      metadataCacheHit: true,
      aiCallsMade: 0,
      ebayLookup: false,
    });
    expect(cost).toBe(0);
  });

  it("handles full scan with all costs (gemini default)", () => {
    const cost = estimateScanCostCents({
      metadataCacheHit: false,
      aiCallsMade: 3,
      ebayLookup: true,
    });
    expect(cost).toBe(0.65); // 0.3 + 0.1 + 0.1 + 0.15
  });
});

describe("estimateScanCostCents - provider awareness", () => {
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
      estimateScanCostCents({ metadataCacheHit: false, aiCallsMade: 0, ebayLookup: false, provider: "anthropic" })
    ).toBe(0);
  });

  it("handles 3 AI calls with Anthropic provider", () => {
    const cost = estimateScanCostCents({
      metadataCacheHit: false,
      aiCallsMade: 3,
      ebayLookup: false,
      provider: "anthropic",
    });
    expect(cost).toBe(2.7); // 1.5 + 0.6 + 0.6
  });
});

describe("estimateTextLookupCostCents", () => {
  it("defaults to Anthropic (Haiku) text cost", () => {
    // Text lookups run on Claude Haiku by default.
    expect(estimateTextLookupCostCents({ aiCallsMade: 1 })).toBe(0.08);
  });

  it("scales by number of calls", () => {
    expect(estimateTextLookupCostCents({ aiCallsMade: 3 })).toBe(0.24); // 3 * 0.08
  });

  it("adds eBay lookup cost when requested", () => {
    expect(estimateTextLookupCostCents({ aiCallsMade: 1, ebayLookup: true })).toBe(0.23); // 0.08 + 0.15
  });

  it("returns 0 for zero calls and no ebay", () => {
    expect(estimateTextLookupCostCents({ aiCallsMade: 0 })).toBe(0);
  });

  it("uses the cheaper text rate for gemini", () => {
    expect(estimateTextLookupCostCents({ aiCallsMade: 2, provider: "gemini" })).toBe(0.1); // 2 * 0.05
  });
});

describe("estimateScanCostBreakdown", () => {
  it("returns 0 for an empty breakdown", () => {
    expect(estimateScanCostBreakdown([])).toBe(0);
  });

  it("sums a single-provider scan (gemini image + verification)", () => {
    const cost = estimateScanCostBreakdown([
      { type: "imageAnalysis", provider: "gemini" },
      { type: "verification", provider: "gemini" },
    ]);
    expect(cost).toBe(0.4); // 0.3 + 0.1
  });

  it("attributes each call to its own provider for a mixed-provider scan", () => {
    // Gemini image analysis, Anthropic fallback on verification, + eBay
    const cost = estimateScanCostBreakdown([
      { type: "imageAnalysis", provider: "gemini" }, // 0.3
      { type: "verification", provider: "anthropic" }, // 0.6
      { type: "ebay", provider: "gemini" }, // 0.15
    ]);
    expect(cost).toBe(1.05);
  });

  it("is more accurate than a flat-rate estimate for mixed providers", () => {
    const breakdown = estimateScanCostBreakdown([
      { type: "imageAnalysis", provider: "gemini" },
      { type: "verification", provider: "anthropic" },
    ]);
    // Flat estimate assuming the dominant (gemini) provider would undercount.
    const flat = estimateScanCostCents({
      metadataCacheHit: false,
      aiCallsMade: 2,
      ebayLookup: false,
      provider: "gemini",
    });
    expect(breakdown).toBe(0.9); // 0.3 + 0.6
    expect(flat).toBe(0.4); // 0.3 + 0.1
    expect(breakdown).toBeGreaterThan(flat);
  });
});
