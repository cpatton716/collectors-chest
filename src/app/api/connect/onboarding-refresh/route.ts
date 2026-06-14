import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";

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

  // M-PAY12: require auth and confirm the account belongs to the caller before
  // minting an onboarding link for it.
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const parsed = onboardingRefreshQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.redirect(new URL("/profile?connect=error", req.url));
  }
  const accountId = parsed.data.account_id;

  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_connect_account_id")
      .eq("clerk_user_id", userId)
      .maybeSingle();

    if (!profile || profile.stripe_connect_account_id !== accountId) {
      return NextResponse.redirect(new URL("/profile?connect=error", req.url));
    }

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
