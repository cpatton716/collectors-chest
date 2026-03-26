import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import Stripe from "stripe";

import { isUserSuspended } from "@/lib/adminAuth";
import { getOrCreateProfile } from "@/lib/db";
import { getSubscriptionStatus, hasUsedTrial, setStripeCustomerId } from "@/lib/subscription";

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
    })
  : null;

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

    const body = await request.json();
    const { priceType, withTrial = false, promoTrial = false } = body as {
      priceType: PriceType;
      withTrial?: boolean;
      promoTrial?: boolean;
    };

    if (!priceType || !["monthly", "annual", "scan_pack"].includes(priceType)) {
      return NextResponse.json(
        { error: "Invalid price type. Use: monthly, annual, or scan_pack" },
        { status: 400 }
      );
    }

    const effectivePriceType = promoTrial ? "monthly" : priceType;

    // Promo trial takes precedence — ignore withTrial if promoTrial is set
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

    // Check if already premium
    if (effectivePriceType !== "scan_pack") {
      const status = await getSubscriptionStatus(profile.id);
      if (status?.tier === "premium") {
        return NextResponse.json(
          { error: "You already have a Premium subscription" },
          { status: 400 }
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
      ...(trialDays
        ? {
            subscription_data: {
              trial_period_days: trialDays,
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
    console.error("Error creating billing checkout session:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
