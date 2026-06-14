/**
 * Unit tests for the destination-charge financial reconciliation helper in the
 * Stripe webhook (M-MK16). Money path: verifies that platform fee + seller net
 * are read from Stripe's settled charge when present, and fall back to a local
 * estimate (canonical fee math) when the charge carries no application fee.
 *
 * The webhook route pulls in a wide set of side-effectful server modules at
 * import time (email, auctionDb, db cache, etc.). We mock those to thin stubs
 * so the pure helper can be imported and exercised in isolation. `@/lib/stripe`
 * and `@/lib/stripeConnect` are intentionally NOT mocked: the helper relies on
 * the real `calculateDestinationAmount` fee math for the estimate path.
 */

// `next/server` references the Fetch API `Request` global at module-load time.
// The jsdom test environment does not expose it, so importing the route module
// throws "Request is not defined". We only need the *symbol* to exist for the
// import to succeed (the test never invokes the POST handler), so a thin stub
// is sufficient. Mirror Response/Headers for completeness.
if (typeof (globalThis as { Request?: unknown }).Request === "undefined") {
  (globalThis as { Request?: unknown }).Request = class {} as unknown;
}
if (typeof (globalThis as { Response?: unknown }).Response === "undefined") {
  (globalThis as { Response?: unknown }).Response = class {} as unknown;
}
if (typeof (globalThis as { Headers?: unknown }).Headers === "undefined") {
  (globalThis as { Headers?: unknown }).Headers = class {} as unknown;
}

jest.mock("@/lib/auctionDb", () => ({ createNotification: jest.fn() }));
jest.mock("@/lib/auditLog", () => ({ logAuctionAuditEvent: jest.fn() }));
jest.mock("@/lib/creatorCreditsDb", () => ({ createFeedbackReminders: jest.fn() }));
jest.mock("@/lib/email", () => ({
  getProfileForEmail: jest.fn(),
  sendNotificationEmail: jest.fn(),
}));
jest.mock("@/lib/cache", () => ({
  isWebhookProcessed: jest.fn(),
  markWebhookProcessed: jest.fn(),
}));
jest.mock("@/lib/db", () => ({ invalidateProfileCacheByProfileId: jest.fn() }));

// `require` (not a hoisted `import`) so the Request/Response polyfill above runs
// FIRST - `next/server` does `class NextRequest extends Request` at module load,
// which throws on an undefined global. ESM imports are hoisted above runtime
// statements, so a lazy require is required to guarantee ordering.
const { extractChargeFinancials } = require("../route") as typeof import("../route");
const { MIN_PLATFORM_FEE_CENTS, calculateDestinationAmount } =
  require("@/lib/stripeConnect") as typeof import("@/lib/stripeConnect");

describe("extractChargeFinancials (M-MK16)", () => {
  describe("charge path - Stripe is authoritative", () => {
    it("reads application_fee + amount from the settled charge", () => {
      const result = extractChargeFinancials(
        { amount: 5000, amount_captured: 5000, application_fee_amount: 400 },
        9999, // estimate inputs must be ignored when the charge has a fee
        8
      );
      expect(result.source).toBe("charge");
      expect(result.grossCents).toBe(5000);
      expect(result.applicationFeeCents).toBe(400);
      expect(result.sellerNetCents).toBe(4600);
    });

    it("prefers amount_captured over amount when present (partial capture)", () => {
      const result = extractChargeFinancials(
        { amount: 5000, amount_captured: 3000, application_fee_amount: 300 },
        0,
        8
      );
      expect(result.grossCents).toBe(3000);
      expect(result.sellerNetCents).toBe(2700);
    });

    it("falls back to amount when amount_captured is zero/absent", () => {
      const result = extractChargeFinancials(
        { amount: 5000, amount_captured: 0, application_fee_amount: 250 },
        0,
        8
      );
      expect(result.grossCents).toBe(5000);
      expect(result.sellerNetCents).toBe(4750);
    });

    it("seller net + platform fee always reconcile to gross", () => {
      const result = extractChargeFinancials(
        { amount: 12345, amount_captured: 12345, application_fee_amount: 987 },
        0,
        8
      );
      expect(result.applicationFeeCents + result.sellerNetCents).toBe(result.grossCents);
    });
  });

  describe("estimate path - no settled application fee", () => {
    it("estimates from platform_fee_percent when charge is null", () => {
      const total = 5000;
      const result = extractChargeFinancials(null, total, 8);
      const { sellerAmount, platformFee } = calculateDestinationAmount(total, 8);
      expect(result.source).toBe("estimate");
      expect(result.grossCents).toBe(total);
      expect(result.applicationFeeCents).toBe(platformFee);
      expect(result.sellerNetCents).toBe(sellerAmount);
    });

    it("estimates when the charge carries no application_fee_amount (pre-M-MK16 transfer)", () => {
      const result = extractChargeFinancials(
        { amount: 5000, amount_captured: 5000, application_fee_amount: null },
        5000,
        5
      );
      expect(result.source).toBe("estimate");
      const { platformFee } = calculateDestinationAmount(5000, 5);
      expect(result.applicationFeeCents).toBe(platformFee);
    });

    it("applies the MIN_PLATFORM_FEE_CENTS floor on small estimated sales", () => {
      // $5.00 at 8% = 40c, below the 75c floor.
      const result = extractChargeFinancials(null, 500, 8);
      expect(result.applicationFeeCents).toBe(MIN_PLATFORM_FEE_CENTS);
      expect(result.sellerNetCents).toBe(500 - MIN_PLATFORM_FEE_CENTS);
    });

    it("clamps a negative estimate total to a zero-fee result", () => {
      const result = extractChargeFinancials(null, -100, 8);
      expect(result.grossCents).toBe(0);
      expect(result.applicationFeeCents).toBe(0);
      expect(result.sellerNetCents).toBe(0);
    });

    it("rounds a fractional estimate total before fee math", () => {
      const result = extractChargeFinancials(null, 1000.6, 8);
      expect(result.grossCents).toBe(1001);
    });
  });
});
