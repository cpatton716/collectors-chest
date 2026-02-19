import {
  calculateDestinationAmount,
  isConnectOnboardingComplete,
  buildOnboardingReturnUrl,
  buildOnboardingRefreshUrl,
  shouldShowPremiumUpsell,
} from "../stripeConnect";

describe("stripeConnect", () => {
  describe("calculateDestinationAmount", () => {
    it("calculates seller amount for free tier (8% fee)", () => {
      const result = calculateDestinationAmount(10000, 8);
      expect(result).toEqual({
        sellerAmount: 9200,
        platformFee: 800,
      });
    });

    it("calculates seller amount for premium tier (5% fee)", () => {
      const result = calculateDestinationAmount(10000, 5);
      expect(result).toEqual({
        sellerAmount: 9500,
        platformFee: 500,
      });
    });

    it("handles small amounts correctly", () => {
      const result = calculateDestinationAmount(500, 8);
      expect(result).toEqual({
        sellerAmount: 460,
        platformFee: 40,
      });
    });

    it("rounds fee down to nearest cent (seller-favorable)", () => {
      const result = calculateDestinationAmount(733, 8);
      expect(result.platformFee).toBe(58);
      expect(result.sellerAmount).toBe(675);
    });

    it("handles zero amount", () => {
      const result = calculateDestinationAmount(0, 8);
      expect(result).toEqual({ sellerAmount: 0, platformFee: 0 });
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
