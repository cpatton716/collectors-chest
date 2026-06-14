"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { useUser } from "@clerk/nextjs";

import { supabase } from "@/lib/supabase";

import { AuthDataSync } from "./AuthDataSync";
import { MobileNav } from "./MobileNav";
import { ToastProvider } from "./Toast";

// ---------------------------------------------------------------------------
// Shared unread-message count
//
// Both the desktop Navigation and the mobile MobileNav need the signed-in
// user's unread message count, plus a realtime broadcast subscription to keep
// it fresh. Previously each component fetched the profile id, fetched the
// initial count, and opened its own Supabase broadcast channel — duplicating
// the work and doubling the network/realtime footprint. This provider hoists
// that into a single source of truth consumed via `useUnreadMessages`.
// See audit refs M-FE9 / M-MS4 (nav portion).
// ---------------------------------------------------------------------------

const UnreadMessagesContext = createContext<number>(0);

/** Subscribe to the shared unread-message count (0 when signed out). */
export function useUnreadMessages(): number {
  return useContext(UnreadMessagesContext);
}

function UnreadMessagesProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useUser();
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Resolve the current user's profile id (used to scope the broadcast channel).
  useEffect(() => {
    if (!isSignedIn) {
      setProfileId(null);
      setUnreadCount(0);
      return;
    }
    let cancelled = false;
    fetch("/api/username/current")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.profileId) setProfileId(data.profileId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  // Fetch the initial unread count once signed in.
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    fetch("/api/messages/unread-count")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setUnreadCount(data.count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  // Keep the count fresh via a single realtime broadcast subscription.
  useEffect(() => {
    if (!profileId) return;

    const refresh = async () => {
      try {
        const res = await fetch("/api/messages/unread-count");
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.count);
        }
      } catch {
        // Ignore errors silently — count simply stays stale until next event.
      }
    };

    const channel = supabase
      .channel(`user:${profileId}:messages`)
      .on("broadcast", { event: "unread-update" }, () => {
        refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId]);

  return (
    <UnreadMessagesContext.Provider value={unreadCount}>
      {children}
    </UnreadMessagesContext.Provider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <UnreadMessagesProvider>
        {children}
        <MobileNav />
        <AuthDataSync />
      </UnreadMessagesProvider>
    </ToastProvider>
  );
}
