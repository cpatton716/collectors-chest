import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { invalidateProfileCacheByProfileId } from "@/lib/db";
import { isRedisAvailable, redis } from "@/lib/redis";
import { stripe } from "@/lib/stripe";
import { computePlatformFeeDollars } from "@/lib/stripeConnect";
import { supabaseAdmin } from "@/lib/supabase";

// M-MK19: serve the live Connect capability flags from a short-lived cache of
// the DB mirror so we don't call `accounts.retrieve` on every status poll.
// 5-minute TTL keeps the dashboard reasonably fresh while collapsing the bulk
// of polls into a Redis read. The webhook (account.updated, M-MK14) keeps the
// DB mirror authoritative; a cache miss reconciles against Stripe.
const CONNECT_STATUS_CACHE_PREFIX = "cache:connect:status:";
const CONNECT_STATUS_TTL_SECONDS = 5 * 60;

interface ConnectStatusCacheValue {
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}

async function readConnectStatusCache(
  accountId: string
): Promise<ConnectStatusCacheValue | null> {
  if (!isRedisAvailable() || !redis) return null;
  try {
    const cached = await redis.get<ConnectStatusCacheValue>(
      `${CONNECT_STATUS_CACHE_PREFIX}${accountId}`
    );
    return cached ?? null;
  } catch (err) {
    console.error("[connect/status] cache read failed:", err);
    return null;
  }
}

async function writeConnectStatusCache(
  accountId: string,
  value: ConnectStatusCacheValue
): Promise<void> {
  if (!isRedisAvailable() || !redis) return;
  try {
    await redis.set(`${CONNECT_STATUS_CACHE_PREFIX}${accountId}`, value, {
      ex: CONNECT_STATUS_TTL_SECONDS,
    });
  } catch (err) {
    console.error("[connect/status] cache write failed:", err);
  }
}

/**
 * Total platform fees a seller has paid, in dollars.
 *
 * MIGRATION-GATED: prefers a SQL aggregate RPC (`sum_seller_platform_fees`)
 * that sums the floored per-sale fee server-side. If that function is absent
 * (pre-migration) we fall back to the existing JS reduce over the seller's sold
 * auctions, so the figure is always populated. Both paths route through the
 * canonical cents-based floored helper so the total matches what was charged.
 */
async function getTotalFeesPaid(sellerId: string): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc("sum_seller_platform_fees", {
    p_seller_id: sellerId,
  });
  if (!error && typeof data === "number") {
    return data;
  }

  // Build-safe fallback: aggregate in JS from sold auctions. M-PAY10.
  const { data: soldAuctions } = await supabaseAdmin
    .from("auctions")
    .select("winning_bid, current_bid, starting_price, platform_fee_percent")
    .eq("seller_id", sellerId)
    .eq("status", "sold");

  return (soldAuctions || []).reduce(
    (
      sum: number,
      auction: {
        winning_bid: number | null;
        current_bid: number | null;
        starting_price: number | null;
        platform_fee_percent: number | null;
      }
    ) => {
      const salePrice =
        auction.winning_bid || auction.current_bid || auction.starting_price || 0;
      const feePercent = auction.platform_fee_percent || 8;
      return sum + computePlatformFeeDollars(salePrice, feePercent);
    },
    0
  );
}

export async function GET() {
  try {
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Select the DB-mirror capability columns too (M-MK19). They're written by
    // the account.updated webhook (M-MK14) behind a migration; if they don't
    // exist yet the select errors, so we retry with the base column set and
    // treat the capability flags as unknown (forces a Stripe reconcile).
    const baseColumns =
      "id, subscription_tier, stripe_connect_account_id, stripe_connect_onboarding_complete, completed_sales_count";
    const mirrorColumns = `${baseColumns}, stripe_connect_charges_enabled, stripe_connect_payouts_enabled`;

    let { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select(mirrorColumns)
      .eq("clerk_user_id", userId)
      .single();

    let mirrorColumnsPresent = true;
    if (profileError) {
      // Build-safe fallback: capability columns not migrated yet.
      mirrorColumnsPresent = false;
      ({ data: profile } = await supabaseAdmin
        .from("profiles")
        .select(baseColumns)
        .eq("clerk_user_id", userId)
        .single());
    }

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const totalFeesPaid = await getTotalFeesPaid(profile.id);
    const subscriptionTier = profile.subscription_tier || "free";

    if (!profile.stripe_connect_account_id) {
      return NextResponse.json({
        connected: false,
        onboardingComplete: false,
        completedSales: profile.completed_sales_count || 0,
        totalFeesPaid,
        subscriptionTier,
      });
    }

    const accountId = profile.stripe_connect_account_id;

    // 1) Short cache: collapse repeated status polls. M-MK19.
    const cached = await readConnectStatusCache(accountId);
    if (cached) {
      return NextResponse.json({
        connected: true,
        onboardingComplete: cached.onboardingComplete,
        chargesEnabled: cached.chargesEnabled,
        payoutsEnabled: cached.payoutsEnabled,
        completedSales: profile.completed_sales_count || 0,
        totalFeesPaid,
        subscriptionTier,
      });
    }

    // 2) DB mirror: if the capability columns are present we can answer from the
    // webhook-maintained mirror without hitting Stripe. We still call Stripe
    // when the mirror columns are missing (pre-migration) or onboarding looks
    // incomplete (so a freshly-finished onboarding reconciles promptly).
    const mirrorOnboarding = profile.stripe_connect_onboarding_complete ?? false;
    // Capability columns exist only on the richer (mirror) select shape; read
    // them through a narrow record view rather than widening to `any`.
    const mirror = profile as Record<string, unknown>;
    const mirrorCharges =
      mirrorColumnsPresent && mirror.stripe_connect_charges_enabled === true;
    const mirrorPayouts =
      mirrorColumnsPresent && mirror.stripe_connect_payouts_enabled === true;

    if (mirrorColumnsPresent && mirrorOnboarding) {
      const value: ConnectStatusCacheValue = {
        onboardingComplete: mirrorOnboarding,
        chargesEnabled: mirrorCharges,
        payoutsEnabled: mirrorPayouts,
      };
      await writeConnectStatusCache(accountId, value);
      return NextResponse.json({
        connected: true,
        ...value,
        completedSales: profile.completed_sales_count || 0,
        totalFeesPaid,
        subscriptionTier,
      });
    }

    // 3) Cache + mirror miss: reconcile against Stripe (only path that hits it).
    const account = await stripe.accounts.retrieve(accountId);
    const isComplete = account.charges_enabled && account.details_submitted;

    // Sync onboarding status if changed
    if (isComplete !== profile.stripe_connect_onboarding_complete) {
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_connect_onboarding_complete: isComplete })
        .eq("stripe_connect_account_id", accountId);
      await invalidateProfileCacheByProfileId(profile.id); // M-PAY11
    }

    const value: ConnectStatusCacheValue = {
      onboardingComplete: isComplete,
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
    };
    await writeConnectStatusCache(accountId, value);

    return NextResponse.json({
      connected: true,
      ...value,
      completedSales: profile.completed_sales_count || 0,
      totalFeesPaid,
      subscriptionTier,
    });
  } catch (error) {
    console.error("Connect status error:", error);
    return NextResponse.json(
      { error: "Failed to get seller status" },
      { status: 500 }
    );
  }
}
