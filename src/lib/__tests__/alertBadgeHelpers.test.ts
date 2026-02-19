import { getAlertBadgeColor } from "../alertBadgeHelpers";

describe("getAlertBadgeColor", () => {
  it("returns red for critical", () => {
    expect(getAlertBadgeColor("critical")).toBe("bg-pop-red");
  });

  it("returns yellow for warning", () => {
    expect(getAlertBadgeColor("warning")).toBe("bg-pop-yellow text-pop-black");
  });

  it("returns empty string for ok", () => {
    expect(getAlertBadgeColor("ok")).toBe("");
  });
});
