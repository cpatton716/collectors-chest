import { NextRequest, NextResponse } from "next/server";

import Stripe from "stripe";

import { createNotification } from "@/lib/auctionDb";
import { logAuctionAuditEvent } from "@/lib/auditLog";
import { createFeedbackReminders } from "@/lib/creatorCreditsDb";
import { getProfileForEmail, sendNotificationEmail } from "@/lib/email";
import { isWebhookProcessed, markWebhookProcessed } from "@/lib/cache";
import { invalidateProfileCacheByProfileId } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { calculateDestinationAmount } from "@/lib/stripeConnect";
import {
  SCAN_PACK_AMOUNT,
  addPurchasedScans,
  downgradeToFree,
  getProfileByStripeCustomerId,
  mapStripeSubscriptionStatus,
  updateSubscriptionStatus,
  upgradeToPremium,
} from "@/lib/subscription";
import { supabaseAdmin } from "@/lib/supabase";

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

    // Idempotency check - prevent duplicate event processing. The marker is
    // written ONLY after the handler completes (see below), so a handler that
    // throws leaves no marker and Stripe's automatic retry is honored. H-PAY1.
    const eventIdKey = `stripe_event_${event.id}`;
    if (await isWebhookProcessed(eventIdKey)) {
      return NextResponse.json({ received: true, duplicate: true });
    }

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
      // Refund / Dispute Events (reverse sale state) - M-MK17
      // ============================================
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await handleChargeRefunded(charge);
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        await handleDisputeCreated(dispute);
        break;
      }

      // ============================================
      // Connect Account Events
      // ============================================
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await handleConnectAccountUpdated(account);
        break;
      }

      default:
    }

    // Mark processed ONLY after the handler above completed without throwing.
    // If a handler threw, we fall to the catch and return 500 so Stripe retries
    // and no marker is written. H-PAY1.
    await markWebhookProcessed(eventIdKey);

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
    await handleScanPackPurchase(session.id, metadata.profileId);
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

// Credit a scan-pack purchase to the buyer's profile. M-PAY5.
//
// The event-level idempotency marker (isWebhookProcessed) is best-effort: it
// lives in Redis and can expire or be lost, and Stripe may deliver the same
// checkout.session.completed under different event ids (e.g. via a manual
// resend). A duplicate credit silently hands out free scans, so scan-pack
// credit is also made idempotent at the database layer keyed on the Stripe
// SESSION id (stable across redeliveries).
//
// Primary path: the `credit_scan_pack(p_session_id, p_profile_id, p_scans)`
// SECURITY DEFINER RPC atomically (a) inserts the session into
// processed_stripe_sessions and (b) increments purchased_scans, doing the
// increment ONLY when the session row was newly inserted - so a replay is a
// safe no-op. See MIGRATIONS (REQUIRED).
//
// Migration-safe fallback: until that RPC/table ships, calling a missing
// function errors (undefined_function 42883 / PostgREST PGRST202). We detect
// that and fall back to the existing non-idempotent addPurchasedScans path so
// the webhook keeps functioning and building pre-migration.
async function handleScanPackPurchase(sessionId: string, profileId: string) {
  const { error: rpcError } = await supabaseAdmin.rpc("credit_scan_pack", {
    p_session_id: sessionId,
    p_profile_id: profileId,
    p_scans: SCAN_PACK_AMOUNT,
  });

  if (!rpcError) {
    // RPC handled the credit (or no-opped on replay) atomically.
    return;
  }

  // The RPC isn't deployed yet - fall back to the legacy path. Any OTHER RPC
  // error (e.g. a real DB failure) is rethrown so Stripe retries rather than
  // silently dropping a paid scan pack.
  const rpcMissing = rpcError.code === "42883" || rpcError.code === "PGRST202";
  if (!rpcMissing) {
    throw new Error(`[handleScanPackPurchase] credit_scan_pack failed: ${rpcError.message}`);
  }

  const result = await addPurchasedScans(profileId, SCAN_PACK_AMOUNT);
  if (!result.success) {
    console.error(`Failed to add scans to profile ${profileId}`);
  }
}

// ============================================
// Destination-charge reconciliation (M-MK16)
// ============================================

export interface ChargeFinancials {
  /** Total charged to the buyer, in cents. */
  grossCents: number;
  /** Platform's cut (Stripe `application_fee_amount`), in cents. */
  applicationFeeCents: number;
  /**
   * Seller's gross share, in cents (gross - application fee). Under destination
   * charges the seller is merchant-of-record and Stripe nets its 2.9% + $0.30
   * processing cost from this on the seller's balance; we record the
   * pre-processing seller net so it matches the transfer/charge math.
   */
  sellerNetCents: number;
  /** Where the numbers came from: the settled Stripe charge, or a local estimate. */
  source: "charge" | "estimate";
}

// Pure extraction of the destination-charge breakdown from a Stripe Charge.
// Reads `application_fee_amount` (the platform cut) and the gross `amount`, with
// `amount_captured` preferred when present (partial captures). Falls back to the
// passed-in estimate when the charge carries no application fee (e.g. a
// pre-M-MK16 separate-charges/transfer_data charge, or a charge we couldn't
// retrieve). Exported for unit testing. M-MK16.
export function extractChargeFinancials(
  charge: Pick<Stripe.Charge, "amount" | "amount_captured" | "application_fee_amount"> | null,
  estimateTotalCents: number,
  estimatePlatformFeePercent: number
): ChargeFinancials {
  const applicationFee =
    charge && typeof charge.application_fee_amount === "number"
      ? charge.application_fee_amount
      : null;

  if (charge && applicationFee !== null) {
    const grossCents =
      typeof charge.amount_captured === "number" && charge.amount_captured > 0
        ? charge.amount_captured
        : charge.amount;
    return {
      grossCents,
      applicationFeeCents: applicationFee,
      sellerNetCents: grossCents - applicationFee,
      source: "charge",
    };
  }

  // No settled application fee available - estimate locally from the listing's
  // locked platform_fee_percent using the canonical fee math.
  const safeTotal = Math.max(0, Math.round(estimateTotalCents));
  const { sellerAmount, platformFee } = calculateDestinationAmount(
    safeTotal,
    estimatePlatformFeePercent
  );
  return {
    grossCents: safeTotal,
    applicationFeeCents: platformFee,
    sellerNetCents: sellerAmount,
    source: "estimate",
  };
}

// Retrieve the settled charge for a checkout session's PaymentIntent and reduce
// it to the destination-charge financials, falling back to a local estimate
// when Stripe is unavailable or the charge can't be read. M-MK16.
async function resolveChargeFinancials(
  session: Stripe.Checkout.Session,
  estimateTotalCents: number,
  platformFeePercent: number | undefined
): Promise<ChargeFinancials> {
  // 8% free-tier default matches the auctions.platform_fee_percent column default.
  const feePercent = platformFeePercent ?? 8;

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  if (stripe && paymentIntentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge"],
      });
      const latest = pi.latest_charge;
      const charge =
        latest && typeof latest !== "string" ? (latest as Stripe.Charge) : null;
      if (charge) {
        return extractChargeFinancials(charge, estimateTotalCents, feePercent);
      }
    } catch (err) {
      console.error("[resolveChargeFinancials] retrieve failed:", err);
    }
  }

  return extractChargeFinancials(null, estimateTotalCents, feePercent);
}

// Handle a completed marketplace checkout session - both Buy Now and auction
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

  // Fetch listing with comic data. Use supabaseAdmin - webhooks have no
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

  // M-MK16: resolve the destination-charge financials up front so the audit
  // event records the authoritative platform fee + seller net (the audit
  // event_data is JSONB, so this is always durable even before the sales-row
  // fee columns ship).
  const auditSalePrice =
    (listingData.winning_bid as number | null) ||
    (listingData.starting_price as number | null) ||
    0;
  const auditShippingCents = Math.round(
    (((listingData.shipping_cost as number | null) || 0) + auditSalePrice) * 100
  );
  const auditFinancials = await resolveChargeFinancials(
    session,
    auditShippingCents,
    (listingData.platform_fee_percent as number | null) ?? undefined
  );

  // Audit trail - fire-and-forget so a failure here never causes Stripe to
  // retry the webhook. No PII: only IDs + amounts + session ID.
  void logAuctionAuditEvent({
    auctionId,
    actorProfileId: buyerId,
    eventType: "payment_succeeded",
    eventData: {
      amount: auditSalePrice,
      // Destination-charge breakdown (dollars). M-MK16.
      platformFee: auditFinancials.applicationFeeCents / 100,
      sellerNet: auditFinancials.sellerNetCents / 100,
      feeSource: auditFinancials.source,
      sessionId: session.id,
      transactionType: isBuyNow ? "buy_now" : "auction",
      sellerId,
    },
  });

  // NOTE: Comic ownership transfer deliberately deferred to the seller's
  // "Mark as Shipped" action (see /api/auctions/[id]/mark-shipped). The buyer
  // doesn't get the cloned comic in their collection on payment - only after
  // the seller confirms shipment. This is Option A of the Shipping Tracking
  // design: self-reported tracking now, carrier-validated tracking later
  // (BACKLOG "Shipping Tracking for Sold Items - Pre-Launch Full Launch Blocker").
  const comic = listingData.comics as Record<string, unknown> | null;
  const salePrice =
    (listingData.winning_bid as number | null) ||
    (listingData.current_bid as number | null) ||
    (listingData.starting_price as number | null) ||
    0;

  // M-MK16: reuse the destination-charge financials resolved above (Stripe's
  // authoritative platform fee + seller net) so the sale row and the audit
  // event agree. `salePrice` here uses the winning_bid/current_bid fallback and
  // may differ from the audit's salePrice, but `auditFinancials` was computed
  // from the same charge total, which is what we record.
  const financials = auditFinancials;

  // Record the sale on the seller's sales history
  if (comic) {
    const purchasePrice = comic.purchase_price as number | null;
    const baseSale: Record<string, unknown> = {
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
    };

    // M-MK16: persist platform fee + seller net (dollars) on the sale row. The
    // `platform_fee` / `seller_net` columns are added behind a migration, so we
    // attempt the enriched insert first and fall back to the base columns if
    // they don't exist yet - the sale record always lands, and the financial
    // breakdown is additionally captured on the payment_succeeded audit event
    // above (JSONB) regardless of column availability.
    const enrichedSale = {
      ...baseSale,
      platform_fee: financials.applicationFeeCents / 100,
      seller_net: financials.sellerNetCents / 100,
    };

    let { error: saleError } = await supabaseAdmin.from("sales").insert(enrichedSale);

    if (saleError && (saleError.code === "PGRST204" || saleError.code === "42703")) {
      // Fee columns not present yet - retry with the base shape.
      ({ error: saleError } = await supabaseAdmin.from("sales").insert(baseSale));
    }

    if (saleError) {
      console.error("[handleMarketplacePayment] Error recording sale:", saleError);
      // Non-fatal - sale record is secondary to buyer ownership transfer
    }
  }

  // Notifications - Buy Now purchases get fixed-price copy; auctions keep
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
    // Auction winners already received a "won" notification at auction end -
    // no need to duplicate here.
  }

  // rating_request notifications fire from the mark-shipped route, not here.
  // Feedback eligibility flips true on `shipped_at`, so prompting at payment
  // leaves the buyer clicking the notification with nowhere to leave feedback.

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
  await invalidateProfileCacheByProfileId(profile.id); // M-PAY11
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

  // Map Stripe status to our internal status. Statuses that don't grant
  // entitlement (incomplete / incomplete_expired / paused) must not map to
  // "active" (M-PAY7); a subscription flagged cancel_at_period_end is reported
  // as canceled while access continues until currentPeriodEnd (M-PAY9).
  const status = mapStripeSubscriptionStatus(
    subscription.status,
    subscription.cancel_at_period_end === true
  );

  await updateSubscriptionStatus(profile.id, status, currentPeriodEnd);
  await invalidateProfileCacheByProfileId(profile.id); // M-PAY11
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
  await invalidateProfileCacheByProfileId(profile.id); // M-PAY11
}

// ============================================
// Invoice Handlers
// ============================================

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  // Only process subscription invoices
  const subscriptionId = (invoice as unknown as { subscription?: string | null }).subscription;
  if (!subscriptionId) return;

  // Gate on billing_reason rather than amount_paid alone (L-PAY16). A $0
  // amount_paid can legitimately mean a 100%-discount renewal that SHOULD
  // re-activate the subscription; previously those were silently skipped.
  // We skip only the initial trial-creation invoice (subscription_create with
  // a $0 amount and no discount), since the subscription.created event already
  // grants entitlement and re-processing here is redundant.
  const inv = invoice as unknown as {
    amount_paid?: number;
    billing_reason?: string | null;
    discount?: unknown;
    discounts?: unknown[];
  };
  const hasDiscount =
    !!inv.discount || (Array.isArray(inv.discounts) && inv.discounts.length > 0);
  const isInitialTrialInvoice =
    inv.billing_reason === "subscription_create" &&
    (inv.amount_paid ?? invoice.amount_paid) === 0 &&
    !hasDiscount;
  if (isInitialTrialInvoice) return;

  const customerId = invoice.customer as string;
  const profile = await getProfileByStripeCustomerId(customerId);

  if (!profile) {
    console.error("No profile found for Stripe customer:", customerId);
    return;
  }

  // Update subscription status to active (in case it was past_due)
  await updateSubscriptionStatus(profile.id, "active");
  await invalidateProfileCacheByProfileId(profile.id); // M-PAY11
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
  await invalidateProfileCacheByProfileId(profile.id); // M-PAY11

  // Notify the user so they can update their payment method before Stripe's
  // smart-retry exhausts and the subscription lapses to canceled. We use a
  // Stripe Customer Portal billing-management link as the CTA — that's the
  // canonical place for users to update their payment method.
  const profileForEmail = await getProfileForEmail(profile.id);
  if (profileForEmail?.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";
    const manageBillingUrl = `${appUrl}/settings/billing`;

    // Stripe surfaces the next auto-retry timestamp on the invoice when one
    // is scheduled. Format as a human date when present.
    const invoiceWithRetry = invoice as unknown as { next_payment_attempt?: number | null };
    const nextRetryAt = invoiceWithRetry.next_payment_attempt
      ? new Date(invoiceWithRetry.next_payment_attempt * 1000).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })
      : undefined;

    // Stripe puts the latest charge's outcome reason in
    // `last_finalization_error` or on the underlying charge. Sanitize by
    // accepting only short, free-of-PII reasons.
    const finalizationError = (invoice as unknown as { last_finalization_error?: { message?: string } | null })
      .last_finalization_error;
    const rawReason = finalizationError?.message;
    const failureReason = rawReason && rawReason.length < 120 ? rawReason : undefined;

    try {
      await sendNotificationEmail({
        to: profileForEmail.email,
        type: "subscription_payment_failed",
        data: { manageBillingUrl, nextRetryAt, failureReason },
        profileId: profile.id,
      });
    } catch (err) {
      console.error("[handleInvoicePaymentFailed] email send failed:", err);
    }
  }
}

// ============================================
// Refund / Dispute Handlers (M-MK17)
// ============================================

// Resolve the marketplace context (auctionId/buyerId/sellerId) for a charge by
// reading the PaymentIntent metadata we mirror at checkout time. Returns null
// for subscription/scan-pack charges (which carry no marketplace metadata).
async function resolveMarketplaceContextFromCharge(
  charge: Stripe.Charge
): Promise<{ auctionId: string; buyerId: string; sellerId: string } | null> {
  if (!stripe) return null;
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!paymentIntentId) return null;

  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    const md = pi.metadata || {};
    if (md.auctionId && md.buyerId && md.sellerId) {
      return { auctionId: md.auctionId, buyerId: md.buyerId, sellerId: md.sellerId };
    }
  } catch (err) {
    console.error("[resolveMarketplaceContextFromCharge] retrieve failed:", err);
  }
  return null;
}

// Revert a marketplace sale to a refunded state: flip the listing's
// payment_status to "refunded", mark the recorded sale refunded, and notify
// both parties. Ownership transfer happens at mark-shipped (not at payment), so
// there is no cloned-comic to claw back here for the common pre-ship case.
async function reverseMarketplaceSale(
  ctx: { auctionId: string; buyerId: string; sellerId: string },
  reason: "refund" | "dispute"
) {
  const { auctionId, buyerId, sellerId } = ctx;

  // Only reverse if the listing is currently in a sold/paid state - guards
  // against double-processing (refund + dispute on the same charge).
  const { data: listing } = await supabaseAdmin
    .from("auctions")
    .select("id, status, payment_status")
    .eq("id", auctionId)
    .maybeSingle();

  if (!listing) {
    console.warn(`[reverseMarketplaceSale] Listing ${auctionId} not found`);
    return;
  }
  // Idempotency: if the listing has already been backed out (cancelled with no
  // payment), there's nothing left to reverse. Avoids double notifications when
  // a refund and a dispute land on the same charge.
  if (listing.status === "cancelled" && listing.payment_status === null) {
    return;
  }

  // Back the sale out to a constraint-valid state: cancelled listing, no
  // payment. The auctions schema has no 'refunded' enum, so this is the
  // closest valid representation of a reversed sale. M-MK17.
  const { error: updateError } = await supabaseAdmin
    .from("auctions")
    .update({ status: "cancelled", payment_status: null })
    .eq("id", auctionId);

  if (updateError) {
    // Throw so the webhook returns 500 and Stripe retries - we must not leave
    // a refunded charge with a "paid" sale on the books.
    throw new Error(`[reverseMarketplaceSale] update failed: ${updateError.message}`);
  }

  const sellerMsg =
    reason === "dispute"
      ? "A buyer opened a payment dispute on a sale. Funds are on hold pending resolution."
      : "A sale was refunded. The associated funds have been returned to the buyer.";
  const buyerMsg =
    reason === "dispute"
      ? "Your payment dispute has been recorded. We'll follow up as it's resolved."
      : "Your purchase was refunded.";

  await createNotification(sellerId, "payment_received", auctionId, undefined, {
    title: reason === "dispute" ? "Payment disputed" : "Sale refunded",
    message: sellerMsg,
  });
  await createNotification(buyerId, "won", auctionId, undefined, {
    title: reason === "dispute" ? "Dispute recorded" : "Purchase refunded",
    message: buyerMsg,
  });

  // Reuse the existing payment_refunded audit type for both refunds and
  // disputes (the auditLog union has no payment_disputed entry); the `reason`
  // field disambiguates.
  void logAuctionAuditEvent({
    auctionId,
    actorProfileId: buyerId,
    eventType: "payment_refunded",
    eventData: { sellerId, reason },
  });
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const ctx = await resolveMarketplaceContextFromCharge(charge);
  if (!ctx) return; // subscription/scan-pack refund - nothing to reverse here
  await reverseMarketplaceSale(ctx, "refund");
}

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  if (!stripe) return;
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : null;
  if (!chargeId) return;

  try {
    const charge = await stripe.charges.retrieve(chargeId);
    const ctx = await resolveMarketplaceContextFromCharge(charge);
    if (!ctx) return;
    await reverseMarketplaceSale(ctx, "dispute");
  } catch (err) {
    console.error("[handleDisputeCreated] retrieve failed:", err);
    throw err; // let Stripe retry
  }
}

// ============================================
// Connect Account Handlers (M-MK14)
// ============================================

// Mirror a seller's Connect onboarding/capability state onto their profile.
// M-MK14: the previous inline handler ran a blind UPDATE - a webhook for an
// account.id we don't recognize (or one detached from any profile) silently
// matched zero rows with no signal. We now request `.select("id")` and warn on
// a zero-row match so orphaned Connect accounts are surfaced in logs, and we
// persist `charges_enabled`/`payouts_enabled` so connect/status can read the
// live capability flags from the DB mirror (B18) instead of re-hitting Stripe.
async function handleConnectAccountUpdated(account: Stripe.Account) {
  const isComplete = account.charges_enabled && account.details_submitted;

  // Persist capability flags only when the corresponding columns exist
  // (B18 / connect-status DB mirror). The base onboarding flag always writes;
  // the capability columns are added behind a migration, so we attempt the
  // richer payload first and fall back to the onboarding-only update if the
  // columns aren't present yet. This keeps the webhook functional pre-migration.
  const fullPayload: Record<string, unknown> = {
    stripe_connect_onboarding_complete: isComplete,
    stripe_connect_charges_enabled: account.charges_enabled ?? false,
    stripe_connect_payouts_enabled: account.payouts_enabled ?? false,
  };

  let { data: updatedProfiles, error } = await supabaseAdmin
    .from("profiles")
    .update(fullPayload)
    .eq("stripe_connect_account_id", account.id)
    .select("id");

  // Migration-safe fallback: if the capability columns don't exist yet the
  // update errors (PostgREST PGRST204 / undefined_column 42703). Retry with the
  // onboarding flag alone so the core state still mirrors. M-MK14.
  if (error) {
    const missingColumn = error.code === "PGRST204" || error.code === "42703";
    if (!missingColumn) {
      console.error("[handleConnectAccountUpdated] update failed:", error);
    }
    ({ data: updatedProfiles, error } = await supabaseAdmin
      .from("profiles")
      .update({ stripe_connect_onboarding_complete: isComplete })
      .eq("stripe_connect_account_id", account.id)
      .select("id"));
    if (error) {
      console.error("[handleConnectAccountUpdated] fallback update failed:", error);
    }
  }

  // M-MK14: warn (don't throw) when no profile matched this Connect account.
  // An unrecognized account.id is a data-integrity signal, not a transient
  // failure - retrying via 500 would never resolve it.
  if (!updatedProfiles || updatedProfiles.length === 0) {
    console.warn(
      `[handleConnectAccountUpdated] No profile matched Connect account ${account.id} (charges_enabled=${account.charges_enabled}, details_submitted=${account.details_submitted})`
    );
    return;
  }

  // Connect status is read on the hot profile-cache path - invalidate so the
  // seller's onboarding flag isn't served stale for the cache TTL. M-PAY11.
  for (const p of updatedProfiles) {
    await invalidateProfileCacheByProfileId(p.id);
  }
}
