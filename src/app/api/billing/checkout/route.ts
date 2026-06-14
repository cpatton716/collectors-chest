import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import Stripe from "stripe";

import { isUserSuspended } from "@/lib/adminAuth";
import { getOrCreateProfile } from "@/lib/db";
import { mapStripeError, stripe } from "@/lib/stripe";
import {
  getSubscriptionStatus,
  hasLiveSubscription,
  hasUsedTrial,
  setStripeCustomerId,
} from "@/lib/subscription";
import { validateBody } from "@/lib/validation";

const billingCheckoutBodySchema = z
  .object({
    priceType: z.enum(["monthly", "annual", "scan_pack"]),
    withTrial: z.boolean().optional(),
    promoTrial: z.boolean().optional(),
  })
  .strict();

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
    const { priceType, withTrial = false, promoTrial = false } = validatedBody.data;

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
