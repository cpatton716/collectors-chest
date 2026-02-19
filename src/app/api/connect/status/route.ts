import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, subscription_tier, stripe_connect_account_id, stripe_connect_onboarding_complete, completed_sales_count")
      .eq("clerk_id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Calculate total fees paid from sold auctions
    const { data: soldAuctions } = await supabaseAdmin
      .from("auctions")
      .select("winning_bid, current_bid, starting_price, platform_fee_percent")
      .eq("seller_id", profile.id)
      .eq("status", "sold");

    const totalFeesPaid = (soldAuctions || []).reduce(
      (sum: number, auction: { winning_bid: number | null; current_bid: number | null; starting_price: number | null; platform_fee_percent: number | null }) => {
        const salePrice = auction.winning_bid || auction.current_bid || auction.starting_price || 0;
        const feePercent = auction.platform_fee_percent || 8;
        return sum + Math.round(salePrice * (feePercent / 100) * 100) / 100;
      },
      0
    );

    const subscriptionTier = profile.subscription_tier || "free";

    if (!profile.stripe_connect_account_id) {
      return NextResponse.json({
        connected: false,
        onboardingComplete: false,
        completedSales: profile.completed_sales_count || 0,
        totalFeesPaid,
        subscriptionTier,
      });
    }

    // Fetch live status from Stripe
    const account = await stripe.accounts.retrieve(
      profile.stripe_connect_account_id
    );

    const isComplete = account.charges_enabled && account.details_submitted;

    // Sync onboarding status if changed
    if (isComplete !== profile.stripe_connect_onboarding_complete) {
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_connect_onboarding_complete: isComplete })
        .eq("stripe_connect_account_id", profile.stripe_connect_account_id);
    }

    return NextResponse.json({
      connected: true,
      onboardingComplete: isComplete,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      completedSales: profile.completed_sales_count || 0,
      totalFeesPaid,
      subscriptionTier,
    });
  } catch (error) {
    console.error("Connect status error:", error);
    return NextResponse.json(
      { error: "Failed to get seller status" },
      { status: 500 }
    );
  }
}
