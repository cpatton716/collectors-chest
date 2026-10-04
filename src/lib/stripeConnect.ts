import type { SubscriptionTier } from "./subscriptionTypes";

/**
 * Minimum platform fee in cents. Under the destination-charge model (M-MK16),
 * the seller is merchant-of-record and bears Stripe's 2.9% + $0.30 processing
 * cost; the platform's `application_fee_amount` is a CLEAN cut with no Stripe
 * cost netted against it. The floor therefore guarantees the platform a minimum
 * gross take per sale rather than protecting it from going underwater on Stripe
 * fees (which it no longer pays).
 *
 * The percent-fee crosses the $0.75 floor at $9.38 (8% free tier) and $15.00
 * (5% premium). Below those points the floor wins; above them the percent-fee
 * is already larger, so the floor is invisible to typical comic sales.
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
 * (checkout `application_fee_amount`, fees-paid summaries, dollar-based
 * helpers). M-PAY10 / M-MK16.
 *
 * Under destination charges this value is passed verbatim as Stripe's
 * `application_fee_amount` - the platform's clean cut. (Stripe's processing
 * cost is settled separately against the seller's balance.)
 *
 * Fee = max(percent-fee, MIN_PLATFORM_FEE_CENTS), capped at the sale total
 * so the application fee can never exceed the charge. Percent-fee uses
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
 * Calculate the platform fee and the seller's gross share in cents for a
 * destination charge. Thin wrapper over the canonical
 * {@link computePlatformFeeCents}.
 *
 * `platformFee` is the Stripe `application_fee_amount`. `sellerAmount` is the
 * seller's gross before Stripe deducts its 2.9% + $0.30 processing cost from
 * the seller's balance (the seller is merchant-of-record). M-MK16.
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
 * Stripe's standard US card processing rate (2.9% + $0.30). Under destination
 * charges with `on_behalf_of` (M-MK16) the seller bears this. Used ONLY for
 * customer-facing estimates (FAQ/pricing copy) - actual Stripe fees can differ
 * (international cards, currency conversion, etc.) and are settled by Stripe.
 */
export const STRIPE_PROCESSING_PERCENT = 2.9;
export const STRIPE_PROCESSING_FIXED_CENTS = 30;

/**
 * Estimated Stripe processing fee in cents at the standard card rate.
 */
export function estimateStripeProcessingFeeCents(totalCents: number): number {
  if (totalCents <= 0) return 0;
  return Math.round(totalCents * (STRIPE_PROCESSING_PERCENT / 100)) + STRIPE_PROCESSING_FIXED_CENTS;
}

/**
 * Estimated seller take-home for a sale: total minus the platform fee (via the
 * canonical {@link computePlatformFeeCents}) minus the estimated Stripe
 * processing fee. Never negative. For display copy only.
 */
export function estimateSellerTakeHomeCents(
  totalCents: number,
  platformFeePercent: number
): { platformFeeCents: number; stripeFeeCents: number; takeHomeCents: number } {
  const platformFeeCents = computePlatformFeeCents(totalCents, platformFeePercent);
  const stripeFeeCents = estimateStripeProcessingFeeCents(totalCents);
  const takeHomeCents = Math.max(0, totalCents - platformFeeCents - stripeFeeCents);
  return { platformFeeCents, stripeFeeCents, takeHomeCents };
}

/**
 * Plain-English seller-fee FAQ answer, with worked $100 examples derived from
 * the real fee constants so the copy can't drift from the checkout math.
 * Shared by the Pricing page FAQ and the Navigation FAQ.
 */
export function buildSellerFeeFaqAnswer(): string {
  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const sale = 10000;
  const free = estimateSellerTakeHomeCents(sale, FREE_FEE_PERCENT);
  const premium = estimateSellerTakeHomeCents(sale, PREMIUM_FEE_PERCENT);
  // Sale price at which the percent fee overtakes the $0.75 minimum.
  const floorCrossover = (pct: number) => fmt(Math.ceil(MIN_PLATFORM_FEE_CENTS / (pct / 100)));
  return (
    `When you sell a comic in the Shop, two fees come out of the sale. ` +
    `First, our platform fee: ${FREE_FEE_PERCENT}% on Free, ${PREMIUM_FEE_PERCENT}% on Premium, ` +
    `with a ${fmt(MIN_PLATFORM_FEE_CENTS)} minimum per sale (the minimum only applies to sales under ` +
    `${floorCrossover(FREE_FEE_PERCENT)} on Free or ${floorCrossover(PREMIUM_FEE_PERCENT)} on Premium). ` +
    `The rate is locked in when you create the listing, so changing tiers later doesn't change it. ` +
    `Second, Stripe's card processing fee (typically ${STRIPE_PROCESSING_PERCENT}% + ` +
    `${fmt(STRIPE_PROCESSING_FIXED_CENTS)}), which Stripe charges you directly as the seller. ` +
    `Example: a ${fmt(sale)} sale on Free = ` +
    `${fmt(free.platformFeeCents)} platform fee + ${fmt(free.stripeFeeCents)} Stripe fee, so you take home ` +
    `about ${fmt(free.takeHomeCents)}. On Premium: ${fmt(premium.platformFeeCents)} + ` +
    `${fmt(premium.stripeFeeCents)}, so you take home about ${fmt(premium.takeHomeCents)}.`
  );
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
