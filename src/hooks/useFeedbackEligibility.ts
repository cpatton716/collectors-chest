"use client";

import { useEffect, useState } from "react";

import { FeedbackEligibility, TransactionType } from "@/types/creatorCredits";

export function useFeedbackEligibility(
  transactionId: string | undefined,
  transactionType: TransactionType | undefined,
  // Opaque refresh key that re-runs the eligibility check when it changes.
  // Callers pass something that flips when eligibility could have changed
  // server-side (e.g. listing.shippedAt) so a fresh fetch happens after the
  // buyer/seller reopens the modal post-shipment.
  refreshKey?: string | number | null
) {
  const [eligibility, setEligibility] = useState<FeedbackEligibility | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!transactionId || !transactionType) {
      setEligibility(null);
      return;
    }

    async function checkEligibility() {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/feedback/eligibility?transactionId=${transactionId}&transactionType=${transactionType}`
        );
        if (res.ok) {
          const data = await res.json();
          setEligibility(data.eligibility);
        }
      } catch (err) {
        console.error("Failed to check feedback eligibility:", err);
      } finally {
        setIsLoading(false);
      }
    }

    checkEligibility();
  }, [transactionId, transactionType, refreshKey]);

  return { eligibility, isLoading };
}
