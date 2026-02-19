import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
    })
  : null;

export async function POST(req: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, stripe_connect_account_id, stripe_connect_onboarding_complete")
      .eq("clerk_id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // If already has a complete Connect account, return early
    if (profile.stripe_connect_account_id && profile.stripe_connect_onboarding_complete) {
      return NextResponse.json({ alreadyComplete: true });
    }

    let accountId = profile.stripe_connect_account_id;

    // Create Connect Express account if none exists
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: profile.email,
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          profile_id: profile.id,
        },
      });
      accountId = account.id;

      // Save to profile
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_connect_account_id: accountId })
        .eq("id", profile.id);
    }

    // Create onboarding link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/api/connect/onboarding-refresh?account_id=${accountId}`,
      return_url: `${baseUrl}/api/connect/onboarding-return?account_id=${accountId}`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error("Connect account creation error:", error);
    return NextResponse.json(
      { error: "Failed to create seller account" },
      { status: 500 }
    );
  }
}
