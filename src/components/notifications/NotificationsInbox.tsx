"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useUser } from "@clerk/nextjs";
import {
  Bell,
  Check,
  Clock,
  DollarSign,
  Gavel,
  Loader2,
  Star,
  Trophy,
  Truck,
  X,
} from "lucide-react";

import {
  getNotificationDeepLink,
  isNonDeletableNotification,
} from "@/lib/notificationLinks";
import {
  clearNotificationsCache,
  readNotificationsCache,
  writeNotificationsCache,
} from "@/lib/notificationsCache";

import type { Notification, NotificationType } from "@/types/auction";

const POLL_INTERVAL_MS = 30000;

interface InboxResponse {
  notifications: Notification[];
  nextCursor: string | null;
  unreadCount: number;
}

function getIconFor(type: NotificationType) {
  switch (type) {
    case "outbid":
      return <Gavel className="w-5 h-5 text-orange-500" />;
    case "won":
      return <Trophy className="w-5 h-5 text-yellow-500" />;
    case "ended":
      return <Clock className="w-5 h-5 text-gray-500" />;
    case "shipped":
      return <Truck className="w-5 h-5 text-blue-500" />;
    case "auction_sold":
      return <DollarSign className="w-5 h-5 text-green-500" />;
    case "payment_received":
      return <Check className="w-5 h-5 text-green-500" />;
    case "rating_request":
      return <Star className="w-5 h-5 text-blue-500" />;
    default:
      return <Bell className="w-5 h-5 text-gray-500" />;
  }
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

interface ToastState {
  message: string;
  variant: "info" | "error";
  id: number;
}

export function NotificationsInbox() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus");
  const { user, isLoaded: userLoaded } = useUser();
  // Cache key uses Clerk user.id — always available on signed-in users and
  // unique per account. Profile.id (Supabase) isn't exposed to the client by
  // default; the API route does that mapping server-side.
  const cacheKey = user?.id ?? null;
  const previousCacheKeyRef = useRef<string | null>(null);
  // Live-readable mirror of cacheKey for async closures. If the user signs
  // out / switches accounts mid-fetch, the closure's captured `cacheKey`
  // is stale; this ref reflects the current Clerk userId at resolve time.
  // Defense-in-depth on top of the per-effect `cancelled` flag.
  const currentCacheKeyRef = useRef<string | null>(null);
  useEffect(() => {
    currentCacheKeyRef.current = cacheKey;
  }, [cacheKey]);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hydratedFromCache, setHydratedFromCache] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const focusedRowRef = useRef<HTMLDivElement | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string, variant: ToastState["variant"] = "info") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, variant, id: Date.now() });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchPage = useCallback(
    async (cursor: string | null): Promise<InboxResponse | null> => {
      const params = new URLSearchParams();
      params.set("limit", "50");
      if (cursor) params.set("cursor", cursor);
      try {
        const res = await fetch(`/api/notifications?${params.toString()}`);
        if (!res.ok) return null;
        return (await res.json()) as InboxResponse;
      } catch {
        return null;
      }
    },
    []
  );

  // Initial load — try cache first for instant render, then fetch fresh.
  // Don't gate on cacheKey: the API uses the Clerk session cookie directly,
  // so we can fetch without knowing the cache key. We just skip the cache
  // read/write when there's no key yet.
  useEffect(() => {
    if (!userLoaded) return;
    let cancelled = false;
    // Capture the cacheKey at fetch start. If the user signs out or
    // switches accounts before the fetch resolves, we must NOT write
    // user A's payload into the (now-stale or now-different) slot.
    const startKey = cacheKey;

    const cached = startKey ? readNotificationsCache(startKey) : null;
    if (cached) {
      setNotifications(cached.notifications);
      setUnreadCount(cached.unreadCount);
      setHydratedFromCache(true);
      setIsLoading(false);
    }

    (async () => {
      const result = await fetchPage(null);
      if (cancelled) return;
      // Mid-flight Clerk userId check — abort if the active user has
      // changed since fetch started.
      if (currentCacheKeyRef.current !== startKey) return;
      if (result) {
        setNotifications(result.notifications);
        setUnreadCount(result.unreadCount);
        setNextCursor(result.nextCursor);
        setHydratedFromCache(false);
        setLastUpdatedAt(new Date());
        if (startKey) {
          writeNotificationsCache(startKey, result.notifications, result.unreadCount);
        }
      } else if (!cached) {
        // Network failed AND no cache — still show empty state without
        // the "you're all caught up" lie.
        setHydratedFromCache(false);
      }
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userLoaded, cacheKey, fetchPage]);

  // Sign-out cleanup: when Clerk reports null user, drop the cache for
  // the previously-signed-in account.
  useEffect(() => {
    if (cacheKey) {
      previousCacheKeyRef.current = cacheKey;
      return;
    }
    if (userLoaded && !cacheKey && previousCacheKeyRef.current) {
      clearNotificationsCache(previousCacheKeyRef.current);
      previousCacheKeyRef.current = null;
    }
  }, [cacheKey, userLoaded]);

  // Poll unread count quietly (don't refresh the list — too disruptive
  // mid-scroll).
  useEffect(() => {
    if (!userLoaded || !user) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/notifications?countOnly=true");
        if (res.ok) {
          const data = (await res.json()) as { count: number };
          setUnreadCount(data.count);
        }
      } catch {
        // ignore — polling is best-effort
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [userLoaded, user]);

  // Focus-on-mount: if `?focus=<id>` is in the URL, scroll the row into
  // view and flash-highlight. If the row isn't in the current page, fetch
  // it directly to confirm existence; if 404, toast and clear the param.
  useEffect(() => {
    if (!focusId || isLoading) return;
    const found = notifications.find((n) => n.id === focusId);
    if (found) {
      setFocusedId(focusId);
      setTimeout(() => setFocusedId(null), 1500);
      return;
    }
    // Not in current page — verify it exists at all.
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/notifications/${focusId}`);
        if (cancelled) return;
        if (res.status === 404) {
          showToast(
            "Notification not found — it may have been cleared.",
            "info"
          );
          // Strip ?focus from URL so a remount doesn't re-trigger.
          router.replace(pathname);
        }
      } catch {
        // network blip — leave focus param in place; user can refresh
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [focusId, isLoading, notifications, router, pathname, showToast]);

  // Scroll the focused row into view once it renders.
  useEffect(() => {
    if (!focusedId || !focusedRowRef.current) return;
    focusedRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusedId]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    const result = await fetchPage(nextCursor);
    if (result) {
      setNotifications((prev) => [...prev, ...result.notifications]);
      setNextCursor(result.nextCursor);
    }
    setIsLoadingMore(false);
  }, [nextCursor, isLoadingMore, fetchPage]);

  // Infinite scroll via Intersection Observer on the sentinel.
  useEffect(() => {
    if (!sentinelRef.current || !nextCursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [nextCursor, loadMore]);

  const handleRowClick = (notification: Notification) => {
    if (!notification.isRead) {
      // Optimistic UI; PATCH backend.
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: notification.id }),
      }).catch(() => {
        // best-effort — server is the truth on next refresh
      });
    }
    router.push(getNotificationDeepLink(notification));
  };

  const handleDismiss = async (
    e: React.MouseEvent,
    notification: Notification
  ) => {
    e.stopPropagation();
    if (isNonDeletableNotification(notification.type)) return;

    // Optimistic remove.
    const removedIndex = notifications.findIndex((n) => n.id === notification.id);
    setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    if (!notification.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    try {
      const res = await fetch(`/api/notifications/${notification.id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 404) {
        throw new Error(`status ${res.status}`);
      }
    } catch {
      // Rollback — re-insert at original position.
      setNotifications((prev) => {
        const next = [...prev];
        next.splice(removedIndex, 0, notification);
        return next;
      });
      if (!notification.isRead) {
        setUnreadCount((prev) => prev + 1);
      }
      showToast("Couldn't delete — try again.", "error");
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    const asOf = new Date().toISOString();
    // Optimistic.
    setNotifications((prev) =>
      prev.map((n) => (n.isRead ? n : { ...n, isRead: true, readAt: asOf }))
    );
    setUnreadCount(0);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
    } catch {
      showToast("Couldn't mark all read — try again.", "error");
    }
  };

  const handleManualRefresh = useCallback(async () => {
    setIsLoading(true);
    const result = await fetchPage(null);
    if (result) {
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
      setNextCursor(result.nextCursor);
      setHydratedFromCache(false);
      setLastUpdatedAt(new Date());
      if (cacheKey) {
        writeNotificationsCache(cacheKey, result.notifications, result.unreadCount);
      }
    }
    setIsLoading(false);
  }, [fetchPage, cacheKey]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdatedAt) return null;
    return formatTime(lastUpdatedAt.toISOString());
  }, [lastUpdatedAt]);

  return (
    <div className="space-y-3">
      {/* Cache banner */}
      {hydratedFromCache && (
        <div className="rounded-lg border-2 border-pop-black bg-yellow-50 px-3 py-2 text-sm flex items-center justify-between gap-3">
          <span>Showing cached notifications.</span>
          <button
            onClick={handleManualRefresh}
            className="font-semibold text-pop-blue hover:text-blue-800"
          >
            Tap to refresh →
          </button>
        </div>
      )}

      {/* Header pill + Mark all read */}
      <div className="flex items-center justify-between gap-3 sticky top-0 bg-pop-cream py-2 z-10">
        <span className="text-xs text-gray-500">
          {lastUpdatedLabel ? (
            <button
              onClick={handleManualRefresh}
              className="hover:text-gray-900"
              aria-label="Refresh"
            >
              Last updated {lastUpdatedLabel} · tap to refresh
            </button>
          ) : (
            "—"
          )}
        </span>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-sm font-semibold text-pop-blue hover:text-blue-800"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* List */}
      {isLoading && notifications.length === 0 ? (
        <div className="py-10 text-center text-gray-500">
          <Loader2 className="w-6 h-6 mx-auto animate-spin mb-2" />
          Loading…
        </div>
      ) : notifications.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          <Bell className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-700">You&apos;re all caught up.</p>
          <p className="text-sm">New notifications will appear here.</p>
        </div>
      ) : (
        <div className="divide-y border-2 border-pop-black rounded-lg overflow-hidden bg-white">
          {notifications.map((notification) => {
            const nonDeletable = isNonDeletableNotification(notification.type);
            const isFocused = focusedId === notification.id;
            return (
              <div
                key={notification.id}
                ref={isFocused ? focusedRowRef : undefined}
                onClick={() => handleRowClick(notification)}
                className={`relative flex items-start gap-3 px-4 py-3 sm:py-4 cursor-pointer transition-colors min-h-[88px] ${
                  !notification.isRead ? "bg-blue-50" : "hover:bg-gray-50"
                } ${isFocused ? "ring-2 ring-pop-blue ring-inset" : ""}`}
              >
                <div className="flex-shrink-0 w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center mt-0.5">
                  {getIconFor(notification.type)}
                </div>
                <div className="flex-1 min-w-0 pr-8">
                  <p className="text-sm font-bold text-gray-900">
                    {notification.title}
                  </p>
                  <p className="text-sm text-gray-700 line-clamp-3 mt-1">
                    {notification.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatTime(notification.createdAt)}
                  </p>
                </div>
                {!notification.isRead && (
                  <div
                    className="absolute top-3 right-12 w-2 h-2 bg-blue-500 rounded-full"
                    aria-label="Unread"
                  />
                )}
                {!nonDeletable && (
                  <button
                    onClick={(e) => handleDismiss(e, notification)}
                    className="absolute top-1 right-1 w-11 h-11 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                    aria-label="Dismiss notification"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Sentinel for infinite scroll */}
          {nextCursor && (
            <div
              ref={sentinelRef}
              className="py-4 text-center text-sm text-gray-500"
            >
              {isLoadingMore ? (
                <Loader2 className="w-4 h-4 mx-auto animate-spin" />
              ) : (
                "Loading more…"
              )}
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg border-2 border-pop-black shadow-comic text-sm font-semibold z-50 ${
            toast.variant === "error" ? "bg-red-100 text-red-900" : "bg-white text-gray-900"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Footer hint */}
      <p className="text-xs text-gray-400 text-center pt-2">
        Notifications are kept for 30 days after you read them, or 90 days
        if you never read them.{" "}
        <Link href="/settings/notifications" className="underline hover:text-gray-700">
          Email preferences
        </Link>
      </p>
    </div>
  );
}
