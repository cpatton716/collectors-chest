import {
  MIN_PLATFORM_FEE_CENTS,
  calculateDestinationAmount,
  isConnectOnboardingComplete,
  buildOnboardingReturnUrl,
  buildOnboardingRefreshUrl,
  shouldShowPremiumUpsell,
} from "../stripeConnect";

describe("stripeConnect", () => {
  describe("calculateDestinationAmount", () => {
    it("calculates seller amount for free tier (8% fee) on a $100 sale", () => {
      // $100 × 8% = $8.00 (above $0.75 floor) → percent-fee wins
      const result = calculateDestinationAmount(10000, 8);
      expect(result).toEqual({
        sellerAmount: 9200,
        platformFee: 800,
      });
    });

    it("calculates seller amount for premium tier (5% fee) on a $100 sale", () => {
      // $100 × 5% = $5.00 (above $0.75 floor) → percent-fee wins
      const result = calculateDestinationAmount(10000, 5);
      expect(result).toEqual({
        sellerAmount: 9500,
        platformFee: 500,
      });
    });

    it("rounds percent-fee down to nearest cent (seller-favorable) when above the floor", () => {
      // $20.07 × 8% = $1.6056 → floor($1.6056) = $1.60 (well above $0.75 floor)
      const result = calculateDestinationAmount(2007, 8);
      expect(result.platformFee).toBe(160);
      expect(result.sellerAmount).toBe(1847);
    });

    it("applies the $0.75 floor when 8% would yield less", () => {
      // $5.00 × 8% = $0.40 → floor wins → fee = $0.75
      const result = calculateDestinationAmount(500, 8);
      expect(result).toEqual({
        sellerAmount: 425,
        platformFee: 75,
      });
    });

    it("applies the $0.75 floor when 5% premium would yield less on a $10 sale", () => {
      // $10.00 × 5% = $0.50 → floor wins → fee = $0.75
      const result = calculateDestinationAmount(1000, 5);
      expect(result).toEqual({
        sellerAmount: 925,
        platformFee: 75,
      });
    });

    it("uses percent-fee at the 8% break-even (just above floor)", () => {
      // $9.38 × 8% = $0.7504 → floor($0.75) ties, percent-fee path is taken
      const result = calculateDestinationAmount(938, 8);
      expect(result.platformFee).toBe(75);
      expect(result.sellerAmount).toBe(863);
    });

    it("uses percent-fee at the 5% break-even (just above floor)", () => {
      // $15.00 × 5% = $0.75 → exactly the floor → either path gives the same answer
      const result = calculateDestinationAmount(1500, 5);
      expect(result.platformFee).toBe(75);
      expect(result.sellerAmount).toBe(1425);
    });

    it("never lets the platform fee exceed the sale total (seller payout never negative)", () => {
      // $0.50 sale × 8% = $0.04, floor would be $0.75 → cap at $0.50
      // Seller gets $0.00, platform gets $0.50. Stripe still loses money on this
      // sale, but the seller's payout is guaranteed non-negative.
      const result = calculateDestinationAmount(50, 8);
      expect(result).toEqual({
        sellerAmount: 0,
        platformFee: 50,
      });
    });

    it("handles zero amount", () => {
      const result = calculateDestinationAmount(0, 8);
      expect(result).toEqual({ sellerAmount: 0, platformFee: 0 });
    });

    it("exposes MIN_PLATFORM_FEE_CENTS as 75 (regression: floor must not be silently changed)", () => {
      expect(MIN_PLATFORM_FEE_CENTS).toBe(75);
    });
  });

  describe("isConnectOnboardingComplete", () => {
    it("returns true when account ID exists and onboarding is complete", () => {
      expect(isConnectOnboardingComplete("acct_123", true)).toBe(true);
    });

    it("returns false when account ID is missing", () => {
      expect(isConnectOnboardingComplete(null, true)).toBe(false);
    });

    it("returns false when onboarding is not complete", () => {
      expect(isConnectOnboardingComplete("acct_123", false)).toBe(false);
    });
  });

  describe("shouldShowPremiumUpsell", () => {
    it("returns true after 3rd sale for free tier", () => {
      expect(shouldShowPremiumUpsell("free", 3)).toBe(true);
    });

    it("returns true after 6th sale for free tier", () => {
      expect(shouldShowPremiumUpsell("free", 6)).toBe(true);
    });

    it("returns true after 9th sale for free tier", () => {
      expect(shouldShowPremiumUpsell("free", 9)).toBe(true);
    });

    it("returns false after 1st or 2nd sale", () => {
      expect(shouldShowPremiumUpsell("free", 1)).toBe(false);
      expect(shouldShowPremiumUpsell("free", 2)).toBe(false);
    });

    it("returns false after 4th or 5th sale", () => {
      expect(shouldShowPremiumUpsell("free", 4)).toBe(false);
      expect(shouldShowPremiumUpsell("free", 5)).toBe(false);
    });

    it("never triggers for premium tier", () => {
      expect(shouldShowPremiumUpsell("premium", 3)).toBe(false);
      expect(shouldShowPremiumUpsell("premium", 6)).toBe(false);
    });

    it("returns false for zero sales", () => {
      expect(shouldShowPremiumUpsell("free", 0)).toBe(false);
    });
  });

  describe("buildOnboardingReturnUrl", () => {
    it("builds return URL with account ID", () => {
      const url = buildOnboardingReturnUrl("https://example.com", "acct_123");
      expect(url).toBe("https://example.com/api/connect/onboarding-return?account_id=acct_123");
    });
  });

  describe("buildOnboardingRefreshUrl", () => {
    it("builds refresh URL with account ID", () => {
      const url = buildOnboardingRefreshUrl("https://example.com", "acct_123");
      expect(url).toBe("https://example.com/api/connect/onboarding-refresh?account_id=acct_123");
    });
  });
});
