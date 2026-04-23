import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import Stripe from "stripe";

import { getAuction } from "@/lib/auctionDb";
import { getProfileByClerkId } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import { calculateDestinationAmount } from "@/lib/stripeConnect";
import { schemas, validateBody } from "@/lib/validation";

// Either auctionId OR listingId (both accepted; listingId takes precedence for Buy Now).
const checkoutBodySchema = z
  .object({
    auctionId: schemas.uuid.optional(),
    listingId: schemas.uuid.optional(),
  })
  .strict()
  .refine((data) => data.auctionId || data.listingId, {
    message: "auctionId or listingId is required",
  });

// Initialize Stripe (conditionally - only if key exists)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
    })
  : null;

// POST - Create Stripe Checkout session for marketplace payment.
// Accepts EITHER `{ auctionId }` (auction winner flow) OR `{ listingId }` (Buy Now flow).
// Both paths validate the caller, the seller's Connect readiness, and return a Stripe
// session URL. The caller redirects the browser to that URL.
export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: "Payment system not configured" }, { status: 503 });
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Age verification gate (applies to all marketplace purchases)
    if (!profile.age_confirmed_at) {
      return NextResponse.json(
        {
          error: "AGE_VERIFICATION_REQUIRED",
          message: "You must confirm you are 18+ to use the marketplace.",
        },
        { status: 403 }
      );
    }

    const rawBody = await request.json().catch(() => null);
    const validatedBody = validateBody(checkoutBodySchema, rawBody);
    if (!validatedBody.success) return validatedBody.response;
    const { auctionId, listingId } = validatedBody.data;

    // listingId (Buy Now) takes precedence. auctionId is the legacy auction-winner path.
    const targetId: string = (listingId || auctionId) as string;
    const isBuyNow = !!listingId;

    const listing = await getAuction(targetId);
    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    // Buy Now validation: must be an active fixed_price listing, buyer != seller
    if (isBuyNow) {
      if (listing.listingType !== "fixed_price") {
        return NextResponse.json(
          { error: "This endpoint requires a fixed-price listing" },
          { status: 400 }
        );
      }
      if (listing.status !== "active") {
        return NextResponse.json(
          { error: "This listing is no longer available" },
          { status: 400 }
        );
      }
      if (listing.sellerId === profile.id) {
        return NextResponse.json(
          { error: "You cannot buy your own listing" },
          { status: 400 }
        );
      }
    } else {
      // Auction winner validation (legacy path)
      if (listing.winnerId !== profile.id) {
        return NextResponse.json(
          { error: "You are not the winner of this auction" },
          { status: 403 }
        );
      }
      if (listing.paymentStatus !== "pending") {
        return NextResponse.json(
          { error: "This auction is not awaiting payment" },
          { status: 400 }
        );
      }
      if (listing.paymentDeadline && new Date(listing.paymentDeadline) < new Date()) {
        return NextResponse.json(
          { error: "The payment window for this auction has expired" },
          { status: 400 }
        );
      }
    }

    // Fetch seller's Connect account
    const { data: sellerProfile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_onboarding_complete")
      .eq("id", listing.sellerId)
      .single();

    if (
      !sellerProfile?.stripe_connect_account_id ||
      !sellerProfile.stripe_connect_onboarding_complete
    ) {
      return NextResponse.json(
        { error: "Seller has not completed payment setup" },
        { status: 400 }
      );
    }

    // Fetch platform fee percent from the listing row
    const { data: listingRow } = await supabaseAdmin
      .from("auctions")
      .select("platform_fee_percent")
      .eq("id", targetId)
      .single();

    // Calculate total price:
    // - Buy Now: starting_price is the fixed price
    // - Auction: winningBid is the winning bid amount
    const basePrice = isBuyNow
      ? (listing.startingPrice || 0)
      : (listing.winningBid || 0);
    const total = basePrice + (listing.shippingCost || 0);
    const totalCents = Math.round(total * 100);
    const { sellerAmount } = calculateDestinationAmount(
      totalCents,
      listingRow?.platform_fee_percent || 8
    );

    // Stripe rejects product image URLs over 2048 chars (long Supabase signed
    // URLs can exceed this). The image is purely cosmetic on the Checkout
    // page — drop it rather than fail the session.
    const coverUrl = listing.comic?.coverImageUrl;
    const stripeImages =
      coverUrl && coverUrl.length <= 2048 && /^https?:\/\//.test(coverUrl)
        ? [coverUrl]
        : undefined;

    // Create Stripe checkout session.
    // Metadata carries full context so the webhook can dispatch to the right
    // handler without re-querying the DB first.
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${listing.comic?.comic?.title || "Comic"} #${listing.comic?.comic?.issueNumber || "?"}`,
              description: isBuyNow ? "Buy Now purchase - includes shipping" : "Auction winner - includes shipping",
              images: stripeImages,
            },
            unit_amount: totalCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_intent_data: {
        transfer_data: {
          destination: sellerProfile.stripe_connect_account_id,
          amount: sellerAmount,
        },
      },
      // On success, send the buyer to their Transactions page with the
      // purchase highlighted. On cancel, back to the listing so they can
      // retry without losing context.
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/transactions?tab=${isBuyNow ? "purchases" : "wins"}&purchased=${targetId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/shop?listing=${targetId}&payment=cancelled`,
      metadata: {
        // Legacy auction metadata (kept for backward-compat with in-flight sessions)
        auctionId: targetId,
        buyerId: profile.id,
        sellerId: listing.sellerId,
        // New flow indicator
        listingType: isBuyNow ? "buy_now" : "auction",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
