/**
 * Grade Price Calculation Tests
 *
 * Tests the critical pricing logic used for comic valuations.
 * These functions determine collection values displayed to users.
 */
import { CollectionItem, ComicDetails, GradeEstimate, PriceData } from "@/types/comic";

import {
  calculateCollectionValue,
  calculateValueAtGrade,
  formatGradeEstimate,
  getComicValue,
  getGradeLabel,
  getPriceComparison,
} from "../gradePrice";

// Test fixtures
const createGradeEstimates = (): GradeEstimate[] => [
  { grade: 9.8, label: "Near Mint/Mint", rawValue: 500, slabbedValue: 800 },
  { grade: 9.4, label: "Near Mint", rawValue: 300, slabbedValue: 500 },
  { grade: 9.0, label: "Very Fine/Near Mint", rawValue: 200, slabbedValue: 350 },
  { grade: 8.0, label: "Very Fine", rawValue: 100, slabbedValue: 180 },
  { grade: 6.0, label: "Fine", rawValue: 50, slabbedValue: 90 },
  { grade: 2.0, label: "Good", rawValue: 20, slabbedValue: 40 },
];

const createPriceData = (overrides?: Partial<PriceData>): PriceData => ({
  estimatedValue: 300,
  gradeEstimates: createGradeEstimates(),
  recentSales: [],
  mostRecentSaleDate: null,
  isAveraged: false,
  disclaimer: null,
  priceSource: "ebay",
  ...overrides,
});

const createComicDetails = (overrides?: Partial<ComicDetails>): ComicDetails => ({
  id: "comic-1",
  title: "Amazing Spider-Man",
  issueNumber: "300",
  variant: null,
  publisher: "Marvel",
  coverArtist: null,
  writer: null,
  interiorArtist: null,
  releaseYear: "1988",
  confidence: "high",
  isSlabbed: false,
  gradingCompany: null,
  grade: null,
  certificationNumber: null,
  labelType: null,
  pageQuality: null,
  gradeDate: null,
  graderNotes: null,
  isSignatureSeries: false,
  signedBy: null,
  priceData: createPriceData(),
  keyInfo: [],
  ...overrides,
});

const createCollectionItem = (overrides?: Partial<CollectionItem>): CollectionItem => {
  const comicOverrides = overrides?.comic as Partial<ComicDetails> | undefined;
  const baseItem: CollectionItem = {
    id: "test-1",
    comic: createComicDetails(comicOverrides),
    coverImageUrl: "",
    conditionGrade: 9.4,
    conditionLabel: null,
    isGraded: false,
    gradingCompany: null,
    purchasePrice: null,
    purchaseDate: null,
    notes: null,
    forSale: false,
    forTrade: false,
    askingPrice: null,
    averagePrice: null,
    dateAdded: new Date().toISOString(),
    listIds: [],
    isStarred: false,
    customKeyInfo: [],
    customKeyInfoStatus: null,
  };
  // Apply overrides except comic (which we handled separately)
  const { comic: _comic, ...restOverrides } = overrides || {};
  return { ...baseItem, ...restOverrides };
};

describe("calculateValueAtGrade", () => {
  describe("exact grade matches", () => {
    it("returns exact value for 9.8 raw", () => {
      const priceData = createPriceData();
      expect(calculateValueAtGrade(priceData, 9.8, false)).toBe(500);
    });

    it("returns exact value for 9.8 slabbed", () => {
      const priceData = createPriceData();
      expect(calculateValueAtGrade(priceData, 9.8, true)).toBe(800);
    });

    it("returns exact value for 9.4 raw", () => {
      const priceData = createPriceData();
      expect(calculateValueAtGrade(priceData, 9.4, false)).toBe(300);
    });

    it("returns exact value for 2.0 (lowest grade)", () => {
      const priceData = createPriceData();
      expect(calculateValueAtGrade(priceData, 2.0, false)).toBe(20);
    });
  });

  describe("grade interpolation", () => {
    it("interpolates between 9.4 and 9.8", () => {
      const priceData = createPriceData();
      const value = calculateValueAtGrade(priceData, 9.6, false);
      // 9.6 is halfway between 9.4 (300) and 9.8 (500), should be ~400
      expect(value).toBeGreaterThan(300);
      expect(value).toBeLessThan(500);
      expect(value).toBe(400); // Exact midpoint
    });

    it("interpolates between 8.0 and 9.0", () => {
      const priceData = createPriceData();
      const value = calculateValueAtGrade(priceData, 8.5, false);
      // 8.5 is halfway between 8.0 (100) and 9.0 (200), should be 150
      expect(value).toBe(150);
    });

    it("interpolates slabbed values correctly", () => {
      const priceData = createPriceData();
      const value = calculateValueAtGrade(priceData, 9.6, true);
      // Slabbed 9.4=500, 9.8=800, midpoint=650
      expect(value).toBe(650);
    });
  });

  describe("edge cases", () => {
    it("returns highest value for grade above max", () => {
      const priceData = createPriceData();
      expect(calculateValueAtGrade(priceData, 10.0, false)).toBe(500); // 9.8 value
    });

    it("returns lowest value for grade below min", () => {
      const priceData = createPriceData();
      expect(calculateValueAtGrade(priceData, 1.0, false)).toBe(20); // 2.0 value
    });

    it("returns estimatedValue when no grade estimates", () => {
      const priceData = createPriceData({ gradeEstimates: [] });
      expect(calculateValueAtGrade(priceData, 9.4, false)).toBe(300);
    });

    it("returns null for null priceData", () => {
      expect(calculateValueAtGrade(null, 9.4, false)).toBeNull();
    });

    it("returns estimatedValue when gradeEstimates undefined", () => {
      const priceData = createPriceData({ gradeEstimates: undefined });
      expect(calculateValueAtGrade(priceData, 9.4, false)).toBe(300);
    });
  });
});

describe("getGradeLabel", () => {
  it("returns Near Mint/Mint for 9.8+", () => {
    expect(getGradeLabel(9.8)).toBe("Near Mint/Mint");
    expect(getGradeLabel(10.0)).toBe("Near Mint/Mint");
  });

  it("returns Near Mint for 9.4-9.7", () => {
    expect(getGradeLabel(9.4)).toBe("Near Mint");
    expect(getGradeLabel(9.6)).toBe("Near Mint");
  });

  it("returns Very Fine/Near Mint for 9.0-9.3", () => {
    expect(getGradeLabel(9.0)).toBe("Very Fine/Near Mint");
    expect(getGradeLabel(9.2)).toBe("Very Fine/Near Mint");
  });

  it("returns Very Fine for 8.0-8.9", () => {
    expect(getGradeLabel(8.0)).toBe("Very Fine");
    expect(getGradeLabel(8.5)).toBe("Very Fine");
  });

  it("returns Fine/Very Fine for 7.0-7.9", () => {
    expect(getGradeLabel(7.0)).toBe("Fine/Very Fine");
  });

  it("returns Fine for 6.0-6.9", () => {
    expect(getGradeLabel(6.0)).toBe("Fine");
  });

  it("returns Very Good/Fine for 5.0-5.9", () => {
    expect(getGradeLabel(5.0)).toBe("Very Good/Fine");
  });

  it("returns Very Good for 4.0-4.9", () => {
    expect(getGradeLabel(4.0)).toBe("Very Good");
  });

  it("returns Good/Very Good for 3.0-3.9", () => {
    expect(getGradeLabel(3.0)).toBe("Good/Very Good");
  });

  it("returns Good for 2.0-2.9", () => {
    expect(getGradeLabel(2.0)).toBe("Good");
  });

  it("returns Fair for 1.0-1.9", () => {
    expect(getGradeLabel(1.0)).toBe("Fair");
  });

  it("returns Poor for < 1.0", () => {
    expect(getGradeLabel(0.5)).toBe("Poor");
    expect(getGradeLabel(0)).toBe("Poor");
  });
});

describe("formatGradeEstimate", () => {
  const estimate: GradeEstimate = {
    grade: 9.8,
    label: "Near Mint/Mint",
    rawValue: 500,
    slabbedValue: 800,
  };

  it("formats with default separator", () => {
    const result = formatGradeEstimate(estimate);
    expect(result).toBe("$500 raw / $800 slabbed");
  });

  it("formats with pipe separator when showBoth is true", () => {
    const result = formatGradeEstimate(estimate, true);
    expect(result).toBe("Raw: $500 | Slabbed: $800");
  });

  it("formats large numbers with commas", () => {
    const bigEstimate: GradeEstimate = {
      grade: 9.8,
      label: "Near Mint/Mint",
      rawValue: 10000,
      slabbedValue: 15000,
    };
    const result = formatGradeEstimate(bigEstimate);
    expect(result).toBe("$10,000 raw / $15,000 slabbed");
  });
});

describe("getPriceComparison", () => {
  it("calculates difference between grades", () => {
    const priceData = createPriceData();
    const result = getPriceComparison(priceData, 9.4, 9.8, false);

    expect(result).not.toBeNull();
    expect(result!.difference).toBe(200); // 500 - 300
    expect(result!.percentage).toBeCloseTo(66.7, 1); // 200/300 * 100
  });

  it("returns negative difference for downgrade", () => {
    const priceData = createPriceData();
    const result = getPriceComparison(priceData, 9.8, 9.4, false);

    expect(result).not.toBeNull();
    expect(result!.difference).toBe(-200);
    expect(result!.percentage).toBe(-40); // -200/500 * 100
  });

  it("returns null for null priceData", () => {
    expect(getPriceComparison(null, 9.4, 9.8, false)).toBeNull();
  });

  it("calculates slabbed comparison", () => {
    const priceData = createPriceData();
    const result = getPriceComparison(priceData, 9.4, 9.8, true);

    expect(result).not.toBeNull();
    expect(result!.difference).toBe(300); // 800 - 500
  });
});

describe("getComicValue", () => {
  it("returns grade-specific value when available", () => {
    const item = createCollectionItem({ conditionGrade: 9.4 });
    expect(getComicValue(item)).toBe(300);
  });

  it("returns slabbed value when isGraded is true", () => {
    const item = createCollectionItem({ conditionGrade: 9.4, isGraded: true });
    expect(getComicValue(item)).toBe(500);
  });

  it("returns base estimatedValue when no grade", () => {
    const item = createCollectionItem({ conditionGrade: null });
    expect(getComicValue(item)).toBe(300);
  });

  it("returns 0 when no price data", () => {
    const item = createCollectionItem();
    item.comic.priceData = null;
    expect(getComicValue(item)).toBe(0);
  });
});

describe("calculateCollectionValue", () => {
  it("calculates total value for collection", () => {
    const collection: CollectionItem[] = [
      createCollectionItem({ id: "1", conditionGrade: 9.8 }), // 500
      createCollectionItem({ id: "2", conditionGrade: 9.4 }), // 300
      createCollectionItem({ id: "3", conditionGrade: 8.0 }), // 100
    ];

    const result = calculateCollectionValue(collection);
    expect(result.totalValue).toBe(900);
    expect(result.pricedCount).toBe(3);
    expect(result.unpricedCount).toBe(0);
  });

  it("tracks unpriced items", () => {
    const unpricedItem = createCollectionItem({ id: "2" });
    unpricedItem.comic.priceData = null;

    const collection: CollectionItem[] = [
      createCollectionItem({ id: "1", conditionGrade: 9.8 }), // 500
      unpricedItem,
    ];

    const result = calculateCollectionValue(collection);
    expect(result.totalValue).toBe(500);
    expect(result.pricedCount).toBe(1);
    expect(result.unpricedCount).toBe(1);
  });

  it("handles empty collection", () => {
    const result = calculateCollectionValue([]);
    expect(result.totalValue).toBe(0);
    expect(result.pricedCount).toBe(0);
    expect(result.unpricedCount).toBe(0);
  });
});
