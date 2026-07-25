import { computePlatformFeeDollars, feePercentForTier } from "./stripeConnect";
import { supabaseAdmin } from "./supabase";

// ============================================
// Types
// ============================================

// Re-exported from the neutral types module so existing
// `import { SubscriptionTier } from "@/lib/subscription"` callers keep working
// while breaking the subscription <-> stripeConnect import cycle. L-PAY10.
export type { SubscriptionTier, SubscriptionStatus } from "./subscriptionTypes";
import type { SubscriptionTier, SubscriptionStatus } from "./subscriptionTypes";

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  isTrialing: boolean;
  /**
   * True when the user was comp'd premium by an admin (`profiles.comp_granted`).
   * A comp'd user reads as premium (tier === "premium", status "active") rather
   * than "trialing" even though admin grants populate trial date fields. L-AD5.
   */
  isComp: boolean;
  trialEndsAt: Date | null;
  trialDaysRemaining: number;
  scansUsed: number;
  scansRemaining: number;
  purchasedScans: number;
  canScan: boolean;
  monthResetDate: Date;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
}

export interface ScanResult {
  success: boolean;
  remaining: number;
  message?: string;
}

// ============================================
// Constants
// ============================================

export const GUEST_SCAN_LIMIT = 5;
export const FREE_MONTHLY_SCAN_LIMIT = 10;
export const SCAN_PACK_AMOUNT = 10;

// "Unlimited" sentinel surfaced to clients for premium/trialing users.
export const UNLIMITED_SCANS = 999999;

// Stripe subscription statuses that should NOT be treated as an active
// (entitlement-granting) subscription. `incomplete`/`incomplete_expired` mean
// the initial payment never succeeded; `paused` means billing is suspended.
// M-PAY7. Used by the webhook status mapper and the double-subscription guard.
export const NON_ACTIVE_STRIPE_STATUSES = [
  "incomplete",
  "incomplete_expired",
  "paused",
  "canceled",
  "unpaid",
] as const;

// ============================================
// Pure derivation helpers (unit-tested; H-PAY3)
// ============================================

/**
 * Derive how many scans a user has left. Premium and trialing users are
 * unlimited; free users get the monthly allowance (never negative) plus any
 * purchased scans. Extracted as a pure function so the boundary cases are
 * unit-testable without a DB. H-PAY3.
 */
export function deriveScansRemaining(params: {
  isPremium: boolean;
  isTrialing: boolean;
  scansUsed: number;
  purchasedScans: number;
}): number {
  const { isPremium, isTrialing, scansUsed, purchasedScans } = params;
  if (isPremium || isTrialing) return UNLIMITED_SCANS;
  return Math.max(0, FREE_MONTHLY_SCAN_LIMIT - scansUsed) + Math.max(0, purchasedScans);
}

/**
 * Whether the user may perform another scan, given their derived remaining
 * count. Pure companion to {@link deriveScansRemaining}. H-PAY3.
 */
export function deriveCanScan(params: {
  isPremium: boolean;
  isTrialing: boolean;
  scansRemaining: number;
}): boolean {
  return params.isPremium || params.isTrialing || params.scansRemaining > 0;
}

/**
 * Resolved access state for a user, taking the admin-comp flag into account.
 *
 * Admin "grant premium" populates the trial date fields (trial_started_at /
 * trial_ends_at) AND sets `profiles.comp_granted`. Without the comp flag a
 * granted user would read back as "trialing" (because trial_ends_at is in the
 * future), which is wrong — a comp is permanent (until revoked), not a clock-
 * limited trial. So when `compGranted` is true we resolve the user as premium
 * with an "active" status and DO NOT report them as trialing. L-AD5 (read side).
 *
 * Pure so the comp / trial / paid resolution is unit-testable without a DB.
 */
export function deriveAccessState(params: {
  /** Raw subscription tier from the row (defaults to "free"). */
  tier: SubscriptionTier;
  /** Raw subscription status from the row. */
  status: SubscriptionStatus;
  /** Whether the trial window (trial_ends_at) is still in the future. */
  trialActive: boolean;
  /** `profiles.comp_granted` (treated as false when the column is absent). */
  compGranted: boolean;
}): {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  isPremium: boolean;
  isTrialing: boolean;
  isComp: boolean;
} {
  const { tier, status, trialActive, compGranted } = params;

  // A comp'd user is premium, full stop — never "trialing".
  if (compGranted) {
    return {
      tier: "premium",
      status: "active",
      isPremium: true,
      isTrialing: false,
      isComp: true,
    };
  }

  const isPremium = tier === "premium";
  // Paying/active premium users are not "trialing" even if a stale trial_ends_at
  // lingers. Only non-premium users with a live trial window read as trialing.
  const isTrialing = trialActive && !isPremium;

  return { tier, status, isPremium, isTrialing, isComp: false };
}

/**
 * Minimal profile shape needed to disambiguate multiple rows sharing a Stripe
 * customer id. M-PAY8.
 */
export interface StripeCustomerProfileRow {
  id: string;
  clerk_user_id: string;
  updated_at?: string | null;
  created_at?: string | null;
}

/**
 * Pick the single profile that should own a Stripe customer id when more than
 * one row matches. A UNIQUE index makes this a no-op in production (migration
 * M-PAY8), but until that index lands we may briefly see duplicates after a
 * customer-id collision. Choosing the most-recently-updated (then most-recently-
 * created) row is the least-surprising fallback: it follows whichever profile
 * the webhook most recently touched. Pure so multi-row handling is testable.
 */
export function pickProfileByStripeCustomerId<T extends StripeCustomerProfileRow>(
  rows: ReadonlyArray<T> | null | undefined
): T | null {
  if (!rows || rows.length === 0) return null;
  if (rows.length === 1) return rows[0];

  const ts = (r: T): number => {
    const v = r.updated_at || r.created_at;
    const n = v ? new Date(v).getTime() : NaN;
    return Number.isNaN(n) ? 0 : n;
  };

  return [...rows].sort((a, b) => ts(b) - ts(a))[0];
}

/**
 * Map a raw Stripe subscription status to our internal status. Statuses that
 * don't grant entitlement (incomplete / incomplete_expired / paused) must NOT
 * map to "active". M-PAY7 / M-PAY9.
 *
 * @param cancelAtPeriodEnd - when true, an otherwise-active subscription is
 *   reported as "canceled" so the UI can show the wind-down state. M-PAY9.
 */
export function mapStripeSubscriptionStatus(
  stripeStatus: string,
  cancelAtPeriodEnd: boolean = false
): SubscriptionStatus {
  switch (stripeStatus) {
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
    case "paused":
      // Not entitlement-granting and not yet a clean cancellation. Surface as
      // past_due so the UI nudges the user to fix payment without granting
      // premium access. M-PAY7.
      return "past_due";
    case "active":
    default:
      // A still-active subscription flagged to cancel at period end is shown
      // as canceled (access continues until currentPeriodEnd). M-PAY9.
      return cancelAtPeriodEnd ? "canceled" : "active";
  }
}

// ============================================
// Core Subscription Functions
// ============================================

/**
 * Get full subscription status for a user
 */
export async function getSubscriptionStatus(profileId: string): Promise<SubscriptionInfo | null> {
  // Base columns always present. `comp_granted` is migration-gated (L-AD5) —
  // requesting it on a pre-migration DB returns Postgres 42703 / PostgREST
  // PGRST204, so we attempt the comp column first and transparently retry
  // without it. This keeps the build/runtime safe before the migration lands.
  const baseColumns = `
      subscription_tier,
      subscription_status,
      stripe_customer_id,
      stripe_subscription_id,
      subscription_current_period_end,
      trial_started_at,
      trial_ends_at,
      scans_used_this_month,
      scan_month_start,
      purchased_scans`;

  type ProfileRow = Record<string, unknown> & { comp_granted?: boolean | null };
  let profile: ProfileRow | null = null;

  const withComp = await supabaseAdmin
    .from("profiles")
    .select(`${baseColumns},\n      comp_granted`)
    .eq("id", profileId)
    .single();

  if (withComp.error) {
    const missingColumn =
      (withComp.error as { code?: string }).code === "42703" ||
      (withComp.error as { code?: string }).code === "PGRST204" ||
      /comp_granted/.test(withComp.error.message || "");
    if (missingColumn) {
      // Pre-migration fallback: re-read without the comp column.
      const fallback = await supabaseAdmin
        .from("profiles")
        .select(baseColumns)
        .eq("id", profileId)
        .single();
      if (fallback.error || !fallback.data) return null;
      profile = fallback.data as unknown as ProfileRow;
    } else {
      return null;
    }
  } else if (withComp.data) {
    profile = withComp.data as unknown as ProfileRow;
  }

  if (!profile) return null;

  const now = new Date();
  const trialEndsAt = profile.trial_ends_at
    ? new Date(profile.trial_ends_at as string)
    : null;
  const trialActive = trialEndsAt !== null && trialEndsAt > now;

  // Resolve comp / trial / paid state. comp_granted absent (pre-migration) reads
  // as false, preserving the previous trial-field behavior. L-AD5 (read side).
  const compGranted = profile.comp_granted === true;
  const rawTier = (profile.subscription_tier as SubscriptionTier) || "free";
  const rawStatus = (profile.subscription_status as SubscriptionStatus) || "active";
  const access = deriveAccessState({
    tier: rawTier,
    status: rawStatus,
    trialActive,
    compGranted,
  });

  // Comp'd users get no trial countdown (they're permanent premium). Otherwise
  // surface the days left in the live trial window.
  const trialDaysRemaining = access.isTrialing
    ? Math.ceil((trialEndsAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Check if we need to reset monthly scans
  const scanMonthStart = new Date(profile.scan_month_start as string);
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let scansUsed = (profile.scans_used_this_month as number) || 0;

  // If scan_month_start is before current month, scans should be reset
  if (scanMonthStart < currentMonthStart) {
    scansUsed = 0;
    // Update the database (fire and forget)
    resetUserMonthlyScans(profileId).catch(console.error);
  }

  const purchasedScans = (profile.purchased_scans as number) || 0;

  // Calculate remaining scans via the shared pure derivation (H-PAY3).
  const scansRemaining = deriveScansRemaining({
    isPremium: access.isPremium,
    isTrialing: access.isTrialing,
    scansUsed,
    purchasedScans,
  });

  const canScan = deriveCanScan({
    isPremium: access.isPremium,
    isTrialing: access.isTrialing,
    scansRemaining,
  });

  // Calculate next reset date (1st of next month)
  const monthResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    tier: access.tier,
    status: access.status,
    isTrialing: access.isTrialing,
    isComp: access.isComp,
    trialEndsAt,
    trialDaysRemaining,
    scansUsed,
    scansRemaining,
    purchasedScans,
    canScan,
    monthResetDate,
    stripeCustomerId: profile.stripe_customer_id as string | null,
    stripeSubscriptionId: profile.stripe_subscription_id as string | null,
    currentPeriodEnd: profile.subscription_current_period_end
      ? new Date(profile.subscription_current_period_end as string)
      : null,
  };
}

/**
 * Atomically reserve a scan slot for a user.
 * Combines check + increment into one conditional UPDATE to prevent race conditions
 * where rapid scans all pass the check before any increment runs.
 *
 * Flow:
 * 1. Check tier/trial - premium/trialing get unlimited scans
 * 2. If scan_month_start is stale (previous month), reset count to 0 and set to 1 atomically
 * 3. Otherwise, conditional UPDATE: increment only if scans_used_this_month < limit
 * 4. If monthly quota exhausted, try purchased scans (also conditional)
 *
 * Returns { success, remaining, usedPurchased, message }
 */
export async function reserveScanSlot(
  profileId: string,
  source: "scan" | "import" | "key_hunt" = "scan"
): Promise<ScanResult & { usedPurchased?: boolean }> {
  // First, get subscription status to check tier/trial
  const status = await getSubscriptionStatus(profileId);

  if (!status) {
    return { success: false, remaining: 0, message: "User not found" };
  }

  // Premium and trialing users have unlimited scans - no reservation needed
  if (status.tier === "premium" || status.isTrialing) {
    await logScanUsage(profileId, source);
    return { success: true, remaining: UNLIMITED_SCANS };
  }

  // Check if monthly reset is needed by querying the raw DB value
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthStr = currentMonthStart.toISOString().split("T")[0];

  // Read the raw profile to see the actual DB scan_month_start
  const { data: rawProfile, error: readError } = await supabaseAdmin
    .from("profiles")
    .select("scan_month_start, scans_used_this_month, purchased_scans")
    .eq("id", profileId)
    .single();

  if (readError || !rawProfile) {
    console.error("Error reading profile for scan reservation:", readError);
    return { success: false, remaining: 0, message: "Database error" };
  }

  const dbMonthStart = new Date(rawProfile.scan_month_start);
  const needsReset = dbMonthStart < currentMonthStart;

  if (needsReset) {
    // Month is stale - reset count to 0 and immediately reserve 1 slot.
    // Conditional: only reset if scan_month_start is still stale (guards against concurrent reset).
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({
        scans_used_this_month: 1,
        scan_month_start: currentMonthStr,
      })
      .eq("id", profileId)
      .lt("scan_month_start", currentMonthStr)
      .select("scans_used_this_month, purchased_scans");

    if (error) {
      console.error("Error reserving scan slot (reset path):", error);
      return { success: false, remaining: 0, message: "Database error" };
    }

    if (data && data.length > 0) {
      // Successfully reset and reserved
      await logScanUsage(profileId, source);
      const remaining = Math.max(0, FREE_MONTHLY_SCAN_LIMIT - 1) + (data[0].purchased_scans || 0);
      return { success: true, remaining };
    }

    // Another request already reset the month - fall through to normal path
    // Re-read the current count since it was just reset by the other request
    const { data: freshProfile } = await supabaseAdmin
      .from("profiles")
      .select("scans_used_this_month, purchased_scans")
      .eq("id", profileId)
      .single();

    if (freshProfile) {
      rawProfile.scans_used_this_month = freshProfile.scans_used_this_month;
      rawProfile.purchased_scans = freshProfile.purchased_scans;
    }
  }

  // Normal path: atomically increment only if below the limit.
  // The .lt() condition makes this atomic - concurrent requests that both read count=9
  // will both try UPDATE ... SET count=count+1 WHERE count < 10, but Postgres row-level
  // locking means only one sees count=9; the other sees count=10 and gets 0 rows.
  //
  // IMPORTANT: We set the value to scans_used_this_month + 1 using the DB's current value
  // via the conditional filter, not a stale JS variable.
  const currentDbCount = rawProfile.scans_used_this_month || 0;
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({
      scans_used_this_month: currentDbCount + 1,
    })
    .eq("id", profileId)
    .eq("scans_used_this_month", currentDbCount)
    .lt("scans_used_this_month", FREE_MONTHLY_SCAN_LIMIT)
    .select("scans_used_this_month, purchased_scans");

  if (updateError) {
    console.error("Error reserving scan slot:", updateError);
    return { success: false, remaining: status.scansRemaining, message: "Database error" };
  }

  if (updated && updated.length > 0) {
    // Successfully reserved a monthly scan slot
    await logScanUsage(profileId, source);
    const remaining = Math.max(0, FREE_MONTHLY_SCAN_LIMIT - updated[0].scans_used_this_month) +
      (updated[0].purchased_scans || 0);
    return { success: true, remaining };
  }

  // Monthly quota exhausted - try purchased scans with conditional decrement
  const purchasedScans = rawProfile.purchased_scans || 0;
  if (purchasedScans > 0) {
    const { data: purchaseData, error: purchaseError } = await supabaseAdmin
      .from("profiles")
      .update({
        purchased_scans: purchasedScans - 1,
      })
      .eq("id", profileId)
      .gt("purchased_scans", 0)
      .select("purchased_scans");

    if (purchaseError) {
      console.error("Error decrementing purchased scans:", purchaseError);
      return { success: false, remaining: 0, message: "Database error" };
    }

    if (purchaseData && purchaseData.length > 0) {
      await logScanUsage(profileId, source);
      return { success: true, remaining: purchaseData[0].purchased_scans, usedPurchased: true };
    }
  }

  // No scans available
  return {
    success: false,
    remaining: 0,
    message: "Scan limit reached. Upgrade to Premium or buy more scans.",
  };
}

/**
 * Release a previously reserved scan slot (rollback on failure).
 * Call this if the AI analysis fails after reserveScanSlot succeeded.
 */
export async function releaseScanSlot(
  profileId: string,
  usedPurchased: boolean = false
): Promise<void> {
  if (usedPurchased) {
    // Restore the purchased scan
    const { error } = await supabaseAdmin.rpc("increment_field", {
      row_id: profileId,
      table_name: "profiles",
      field_name: "purchased_scans",
      amount: 1,
    }).single();

    // Fallback: if RPC doesn't exist, do a read-then-write
    if (error) {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("purchased_scans")
        .eq("id", profileId)
        .single();

      if (data) {
        await supabaseAdmin
          .from("profiles")
          .update({ purchased_scans: (data.purchased_scans || 0) + 1 })
          .eq("id", profileId);
      }
    }
  } else {
    // Decrement monthly scans_used_this_month (but not below 0)
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("scans_used_this_month")
      .eq("id", profileId)
      .single();

    if (data && data.scans_used_this_month > 0) {
      await supabaseAdmin
        .from("profiles")
        .update({ scans_used_this_month: data.scans_used_this_month - 1 })
        .eq("id", profileId);
    }
  }
}

/**
 * Log scan usage for analytics
 */
async function logScanUsage(
  profileId: string,
  source: "scan" | "import" | "key_hunt"
): Promise<void> {
  const { error } = await supabaseAdmin.from("scan_usage").insert({
    user_id: profileId,
    source,
  });

  if (error) {
    console.error("Error logging scan usage:", error);
  }
}

/**
 * Reset monthly scan counts (called on first access of new month)
 */
async function resetUserMonthlyScans(profileId: string): Promise<void> {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  await supabaseAdmin
    .from("profiles")
    .update({
      scans_used_this_month: 0,
      scan_month_start: firstOfMonth.toISOString().split("T")[0],
    })
    .eq("id", profileId);
}

/**
 * Reset monthly scans for ALL free users (cron job)
 * Should be called on the 1st of each month
 */
export async function resetAllMonthlyScans(): Promise<{ updated: number }> {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      scans_used_this_month: 0,
      scan_month_start: firstOfMonth.toISOString().split("T")[0],
    })
    .eq("subscription_tier", "free")
    .lt("scan_month_start", firstOfMonth.toISOString().split("T")[0])
    .select("id");

  if (error) {
    console.error("Error resetting monthly scans:", error);
    return { updated: 0 };
  }

  return { updated: data?.length || 0 };
}

// ============================================
// Trial Functions
// ============================================

/**
 * Check if user has already used their trial
 */
export async function hasUsedTrial(profileId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("trial_started_at")
    .eq("id", profileId)
    .single();

  if (error || !data) return false;
  return data.trial_started_at !== null;
}

/**
 * Start a 7-day trial for a user
 */
export async function startTrial(
  profileId: string
): Promise<{ success: boolean; trialEndsAt?: Date; error?: string }> {
  // Check if trial already used
  const alreadyUsed = await hasUsedTrial(profileId);
  if (alreadyUsed) {
    return { success: false, error: "Trial already used" };
  }

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      subscription_status: "trialing",
    })
    .eq("id", profileId);

  if (error) {
    console.error("Error starting trial:", error);
    return { success: false, error: "Database error" };
  }

  return { success: true, trialEndsAt };
}

// ============================================
// Scan Pack Functions
// ============================================

/**
 * Add purchased scans to a user's account
 */
export async function addPurchasedScans(
  profileId: string,
  amount: number = SCAN_PACK_AMOUNT
): Promise<{ success: boolean; totalPurchased: number }> {
  // Get current purchased scans
  const { data: profile, error: fetchError } = await supabaseAdmin
    .from("profiles")
    .select("purchased_scans")
    .eq("id", profileId)
    .single();

  if (fetchError || !profile) {
    return { success: false, totalPurchased: 0 };
  }

  const newTotal = (profile.purchased_scans || 0) + amount;

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ purchased_scans: newTotal })
    .eq("id", profileId);

  if (error) {
    console.error("Error adding purchased scans:", error);
    return { success: false, totalPurchased: profile.purchased_scans || 0 };
  }

  return { success: true, totalPurchased: newTotal };
}

// ============================================
// Stripe Integration Functions
// ============================================

/**
 * Update user's Stripe customer ID
 */
export async function setStripeCustomerId(
  profileId: string,
  stripeCustomerId: string
): Promise<void> {
  await supabaseAdmin
    .from("profiles")
    .update({ stripe_customer_id: stripeCustomerId })
    .eq("id", profileId);
}

/**
 * Get profile by Stripe customer ID (for webhooks).
 *
 * Uses a non-`.single()` read so a duplicate stripe_customer_id (possible until
 * the UNIQUE index in migration M-PAY8 lands) doesn't throw "multiple rows
 * returned" and silently drop a webhook. On a multi-row match we log a warning
 * and deterministically pick the most-recently-updated profile via
 * {@link pickProfileByStripeCustomerId}. M-PAY8.
 */
export async function getProfileByStripeCustomerId(
  stripeCustomerId: string
): Promise<{ id: string; clerk_user_id: string } | null> {
  // Try to pull ordering columns so multi-row disambiguation is meaningful;
  // updated_at/created_at are standard on this table. If they happen to be
  // absent the picker still works (falls back to first row).
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, clerk_user_id, updated_at, created_at")
    .eq("stripe_customer_id", stripeCustomerId);

  if (error) {
    console.error("Error fetching profile by stripe customer id:", error);
    return null;
  }

  const rows = (data || []) as StripeCustomerProfileRow[];
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    console.warn(
      `getProfileByStripeCustomerId: ${rows.length} profiles share stripe_customer_id ${stripeCustomerId}; picking most recent. Apply the UNIQUE index (M-PAY8).`
    );
  }

  const chosen = pickProfileByStripeCustomerId(rows);
  if (!chosen) return null;
  return { id: chosen.id, clerk_user_id: chosen.clerk_user_id };
}

/**
 * Upgrade user to premium (called from webhook)
 */
export async function upgradeToPremium(
  profileId: string,
  stripeSubscriptionId: string,
  currentPeriodEnd: Date,
  isTrialing: boolean = false
): Promise<void> {
  const updates: Record<string, unknown> = {
    subscription_tier: "premium",
    subscription_status: isTrialing ? "trialing" : "active",
    stripe_subscription_id: stripeSubscriptionId,
    subscription_current_period_end: currentPeriodEnd.toISOString(),
  };

  // Only clear trial_ends_at if not trialing (they converted to paid)
  if (!isTrialing) {
    updates.trial_ends_at = null;
  }

  await supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("id", profileId);
}

/**
 * Downgrade user to free (called from webhook on cancellation)
 */
export async function downgradeToFree(profileId: string): Promise<void> {
  await supabaseAdmin
    .from("profiles")
    .update({
      subscription_tier: "free",
      subscription_status: "active",
      stripe_subscription_id: null,
      subscription_current_period_end: null,
      trial_ends_at: null,
    })
    .eq("id", profileId);
}

/**
 * Update subscription status (called from webhook)
 */
export async function updateSubscriptionStatus(
  profileId: string,
  status: SubscriptionStatus,
  currentPeriodEnd?: Date
): Promise<void> {
  const updates: Record<string, unknown> = {
    subscription_status: status,
  };

  if (currentPeriodEnd) {
    updates.subscription_current_period_end = currentPeriodEnd.toISOString();
  }

  await supabaseAdmin.from("profiles").update(updates).eq("id", profileId);
}

// ============================================
// Duplicate-subscription guard (H-PAY2)
// ============================================

/**
 * Stripe subscription statuses that represent a live, entitlement-granting (or
 * about-to-be) subscription. Creating a second checkout while one of these is
 * present would double-bill the customer. H-PAY2.
 */
const LIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "incomplete", // payment in progress - don't start a second one on top
]);

/**
 * Given a list of a customer's Stripe subscriptions, decide whether starting a
 * NEW subscription checkout should be rejected because a live one already
 * exists. Pure so it can be unit-tested without the Stripe SDK. H-PAY2.
 *
 * Accepts a minimal shape (`{ status }`) so tests don't need full Stripe types.
 */
export function hasLiveSubscription(
  subscriptions: ReadonlyArray<{ status: string }>
): boolean {
  return subscriptions.some((s) => LIVE_SUBSCRIPTION_STATUSES.has(s.status));
}

// ============================================
// Listing Limit Functions
// ============================================

/**
 * Check how many active listings a user has
 */
async function getActiveListingCount(profileId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("auctions")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", profileId)
    .in("status", ["active", "pending"]);

  if (error) {
    console.error("Error counting listings:", error);
    return 0;
  }

  return count || 0;
}

/**
 * Check if user can create a new listing
 */
export async function canCreateListing(
  profileId: string
): Promise<{ canCreate: boolean; currentCount: number; limit: number }> {
  const status = await getSubscriptionStatus(profileId);
  const currentCount = await getActiveListingCount(profileId);

  if (!status) {
    return { canCreate: false, currentCount: 0, limit: 0 };
  }

  // Premium users have unlimited listings
  if (status.tier === "premium" || status.isTrialing) {
    return { canCreate: true, currentCount, limit: 999999 };
  }

  // Free users limited to 3 listings
  const FREE_LISTING_LIMIT = 3;
  return {
    canCreate: currentCount < FREE_LISTING_LIMIT,
    currentCount,
    limit: FREE_LISTING_LIMIT,
  };
}

// ============================================
// Transaction Fee Functions
// ============================================

/**
 * Get transaction fee percentage for a user. Delegates to the shared
 * tier→percent helper so the 5/8 split lives in exactly one place. M-PAY10.
 */
export async function getTransactionFeePercent(profileId: string): Promise<number> {
  const status = await getSubscriptionStatus(profileId);
  return feePercentForTier(status?.tier, status?.isTrialing ?? false);
}

/**
 * Calculate platform fee for a sale (dollar amounts). Routes through the
 * canonical cents-based floored fee function so rounding matches checkout
 * and the fees-paid summary exactly. M-PAY10.
 */
export async function calculatePlatformFee(
  profileId: string,
  saleAmount: number
): Promise<{ feePercent: number; feeAmount: number; sellerReceives: number }> {
  const feePercent = await getTransactionFeePercent(profileId);
  const feeAmount = computePlatformFeeDollars(saleAmount, feePercent);
  const sellerReceives = saleAmount - feeAmount;

  return { feePercent, feeAmount, sellerReceives };
}
