/**
 * @jest-environment node
 */

import {
  AVATAR_JPEG_QUALITY,
  AVATAR_TARGET_SIZE,
  formatBillingDate,
} from "../profileTabHelpers";

describe("profileTabHelpers", () => {
  describe("formatBillingDate", () => {
    it("returns an empty string for null", () => {
      expect(formatBillingDate(null)).toBe("");
    });

    it("formats a date as a long en-US month/day/year string", () => {
      // Use a UTC-noon timestamp so the local date is stable across timezones.
      const date = new Date("2026-01-13T12:00:00Z");
      expect(formatBillingDate(date)).toBe(
        date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      );
    });

    it("includes the full month name", () => {
      const date = new Date("2026-07-04T12:00:00Z");
      expect(formatBillingDate(date)).toContain("July");
    });
  });

  describe("avatar constants", () => {
    it("targets a 256px square avatar", () => {
      expect(AVATAR_TARGET_SIZE).toBe(256);
    });

    it("re-encodes avatars at 85% JPEG quality", () => {
      expect(AVATAR_JPEG_QUALITY).toBeCloseTo(0.85);
    });
  });
});
