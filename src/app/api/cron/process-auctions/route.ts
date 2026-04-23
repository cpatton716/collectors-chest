import { NextRequest, NextResponse } from "next/server";

import {
  expireListings,
  expireOffers,
  expireUnpaidAuctions,
  processEndedAuctions,
  sendPaymentReminders,
} from "@/lib/auctionDb";

// POST - Process ended auctions and expirations (called by cron)
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Fail closed: require CRON_SECRET to be set and match
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Process ended auctions (active → ended with winner)
    const auctionResult = await processEndedAuctions();

    // Send payment reminders BEFORE the expiry pass, so winners still inside
    // the window get a final ping before their auction is cancelled.
    const reminderResult = await sendPaymentReminders();

    // Expire unpaid auctions (ended → cancelled when payment_deadline passes)
    const paymentExpiryResult = await expireUnpaidAuctions();

    // Expire old offers (48 hour expiration)
    const offerResult = await expireOffers();

    // Expire old listings (30 day expiration)
    const listingResult = await expireListings();

    return NextResponse.json({
      success: true,
      auctions: {
        processed: auctionResult.processed,
        errors: auctionResult.errors,
      },
      paymentReminders: {
        reminded: reminderResult.reminded,
        errors: reminderResult.errors,
      },
      unpaidAuctions: {
        expired: paymentExpiryResult.expired,
        errors: paymentExpiryResult.errors,
      },
      offers: {
        expired: offerResult.expired,
        errors: offerResult.errors,
      },
      listings: {
        expired: listingResult.expired,
        expiring: listingResult.expiring,
        errors: listingResult.errors,
      },
    });
  } catch (error) {
    console.error("Error processing cron job:", error);
    return NextResponse.json({ error: "Failed to process cron job" }, { status: 500 });
  }
}

// GET - Allow manual triggering for testing
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not allowed in production" }, { status: 403 });
  }

  try {
    // Process ended auctions
    const auctionResult = await processEndedAuctions();

    // Payment reminders
    const reminderResult = await sendPaymentReminders();

    // Expire unpaid auctions
    const paymentExpiryResult = await expireUnpaidAuctions();

    // Expire old offers
    const offerResult = await expireOffers();

    // Expire old listings
    const listingResult = await expireListings();

    return NextResponse.json({
      success: true,
      auctions: {
        processed: auctionResult.processed,
        errors: auctionResult.errors,
      },
      paymentReminders: {
        reminded: reminderResult.reminded,
        errors: reminderResult.errors,
      },
      unpaidAuctions: {
        expired: paymentExpiryResult.expired,
        errors: paymentExpiryResult.errors,
      },
      offers: {
        expired: offerResult.expired,
        errors: offerResult.errors,
      },
      listings: {
        expired: listingResult.expired,
        expiring: listingResult.expiring,
        errors: listingResult.errors,
      },
    });
  } catch (error) {
    console.error("Error processing cron job:", error);
    return NextResponse.json({ error: "Failed to process cron job" }, { status: 500 });
  }
}
