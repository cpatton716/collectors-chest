// Mock @upstash/redis — pulled in transitively via certLookup.ts -> cache.ts ->
// redis.ts. The cert parsers under test never touch Redis; this just keeps the
// non-transpilable Upstash ESM out of the Jest module graph.
jest.mock("@upstash/redis", () => ({
  Redis: jest.fn().mockImplementation(() => ({ get: jest.fn(), set: jest.fn(), del: jest.fn() })),
}));

import {
  normalizeGradingCompany,
  parseKeyComments,
  parseArtComments,
  mergeKeyComments,
} from "../certHelpers";
import {
  detectGradingCompany,
  parseCGCResponse,
  parseCBCSResponse,
  parsePGXResponse,
} from "../certLookup";

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

// ============================================================================
// certLookup — detectGradingCompany + HTML-fixture parsers (M-PR8)
// ============================================================================

describe("detectGradingCompany", () => {
  it("detects CBCS dashed alphanumeric format", () => {
    expect(detectGradingCompany("20-1F9AC96-004")).toBe("CBCS");
  });
  it("detects CBCS when hex letters present", () => {
    expect(detectGradingCompany("1F9AC96")).toBe("CBCS");
  });
  it("detects CGC for 10-digit numeric cert", () => {
    expect(detectGradingCompany("1234567890")).toBe("CGC");
  });
  it("detects CGC for 7-9 digit numeric cert", () => {
    expect(detectGradingCompany("1234567")).toBe("CGC");
  });
  it("detects PGX for short 5-7 digit cert", () => {
    expect(detectGradingCompany("12345")).toBe("PGX");
  });
  it("returns null for empty string", () => {
    expect(detectGradingCompany("")).toBeNull();
  });
  it("returns null for too-short numeric input", () => {
    expect(detectGradingCompany("123")).toBeNull();
  });
  it("trims surrounding whitespace before detecting", () => {
    expect(detectGradingCompany("  1234567890  ")).toBe("CGC");
  });
});

describe("parseCGCResponse", () => {
  const validCgcHtml = `
    <html><body>
      <h1>Amazing Spider-Man #300</h1>
      <div>Grade: 9.8</div>
      <div>Publisher: Marvel Comics</div>
      <div>Issue Year 1988</div>
      <div>Page Quality<span>White</span></div>
      <div>Grade Date 2017-06-27</div>
      <div>Label Category<span>Universal</span></div>
      <div>Key Comments<span>First full appearance of Venom</span></div>
    </body></html>`;

  it("parses title and issue number from h1", () => {
    const r = parseCGCResponse(validCgcHtml, "1234567890");
    expect(r.success).toBe(true);
    expect(r.data?.title).toBe("Amazing Spider-Man");
    expect(r.data?.issueNumber).toBe("300");
  });

  it("extracts grade, publisher, and year", () => {
    const r = parseCGCResponse(validCgcHtml, "1234567890");
    expect(r.data?.grade).toBe("9.8");
    expect(r.data?.publisher).toContain("Marvel");
    expect(r.data?.releaseYear).toBe("1988");
  });

  it("sets source to cgc and echoes the cert number", () => {
    const r = parseCGCResponse(validCgcHtml, "1234567890");
    expect(r.source).toBe("cgc");
    expect(r.certNumber).toBe("1234567890");
  });

  it("returns failure when page says not found", () => {
    const r = parseCGCResponse("<html>Certificate not found</html>", "1234567890");
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });

  it("returns failure when no title and no grade parse", () => {
    const r = parseCGCResponse("<html><body>nothing useful here</body></html>", "1234567890");
    expect(r.success).toBe(false);
  });
});

describe("parseCBCSResponse", () => {
  const validCbcsHtml = `
    <html><body>
      <h2>Spider-Man #1</h2>
      <span>9.4</span><span>Verified</span>
      <div>Variant: Newsstand</div>
    </body></html>`;

  it("parses title and issue number", () => {
    const r = parseCBCSResponse(validCbcsHtml, "20-1F9AC96-004");
    expect(r.success).toBe(true);
    expect(r.data?.title).toBe("Spider-Man");
    expect(r.data?.issueNumber).toBe("1");
  });

  it("sets source to cbcs", () => {
    const r = parseCBCSResponse(validCbcsHtml, "20-1F9AC96-004");
    expect(r.source).toBe("cbcs");
  });

  it("returns failure on 'no record'", () => {
    const r = parseCBCSResponse("<html>no record found</html>", "20-1F9AC96-004");
    expect(r.success).toBe(false);
  });
});

describe("parsePGXResponse", () => {
  const validPgxHtml = `
    <html><body>
      Title: Batman #1
      Grade: 6.0
      Published (1940)
    </body></html>`;

  it("parses title, issue, grade and year", () => {
    const r = parsePGXResponse(validPgxHtml, "12345");
    expect(r.success).toBe(true);
    expect(r.data?.title).toBe("Batman");
    expect(r.data?.issueNumber).toBe("1");
    expect(r.data?.grade).toBe("6.0");
    expect(r.data?.releaseYear).toBe("1940");
  });

  it("sets source to pgx", () => {
    const r = parsePGXResponse(validPgxHtml, "12345");
    expect(r.source).toBe("pgx");
  });

  it("returns failure when invalid", () => {
    const r = parsePGXResponse("<html>invalid</html>", "12345");
    expect(r.success).toBe(false);
  });
});
