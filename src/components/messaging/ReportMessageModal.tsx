"use client";

import { useState } from "react";

import { Flag, Loader2, X } from "lucide-react";

import { useModalA11y } from "@/hooks/useModalA11y";
import { ReportReason } from "@/types/messaging";

interface ReportMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
  onReported?: () => void;
}

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam or advertising" },
  { value: "scam", label: "Scam or fraud attempt" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "other", label: "Other" },
];

export function ReportMessageModal({
  isOpen,
  onClose,
  messageId,
  onReported,
}: ReportMessageModalProps) {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { dialogProps, titleId } = useModalA11y({ isOpen, onClose });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason) {
      setError("Please select a reason");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/messages/report/${messageId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details: details || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit report");
      }

      onReported?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        {...dialogProps}
        className="relative w-full max-w-md rounded-lg border-4 border-pop-black bg-pop-white p-6 shadow-comic outline-none"
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-gray-500 hover:text-pop-black"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-full bg-pop-yellow/20 p-2">
            <Flag className="h-6 w-6 text-pop-yellow" />
          </div>
          <h2 id={titleId} className="text-xl font-black">
            Report Message
          </h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="mb-2 block text-sm font-bold">
              Reason for report <span className="text-pop-red">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
              className="w-full rounded-lg border-2 border-pop-black px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-pop-blue"
              required
            >
              <option value="">Select a reason...</option>
              {REPORT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-bold">Additional details (optional)</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide any additional context..."
              rows={3}
              maxLength={500}
              className="w-full resize-none rounded-lg border-2 border-pop-black px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pop-blue"
            />
            <p className="mt-1 text-xs text-gray-500">{details.length}/500</p>
          </div>

          {error && <p className="mb-4 text-sm text-pop-red">{error}</p>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border-2 border-pop-black px-4 py-2 font-bold transition-all hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason}
              className="flex items-center gap-2 rounded-lg border-2 border-pop-black bg-pop-yellow px-4 py-2 font-bold transition-all hover:shadow-comic disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Flag className="h-4 w-4" />
              )}
              Submit Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
