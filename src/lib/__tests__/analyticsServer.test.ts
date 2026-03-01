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
