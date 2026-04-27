import { NextRequest, NextResponse } from "next/server";

import {
  expireListings,
  expireOffers,
  expireSecondChanceOffers,
  expireUnpaidAuctions,
  processEndedAuctions,
  pruneOldNotifications,
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

    // Expire Second Chance Offers whose 48h window has passed
    const secondChanceExpiryResult = await expireSecondChanceOffers();

    // Expire old listings (30 day expiration)
    const listingResult = await expireListings();

    // Prune old notifications (read >30d, unread >90d). Idempotent —
    // returns counts so we can log how much was deleted per tick.
    const pruneResult = await pruneOldNotifications();
    if (pruneResult.deletedRead || pruneResult.deletedUnread) {
      console.warn(
        `[prune] notifications: deletedRead=${pruneResult.deletedRead}, deletedUnread=${pruneResult.deletedUnread}`
      );
    }

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
      secondChanceOffers: {
        expired: secondChanceExpiryResult.expired,
        errors: secondChanceExpiryResult.errors,
      },
      listings: {
        expired: listingResult.expired,
        expiring: listingResult.expiring,
        errors: listingResult.errors,
      },
      notifications: {
        deletedRead: pruneResult.deletedRead,
        deletedUnread: pruneResult.deletedUnread,
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
    const auctionResult = await processEndedAuctions();
    const reminderResult = await sendPaymentReminders();
    const paymentExpiryResult = await expireUnpaidAuctions();
    const offerResult = await expireOffers();
    const secondChanceExpiryResult = await expireSecondChanceOffers();
    const listingResult = await expireListings();
    const pruneResult = await pruneOldNotifications();

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
      secondChanceOffers: {
        expired: secondChanceExpiryResult.expired,
        errors: secondChanceExpiryResult.errors,
      },
      listings: {
        expired: listingResult.expired,
        expiring: listingResult.expiring,
        errors: listingResult.errors,
      },
      notifications: {
        deletedRead: pruneResult.deletedRead,
        deletedUnread: pruneResult.deletedUnread,
      },
    });
  } catch (error) {
    console.error("Error processing cron job:", error);
    return NextResponse.json({ error: "Failed to process cron job" }, { status: 500 });
  }
}
