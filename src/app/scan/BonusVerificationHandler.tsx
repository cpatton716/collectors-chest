"use client";

import { useEffect } from "react";

import { useRouter, useSearchParams } from "next/navigation";

// Component that handles bonus scan verification from URL params
// Must be wrapped in Suspense because it uses useSearchParams
export function BonusVerificationHandler({
  addBonusScans,
  showToast,
}: {
  addBonusScans: () => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const bonusStatus = searchParams.get("bonus_status");
    const bonusMessage = searchParams.get("bonus_message");
    const bonusGranted = searchParams.get("bonus_granted");

    if (bonusStatus && bonusMessage) {
      // Show appropriate toast based on status
      if (bonusStatus === "success" && bonusGranted === "true") {
        addBonusScans();
        showToast(bonusMessage, "success");
      } else if (bonusStatus === "already_verified") {
        showToast(bonusMessage, "info");
      } else if (bonusStatus === "expired" || bonusStatus === "error") {
        showToast(bonusMessage, "error");
      }

      // Clean up URL params
      const url = new URL(window.location.href);
      url.searchParams.delete("bonus_status");
      url.searchParams.delete("bonus_message");
      url.searchParams.delete("bonus_granted");
      router.replace(url.pathname, { scroll: false });
    }
  }, [searchParams, addBonusScans, showToast, router]);

  return null; // This component just handles the side effect
}
