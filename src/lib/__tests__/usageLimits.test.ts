import {
  ALERT_THRESHOLDS,
  COVER_HAIKU_COST_CENTS,
  SCAN_SPEND_LIMITS_CENTS,
  coverHaikuCostCents,
  coverHaikuKeys,
  earliestWindowStart,
  getUsageWindows,
  sumScanCostCents,
  thresholdStatus,
} from "../usageLimits";

describe("usageLimits", () => {
  describe("thresholdStatus", () => {
    it("returns ok below the warning threshold", () => {
      expect(thresholdStatus(0)).toBe("ok");
      expect(thresholdStatus(0.69)).toBe("ok");
    });

    it("returns warning at the warning threshold", () => {
      expect(thresholdStatus(ALERT_THRESHOLDS.warning)).toBe("warning");
      expect(thresholdStatus(0.7)).toBe("warning");
      expect(thresholdStatus(0.89)).toBe("warning");
    });

    it("returns critical at/above the critical threshold", () => {
      expect(thresholdStatus(ALERT_THRESHOLDS.critical)).toBe("critical");
      expect(thresholdStatus(0.9)).toBe("critical");
      expect(thresholdStatus(1.5)).toBe("critical");
    });
  });

  describe("getUsageWindows", () => {
    it("computes windows relative to a fixed instant", () => {
      // Wed Mar 18 2026 12:00 local
      const now = new Date(2026, 2, 18, 12, 0, 0);
      const w = getUsageWindows(now);

      expect(w.monthStart).toBe(new Date(2026, 2, 1).toISOString());
      expect(w.todayStart).toBe(new Date(2026, 2, 18).toISOString());
      // Mar 18 2026 is a Wednesday (getDay() === 3) -> weekStart = Sun Mar 15
      expect(w.weekStart).toBe(new Date(2026, 2, 15).toISOString());
    });

    it("rolls weekStart into the previous month at a boundary", () => {
      // Tue Mar 3 2026 (getDay() === 2) -> weekStart = Sun Mar 1
      const now = new Date(2026, 2, 3, 9, 0, 0);
      const w = getUsageWindows(now);
      expect(w.weekStart).toBe(new Date(2026, 2, 1).toISOString());
    });

    it("computes rolling-day windows", () => {
      const now = new Date("2026-06-14T00:00:00.000Z");
      const w = getUsageWindows(now);
      expect(w.sevenDaysAgo).toBe("2026-06-07T00:00:00.000Z");
      expect(w.thirtyDaysAgo).toBe("2026-05-15T00:00:00.000Z");
      expect(w.ninetyDaysAgo).toBe("2026-03-16T00:00:00.000Z");
    });
  });

  describe("earliestWindowStart", () => {
    it("returns the minimum of month/week/seven-day starts", () => {
      // On the 1st-6th, weekStart can precede monthStart.
      const now = new Date(2026, 2, 3, 9, 0, 0); // Tue Mar 3
      const w = getUsageWindows(now);
      const earliest = earliestWindowStart(w);
      // sevenDaysAgo (Feb 24) is earliest here
      expect(new Date(earliest).getTime()).toBe(new Date(w.sevenDaysAgo).getTime());
      expect(new Date(earliest).getTime()).toBeLessThanOrEqual(new Date(w.monthStart).getTime());
    });
  });

  describe("sumScanCostCents", () => {
    it("sums all rows when no boundary is given", () => {
      expect(
        sumScanCostCents([
          { estimated_cost_cents: 10 },
          { estimated_cost_cents: 5 },
          { estimated_cost_cents: 0 },
        ])
      ).toBe(15);
    });

    it("coerces string and null costs", () => {
      expect(
        sumScanCostCents([
          { estimated_cost_cents: "12.5" },
          { estimated_cost_cents: null },
          { estimated_cost_cents: 2 },
        ])
      ).toBe(14.5);
    });

    it("only counts rows at/after the boundary", () => {
      const rows = [
        { estimated_cost_cents: 10, scanned_at: "2026-06-10T00:00:00.000Z" },
        { estimated_cost_cents: 20, scanned_at: "2026-06-14T00:00:00.000Z" },
        { estimated_cost_cents: 40, scanned_at: "2026-06-15T00:00:00.000Z" },
      ];
      expect(sumScanCostCents(rows, "2026-06-14T00:00:00.000Z")).toBe(60);
    });

    it("excludes rows missing scanned_at when a boundary is given", () => {
      const rows = [
        { estimated_cost_cents: 10 },
        { estimated_cost_cents: 20, scanned_at: "2026-06-15T00:00:00.000Z" },
      ];
      expect(sumScanCostCents(rows, "2026-06-14T00:00:00.000Z")).toBe(20);
    });

    it("returns 0 for an empty array", () => {
      expect(sumScanCostCents([])).toBe(0);
    });
  });

  describe("coverHaikuKeys", () => {
    it("generates one descending-date key per day", () => {
      const now = new Date("2026-06-14T12:00:00.000Z");
      const keys = coverHaikuKeys(now, 3);
      expect(keys).toEqual([
        "usage:cover-haiku:2026-06-14",
        "usage:cover-haiku:2026-06-13",
        "usage:cover-haiku:2026-06-12",
      ]);
    });

    it("defaults to a 30-day window", () => {
      expect(coverHaikuKeys(new Date("2026-06-14T00:00:00.000Z"))).toHaveLength(30);
    });
  });

  describe("coverHaikuCostCents", () => {
    it("multiplies call count by the per-call cost", () => {
      expect(coverHaikuCostCents(0)).toBe(0);
      expect(coverHaikuCostCents(100)).toBe(100 * COVER_HAIKU_COST_CENTS);
    });
  });

  describe("constants", () => {
    it("exposes scan-spend limits", () => {
      expect(SCAN_SPEND_LIMITS_CENTS.daily).toBe(300);
      expect(SCAN_SPEND_LIMITS_CENTS.weekly).toBe(1500);
    });
  });
});
