import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.redirect(new URL("/profile?connect=error", req.url));
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/api/connect/onboarding-refresh?account_id=${accountId}`,
      return_url: `${baseUrl}/api/connect/onboarding-return?account_id=${accountId}`,
      type: "account_onboarding",
    });

    return NextResponse.redirect(accountLink.url);
  } catch (error) {
    console.error("Onboarding refresh error:", error);
    return NextResponse.redirect(new URL("/profile?connect=error", req.url));
  }
}
