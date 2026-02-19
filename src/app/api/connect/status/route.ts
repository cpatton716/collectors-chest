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
      .select("stripe_connect_account_id, stripe_connect_onboarding_complete, completed_sales_count")
      .eq("clerk_id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (!profile.stripe_connect_account_id) {
      return NextResponse.json({
        connected: false,
        onboardingComplete: false,
        completedSales: profile.completed_sales_count || 0,
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
    });
  } catch (error) {
    console.error("Connect status error:", error);
    return NextResponse.json(
      { error: "Failed to get seller status" },
      { status: 500 }
    );
  }
}
