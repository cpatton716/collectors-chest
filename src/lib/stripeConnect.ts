import type { SubscriptionTier } from "./subscription";

/**
 * Calculate the destination (seller) amount and platform fee in cents.
 * Uses Math.floor on fee so rounding is seller-favorable.
 */
export function calculateDestinationAmount(
  totalCents: number,
  platformFeePercent: number
): { sellerAmount: number; platformFee: number } {
  if (totalCents <= 0) return { sellerAmount: 0, platformFee: 0 };
  const platformFee = Math.floor(totalCents * (platformFeePercent / 100));
  const sellerAmount = totalCents - platformFee;
  return { sellerAmount, platformFee };
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
