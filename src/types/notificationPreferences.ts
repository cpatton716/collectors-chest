/**
 * Email notification preference types.
 *
 * Granularity is per-category (not per-event). Transactional emails are
 * always-on and are NOT stored on the profile — they always send regardless
 * of user preferences.
 */

export type NotificationCategory =
  | "transactional"
  | "marketplace"
  | "social"
  | "marketing";

/**
 * User-facing preferences surfaced in `/settings/notifications`.
 * `transactional` is intentionally omitted — it's always on.
 */
export interface NotificationPreferences {
  marketplace: boolean;
  social: boolean;
  marketing: boolean;
}

/**
 * Raw DB row shape for the preference columns on `profiles`. Mirrors the
 * column names exactly so callers can destructure from a Supabase select.
 */
export interface EmailNotificationPreferenceRow {
  email_pref_marketplace: boolean;
  email_pref_social: boolean;
  email_pref_marketing: boolean;
}

/**
 * Safe defaults applied when a profile row can't be read (e.g., guest send
 * or missing row). Opt-in is the default posture; users opt out explicitly.
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  marketplace: true,
  social: true,
  marketing: true,
};
