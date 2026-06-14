import type { SubscriptionTier } from "./subscription";

/**
 * Minimum platform fee in cents. Applied as a floor to the percent-based
 * fee so Stripe's $0.30 + 2.9% processing cost doesn't push the platform
 * underwater on small sales.
 *
 * At 8% (free tier), the percent-fee alone breaks even at ~$5.88. At 5%
 * (premium), break-even is ~$14.29. A $0.75 floor keeps any sale safely
 * above Stripe's processing cost. Above $9.38 (8%) and $15 (5%) the
 * percent-fee already exceeds the floor, so the floor is invisible to
 * typical comic sales.
 */
export const MIN_PLATFORM_FEE_CENTS = 75;

/** Platform fee percent by tier. Premium (and trialing) sellers pay less. */
export const PREMIUM_FEE_PERCENT = 5;
export const FREE_FEE_PERCENT = 8;

/**
 * Resolve the platform fee percent for a tier. Trialing users get the premium
 * rate. This is the single source of truth for the percent; previously the
 * 5/8 split was duplicated in subscription.ts and the connect/status route.
 * M-PAY10.
 */
export function feePercentForTier(
  tier: SubscriptionTier | string | null | undefined,
  isTrialing: boolean = false
): number {
  if (tier === "premium" || isTrialing) return PREMIUM_FEE_PERCENT;
  return FREE_FEE_PERCENT;
}

/**
 * Canonical cents-based, floored platform-fee calculation. ALL fee math
 * funnels through this so rounding behavior is identical everywhere
 * (checkout transfer amount, fees-paid summaries, dollar-based helpers). M-PAY10.
 *
 * Fee = max(percent-fee, MIN_PLATFORM_FEE_CENTS), capped at the sale total
 * so the seller can never receive a negative payout. Percent-fee uses
 * Math.floor so percent-driven rounding is seller-favorable; the floor takes
 * precedence when the sale is small enough that the percent computation falls
 * below it.
 */
export function computePlatformFeeCents(
  totalCents: number,
  platformFeePercent: number
): number {
  if (totalCents <= 0) return 0;
  const percentFee = Math.floor(totalCents * (platformFeePercent / 100));
  return Math.min(totalCents, Math.max(percentFee, MIN_PLATFORM_FEE_CENTS));
}

/**
 * Calculate the destination (seller) amount and platform fee in cents.
 * Thin wrapper over the canonical {@link computePlatformFeeCents}.
 */
export function calculateDestinationAmount(
  totalCents: number,
  platformFeePercent: number
): { sellerAmount: number; platformFee: number } {
  const platformFee = computePlatformFeeCents(totalCents, platformFeePercent);
  return { sellerAmount: totalCents - platformFee, platformFee };
}

/**
 * Dollar-amount convenience over the canonical cents-based fee. Returns the
 * fee in dollars (2dp) for display/summary code that works in dollars. M-PAY10.
 */
export function computePlatformFeeDollars(
  saleDollars: number,
  platformFeePercent: number
): number {
  const feeCents = computePlatformFeeCents(Math.round(saleDollars * 100), platformFeePercent);
  return feeCents / 100;
}

/**
 * Check if a seller has completed Stripe Connect onboarding.
 */
export function isConnectOnboardingComplete(
  connectAccountId: string | null | undefined,
  onboardingComplete: boolean | undefined
): boolean {
  return !!connectAccountId && !!onboardingComplete;
}

/**
 * Determine whether to show the premium upsell modal.
 * Triggers on every 3rd completed sale (3, 6, 9, ...) for free-tier sellers.
 */
export function shouldShowPremiumUpsell(
  tier: SubscriptionTier | string,
  completedSalesCount: number
): boolean {
  if (tier === "premium" || tier === "trialing") return false;
  if (completedSalesCount <= 0) return false;
  return completedSalesCount % 3 === 0;
}

/**
 * Build the return URL for after Connect onboarding completes.
 */
export function buildOnboardingReturnUrl(
  baseUrl: string,
  accountId: string
): string {
  return `${baseUrl}/api/connect/onboarding-return?account_id=${accountId}`;
}

/**
 * Build the refresh URL for when Connect onboarding link expires.
 */
export function buildOnboardingRefreshUrl(
  baseUrl: string,
  accountId: string
): string {
  return `${baseUrl}/api/connect/onboarding-refresh?account_id=${accountId}`;
}
