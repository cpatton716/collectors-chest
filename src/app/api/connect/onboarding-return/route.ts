import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
    })
  : null;

export async function GET(req: NextRequest) {
  if (!stripe) {
    return NextResponse.redirect(new URL("/profile?connect=error", req.url));
  }

  const accountId = req.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.redirect(new URL("/profile?connect=error", req.url));
  }

  try {
    const account = await stripe.accounts.retrieve(accountId);
    const isComplete = account.charges_enabled && account.details_submitted;

    await supabaseAdmin
      .from("profiles")
      .update({ stripe_connect_onboarding_complete: isComplete })
      .eq("stripe_connect_account_id", accountId);

    const status = isComplete ? "success" : "incomplete";
    return NextResponse.redirect(
      new URL(`/profile?connect=${status}`, req.url)
    );
  } catch (error) {
    console.error("Onboarding return error:", error);
    return NextResponse.redirect(new URL("/profile?connect=error", req.url));
  }
}
