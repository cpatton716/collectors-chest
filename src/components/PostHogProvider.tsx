"use client";

import { useEffect } from "react";

import { useAuth, useUser } from "@clerk/nextjs";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

import type { ScanResponseMeta } from "@/lib/providers/types";

// Pure helper to build scan event properties (exported for testing)
export function buildScanEventProps(
  method: "camera" | "upload" | "barcode",
  success: boolean,
  meta?: ScanResponseMeta
) {
  return {
    method,
    success,
    provider: meta?.provider,
    fallbackUsed: meta?.fallbackUsed,
    fallbackReason: meta?.fallbackReason,
  };
}

// Sample session recordings at 10% to stay within plan limits (M-CC12).
// posthog-js has no client-init sample_rate option (that lives in the project's
// server-side recording config), so we gate recording at init with a 10% roll.
// This keeps PostHog recording enabled while only capturing ~1 in 10 sessions.
const SESSION_RECORDING_SAMPLE_RATE = 0.1;

// Initialize PostHog only on client side
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  const recordThisSession = Math.random() < SESSION_RECORDING_SAMPLE_RATE;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    // Capture pageviews automatically
    capture_pageview: true,
    // Capture pageleaves for session duration
    capture_pageleave: true,
    // Keep PostHog recording enabled, but only for the 10% sampled in (M-CC12)
    disable_session_recording: !recordThisSession,
    // Respect Do Not Track
    respect_dnt: true,
    // Only load in production or when key is set
    loaded: (posthog) => {
      if (process.env.NODE_ENV === "development") {
        // Uncomment to debug in dev:
        // posthog.debug();
      }
    },
  });
}

// Component to identify users when they sign in
function PostHogUserIdentifier() {
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    if (isSignedIn && userId && user) {
      // Identify user in PostHog
      posthog.identify(userId, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
        username: user.username,
        createdAt: user.createdAt,
      });
    } else if (!isSignedIn) {
      // Reset when user signs out
      posthog.reset();
    }
  }, [isSignedIn, userId, user]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <PostHogUserIdentifier />
      {children}
    </PHProvider>
  );
}

// Helper functions for common events
export const analytics = {
  // Track when user scans a comic
  trackScan: (
    method: "camera" | "upload" | "barcode",
    success: boolean,
    meta?: ScanResponseMeta
  ) => {
    posthog.capture("comic_scanned", buildScanEventProps(method, success, meta));
  },

  // Track when user adds to collection
  trackAddToCollection: (comicTitle: string, listId: string) => {
    posthog.capture("comic_added", { comic_title: comicTitle, list_id: listId });
  },

  // Track auction actions
  trackAuctionView: (auctionId: string) => {
    posthog.capture("auction_viewed", { auction_id: auctionId });
  },

  trackBidPlaced: (auctionId: string, amount: number) => {
    posthog.capture("bid_placed", { auction_id: auctionId, amount });
  },

  trackAuctionCreated: (auctionId: string, startingPrice: number) => {
    posthog.capture("auction_created", { auction_id: auctionId, starting_price: startingPrice });
  },

  // Track conversion funnel
  trackSignUpStarted: () => {
    posthog.capture("signup_started");
  },

  trackSignUpCompleted: () => {
    posthog.capture("signup_completed");
  },

  // Track feature usage
  trackFeatureUsed: (feature: string, details?: Record<string, unknown>) => {
    posthog.capture("feature_used", { feature, ...details });
  },

  // Track guest scan milestones
  trackGuestMilestone: (milestone: string, scansUsed: number) => {
    posthog.capture("guest_milestone", { milestone, scans_used: scansUsed });
  },
};
