import { NextResponse } from "next/server";

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { getAdminProfileByUserId } from "@/lib/adminAuth";
import {
  MARKETPLACE_ENABLED,
  isMarketplaceApiPath,
  isMarketplacePagePath,
  shouldRedirectShopTab,
} from "@/lib/features";
import { checkRateLimit, getRateLimitIdentifier, rateLimiters } from "@/lib/rateLimit";

// Define routes that require authentication.
// NOTE: `/api/analyze` is deliberately NOT here — guest scans are public, with
// the limit/CAPTCHA enforced server-side against the signed `cc_guest` cookie
// (H-SC3). Keeping analyze unprotected lets the route handler mint/set that
// cookie on the first guest scan without Clerk intercepting the request.
const isProtectedRoute = createRouteMatcher([
  // Admin routes require authentication
  "/admin(.*)",
  "/api/admin(.*)",
  // Billing routes require authentication
  "/api/billing(.*)",
  // User-specific routes
  "/api/watchlist(.*)",
  "/api/notifications(.*)",
  "/api/sharing(.*)",
  "/api/key-hunt(.*)",
  // Auction actions that require a user
  "/api/auctions/:id/bid(.*)",
  "/api/auctions/:id/buy-now(.*)",
]);

// Admin PAGE routes (not the JSON API, which guards itself in its handlers).
// These get an extra server-side `is_admin` check below as defense-in-depth
// alongside the admin layout's own server gate (M-AD2 / B5).
const isAdminPageRoute = createRouteMatcher(["/admin(.*)"]);

// Public AI-backed lookup endpoints — no auth, so rate limit at the edge to
// protect against abuse of the expensive AI/eBay calls behind them.
const isPublicAiLookupRoute = createRouteMatcher([
  "/api/titles/suggest(.*)",
  "/api/import-lookup(.*)",
  "/api/cover-candidates(.*)",
  "/api/comic-lookup(.*)",
  "/api/con-mode-lookup(.*)",
]);

/**
 * Pure helper: decide whether a path needs the middleware admin gate.
 * Admin PAGE routes (`/admin/*`) are gated here; the admin JSON API
 * (`/api/admin/*`) authorizes inside its own route handlers (richer 401/403
 * responses), so it's excluded from the page-redirect gate. Exported for tests.
 */
export function shouldGateAdminPath(pathname: string): boolean {
  return (
    pathname === "/admin" || (pathname.startsWith("/admin/") && !pathname.startsWith("/admin/api"))
  );
}

export default clerkMiddleware(async (auth, req) => {
  // Marketplace hidden (see src/lib/features.ts): 404 its APIs, redirect its pages.
  if (!MARKETPLACE_ENABLED) {
    const { pathname, searchParams } = req.nextUrl;
    if (isMarketplaceApiPath(pathname)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (isMarketplacePagePath(pathname)) {
      return NextResponse.redirect(new URL("/collection", req.url));
    }
    if (shouldRedirectShopTab(pathname, searchParams.get("tab"))) {
      return NextResponse.redirect(new URL("/shop?tab=for-trade", req.url));
    }
  }

  if (isPublicAiLookupRoute(req)) {
    const identifier = getRateLimitIdentifier(
      null,
      req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip")
    );
    const { success, response } = await checkRateLimit(rateLimiters.lookup, identifier);
    if (!success && response) return response;
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  // M-AD2: server-side is_admin gate for admin PAGE routes. auth.protect() above
  // already guarantees the user is signed in; here we additionally confirm they
  // are an admin and redirect non-admins to the homepage. Defense-in-depth with
  // the admin layout's own server gate (B5).
  if (isAdminPageRoute(req) && shouldGateAdminPath(req.nextUrl.pathname)) {
    // Must use the middleware callback's `auth` -- the server-side `auth()`
    // import (used by getAdminProfile) throws inside clerkMiddleware.
    const { userId } = await auth();
    const adminProfile = await getAdminProfileByUserId(userId);
    if (!adminProfile) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
