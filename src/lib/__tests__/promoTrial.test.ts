/**
 * @jest-environment node
 *
 * Node env so the unsubscribe route (which imports `next/server`) loads with the
 * Web `Request`/`Response` globals present. The client localStorage helpers are
 * exercised against a small polyfilled `window`/`localStorage` (below).
 */
// Mock Resend before any imports — `tallySubmissionCounts` lives in keyComicsDb,
// which transitively imports email.ts (which constructs a Resend client at
// module load and throws without a key). Mirrors the project's email tests.
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: "test-id" }, error: null }),
    },
    contacts: { create: jest.fn().mockResolvedValue({}) },
  })),
}));
process.env.RESEND_API_KEY = "test-key";

import {
  PROMO_TRIAL_DAYS,
  PROMO_TRIAL_STORAGE_KEY,
  setPromoTrialFlag,
  getPromoTrialFlag,
  clearPromoTrialFlag,
  PROMO_TRIAL_PURPOSE,
  PROMO_TRIAL_SECRET_NAME,
  consumePromoTrialEligibility,
  isMissingPromoColumnError,
  isPromoTrialEligible,
  mintPromoTrialToken,
  verifyPromoTrialToken,
} from "../promoTrial";
import { verify as verifySignedToken, sign as signSignedToken } from "../signedToken";
import { tallySubmissionCounts } from "../keyComicsDb";
import {
  buildUnsubscribeUrl,
  mintUnsubscribeToken,
  verifyUnsubscribeToken,
} from "@/app/api/unsubscribe/route";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

// Node test env has no `window`; the client helpers only check
// `typeof window !== "undefined"` and call `localStorage`, so a minimal global
// polyfill is enough to exercise them.
(globalThis as unknown as { window: unknown }).window = globalThis;
(globalThis as unknown as { localStorage: unknown }).localStorage = localStorageMock;

beforeEach(() => {
  localStorageMock.clear();
  jest.clearAllMocks();
});

describe("promoTrial constants", () => {
  it("has a 30-day trial period", () => {
    expect(PROMO_TRIAL_DAYS).toBe(30);
  });

  it("has a stable storage key", () => {
    expect(PROMO_TRIAL_STORAGE_KEY).toBe("cc_promo_trial");
  });
});

describe("setPromoTrialFlag", () => {
  it("sets a timestamp in localStorage", () => {
    const before = Date.now();
    setPromoTrialFlag();
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "cc_promo_trial",
      expect.any(String)
    );
    const storedValue = parseInt(localStorageMock.getItem("cc_promo_trial"), 10);
    expect(storedValue).toBeGreaterThanOrEqual(before);
    expect(storedValue).toBeLessThanOrEqual(Date.now());
  });
});

describe("getPromoTrialFlag", () => {
  it("returns true when flag is recent (within 7 days)", () => {
    setPromoTrialFlag();
    expect(getPromoTrialFlag()).toBe(true);
  });

  it("returns false when flag is not set", () => {
    expect(getPromoTrialFlag()).toBe(false);
  });

  it("returns false when flag is expired (older than 7 days)", () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    localStorageMock.setItem("cc_promo_trial", eightDaysAgo.toString());
    expect(getPromoTrialFlag()).toBe(false);
  });

  it("returns false for non-timestamp string values", () => {
    localStorageMock.setItem("cc_promo_trial", "true");
    expect(getPromoTrialFlag()).toBe(false);
  });
});

describe("clearPromoTrialFlag", () => {
  it("removes the flag from localStorage", () => {
    localStorageMock.setItem("cc_promo_trial", "true");
    clearPromoTrialFlag();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("cc_promo_trial");
  });
});

// ============================================================================
// SERVER layer — signed QR-exclusive promo-trial token (L-PAY17)
// ============================================================================

describe("promoTrial token (L-PAY17)", () => {
  const originalClerk = process.env.CLERK_SECRET_KEY;
  const originalPromo = process.env.PROMO_TRIAL_SECRET;

  beforeEach(() => {
    delete process.env.PROMO_TRIAL_SECRET;
    process.env.CLERK_SECRET_KEY = "clerk-test-secret";
  });

  afterAll(() => {
    if (originalClerk === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = originalClerk;
    if (originalPromo === undefined) delete process.env.PROMO_TRIAL_SECRET;
    else process.env.PROMO_TRIAL_SECRET = originalPromo;
  });

  it("mints a token that verifies", async () => {
    const token = await mintPromoTrialToken();
    await expect(verifyPromoTrialToken(token)).resolves.toBe(true);
  });

  it("carries the agreed purpose so B21's checkout gate accepts it", async () => {
    const token = await mintPromoTrialToken();
    const result = verifySignedToken<{ purpose?: string }>(token, PROMO_TRIAL_SECRET_NAME);
    expect(result.valid).toBe(true);
    expect(result.payload?.purpose).toBe(PROMO_TRIAL_PURPOSE);
  });

  it("rejects a null / empty / undefined token", async () => {
    await expect(verifyPromoTrialToken(null)).resolves.toBe(false);
    await expect(verifyPromoTrialToken("")).resolves.toBe(false);
    await expect(verifyPromoTrialToken(undefined)).resolves.toBe(false);
  });

  it("rejects a tampered payload (signature mismatch)", async () => {
    const token = await mintPromoTrialToken();
    const [payload, sig] = token.split(".");
    const decoded = Buffer.from(
      payload.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf8");
    const mutated = decoded.replace(PROMO_TRIAL_PURPOSE, "free-trial");
    const reEncoded = Buffer.from(mutated, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    await expect(verifyPromoTrialToken(`${reEncoded}.${sig}`)).resolves.toBe(false);
  });

  it("rejects a structurally-valid token whose purpose is wrong", async () => {
    const wrong = signSignedToken(
      { purpose: "something-else", iat: Date.now() },
      PROMO_TRIAL_SECRET_NAME
    );
    await expect(verifyPromoTrialToken(wrong)).resolves.toBe(false);
  });

  it("rejects an expired token, accepts one still in-window", async () => {
    const now = 1_000_000;
    const token = await mintPromoTrialToken({ ttlMs: 1000, now });
    await expect(verifyPromoTrialToken(token, now + 2000)).resolves.toBe(false);
    await expect(verifyPromoTrialToken(token, now + 500)).resolves.toBe(true);
  });
});

describe("promoTrial eligibility gate (migration-gated)", () => {
  function clientReturning(data: unknown, error: unknown) {
    const single = jest.fn(() => Promise.resolve({ data, error }));
    const selectEq = jest.fn(() => ({ single }));
    const select = jest.fn(() => ({ eq: selectEq }));
    const updateEq2 = jest.fn(() => Promise.resolve({ error }));
    const updateEq1 = jest.fn(() => ({ eq: updateEq2 }));
    const update = jest.fn(() => ({ eq: updateEq1 }));
    const from = jest.fn(() => ({ select, update }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { from } as any;
  }

  it("returns true when the column is present and the flag is set", async () => {
    const client = clientReturning({ promo_trial_eligible: true }, null);
    await expect(isPromoTrialEligible(client, "p1")).resolves.toBe(true);
  });

  it("returns false when the flag is unset (one-time already consumed)", async () => {
    const client = clientReturning({ promo_trial_eligible: false }, null);
    await expect(isPromoTrialEligible(client, "p1")).resolves.toBe(false);
  });

  it("FAILS CLOSED (false) pre-migration when the column is missing", async () => {
    const client = clientReturning(null, {
      code: "42703",
      message: "column promo_trial_eligible does not exist",
    });
    await expect(isPromoTrialEligible(client, "p1")).resolves.toBe(false);
  });

  it("recognizes missing-column error codes", () => {
    expect(isMissingPromoColumnError({ code: "42703" })).toBe(true);
    expect(isMissingPromoColumnError({ code: "PGRST204" })).toBe(true);
    expect(isMissingPromoColumnError({ message: "promo_trial_eligible nope" })).toBe(true);
    expect(isMissingPromoColumnError({ code: "23505" })).toBe(false);
    expect(isMissingPromoColumnError(null)).toBe(false);
  });

  it("consume is no-op-safe (does not throw) even pre-migration", async () => {
    const client = clientReturning(null, { code: "42703", message: "promo_trial_eligible" });
    await expect(consumePromoTrialEligibility(client, "p1")).resolves.toBeUndefined();
  });
});

// ============================================================================
// Unsubscribe token (M-EM4 route half) — exported from the unsubscribe route
// ============================================================================

describe("unsubscribe token (M-EM4 route half)", () => {
  const originalClerk = process.env.CLERK_SECRET_KEY;
  const originalUnsub = process.env.UNSUBSCRIBE_SECRET;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    delete process.env.UNSUBSCRIBE_SECRET;
    process.env.CLERK_SECRET_KEY = "clerk-test-secret";
    process.env.NEXT_PUBLIC_APP_URL = "https://example.test";
  });

  afterAll(() => {
    if (originalClerk === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = originalClerk;
    if (originalUnsub === undefined) delete process.env.UNSUBSCRIBE_SECRET;
    else process.env.UNSUBSCRIBE_SECRET = originalUnsub;
    if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it("round-trips profileId + category", () => {
    const token = mintUnsubscribeToken("profile-123", "marketing");
    expect(verifyUnsubscribeToken(token)).toEqual({
      profileId: "profile-123",
      category: "marketing",
    });
  });

  it("preserves a non-default category", () => {
    const token = mintUnsubscribeToken("profile-9", "social");
    expect(verifyUnsubscribeToken(token)?.category).toBe("social");
  });

  it("rejects a tampered token", () => {
    const token = mintUnsubscribeToken("profile-123", "marketing");
    const [payload] = token.split(".");
    expect(verifyUnsubscribeToken(`${payload}.deadbeef`)).toBeNull();
  });

  it("rejects null / empty / undefined tokens", () => {
    expect(verifyUnsubscribeToken(null)).toBeNull();
    expect(verifyUnsubscribeToken("")).toBeNull();
    expect(verifyUnsubscribeToken(undefined)).toBeNull();
  });

  it("rejects an expired token, accepts one in-window", () => {
    const now = 5_000_000;
    const token = mintUnsubscribeToken("p", "marketing", { ttlMs: 1000, now });
    expect(verifyUnsubscribeToken(token, now + 2000)).toBeNull();
    expect(verifyUnsubscribeToken(token, now + 500)).not.toBeNull();
  });

  it("builds an absolute one-click URL using NEXT_PUBLIC_APP_URL", () => {
    const url = buildUnsubscribeUrl("profile-7", "marketing");
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://example.test");
    expect(parsed.pathname).toBe("/api/unsubscribe");
    const token = parsed.searchParams.get("token");
    expect(token).toBeTruthy();
    expect(verifyUnsubscribeToken(token)).toEqual({
      profileId: "profile-7",
      category: "marketing",
    });
  });
});

// ============================================================================
// Submission-count tally helper (L-AD8)
// ============================================================================

describe("tallySubmissionCounts (L-AD8)", () => {
  it("tallies known statuses and derives total from row count", () => {
    const rows = [
      { status: "pending" },
      { status: "pending" },
      { status: "approved" },
      { status: "rejected" },
      { status: "rejected" },
      { status: "rejected" },
    ];
    expect(tallySubmissionCounts(rows)).toEqual({
      pending: 2,
      approved: 1,
      rejected: 3,
      total: 6,
    });
  });

  it("counts unknown / null statuses toward total only", () => {
    const rows = [{ status: "pending" }, { status: null }, { status: "weird" }];
    expect(tallySubmissionCounts(rows)).toEqual({
      pending: 1,
      approved: 0,
      rejected: 0,
      total: 3,
    });
  });

  it("returns zeros for an empty set", () => {
    expect(tallySubmissionCounts([])).toEqual({
      pending: 0,
      approved: 0,
      rejected: 0,
      total: 0,
    });
  });
});
