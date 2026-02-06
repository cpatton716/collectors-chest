import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getProfileByClerkId } from "@/lib/db";
import {
  FREE_MONTHLY_SCAN_LIMIT,
  GUEST_SCAN_LIMIT,
  canCreateListing,
  getSubscriptionStatus,
  hasUsedTrial,
} from "@/lib/subscription";

/**
 * GET - Get current user's subscription status
 * Returns tier, scan limits, trial info, and feature access
 */
export async function GET() {
  try {
    const { userId } = await auth();

    // Guest user - return guest limits
    if (!userId) {
      return NextResponse.json({
        isGuest: true,
        tier: "guest",
        status: null,
        scansRemaining: GUEST_SCAN_LIMIT,
        scansUsed: 0,
        monthlyLimit: GUEST_SCAN_LIMIT,
        canScan: true,
        isTrialing: false,
        trialAvailable: false,
        trialEndsAt: null,
        trialDaysRemaining: 0,
        purchasedScans: 0,
        monthResetDate: null,
        listingLimit: 0,
        activeListings: 0,
        canCreateListing: false,
        features: {
          keyHunt: false,
          csvExport: false,
          fullStats: false,
          unlimitedListings: false,
          unlimitedScans: false,
          shopBuying: false,
          cloudSync: false,
        },
      });
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get full subscription status
    const status = await getSubscriptionStatus(profile.id);
    if (!status) {
      return NextResponse.json({ error: "Could not get subscription status" }, { status: 500 });
    }

    // Check trial availability
    const trialUsed = await hasUsedTrial(profile.id);
    const trialAvailable = !trialUsed && status.tier === "free";

    // Check listing limits
    const listingInfo = await canCreateListing(profile.id);

    // Determine feature access based on tier
    const isPremiumOrTrial = status.tier === "premium" || status.isTrialing;

    return NextResponse.json({
      isGuest: false,
      tier: status.tier,
      status: status.status,
      scansRemaining: status.scansRemaining,
      scansUsed: status.scansUsed,
      monthlyLimit:
        status.tier === "premium" || status.isTrialing
          ? null // Unlimited
          : FREE_MONTHLY_SCAN_LIMIT,
      canScan: status.canScan,
      isTrialing: status.isTrialing,
      trialAvailable,
      trialEndsAt: status.trialEndsAt?.toISOString() || null,
      trialDaysRemaining: status.trialDaysRemaining,
      purchasedScans: status.purchasedScans,
      monthResetDate: status.monthResetDate.toISOString(),
      currentPeriodEnd: status.currentPeriodEnd?.toISOString() || null,
      listingLimit: listingInfo.limit,
      activeListings: listingInfo.currentCount,
      canCreateListing: listingInfo.canCreate,
      listingInfo: {
        canCreate: listingInfo.canCreate,
        currentCount: listingInfo.currentCount,
        limit: listingInfo.limit,
      },
      features: {
        keyHunt: isPremiumOrTrial,
        csvExport: isPremiumOrTrial,
        fullStats: isPremiumOrTrial,
        unlimitedListings: isPremiumOrTrial,
        unlimitedScans: isPremiumOrTrial,
        shopBuying: true, // All registered users can buy
        cloudSync: true, // All registered users have cloud sync
      },
      isAdmin: profile.is_admin === true,
    });
  } catch (error) {
    console.error("Error getting billing status:", error);
    return NextResponse.json({ error: "Failed to get subscription status" }, { status: 500 });
  }
}
