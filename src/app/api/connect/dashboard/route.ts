import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
    })
  : null;

export async function POST() {
  try {
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_onboarding_complete")
      .eq("clerk_user_id", userId)
      .single();

    if (!profile?.stripe_connect_account_id || !profile.stripe_connect_onboarding_complete) {
      return NextResponse.json(
        { error: "Seller account not set up" },
        { status: 400 }
      );
    }

    const loginLink = await stripe.accounts.createLoginLink(
      profile.stripe_connect_account_id
    );

    return NextResponse.json({ url: loginLink.url });
  } catch (error) {
    console.error("Dashboard link error:", error);
    return NextResponse.json(
      { error: "Failed to create dashboard link" },
      { status: 500 }
    );
  }
}
