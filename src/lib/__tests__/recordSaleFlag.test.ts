import { describe, it, expect } from "@jest/globals";

// Mock @/lib/db so importing useCollection.ts never pulls in the
// db.ts -> cache.ts -> redis.ts -> @upstash/redis ESM chain. The pure helpers
// under test (buildSaleInsertFields / saleRevenueValue) do not call these.
jest.mock("@/lib/db", () => ({
  addComic: jest.fn(),
  addComicToList: jest.fn(),
  createList: jest.fn(),
  deleteComic: jest.fn(),
  deleteList: jest.fn(),
  getOrCreateProfile: jest.fn(),
  getUserComics: jest.fn(),
  getUserLists: jest.fn(),
  getUserSales: jest.fn(),
  recordSale: jest.fn(),
  removeComicFromList: jest.fn(),
  updateComic: jest.fn(),
}));

// Mock the supabase client (imported by useCollection.ts for the skipped-sale
// enriched insert) so no real client is constructed during these unit tests.
jest.mock("@/lib/supabase", () => ({
  supabase: { from: jest.fn() },
}));

import {
  buildSaleInsertFields,
  isSalePriceMissing,
  saleRevenueValue,
  type SaleRecordWithFlag,
} from "../../hooks/useCollection";

import { CollectionItem, ComicDetails, SaleRecord } from "@/types/comic";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COMIC: ComicDetails = {
  id: "comic-1",
  title: "Amazing Spider-Man",
  issueNumber: "300",
  variant: "Cover A",
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
  priceData: null,
  keyInfo: [],
};

function makeItem(overrides: Partial<CollectionItem> = {}): CollectionItem {
  return {
    id: "item-1",
    comic: COMIC,
    coverImageUrl: "https://test.supabase.co/storage/v1/object/public/comic-covers/asm300.jpg",
    conditionGrade: null,
    conditionLabel: null,
    isGraded: false,
    gradingCompany: null,
    purchasePrice: 100,
    purchaseDate: null,
    notes: null,
    forSale: false,
    forTrade: false,
    askingPrice: null,
    averagePrice: null,
    dateAdded: "2026-01-01T00:00:00.000Z",
    listIds: [],
    isStarred: false,
    customKeyInfo: [],
    customKeyInfoStatus: null,
    ...overrides,
  };
}

function makeSale(overrides: Partial<SaleRecordWithFlag> = {}): SaleRecordWithFlag {
  const base: SaleRecord = {
    id: "sale-1",
    comic: COMIC,
    coverImageUrl: "",
    purchasePrice: 100,
    salePrice: 250,
    saleDate: "2026-06-14T00:00:00.000Z",
    profit: 150,
    buyerId: null,
  };
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// buildSaleInsertFields — price-provided branch (priceRecorded = true)
// ---------------------------------------------------------------------------

describe("buildSaleInsertFields — price recorded", () => {
  it("flags sale_price_recorded = true", () => {
    const fields = buildSaleInsertFields("profile-1", makeItem(), 250, true);
    expect(fields.sale_price_recorded).toBe(true);
  });

  it("stores the real sale price", () => {
    const fields = buildSaleInsertFields("profile-1", makeItem(), 250, true);
    expect(fields.sale_price).toBe(250);
  });

  it("computes profit as sale price minus purchase price", () => {
    const fields = buildSaleInsertFields("profile-1", makeItem({ purchasePrice: 100 }), 250, true);
    expect(fields.profit).toBe(150);
  });

  it("treats a missing purchase price as zero cost", () => {
    const fields = buildSaleInsertFields("profile-1", makeItem({ purchasePrice: null }), 250, true);
    expect(fields.purchase_price).toBeNull();
    expect(fields.profit).toBe(250);
  });

  it("handles a recorded sale price of zero (free giveaway)", () => {
    const fields = buildSaleInsertFields("profile-1", makeItem({ purchasePrice: 0 }), 0, true);
    expect(fields.sale_price).toBe(0);
    expect(fields.sale_price_recorded).toBe(true);
    expect(fields.profit).toBe(0);
  });

  it("carries identity + buyer fields onto the payload", () => {
    const fields = buildSaleInsertFields("profile-1", makeItem(), 250, true, "buyer-9");
    expect(fields.user_id).toBe("profile-1");
    expect(fields.comic_title).toBe("Amazing Spider-Man");
    expect(fields.comic_issue_number).toBe("300");
    expect(fields.comic_variant).toBe("Cover A");
    expect(fields.comic_publisher).toBe("Marvel");
    expect(fields.buyer_id).toBe("buyer-9");
  });
});

// ---------------------------------------------------------------------------
// buildSaleInsertFields — skipped branch (priceRecorded = false)
// ---------------------------------------------------------------------------

describe("buildSaleInsertFields — price skipped (auditable)", () => {
  it("flags sale_price_recorded = false", () => {
    const fields = buildSaleInsertFields("profile-1", makeItem(), 250, false);
    expect(fields.sale_price_recorded).toBe(false);
  });

  it("records a null sale price (no value, not zero-as-data)", () => {
    const fields = buildSaleInsertFields("profile-1", makeItem(), 250, false);
    expect(fields.sale_price).toBeNull();
  });

  it("never contributes profit for a skipped sale", () => {
    const fields = buildSaleInsertFields("profile-1", makeItem({ purchasePrice: 100 }), 250, false);
    expect(fields.profit).toBe(0);
  });

  it("ignores any incoming price when skipped", () => {
    // Even if a price is passed, skipping must not persist it.
    const fields = buildSaleInsertFields("profile-1", makeItem(), 9999, false);
    expect(fields.sale_price).toBeNull();
    expect(fields.profit).toBe(0);
  });

  it("still records identity so the sale is auditable", () => {
    const fields = buildSaleInsertFields("profile-1", makeItem(), 0, false, "buyer-3");
    expect(fields.user_id).toBe("profile-1");
    expect(fields.comic_title).toBe("Amazing Spider-Man");
    expect(fields.buyer_id).toBe("buyer-3");
  });
});

// ---------------------------------------------------------------------------
// Revenue helpers treat skipped (flag=false) rows as "no value"
// ---------------------------------------------------------------------------

describe("saleRevenueValue", () => {
  it("counts a recorded sale at its stored price", () => {
    expect(saleRevenueValue(makeSale({ salePrice: 250, priceRecorded: true }))).toBe(250);
  });

  it("counts a skipped sale as zero (no value)", () => {
    expect(saleRevenueValue(makeSale({ salePrice: 250, priceRecorded: false }))).toBe(0);
  });

  it("falls back to stored price for legacy rows with the flag absent", () => {
    // Pre-migration / legacy rows have no priceRecorded flag.
    const legacy = makeSale({ salePrice: 175 });
    delete legacy.priceRecorded;
    expect(saleRevenueValue(legacy)).toBe(175);
  });

  it("sums only recorded sales when totalling revenue", () => {
    const sales: SaleRecordWithFlag[] = [
      makeSale({ id: "a", salePrice: 100, priceRecorded: true }),
      makeSale({ id: "b", salePrice: 999, priceRecorded: false }),
      makeSale({ id: "c", salePrice: 50, priceRecorded: true }),
    ];
    const total = sales.reduce((sum, s) => sum + saleRevenueValue(s), 0);
    expect(total).toBe(150);
  });
});

describe("isSalePriceMissing", () => {
  it("is true only when the flag is explicitly false", () => {
    expect(isSalePriceMissing(makeSale({ priceRecorded: false }))).toBe(true);
    expect(isSalePriceMissing(makeSale({ priceRecorded: true }))).toBe(false);
    expect(isSalePriceMissing(makeSale())).toBe(false);
  });
});
