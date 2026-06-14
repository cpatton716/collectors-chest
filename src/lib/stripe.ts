import Stripe from "stripe";

/**
 * Single shared Stripe client + API version.
 *
 * Previously every billing/checkout/connect/webhook route instantiated its own
 * `new Stripe(...)` with the API version string copy-pasted inline. That drifted
 * over time and made an API-version bump a multi-file edit. L-PAY14: instantiate
 * once here and import everywhere.
 *
 * The client is `null` when STRIPE_SECRET_KEY is unset so callers can degrade
 * gracefully in environments without Stripe configured (CI, preview builds).
 */
export const STRIPE_API_VERSION = "2025-12-15.clover" as const;

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
    })
  : null;

/**
 * Map a thrown Stripe (or generic) error to a user-facing status code and
 * message while preserving the full error for server-side logging. L-PAY18.
 *
 * Card/validation failures are surfaced to the client (400/402) with the
 * Stripe-provided message; everything else collapses to a generic 500 so we
 * never leak internal details.
 */
export function mapStripeError(error: unknown): { status: number; message: string } {
  if (error instanceof Stripe.errors.StripeError) {
    switch (error.type) {
      case "StripeCardError":
        // Card was declined - safe, user-facing message from Stripe.
        return { status: 402, message: error.message || "Your card was declined." };
      case "StripeInvalidRequestError":
        return { status: 400, message: error.message || "Invalid payment request." };
      case "StripeRateLimitError":
        return { status: 429, message: "Too many requests. Please try again shortly." };
      case "StripeAuthenticationError":
      case "StripeAPIError":
      case "StripeConnectionError":
      default:
        return { status: 502, message: "Payment provider error. Please try again." };
    }
  }
  return { status: 500, message: "Failed to process payment request." };
}
