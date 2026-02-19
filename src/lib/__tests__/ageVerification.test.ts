import { isAgeVerified, isAgeVerificationError, FREE_LISTING_LIMIT } from "../ageVerification";

describe("ageVerification helpers", () => {
  describe("isAgeVerified", () => {
    it("returns true when age_confirmed_at is set", () => {
      expect(isAgeVerified({ age_confirmed_at: "2026-01-01T00:00:00Z" })).toBe(true);
    });

    it("returns false when age_confirmed_at is null", () => {
      expect(isAgeVerified({ age_confirmed_at: null })).toBe(false);
    });

    it("returns false when age_confirmed_at is undefined", () => {
      expect(isAgeVerified({ age_confirmed_at: undefined })).toBe(false);
    });

    it("returns false when profile is null", () => {
      expect(isAgeVerified(null)).toBe(false);
    });
  });

  describe("isAgeVerificationError", () => {
    it("returns true for AGE_VERIFICATION_REQUIRED error", () => {
      expect(isAgeVerificationError({ error: "AGE_VERIFICATION_REQUIRED" })).toBe(true);
    });

    it("returns false for other errors", () => {
      expect(isAgeVerificationError({ error: "CONNECT_REQUIRED" })).toBe(false);
    });

    it("returns false for non-error responses", () => {
      expect(isAgeVerificationError({ success: true })).toBe(false);
    });

    it("returns false for null/undefined", () => {
      expect(isAgeVerificationError(null)).toBe(false);
      expect(isAgeVerificationError(undefined)).toBe(false);
    });
  });

  describe("FREE_LISTING_LIMIT", () => {
    it("is 3", () => {
      expect(FREE_LISTING_LIMIT).toBe(3);
    });
  });
});
