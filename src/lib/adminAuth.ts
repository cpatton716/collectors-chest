/**
 * Centralized admin authentication and audit logging helpers
 * Used by all admin API routes for consistent authorization and accountability
 */
import { auth } from "@clerk/nextjs/server";

import { getProfileByClerkId } from "./db";
import { supabaseAdmin } from "./supabase";

// Admin action types for audit logging
export type AdminAction =
  | "search_users"
  | "view_profile"
  | "reset_trial"
  | "grant_premium"
  | "suspend"
  | "unsuspend"
  | "view_reports"
  | "update_report"
  // Mutating content-moderation actions (barcode/cover review queues, curated
  // key-comics DB). Logged for accountability the same as user actions.
  | "approve_barcode"
  | "reject_barcode"
  | "approve_cover"
  | "reject_cover"
  | "add_key_comic"
  | "update_key_comic"
  | "delete_key_comic";

/**
 * Actions where a missing audit-log entry is unacceptable: if logging fails we
 * surface the error to the caller instead of swallowing it. These are the
 * irreversible / high-impact mutations.
 */
const HIGH_IMPACT_ACTIONS: ReadonlySet<AdminAction> = new Set<AdminAction>([
  "grant_premium",
  "suspend",
  "unsuspend",
  "reset_trial",
  "delete_key_comic",
]);

export interface AdminProfile {
  id: string;
  clerk_user_id: string;
  email: string | null;
  is_admin: boolean;
}

/**
 * Get the current user's profile and check if they are an admin
 * Returns null if not authenticated or not an admin
 */
export async function getAdminProfile(): Promise<AdminProfile | null> {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, clerk_user_id, email, is_admin")
    .eq("clerk_user_id", userId)
    .single();

  if (error || !profile) {
    return null;
  }

  if (!profile.is_admin) {
    return null;
  }

  return profile as AdminProfile;
}

/**
 * Log an admin action to the audit log.
 * Call this after every admin action for accountability.
 *
 * For low-impact actions a logging failure is swallowed (logged + Sentry) so it
 * never blocks the operation. For HIGH_IMPACT_ACTIONS we re-throw so the caller
 * can abort - an unauditable irreversible mutation must not silently proceed.
 */
export async function logAdminAction(
  adminId: string,
  action: AdminAction,
  targetUserId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  let caught: unknown = null;

  try {
    const { error } = await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: adminId,
      action,
      target_user_id: targetUserId || null,
      details: details || null,
    });
    if (error) caught = error;
  } catch (err) {
    caught = err;
  }

  if (caught) {
    console.error("Failed to log admin action:", caught);
    reportAdminLogFailure(caught, { adminId, action, targetUserId });

    if (HIGH_IMPACT_ACTIONS.has(action)) {
      throw caught instanceof Error
        ? caught
        : new Error(`Failed to record audit log for high-impact action "${action}"`);
    }
  }
}

/**
 * Route an audit-log failure to Sentry (best-effort, lazily imported so the
 * SDK isn't pulled into bundles that never log admin actions).
 */
function reportAdminLogFailure(
  error: unknown,
  context: { adminId: string; action: AdminAction; targetUserId?: string }
): void {
  try {
    const Sentry = require("@sentry/nextjs");
    Sentry.captureException(error, {
      tags: { area: "admin_audit_log", admin_action: context.action },
      extra: { adminId: context.adminId, targetUserId: context.targetUserId },
    });
  } catch {
    // Sentry unavailable (e.g., tests) - console.error above is the fallback.
  }
}

/**
 * Get a user profile by ID (for admin viewing)
 */
export async function getProfileById(profileId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(
      `
      id,
      clerk_user_id,
      email,
      display_name,
      username,
      subscription_tier,
      subscription_status,
      stripe_customer_id,
      stripe_subscription_id,
      trial_started_at,
      trial_ends_at,
      scans_used_this_month,
      scan_month_start,
      purchased_scans,
      is_admin,
      is_suspended,
      suspended_at,
      suspended_reason,
      created_at,
      updated_at
    `
    )
    .eq("id", profileId)
    .single();

  if (error) {
    return null;
  }

  return data;
}

/**
 * Search users by email (partial match)
 */
export async function searchUsersByEmail(email: string, limit: number = 20) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(
      `
      id,
      clerk_user_id,
      email,
      display_name,
      username,
      subscription_tier,
      subscription_status,
      is_suspended,
      created_at
    `
    )
    .ilike("email", `%${email}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Get scan count for a user in the current month
 */
export async function getUserScanCount(profileId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count, error } = await supabaseAdmin
    .from("scan_usage")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profileId)
    .gte("scanned_at", startOfMonth.toISOString());

  if (error) {
    return 0;
  }

  return count || 0;
}

/**
 * Reset a user's trial (clears trial_started_at, trial_ends_at, and resets subscription_status)
 */
export async function resetUserTrial(profileId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      trial_started_at: null,
      trial_ends_at: null,
      subscription_status: "active", // Reset status so user can start a new trial
    })
    .eq("id", profileId);

  if (error) {
    throw error;
  }
}

/**
 * Decide whether an admin "grant premium" should be refused because the target
 * is already a paying customer. Comping a paying user would clobber their real
 * Stripe-driven trial/subscription dates and silently downgrade them when the
 * grant expires. A live `stripe_subscription_id` (or a non-comp paid source) is
 * the signal that Stripe -- not the admin -- owns this account's billing state.
 *
 * Exported so the paying-user guard is unit-testable in isolation (L-AD5).
 */
export function isPayingSubscriber(profile: {
  stripe_subscription_id?: string | null;
  subscription_source?: string | null;
}): boolean {
  if (profile.stripe_subscription_id) {
    return true;
  }
  const source = profile.subscription_source;
  // "comped" / "trial" / null are not paying; anything else implies real billing.
  return !!source && source !== "comped" && source !== "trial";
}

/**
 * Grant a user free (comp) premium access for a specified number of days.
 *
 * L-AD5: a comp grant is NOT the same as a trial -- it sets the new
 * `comp_granted` flag so access-state resolution can distinguish granted from
 * trialing. It MUST refuse to overwrite an active paying customer's
 * Stripe-owned trial/subscription dates.
 *
 * Migration-gated (REQUIRED migration: profiles.comp_granted): we attempt the
 * update WITH `comp_granted` first; if the column doesn't exist yet (pre-migration)
 * we retry WITHOUT it so the route keeps working and falls back to the current
 * trial-field behavior. Remove the fallback once the migration has landed.
 */
export async function grantPremiumAccess(
  profileId: string,
  days: number = 30
): Promise<{ expiresAt: string }> {
  // Guard: never clobber an active paying customer's billing dates.
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("stripe_subscription_id, subscription_source")
    .eq("id", profileId)
    .single();

  if (existing && isPayingSubscriber(existing)) {
    throw new Error(
      "Cannot comp an active paying subscriber; this would overwrite their Stripe-managed subscription dates."
    );
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  const baseUpdate = {
    trial_started_at: new Date().toISOString(),
    trial_ends_at: expiresAt.toISOString(),
  };

  // Try with the comp flag first (post-migration path).
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ ...baseUpdate, comp_granted: true })
    .eq("id", profileId);

  if (error) {
    // Pre-migration fallback: the `comp_granted` column may not exist yet
    // (Postgres "column ... does not exist" => code 42703). Retry without it so
    // the grant still applies via the existing trial fields.
    const isMissingColumn =
      (error as { code?: string }).code === "42703" ||
      /comp_granted/.test(error.message || "");
    if (!isMissingColumn) {
      throw error;
    }
    const { error: fallbackError } = await supabaseAdmin
      .from("profiles")
      .update(baseUpdate)
      .eq("id", profileId);
    if (fallbackError) {
      throw fallbackError;
    }
  }

  return { expiresAt: expiresAt.toISOString() };
}

/**
 * Suspend or unsuspend a user account
 */
export async function setUserSuspension(
  profileId: string,
  suspend: boolean,
  reason?: string
): Promise<void> {
  const updates = suspend
    ? {
        is_suspended: true,
        suspended_at: new Date().toISOString(),
        suspended_reason: reason || null,
      }
    : {
        is_suspended: false,
        suspended_at: null,
        suspended_reason: null,
      };

  const { error } = await supabaseAdmin.from("profiles").update(updates).eq("id", profileId);

  if (error) {
    throw error;
  }
}

/**
 * Check if a user is suspended (for use in protected routes)
 */
export async function isUserSuspended(clerkUserId: string): Promise<{
  suspended: boolean;
  reason?: string;
}> {
  // Use the cached profile (5 min TTL, includes is_suspended/suspended_reason)
  // so gated mutations don't re-query profiles on every request. Suspension is
  // invalidated via invalidateProfileCache when an admin toggles it. L-CC20.
  try {
    const profile = await getProfileByClerkId(clerkUserId);
    if (!profile) {
      return { suspended: false };
    }
    return {
      suspended: profile.is_suspended === true,
      reason: profile.suspended_reason || undefined,
    };
  } catch {
    // Fail open on a lookup error rather than locking a legitimate user out.
    return { suspended: false };
  }
}
