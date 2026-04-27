import type { Notification, NotificationType } from "@/types/auction";

/**
 * Notification types whose user-facing UI must NOT expose a "dismiss"
 * affordance, and whose DELETE API should reject. These carry moderation
 * or safety context (audit trail equivalents) that users could use to
 * conceal a history of issues from support.
 *
 * The strike-system notifications are the obvious examples — a hostile
 * user shouldn't be able to delete the warning they got before contacting
 * support claiming "I never saw the warning." auction_payment_expired*
 * also belong to the implicit dispute log.
 *
 * The underlying strike record / audit row lives elsewhere (e.g.,
 * `payment_miss_tracking`, `auction_audit_log`) so deletion of the
 * notification doesn't erase the actual evidence — it would only erase
 * the user-visible receipt. We block it anyway for clarity.
 */
export const NON_DELETABLE_NOTIFICATION_TYPES: ReadonlySet<NotificationType> =
  new Set<NotificationType>([
    "payment_missed_warning",
    "payment_missed_flagged",
    "auction_payment_expired",
    "auction_payment_expired_seller",
  ]);

export function isNonDeletableNotification(type: NotificationType): boolean {
  return NON_DELETABLE_NOTIFICATION_TYPES.has(type);
}

/**
 * Universal deep-link helper for a notification.
 *
 * - When the notification has an underlying resource (auction_id), prefer
 *   linking directly to that resource. Used by the bell click handler,
 *   email templates, and the future Capacitor push notification handler.
 * - When the notification has no underlying resource (system-only types
 *   like payment_missed_warning), fall back to the inbox with
 *   `?focus=<id>` so the inbox can scroll the row into view + flash-
 *   highlight it. This is the contract iOS APNs payloads will use once
 *   Capacitor ships — picking the format now means we don't have to
 *   re-version it after install.
 */
export function getNotificationDeepLink(notification: Notification): string {
  if (notification.auctionId) {
    const base = `/shop?listing=${notification.auctionId}`;
    if (notification.type === "rating_request") {
      return `${base}&leave-feedback=true`;
    }
    return base;
  }
  return `/notifications?focus=${notification.id}`;
}

/**
 * Whether the bell dropdown should treat this notification as clickable.
 * System-only notifications (no auction_id) still surface in the bell so
 * the unread count stays honest, but they render as non-clickable to
 * encourage the user to open the full inbox where the message can be
 * read in full.
 */
export function isNotificationClickableInBell(
  notification: Notification
): boolean {
  return !!notification.auctionId;
}
