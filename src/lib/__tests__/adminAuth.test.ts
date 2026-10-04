/**
 * adminAuth.logAdminAction tests (M-AD6 / L-AD3)
 *
 * Audit logging is a permission/accountability primitive: low-impact actions
 * must never block the operation on a logging failure, but HIGH-impact
 * (irreversible) actions must re-throw so the caller can abort an unauditable
 * mutation. Sentry routing is best-effort and must not itself throw.
 */
const mockInsert = jest.fn();
const mockSingle = jest.fn();
const mockEq = jest.fn(() => ({ single: mockSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));

// Mock Clerk's server entry so the real (ESM) @clerk/backend isn't loaded.
jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn(async () => ({ userId: null })) }));

jest.mock("@upstash/redis", () => ({
  Redis: jest.fn().mockImplementation(() => ({ get: jest.fn(), set: jest.fn(), del: jest.fn() })),
}));

jest.mock("../redis", () => ({ redis: null, isRedisAvailable: () => false }));

jest.mock("../supabase", () => ({
  supabase: { from: jest.fn() },
  supabaseAdmin: { from: jest.fn(() => ({ insert: mockInsert, select: mockSelect })) },
}));

// db.ts is imported by adminAuth for isUserSuspended; stub it out.
jest.mock("../db", () => ({ getProfileByClerkId: jest.fn() }));

const mockCaptureException = jest.fn();
jest.mock("@sentry/nextjs", () => ({ captureException: (...args: unknown[]) => mockCaptureException(...args) }));

import { getAdminProfileByUserId, isPayingSubscriber, logAdminAction } from "../adminAuth";

describe("logAdminAction", () => {
  beforeEach(() => {
    mockInsert.mockReset().mockResolvedValue({ error: null });
    mockCaptureException.mockReset();
  });

  it("inserts an audit row with the expected shape", async () => {
    await logAdminAction("admin-1", "grant_premium", "user-9", { days: 30 });
    expect(mockInsert).toHaveBeenCalledWith({
      admin_id: "admin-1",
      action: "grant_premium",
      target_user_id: "user-9",
      details: { days: 30 },
    });
  });

  it("defaults missing target/details to null", async () => {
    await logAdminAction("admin-1", "search_users");
    expect(mockInsert).toHaveBeenCalledWith({
      admin_id: "admin-1",
      action: "search_users",
      target_user_id: null,
      details: null,
    });
  });

  it("swallows a logging failure for a low-impact action", async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: "boom" } });
    await expect(logAdminAction("admin-1", "view_profile", "user-9")).resolves.toBeUndefined();
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });

  it("re-throws a logging failure for a high-impact action (suspend)", async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: "db down" } });
    await expect(logAdminAction("admin-1", "suspend", "user-9")).rejects.toBeDefined();
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });

  it("re-throws when the insert call itself throws on a high-impact action", async () => {
    mockInsert.mockRejectedValueOnce(new Error("network"));
    await expect(logAdminAction("admin-1", "delete_key_comic")).rejects.toThrow("network");
  });

  it("does not throw when the insert call throws on a low-impact action", async () => {
    mockInsert.mockRejectedValueOnce(new Error("network"));
    await expect(logAdminAction("admin-1", "approve_barcode", "bc-1")).resolves.toBeUndefined();
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});

/**
 * L-AD5: comp grant guard. A comp must never overwrite an active paying
 * customer's Stripe-managed billing dates. `isPayingSubscriber` is the pure
 * predicate that drives the guard inside grantPremiumAccess.
 */
describe("isPayingSubscriber", () => {
  it("treats a live stripe_subscription_id as paying", () => {
    expect(isPayingSubscriber({ stripe_subscription_id: "sub_123" })).toBe(true);
  });

  it("treats a real paid subscription_source as paying", () => {
    expect(isPayingSubscriber({ subscription_source: "stripe" })).toBe(true);
  });

  it("does not treat a comped source as paying", () => {
    expect(isPayingSubscriber({ subscription_source: "comped" })).toBe(false);
  });

  it("does not treat a trial source as paying", () => {
    expect(isPayingSubscriber({ subscription_source: "trial" })).toBe(false);
  });

  it("does not treat an empty profile as paying", () => {
    expect(isPayingSubscriber({})).toBe(false);
    expect(isPayingSubscriber({ stripe_subscription_id: null, subscription_source: null })).toBe(false);
  });
});

/**
 * Middleware-safe admin gate: takes the userId from clerkMiddleware's own
 * `auth` callback argument (the server `auth()` import throws in middleware).
 */
describe("getAdminProfileByUserId", () => {
  const adminRow = { id: "p-1", clerk_user_id: "user_admin", email: "a@x.com", is_admin: true };

  beforeEach(() => {
    mockSingle.mockReset();
    mockEq.mockClear();
    mockSelect.mockClear();
  });

  it("returns null without querying when userId is missing", async () => {
    await expect(getAdminProfileByUserId(null)).resolves.toBeNull();
    await expect(getAdminProfileByUserId(undefined)).resolves.toBeNull();
    await expect(getAdminProfileByUserId("")).resolves.toBeNull();
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns the profile for an admin, querying by clerk_user_id", async () => {
    mockSingle.mockResolvedValueOnce({ data: adminRow, error: null });
    await expect(getAdminProfileByUserId("user_admin")).resolves.toEqual(adminRow);
    expect(mockEq).toHaveBeenCalledWith("clerk_user_id", "user_admin");
  });

  it("returns null for a non-admin profile", async () => {
    mockSingle.mockResolvedValueOnce({ data: { ...adminRow, is_admin: false }, error: null });
    await expect(getAdminProfileByUserId("user_admin")).resolves.toBeNull();
  });

  it("returns null when the profile is missing", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(getAdminProfileByUserId("user_ghost")).resolves.toBeNull();
  });

  it("returns null (fails closed) on a lookup error", async () => {
    mockSingle.mockResolvedValueOnce({ data: adminRow, error: { message: "db down" } });
    await expect(getAdminProfileByUserId("user_admin")).resolves.toBeNull();
  });
});
