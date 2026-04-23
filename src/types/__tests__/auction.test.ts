import {
  calculateMinimumBid,
  calculateSellerReputation,
  formatPrice,
  formatTimeRemaining,
  getBidIncrement,
  isValidBidAmount,
} from "../auction";

// ============================================================================
// calculateMinimumBid Tests
// ============================================================================

describe("calculateMinimumBid", () => {
  describe("when there is no current bid", () => {
    it("returns the starting price", () => {
      expect(calculateMinimumBid(null, 10)).toBe(10);
      expect(calculateMinimumBid(null, 99)).toBe(99);
      expect(calculateMinimumBid(null, 500)).toBe(500);
    });
  });

  describe("when there is a current bid", () => {
    it("adds a flat $1 increment regardless of price", () => {
      expect(calculateMinimumBid(1, 1)).toBe(2);
      expect(calculateMinimumBid(50, 10)).toBe(51);
      expect(calculateMinimumBid(99, 10)).toBe(100);
      expect(calculateMinimumBid(100, 10)).toBe(101);
      expect(calculateMinimumBid(500, 10)).toBe(501);
      expect(calculateMinimumBid(999, 10)).toBe(1000);
      expect(calculateMinimumBid(1000, 10)).toBe(1001);
      expect(calculateMinimumBid(10000, 10)).toBe(10001);
    });
  });
});

// ============================================================================
// getBidIncrement Tests
// ============================================================================

describe("getBidIncrement", () => {
  it("returns $1 at every price level", () => {
    expect(getBidIncrement(0)).toBe(1);
    expect(getBidIncrement(50)).toBe(1);
    expect(getBidIncrement(99)).toBe(1);
    expect(getBidIncrement(100)).toBe(1);
    expect(getBidIncrement(500)).toBe(1);
    expect(getBidIncrement(999)).toBe(1);
    expect(getBidIncrement(1000)).toBe(1);
    expect(getBidIncrement(100000)).toBe(1);
  });
});

// ============================================================================
// isValidBidAmount Tests
// ============================================================================

describe("isValidBidAmount", () => {
  describe("when bid is below minimum", () => {
    it("returns invalid with message", () => {
      const result = isValidBidAmount(5, null, 10);
      expect(result.valid).toBe(false);
      expect(result.message).toContain("Minimum bid");
    });

    it("returns invalid when below increment", () => {
      const result = isValidBidAmount(50, 50, 10);
      expect(result.valid).toBe(false);
    });
  });

  describe("when bid is valid", () => {
    it("returns valid for first bid at starting price", () => {
      const result = isValidBidAmount(10, null, 10);
      expect(result.valid).toBe(true);
    });

    it("returns valid for bid above minimum", () => {
      const result = isValidBidAmount(100, 50, 10);
      expect(result.valid).toBe(true);
    });

    it("returns valid for bid at exact minimum increment", () => {
      const result = isValidBidAmount(51, 50, 10);
      expect(result.valid).toBe(true);
    });
  });

  describe("when bid is not a whole dollar", () => {
    it("returns invalid for decimal amounts", () => {
      const result = isValidBidAmount(10.5, null, 10);
      expect(result.valid).toBe(false);
      expect(result.message).toContain("whole dollar");
    });
  });
});

// ============================================================================
// calculateSellerReputation Tests
// ============================================================================

describe("calculateSellerReputation", () => {
  describe("new seller with no ratings", () => {
    it("returns 0% and neutral", () => {
      const result = calculateSellerReputation(0, 0);
      expect(result.percentage).toBe(0);
      expect(result.reputation).toBe("neutral");
    });
  });

  describe("villain territory (<50%)", () => {
    it("returns villain for 0% positive", () => {
      const result = calculateSellerReputation(0, 10);
      expect(result.percentage).toBe(0);
      expect(result.reputation).toBe("villain");
    });

    it("returns villain for 49% positive", () => {
      const result = calculateSellerReputation(49, 51);
      expect(result.percentage).toBe(49);
      expect(result.reputation).toBe("villain");
    });
  });

  describe("neutral territory (50-79%)", () => {
    it("returns neutral for 50% positive", () => {
      const result = calculateSellerReputation(50, 50);
      expect(result.percentage).toBe(50);
      expect(result.reputation).toBe("neutral");
    });

    it("returns neutral for 79% positive", () => {
      const result = calculateSellerReputation(79, 21);
      expect(result.percentage).toBe(79);
      expect(result.reputation).toBe("neutral");
    });
  });

  describe("hero territory (80%+)", () => {
    it("returns hero for 80% positive", () => {
      const result = calculateSellerReputation(80, 20);
      expect(result.percentage).toBe(80);
      expect(result.reputation).toBe("hero");
    });

    it("returns hero for 100% positive", () => {
      const result = calculateSellerReputation(100, 0);
      expect(result.percentage).toBe(100);
      expect(result.reputation).toBe("hero");
    });
  });
});

// ============================================================================
// formatTimeRemaining Tests
// ============================================================================

describe("formatTimeRemaining", () => {
  it('returns "Ended" for past dates', () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    expect(formatTimeRemaining(pastDate)).toBe("Ended");
  });

  it("formats days and hours correctly", () => {
    const futureDate = new Date(
      Date.now() + 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000
    ).toISOString();
    const result = formatTimeRemaining(futureDate);
    expect(result).toMatch(/2d 3h|2d 2h/); // Allow for timing variance
  });

  it("formats hours and minutes when under a day", () => {
    const futureDate = new Date(Date.now() + 5 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString();
    const result = formatTimeRemaining(futureDate);
    expect(result).toMatch(/5h \d+m/);
  });

  it("formats minutes and seconds when under an hour", () => {
    const futureDate = new Date(Date.now() + 15 * 60 * 1000 + 30 * 1000).toISOString();
    const result = formatTimeRemaining(futureDate);
    expect(result).toMatch(/15m \d+s|14m \d+s/);
  });

  it("formats seconds only when under a minute", () => {
    const futureDate = new Date(Date.now() + 30 * 1000).toISOString();
    const result = formatTimeRemaining(futureDate);
    expect(result).toMatch(/\d+s/);
    expect(result).not.toContain("m");
  });
});

// ============================================================================
// formatPrice Tests
// ============================================================================

describe("formatPrice", () => {
  it('returns "-" for null', () => {
    expect(formatPrice(null)).toBe("-");
  });

  it("formats whole numbers with .00", () => {
    expect(formatPrice(100)).toBe("$100.00");
  });

  it("formats thousands with commas", () => {
    expect(formatPrice(1000)).toBe("$1,000.00");
    expect(formatPrice(1000000)).toBe("$1,000,000.00");
  });

  it("handles decimal values", () => {
    expect(formatPrice(10.99)).toBe("$10.99");
  });
});
