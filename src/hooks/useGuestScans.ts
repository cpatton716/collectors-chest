"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@clerk/nextjs";

const GUEST_SCAN_KEY = "comic_guest_scans";
const MILESTONES_SHOWN_KEY = "comic_milestones_shown";
const BONUS_SCANS_KEY = "comic_bonus_scans";
const MAX_GUEST_SCANS = 5; // Guest limit: 5 scans (Free tier gets 10/month)
const BONUS_SCAN_AMOUNT = 5; // Bonus scans granted for email capture

// Milestone thresholds (adjusted for 5 scan limit)
const FIRST_MILESTONE = 2; // After 2nd scan (3 remaining)
const SECOND_MILESTONE = 3; // After 3rd scan (2 remaining)
const FINAL_MILESTONE = 4; // After 4th scan (1 remaining - next is their last)

export type MilestoneType = "fiveRemaining" | "threeRemaining" | "finalScan" | null;

interface MilestonesShown {
  fiveRemaining: boolean;
  threeRemaining: boolean;
  finalScan: boolean;
}

interface GuestScanState {
  count: number;
  remaining: number;
  isLimitReached: boolean;
  isGuest: boolean;
  bonusScans: number;
  hasBonusScans: boolean;
  totalLimit: number;
  /**
   * Authoritative remaining scans returned by the server on the last scan
   * (null until the first server response). The server cookie + Redis counter
   * are the source of truth (H-SC3 / M-SC4); the localStorage-derived values
   * above are now only an optimistic display hint and the bonus state is
   * non-authoritative. Prefer this when present.
   */
  serverRemaining: number | null;
  /** Authoritative total allowance from the server's last response (null until first response). */
  serverLimit: number | null;
  incrementScan: () => MilestoneType;
  resetScans: () => void;
  checkMilestone: () => MilestoneType;
  markMilestoneShown: (milestone: MilestoneType) => void;
  addBonusScans: () => void;
  /** Record the server's authoritative remaining/limit from an analyze response. */
  applyServerScanResult: (result: { remaining?: number; limit?: number }) => void;
}

// Helper to get milestones from localStorage
const getMilestonesShown = (): MilestonesShown => {
  if (typeof window === "undefined") {
    return { fiveRemaining: false, threeRemaining: false, finalScan: false };
  }
  try {
    const stored = localStorage.getItem(MILESTONES_SHOWN_KEY);
    return stored
      ? JSON.parse(stored)
      : { fiveRemaining: false, threeRemaining: false, finalScan: false };
  } catch {
    return { fiveRemaining: false, threeRemaining: false, finalScan: false };
  }
};

// Helper to save milestones to localStorage
const saveMilestonesShown = (milestones: MilestonesShown) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(MILESTONES_SHOWN_KEY, JSON.stringify(milestones));
};

/**
 * Normalize the server's authoritative scan accounting (from /api/analyze)
 * into safe display values. The server returns `guestRemaining`/`guestLimit`
 * on success and `limit`/`scansUsed` on a 403 limit-reached; this coerces
 * whatever is present into non-negative integers (or null when absent), so the
 * UI never renders NaN or a negative count. Pure + exported for testing.
 */
export function normalizeServerScanResult(result: {
  remaining?: number | null;
  limit?: number | null;
}): { remaining: number | null; limit: number | null } {
  const coerce = (v: number | null | undefined): number | null =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : null;
  return { remaining: coerce(result.remaining), limit: coerce(result.limit) };
}

export function useGuestScans(): GuestScanState {
  const { isSignedIn, isLoaded } = useAuth();
  const [scanCount, setScanCount] = useState(0);
  const [bonusScans, setBonusScans] = useState(0);
  // Server-authoritative remaining/limit (H-SC3 / M-SC4). Null until the first
  // analyze response; once set, the page renders these instead of the
  // localStorage-derived optimistic values.
  const [serverRemaining, setServerRemaining] = useState<number | null>(null);
  const [serverLimit, setServerLimit] = useState<number | null>(null);
  const [milestonesShown, setMilestonesShown] = useState<MilestonesShown>({
    fiveRemaining: false,
    threeRemaining: false,
    finalScan: false,
  });

  // Load scan count, bonus scans, and milestones from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(GUEST_SCAN_KEY);
    if (stored) {
      setScanCount(parseInt(stored, 10));
    }
    const storedBonus = localStorage.getItem(BONUS_SCANS_KEY);
    if (storedBonus) {
      setBonusScans(parseInt(storedBonus, 10));
    }
    setMilestonesShown(getMilestonesShown());
  }, []);

  // Check which milestone should be shown based on current count
  const checkMilestone = useCallback((): MilestoneType => {
    // Don't show milestones for signed-in users
    if (isSignedIn) return null;

    if (scanCount >= FINAL_MILESTONE && !milestonesShown.finalScan) {
      return "finalScan";
    }
    if (scanCount >= SECOND_MILESTONE && !milestonesShown.threeRemaining) {
      return "threeRemaining";
    }
    if (scanCount >= FIRST_MILESTONE && !milestonesShown.fiveRemaining) {
      return "fiveRemaining";
    }
    return null;
  }, [scanCount, milestonesShown, isSignedIn]);

  // Mark a milestone as shown
  const markMilestoneShown = useCallback(
    (milestone: MilestoneType) => {
      if (!milestone) return;

      const updated = { ...milestonesShown, [milestone]: true };
      setMilestonesShown(updated);
      saveMilestonesShown(updated);
    },
    [milestonesShown]
  );

  // Increment scan and return any milestone that should be shown
  const incrementScan = useCallback((): MilestoneType => {
    if (typeof window === "undefined") return null;
    // Don't count scans for signed-in users
    if (isSignedIn) return null;

    const newCount = scanCount + 1;
    setScanCount(newCount);
    localStorage.setItem(GUEST_SCAN_KEY, newCount.toString());

    // Check for milestones based on NEW count
    const currentMilestones = getMilestonesShown();

    if (newCount >= FINAL_MILESTONE && !currentMilestones.finalScan) {
      return "finalScan";
    }
    if (newCount >= SECOND_MILESTONE && !currentMilestones.threeRemaining) {
      return "threeRemaining";
    }
    if (newCount >= FIRST_MILESTONE && !currentMilestones.fiveRemaining) {
      return "fiveRemaining";
    }

    return null;
  }, [scanCount, isSignedIn]);

  const resetScans = useCallback(() => {
    if (typeof window === "undefined") return;
    setScanCount(0);
    setBonusScans(0);
    setServerRemaining(null);
    setServerLimit(null);
    localStorage.removeItem(GUEST_SCAN_KEY);
    localStorage.removeItem(BONUS_SCANS_KEY);
    // Also reset milestones
    setMilestonesShown({ fiveRemaining: false, threeRemaining: false, finalScan: false });
    localStorage.removeItem(MILESTONES_SHOWN_KEY);
  }, []);

  // Record the server's authoritative remaining/limit from an analyze response.
  // The server cookie + Redis counter are the source of truth; this lets the UI
  // reflect the real allowance even if localStorage was tampered/cleared.
  const applyServerScanResult = useCallback(
    (result: { remaining?: number; limit?: number }) => {
      const { remaining, limit } = normalizeServerScanResult(result);
      if (remaining !== null) setServerRemaining(remaining);
      if (limit !== null) setServerLimit(limit);
    },
    []
  );

  // Add bonus scans (called after successful email capture)
  const addBonusScans = useCallback(() => {
    if (typeof window === "undefined") return;
    const newBonusScans = bonusScans + BONUS_SCAN_AMOUNT;
    setBonusScans(newBonusScans);
    localStorage.setItem(BONUS_SCANS_KEY, newBonusScans.toString());
  }, [bonusScans]);

  const isGuest = isLoaded && !isSignedIn;
  const totalLimit = MAX_GUEST_SCANS + bonusScans;
  // Prefer the server-authoritative remaining when we have it (H-SC3 / M-SC4);
  // otherwise fall back to the optimistic localStorage-derived value.
  const remaining = serverRemaining !== null ? serverRemaining : Math.max(0, totalLimit - scanCount);
  // Limit-reached likewise honors the server once it has spoken.
  const isLimitReached = isGuest && (serverRemaining !== null ? serverRemaining <= 0 : scanCount >= totalLimit);
  const hasBonusScans = bonusScans > 0;

  return {
    count: scanCount,
    remaining,
    isLimitReached,
    isGuest,
    bonusScans,
    hasBonusScans,
    totalLimit,
    serverRemaining,
    serverLimit,
    incrementScan,
    resetScans,
    checkMilestone,
    markMilestoneShown,
    addBonusScans,
    applyServerScanResult,
  };
}

// Helper to check if guest has scans remaining (for use in components)
export function getGuestScansRemaining(): number {
  if (typeof window === "undefined") return MAX_GUEST_SCANS;
  const stored = localStorage.getItem(GUEST_SCAN_KEY);
  const storedBonus = localStorage.getItem(BONUS_SCANS_KEY);
  const count = stored ? parseInt(stored, 10) : 0;
  const bonus = storedBonus ? parseInt(storedBonus, 10) : 0;
  const totalLimit = MAX_GUEST_SCANS + bonus;
  return Math.max(0, totalLimit - count);
}

// Helper to check if guest has already redeemed bonus scans
export function hasRedeemedBonusScans(): boolean {
  if (typeof window === "undefined") return false;
  const storedBonus = localStorage.getItem(BONUS_SCANS_KEY);
  return storedBonus !== null && parseInt(storedBonus, 10) > 0;
}
