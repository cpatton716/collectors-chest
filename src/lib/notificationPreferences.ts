/**
 * Email notification preference helpers.
 *
 * Maps each `NotificationEmailType` to a user-facing category and exposes
 * a single gate — `shouldSendEmailForUser` — that every outbound email
 * should consult before Resend is called.
 *
 * Transactional emails (payment, shipping, account security, auction-win
 * confirmations) always send regardless of user preferences. All other
 * categories are honored per user preference.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { NotificationCategory } from "@/types/notificationPreferences";

/**
 * Map each known notification email type to its category.
 *
 * Keyed by string (not the `NotificationEmailType` union) so it can absorb
 * new types added by parallel work without breaking this file. Any type
 * NOT in the map falls through to a safe default (`marketplace`) — callers
 * in production should always find a match; unknowns surface during tests.
 */
export const NOTIFICATION_CATEGORY_MAP: Record<string, NotificationCategory> = {
  // ── Transactional (always on) ──────────────────────────────────────────
  welcome: "transactional",
  trial_expiring: "transactional",
  auction_won: "transactional",
  auction_sold: "transactional",
  purchase_confirmation: "transactional",
  item_sold: "transactional",
  payment_received: "transactional",
  shipped: "transactional",
  payment_reminder: "transactional",
  auction_payment_expired: "transactional",
  auction_payment_expired_seller: "transactional",
  payment_missed_warning: "transactional", // security-adjacent — must reach user
  payment_missed_flagged: "transactional", // account status — must reach user

  // ── Marketplace ────────────────────────────────────────────────────────
  offer_received: "marketplace",
  offer_accepted: "marketplace",
  offer_rejected: "marketplace",
  offer_countered: "marketplace",
  offer_expired: "marketplace",
  listing_expiring: "marketplace",
  listing_expired: "marketplace",
  feedback_reminder: "marketplace",
  new_listing_from_followed: "marketplace",
  outbid: "marketplace",
  bid_auction_lost: "marketplace",
  new_bid: "marketplace",
  second_chance_available: "marketplace", // to seller
  second_chance_offered: "marketplace", // to runner-up
  second_chance_accepted: "marketplace",
  second_chance_declined: "marketplace",
  second_chance_expired: "marketplace",
  rating_request: "marketplace",
  feedback_received: "marketplace",
  watchlist_auction_ending: "marketplace",

  // ── Social ─────────────────────────────────────────────────────────────
  new_follower: "social",
  message_received: "social",
  new_message: "social",
  message_report_outcome: "social",
  mention: "social",

  // ── Marketing ──────────────────────────────────────────────────────────
  product_update: "marketing",
  newsletter: "marketing",
  promo: "marketing",
  re_engagement: "marketing",
};

/**
 * Resolve the category for a given email type. Unknown types fall through
 * to `marketplace` as a safe default (promotional defaults would be
 * over-aggressive; transactional defaults would defeat the opt-out).
 */
export function getNotificationCategory(emailType: string): NotificationCategory {
  return NOTIFICATION_CATEGORY_MAP[emailType] ?? "marketplace";
}

/**
 * Preference gate for outbound email.
 *
 * Returns `true` when the email should be sent, `false` when the user has
 * opted out of this category. Transactional emails always return `true`.
 *
 * Failure modes (profile missing, query error) err on the side of sending —
 * we treat them as transactional-like since a silent miss is worse than a
 * duplicate notification.
 *
 * @param profileId  profiles.id (UUID). Pass `null` for no-user-context sends.
 * @param emailType  one of the `NotificationEmailType` union values.
 * @param client     Supabase client (admin preferred for server-side sends).
 */
export async function shouldSendEmailForUser(
  profileId: string | null,
  emailType: string,
  client: SupabaseClient
): Promise<boolean> {
  const category = getNotificationCategory(emailType);

  // Transactional always sends.
  if (category === "transactional") return true;

  // No user context — e.g., guest-adjacent sends. Default to sending.
  if (!profileId) return true;

  const { data, error } = await client
    .from("profiles")
    .select("email_pref_marketplace, email_pref_social, email_pref_marketing")
    .eq("id", profileId)
    .single();

  // On error or missing row, err on sending (transactional-like).
  if (error || !data) return true;

  switch (category) {
    case "marketplace":
      return data.email_pref_marketplace !== false;
    case "social":
      return data.email_pref_social !== false;
    case "marketing":
      return data.email_pref_marketing !== false;
    default:
      return true;
  }
}

/**
 * Batch variant: given an array of recipient profile IDs + email types,
 * returns a Set of indices that should be sent. Used by
 * `sendNotificationEmailsBatch` to filter before hitting Resend.
 *
 * Single round-trip to the DB for the unique profile IDs involved.
 */
export async function filterEmailsByPreference<T extends { profileId: string | null; emailType: string }>(
  items: T[],
  client: SupabaseClient
): Promise<T[]> {
  if (items.length === 0) return items;

  // Split into "always send" vs "needs preference check".
  const alwaysSend: T[] = [];
  const needsCheck: T[] = [];

  for (const item of items) {
    const category = getNotificationCategory(item.emailType);
    if (category === "transactional" || !item.profileId) {
      alwaysSend.push(item);
    } else {
      needsCheck.push(item);
    }
  }

  if (needsCheck.length === 0) return alwaysSend;

  // One round-trip for all distinct profile IDs in the "needs check" set.
  const profileIds = Array.from(new Set(needsCheck.map((i) => i.profileId).filter(Boolean) as string[]));

  const { data, error } = await client
    .from("profiles")
    .select("id, email_pref_marketplace, email_pref_social, email_pref_marketing")
    .in("id", profileIds);

  if (error || !data) {
    // On error, err on sending — concat everything.
    return [...alwaysSend, ...needsCheck];
  }

  const prefsByProfile = new Map<
    string,
    { marketplace: boolean; social: boolean; marketing: boolean }
  >();
  for (const row of data) {
    prefsByProfile.set(row.id, {
      marketplace: row.email_pref_marketplace !== false,
      social: row.email_pref_social !== false,
      marketing: row.email_pref_marketing !== false,
    });
  }

  const kept = needsCheck.filter((item) => {
    const prefs = prefsByProfile.get(item.profileId as string);
    // No row found — err on sending.
    if (!prefs) return true;
    const category = getNotificationCategory(item.emailType);
    if (category === "marketplace") return prefs.marketplace;
    if (category === "social") return prefs.social;
    if (category === "marketing") return prefs.marketing;
    return true;
  });

  return [...alwaysSend, ...kept];
}
