// Mock Supabase before importing — prevents module resolution errors for DB functions
jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

// Mock db to avoid cache.ts → @upstash/redis → uncrypto ESM chain
jest.mock("../db", () => ({
  saveComicMetadata: jest.fn(),
}));

import { normalizeTitle, normalizeIssueNumber } from "../normalizeTitle";
import { buildCoverLookupKey } from "../coverImageDb";

describe("coverImageDb helpers", () => {
  describe("normalizeTitle", () => {
    it("lowercases and trims the title", () => {
      expect(normalizeTitle("  Batman  ")).toBe("batman");
    });

    it("removes special characters except hyphens", () => {
      expect(normalizeTitle("Spider-Man (2022)")).toBe("spider-man 2022");
    });

    it("collapses multiple spaces", () => {
      expect(normalizeTitle("The   Amazing   Spider-Man")).toBe(
        "the amazing spider-man"
      );
    });

    it("handles apostrophes and quotes", () => {
      expect(normalizeTitle("Harley Quinn's Adventures")).toBe(
        "harley quinns adventures"
      );
    });

    it("handles empty string", () => {
      expect(normalizeTitle("")).toBe("");
    });
  });

  describe("normalizeIssueNumber", () => {
    it("strips leading hash", () => {
      expect(normalizeIssueNumber("#171")).toBe("171");
    });

    it("trims whitespace", () => {
      expect(normalizeIssueNumber("  42  ")).toBe("42");
    });

    it("handles N/A", () => {
      expect(normalizeIssueNumber("N/A")).toBe("n/a");
    });

    it("preserves decimals and letters", () => {
      expect(normalizeIssueNumber("1.1")).toBe("1.1");
      expect(normalizeIssueNumber("500A")).toBe("500a");
    });

    it("handles empty string", () => {
      expect(normalizeIssueNumber("")).toBe("");
    });
  });

  describe("buildCoverLookupKey", () => {
    it("combines normalized title and issue", () => {
      expect(buildCoverLookupKey("Batman", "#171")).toBe("batman|171");
    });

    it("handles variant titles the same as base", () => {
      expect(buildCoverLookupKey("  Batman  ", "171")).toBe("batman|171");
    });

    it("normalizes both parts", () => {
      expect(buildCoverLookupKey("Spider-Man (2022)", "#1")).toBe(
        "spider-man 2022|1"
      );
    });
  });
});
