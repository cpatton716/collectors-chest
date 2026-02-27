"use client";

import { useState } from "react";

import { isSellerResponseEditable, TransactionFeedback } from "@/types/creatorCredits";

interface SellerResponseFormProps {
  feedback: TransactionFeedback;
  onSubmit: (response: string) => Promise<void>;
}

export function SellerResponseForm({ feedback, onSubmit }: SellerResponseFormProps) {
  const [response, setResponse] = useState(feedback.sellerResponse || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(!feedback.sellerResponse);

  // Only show for negative feedback
  if (feedback.ratingType !== "negative") {
    return null;
  }

  // Check if response can still be edited
  const canEdit = !feedback.sellerResponseAt ||
    isSellerResponseEditable(feedback.sellerResponseAt);

  if (!canEdit && feedback.sellerResponse) {
    return null; // Response exists and can't be edited - show in FeedbackList instead
  }

  const handleSubmit = async () => {
    if (!response.trim()) {
      setError("Response cannot be empty");
      return;
    }

    if (response.length > 500) {
      setError("Response must be 500 characters or less");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(response);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit response");
    } finally {
      setIsSubmitting(false);
    }
  };

  const remainingChars = 500 - response.length;

  if (!isEditing && feedback.sellerResponse) {
    return (
      <div className="mt-3">
        <button
          onClick={() => setIsEditing(true)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Edit your response
        </button>
        <p className="mt-1 text-xs text-gray-500">
          You can edit for 48 hours after posting
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-gray-200 p-4">
      <h4 className="mb-2 text-sm font-medium text-gray-900">
        {feedback.sellerResponse ? "Edit Your Response" : "Respond to This Feedback"}
      </h4>
      <p className="mb-3 text-xs text-gray-500">
        Your response will be publicly visible alongside this feedback.
        {!feedback.sellerResponse && " You can edit it for 48 hours after posting."}
      </p>

      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Share your perspective on this transaction..."
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

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3 flex gap-2">
        {feedback.sellerResponse && (
          <button
            onClick={() => {
              setResponse(feedback.sellerResponse || "");
              setIsEditing(false);
            }}
            disabled={isSubmitting}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !response.trim()}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting
            ? "Submitting..."
            : feedback.sellerResponse
              ? "Update Response"
              : "Post Response"}
        </button>
      </div>
    </div>
  );
}
