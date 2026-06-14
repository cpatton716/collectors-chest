/**
 * Tests for the pure collection-insight helpers exported from the homepage
 * (`src/app/page.tsx`). The homepage is a client component, so we stub its
 * browser-only / framework dependencies before importing it — the helpers under
 * test depend only on grade-aware pricing, not on React or Next internals.
 */

// Stub framework + browser-only modules pulled in by page.tsx's top-level imports.
jest.mock("next/navigation", () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock("next/link", () => ({ __esModule: true, default: () => null }));
jest.mock("next/image", () => ({ __esModule: true, default: () => null }));
jest.mock("@/hooks/useGuestScans", () => ({ useGuestScans: () => ({ count: 0 }) }));
jest.mock("@/lib/storage", () => ({
  storage: {
    getCollection: () => [],
    getRecentlyViewedItems: () => [],
    getSalesStats: () => ({ totalSales: 0, totalRevenue: 0, totalProfit: 0 }),
  },
}));

import { computeHomeStats, getBestBuy } from "../page";

import type { CollectionItem } from "@/types/comic";

// Minimal CollectionItem factory — only fields the helpers read.
function makeItem(overrides: {
  id: string;
  estimatedValue?: number | null;
  purchasePrice?: number | null;
}): CollectionItem {
  const { id, estimatedValue = null, purchasePrice = null } = overrides;
  return {
    id,
    comic: {
      id,
      title: `Book ${id}`,
      issueNumber: "1",
      variant: null,
      publisher: null,
      releaseYear: null,
      writer: null,
      coverArtist: null,
      interiorArtist: null,
      confidence: "high",
      isSlabbed: false,
      gradingCompany: null,
      grade: null,
      isSignatureSeries: false,
      signedBy: null,
      keyInfo: [],
      certificationNumber: null,
      labelType: null,
      pageQuality: null,
      gradeDate: null,
      graderNotes: null,
      priceData:
        estimatedValue != null
          ? {
              estimatedValue,
              recentSales: [],
              mostRecentSaleDate: null,
              isAveraged: true,
              disclaimer: null,
            }
          : null,
    },
    coverImageUrl: "",
    conditionGrade: null,
    conditionLabel: null,
    isGraded: false,
    gradingCompany: null,
    purchasePrice,
    purchaseDate: null,
    notes: null,
    forSale: false,
    forTrade: false,
    askingPrice: null,
    averagePrice: estimatedValue,
    dateAdded: new Date().toISOString(),
    listIds: [],
    isStarred: false,
    customKeyInfo: [],
    customKeyInfoStatus: null,
  } as CollectionItem;
}

describe("computeHomeStats", () => {
  it("returns zeros for an empty collection", () => {
    const stats = computeHomeStats([]);
    expect(stats.totalComics).toBe(0);
    expect(stats.totalValue).toBe(0);
    expect(stats.totalCost).toBe(0);
    expect(stats.profitLoss).toBe(0);
    expect(stats.profitLossPercent).toBe(0);
  });

  it("sums cost basis and counts comics", () => {
    const collection = [
      makeItem({ id: "a", estimatedValue: 100, purchasePrice: 40 }),
      makeItem({ id: "b", estimatedValue: 50, purchasePrice: 10 }),
    ];
    const stats = computeHomeStats(collection);
    expect(stats.totalComics).toBe(2);
    expect(stats.totalCost).toBe(50);
  });

  it("keeps profitLossPercent at 0 when cost basis is 0 (no divide-by-zero)", () => {
    const stats = computeHomeStats([makeItem({ id: "a", estimatedValue: 100 })]);
    expect(stats.profitLossPercent).toBe(0);
  });
});

describe("getBestBuy", () => {
  it("returns null without any purchase-priced books", () => {
    expect(getBestBuy([makeItem({ id: "a", estimatedValue: 100 })])).toBeNull();
  });

  it("picks the highest ROI book", () => {
    const collection = [
      makeItem({ id: "low", estimatedValue: 100, purchasePrice: 90 }), // ~11% ROI
      makeItem({ id: "high", estimatedValue: 100, purchasePrice: 10 }), // 900% ROI
    ];
    const result = getBestBuy(collection);
    expect(result?.item.id).toBe("high");
    expect(result?.roi).toBeGreaterThan(0);
  });
});
