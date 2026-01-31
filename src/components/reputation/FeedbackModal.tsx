"use client";

import { useState } from "react";

import { ThumbsDown, ThumbsUp, X } from "lucide-react";

import { RatingType, TransactionType } from "@/types/reputation";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionType: TransactionType;
  transactionId: string;
  revieweeId: string;
  revieweeName: string;
  onSubmit: (rating: RatingType, comment: string) => Promise<void>;
}

export function FeedbackModal({
  isOpen,
  onClose,
  transactionType,
  transactionId,
  revieweeId,
  revieweeName,
  onSubmit,
}: FeedbackModalProps) {
  const [rating, setRating] = useState<RatingType | null>(null);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const transactionLabel = {
    sale: "purchase",
    auction: "auction",
    trade: "trade",
  }[transactionType];

  const handleSubmit = async () => {
    if (!rating) {
      setError("Please select a rating");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(rating, comment);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const remainingChars = 500 - comment.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Leave Feedback
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Description */}
        <p className="mb-6 text-sm text-gray-600">
          How was your {transactionLabel} experience with{" "}
          <span className="font-medium">{revieweeName}</span>?
        </p>

        {/* Rating Selection */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => setRating("positive")}
            className={`flex flex-1 flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
              rating === "positive"
                ? "border-green-500 bg-green-50"
                : "border-gray-200 hover:border-green-300"
            }`}
          >
            <ThumbsUp
              className={`h-8 w-8 ${
                rating === "positive" ? "text-green-600" : "text-gray-400"
              }`}
            />
            <span
              className={`font-medium ${
                rating === "positive" ? "text-green-700" : "text-gray-600"
              }`}
            >
              Positive
            </span>
          </button>

          <button
            onClick={() => setRating("negative")}
            className={`flex flex-1 flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
              rating === "negative"
                ? "border-red-500 bg-red-50"
                : "border-gray-200 hover:border-red-300"
            }`}
          >
            <ThumbsDown
              className={`h-8 w-8 ${
                rating === "negative" ? "text-red-600" : "text-gray-400"
              }`}
            />
            <span
              className={`font-medium ${
                rating === "negative" ? "text-red-700" : "text-gray-600"
              }`}
            >
              Negative
            </span>
          </button>
        </div>

        {/* Comment */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Comment (optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share details about your experience..."
            maxLength={500}
            rows={3}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p
            className={`mt-1 text-right text-xs ${
              remainingChars < 50 ? "text-orange-600" : "text-gray-400"
            }`}
          >
            {remainingChars} characters remaining
          </p>
        </div>

        {/* Error */}
        {error && (
          <p className="mb-4 text-sm text-red-600">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !rating}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "Submitting..." : "Submit Feedback"}
          </button>
        </div>
      </div>
    </div>
  );
}
