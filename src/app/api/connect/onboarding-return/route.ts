import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { invalidateProfileCacheByProfileId } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";

// Stripe Connect account IDs follow `acct_XXXX...` format (not a UUID).
const onboardingReturnQuerySchema = z.object({
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

  // M-PAY12: require authentication. Previously this route updated the profile
  // matching `account_id` with no auth, so any logged-out caller could flip
  // another seller's onboarding flag (IDOR). We now require a session and only
  // update the row owned by the authenticated user, AND verify the account_id
  // actually belongs to that user.
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const parsed = onboardingReturnQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.redirect(new URL("/profile?connect=error", req.url));
  }
  const accountId = parsed.data.account_id;

  try {
    // Confirm the Connect account belongs to the authenticated user before we
    // touch anything.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, stripe_connect_account_id")
      .eq("clerk_user_id", userId)
      .maybeSingle();

    if (!profile || profile.stripe_connect_account_id !== accountId) {
      return NextResponse.redirect(new URL("/profile?connect=error", req.url));
    }

    const account = await stripe.accounts.retrieve(accountId);
    const isComplete = account.charges_enabled && account.details_submitted;

    // Filter the update by the authenticated user's own id (M-PAY12).
    await supabaseAdmin
      .from("profiles")
      .update({ stripe_connect_onboarding_complete: isComplete })
      .eq("id", profile.id);

    await invalidateProfileCacheByProfileId(profile.id); // M-PAY11

    const status = isComplete ? "success" : "incomplete";
    return NextResponse.redirect(
      new URL(`/profile?connect=${status}`, req.url)
    );
  } catch (error) {
    console.error("Onboarding return error:", error);
    return NextResponse.redirect(new URL("/profile?connect=error", req.url));
  }
}
