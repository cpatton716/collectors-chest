/**
 * Promo trial (QR-exclusive 30-day premium) — shared helpers.
 *
 * Two layers live here:
 *
 *  1. CLIENT layer (localStorage flag) — set when a guest lands on the QR
 *     entry point (`/join/trial`) so the eventual checkout knows to request
 *     the promo. Display-hint only; it grants nothing on its own.
 *
 *  2. SERVER layer (L-PAY17) — the actual authorization. A SIGNED, QR-exclusive
 *     token (HMAC via `signedToken.ts` / B1, secret `PROMO_TRIAL_SECRET`,
 *     purpose `"promo-trial"`) is minted at the QR entry point and is the ONLY
 *     thing that authorizes the 30-day trial in B21's checkout gate. A client
 *     can no longer self-grant the trial by POSTing a boolean. One-time
 *     redemption is enforced against the migration-gated
 *     `profiles.promo_trial_eligible` column (graceful if the column is absent).
 *
 * Module hygiene: the server helpers LAZILY import `signedToken` (Node crypto)
 * so this module stays safe to import from the `"use client"` components that
 * use the localStorage flag — their bundle never pulls in Node-only code.
 */

/** Number of free trial days for the QR code promo */
export const PROMO_TRIAL_DAYS = 30;

/** localStorage key for the promo trial flag */
export const PROMO_TRIAL_STORAGE_KEY = "cc_promo_trial";

/**
 * localStorage key for the SIGNED promo-trial token minted server-side at the
 * QR entry point. Unlike the boolean flag above, this token is what actually
 * authorizes the trial in the checkout gate — it is stashed here only to carry
 * it across the sign-up / sign-in round-trip back to `/choose-plan`. It grants
 * nothing on its own; the server still verifies the signature + eligibility.
 */
export const PROMO_TRIAL_TOKEN_STORAGE_KEY = "cc_promo_trial_token";

// ============================================================================
// CLIENT layer — localStorage display hint (no authorization power)
// ============================================================================

/** Set the promo trial flag with timestamp (called from /join/trial page) */
export function setPromoTrialFlag(): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(PROMO_TRIAL_STORAGE_KEY, Date.now().toString());
  }
}

/**
 * Persist the server-minted promo-trial token so it survives the auth redirect
 * back to `/choose-plan`. Called from the QR entry point with the token minted
 * by the server component.
 */
export function setPromoTrialToken(token: string): void {
  if (typeof window !== "undefined" && token) {
    localStorage.setItem(PROMO_TRIAL_TOKEN_STORAGE_KEY, token);
  }
}

/** Read the stored server-minted promo-trial token (null if absent). */
export function getPromoTrialToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(PROMO_TRIAL_TOKEN_STORAGE_KEY);
  }
  return null;
}

/** Clear the stored promo-trial token (called after checkout is initiated). */
export function clearPromoTrialToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(PROMO_TRIAL_TOKEN_STORAGE_KEY);
  }
}

/** Check if the promo trial flag is set and not expired (7-day expiration) */
export function getPromoTrialFlag(): boolean {
  if (typeof window !== "undefined") {
    const value = localStorage.getItem(PROMO_TRIAL_STORAGE_KEY);
    if (!value) return false;
    const timestamp = parseInt(value, 10);
    if (isNaN(timestamp)) return false;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - timestamp < sevenDays;
  }
  return false;
}

/** Clear the promo trial flag + token (called after checkout is initiated) */
export function clearPromoTrialFlag(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(PROMO_TRIAL_STORAGE_KEY);
    localStorage.removeItem(PROMO_TRIAL_TOKEN_STORAGE_KEY);
  }
}

// ============================================================================
// SERVER layer — signed QR-exclusive token + migration-gated eligibility
// ============================================================================

/**
 * Env var holding the QR-exclusive promo-trial signing secret. Falls back to
 * CLERK_SECRET_KEY inside `signedToken` so no brand-new required env var is
 * forced into every deploy. Operators can set PROMO_TRIAL_SECRET to rotate it
 * independently later. MUST match B21's checkout gate.
 */
export const PROMO_TRIAL_SECRET_NAME = "PROMO_TRIAL_SECRET";

/** Marker every valid promo-trial token must carry in its signed payload. */
export const PROMO_TRIAL_PURPOSE = "promo-trial";

/** Default token lifetime — a QR poster should stay redeemable for a season. */
export const PROMO_TRIAL_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export interface PromoTrialTokenPayload {
  /** Must equal PROMO_TRIAL_PURPOSE for the token to authorize anything. */
  purpose: string;
  /** Issued-at epoch ms (audit/debug). */
  iat: number;
  /** Absolute expiry, epoch ms — enforced by signedToken.verify(). */
  exp?: number;
  /** Optional campaign/source tag (e.g. a convention slug) for analytics. */
  campaign?: string;
  [key: string]: unknown;
}

/**
 * Mint a signed, QR-exclusive promo-trial token. Called at the `/join/trial`
 * QR entry point (server side) and embedded in the link the guest carries to
 * checkout. Never accept a token from the request body — only one minted here
 * (and thus signed with our secret) verifies. L-PAY17.
 *
 * Lazily imports `signedToken` so this module is client-safe to import.
 */
export async function mintPromoTrialToken(options?: {
  /** Lifetime override (ms). Defaults to PROMO_TRIAL_TOKEN_TTL_MS. */
  ttlMs?: number;
  /** Optional campaign/source tag carried in the payload. */
  campaign?: string;
  /** Injectable clock for tests. */
  now?: number;
}): Promise<string> {
  const { sign } = await import("./signedToken");
  const now = options?.now ?? Date.now();
  const ttl = options?.ttlMs ?? PROMO_TRIAL_TOKEN_TTL_MS;
  const payload: PromoTrialTokenPayload = {
    purpose: PROMO_TRIAL_PURPOSE,
    iat: now,
    exp: now + ttl,
    ...(options?.campaign ? { campaign: options.campaign } : {}),
  };
  return sign(payload, PROMO_TRIAL_SECRET_NAME);
}

/**
 * Boundary check for a promo-trial token: valid signature + correct purpose +
 * unexpired. Pure (no DB) — eligibility persistence is checked separately via
 * `isPromoTrialEligible`. Mirrors B21's checkout gate so both agree.
 */
export async function verifyPromoTrialToken(
  token: string | null | undefined,
  now: number = Date.now()
): Promise<boolean> {
  if (!token) return false;
  const { verify } = await import("./signedToken");
  const result = verify<PromoTrialTokenPayload>(token, PROMO_TRIAL_SECRET_NAME, now);
  return result.valid && result.payload?.purpose === PROMO_TRIAL_PURPOSE;
}

/** True for the Postgres / PostgREST "undefined column" error codes (pre-migration). */
export function isMissingPromoColumnError(
  error: { code?: string; message?: string } | null
): boolean {
  if (!error) return false;
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /promo_trial_eligible/.test(error.message || "")
  );
}

/** Minimal Supabase surface we need — avoids importing the heavy client type. */
interface PromoSupabaseLike {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: unknown
      ): {
        single(): Promise<{
          data: { promo_trial_eligible?: boolean } | null;
          error: { code?: string; message?: string } | null;
        }>;
      };
    };
    update(values: Record<string, unknown>): {
      eq(
        column: string,
        value: unknown
      ): {
        eq(
          column: string,
          value: unknown
        ): Promise<{ error: { code?: string; message?: string } | null }>;
      };
    };
  };
}

/**
 * Whether this profile may still redeem the one-time promo trial. Reads the
 * migration-gated `profiles.promo_trial_eligible` flag. L-PAY17.
 *
 * Pre-migration the column doesn't exist; we FAIL CLOSED (return false) so a
 * forged/replayed token can't grant a trial before the persistence gate exists.
 * Pass the server Supabase client (admin) — kept as a param so this module
 * never statically imports `supabaseAdmin` (keeps it client-safe).
 */
export async function isPromoTrialEligible(
  client: PromoSupabaseLike,
  profileId: string
): Promise<boolean> {
  const { data, error } = await client
    .from("profiles")
    .select("promo_trial_eligible")
    .eq("id", profileId)
    .single();

  if (error) {
    if (isMissingPromoColumnError(error)) return false; // pre-migration: fail closed
    console.error("Error reading promo_trial_eligible:", error);
    return false;
  }
  return data?.promo_trial_eligible === true;
}

/**
 * Consume the one-time promo-trial eligibility (set it false) so the same
 * account can't redeem twice. Migration-gated: no-op if the column is absent.
 * Best-effort — failure is logged but does not block checkout.
 */
export async function consumePromoTrialEligibility(
  client: PromoSupabaseLike,
  profileId: string
): Promise<void> {
  const { error } = await client
    .from("profiles")
    .update({ promo_trial_eligible: false })
    .eq("id", profileId)
    .eq("promo_trial_eligible", true);

  if (error && !isMissingPromoColumnError(error)) {
    console.error("Error consuming promo_trial_eligible:", error);
  }
}
