import {
  PAYMENT_MISS_STRIKE_THRESHOLD,
  PAYMENT_MISS_WINDOW_DAYS,
  PAYMENT_WINDOW_HOURS,
  SECOND_CHANCE_WINDOW_HOURS,
  calculateSecondChanceOfferExpiration,
  isWithinStrikeWindow,
  shouldFlagForPaymentMisses,
} from "../auction";

// ============================================================================
// calculateSecondChanceOfferExpiration
// ============================================================================

describe("calculateSecondChanceOfferExpiration", () => {
  it("adds SECOND_CHANCE_WINDOW_HOURS to the reference time", () => {
    const now = new Date("2026-04-23T12:00:00Z");
    const result = calculateSecondChanceOfferExpiration(now);
    expect(result.getTime() - now.getTime()).toBe(
      SECOND_CHANCE_WINDOW_HOURS * 60 * 60 * 1000
    );
  });

  it("matches the 48-hour payment window by default", () => {
    expect(SECOND_CHANCE_WINDOW_HOURS).toBe(PAYMENT_WINDOW_HOURS);
    expect(SECOND_CHANCE_WINDOW_HOURS).toBe(48);
  });

  it("defaults the reference time to now when omitted", () => {
    const before = Date.now();
    const result = calculateSecondChanceOfferExpiration();
    const after = Date.now();
    // result must fall inside the [before, after] + 48h interval
    const windowMs = SECOND_CHANCE_WINDOW_HOURS * 60 * 60 * 1000;
    expect(result.getTime()).toBeGreaterThanOrEqual(before + windowMs);
    expect(result.getTime()).toBeLessThanOrEqual(after + windowMs + 100);
  });
});

// ============================================================================
// isWithinStrikeWindow
// ============================================================================

describe("isWithinStrikeWindow", () => {
  const now = new Date("2026-04-23T12:00:00Z");

  it("returns true for a timestamp inside the window", () => {
    const t = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    expect(isWithinStrikeWindow(t, now)).toBe(true);
  });

  it("returns true for the exact window boundary", () => {
    const t = new Date(
      now.getTime() - PAYMENT_MISS_WINDOW_DAYS * 24 * 60 * 60 * 1000
    );
    expect(isWithinStrikeWindow(t, now)).toBe(true);
  });

  it("returns false for a timestamp outside the window", () => {
    const t = new Date(
      now.getTime() - (PAYMENT_MISS_WINDOW_DAYS + 1) * 24 * 60 * 60 * 1000
    );
    expect(isWithinStrikeWindow(t, now)).toBe(false);
  });

  it("returns false for future timestamps (clock skew defense)", () => {
    const t = new Date(now.getTime() + 1000);
    expect(isWithinStrikeWindow(t, now)).toBe(false);
  });

  it("respects a custom window", () => {
    const t = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    expect(isWithinStrikeWindow(t, now, 7)).toBe(false);
    expect(isWithinStrikeWindow(t, now, 14)).toBe(true);
  });
});

// ============================================================================
// shouldFlagForPaymentMisses
// ============================================================================

describe("shouldFlagForPaymentMisses", () => {
  const now = new Date("2026-04-23T12:00:00Z");

  it("does not flag on a first offense (no prior misses)", () => {
    expect(shouldFlagForPaymentMisses([], now)).toBe(false);
  });

  it("flags when a prior miss exists inside the window (threshold=2)", () => {
    const prior = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    expect(shouldFlagForPaymentMisses([prior], now)).toBe(true);
  });

  it("does not flag when the only prior miss is outside the window", () => {
    const prior = new Date(
      now.getTime() - (PAYMENT_MISS_WINDOW_DAYS + 5) * 24 * 60 * 60 * 1000
    );
    expect(shouldFlagForPaymentMisses([prior], now)).toBe(false);
  });

  it("counts only in-window priors toward the threshold", () => {
    const old = new Date(
      now.getTime() - (PAYMENT_MISS_WINDOW_DAYS + 5) * 24 * 60 * 60 * 1000
    );
    const recent = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    expect(shouldFlagForPaymentMisses([old], now)).toBe(false);
    expect(shouldFlagForPaymentMisses([old, recent], now)).toBe(true);
  });

  it("honours the configured threshold constant (2)", () => {
    expect(PAYMENT_MISS_STRIKE_THRESHOLD).toBe(2);
  });

  it("can be called with a stricter threshold", () => {
    const priorA = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const priorB = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
    // With threshold=3, one current + two priors = 3 → should flag.
    expect(
      shouldFlagForPaymentMisses([priorA, priorB], now, 90, 3)
    ).toBe(true);
    // With threshold=4, not enough.
    expect(
      shouldFlagForPaymentMisses([priorA, priorB], now, 90, 4)
    ).toBe(false);
  });
});
