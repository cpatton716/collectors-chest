/**
 * Determines if a user should be redirected away from the choose-plan page.
 * Premium and trialing users already have a plan selected.
 */
export function shouldRedirectAway(tier: string, isTrialing: boolean): boolean {
  return tier === "premium" || isTrialing;
}

/**
 * Determines what action to take when user clicks the trial button.
 * If trial is available, start it directly. Otherwise, fall back to Stripe checkout.
 */
export function getTrialAction(trialAvailable: boolean): "startTrial" | "stripeCheckout" {
  return trialAvailable ? "startTrial" : "stripeCheckout";
}
