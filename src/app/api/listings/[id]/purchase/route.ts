import { NextResponse } from "next/server";

// DEPRECATED (Apr 22, 2026): Buy Now flow switched to direct-to-Stripe-Checkout.
// The old "reserve then pay" pattern was replaced with a single checkout call.
// Callers should now POST to /api/checkout with `{ listingId }` and redirect
// the user to the returned Stripe Checkout session URL.
//
// This handler remains to return a clear 410 Gone for any stale clients.
export async function POST() {
  return NextResponse.json(
    {
      error: "endpoint_deprecated",
      message: "This endpoint has been removed. Use POST /api/checkout with { listingId } instead.",
    },
    { status: 410 }
  );
}
