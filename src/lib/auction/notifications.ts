// AUTO-EXTRACTED from auctionDb.ts during R1-auctiondb refactor (M-AU9).
// Behavior-preserving: function bodies moved verbatim.

import {
  ListingType,
  Notification,
  NotificationType,
} from "@/types/auction";

import {
  buildCursorFilter,
  type NotificationCursor,
} from "../notificationCursor";
import { sendNotificationEmailsBatch } from "../email";
import { getAllFollowerIds } from "../followDb";
import { supabase, supabaseAdmin } from "../supabase";
import { transformNotificationRow } from "./transforms";

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * Create a notification
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  auctionId?: string,
  offerId?: string,
  overrides?: { title?: string; message?: string }
): Promise<void> {
  const titles: Record<NotificationType, string> = {
    outbid: "You've been outbid!",
    won: "Congratulations! You won!",
    ended: "Auction ended",
    bid_auction_lost: "Auction ended, you didn't win",
    new_bid_received: "New bid on your auction",
    auction_ending_soon_bidder: "Auction ending soon",
    payment_reminder: "Payment reminder",
    auction_payment_expired: "Auction cancelled: payment window expired",
    auction_payment_expired_seller: "Buyer did not pay in time",
    rating_request: "Leave feedback",
    auction_sold: "Your item sold!",
    payment_received: "Payment received",
    shipped: "Your comic has shipped!",
    // Offer notifications
    offer_received: "New offer received!",
    offer_accepted: "Your offer was accepted!",
    offer_rejected: "Offer declined",
    offer_countered: "Counter-offer received!",
    offer_expired: "Offer expired",
    // Listing expiration notifications
    listing_expiring: "Listing expiring soon",
    listing_expired: "Listing has expired",
    listing_cancelled: "Listing cancelled",
    // Follow system notifications
    new_listing_from_followed: "New listing from someone you follow",
    // Community contribution notifications
    key_info_approved: "Key info approved!",
    key_info_rejected: "Key info not accepted",
    // Second Chance Offer
    second_chance_available: "You can offer to the runner-up",
    second_chance_offered: "Second chance offer received!",
    second_chance_accepted: "Runner-up accepted your offer",
    second_chance_declined: "Runner-up declined your offer",
    second_chance_expired: "Runner-up didn't respond in time",
    // Payment-miss strike system
    payment_missed_warning: "Missed payment window",
    payment_missed_flagged: "Bidding temporarily restricted",
  };

  const messages: Record<NotificationType, string> = {
    outbid: "Someone has placed a higher bid on an auction you're watching.",
    won: "You've won an auction! Complete payment within 48 hours.",
    ended: "An auction you were watching has ended.",
    bid_auction_lost: "An auction you bid on has ended with another winner.",
    new_bid_received: "A bidder placed a new bid on one of your auctions.",
    auction_ending_soon_bidder: "An auction you're bidding on closes within the hour. Place a bid to stay in the running.",
    payment_reminder: "Payment is due soon for your won auction.",
    auction_payment_expired: "Your payment window has expired. The auction has been cancelled.",
    auction_payment_expired_seller: "The winning bidder did not pay within the 48-hour window. The auction has been cancelled and you may re-list the comic.",
    rating_request: "Please leave feedback for your recent purchase.",
    auction_sold: "Your auction has ended with a winning bidder!",
    payment_received: "Payment has been received for your sold item.",
    shipped: "The seller marked your comic as shipped. The comic has been added to your collection.",
    // Offer messages
    offer_received: "Someone has made an offer on your listing. Review and respond.",
    offer_accepted: "The seller has accepted your offer! Complete payment within 48 hours.",
    offer_rejected: "Unfortunately, your offer was not accepted.",
    offer_countered: "The seller has made a counter-offer. Review and respond.",
    offer_expired: "Your offer has expired without a response.",
    // Listing expiration messages
    listing_expiring: "Your listing will expire in 24 hours. Consider renewing.",
    listing_expired: "Your listing has expired. Relist to continue selling.",
    listing_cancelled: "A listing you made an offer on has been cancelled by the seller.",
    // Follow system messages (fallback - dynamic messages created via notifyFollowersOfNewListing)
    new_listing_from_followed: "A seller you follow has listed a new item.",
    // Community contribution messages
    key_info_approved: "Your key info suggestion has been approved and added to the database. Thank you for contributing!",
    key_info_rejected: "Your key info suggestion was reviewed but not accepted. Thank you for contributing!",
    // Second Chance Offer
    second_chance_available: "The winner didn't pay. You can offer the item to the runner-up at their last bid.",
    second_chance_offered: "Good news: the seller has offered this comic to you at your last bid. You have 48 hours to accept or decline.",
    second_chance_accepted: "The runner-up accepted your second-chance offer. Payment is pending.",
    second_chance_declined: "The runner-up declined your second-chance offer. You can re-list the item.",
    second_chance_expired: "The runner-up didn't respond within 48 hours. You can re-list the item.",
    // Payment-miss strike system
    payment_missed_warning: "You missed a 48-hour payment window. This is a friendly warning. Next time may restrict bidding.",
    payment_missed_flagged: "Your bidding privileges are temporarily restricted due to multiple missed payments. Contact support to appeal.",
  };

  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    type,
    title: overrides?.title ?? titles[type],
    message: overrides?.message ?? messages[type],
    auction_id: auctionId || null,
    offer_id: offerId || null,
  });
}

/**
 * Notify all followers when a seller creates a new listing
 * Creates personalized notifications with comic details and price
 * Also sends emails to followers who have email notifications enabled
 */
export async function notifyFollowersOfNewListing(
  sellerId: string,
  listingId: string,
  comicTitle: string,
  price: number,
  listingType: ListingType,
  coverImageUrl?: string
): Promise<void> {
  // Get all follower IDs for this seller
  const followerIds = await getAllFollowerIds(sellerId);

  if (followerIds.length === 0) {
    return; // No followers to notify
  }

  // Get seller's display info for the notification
  const { data: sellerProfile } = await supabase
    .from("profiles")
    .select("username, display_name, public_display_name, display_preference")
    .eq("id", sellerId)
    .single();

  // Determine seller display name for notification
  let sellerDisplayName = "A seller";
  let sellerUsername = "seller";
  if (sellerProfile) {
    const { username, display_name, public_display_name, display_preference } = sellerProfile;
    sellerUsername = username || "seller";
    if (display_preference === "username_only" && username) {
      sellerDisplayName = `@${username}`;
    } else if (display_preference === "display_name_only" && (public_display_name || display_name)) {
      sellerDisplayName = public_display_name || display_name;
    } else if (display_preference === "both" && username) {
      sellerDisplayName = public_display_name || display_name
        ? `${public_display_name || display_name} (@${username})`
        : `@${username}`;
    } else if (username) {
      sellerDisplayName = `@${username}`;
    } else if (public_display_name || display_name) {
      sellerDisplayName = public_display_name || display_name;
    }
  }

  // Format the price
  const formattedPrice = `$${price.toFixed(2)}`;

  // Create notification message based on listing type
  const listingTypeText = listingType === "auction" ? "listed" : "listed";
  const title = "New listing from someone you follow";
  const message = `${sellerDisplayName} ${listingTypeText} ${comicTitle} for ${formattedPrice}`;

  // Create notifications for all followers
  // Using supabaseAdmin to bypass RLS and batch insert
  const notifications = followerIds.map((followerId) => ({
    user_id: followerId,
    type: "new_listing_from_followed" as const,
    title,
    message,
    auction_id: listingId,
    offer_id: null,
  }));

  // Batch insert notifications (Supabase handles this efficiently)
  const { error } = await supabaseAdmin.from("notifications").insert(notifications);

  if (error) {
    console.error("[auctionDb] Failed to notify followers of new listing:", error);
  }

  // Send emails to followers who have email notifications enabled
  // Query follower profiles with email preferences
  const { data: followerProfiles } = await supabaseAdmin
    .from("profiles")
    .select("id, email, msg_email_enabled")
    .in("id", followerIds)
    .eq("msg_email_enabled", true);

  if (!followerProfiles || followerProfiles.length === 0) {
    return; // No followers with email notifications enabled
  }

  // Build listing URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";
  const listingUrl = `${baseUrl}/shop/${listingId}`;

  // Fan out via the Resend batch API in one call rather than N individual
  // sends. Each param carries profileId so the email layer can attach
  // unsubscribe context. M-EM2.
  const emailParams = followerProfiles
    .filter((f) => !!f.email)
    .map((f) => ({
      to: f.email as string,
      type: "new_listing_from_followed" as const,
      data: {
        sellerName: sellerDisplayName,
        sellerUsername,
        comicTitle,
        price,
        listingUrl,
        coverImageUrl,
      },
      profileId: f.id as string,
    }));

  if (emailParams.length > 0) {
    const result = await sendNotificationEmailsBatch(emailParams);
    if (result.errors.length > 0) {
      console.error(
        "[auctionDb] new-listing follower email batch errors:",
        result.errors
      );
    }
  }
}

/**
 * Get user's notifications
 */
export async function getUserNotifications(
  userId: string,
  unreadOnly = false
): Promise<Notification[]> {
  let query = supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map(transformNotificationRow);
}

/**
 * Paginated fetch for the inbox. Cursor-based on (created_at, id) DESC so
 * batch-inserted rows that share a timestamp don't go missing across page
 * boundaries.
 *
 * Returns up to `limit` rows plus a `nextCursor` if more rows exist
 * beyond the current page.
 */
export async function getUserNotificationsPaginated(
  userId: string,
  cursor: NotificationCursor | null,
  limit: number
): Promise<{ notifications: Notification[]; nextCursor: NotificationCursor | null }> {
  let query = supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1); // fetch one extra to detect "more rows beyond"

  if (cursor) {
    query = query.or(buildCursorFilter(cursor));
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data || []).map(transformNotificationRow);
  if (rows.length <= limit) {
    return { notifications: rows, nextCursor: null };
  }

  // We fetched one extra row to peek beyond the page; trim it and emit
  // the cursor for the NEXT page.
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    notifications: page,
    nextCursor: { createdAt: last.createdAt, id: last.id },
  };
}

/**
 * Fetch a single notification by id, scoped to the requesting user. Used
 * by the inbox `?focus=<id>` deep-link to surface a "Notification not
 * found - it may have been cleared" toast when the row has been pruned.
 *
 * Returns null on miss (treat as 404 - don't leak existence).
 */
export async function getNotificationByIdForUser(
  notificationId: string,
  userId: string
): Promise<Notification | null> {
  const { data } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return transformNotificationRow(data);
}

/**
 * Owner-scoped hard delete for a single notification. Returns true on
 * success (row was deleted), false if no matching row was found.
 */
export async function deleteNotificationForUser(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const { error, count } = await supabaseAdmin
    .from("notifications")
    .delete({ count: "exact" })
    .eq("id", notificationId)
    .eq("user_id", userId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/**
 * Cleanup helper for the cron pipeline.
 *
 * - Deletes notifications where read_at is older than 30 days (the user
 *   has acted on them; the row is now noise).
 * - Deletes unread notifications older than 90 days (long-stale; the
 *   user has clearly never engaged).
 *
 * Returns counts so the cron route can log how many rows were pruned.
 * Idempotent - calling repeatedly is safe; subsequent runs return zero.
 */
export async function pruneOldNotifications(): Promise<{
  deletedRead: number;
  deletedUnread: number;
}> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const readResult = await supabaseAdmin
    .from("notifications")
    .delete({ count: "exact" })
    .not("read_at", "is", null)
    .lt("read_at", thirtyDaysAgo);

  const unreadResult = await supabaseAdmin
    .from("notifications")
    .delete({ count: "exact" })
    .eq("is_read", false)
    .lt("created_at", ninetyDaysAgo);

  return {
    deletedRead: readResult.count ?? 0,
    deletedUnread: unreadResult.count ?? 0,
  };
}

/**
 * Mark a single notification as read.
 *
 * Owner-scoped - caller must pass the profile.id of the requesting user so
 * the UPDATE can never affect rows owned by anyone else. supabaseAdmin
 * bypasses RLS, so the .eq("user_id", userId) clause is the actual gate.
 *
 * Sets read_at = NOW() to drive the 30-day cleanup cron.
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<void> {
  await supabaseAdmin
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId);
}

/**
 * Mark all unread notifications for a user as read.
 *
 * Optional `asOf` clamps the UPDATE to notifications that existed at or
 * before that timestamp - prevents silently sweeping a notification that
 * was inserted between the user clicking "Mark all read" and the request
 * landing.
 *
 * Sets read_at = NOW() and narrows the UPDATE to only rows where read_at
 * is still NULL (idempotent - re-runs are no-ops).
 */
export async function markAllNotificationsRead(
  userId: string,
  asOf?: Date
): Promise<void> {
  let query = supabaseAdmin
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_read", false)
    .is("read_at", null);

  if (asOf) {
    query = query.lte("created_at", asOf.toISOString());
  }

  await query;
}

/**
 * Get unread notification count
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) throw error;

  return count || 0;
}

