// ─── ebayBrowse.ts — unit tests ────────────────────────────────────

const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = {
    ...originalEnv,
    EBAY_APP_ID: "test-app-id",
    EBAY_CLIENT_SECRET: "test-client-secret",
  };
});

afterEach(() => {
  process.env = originalEnv;
});

// ─── isBrowseApiConfigured ─────────────────────────────────────────
describe("isBrowseApiConfigured", () => {
  it("returns false when EBAY_APP_ID is missing", () => {
    delete process.env.EBAY_APP_ID;
    const { isBrowseApiConfigured } = require("../ebayBrowse");
    expect(isBrowseApiConfigured()).toBe(false);
  });

  it("returns false when EBAY_CLIENT_SECRET is missing", () => {
    delete process.env.EBAY_CLIENT_SECRET;
    const { isBrowseApiConfigured } = require("../ebayBrowse");
    expect(isBrowseApiConfigured()).toBe(false);
  });

  it("returns true when both env vars are set", () => {
    const { isBrowseApiConfigured } = require("../ebayBrowse");
    expect(isBrowseApiConfigured()).toBe(true);
  });
});

// ─── buildSearchKeywords ───────────────────────────────────────────
describe("buildSearchKeywords", () => {
  const getBuildSearchKeywords = () =>
    require("../ebayBrowse").buildSearchKeywords;

  it("builds basic title + issue query and strips # from issue", () => {
    const fn = getBuildSearchKeywords();
    expect(fn({ title: "Amazing Spider-Man", issueNumber: "#300" })).toBe(
      "Amazing Spider-Man 300"
    );
  });

  it("strips apostrophes and colons from title", () => {
    const fn = getBuildSearchKeywords();
    const result = fn({
      title: "Batman: The Dark Knight's Return",
      issueNumber: "1",
    });
    expect(result).not.toContain("'");
    expect(result).not.toContain(":");
    expect(result).toContain("Batman");
    expect(result).toContain("1");
  });

  it("strips semicolons from title", () => {
    const fn = getBuildSearchKeywords();
    const result = fn({ title: "X-Men; Legacy", issueNumber: "5" });
    expect(result).not.toContain(";");
  });

  it("adds grading company and grade for slabbed comics", () => {
    const fn = getBuildSearchKeywords();
    const result = fn({
      title: "Spawn",
      issueNumber: "1",
      isSlabbed: true,
      gradingCompany: "CBCS",
      grade: "9.6",
    });
    expect(result).toContain("CBCS");
    expect(result).toContain("9.6");
  });

  it("defaults to CGC when slabbed without grading company", () => {
    const fn = getBuildSearchKeywords();
    const result = fn({
      title: "Spawn",
      issueNumber: "1",
      isSlabbed: true,
      grade: "9.4",
    });
    expect(result).toContain("CGC");
    expect(result).toContain("9.4");
  });

  it("formats integer grades with .0", () => {
    const fn = getBuildSearchKeywords();
    const result = fn({
      title: "Spawn",
      issueNumber: "1",
      isSlabbed: true,
      grade: "9",
    });
    expect(result).toContain("9.0");
  });

  it("handles title-only (no issue number)", () => {
    const fn = getBuildSearchKeywords();
    expect(fn({ title: "Saga" })).toBe("Saga");
  });
});

// ─── filterOutliersAndCalculateMedian ──────────────────────────────
describe("filterOutliersAndCalculateMedian", () => {
  const getFn = () =>
    require("../ebayBrowse").filterOutliersAndCalculateMedian;

  it("calculates median for odd number of prices", () => {
    expect(getFn()([10, 20, 30]).medianPrice).toBe(20);
  });

  it("calculates median for even number of prices", () => {
    expect(getFn()([10, 20, 30, 40]).medianPrice).toBe(25);
  });

  it("removes outliers above 3x median", () => {
    const result = getFn()([10, 20, 30, 40, 500]);
    expect(result.filteredPrices).not.toContain(500);
    expect(result.totalResults).toBe(5);
  });

  it("removes outliers below 0.2x median", () => {
    const result = getFn()([1, 50, 60, 70, 80]);
    expect(result.filteredPrices).not.toContain(1);
  });

  it("returns null median when fewer than 3 prices", () => {
    expect(getFn()([10, 20]).medianPrice).toBeNull();
  });

  it("returns null for empty array", () => {
    const result = getFn()([]);
    expect(result.medianPrice).toBeNull();
    expect(result.filteredPrices).toEqual([]);
    expect(result.totalResults).toBe(0);
  });

  it("handles single-price array", () => {
    expect(getFn()([50]).medianPrice).toBeNull();
  });

  it("returns null when filtering leaves fewer than 3", () => {
    // median of [1, 2, 1000] = 2, 1000 > 3*2=6 → removed
    // after filter: [1, 2] → fewer than 3
    expect(getFn()([1, 2, 1000]).medianPrice).toBeNull();
  });
});

// ─── generateGradeEstimates ────────────────────────────────────────
describe("generateGradeEstimates", () => {
  const getFn = () => require("../ebayBrowse").generateGradeEstimates;

  it("generates 6 grade levels", () => {
    expect(getFn()(100)).toHaveLength(6);
  });

  it("9.4 NM is 1.0x multiplier (rawValue = basePrice)", () => {
    const estimates = getFn()(100);
    const nm = estimates.find((e: { grade: number }) => e.grade === 9.4);
    expect(nm.rawValue).toBe(100);
  });

  it("slab premium ~30% for 9.4", () => {
    const estimates = getFn()(100);
    const nm = estimates.find((e: { grade: number }) => e.grade === 9.4);
    expect(nm.slabbedValue).toBe(130);
  });

  it("9.8 is highest multiplier (2.5x raw)", () => {
    const estimates = getFn()(100);
    const nmm = estimates.find((e: { grade: number }) => e.grade === 9.8);
    expect(nmm.rawValue).toBe(250);
    expect(nmm.slabbedValue).toBe(300);
  });

  it("2.0 is lowest multiplier (0.1x raw)", () => {
    const estimates = getFn()(100);
    const good = estimates.find((e: { grade: number }) => e.grade === 2.0);
    expect(good.rawValue).toBe(10);
    expect(good.slabbedValue).toBe(15);
  });
});

// ─── convertBrowseToPriceData ──────────────────────────────────────
describe("convertBrowseToPriceData", () => {
  const getFn = () => require("../ebayBrowse").convertBrowseToPriceData;

  const baseBrowseResult = {
    listings: [],
    medianPrice: 50,
    highPrice: 80,
    lowPrice: 20,
    totalResults: 10,
    searchQuery: "test",
  };

  it("returns PriceData with median as estimatedValue", () => {
    const result = getFn()(baseBrowseResult);
    expect(result).not.toBeNull();
    expect(result.estimatedValue).toBe(50);
    expect(result.priceSource).toBe("ebay");
    expect(result.isAveraged).toBe(true);
    expect(result.disclaimer).toBe("Based on current eBay listings");
  });

  it("returns empty recentSales", () => {
    const result = getFn()(baseBrowseResult);
    expect(result.recentSales).toEqual([]);
    expect(result.mostRecentSaleDate).toBeNull();
  });

  it("returns null when medianPrice is null", () => {
    const result = getFn()({ ...baseBrowseResult, medianPrice: null });
    expect(result).toBeNull();
  });

  it("selects correct grade estimate for requested grade", () => {
    const result = getFn()(baseBrowseResult, "8.0");
    expect(result).not.toBeNull();
    // 8.0 VF raw = 0.55 * 50 = 27.5
    const vfEstimate = result.gradeEstimates.find(
      (e: { grade: number }) => e.grade === 8.0
    );
    expect(result.estimatedValue).toBe(vfEstimate.rawValue);
  });

  it("selects slabbed value when isSlabbed is true", () => {
    const result = getFn()(baseBrowseResult, "9.4", true);
    expect(result).not.toBeNull();
    // 9.4 slabbed = 1.3 * 50 = 65
    const nmEstimate = result.gradeEstimates.find(
      (e: { grade: number }) => e.grade === 9.4
    );
    expect(result.estimatedValue).toBe(nmEstimate.slabbedValue);
  });
});

// ─── parseBrowseResponse ───────────────────────────────────────────
describe("parseBrowseResponse", () => {
  const getFn = () => require("../ebayBrowse").parseBrowseResponse;

  it("extracts items from Browse API response format", () => {
    const data = {
      itemSummaries: [
        {
          itemId: "v1|123",
          title: "Amazing Spider-Man #300 CGC 9.8",
          price: { value: "199.99", currency: "USD" },
          condition: "New",
          itemWebUrl: "https://ebay.com/itm/123",
          image: { imageUrl: "https://i.ebayimg.com/images/123.jpg" },
        },
      ],
    };
    const items = getFn()(data);
    expect(items).toHaveLength(1);
    expect(items[0].itemId).toBe("v1|123");
    expect(items[0].price).toBe(199.99);
    expect(items[0].currency).toBe("USD");
    expect(items[0].condition).toBe("New");
    expect(items[0].itemUrl).toBe("https://ebay.com/itm/123");
    expect(items[0].imageUrl).toBe("https://i.ebayimg.com/images/123.jpg");
  });

  it("returns empty array for no results", () => {
    expect(getFn()({})).toEqual([]);
  });

  it("handles missing optional fields (imageUrl)", () => {
    const data = {
      itemSummaries: [
        {
          itemId: "v1|456",
          title: "Batman #1",
          price: { value: "50.00", currency: "USD" },
          condition: "Used",
          itemWebUrl: "https://ebay.com/itm/456",
        },
      ],
    };
    const items = getFn()(data);
    expect(items).toHaveLength(1);
    expect(items[0].imageUrl).toBeUndefined();
  });
});

// ─── buildEbaySearchUrl ────────────────────────────────────────────
describe("buildEbaySearchUrl", () => {
  const getFn = () => require("../ebayBrowse").buildEbaySearchUrl;

  it("builds basic search URL with sold filters", () => {
    const url = getFn()("Amazing Spider-Man", "300");
    expect(url).toContain("LH_Complete=1");
    expect(url).toContain("LH_Sold=1");
    expect(url).toContain("_sacat=259104");
    expect(url).toContain("Amazing+Spider-Man");
    expect(url).toContain("%23300"); // #300 URL-encoded
  });

  it("includes CGC and grade for slabbed", () => {
    const url = getFn()("Spawn", "1", "9.8", true);
    expect(url).toContain("CGC");
    expect(url).toContain("9.8");
  });
});
