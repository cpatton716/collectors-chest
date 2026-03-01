import { formatCents, getScanStatus } from "../scanAnalyticsHelpers";

describe("scanAnalyticsHelpers", () => {
  describe("formatCents", () => {
    it("formats zero cents", () => {
      expect(formatCents(0)).toBe("$0.00");
    });

    it("formats whole dollar amounts", () => {
      expect(formatCents(300)).toBe("$3.00");
    });

    it("formats fractional cents", () => {
      expect(formatCents(150)).toBe("$1.50");
    });

    it("formats large amounts", () => {
      expect(formatCents(12345)).toBe("$123.45");
    });
  });

  describe("getScanStatus", () => {
    it("returns ok when under 70%", () => {
      expect(getScanStatus(100, 300)).toBe("ok");
    });

    it("returns warning at 70%", () => {
      expect(getScanStatus(210, 300)).toBe("warning");
    });

    it("returns critical at 90%", () => {
      expect(getScanStatus(270, 300)).toBe("critical");
    });

    it("returns critical when over limit", () => {
      expect(getScanStatus(400, 300)).toBe("critical");
    });
  });
});
