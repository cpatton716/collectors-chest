import { dedupKey } from "../batchImport";

describe("dedupKey", () => {
  it("generates consistent key for same title and issue", () => {
    expect(dedupKey("Spider-Man", "1")).toBe("spider-man|1");
    expect(dedupKey("Spider-Man", "1")).toBe("spider-man|1");
  });

  it("is case-insensitive", () => {
    expect(dedupKey("SPIDER-MAN", "1")).toBe(dedupKey("spider-man", "1"));
    expect(dedupKey("Batman", "50")).toBe(dedupKey("BATMAN", "50"));
  });

  it("trims whitespace", () => {
    expect(dedupKey("  Spider-Man  ", " 1 ")).toBe("spider-man|1");
  });

  it("differentiates different issues of same title", () => {
    expect(dedupKey("Batman", "1")).not.toBe(dedupKey("Batman", "2"));
  });

  it("differentiates different titles with same issue", () => {
    expect(dedupKey("Batman", "1")).not.toBe(dedupKey("Superman", "1"));
  });

  it("handles empty strings", () => {
    expect(dedupKey("", "")).toBe("|");
  });
});
