/**
 * Middleware admin-gate helper tests (M-AD2).
 *
 * `shouldGateAdminPath` decides which paths get the middleware's server-side
 * `is_admin` redirect gate. Admin PAGE routes (`/admin`, `/admin/*`) are gated
 * here as defense-in-depth with the admin layout; the admin JSON API
 * (`/api/admin/*`) authorizes inside its own handlers and is NOT page-gated.
 *
 * The heavy server deps (Clerk middleware factory, adminAuth → Supabase,
 * rate limiter) are mocked so importing the module under jsdom is side-effect
 * free and we can test the pure decision helper in isolation.
 */
jest.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: (handler: unknown) => handler,
  createRouteMatcher: () => () => false,
}));

jest.mock("next/server", () => ({
  NextResponse: { redirect: jest.fn() },
}));

jest.mock("@/lib/adminAuth", () => ({ getAdminProfile: jest.fn() }));

jest.mock("@/lib/rateLimit", () => ({
  checkRateLimit: jest.fn(),
  getRateLimitIdentifier: jest.fn(),
  rateLimiters: { lookup: {} },
}));

import { shouldGateAdminPath } from "../middleware";

describe("shouldGateAdminPath", () => {
  it("gates the admin index", () => {
    expect(shouldGateAdminPath("/admin")).toBe(true);
  });

  it("gates admin sub-pages", () => {
    expect(shouldGateAdminPath("/admin/clz-comparison")).toBe(true);
    expect(shouldGateAdminPath("/admin/usage")).toBe(true);
    expect(shouldGateAdminPath("/admin/nested/deep/path")).toBe(true);
  });

  it("does NOT gate the admin JSON API (handlers guard themselves)", () => {
    expect(shouldGateAdminPath("/api/admin")).toBe(false);
    expect(shouldGateAdminPath("/api/admin/usage")).toBe(false);
  });

  it("does NOT gate an /admin/api/* page-route edge case", () => {
    expect(shouldGateAdminPath("/admin/api/whatever")).toBe(false);
  });

  it("does NOT gate non-admin pages", () => {
    expect(shouldGateAdminPath("/")).toBe(false);
    expect(shouldGateAdminPath("/collection")).toBe(false);
    expect(shouldGateAdminPath("/scan")).toBe(false);
  });

  it("does NOT match a path that merely starts with the admin prefix word", () => {
    // "/administration" is a different route; the gate must not catch it.
    expect(shouldGateAdminPath("/administration")).toBe(false);
    expect(shouldGateAdminPath("/admins")).toBe(false);
  });
});
