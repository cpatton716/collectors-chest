/**
 * Stats Calculator Tests
 *
 * Tests collection statistics calculations including overview stats,
 * publisher breakdowns, decade analysis, grading stats, and financials.
 */
import { CollectionItem, ComicDetails, PriceData } from "@/types/comic";

import {
  calculateDecadeStats,
  calculateFinancialStats,
  calculateGradingStats,
  calculateKeyComicStats,
  calculateOverviewStats,
  calculatePublisherStats,
  formatCurrency,
  formatPercentage,
  getTopPublishers,
} from "../statsCalculator";

// Test fixture factories
const createPriceData = (overrides?: Partial<PriceData>): PriceData => ({
  estimatedValue: 100,
  gradeEstimates: [],
  recentSales: [],
  mostRecentSaleDate: null,
  isAveraged: false,
  disclaimer: null,
  priceSource: "ebay",
  ...overrides,
});

const createComicDetails = (overrides?: Partial<ComicDetails>): ComicDetails => ({
  id: "comic-1",
  title: "Test Comic",
  issueNumber: "1",
  variant: null,
  publisher: "Marvel",
  coverArtist: null,
  writer: null,
  interiorArtist: null,
  releaseYear: "1990",
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createItem = (overrides: Record<string, any> = {}): CollectionItem => {
  const comicOverrides = overrides.comic || {};
  const priceDataOverrides = comicOverrides.priceData;

  const comic = createComicDetails({
    ...comicOverrides,
    priceData: priceDataOverrides === null ? null : createPriceData(priceDataOverrides || {}),
  });

  const { comic: _comic, ...restOverrides } = overrides;

  return {
    id: `test-${Math.random()}`,
    comic,
    coverImageUrl: "",
    conditionGrade: null,
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
    ...restOverrides,
  };
};

describe("calculateOverviewStats", () => {
  it("calculates basic stats for collection", () => {
    const collection = [
      createItem({ comic: { priceData: { estimatedValue: 100 } } }),
      createItem({ comic: { priceData: { estimatedValue: 200 } } }),
      createItem({ comic: { priceData: { estimatedValue: 300 } } }),
    ];

    const stats = calculateOverviewStats(collection);
    expect(stats.totalCount).toBe(3);
    expect(stats.totalValue).toBe(600);
    expect(stats.averageValue).toBe(200);
    expect(stats.pricedCount).toBe(3);
    expect(stats.unpricedCount).toBe(0);
  });

  it("identifies highest and lowest value comics", () => {
    const highItem = createItem({ id: "high", comic: { priceData: { estimatedValue: 500 } } });
    const lowItem = createItem({ id: "low", comic: { priceData: { estimatedValue: 50 } } });
    const collection = [
      createItem({ comic: { priceData: { estimatedValue: 100 } } }),
      highItem,
      lowItem,
    ];

    const stats = calculateOverviewStats(collection);
    expect(stats.highestValueComic?.id).toBe("high");
    expect(stats.lowestValueComic?.id).toBe("low");
  });

  it("handles empty collection", () => {
    const stats = calculateOverviewStats([]);
    expect(stats.totalCount).toBe(0);
    expect(stats.totalValue).toBe(0);
    expect(stats.averageValue).toBe(0);
    expect(stats.highestValueComic).toBeNull();
    expect(stats.lowestValueComic).toBeNull();
  });

  it("tracks unpriced items", () => {
    const collection = [
      createItem({ comic: { priceData: { estimatedValue: 100 } } }),
      createItem({ comic: { priceData: null } }),
      createItem({ comic: { priceData: { estimatedValue: 0 } } }),
    ];

    const stats = calculateOverviewStats(collection);
    expect(stats.pricedCount).toBe(1);
    expect(stats.unpricedCount).toBe(2);
  });
});

describe("calculatePublisherStats", () => {
  it("groups comics by publisher", () => {
    const collection = [
      createItem({ comic: { publisher: "Marvel", priceData: { estimatedValue: 100 } } }),
      createItem({ comic: { publisher: "Marvel", priceData: { estimatedValue: 200 } } }),
      createItem({ comic: { publisher: "DC", priceData: { estimatedValue: 150 } } }),
    ];

    const stats = calculatePublisherStats(collection);
    const marvel = stats.find((s) => s.publisher === "Marvel");
    const dc = stats.find((s) => s.publisher === "DC");

    expect(marvel?.count).toBe(2);
    expect(marvel?.value).toBe(300);
    expect(dc?.count).toBe(1);
    expect(dc?.value).toBe(150);
  });

  it("calculates percentage of total value", () => {
    const collection = [
      createItem({ comic: { publisher: "Marvel", priceData: { estimatedValue: 300 } } }),
      createItem({ comic: { publisher: "DC", priceData: { estimatedValue: 100 } } }),
    ];

    const stats = calculatePublisherStats(collection);
    const marvel = stats.find((s) => s.publisher === "Marvel");
    const dc = stats.find((s) => s.publisher === "DC");

    expect(marvel?.percentage).toBe(75);
    expect(dc?.percentage).toBe(25);
  });

  it("sorts by value descending", () => {
    const collection = [
      createItem({ comic: { publisher: "DC", priceData: { estimatedValue: 100 } } }),
      createItem({ comic: { publisher: "Marvel", priceData: { estimatedValue: 300 } } }),
      createItem({ comic: { publisher: "Image", priceData: { estimatedValue: 200 } } }),
    ];

    const stats = calculatePublisherStats(collection);
    expect(stats[0].publisher).toBe("Marvel");
    expect(stats[1].publisher).toBe("Image");
    expect(stats[2].publisher).toBe("DC");
  });

  it("handles unknown publisher", () => {
    const collection = [
      createItem({ comic: { publisher: undefined, priceData: { estimatedValue: 100 } } }),
    ];

    const stats = calculatePublisherStats(collection);
    expect(stats[0].publisher).toBe("Unknown");
  });
});

describe("getTopPublishers", () => {
  it("returns top N publishers", () => {
    const collection = [
      createItem({ comic: { publisher: "A", priceData: { estimatedValue: 100 } } }),
      createItem({ comic: { publisher: "B", priceData: { estimatedValue: 200 } } }),
      createItem({ comic: { publisher: "C", priceData: { estimatedValue: 300 } } }),
      createItem({ comic: { publisher: "D", priceData: { estimatedValue: 400 } } }),
      createItem({ comic: { publisher: "E", priceData: { estimatedValue: 500 } } }),
      createItem({ comic: { publisher: "F", priceData: { estimatedValue: 600 } } }),
    ];

    const top3 = getTopPublishers(collection, 3);
    expect(top3.length).toBe(3);
    expect(top3[0].publisher).toBe("F");
    expect(top3[1].publisher).toBe("E");
    expect(top3[2].publisher).toBe("D");
  });
});

describe("calculateDecadeStats", () => {
  it("groups comics by decade", () => {
    const collection = [
      createItem({ comic: { releaseYear: "1962" } }),
      createItem({ comic: { releaseYear: "1968" } }),
      createItem({ comic: { releaseYear: "1975" } }),
    ];

    const stats = calculateDecadeStats(collection);
    const sixties = stats.find((s) => s.decade === "1960s");
    const seventies = stats.find((s) => s.decade === "1970s");

    expect(sixties?.count).toBe(2);
    expect(seventies?.count).toBe(1);
  });

  it("handles unknown year", () => {
    const collection = [
      createItem({ comic: { releaseYear: undefined } }),
      createItem({ comic: { releaseYear: "" } }),
    ];

    const stats = calculateDecadeStats(collection);
    const unknown = stats.find((s) => s.decade === "Unknown");
    expect(unknown?.count).toBe(2);
  });

  it("sorts by decade chronologically", () => {
    const collection = [
      createItem({ comic: { releaseYear: "2020" } }),
      createItem({ comic: { releaseYear: "1980" } }),
      createItem({ comic: { releaseYear: "1960" } }),
    ];

    const stats = calculateDecadeStats(collection);
    expect(stats[0].decade).toBe("1960s");
    expect(stats[1].decade).toBe("1980s");
    expect(stats[2].decade).toBe("2020s");
  });
});

describe("calculateGradingStats", () => {
  it("counts raw vs slabbed", () => {
    const collection = [
      createItem({ isGraded: false }),
      createItem({ isGraded: false }),
      createItem({ isGraded: true, gradingCompany: "CGC" }),
    ];

    const stats = calculateGradingStats(collection);
    expect(stats.rawCount).toBe(2);
    expect(stats.slabbedCount).toBe(1);
  });

  it("counts grading companies", () => {
    const collection = [
      createItem({ isGraded: true, gradingCompany: "CGC" }),
      createItem({ isGraded: true, gradingCompany: "CGC" }),
      createItem({ isGraded: true, gradingCompany: "CBCS" }),
      createItem({ isGraded: true, gradingCompany: "PGX" }),
    ];

    const stats = calculateGradingStats(collection);
    expect(stats.cgcCount).toBe(2);
    expect(stats.cbcsCount).toBe(1);
    expect(stats.pgxCount).toBe(1);
  });

  it("handles case-insensitive company names", () => {
    const collection = [
      createItem({ isGraded: true, gradingCompany: "cgc" }),
      createItem({ isGraded: true, gradingCompany: "Cgc" }),
    ];

    const stats = calculateGradingStats(collection);
    expect(stats.cgcCount).toBe(2);
  });
});

describe("calculateFinancialStats", () => {
  it("calculates ROI correctly", () => {
    const collection = [
      createItem({ purchasePrice: 50, comic: { priceData: { estimatedValue: 100 } } }),
      createItem({ purchasePrice: 100, comic: { priceData: { estimatedValue: 150 } } }),
    ];

    const stats = calculateFinancialStats(collection);
    expect(stats.totalPurchaseCost).toBe(150);
    expect(stats.totalEstimatedValue).toBe(250);
    expect(stats.unrealizedGainLoss).toBe(100);
    expect(stats.roiPercentage).toBeCloseTo(66.67, 1);
  });

  it("handles negative ROI", () => {
    const collection = [
      createItem({ purchasePrice: 200, comic: { priceData: { estimatedValue: 100 } } }),
    ];

    const stats = calculateFinancialStats(collection);
    expect(stats.unrealizedGainLoss).toBe(-100);
    expect(stats.roiPercentage).toBe(-50);
  });

  it("handles zero purchase cost", () => {
    const collection = [
      createItem({ purchasePrice: null, comic: { priceData: { estimatedValue: 100 } } }),
    ];

    const stats = calculateFinancialStats(collection);
    expect(stats.roiPercentage).toBe(0);
  });
});

describe("calculateKeyComicStats", () => {
  it("identifies key comics", () => {
    const collection = [
      createItem({ comic: { keyInfo: ["First appearance of Venom"] } }),
      createItem({ comic: { keyInfo: [] } }),
      createItem({ comic: { keyInfo: ["Origin story"] } }),
    ];

    const stats = calculateKeyComicStats(collection);
    expect(stats.keyCount).toBe(2);
  });

  it("sorts top keys by value", () => {
    const collection = [
      createItem({ id: "low", comic: { keyInfo: ["Key 1"], priceData: { estimatedValue: 100 } } }),
      createItem({ id: "high", comic: { keyInfo: ["Key 2"], priceData: { estimatedValue: 500 } } }),
      createItem({ id: "mid", comic: { keyInfo: ["Key 3"], priceData: { estimatedValue: 250 } } }),
    ];

    const stats = calculateKeyComicStats(collection, 2);
    expect(stats.topKeyComics.length).toBe(2);
    expect(stats.topKeyComics[0].id).toBe("high");
    expect(stats.topKeyComics[1].id).toBe("mid");
  });
});

describe("formatCurrency", () => {
  it("formats whole dollars without cents", () => {
    expect(formatCurrency(100)).toBe("100");
    expect(formatCurrency(1000)).toBe("1,000");
  });

  it("formats with cents when needed", () => {
    expect(formatCurrency(100.5)).toBe("100.50");
    expect(formatCurrency(1000.99)).toBe("1,000.99");
  });

  it("adds thousand separators", () => {
    expect(formatCurrency(1000000)).toBe("1,000,000");
  });

  it("handles zero", () => {
    expect(formatCurrency(0)).toBe("0");
  });
});

describe("formatPercentage", () => {
  it("formats to one decimal place", () => {
    expect(formatPercentage(50)).toBe("50.0");
    expect(formatPercentage(33.333)).toBe("33.3");
    expect(formatPercentage(100)).toBe("100.0");
  });

  it("handles zero", () => {
    expect(formatPercentage(0)).toBe("0.0");
  });

  it("handles negative values", () => {
    expect(formatPercentage(-25.5)).toBe("-25.5");
  });
});
