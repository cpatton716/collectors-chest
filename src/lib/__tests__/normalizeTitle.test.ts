import { normalizeTitle, normalizeIssueNumber } from "../normalizeTitle";

describe("normalizeTitle", () => {
  it("lowercases and trims", () => {
    expect(normalizeTitle("  Batman  ")).toBe("batman");
  });

  it("strips non-alphanumeric characters except hyphens and spaces", () => {
    expect(normalizeTitle("Batman: Year One")).toBe("batman year one");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeTitle("The  Amazing   Spider-Man")).toBe("the amazing spider-man");
  });

  it("preserves hyphens", () => {
    expect(normalizeTitle("Spider-Man")).toBe("spider-man");
  });

  it("handles empty string", () => {
    expect(normalizeTitle("")).toBe("");
  });

  it("strips parentheses and special chars", () => {
    expect(normalizeTitle("Batman (2016)")).toBe("batman 2016");
  });
});

describe("normalizeIssueNumber", () => {
  it("lowercases and trims", () => {
    expect(normalizeIssueNumber("  5  ")).toBe("5");
  });

  it("strips all leading hash signs", () => {
    expect(normalizeIssueNumber("##5")).toBe("5");
  });

  it("handles Annual prefix", () => {
    expect(normalizeIssueNumber("Annual #1")).toBe("annual 1");
  });

  it("preserves fractions", () => {
    expect(normalizeIssueNumber("1/2")).toBe("1/2");
  });

  it("handles empty string", () => {
    expect(normalizeIssueNumber("")).toBe("");
  });
});
