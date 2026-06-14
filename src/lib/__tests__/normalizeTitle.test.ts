import {
  normalizeIssueNumber,
  normalizeKeyComicTitle,
  normalizeTitle,
} from "../normalizeTitle";

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

describe("normalizeKeyComicTitle (M-PR7)", () => {
  // Reference implementation mirroring the Postgres normalize_comic_title()
  // trigger (supabase/migrations/20250117_key_info_community.sql):
  //   lower(regexp_replace(regexp_replace(title,'[^a-zA-Z0-9\s]','','g'),'\s+',' ','g'))
  const sqlTriggerNormalize = (title: string): string =>
    title
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  it("lowercases", () => {
    expect(normalizeKeyComicTitle("BATMAN")).toBe("batman");
  });

  it("strips special characters but keeps spaces", () => {
    expect(normalizeKeyComicTitle("Spider-Man: No More!")).toBe("spiderman no more");
  });

  it("collapses whitespace", () => {
    expect(normalizeKeyComicTitle("Amazing   Spider  Man")).toBe("amazing spider man");
  });

  it("does NOT strip leading 'The' (unlike the static key map normalizer)", () => {
    expect(normalizeKeyComicTitle("The Amazing Spider-Man")).toBe("the amazing spiderman");
  });

  it.each([
    "Amazing Spider-Man",
    "X-Men: God Loves, Man Kills",
    "Batman/Superman",
    "Marvel's The Avengers (2012)",
    "  Spawn   #1  ",
    "Daredevil!!!",
  ])("matches the SQL trigger output for %s", (title) => {
    expect(normalizeKeyComicTitle(title)).toBe(sqlTriggerNormalize(title));
  });
});
