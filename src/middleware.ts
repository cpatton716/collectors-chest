import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { checkRateLimit, getRateLimitIdentifier, rateLimiters } from "@/lib/rateLimit";

// Define routes that require authentication
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

// Public AI-backed lookup endpoints — no auth, so rate limit at the edge to
// protect against abuse of the expensive AI/eBay calls behind them.
const isPublicAiLookupRoute = createRouteMatcher([
  "/api/titles/suggest(.*)",
  "/api/import-lookup(.*)",
  "/api/cover-candidates(.*)",
  "/api/comic-lookup(.*)",
  "/api/con-mode-lookup(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
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
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
