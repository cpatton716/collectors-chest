import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import Stripe from "stripe";

import { isUserSuspended } from "@/lib/adminAuth";
import { getOrCreateProfile } from "@/lib/db";
import { verify as verifySignedToken } from "@/lib/signedToken";
import { mapStripeError, stripe } from "@/lib/stripe";
import {
  getSubscriptionStatus,
  hasLiveSubscription,
  hasUsedTrial,
  setStripeCustomerId,
} from "@/lib/subscription";
import { supabaseAdmin } from "@/lib/supabase";
import { validateBody } from "@/lib/validation";

/**
 * Env var holding the QR-exclusive promo-trial signing secret. Falls back to
 * CLERK_SECRET_KEY inside signedToken so no new required env var is forced.
 * The token is minted only by the QR distribution flow; the client cannot
 * fabricate it. L-PAY17.
 */
const PROMO_TRIAL_SECRET_NAME = "PROMO_TRIAL_SECRET";

/** Marker every valid promo-trial token must carry in its signed payload. */
const PROMO_TRIAL_PURPOSE = "promo-trial";

interface PromoTrialTokenPayload {
  purpose?: string;
  exp?: number;
  [key: string]: unknown;
}

/**
 * The promo trial is gated by a SIGNED, QR-exclusive token (verified server-side
 * via signedToken / B1) — a client can no longer mint a 30-day trial just by
 * POSTing `promoTrial: true` (the old L-PAY17 hole).
 *
 * The legacy boolean `promoTrial` is still ACCEPTED by the schema (existing
 * clients send it) but is treated as a NO-OP for authorization — it never
 * grants the trial. Only a valid `promoTrialToken` does. Keeping the field
 * accepted avoids breaking in-flight clients that still send it under `.strict`.
 */
const billingCheckoutBodySchema = z
  .object({
    priceType: z.enum(["monthly", "annual", "scan_pack"]),
    withTrial: z.boolean().optional(),
    /** Legacy, IGNORED for authorization. Accepted only for back-compat. */
    promoTrial: z.boolean().optional(),
    /** Signed, QR-exclusive promo-trial token. Server-verified; never trusted as-is. */
    promoTrialToken: z.string().min(1).optional(),
  })
  .strict();

/**
 * Verify the QR-exclusive promo token. Pure boundary check (signature + purpose
 * + expiry) — eligibility persistence is checked separately against the DB.
 */
function isValidPromoTrialToken(token: string | undefined): boolean {
  if (!token) return false;
  const result = verifySignedToken<PromoTrialTokenPayload>(token, PROMO_TRIAL_SECRET_NAME);
  return result.valid && result.payload?.purpose === PROMO_TRIAL_PURPOSE;
}

/** True for the Postgres / PostgREST "undefined column" error codes. */
function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /promo_trial_eligible/.test(error.message || "")
  );
}

/**
 * Whether this profile may still redeem the one-time promo trial. Reads the
 * migration-gated `profiles.promo_trial_eligible` flag. L-PAY17.
 *
 * Pre-migration the column doesn't exist; we FAIL CLOSED (return false) so a
 * forged/replayed token can't grant a trial before the persistence gate exists.
 */
async function isPromoTrialEligible(profileId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("promo_trial_eligible")
    .eq("id", profileId)
    .single();

  if (error) {
    if (isMissingColumnError(error)) return false; // pre-migration: fail closed
    console.error("Error reading promo_trial_eligible:", error);
    return false;
  }
  return data?.promo_trial_eligible === true;
}

/**
 * Consume the one-time promo-trial eligibility (set it false) so the same
 * account can't redeem twice. Migration-gated: no-op if the column is absent.
 * Best-effort — failure is logged but does not block checkout (Stripe-side
 * trial-already-used + hasUsedTrial still backstop double redemption).
 */
async function consumePromoTrialEligibility(profileId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ promo_trial_eligible: false })
    .eq("id", profileId)
    .eq("promo_trial_eligible", true);

  if (error && !isMissingColumnError(error)) {
    console.error("Error consuming promo_trial_eligible:", error);
  }
}

// Price IDs from environment
const PRICES = {
  monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY,
  annual: process.env.STRIPE_PRICE_PREMIUM_ANNUAL,
  scan_pack: process.env.STRIPE_PRICE_SCAN_PACK,
};

export type PriceType = "monthly" | "annual" | "scan_pack";

/**
 * POST - Create checkout session for subscription or scan pack
 */
export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: "Payment system not configured" }, { status: 503 });
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is suspended
    const suspensionStatus = await isUserSuspended(userId);
    if (suspensionStatus.suspended) {
      return NextResponse.json(
        {
          error: "account_suspended",
          message: "Your account has been suspended.",
          suspended: true,
        },
        { status: 403 }
      );
    }

    const profile = await getOrCreateProfile(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const rawBody = await request.json().catch(() => null);
    const validatedBody = validateBody(billingCheckoutBodySchema, rawBody);
    if (!validatedBody.success) return validatedBody.response;
    const { priceType, withTrial = false, promoTrialToken } = validatedBody.data;

    // L-PAY17: the promo trial requires a valid SIGNED token AND server-side
    // eligibility (`profiles.promo_trial_eligible`). A client POST can no longer
    // grant itself the 30-day trial. We resolve a single `promoTrial` boolean
    // here from those two server-trusted checks; the request body never sets it.
    let promoTrial = false;
    if (promoTrialToken) {
      if (!isValidPromoTrialToken(promoTrialToken)) {
        return NextResponse.json(
          { error: "Invalid or expired promo trial token" },
          { status: 403 }
        );
      }
      // Eligibility is one-time and lives on the profile row. Reject if the
      // flag is missing/false (already used or never granted). Migration-gated:
      // if the column doesn't exist yet (pre-migration), fail closed so a forged
      // request can't slip a trial through before the gate is enforceable.
      const eligible = await isPromoTrialEligible(profile.id);
      if (!eligible) {
        return NextResponse.json(
          { error: "Promo trial not available for this account" },
          { status: 403 }
        );
      }
      promoTrial = true;
    }

    const effectivePriceType = promoTrial ? "monthly" : priceType;

    // Promo trial takes precedence - ignore withTrial if promoTrial is set
    const effectiveWithTrial = promoTrial ? false : withTrial;

    const priceId = PRICES[effectivePriceType];
    if (!priceId) {
      return NextResponse.json(
        { error: `Price ID not configured for ${effectivePriceType}` },
        { status: 503 }
      );
    }

    // Get or create Stripe customer
    let stripeCustomerId = profile.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: profile.email || undefined,
        metadata: {
          profileId: profile.id,
          clerkUserId: userId,
        },
      });
      stripeCustomerId = customer.id;
      await setStripeCustomerId(profile.id, stripeCustomerId);
    }

    // Check if user has already used trial
    const trialUsed = await hasUsedTrial(profile.id);

    // Determine trial period
    let trialDays: number | undefined;
    if (promoTrial && !trialUsed) {
      trialDays = 30;
    } else if (effectiveWithTrial && !trialUsed && effectivePriceType !== "scan_pack") {
      trialDays = 7;
    }

    // Subscription checkouts only: reject if a live subscription already
    // exists, both locally and at Stripe. Checking only our local tier missed
    // the window between Stripe creating the subscription and the webhook
    // landing - a quick double-click could create two paid subscriptions.
    // H-PAY2: list the customer's Stripe subscriptions and reject duplicates.
    if (effectivePriceType !== "scan_pack") {
      const status = await getSubscriptionStatus(profile.id);
      if (status?.tier === "premium") {
        return NextResponse.json(
          { error: "You already have a Premium subscription" },
          { status: 400 }
        );
      }

      const existingSubs = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: "all",
        limit: 100,
      });
      if (hasLiveSubscription(existingSubs.data)) {
        return NextResponse.json(
          { error: "You already have an active or pending subscription" },
          { status: 409 }
        );
      }
    }

    // Create checkout session
    const isSubscription = effectivePriceType !== "scan_pack";

    const successUrl = promoTrial
      ? `${process.env.NEXT_PUBLIC_APP_URL}/collection?welcome=promo`
      : `${process.env.NEXT_PUBLIC_APP_URL}/profile?billing=success&type=${effectivePriceType}`;

    const cancelUrl = promoTrial
      ? `${process.env.NEXT_PUBLIC_APP_URL}/choose-plan?billing=cancelled`
      : `${process.env.NEXT_PUBLIC_APP_URL}/pricing?billing=cancelled`;

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: isSubscription ? "subscription" : "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        profileId: profile.id,
        priceType: effectivePriceType,
        ...(promoTrial ? { promoTrial: "true" } : {}),
      },
      // Always collect a payment method, even for trials. Otherwise a trial
      // that ends without a card on file silently fails to convert and the
      // subscription lands in `incomplete`, leaving the user unexpectedly
      // un-premium. M-PAY6.
      ...(isSubscription ? { payment_method_collection: "always" as const } : {}),
      ...(trialDays
        ? {
            subscription_data: {
              trial_period_days: trialDays,
              // If the trial ends with no usable payment method, cancel the
              // subscription rather than leaving it `incomplete`. M-PAY6.
              trial_settings: {
                end_behavior: { missing_payment_method: "cancel" as const },
              },
              metadata: {
                profileId: profile.id,
                ...(promoTrial ? { promoTrial: "true" } : {}),
              },
            },
          }
        : {}),
    };

    // For scan packs, add metadata to identify it in webhook
    if (effectivePriceType === "scan_pack") {
      sessionConfig.metadata!.isScanPack = "true";
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    // Burn the one-time promo eligibility once the trial checkout has been
    // created, so the signed token can't be replayed for a second trial. Only
    // when a promo trial was actually granted (trialDays === 30). L-PAY17.
    if (promoTrial && trialDays === 30) {
      await consumePromoTrialEligibility(profile.id);
    }

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    // Log the full error server-side; surface a mapped status/message to the
    // client (card declines vs. invalid requests vs. generic). L-PAY18.
    console.error("Error creating billing checkout session:", error);
    const { status, message } = mapStripeError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
