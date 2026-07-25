import { DEFAULT_SUPPORT_EMAIL } from "../publicConfig";

import type { NotificationEmailType } from "./types";

/**
 * Single From identity for every outbound email. Standardizing on one verified
 * sender keeps DKIM/SPF/DMAC alignment consistent and avoids splitting domain
 * reputation across multiple From addresses. All routes (verify/confirmation,
 * notifications, bonus-scan emails) should send through this constant.
 */
export const FROM_EMAIL = "Collectors Chest <notifications@collectors-chest.com>";

/**
 * Support / unsubscribe-by-mail inbox surfaced in the `List-Unsubscribe`
 * header alongside the one-click HTTP URL.
 *
 * ⚠️ OWNER-SUPPLIED PLACEHOLDER — the owner must confirm the real monitored
 * support address before launch. Until then this points at a clearly-marked
 * default on the verified sending domain. Update here once decided.
 */
export const SUPPORT_EMAIL =
  process.env.SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL;

/**
 * Number of bonus scans granted to a guest who verifies their email through
 * the email-capture flow. Centralized here so the verify + confirmation email
 * copy stays in sync (L-EM14).
 */
export const GUEST_BONUS_SCAN_COUNT = 5;

export const EMAIL_SOUND_EFFECTS: Record<NotificationEmailType, string> = {
  welcome: "POW!",
  trial_expiring: "TICK TOCK!",
  offer_received: "KA-CHING!",
  offer_accepted: "WHAM!",
  offer_rejected: "HEY!",
  offer_countered: "ZAP!",
  offer_expired: "POOF!",
  listing_expiring: "HEADS UP!",
  listing_expired: "TIME'S UP!",
  message_received: "BAM!",
  feedback_reminder: "PSST!",
  new_listing_from_followed: "HOT!",
  purchase_confirmation: "CHA-CHING!",
  item_sold: "SOLD!",
  outbid: "OUCH!",
  auction_won: "WINNER!",
  auction_sold: "SOLD!",
  payment_reminder: "TICK TOCK!",
  auction_payment_expired: "TIME'S UP!",
  auction_payment_expired_seller: "NO PAY!",
  // Second Chance Offer + Strike System
  second_chance_available: "SECOND SHOT!",
  second_chance_offered: "LUCKY YOU!",
  second_chance_accepted: "BOOM!",
  second_chance_declined: "PASS!",
  second_chance_expired: "TIME'S UP!",
  payment_missed_warning: "HEADS UP!",
  payment_missed_flagged: "WHOA!",
  subscription_payment_failed: "CARD ISSUE!",
  auction_ending_soon_bidder: "FINAL HOUR!",
  bonus_scan_verify: "ALMOST THERE!",
  bonus_scan_granted: "UNLOCKED!",
};

/**
 * Resend caps a single batch.send() call at 100 emails. We stay well under
 * that so there's headroom for upstream additions and transient retries.
 */
export const EMAIL_BATCH_SIZE = 50;
