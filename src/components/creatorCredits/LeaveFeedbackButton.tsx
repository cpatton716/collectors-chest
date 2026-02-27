"use client";

import { useState } from "react";

import { MessageSquarePlus } from "lucide-react";

import { RatingType, TransactionType } from "@/types/creatorCredits";

import { FeedbackModal } from "./FeedbackModal";

interface LeaveFeedbackButtonProps {
  transactionType: TransactionType;
  transactionId: string;
  revieweeId: string;
  revieweeName: string;
  onFeedbackSubmitted?: () => void;
}

export function LeaveFeedbackButton({
  transactionType,
  transactionId,
  revieweeId,
  revieweeName,
  onFeedbackSubmitted,
}: LeaveFeedbackButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSubmit = async (rating: RatingType, comment: string) => {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transactionType,
        transactionId,
        revieweeId,
        ratingType: rating,
        comment,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to submit feedback");
    }

    onFeedbackSubmitted?.();
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        <MessageSquarePlus className="h-4 w-4" />
        Leave Feedback
      </button>

      <FeedbackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        transactionType={transactionType}
        transactionId={transactionId}
        revieweeId={revieweeId}
        revieweeName={revieweeName}
        onSubmit={handleSubmit}
      />
    </>
  );
}
