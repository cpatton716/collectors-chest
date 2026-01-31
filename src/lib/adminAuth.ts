/**
 * Centralized admin authentication and audit logging helpers
 * Used by all admin API routes for consistent authorization and accountability
 */
import { auth } from "@clerk/nextjs/server";

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
  | "update_report";

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
 * Check if a user (by profile ID) is an admin
 */
export async function isAdmin(profileId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", profileId)
    .single();

  if (error || !data) {
    return false;
  }

  return data.is_admin === true;
}

/**
 * Check if a user (by Clerk user ID) is an admin
 */
export async function isAdminByClerkId(clerkUserId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (error || !data) {
    return false;
  }

  return data.is_admin === true;
}

/**
 * Log an admin action to the audit log
 * Call this after every admin action for accountability
 */
export async function logAdminAction(
  adminId: string,
  action: AdminAction,
  targetUserId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  const { error } = await supabaseAdmin.from("admin_audit_log").insert({
    admin_id: adminId,
    action,
    target_user_id: targetUserId || null,
    details: details || null,
  });

  if (error) {
    // Log error but don't fail the request - audit logging shouldn't break operations
    console.error("Failed to log admin action:", error);
  }
}

/**
 * Middleware-style function that throws if user is not an admin
 * Returns the admin profile if authorized
 */
export async function requireAdmin(): Promise<AdminProfile> {
  const adminProfile = await getAdminProfile();

  if (!adminProfile) {
    throw new Error("Admin access required");
  }

  return adminProfile;
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
 * Grant a user free premium access for a specified number of days
 */
export async function grantPremiumAccess(
  profileId: string,
  days: number = 30
): Promise<{ expiresAt: string }> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      trial_started_at: new Date().toISOString(),
      trial_ends_at: expiresAt.toISOString(),
    })
    .eq("id", profileId);

  if (error) {
    throw error;
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
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("is_suspended, suspended_reason")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (error || !data) {
    return { suspended: false };
  }

  return {
    suspended: data.is_suspended === true,
    reason: data.suspended_reason || undefined,
  };
}
