import {
  normalizeGradingCompany,
  parseKeyComments,
  parseArtComments,
  mergeKeyComments,
} from "../certHelpers";

describe("normalizeGradingCompany", () => {
  it("normalizes 'CGC' to 'CGC'", () => { expect(normalizeGradingCompany("CGC")).toBe("CGC"); });
  it("normalizes 'cgc' to 'CGC'", () => { expect(normalizeGradingCompany("cgc")).toBe("CGC"); });
  it("normalizes 'C.G.C.' to 'CGC'", () => { expect(normalizeGradingCompany("C.G.C.")).toBe("CGC"); });
  it("normalizes 'CBCS' to 'CBCS'", () => { expect(normalizeGradingCompany("CBCS")).toBe("CBCS"); });
  it("normalizes 'cbcs' to 'CBCS'", () => { expect(normalizeGradingCompany("cbcs")).toBe("CBCS"); });
  it("normalizes 'PGX' to 'PGX'", () => { expect(normalizeGradingCompany("PGX")).toBe("PGX"); });
  it("normalizes ' CGC ' to 'CGC'", () => { expect(normalizeGradingCompany(" CGC ")).toBe("CGC"); });
  it("returns null for 'EGS'", () => { expect(normalizeGradingCompany("EGS")).toBeNull(); });
  it("returns null for 'HALO'", () => { expect(normalizeGradingCompany("HALO")).toBeNull(); });
  it("returns null for 'Other'", () => { expect(normalizeGradingCompany("Other")).toBeNull(); });
  it("returns null for empty string", () => { expect(normalizeGradingCompany("")).toBeNull(); });
  it("returns null for null", () => { expect(normalizeGradingCompany(null)).toBeNull(); });
});

describe("parseKeyComments", () => {
  it("splits semicolons", () => { expect(parseKeyComments("1st app Wolverine; 1st app Wendigo")).toEqual(["1st app Wolverine", "1st app Wendigo"]); });
  it("splits newlines", () => { expect(parseKeyComments("1st app Wolverine\n1st app Wendigo")).toEqual(["1st app Wolverine", "1st app Wendigo"]); });
  it("trims whitespace", () => { expect(parseKeyComments("  1st app Wolverine ; 1st app Wendigo  ")).toEqual(["1st app Wolverine", "1st app Wendigo"]); });
  it("filters empty", () => { expect(parseKeyComments("1st app Wolverine;;")).toEqual(["1st app Wolverine"]); });
  it("returns [] for null", () => { expect(parseKeyComments(null)).toEqual([]); });
  it("returns [] for empty", () => { expect(parseKeyComments("")).toEqual([]); });
  it("single item", () => { expect(parseKeyComments("1st app Wolverine")).toEqual(["1st app Wolverine"]); });
});

describe("mergeKeyComments", () => {
  it("cert first, DB appended", () => {
    const result = mergeKeyComments(["1st app Wolverine"], ["1st full app Wolverine", "1st app Wendigo"]);
    expect(result[0]).toBe("1st app Wolverine");
    expect(result).toContain("1st full app Wolverine");
    expect(result).toContain("1st app Wendigo");
  });
  it("deduplicates case-insensitive", () => {
    expect(mergeKeyComments(["1st App Wolverine"], ["1st app wolverine", "1st app Wendigo"])).toEqual(["1st App Wolverine", "1st app Wendigo"]);
  });
  it("cert only", () => { expect(mergeKeyComments(["1st app Wolverine"], [])).toEqual(["1st app Wolverine"]); });
  it("DB only", () => { expect(mergeKeyComments([], ["1st app Wolverine"])).toEqual(["1st app Wolverine"]); });
});

describe("parseArtComments", () => {
  it("'cover and art'", () => { expect(parseArtComments("Todd McFarlane cover and art")).toEqual({ coverArtist: "Todd McFarlane", interiorArtist: "Todd McFarlane" }); });
  it("'Cover by X; Interior art by Y'", () => { expect(parseArtComments("Cover by Jim Lee; Interior art by Scott Williams")).toEqual({ coverArtist: "Jim Lee", interiorArtist: "Scott Williams" }); });
  it("'Art by X'", () => { expect(parseArtComments("Art by Jack Kirby")).toEqual({ interiorArtist: "Jack Kirby" }); });
  it("null → {}", () => { expect(parseArtComments(null)).toEqual({}); });
  it("empty → {}", () => { expect(parseArtComments("")).toEqual({}); });
  it("unrecognized → {}", () => { expect(parseArtComments("Some random text")).toEqual({}); });
  it("'cover & art'", () => { expect(parseArtComments("Todd McFarlane cover & art")).toEqual({ coverArtist: "Todd McFarlane", interiorArtist: "Todd McFarlane" }); });
  it("names with apostrophes", () => { expect(parseArtComments("Cover by Jim O'Brien")).toEqual({ coverArtist: "Jim O'Brien" }); });
});
