import { NextRequest, NextResponse } from "next/server";

import Stripe from "stripe";

import { createNotification } from "@/lib/auctionDb";
import { createFeedbackReminders } from "@/lib/creatorCreditsDb";
import { getProfileForEmail, sendNotificationEmail } from "@/lib/email";
import { cacheGet, cacheSet } from "@/lib/cache";
import {
  SCAN_PACK_AMOUNT,
  addPurchasedScans,
  downgradeToFree,
  getProfileByStripeCustomerId,
  updateSubscriptionStatus,
  upgradeToPremium,
} from "@/lib/subscription";
import { supabaseAdmin } from "@/lib/supabase";

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
        // No-op for now. Could be used to clean up "pending" listings
        // if we ever add a reserve-on-checkout-create pattern.
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

  // Marketplace purchase (Buy Now or auction win). Both paths share the
  // same metadata shape; `listingType` disambiguates between them.
  if (metadata.auctionId && metadata.sellerId && metadata.buyerId) {
    await handleMarketplacePayment(session, metadata);
    return;
  }

  // Subscription checkout is handled by subscription.created event
}

async function handleScanPackPurchase(profileId: string) {
  const result = await addPurchasedScans(profileId, SCAN_PACK_AMOUNT);
  if (!result.success) {
    console.error(`Failed to add scans to profile ${profileId}`);
  }
}

// Handle a completed marketplace checkout session — both Buy Now and auction
// winner payments follow this path. Race safety: for Buy Now, if the listing
// has already been sold to a different buyer between session creation and
// completion, refund this session so we don't double-sell.
async function handleMarketplacePayment(
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>
) {
  const { auctionId, sellerId, buyerId } = metadata;
  // Default to "auction" so any in-flight sessions from before the Apr 22
  // split (no listingType in metadata) still land in the auction path.
  const listingType = metadata.listingType === "buy_now" ? "buy_now" : "auction";
  const isBuyNow = listingType === "buy_now";

  // Fetch listing with comic data. Use supabaseAdmin — webhooks have no
  // user-auth context, so RLS would block (or worse, silently fail on writes).
  const { data: listingData, error: fetchError } = await supabaseAdmin
    .from("auctions")
    .select(
      `
      *,
      comics!auctions_comic_id_fkey(*)
    `
    )
    .eq("id", auctionId)
    .single();

  if (fetchError || !listingData) {
    console.error("[handleMarketplacePayment] Listing not found:", fetchError);
    return;
  }

  // Buy Now race safety: if listing is already sold to a different buyer,
  // refund this session so we don't take money for an item we can't deliver.
  if (isBuyNow && listingData.status === "sold" && listingData.winner_id !== buyerId) {
    console.warn(
      `[handleMarketplacePayment] Buy Now race: listing ${auctionId} already sold to ${listingData.winner_id}, refunding buyer ${buyerId}`
    );
    const paymentIntentId = session.payment_intent;
    if (paymentIntentId && stripe) {
      try {
        await stripe.refunds.create({
          payment_intent: paymentIntentId as string,
          reason: "requested_by_customer",
        });
      } catch (refundErr) {
        console.error("[handleMarketplacePayment] Refund failed:", refundErr);
      }
    }
    return;
  }

  // Flip listing to paid. For Buy Now we also set the winner_id here (auction
  // flow set it during auction-end processing).
  const updatePayload: Record<string, unknown> = {
    payment_status: "paid",
    status: "sold",
  };
  if (isBuyNow) {
    updatePayload.winner_id = buyerId;
    updatePayload.winning_bid = listingData.starting_price;
  }

  const { error: updateError } = await supabaseAdmin
    .from("auctions")
    .update(updatePayload)
    .eq("id", auctionId);

  if (updateError) {
    console.error("[handleMarketplacePayment] Error updating listing:", updateError);
    return;
  }

  // NOTE: Comic ownership transfer deliberately deferred to the seller's
  // "Mark as Shipped" action (see /api/auctions/[id]/mark-shipped). The buyer
  // doesn't get the cloned comic in their collection on payment — only after
  // the seller confirms shipment. This is Option A of the Shipping Tracking
  // design: self-reported tracking now, carrier-validated tracking later
  // (BACKLOG "Shipping Tracking for Sold Items — Pre-Launch Full Launch Blocker").
  const comic = listingData.comics as Record<string, unknown> | null;
  const salePrice =
    (listingData.winning_bid as number | null) ||
    (listingData.current_bid as number | null) ||
    (listingData.starting_price as number | null) ||
    0;

  // Record the sale on the seller's sales history
  if (comic) {
    const purchasePrice = comic.purchase_price as number | null;
    const { error: saleError } = await supabaseAdmin.from("sales").insert({
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
      console.error("[handleMarketplacePayment] Error recording sale:", saleError);
      // Non-fatal — sale record is secondary to buyer ownership transfer
    }
  }

  // Notifications — Buy Now purchases get fixed-price copy; auctions keep
  // the default auction-flavored messages (bug #3 fix).
  if (isBuyNow) {
    await createNotification(sellerId, "payment_received", auctionId, undefined, {
      title: "Purchase completed!",
      message: "A buyer completed a Buy Now purchase and the funds are on their way.",
    });
    await createNotification(buyerId, "won", auctionId, undefined, {
      title: "Purchase complete!",
      message: "Your Buy Now purchase is confirmed. The comic is now in your collection.",
    });
  } else {
    await createNotification(sellerId, "payment_received", auctionId);
    // Auction winners already received a "won" notification at auction end —
    // no need to duplicate here. Kick off a rating request instead.
  }
  await createNotification(buyerId, "rating_request", auctionId);

  // Feedback reminders so both parties can leave ratings
  await createFeedbackReminders(
    isBuyNow ? "sale" : "auction",
    auctionId,
    buyerId,
    sellerId
  );

  // Transactional emails to buyer + seller. Fire-and-forget: we don't want
  // email failures to fail the webhook and cause Stripe to retry. Errors are
  // logged inside sendNotificationEmail.
  void sendMarketplaceTransactionEmails({
    auctionId,
    buyerId,
    sellerId,
    comic: (comic as Record<string, unknown> | null) || null,
    salePrice,
    shippingCost: (listingData.shipping_cost as number | null) || 0,
    transactionType: isBuyNow ? "buy_now" : "auction",
  });

  // Increment seller's completed sales count
  await supabaseAdmin.rpc("increment_completed_sales", {
    profile_id: sellerId,
  });
}

// Dispatch purchase_confirmation (buyer) + item_sold (seller) emails.
// Runs async via `void` caller; any failure is logged but never thrown.
async function sendMarketplaceTransactionEmails(params: {
  auctionId: string;
  buyerId: string;
  sellerId: string;
  comic: Record<string, unknown> | null;
  salePrice: number;
  shippingCost: number;
  transactionType: "buy_now" | "auction";
}) {
  const { auctionId, buyerId, sellerId, comic, salePrice, shippingCost, transactionType } = params;
  if (!comic) return;

  try {
    const [buyerProfile, sellerProfile] = await Promise.all([
      getProfileForEmail(buyerId),
      getProfileForEmail(sellerId),
    ]);

    const base = {
      comicTitle: (comic.title as string) || "Comic",
      issueNumber: (comic.issue_number as string | null) || "?",
      variant: (comic.variant as string | null) ?? null,
      salePrice,
      shippingCost: shippingCost || undefined,
      total: salePrice + (shippingCost || 0),
      transactionType,
      listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop?listing=${auctionId}`,
    };

    // Buyer: purchase confirmation
    if (buyerProfile?.email) {
      await sendNotificationEmail({
        to: buyerProfile.email,
        type: "purchase_confirmation",
        data: {
          ...base,
          buyerName: buyerProfile.displayName || "there",
          sellerName: sellerProfile?.displayName || "the seller",
        },
      });
    }

    // Seller: item sold
    if (sellerProfile?.email) {
      await sendNotificationEmail({
        to: sellerProfile.email,
        type: "item_sold",
        data: {
          ...base,
          buyerName: buyerProfile?.displayName || "a buyer",
          sellerName: sellerProfile.displayName || "there",
        },
      });
    }
  } catch (err) {
    console.error("[sendMarketplaceTransactionEmails] Failed:", err);
  }
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

  const isTrialing = subscription.status === "trialing";

  // Record trial dates directly from Stripe (bypass startTrial guard)
  if (isTrialing && subscription.trial_end) {
    const trialEnd = new Date(subscription.trial_end * 1000);
    await supabaseAdmin.from("profiles").update({
      trial_started_at: new Date().toISOString(),
      trial_ends_at: trialEnd.toISOString(),
    }).eq("id", profile.id);
  }

  // Upgrade to premium
  await upgradeToPremium(profile.id, subscription.id, currentPeriodEnd, isTrialing);
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
  if (invoice.amount_paid === 0) return; // Skip $0 trial invoices. Note: also skips 100% discount coupon invoices — refine if coupons are ever added.

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
