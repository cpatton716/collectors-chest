import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
    })
  : null;

// Stripe Connect account IDs follow `acct_XXXX...` format (not a UUID).
const onboardingRefreshQuerySchema = z.object({
  account_id: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/^acct_[A-Za-z0-9]+$/, "Must be a valid Stripe account ID"),
});

export async function GET(req: NextRequest) {
  if (!stripe) {
    return NextResponse.redirect(new URL("/profile?connect=error", req.url));
  }

  const parsed = onboardingRefreshQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.redirect(new URL("/profile?connect=error", req.url));
  }
  const accountId = parsed.data.account_id;

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
