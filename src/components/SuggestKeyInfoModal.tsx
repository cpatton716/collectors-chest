"use client";

import { useState } from "react";

import { CheckCircle, KeyRound, Link, Loader2, MessageSquare, Plus, Trash2, X } from "lucide-react";

interface SuggestKeyInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  comicTitle: string;
  issueNumber: string;
  publisher?: string;
  releaseYear?: string | null;
  existingKeyInfo?: string[];
}

export function SuggestKeyInfoModal({
  isOpen,
  onClose,
  comicTitle,
  issueNumber,
  publisher,
  releaseYear,
  existingKeyInfo = [],
}: SuggestKeyInfoModalProps) {
  const [keyInfoEntries, setKeyInfoEntries] = useState<string[]>([""]);
  const [sourceUrl, setSourceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleAddEntry = () => {
    if (keyInfoEntries.length < 5) {
      setKeyInfoEntries([...keyInfoEntries, ""]);
    }
  };

  const handleRemoveEntry = (index: number) => {
    if (keyInfoEntries.length > 1) {
      setKeyInfoEntries(keyInfoEntries.filter((_, i) => i !== index));
    }
  };

  const handleEntryChange = (index: number, value: string) => {
    const newEntries = [...keyInfoEntries];
    newEntries[index] = value;
    setKeyInfoEntries(newEntries);
  };

  const handleSubmit = async () => {
    // Validate
    const validEntries = keyInfoEntries.filter((e) => e.trim().length > 0);
    if (validEntries.length === 0) {
      setError("Please enter at least one key info suggestion");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/key-info/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: comicTitle,
          issueNumber,
          publisher,
          releaseYear: releaseYear ? parseInt(releaseYear, 10) : undefined,
          suggestedKeyInfo: validEntries,
          sourceUrl: sourceUrl.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset state when closing
    setKeyInfoEntries([""]);
    setSourceUrl("");
    setNotes("");
    setError(null);
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-gray-900">Suggest Key Info</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {success ? (
            // Success State
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Thank You!</h3>
              <p className="text-gray-600 mb-6">
                Your suggestion has been submitted for review. We appreciate your contribution to
                the community!
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Comic Info */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="font-medium text-gray-900">
                  {comicTitle} #{issueNumber}
                </p>
                {publisher && <p className="text-sm text-gray-600">{publisher}</p>}
              </div>

              {/* Existing Key Info */}
              {existingKeyInfo.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Current Key Info:</p>
                  <div className="flex flex-wrap gap-2">
                    {existingKeyInfo.map((info, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full"
                      >
                        <KeyRound className="w-3 h-3" />
                        {info}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Info Entries */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Suggestions *
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Add key info like &quot;First appearance of [character]&quot;, &quot;Death of
                  [character]&quot;, &quot;Classic cover&quot;, etc.
                </p>
                <div className="space-y-2">
                  {keyInfoEntries.map((entry, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={entry}
                        onChange={(e) => handleEntryChange(index, e.target.value)}
                        placeholder="e.g., First appearance of Spider-Gwen"
                        maxLength={200}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
                      />
                      {keyInfoEntries.length > 1 && (
                        <button
                          onClick={() => handleRemoveEntry(index)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {keyInfoEntries.length < 5 && (
                  <button
                    onClick={handleAddEntry}
                    className="mt-2 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add another
                  </button>
                )}
              </div>

              {/* Source URL */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Link className="w-4 h-4 inline mr-1" />
                  Source URL (optional)
                </label>
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://www.comics.org/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Link to CGC, GCD, or Wikipedia for verification
                </p>
              </div>

              {/* Notes */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MessageSquare className="w-4 h-4 inline mr-1" />
                  Additional Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional context..."
                  rows={2}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none text-gray-900"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full py-3 bg-amber-500 text-white font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    Submit Suggestion
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center mt-3">
                Suggestions are reviewed before being added to the database
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
