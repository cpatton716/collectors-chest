import type { Notification } from "@/types/auction";

/**
 * Client-side cache for the notifications inbox so a brief offline window
 * (or a slow Netlify cold start) doesn't show "You're all caught up" to a
 * user whose inbox has actual content.
 *
 * Storage: localStorage (small payload, sync API, available in WKWebView
 * and all modern browsers; survives PWA reload). One key per profile id
 * to prevent cross-user leakage on a shared device.
 *
 * Versioned shape — bump CACHE_VERSION any time the cached object's shape
 * changes (e.g., adding a field that the renderer reads). Mismatch
 * triggers a discard + refetch instead of crashing the renderer.
 */

const CACHE_KEY_PREFIX = "cc_notifications_inbox_";
const CACHE_VERSION = 1;

interface NotificationsCacheEntry {
  version: number;
  savedAt: string; // ISO timestamp
  notifications: Notification[];
  unreadCount: number;
}

function cacheKey(profileId: string): string {
  return `${CACHE_KEY_PREFIX}${profileId}`;
}

function isAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const probe = "__cc_notifications_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the cached inbox snapshot for a profile. Returns null on miss,
 * version mismatch, or any parse error — callers should treat null as
 * "no cache; fetch from network."
 */
export function readNotificationsCache(
  profileId: string
): NotificationsCacheEntry | null {
  if (!isAvailable() || !profileId) return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(profileId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NotificationsCacheEntry;
    if (!parsed || parsed.version !== CACHE_VERSION) {
      window.localStorage.removeItem(cacheKey(profileId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Write a fresh snapshot to the cache. Best-effort; silently no-ops if
 * localStorage is unavailable or the quota is exceeded.
 */
export function writeNotificationsCache(
  profileId: string,
  notifications: Notification[],
  unreadCount: number
): void {
  if (!isAvailable() || !profileId) return;
  try {
    const entry: NotificationsCacheEntry = {
      version: CACHE_VERSION,
      savedAt: new Date().toISOString(),
      notifications,
      unreadCount,
    };
    window.localStorage.setItem(cacheKey(profileId), JSON.stringify(entry));
  } catch {
    // Quota or serialization failure — drop silently. The next successful
    // fetch will repopulate.
  }
}

/**
 * Remove the cached snapshot for a profile (on sign-out).
 */
export function clearNotificationsCache(profileId: string): void {
  if (!isAvailable() || !profileId) return;
  try {
    window.localStorage.removeItem(cacheKey(profileId));
  } catch {
    // Best-effort.
  }
}
