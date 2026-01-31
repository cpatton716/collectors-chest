"use client";

import { formatDistanceToNow } from "date-fns";
import { MessageSquare, ThumbsDown, ThumbsUp } from "lucide-react";

import { TransactionFeedback } from "@/types/reputation";

interface FeedbackListProps {
  feedback: TransactionFeedback[];
  showTransactionType?: boolean;
  emptyMessage?: string;
}

export function FeedbackList({
  feedback,
  showTransactionType = true,
  emptyMessage = "No feedback yet",
}: FeedbackListProps) {
  if (feedback.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">{emptyMessage}</p>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {feedback.map((item) => (
        <FeedbackItem
          key={item.id}
          feedback={item}
          showTransactionType={showTransactionType}
        />
      ))}
    </div>
  );
}

function FeedbackItem({
  feedback,
  showTransactionType,
}: {
  feedback: TransactionFeedback;
  showTransactionType: boolean;
}) {
  const isPositive = feedback.ratingType === "positive";
  const reviewerDisplay = feedback.reviewerUsername
    ? `@${feedback.reviewerUsername}`
    : feedback.reviewerName || "Anonymous";

  const transactionLabels = {
    sale: "Sale",
    auction: "Auction",
    trade: "Trade",
  };

  return (
    <div className="py-4">
      {/* Header */}
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          {isPositive ? (
            <ThumbsUp className="h-4 w-4 text-green-600" />
          ) : (
            <ThumbsDown className="h-4 w-4 text-red-600" />
          )}
          <span className="text-sm font-medium text-gray-900">
            {reviewerDisplay}
          </span>
          {showTransactionType && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              {transactionLabels[feedback.transactionType]}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {formatDistanceToNow(new Date(feedback.createdAt), { addSuffix: true })}
        </span>
      </div>

      {/* Comment */}
      {feedback.comment && (
        <p className="mb-2 text-sm text-gray-700">{feedback.comment}</p>
      )}

      {/* Seller Response */}
      {feedback.sellerResponse && (
        <div className="mt-3 rounded-lg bg-gray-50 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-600">
            <MessageSquare className="h-3 w-3" />
            Seller Response
          </div>
          <p className="text-sm text-gray-700">{feedback.sellerResponse}</p>
        </div>
      )}
    </div>
  );
}

// Summary stats component
export function FeedbackSummary({
  positiveCount,
  negativeCount,
}: {
  positiveCount: number;
  negativeCount: number;
}) {
  const total = positiveCount + negativeCount;
  const percentage = total > 0 ? Math.round((positiveCount / total) * 100) : 0;

  return (
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-2">
        <ThumbsUp className="h-5 w-5 text-green-600" />
        <span className="text-lg font-semibold text-gray-900">{positiveCount}</span>
        <span className="text-sm text-gray-500">positive</span>
      </div>
      <div className="flex items-center gap-2">
        <ThumbsDown className="h-5 w-5 text-red-600" />
        <span className="text-lg font-semibold text-gray-900">{negativeCount}</span>
        <span className="text-sm text-gray-500">negative</span>
      </div>
      {total >= 5 && (
        <div className="ml-auto text-sm text-gray-600">
          <span className="font-semibold">{percentage}%</span> positive
        </div>
      )}
    </div>
  );
}
