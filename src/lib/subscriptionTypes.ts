/**
 * Neutral home for subscription type aliases shared between subscription.ts and
 * stripeConnect.ts. Extracted to break the import cycle:
 *   subscription.ts -> stripeConnect.ts (runtime fee helpers)
 *   stripeConnect.ts -> subscription.ts (SubscriptionTier type)
 * Both now import the type from here, so neither imports the other for it. L-PAY10.
 */
export type SubscriptionTier = "free" | "premium";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled";
