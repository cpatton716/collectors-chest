import { collectionToCSV } from "@/lib/csvExport";
import { parseCurrencyValue } from "@/lib/csvHelpers";

import { CollectionItem, ComicDetails } from "@/types/comic";

function makeComic(overrides: Partial<ComicDetails> = {}): ComicDetails {
  return {
    id: "comic-1",
    title: "Amazing Spider-Man",
    issueNumber: "300",
    variant: null,
    publisher: "Marvel",
    coverArtist: "Todd McFarlane",
    writer: "David Michelinie",
    interiorArtist: "Todd McFarlane",
    releaseYear: "1988",
    confidence: "high",
    isSlabbed: false,
    gradingCompany: null,
    grade: "9.4",
    certificationNumber: null,
    labelType: null,
    pageQuality: null,
    gradeDate: null,
    graderNotes: null,
    isSignatureSeries: false,
    signedBy: null,
    priceData: null,
    keyInfo: [],
    ...overrides,
  };
}

function makeItem(
  comicOverrides: Partial<ComicDetails> = {},
  itemOverrides: Partial<CollectionItem> = {}
): CollectionItem {
  return {
    id: "item-1",
    comic: makeComic(comicOverrides),
    coverImageUrl: "https://example.com/cover.webp",
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
    dateAdded: "2026-01-01",
    listIds: [],
    isStarred: false,
    customKeyInfo: [],
    customKeyInfoStatus: null,
    ...itemOverrides,
  };
}

describe("collectionToCSV", () => {
  it("emits a header row with all expected columns", () => {
    const csv = collectionToCSV([]);
    const headerLine = csv.split("\n")[0];
    expect(headerLine).toContain("Title");
    expect(headerLine).toContain("Cover Image URL");
    expect(headerLine.split(",").length).toBe(22);
  });

  it("renders a basic row with no quoting when no special chars", () => {
    const csv = collectionToCSV([makeItem()]);
    const dataLine = csv.split("\n")[1];
    expect(dataLine).toContain("Amazing Spider-Man");
    expect(dataLine).toContain("Marvel");
    expect(dataLine).not.toContain('"');
  });

  it("quotes and escapes values containing commas", () => {
    const csv = collectionToCSV([makeItem({ title: "Spider-Man, the Amazing" })]);
    const dataLine = csv.split("\n")[1];
    expect(dataLine).toContain('"Spider-Man, the Amazing"');
  });

  it("doubles embedded double-quotes", () => {
    const csv = collectionToCSV([makeItem({ variant: 'The "Death" Variant' })]);
    const dataLine = csv.split("\n")[1];
    expect(dataLine).toContain('"The ""Death"" Variant"');
  });

  it("quotes values containing newlines (notes field)", () => {
    const csv = collectionToCSV([makeItem({}, { notes: "line1\nline2" })]);
    // The newline is inside a quoted field, so it must not split the data row.
    expect(csv).toContain('"line1\nline2"');
  });

  it("joins keyInfo with comma and quotes it", () => {
    const csv = collectionToCSV([
      makeItem({ keyInfo: ["1st Venom", "Origin"] }),
    ]);
    const dataLine = csv.split("\n")[1];
    expect(dataLine).toContain('"1st Venom, Origin"');
  });

  it("exports the eBay estimated value from priceData", () => {
    const csv = collectionToCSV([
      makeItem({
        priceData: {
          estimatedValue: 1234.56,
          recentSales: [],
          mostRecentSaleDate: null,
          isAveraged: false,
          disclaimer: null,
        },
      }),
    ]);
    expect(csv.split("\n")[1]).toContain("1234.56");
  });

  it("blanks out data: URI cover images to avoid bloated exports", () => {
    const csv = collectionToCSV([
      makeItem({}, { coverImageUrl: "data:image/png;base64,AAAA" }),
    ]);
    const cols = csv.split("\n")[1].split(",");
    // Last column is Cover Image URL; should be empty for data: URIs.
    expect(cols[cols.length - 1]).toBe("");
  });

  it("renders empty strings for null fields", () => {
    const csv = collectionToCSV([makeItem({ writer: null, publisher: null })]);
    expect(csv.split("\n").length).toBe(2);
  });
});

describe("parseCurrencyValue", () => {
  it("parses plain number", () => {
    expect(parseCurrencyValue("8.00")).toBe(8.0);
  });
  it("strips dollar sign", () => {
    expect(parseCurrencyValue("$8.00")).toBe(8.0);
  });
  it("strips commas", () => {
    expect(parseCurrencyValue("$1,000.00")).toBe(1000.0);
  });
  it("handles no cents", () => {
    expect(parseCurrencyValue("$25")).toBe(25);
  });
  it("returns undefined for empty string", () => {
    expect(parseCurrencyValue("")).toBeUndefined();
  });
  it("returns undefined for non-numeric", () => {
    expect(parseCurrencyValue("abc")).toBeUndefined();
  });
});
