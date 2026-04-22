import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import Stripe from "stripe";

import { getAuction } from "@/lib/auctionDb";
import { getProfileByClerkId } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import { calculateDestinationAmount } from "@/lib/stripeConnect";

// Initialize Stripe (conditionally - only if key exists)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
    })
  : null;

// POST - Create checkout session for auction payment
export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is configured
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

    // Age verification gate
    if (!profile.age_confirmed_at) {
      return NextResponse.json(
        { error: "AGE_VERIFICATION_REQUIRED", message: "You must confirm you are 18+ to use the marketplace." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { auctionId } = body;

    if (!auctionId) {
      return NextResponse.json({ error: "Auction ID is required" }, { status: 400 });
    }

    // Get auction details
    const auction = await getAuction(auctionId);
    if (!auction) {
      return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    }

    // Verify user is the winner
    if (auction.winnerId !== profile.id) {
      return NextResponse.json(
        { error: "You are not the winner of this auction" },
        { status: 403 }
      );
    }

    // Check payment status
    if (auction.paymentStatus !== "pending") {
      return NextResponse.json({ error: "This auction is not awaiting payment" }, { status: 400 });
    }

    // Fetch seller's Connect account
    const { data: sellerProfile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_onboarding_complete")
      .eq("id", auction.sellerId)
      .single();

    if (!sellerProfile?.stripe_connect_account_id || !sellerProfile.stripe_connect_onboarding_complete) {
      return NextResponse.json(
        { error: "Seller has not completed payment setup" },
        { status: 400 }
      );
    }

    // Fetch platform fee percent from the auction row
    const { data: auctionRow } = await supabaseAdmin
      .from("auctions")
      .select("platform_fee_percent")
      .eq("id", auctionId)
      .single();

    // Calculate total (winning bid + shipping)
    const total = (auction.winningBid || 0) + (auction.shippingCost || 0);
    const totalCents = Math.round(total * 100);
    const { sellerAmount } = calculateDestinationAmount(
      totalCents,
      auctionRow?.platform_fee_percent || 8
    );

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${auction.comic?.comic?.title || "Comic"} #${auction.comic?.comic?.issueNumber || "?"}`,
              description: `Auction winner - includes shipping`,
              images: auction.comic?.coverImageUrl ? [auction.comic.coverImageUrl] : undefined,
            },
            unit_amount: Math.round(total * 100), // Stripe expects cents
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
      // Redirect buyer to their collection after successful payment — they just bought a comic,
      // not a listing of their own, so /my-auctions (seller-view) would be confusing.
      // TODO: replace with /transactions once that page exists (see BACKLOG).
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/collection?purchase=success&auction=${auctionId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/shop?listing=${auctionId}&payment=cancelled`,
      metadata: {
        auctionId,
        buyerId: profile.id,
        sellerId: auction.sellerId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
