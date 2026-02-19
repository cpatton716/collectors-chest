import { NextRequest, NextResponse } from "next/server";

import Stripe from "stripe";

import { createNotification } from "@/lib/auctionDb";
import { cacheGet, cacheSet } from "@/lib/cache";
import {
  SCAN_PACK_AMOUNT,
  addPurchasedScans,
  downgradeToFree,
  getProfileByStripeCustomerId,
  startTrial,
  updateSubscriptionStatus,
  upgradeToPremium,
} from "@/lib/subscription";
import { supabase, supabaseAdmin } from "@/lib/supabase";

// Initialize Stripe (conditionally)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
    })
  : null;

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  try {
    if (!stripe || !webhookSecret) {
      return NextResponse.json({ received: true });
    }

    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Idempotency check - prevent duplicate event processing
    const eventIdKey = `stripe_event_${event.id}`;
    const alreadyProcessed = await cacheGet<boolean>(eventIdKey, "webhook");
    if (alreadyProcessed) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Mark event as being processed (1 hour TTL)
    await cacheSet(eventIdKey, true, "webhook");

    // Handle the event
    switch (event.type) {
      // ============================================
      // Checkout Events
      // ============================================
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        break;
      }

      // ============================================
      // Subscription Events
      // ============================================
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(subscription);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      // ============================================
      // Invoice Events
      // ============================================
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      // ============================================
      // Connect Account Events
      // ============================================
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const isComplete = account.charges_enabled && account.details_submitted;

        await supabaseAdmin
          .from("profiles")
          .update({ stripe_connect_onboarding_complete: isComplete })
          .eq("stripe_connect_account_id", account.id);

        break;
      }

      default:
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

// ============================================
// Checkout Handlers
// ============================================

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};

  // Check if this is a scan pack purchase
  if (metadata.isScanPack === "true" && metadata.profileId) {
    await handleScanPackPurchase(metadata.profileId);
    return;
  }

  // Check if this is an auction payment (legacy flow)
  if (metadata.auctionId && metadata.sellerId && metadata.buyerId) {
    await handleAuctionPayment(metadata);
    return;
  }

  // Subscription checkout is handled by subscription.created event
}

async function handleScanPackPurchase(profileId: string) {
  const result = await addPurchasedScans(profileId, SCAN_PACK_AMOUNT);
  if (result.success) {
  } else {
    console.error(`Failed to add scans to profile ${profileId}`);
  }
}

async function handleAuctionPayment(metadata: Record<string, string>) {
  const { auctionId, sellerId, buyerId } = metadata;

  // Get auction details with comic data for sale record
  const { data: auctionData, error: fetchError } = await supabase
    .from("auctions")
    .select(
      `
      *,
      comics(*)
    `
    )
    .eq("id", auctionId)
    .single();

  if (fetchError || !auctionData) {
    console.error("Error fetching auction:", fetchError);
    return;
  }

  // Update auction payment status
  const { error: updateError } = await supabase
    .from("auctions")
    .update({
      payment_status: "paid",
      status: "sold",
    })
    .eq("id", auctionId);

  if (updateError) {
    console.error("Error updating auction:", updateError);
    return;
  }

  // Record the sale to seller's sales history
  const comic = auctionData.comics as Record<string, unknown>;
  if (comic) {
    const salePrice =
      auctionData.winning_bid || auctionData.current_bid || auctionData.starting_price;
    const purchasePrice = comic.purchase_price as number | null;

    const { error: saleError } = await supabase.from("sales").insert({
      user_id: sellerId,
      comic_title: comic.title as string,
      comic_issue_number: comic.issue_number as string | null,
      comic_variant: comic.variant as string | null,
      comic_publisher: comic.publisher as string | null,
      cover_image_url: comic.cover_image_url as string | null,
      purchase_price: purchasePrice,
      sale_price: salePrice,
      profit: salePrice - (purchasePrice || 0),
      buyer_id: buyerId,
    });

    if (saleError) {
      console.error("Error recording sale:", saleError);
      // Don't return - sale record is secondary to payment status update
    }
  }

  // Notify seller
  await createNotification(sellerId, "payment_received", auctionId);

  // Request rating from buyer
  await createNotification(buyerId, "rating_request", auctionId);

  // Increment seller's completed sales count
  await supabaseAdmin.rpc("increment_completed_sales", {
    profile_id: sellerId,
  });
}

// ============================================
// Subscription Handlers
// ============================================

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const profile = await getProfileByStripeCustomerId(customerId);

  if (!profile) {
    console.error("No profile found for Stripe customer:", customerId);
    return;
  }

  // Access current_period_end - may be on subscription directly or first item
  const periodEnd =
    (subscription as unknown as { current_period_end?: number }).current_period_end ||
    subscription.items?.data?.[0]?.current_period_end ||
    Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // Default to 30 days
  const currentPeriodEnd = new Date(periodEnd * 1000);

  // Check if this is a trial
  if (subscription.status === "trialing") {
    await startTrial(profile.id);
  }

  // Upgrade to premium
  await upgradeToPremium(profile.id, subscription.id, currentPeriodEnd);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const profile = await getProfileByStripeCustomerId(customerId);

  if (!profile) {
    console.error("No profile found for Stripe customer:", customerId);
    return;
  }

  // Access current_period_end - may be on subscription directly or first item
  const periodEnd =
    (subscription as unknown as { current_period_end?: number }).current_period_end ||
    subscription.items?.data?.[0]?.current_period_end ||
    Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const currentPeriodEnd = new Date(periodEnd * 1000);

  // Map Stripe status to our status
  let status: "active" | "trialing" | "past_due" | "canceled" = "active";
  switch (subscription.status) {
    case "trialing":
      status = "trialing";
      break;
    case "past_due":
      status = "past_due";
      break;
    case "canceled":
    case "unpaid":
      status = "canceled";
      break;
    default:
      status = "active";
  }

  await updateSubscriptionStatus(profile.id, status, currentPeriodEnd);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const profile = await getProfileByStripeCustomerId(customerId);

  if (!profile) {
    console.error("No profile found for Stripe customer:", customerId);
    return;
  }

  // Downgrade to free tier
  await downgradeToFree(profile.id);
}

// ============================================
// Invoice Handlers
// ============================================

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  // Only process subscription invoices
  const subscriptionId = (invoice as unknown as { subscription?: string | null }).subscription;
  if (!subscriptionId) return;

  const customerId = invoice.customer as string;
  const profile = await getProfileByStripeCustomerId(customerId);

  if (!profile) {
    console.error("No profile found for Stripe customer:", customerId);
    return;
  }

  // Update subscription status to active (in case it was past_due)
  await updateSubscriptionStatus(profile.id, "active");
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  // Only process subscription invoices
  const subscriptionId = (invoice as unknown as { subscription?: string | null }).subscription;
  if (!subscriptionId) return;

  const customerId = invoice.customer as string;
  const profile = await getProfileByStripeCustomerId(customerId);

  if (!profile) {
    console.error("No profile found for Stripe customer:", customerId);
    return;
  }

  // Mark subscription as past_due
  await updateSubscriptionStatus(profile.id, "past_due");

  // TODO: Send email notification about failed payment via Resend
}
