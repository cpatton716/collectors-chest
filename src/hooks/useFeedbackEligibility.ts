"use client";

import { useEffect, useState } from "react";

import { FeedbackEligibility, TransactionType } from "@/types/creatorCredits";

export function useFeedbackEligibility(
  transactionId: string | undefined,
  transactionType: TransactionType | undefined
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
  }, [transactionId, transactionType]);

  return { eligibility, isLoading };
}
