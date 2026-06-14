/**
 * db transform + helper tests (L-CC28, H-PR2)
 *
 * Covers:
 *  - transformCollectionItemToDbComic / transformDbComicToCollectionItem field
 *    mapping and round-trip stability (camelCase <-> snake_case).
 *  - isComicMetadataPriceStale freshness gate that lets getComicMetadata fall
 *    through to a fresh eBay fetch when durable pricing has aged out.
 *
 * Supabase + redis are mocked so importing db.ts never constructs a real
 * client or touches the network - these are pure-function tests.
 */

// Mock @upstash/redis (imported transitively via redis.ts -> cache.ts).
jest.mock("@upstash/redis", () => ({
  Redis: jest.fn().mockImplementation(() => ({ get: jest.fn(), set: jest.fn(), del: jest.fn() })),
}));

// Mock the supabase clients - the transform/staleness functions never call them,
// but importing db.ts evaluates the module which imports supabase.
jest.mock("../supabase", () => ({
  supabase: { from: jest.fn() },
  supabaseAdmin: { from: jest.fn() },
}));

import type { CollectionItem } from "@/types/comic";

import {
  COMIC_COVERS_BUCKET,
  COMIC_METADATA_PRICE_MAX_AGE_MS,
  isComicMetadataPriceStale,
  parseComicCoverStoragePath,
  transformCollectionItemToDbComic,
  transformDbComicToCollectionItem,
} from "../db";

const PROFILE_ID = "profile-123";

function buildItem(overrides: Partial<CollectionItem> = {}): CollectionItem {
  return {
    id: "comic-1",
    comic: {
      id: "comic-1",
      title: "Amazing Spider-Man",
      issueNumber: "300",
      variant: "Direct",
      publisher: "Marvel",
      coverArtist: "Todd McFarlane",
      writer: "David Michelinie",
      interiorArtist: "Todd McFarlane",
      releaseYear: "1988",
      confidence: "high",
      isSlabbed: true,
      gradingCompany: "CGC",
      grade: "9.8",
      certificationNumber: "1234567890",
      labelType: "Universal",
      pageQuality: "White",
      gradeDate: "2024-01-01",
      graderNotes: null,
      isSignatureSeries: false,
      signedBy: null,
      priceData: null,
      keyInfo: ["1st full appearance of Venom"],
    },
    // Use an allowlisted cover host (sanitizer now enforces the host allowlist).
    coverImageUrl: "https://i.ebayimg.com/images/g/asm300/s-l1600.jpg",
    conditionGrade: 9.8,
    conditionLabel: "Near Mint",
    isGraded: true,
    gradingCompany: "CGC",
    purchasePrice: 500,
    purchaseDate: "2024-02-01",
    notes: "Grail book",
    forSale: false,
    forTrade: false,
    askingPrice: null,
    averagePrice: 1200,
    dateAdded: "2024-03-01",
    listIds: ["list-a", "list-b"],
    isStarred: true,
    customKeyInfo: ["Personal note"],
    customKeyInfoStatus: "pending",
    ...overrides,
  };
}

describe("transformCollectionItemToDbComic", () => {
  it("maps camelCase fields to snake_case columns and attaches user_id", () => {
    const row = transformCollectionItemToDbComic(buildItem(), PROFILE_ID);
    expect(row.user_id).toBe(PROFILE_ID);
    expect(row.title).toBe("Amazing Spider-Man");
    expect(row.issue_number).toBe("300");
    expect(row.cover_artist).toBe("Todd McFarlane");
    expect(row.interior_artist).toBe("Todd McFarlane");
    expect(row.release_year).toBe("1988");
    expect(row.is_slabbed).toBe(true);
    expect(row.grading_company).toBe("CGC");
    expect(row.certification_number).toBe("1234567890");
    expect(row.condition_grade).toBe(9.8);
    expect(row.purchase_price).toBe(500);
    expect(row.is_starred).toBe(true);
    expect(row.custom_key_info).toEqual(["Personal note"]);
    expect(row.custom_key_info_status).toBe("pending");
  });

  it("sanitizes the cover image URL at the write boundary (rejects data: URIs)", () => {
    const row = transformCollectionItemToDbComic(
      buildItem({ coverImageUrl: "data:image/png;base64,AAAA" }),
      PROFILE_ID
    );
    expect(row.cover_image_url).toBeNull();
  });

  it("passes through a clean https cover URL unchanged", () => {
    const row = transformCollectionItemToDbComic(buildItem(), PROFILE_ID);
    expect(row.cover_image_url).toBe("https://i.ebayimg.com/images/g/asm300/s-l1600.jpg");
  });

  it("defaults missing customKeyInfo to an empty array", () => {
    const item = buildItem();
    // @ts-expect-error - simulate a legacy item without the field
    delete item.customKeyInfo;
    const row = transformCollectionItemToDbComic(item, PROFILE_ID);
    expect(row.custom_key_info).toEqual([]);
  });
});

describe("transformDbComicToCollectionItem", () => {
  const dbRow = {
    id: "comic-1",
    title: "Batman",
    issue_number: "1",
    variant: null,
    publisher: "DC",
    cover_artist: null,
    writer: null,
    interior_artist: null,
    release_year: "1940",
    confidence: "medium",
    is_slabbed: false,
    grading_company: null,
    grade: null,
    is_signature_series: false,
    signed_by: null,
    price_data: null,
    key_info: ["1st Joker"],
    cover_image_url: "https://cdn.example.com/batman1.jpg",
    condition_grade: 4.0,
    condition_label: "Very Good",
    is_graded: false,
    purchase_price: null,
    purchase_date: null,
    notes: null,
    for_sale: false,
    for_trade: true,
    asking_price: null,
    average_price: null,
    date_added: "2024-01-01",
    is_starred: false,
    custom_key_info: null,
    custom_key_info_status: null,
    comic_lists: [{ list_id: "l1" }, { list_id: "l2" }],
  };

  it("maps snake_case columns back to the CollectionItem shape", () => {
    const item = transformDbComicToCollectionItem(dbRow);
    expect(item.id).toBe("comic-1");
    expect(item.comic.title).toBe("Batman");
    expect(item.comic.issueNumber).toBe("1");
    expect(item.comic.keyInfo).toEqual(["1st Joker"]);
    expect(item.forTrade).toBe(true);
    expect(item.listIds).toEqual(["l1", "l2"]);
  });

  it("defaults confidence to medium when missing", () => {
    const item = transformDbComicToCollectionItem({ ...dbRow, confidence: null });
    expect(item.comic.confidence).toBe("medium");
  });

  it("defaults nullable arrays to empty arrays", () => {
    const item = transformDbComicToCollectionItem({
      ...dbRow,
      key_info: null,
      custom_key_info: null,
      comic_lists: null,
    });
    expect(item.comic.keyInfo).toEqual([]);
    expect(item.customKeyInfo).toEqual([]);
    expect(item.listIds).toEqual([]);
  });

  it("defaults for_trade to false when undefined", () => {
    const row = { ...dbRow };
    delete (row as Record<string, unknown>).for_trade;
    expect(transformDbComicToCollectionItem(row).forTrade).toBe(false);
  });
});

describe("transform round-trip (L-CC28)", () => {
  it("preserves core comic fields through item -> db -> item", () => {
    const original = buildItem();
    const dbRow = transformCollectionItemToDbComic(original, PROFILE_ID);
    // Re-attach the id + comic_lists the way getUserComics' select would.
    const roundTripped = transformDbComicToCollectionItem({
      ...dbRow,
      id: original.id,
      comic_lists: original.listIds.map((list_id) => ({ list_id })),
    });

    expect(roundTripped.id).toBe(original.id);
    expect(roundTripped.comic.title).toBe(original.comic.title);
    expect(roundTripped.comic.issueNumber).toBe(original.comic.issueNumber);
    expect(roundTripped.comic.publisher).toBe(original.comic.publisher);
    expect(roundTripped.comic.isSlabbed).toBe(original.comic.isSlabbed);
    expect(roundTripped.comic.grade).toBe(original.comic.grade);
    expect(roundTripped.comic.keyInfo).toEqual(original.comic.keyInfo);
    expect(roundTripped.coverImageUrl).toBe(original.coverImageUrl);
    expect(roundTripped.conditionGrade).toBe(original.conditionGrade);
    expect(roundTripped.purchasePrice).toBe(original.purchasePrice);
    expect(roundTripped.notes).toBe(original.notes);
    expect(roundTripped.isStarred).toBe(original.isStarred);
    expect(roundTripped.listIds).toEqual(original.listIds);
    expect(roundTripped.customKeyInfo).toEqual(original.customKeyInfo);
    expect(roundTripped.customKeyInfoStatus).toBe(original.customKeyInfoStatus);
  });
});

describe("isComicMetadataPriceStale (H-PR2)", () => {
  const now = Date.UTC(2026, 5, 14, 12, 0, 0); // fixed reference time
  const priceData = {
    estimatedValue: 100,
    mostRecentSaleDate: null,
    recentSales: [],
    gradeEstimates: [],
    disclaimer: "",
  };

  it("returns false when there is no priceData (nothing to age)", () => {
    expect(
      isComicMetadataPriceStale({ priceData: null, updatedAt: new Date(now).toISOString() }, now)
    ).toBe(false);
  });

  it("returns false when updatedAt is missing", () => {
    expect(isComicMetadataPriceStale({ priceData, updatedAt: null }, now)).toBe(false);
  });

  it("returns false for a freshly updated row", () => {
    const updatedAt = new Date(now - 60 * 1000).toISOString(); // 1 minute ago
    expect(isComicMetadataPriceStale({ priceData, updatedAt }, now)).toBe(false);
  });

  it("returns false exactly at the boundary (not strictly older)", () => {
    const updatedAt = new Date(now - COMIC_METADATA_PRICE_MAX_AGE_MS).toISOString();
    expect(isComicMetadataPriceStale({ priceData, updatedAt }, now)).toBe(false);
  });

  it("returns true once the row is older than the max age", () => {
    const updatedAt = new Date(now - COMIC_METADATA_PRICE_MAX_AGE_MS - 1000).toISOString();
    expect(isComicMetadataPriceStale({ priceData, updatedAt }, now)).toBe(true);
  });

  it("returns false for an unparseable updatedAt rather than nuking the cache", () => {
    expect(isComicMetadataPriceStale({ priceData, updatedAt: "not-a-date" }, now)).toBe(false);
  });
});

describe("parseComicCoverStoragePath (M-CO16)", () => {
  const base = "https://abcd1234.supabase.co";
  const ownUrl = `${base}/storage/v1/object/public/${COMIC_COVERS_BUCKET}/profile-9/1716000000000-x7q2.webp`;

  it("extracts the in-bucket object path for our own comic-covers URL", () => {
    expect(parseComicCoverStoragePath(ownUrl)).toBe("profile-9/1716000000000-x7q2.webp");
  });

  it("decodes percent-encoded path segments", () => {
    const encoded = `${base}/storage/v1/object/public/${COMIC_COVERS_BUCKET}/profile-9/my%20cover.webp`;
    expect(parseComicCoverStoragePath(encoded)).toBe("profile-9/my cover.webp");
  });

  it("returns null for a different Supabase bucket (not ours to delete)", () => {
    const other = `${base}/storage/v1/object/public/avatars/profile-9/pic.webp`;
    expect(parseComicCoverStoragePath(other)).toBeNull();
  });

  it("returns null for external/shared cover hosts (eBay, OpenLibrary, Clerk)", () => {
    expect(parseComicCoverStoragePath("https://i.ebayimg.com/images/g/abc/s-l1600.jpg")).toBeNull();
    expect(parseComicCoverStoragePath("https://covers.openlibrary.org/b/id/123-L.jpg")).toBeNull();
    expect(parseComicCoverStoragePath("https://img.clerk.com/abc.png")).toBeNull();
  });

  it("returns null for blank / null / undefined / non-string input", () => {
    expect(parseComicCoverStoragePath("")).toBeNull();
    expect(parseComicCoverStoragePath(null)).toBeNull();
    expect(parseComicCoverStoragePath(undefined)).toBeNull();
    // @ts-expect-error - guard against accidental non-string callers
    expect(parseComicCoverStoragePath(12345)).toBeNull();
  });

  it("returns null for a malformed URL", () => {
    expect(parseComicCoverStoragePath("not a url")).toBeNull();
  });

  it("returns null when the bucket marker is present but the path is empty", () => {
    expect(
      parseComicCoverStoragePath(`${base}/storage/v1/object/public/${COMIC_COVERS_BUCKET}/`)
    ).toBeNull();
  });

  it("rejects path traversal sequences defensively", () => {
    const traversal = `${base}/storage/v1/object/public/${COMIC_COVERS_BUCKET}/../secrets/key.webp`;
    expect(parseComicCoverStoragePath(traversal)).toBeNull();
  });
});

describe("trimmed list-row transform (M-CO9)", () => {
  // The list query omits price_data + key_info; the transform must still
  // produce a well-formed CollectionItem.
  const trimmedRow = {
    id: "comic-2",
    title: "X-Men",
    issue_number: "1",
    variant: null,
    publisher: "Marvel",
    cover_artist: null,
    writer: null,
    interior_artist: null,
    release_year: "1963",
    confidence: "high",
    is_slabbed: false,
    grading_company: null,
    grade: null,
    is_signature_series: false,
    signed_by: null,
    // price_data + key_info intentionally absent (trimmed columns)
    cover_image_url: "https://cdn.example.com/xmen1.jpg",
    condition_grade: 6.0,
    condition_label: "Fine",
    is_graded: false,
    purchase_price: 100,
    purchase_date: null,
    notes: null,
    for_sale: false,
    for_trade: false,
    asking_price: null,
    average_price: null,
    date_added: "2024-05-01",
    is_starred: false,
    custom_key_info: null,
    custom_key_info_status: null,
    comic_lists: [{ list_id: "l9" }],
  };

  it("defaults missing price_data to null and key_info to []", () => {
    const item = transformDbComicToCollectionItem(trimmedRow);
    expect(item.comic.priceData).toBeNull();
    expect(item.comic.keyInfo).toEqual([]);
    expect(item.comic.title).toBe("X-Men");
    expect(item.listIds).toEqual(["l9"]);
  });
});
