import { parseCurrencyValue } from "@/lib/csvHelpers";

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
