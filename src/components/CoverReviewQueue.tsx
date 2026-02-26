"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { X, Check, SkipForward, Loader2 } from "lucide-react";

interface CoverCandidate {
  url: string;
  title: string;
  source: string;
}

interface ReviewItem {
  id: string;
  title: string;
  issueNumber: string;
  publisher?: string;
  releaseYear?: string;
  coverImageUrl?: string;
}

interface CoverReviewQueueProps {
  items: ReviewItem[];
  onCoverSet: (itemId: string, imageUrl: string) => void;
  onComplete: () => void;
  onCancel: () => void;
}

export default function CoverReviewQueue({
  items,
  onCoverSet,
  onComplete,
  onCancel,
}: CoverReviewQueueProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [candidates, setCandidates] = useState<CoverCandidate[]>([]);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Filter to items missing covers
  const needsCover = items.filter((item) => !item.coverImageUrl);
  const current = needsCover[currentIndex];

  const fetchCandidates = useCallback(async (item: ReviewItem) => {
    setLoading(true);
    setCandidates([]);
    setSelectedUrl(null);
    setSearchQuery(null);
    setImageErrors(new Set());

    try {
      const res = await fetch("/api/cover-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          issueNumber: item.issueNumber,
          publisher: item.publisher,
          releaseYear: item.releaseYear,
        }),
      });

      if (!res.ok) throw new Error("Failed to fetch candidates");
      const data = await res.json();

      setCandidates(data.candidates || []);
      setSearchQuery(data.searchQuery);

      // Auto-select if community match
      if (data.source === "community" && data.candidates.length === 1) {
        setSelectedUrl(data.candidates[0].url);
      }
    } catch (err) {
      console.error("Failed to fetch cover candidates:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (current) {
      fetchCandidates(current);
    }
  }, [currentIndex, current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = async () => {
    if (!selectedUrl || !current) return;
    setSubmitting(true);

    try {
      // Submit to community DB
      await fetch("/api/cover-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: current.title,
          issueNumber: current.issueNumber,
          imageUrl: selectedUrl,
          sourceQuery: searchQuery,
          candidateCount: candidates.length,
        }),
      });

      // Update the comic's cover
      onCoverSet(current.id, selectedUrl);

      // Move to next
      if (currentIndex + 1 < needsCover.length) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        onComplete();
      }
    } catch (err) {
      console.error("Failed to submit cover:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (currentIndex + 1 < needsCover.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  if (needsCover.length === 0) {
    onComplete();
    return null;
  }

  if (!current) return null;

  // Filter out images that failed to load
  const visibleCandidates = candidates.filter((c) => !imageErrors.has(c.url));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-pop-cream rounded-lg border-2 border-black max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-black">
          <div>
            <h2 className="font-comic font-bold text-lg">Pick a Cover</h2>
            <p className="text-sm text-gray-500">
              {currentIndex + 1} of {needsCover.length} comics
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-black/10 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comic info */}
        <div className="p-4 bg-white border-b-2 border-black">
          <p className="font-comic font-bold text-lg">
            {current.title} #{current.issueNumber}
          </p>
          {current.publisher && (
            <p className="text-sm text-gray-600">{current.publisher}</p>
          )}
        </div>

        {/* Candidates */}
        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-pop-blue mb-3" />
              <p className="text-sm text-gray-500">Searching for covers...</p>
            </div>
          ) : visibleCandidates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No cover images found</p>
              <p className="text-sm mt-1">
                You can add a cover manually later from the edit screen
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {visibleCandidates.map((candidate, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedUrl(candidate.url)}
                  className={`relative aspect-[2/3] rounded-lg overflow-hidden border-2 transition-all ${
                    selectedUrl === candidate.url
                      ? "border-green-500 ring-2 ring-green-300 scale-105"
                      : "border-gray-300 hover:border-gray-500"
                  }`}
                >
                  <Image
                    src={candidate.url}
                    alt={candidate.title || `Cover option ${idx + 1}`}
                    fill
                    className="object-cover"
                    unoptimized
                    onError={() =>
                      setImageErrors((prev) => new Set(prev).add(candidate.url))
                    }
                  />
                  {selectedUrl === candidate.url && (
                    <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                    <p className="text-white text-[10px] truncate">
                      {candidate.source}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 border-t-2 border-black">
          <button
            onClick={handleSkip}
            className="flex items-center gap-1 px-4 py-2 bg-yellow-400 border-2 border-black rounded-lg font-bold hover:bg-yellow-500 transition-colors"
          >
            <SkipForward className="w-4 h-4" />
            Skip
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedUrl || submitting}
            className="flex-1 flex items-center justify-center gap-1 px-4 py-2 bg-green-500 text-white border-2 border-black rounded-lg font-bold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Set Cover
          </button>
        </div>
      </div>
    </div>
  );
}
