import {
  calculateFallbackRate,
  FALLBACK_THRESHOLDS,
} from "../check-alerts/fallbackRate";

describe("calculateFallbackRate", () => {
  it("returns null when no scans in period", () => {
    const result = calculateFallbackRate({ total: 0, fallbackCount: 0 });
    expect(result).toBeNull();
  });

  it("returns no alert when fallback rate is below warning threshold", () => {
    const result = calculateFallbackRate({ total: 100, fallbackCount: 5 });
    expect(result).toBeNull();
  });

  it("returns warning when fallback rate >= 10%", () => {
    const result = calculateFallbackRate({ total: 100, fallbackCount: 12 });
    expect(result).toEqual({
      name: "AI Fallback Rate (1h)",
      current: 12,
      limit: 100,
      percentage: 0.12,
      alertType: "warning",
    });
  });

  it("returns critical when fallback rate >= 25%", () => {
    const result = calculateFallbackRate({ total: 100, fallbackCount: 30 });
    expect(result).toEqual({
      name: "AI Fallback Rate (1h)",
      current: 30,
      limit: 100,
      percentage: 0.3,
      alertType: "critical",
    });
  });

  it("handles edge case at exactly warning threshold", () => {
    const result = calculateFallbackRate({ total: 10, fallbackCount: 1 });
    expect(result).toEqual({
      name: "AI Fallback Rate (1h)",
      current: 1,
      limit: 10,
      percentage: 0.1,
      alertType: "warning",
    });
  });

  it("handles edge case at exactly critical threshold", () => {
    const result = calculateFallbackRate({ total: 4, fallbackCount: 1 });
    expect(result).toEqual({
      name: "AI Fallback Rate (1h)",
      current: 1,
      limit: 4,
      percentage: 0.25,
      alertType: "critical",
    });
  });
});

describe("FALLBACK_THRESHOLDS", () => {
  it("has warning at 10% and critical at 25%", () => {
    expect(FALLBACK_THRESHOLDS.warning).toBe(0.1);
    expect(FALLBACK_THRESHOLDS.critical).toBe(0.25);
  });
});
