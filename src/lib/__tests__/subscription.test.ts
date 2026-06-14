import {
  FREE_MONTHLY_SCAN_LIMIT,
  GUEST_SCAN_LIMIT,
  NON_ACTIVE_STRIPE_STATUSES,
  SCAN_PACK_AMOUNT,
  UNLIMITED_SCANS,
  calculatePlatformFee,
  deriveCanScan,
  deriveScansRemaining,
  getTransactionFeePercent,
  hasLiveSubscription,
  mapStripeSubscriptionStatus,
} from "../subscription";
import {
  FREE_FEE_PERCENT,
  PREMIUM_FEE_PERCENT,
  computePlatformFeeCents,
  computePlatformFeeDollars,
  feePercentForTier,
} from "../stripeConnect";
import { mapStripeError } from "../stripe";

// ============================================================================
// Subscription Constants Tests
// ============================================================================

describe("Subscription Constants", () => {
  it("GUEST_SCAN_LIMIT is 5", () => {
    expect(GUEST_SCAN_LIMIT).toBe(5);
  });

  it("FREE_MONTHLY_SCAN_LIMIT is 10", () => {
    expect(FREE_MONTHLY_SCAN_LIMIT).toBe(10);
  });

  it("SCAN_PACK_AMOUNT is 10", () => {
    expect(SCAN_PACK_AMOUNT).toBe(10);
  });

  it("free users get double the guest scans per month", () => {
    expect(FREE_MONTHLY_SCAN_LIMIT).toBe(GUEST_SCAN_LIMIT * 2);
  });

  it("scan pack gives same amount as free monthly limit", () => {
    expect(SCAN_PACK_AMOUNT).toBe(FREE_MONTHLY_SCAN_LIMIT);
  });

  it("UNLIMITED_SCANS sentinel is a large fixed value", () => {
    expect(UNLIMITED_SCANS).toBe(999999);
  });
});

// ============================================================================
// Scans-remaining / canScan derivation (H-PAY3)
// ============================================================================

describe("deriveScansRemaining (H-PAY3)", () => {
  it("returns unlimited sentinel for premium users", () => {
    expect(
      deriveScansRemaining({ isPremium: true, isTrialing: false, scansUsed: 5, purchasedScans: 0 })
    ).toBe(UNLIMITED_SCANS);
  });

  it("returns unlimited sentinel for trialing users", () => {
    expect(
      deriveScansRemaining({ isPremium: false, isTrialing: true, scansUsed: 99, purchasedScans: 0 })
    ).toBe(UNLIMITED_SCANS);
  });

  it("subtracts used scans from the free monthly limit", () => {
    expect(
      deriveScansRemaining({ isPremium: false, isTrialing: false, scansUsed: 3, purchasedScans: 0 })
    ).toBe(FREE_MONTHLY_SCAN_LIMIT - 3);
  });

  it("adds purchased scans on top of the monthly allowance", () => {
    expect(
      deriveScansRemaining({ isPremium: false, isTrialing: false, scansUsed: 2, purchasedScans: 4 })
    ).toBe(FREE_MONTHLY_SCAN_LIMIT - 2 + 4);
  });

  it("never goes below zero on the monthly portion (over-limit)", () => {
    expect(
      deriveScansRemaining({ isPremium: false, isTrialing: false, scansUsed: 50, purchasedScans: 0 })
    ).toBe(0);
  });

  it("over-limit free user still gets their purchased scans", () => {
    expect(
      deriveScansRemaining({ isPremium: false, isTrialing: false, scansUsed: 50, purchasedScans: 3 })
    ).toBe(3);
  });

  it("clamps negative purchased scans to zero", () => {
    expect(
      deriveScansRemaining({ isPremium: false, isTrialing: false, scansUsed: 0, purchasedScans: -5 })
    ).toBe(FREE_MONTHLY_SCAN_LIMIT);
  });

  it("exactly at the limit yields zero remaining", () => {
    expect(
      deriveScansRemaining({
        isPremium: false,
        isTrialing: false,
        scansUsed: FREE_MONTHLY_SCAN_LIMIT,
        purchasedScans: 0,
      })
    ).toBe(0);
  });
});

describe("deriveCanScan (H-PAY3)", () => {
  it("premium can always scan even at zero remaining", () => {
    expect(deriveCanScan({ isPremium: true, isTrialing: false, scansRemaining: 0 })).toBe(true);
  });

  it("trialing can always scan even at zero remaining", () => {
    expect(deriveCanScan({ isPremium: false, isTrialing: true, scansRemaining: 0 })).toBe(true);
  });

  it("free user can scan when remaining > 0", () => {
    expect(deriveCanScan({ isPremium: false, isTrialing: false, scansRemaining: 1 })).toBe(true);
  });

  it("free user cannot scan at zero remaining", () => {
    expect(deriveCanScan({ isPremium: false, isTrialing: false, scansRemaining: 0 })).toBe(false);
  });
});

// ============================================================================
// Platform fee calculation - single consolidated source (M-PAY10)
// ============================================================================

describe("feePercentForTier (M-PAY10)", () => {
  it("premium pays the premium fee percent", () => {
    expect(feePercentForTier("premium")).toBe(PREMIUM_FEE_PERCENT);
  });

  it("trialing users pay the premium fee percent", () => {
    expect(feePercentForTier("free", true)).toBe(PREMIUM_FEE_PERCENT);
  });

  it("free pays the free fee percent", () => {
    expect(feePercentForTier("free")).toBe(FREE_FEE_PERCENT);
  });

  it("null/undefined tier defaults to the free fee percent", () => {
    expect(feePercentForTier(null)).toBe(FREE_FEE_PERCENT);
    expect(feePercentForTier(undefined)).toBe(FREE_FEE_PERCENT);
  });

  it("fee percents are 5 (premium) and 8 (free)", () => {
    expect(PREMIUM_FEE_PERCENT).toBe(5);
    expect(FREE_FEE_PERCENT).toBe(8);
  });
});

describe("computePlatformFeeCents (canonical, floored) (M-PAY10)", () => {
  it("floors the percent fee (seller-favorable)", () => {
    // $20.07 * 8% = 160.56 cents -> floor 160
    expect(computePlatformFeeCents(2007, 8)).toBe(160);
  });

  it("applies the $0.75 floor on small sales", () => {
    // $5.00 * 8% = 40c -> floored to 40, but min floor is 75c
    expect(computePlatformFeeCents(500, 8)).toBe(75);
  });

  it("never exceeds the sale total", () => {
    expect(computePlatformFeeCents(50, 8)).toBe(50);
  });

  it("returns 0 for zero or negative totals", () => {
    expect(computePlatformFeeCents(0, 8)).toBe(0);
    expect(computePlatformFeeCents(-100, 8)).toBe(0);
  });
});

describe("computePlatformFeeDollars (M-PAY10)", () => {
  it("converts a $100 / 8% sale to $8.00", () => {
    expect(computePlatformFeeDollars(100, 8)).toBe(8);
  });

  it("converts a $100 / 5% sale to $5.00", () => {
    expect(computePlatformFeeDollars(100, 5)).toBe(5);
  });

  it("applies the floor in dollars on a small sale", () => {
    // $5 * 8% = $0.40 -> floored to $0.75
    expect(computePlatformFeeDollars(5, 8)).toBe(0.75);
  });

  it("matches the cents helper exactly (consistency guarantee)", () => {
    const dollars = computePlatformFeeDollars(123.45, 8);
    const cents = computePlatformFeeCents(Math.round(123.45 * 100), 8);
    expect(Math.round(dollars * 100)).toBe(cents);
  });
});

describe("calculatePlatformFee / getTransactionFeePercent (DB-backed wrappers) (M-PAY10)", () => {
  // The mocked Supabase client returns no profile, so getSubscriptionStatus
  // resolves null and these fall through to the free-tier path. This verifies
  // the wrappers route through the canonical floored math (no ad-hoc rounding).

  it("getTransactionFeePercent defaults to the free percent for unknown profiles", async () => {
    expect(await getTransactionFeePercent("nobody")).toBe(FREE_FEE_PERCENT);
  });

  it("calculatePlatformFee on a $100 free-tier sale = $8 fee / $92 to seller", async () => {
    const result = await calculatePlatformFee("nobody", 100);
    expect(result.feePercent).toBe(FREE_FEE_PERCENT);
    expect(result.feeAmount).toBe(8);
    expect(result.sellerReceives).toBe(92);
  });

  it("calculatePlatformFee applies the floor on a small free-tier sale", async () => {
    // $5 * 8% = $0.40 -> floored up to the $0.75 minimum
    const result = await calculatePlatformFee("nobody", 5);
    expect(result.feeAmount).toBe(0.75);
    expect(result.sellerReceives).toBe(4.25);
  });
});

// ============================================================================
// Stripe subscription status mapping (M-PAY7 / M-PAY9)
// ============================================================================

describe("mapStripeSubscriptionStatus (M-PAY7 / M-PAY9)", () => {
  it("maps active -> active", () => {
    expect(mapStripeSubscriptionStatus("active")).toBe("active");
  });

  it("maps trialing -> trialing", () => {
    expect(mapStripeSubscriptionStatus("trialing")).toBe("trialing");
  });

  it("maps past_due -> past_due", () => {
    expect(mapStripeSubscriptionStatus("past_due")).toBe("past_due");
  });

  it("does NOT map incomplete to active (M-PAY7)", () => {
    const result = mapStripeSubscriptionStatus("incomplete");
    expect(result).not.toBe("active");
    expect(result).toBe("past_due");
  });

  it("maps incomplete_expired -> canceled (M-PAY7)", () => {
    expect(mapStripeSubscriptionStatus("incomplete_expired")).toBe("canceled");
  });

  it("does NOT map paused to active (M-PAY7)", () => {
    expect(mapStripeSubscriptionStatus("paused")).not.toBe("active");
  });

  it("maps canceled and unpaid -> canceled", () => {
    expect(mapStripeSubscriptionStatus("canceled")).toBe("canceled");
    expect(mapStripeSubscriptionStatus("unpaid")).toBe("canceled");
  });

  it("active + cancel_at_period_end -> canceled (M-PAY9)", () => {
    expect(mapStripeSubscriptionStatus("active", true)).toBe("canceled");
  });

  it("active without the cancel flag stays active (M-PAY9)", () => {
    expect(mapStripeSubscriptionStatus("active", false)).toBe("active");
  });

  it("unknown statuses fall back to active when not cancel-at-period-end", () => {
    expect(mapStripeSubscriptionStatus("something_new")).toBe("active");
  });

  it("NON_ACTIVE_STRIPE_STATUSES never map to active", () => {
    for (const s of NON_ACTIVE_STRIPE_STATUSES) {
      expect(mapStripeSubscriptionStatus(s)).not.toBe("active");
    }
  });
});

// ============================================================================
// Duplicate subscription guard (H-PAY2)
// ============================================================================

describe("hasLiveSubscription (H-PAY2)", () => {
  it("returns false for an empty list", () => {
    expect(hasLiveSubscription([])).toBe(false);
  });

  it("returns true when an active subscription exists", () => {
    expect(hasLiveSubscription([{ status: "active" }])).toBe(true);
  });

  it("returns true when a trialing subscription exists", () => {
    expect(hasLiveSubscription([{ status: "trialing" }])).toBe(true);
  });

  it("returns true for past_due (still live, would double-bill)", () => {
    expect(hasLiveSubscription([{ status: "past_due" }])).toBe(true);
  });

  it("returns true for incomplete (payment in progress)", () => {
    expect(hasLiveSubscription([{ status: "incomplete" }])).toBe(true);
  });

  it("returns false when only canceled/expired subscriptions exist", () => {
    expect(
      hasLiveSubscription([
        { status: "canceled" },
        { status: "incomplete_expired" },
        { status: "unpaid" },
      ])
    ).toBe(false);
  });

  it("returns true when at least one of many is live", () => {
    expect(
      hasLiveSubscription([{ status: "canceled" }, { status: "active" }])
    ).toBe(true);
  });
});

// ============================================================================
// Stripe error mapping (L-PAY18)
// ============================================================================

describe("mapStripeError (L-PAY18)", () => {
  it("maps a generic non-Stripe error to a 500 with a safe message", () => {
    const result = mapStripeError(new Error("kaboom"));
    expect(result.status).toBe(500);
    expect(result.message).not.toContain("kaboom");
  });

  it("never leaks raw internal error text for unknown throwables", () => {
    const result = mapStripeError({ secret: "do-not-leak" });
    expect(result.status).toBe(500);
    expect(JSON.stringify(result)).not.toContain("do-not-leak");
  });
});
