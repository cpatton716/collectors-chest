import {
  FREE_MONTHLY_SCAN_LIMIT,
  GUEST_SCAN_LIMIT,
  NON_ACTIVE_STRIPE_STATUSES,
  SCAN_PACK_AMOUNT,
  UNLIMITED_SCANS,
  calculatePlatformFee,
  deriveAccessState,
  deriveCanScan,
  deriveScansRemaining,
  getTransactionFeePercent,
  hasLiveSubscription,
  mapStripeSubscriptionStatus,
  pickProfileByStripeCustomerId,
} from "../subscription";
import {
  FREE_FEE_PERCENT,
  PREMIUM_FEE_PERCENT,
  computePlatformFeeCents,
  computePlatformFeeDollars,
  feePercentForTier,
} from "../stripeConnect";
import { mapStripeError } from "../stripe";
import { sign, verify } from "../signedToken";

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

// ============================================================================
// Comp / trial / paid access-state resolution (L-AD5 read side)
// ============================================================================

describe("deriveAccessState (L-AD5)", () => {
  it("comp'd user reads as premium + active, NOT trialing (even with a live trial window)", () => {
    const state = deriveAccessState({
      tier: "free",
      status: "trialing",
      trialActive: true, // admin grant populates trial_ends_at in the future
      compGranted: true,
    });
    expect(state.isPremium).toBe(true);
    expect(state.isTrialing).toBe(false);
    expect(state.isComp).toBe(true);
    expect(state.tier).toBe("premium");
    expect(state.status).toBe("active");
  });

  it("comp flag wins even when the raw tier is already premium", () => {
    const state = deriveAccessState({
      tier: "premium",
      status: "active",
      trialActive: false,
      compGranted: true,
    });
    expect(state.isComp).toBe(true);
    expect(state.isPremium).toBe(true);
    expect(state.isTrialing).toBe(false);
  });

  it("non-comp free user with a live trial window reads as trialing", () => {
    const state = deriveAccessState({
      tier: "free",
      status: "trialing",
      trialActive: true,
      compGranted: false,
    });
    expect(state.isComp).toBe(false);
    expect(state.isTrialing).toBe(true);
    expect(state.isPremium).toBe(false);
    expect(state.tier).toBe("free");
  });

  it("non-comp free user with no trial window is plain free (no access)", () => {
    const state = deriveAccessState({
      tier: "free",
      status: "active",
      trialActive: false,
      compGranted: false,
    });
    expect(state.isComp).toBe(false);
    expect(state.isTrialing).toBe(false);
    expect(state.isPremium).toBe(false);
  });

  it("paying premium user is not reported as trialing even with a stale trial window", () => {
    const state = deriveAccessState({
      tier: "premium",
      status: "active",
      trialActive: true, // lingering trial_ends_at after conversion
      compGranted: false,
    });
    expect(state.isPremium).toBe(true);
    expect(state.isTrialing).toBe(false);
    expect(state.isComp).toBe(false);
  });

  it("missing comp column (pre-migration => false) preserves prior trial behavior", () => {
    const state = deriveAccessState({
      tier: "free",
      status: "trialing",
      trialActive: true,
      compGranted: false, // column absent reads as false at the call site
    });
    expect(state.isTrialing).toBe(true);
    expect(state.isComp).toBe(false);
  });
});

// ============================================================================
// Stripe-customer-id multi-row disambiguation (M-PAY8)
// ============================================================================

describe("pickProfileByStripeCustomerId (M-PAY8)", () => {
  it("returns null for an empty list (zero-row match)", () => {
    expect(pickProfileByStripeCustomerId([])).toBeNull();
  });

  it("returns null for null/undefined input", () => {
    expect(pickProfileByStripeCustomerId(null)).toBeNull();
    expect(pickProfileByStripeCustomerId(undefined)).toBeNull();
  });

  it("returns the only row when exactly one matches", () => {
    const row = { id: "a", clerk_user_id: "ca" };
    expect(pickProfileByStripeCustomerId([row])).toBe(row);
  });

  it("picks the most-recently-updated row on a multi-row collision", () => {
    const older = {
      id: "old",
      clerk_user_id: "c-old",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const newer = {
      id: "new",
      clerk_user_id: "c-new",
      updated_at: "2026-06-01T00:00:00Z",
    };
    expect(pickProfileByStripeCustomerId([older, newer])?.id).toBe("new");
    // order-independent
    expect(pickProfileByStripeCustomerId([newer, older])?.id).toBe("new");
  });

  it("falls back to created_at when updated_at is absent", () => {
    const a = { id: "a", clerk_user_id: "ca", created_at: "2026-02-01T00:00:00Z" };
    const b = { id: "b", clerk_user_id: "cb", created_at: "2026-05-01T00:00:00Z" };
    expect(pickProfileByStripeCustomerId([a, b])?.id).toBe("b");
  });

  it("does not throw when timestamps are missing entirely", () => {
    const a = { id: "a", clerk_user_id: "ca" };
    const b = { id: "b", clerk_user_id: "cb" };
    expect(() => pickProfileByStripeCustomerId([a, b])).not.toThrow();
    expect(pickProfileByStripeCustomerId([a, b])).not.toBeNull();
  });
});

// ============================================================================
// Promo-trial token gate (L-PAY17)
//
// The billing/checkout route accepts ONLY a signed, QR-exclusive promo token and
// applies the 30-day trial when (and only when) the token verifies with the
// `promo-trial` purpose marker. These tests lock that gate predicate so a client
// can't fabricate a trial by POSTing `promoTrial: true` (the old hole). They use
// the same signedToken primitive the route uses; eligibility persistence
// (promo_trial_eligible) is a separate DB gate verified at runtime.
// ============================================================================

describe("promo-trial signed token gate (L-PAY17)", () => {
  const SECRET_NAME = "PROMO_TRIAL_SECRET";
  const PURPOSE = "promo-trial";
  const original = process.env[SECRET_NAME];
  const originalClerk = process.env.CLERK_SECRET_KEY;

  // Mirror the route's predicate exactly.
  const accepted = (token: string | undefined): boolean => {
    if (!token) return false;
    const r = verify<{ purpose?: string }>(token, SECRET_NAME);
    return r.valid && r.payload?.purpose === PURPOSE;
  };

  beforeAll(() => {
    process.env[SECRET_NAME] = "promo-secret-under-test";
    process.env.CLERK_SECRET_KEY = "clerk-fallback";
  });

  afterAll(() => {
    if (original === undefined) delete process.env[SECRET_NAME];
    else process.env[SECRET_NAME] = original;
    if (originalClerk === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = originalClerk;
  });

  it("accepts a properly signed QR token carrying the promo-trial purpose", () => {
    const token = sign({ purpose: PURPOSE, exp: Date.now() + 60_000 }, SECRET_NAME);
    expect(accepted(token)).toBe(true);
  });

  it("rejects a missing/empty token (no client-set promoTrial possible)", () => {
    expect(accepted(undefined)).toBe(false);
    expect(accepted("")).toBe(false);
  });

  it("rejects a forged/unsigned token", () => {
    expect(accepted("not-a-real-token")).toBe(false);
    expect(accepted("eyJwdXJwb3NlIjoicHJvbW8tdHJpYWwifQ.bogus")).toBe(false);
  });

  it("rejects a token signed with the wrong secret", () => {
    const token = sign({ purpose: PURPOSE }, "SOME_OTHER_SECRET_THAT_RESOLVES_DIFFERENTLY");
    // Sign with a deliberately different resolved secret value.
    process.env.SOME_OTHER_SECRET_THAT_RESOLVES_DIFFERENTLY = "different-secret";
    const tokenWrong = sign({ purpose: PURPOSE }, "SOME_OTHER_SECRET_THAT_RESOLVES_DIFFERENTLY");
    expect(accepted(tokenWrong)).toBe(false);
    delete process.env.SOME_OTHER_SECRET_THAT_RESOLVES_DIFFERENTLY;
    // (token unused intentionally; first sign fell back to clerk secret)
    expect(token).toBeDefined();
  });

  it("rejects a validly signed token with the WRONG purpose", () => {
    const token = sign({ purpose: "unsubscribe", exp: Date.now() + 60_000 }, SECRET_NAME);
    expect(accepted(token)).toBe(false);
  });

  it("rejects an expired promo token", () => {
    const token = sign({ purpose: PURPOSE, exp: Date.now() - 1 }, SECRET_NAME);
    expect(accepted(token)).toBe(false);
  });

  it("rejects a token whose payload was tampered after signing", () => {
    const token = sign({ purpose: "free", exp: Date.now() + 60_000 }, SECRET_NAME);
    const [, sig] = token.split(".");
    // Swap in a promo-trial payload but keep the old signature.
    const forgedPayload = Buffer.from(JSON.stringify({ purpose: PURPOSE }), "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(accepted(`${forgedPayload}.${sig}`)).toBe(false);
  });
});
