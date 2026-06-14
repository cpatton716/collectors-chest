/**
 * guestScanToken tests (H-SC3 / M-SC4) — guest scan limits & security helper.
 *
 * Covers: signed-cookie round-trip, tampered-cookie rejection, missing-secret
 * behavior, Redis key shape + monthly TTL constant, effective-allowance clamp
 * (over-grant rejected), and the boundary limit / captcha-threshold logic.
 *
 * @jest-environment node
 */
import {
  GUEST_COOKIE_NAME,
  GUEST_SCAN_TTL_SECONDS,
  effectiveGuestAllowance,
  evaluateGuestScan,
  guestBonusKey,
  guestScanKey,
  issueGuestToken,
  signGuestCookie,
  verifyGuestCookie,
} from "../guestScanToken";

describe("guestScanToken", () => {
  const originalClerk = process.env.CLERK_SECRET_KEY;
  const originalGuest = process.env.GUEST_SCAN_SECRET;

  beforeEach(() => {
    delete process.env.GUEST_SCAN_SECRET;
    process.env.CLERK_SECRET_KEY = "clerk-test-secret";
  });

  afterAll(() => {
    if (originalClerk === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = originalClerk;
    if (originalGuest === undefined) delete process.env.GUEST_SCAN_SECRET;
    else process.env.GUEST_SCAN_SECRET = originalGuest;
  });

  describe("cookie sign/verify", () => {
    it("issues a non-empty opaque id", () => {
      const id = issueGuestToken();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(16);
      expect(id).not.toContain("-");
    });

    it("round-trips: sign → verify returns the id", () => {
      const id = issueGuestToken();
      const cookie = signGuestCookie(id);
      expect(verifyGuestCookie(cookie)).toBe(id);
    });

    it("rejects a tampered cookie", () => {
      const cookie = signGuestCookie("guest-1");
      const tampered = cookie.slice(0, -3) + "xyz";
      expect(verifyGuestCookie(tampered)).toBeNull();
    });

    it("rejects null / empty cookie", () => {
      expect(verifyGuestCookie(null)).toBeNull();
      expect(verifyGuestCookie("")).toBeNull();
      expect(verifyGuestCookie(undefined)).toBeNull();
    });

    it("rejects a cookie signed with a different secret", () => {
      const cookie = signGuestCookie("guest-1");
      process.env.CLERK_SECRET_KEY = "rotated-secret";
      expect(verifyGuestCookie(cookie)).toBeNull();
    });

    it("exposes a stable cookie name", () => {
      expect(GUEST_COOKIE_NAME).toBe("cc_guest");
    });
  });

  describe("redis key + TTL math", () => {
    it("builds a namespaced scan key", () => {
      expect(guestScanKey("abc")).toBe("guest:scans:abc");
    });

    it("builds a namespaced bonus key", () => {
      expect(guestBonusKey("abc")).toBe("guest:bonus:abc");
    });

    it("uses a 30-day TTL", () => {
      expect(GUEST_SCAN_TTL_SECONDS).toBe(60 * 60 * 24 * 30);
    });
  });

  describe("effectiveGuestAllowance (M-SC4 over-grant rejection)", () => {
    it("adds base + bonus when within ceiling", () => {
      expect(effectiveGuestAllowance(5, 5, 10)).toBe(10);
    });

    it("clamps an oversized stored bonus to maxBonus", () => {
      // A malicious/corrupt stored bonus of 9999 must not grant unlimited scans.
      expect(effectiveGuestAllowance(5, 9999, 5)).toBe(10);
    });

    it("treats negative or NaN bonus as zero", () => {
      expect(effectiveGuestAllowance(5, -3, 5)).toBe(5);
      expect(effectiveGuestAllowance(5, NaN, 5)).toBe(5);
    });

    it("never returns negative", () => {
      expect(effectiveGuestAllowance(0, 0, 5)).toBe(0);
    });
  });

  describe("evaluateGuestScan (boundary limit + captcha gate)", () => {
    const captchaThreshold = 3;
    const allowance = 5;

    it("allows the first scan with no captcha", () => {
      const r = evaluateGuestScan({ completed: 0, allowance, captchaThreshold });
      expect(r.allowed).toBe(true);
      expect(r.captchaRequired).toBe(false);
      expect(r.remaining).toBe(5);
    });

    it("requires captcha on the 4th scan (completed=3)", () => {
      const r = evaluateGuestScan({ completed: 3, allowance, captchaThreshold });
      expect(r.allowed).toBe(true);
      expect(r.captchaRequired).toBe(true);
      expect(r.remaining).toBe(2);
    });

    it("allows the last scan (completed=4) with captcha", () => {
      const r = evaluateGuestScan({ completed: 4, allowance, captchaThreshold });
      expect(r.allowed).toBe(true);
      expect(r.captchaRequired).toBe(true);
      expect(r.remaining).toBe(1);
    });

    it("blocks once the limit is reached (completed=5)", () => {
      const r = evaluateGuestScan({ completed: 5, allowance, captchaThreshold });
      expect(r.allowed).toBe(false);
      expect(r.captchaRequired).toBe(false);
      expect(r.remaining).toBe(0);
    });

    it("blocks beyond the limit and never reports negative remaining", () => {
      const r = evaluateGuestScan({ completed: 99, allowance, captchaThreshold });
      expect(r.allowed).toBe(false);
      expect(r.remaining).toBe(0);
    });
  });
});
