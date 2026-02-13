import { filterCustomKeyInfoForPublic } from "../keyInfoHelpers";

describe("filterCustomKeyInfoForPublic", () => {
  it("returns customKeyInfo when status is approved", () => {
    const result = filterCustomKeyInfoForPublic(
      ["First appearance of X"],
      "approved"
    );
    expect(result).toEqual(["First appearance of X"]);
  });

  it("returns empty array when status is pending", () => {
    const result = filterCustomKeyInfoForPublic(
      ["First appearance of X"],
      "pending"
    );
    expect(result).toEqual([]);
  });

  it("returns empty array when status is rejected", () => {
    const result = filterCustomKeyInfoForPublic(
      ["First appearance of X"],
      "rejected"
    );
    expect(result).toEqual([]);
  });

  it("returns empty array when status is null", () => {
    const result = filterCustomKeyInfoForPublic(
      ["First appearance of X"],
      null
    );
    expect(result).toEqual([]);
  });

  it("returns empty array when customKeyInfo is empty", () => {
    const result = filterCustomKeyInfoForPublic([], "approved");
    expect(result).toEqual([]);
  });
});
