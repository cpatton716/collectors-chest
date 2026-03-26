import { describe, it, expect } from "@jest/globals";
import { shouldRedirectAway, getTrialAction, getPromoTrialAction } from "../choosePlanHelpers";

describe("choosePlanHelpers", () => {
  describe("shouldRedirectAway", () => {
    it("returns true for premium users", () => {
      expect(shouldRedirectAway("premium", false)).toBe(true);
    });

    it("returns true for trialing users", () => {
      expect(shouldRedirectAway("free", true)).toBe(true);
    });

    it("returns true for premium AND trialing users", () => {
      expect(shouldRedirectAway("premium", true)).toBe(true);
    });

    it("returns false for free non-trialing users", () => {
      expect(shouldRedirectAway("free", false)).toBe(false);
    });

    it("returns false for guest users", () => {
      expect(shouldRedirectAway("guest", false)).toBe(false);
    });
  });

  describe("getTrialAction", () => {
    it("returns startTrial when trial is available", () => {
      expect(getTrialAction(true)).toBe("startTrial");
    });

    it("returns stripeCheckout when trial is not available", () => {
      expect(getTrialAction(false)).toBe("stripeCheckout");
    });
  });

  describe("getPromoTrialAction", () => {
    it('returns "start_promo_checkout" when promo flag is true and trial not used', () => {
      expect(getPromoTrialAction(true, false, false)).toBe("start_promo_checkout");
    });

    it('returns "none" when promo flag is false', () => {
      expect(getPromoTrialAction(false, false, false)).toBe("none");
    });

    it('returns "none" when trial already used', () => {
      expect(getPromoTrialAction(true, true, false)).toBe("none");
    });

    it('returns "none" when already premium', () => {
      expect(getPromoTrialAction(true, false, true)).toBe("none");
    });
  });
});
