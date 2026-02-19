import { expandAbbreviation, normalizeSearchQuery } from "../titleNormalization";

describe("expandAbbreviation", () => {
  it("expands Marvel abbreviations", () => {
    expect(expandAbbreviation("asm")).toBe("Amazing Spider-Man");
    expect(expandAbbreviation("ff")).toBe("Fantastic Four");
    expect(expandAbbreviation("uxm")).toBe("Uncanny X-Men");
    expect(expandAbbreviation("ih")).toBe("Incredible Hulk");
    expect(expandAbbreviation("nm")).toBe("New Mutants");
  });

  it("expands DC abbreviations", () => {
    expect(expandAbbreviation("tec")).toBe("Detective Comics");
    expect(expandAbbreviation("jla")).toBe("Justice League of America");
    expect(expandAbbreviation("gl")).toBe("Green Lantern");
    expect(expandAbbreviation("dkr")).toBe("The Dark Knight Returns");
  });

  it("expands indie abbreviations", () => {
    expect(expandAbbreviation("tmnt")).toBe("Teenage Mutant Ninja Turtles");
    expect(expandAbbreviation("wd")).toBe("The Walking Dead");
    expect(expandAbbreviation("twd")).toBe("The Walking Dead");
  });

  it("is case-insensitive", () => {
    expect(expandAbbreviation("ASM")).toBe("Amazing Spider-Man");
    expect(expandAbbreviation("Tec")).toBe("Detective Comics");
    expect(expandAbbreviation("FF")).toBe("Fantastic Four");
  });

  it("trims whitespace", () => {
    expect(expandAbbreviation("  asm  ")).toBe("Amazing Spider-Man");
    expect(expandAbbreviation(" ff ")).toBe("Fantastic Four");
  });

  it("returns null for unknown abbreviations", () => {
    expect(expandAbbreviation("xyz")).toBeNull();
    expect(expandAbbreviation("hello")).toBeNull();
  });

  it("returns null for full titles", () => {
    expect(expandAbbreviation("Amazing Spider-Man")).toBeNull();
    expect(expandAbbreviation("Batman")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(expandAbbreviation("")).toBeNull();
  });
});

describe("normalizeSearchQuery", () => {
  it("expands known abbreviations", () => {
    expect(normalizeSearchQuery("asm")).toBe("Amazing Spider-Man");
    expect(normalizeSearchQuery("tec")).toBe("Detective Comics");
  });

  it("returns trimmed original for non-abbreviations", () => {
    expect(normalizeSearchQuery("  Spider-Man  ")).toBe("Spider-Man");
    expect(normalizeSearchQuery("Batman")).toBe("Batman");
  });

  it("handles empty string", () => {
    expect(normalizeSearchQuery("")).toBe("");
  });

  it("handles whitespace-only string", () => {
    expect(normalizeSearchQuery("   ")).toBe("");
  });
});
