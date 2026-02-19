import { estimateScanCostCents } from "../analyticsServer";

describe("estimateScanCostCents", () => {
  it("returns 0 when no AI calls made", () => {
    expect(
      estimateScanCostCents({ metadataCacheHit: true, aiCallsMade: 0, ebayLookup: false })
    ).toBe(0);
  });

  it("returns ~1.5 cents for initial scan AI call only", () => {
    const cost = estimateScanCostCents({ metadataCacheHit: false, aiCallsMade: 1, ebayLookup: false });
    expect(cost).toBeGreaterThanOrEqual(1.0);
    expect(cost).toBeLessThanOrEqual(2.0);
  });

  it("adds verification cost for second AI call", () => {
    const one = estimateScanCostCents({ metadataCacheHit: false, aiCallsMade: 1, ebayLookup: false });
    const two = estimateScanCostCents({ metadataCacheHit: false, aiCallsMade: 2, ebayLookup: false });
    expect(two).toBeGreaterThan(one);
  });

  it("adds eBay lookup cost", () => {
    const without = estimateScanCostCents({ metadataCacheHit: false, aiCallsMade: 1, ebayLookup: false });
    const withEbay = estimateScanCostCents({ metadataCacheHit: false, aiCallsMade: 1, ebayLookup: true });
    expect(withEbay).toBeGreaterThan(without);
  });

  it("scales cost with multiple AI calls", () => {
    const two = estimateScanCostCents({ metadataCacheHit: false, aiCallsMade: 2, ebayLookup: false });
    const three = estimateScanCostCents({ metadataCacheHit: false, aiCallsMade: 3, ebayLookup: false });
    expect(three).toBeGreaterThan(two);
  });
});
