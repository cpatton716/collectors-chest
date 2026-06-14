import {
  getGuestScansRemaining,
  hasRedeemedBonusScans,
  normalizeServerScanResult,
} from "../useGuestScans";

// ============================================================================
// getGuestScansRemaining Tests
// ============================================================================

describe("getGuestScansRemaining", () => {
  beforeEach(() => {
    (localStorage.getItem as jest.Mock).mockClear();
  });

  it("returns 5 when no scans have been used", () => {
    (localStorage.getItem as jest.Mock).mockReturnValue(null);
    expect(getGuestScansRemaining()).toBe(5);
  });

  it("returns correct remaining when some scans used", () => {
    (localStorage.getItem as jest.Mock)
      .mockReturnValueOnce("3") // scan count
      .mockReturnValueOnce(null); // bonus scans
    expect(getGuestScansRemaining()).toBe(2);
  });

  it("returns 0 when at limit", () => {
    (localStorage.getItem as jest.Mock)
      .mockReturnValueOnce("5") // scan count
      .mockReturnValueOnce(null); // bonus scans
    expect(getGuestScansRemaining()).toBe(0);
  });

  it("returns 0 when over limit", () => {
    (localStorage.getItem as jest.Mock)
      .mockReturnValueOnce("10") // scan count
      .mockReturnValueOnce(null); // bonus scans
    expect(getGuestScansRemaining()).toBe(0);
  });

  it("includes bonus scans in calculation", () => {
    (localStorage.getItem as jest.Mock)
      .mockReturnValueOnce("5") // scan count - at original limit
      .mockReturnValueOnce("5"); // bonus scans - 5 extra
    expect(getGuestScansRemaining()).toBe(5); // 5 bonus remaining
  });

  it("handles bonus scans with partial usage", () => {
    (localStorage.getItem as jest.Mock)
      .mockReturnValueOnce("7") // scan count - 7 used
      .mockReturnValueOnce("5"); // bonus scans - total limit is now 10
    expect(getGuestScansRemaining()).toBe(3); // 10 - 7 = 3
  });
});

// ============================================================================
// hasRedeemedBonusScans Tests
// ============================================================================

describe("hasRedeemedBonusScans", () => {
  beforeEach(() => {
    (localStorage.getItem as jest.Mock).mockClear();
  });

  it("returns false when no bonus scans redeemed", () => {
    (localStorage.getItem as jest.Mock).mockReturnValue(null);
    expect(hasRedeemedBonusScans()).toBe(false);
  });

  it("returns false for zero bonus scans", () => {
    (localStorage.getItem as jest.Mock).mockReturnValue("0");
    expect(hasRedeemedBonusScans()).toBe(false);
  });

  it("returns true when bonus scans have been redeemed", () => {
    (localStorage.getItem as jest.Mock).mockReturnValue("5");
    expect(hasRedeemedBonusScans()).toBe(true);
  });
});

// ============================================================================
// normalizeServerScanResult Tests (H-SC3 / M-SC4)
// Server cookie + Redis counter are the source of truth; the client must render
// the authoritative remaining/limit and never NaN/negative values.
// ============================================================================

describe("normalizeServerScanResult", () => {
  it("passes through valid non-negative integers", () => {
    expect(normalizeServerScanResult({ remaining: 3, limit: 5 })).toEqual({
      remaining: 3,
      limit: 5,
    });
  });

  it("returns null for absent fields (no overwrite of existing state)", () => {
    expect(normalizeServerScanResult({})).toEqual({ remaining: null, limit: null });
    expect(normalizeServerScanResult({ remaining: 2 })).toEqual({ remaining: 2, limit: null });
    expect(normalizeServerScanResult({ limit: 5 })).toEqual({ remaining: null, limit: 5 });
  });

  it("clamps negative values to zero (never shows a negative count)", () => {
    expect(normalizeServerScanResult({ remaining: -4, limit: -1 })).toEqual({
      remaining: 0,
      limit: 0,
    });
  });

  it("floors fractional values", () => {
    expect(normalizeServerScanResult({ remaining: 2.9, limit: 5.1 })).toEqual({
      remaining: 2,
      limit: 5,
    });
  });

  it("treats NaN / non-finite as null (no value)", () => {
    expect(normalizeServerScanResult({ remaining: NaN, limit: Infinity })).toEqual({
      remaining: null,
      limit: null,
    });
  });

  it("treats explicit null as null", () => {
    expect(normalizeServerScanResult({ remaining: null, limit: null })).toEqual({
      remaining: null,
      limit: null,
    });
  });

  it("preserves a zero remaining (limit reached, not 'unknown')", () => {
    expect(normalizeServerScanResult({ remaining: 0, limit: 5 })).toEqual({
      remaining: 0,
      limit: 5,
    });
  });
});
