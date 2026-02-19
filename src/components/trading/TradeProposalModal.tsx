"use client";

import { useEffect, useState } from "react";

import Image from "next/image";

import { ArrowLeftRight, Check, Loader2, X } from "lucide-react";

import { isAgeVerificationError } from "@/lib/ageVerification";

import AgeVerificationModal from "@/components/AgeVerificationModal";

interface Comic {
  id: string;
  title: string;
  issueNumber: string;
  publisher: string;
  coverImageUrl?: string;
  grade?: string;
  estimatedValue?: number;
}

interface TradeProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId: string;
  recipientName: string;
  preselectedTheirComicId?: string;
  onTradeCreated: (tradeId: string) => void;
}

export function TradeProposalModal({
  isOpen,
  onClose,
  recipientId,
  recipientName,
  preselectedTheirComicId,
  onTradeCreated,
}: TradeProposalModalProps) {
  const [myComics, setMyComics] = useState<Comic[]>([]);
  const [theirComics, setTheirComics] = useState<Comic[]>([]);
  const [selectedMyComics, setSelectedMyComics] = useState<string[]>([]);
  const [selectedTheirComics, setSelectedTheirComics] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAgeGate, setShowAgeGate] = useState(false);

  // Load comics when modal opens
  useEffect(() => {
    if (isOpen) {
      loadComics();
    }
  }, [isOpen, recipientId]);

  // Preselect their comic if provided
  useEffect(() => {
    if (preselectedTheirComicId && theirComics.length > 0) {
      if (theirComics.some((c) => c.id === preselectedTheirComicId)) {
        setSelectedTheirComics([preselectedTheirComicId]);
      }
    }
  }, [preselectedTheirComicId, theirComics]);

  const loadComics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch my for-trade comics
      const myResponse = await fetch("/api/comics/for-trade");
      if (myResponse.ok) {
        const myData = await myResponse.json();
        setMyComics(myData.comics || []);
      }

      // Fetch their for-trade comics
      const theirResponse = await fetch(`/api/comics/for-trade?userId=${recipientId}`);
      if (theirResponse.ok) {
        const theirData = await theirResponse.json();
        setTheirComics(theirData.comics || []);
      }
    } catch {
      setError("Failed to load comics");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMyComic = (comicId: string) => {
    setSelectedMyComics((prev) =>
      prev.includes(comicId) ? prev.filter((id) => id !== comicId) : [...prev, comicId]
    );
  };

  const toggleTheirComic = (comicId: string) => {
    setSelectedTheirComics((prev) =>
      prev.includes(comicId) ? prev.filter((id) => id !== comicId) : [...prev, comicId]
    );
  };

  const handleSubmit = async () => {
    if (selectedMyComics.length === 0 || selectedTheirComics.length === 0) {
      setError("Select at least one comic from each side");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId,
          myComicIds: selectedMyComics,
          theirComicIds: selectedTheirComics,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        onTradeCreated(data.trade.id);
        onClose();
        // Reset state
        setSelectedMyComics([]);
        setSelectedTheirComics([]);
      } else {
        const data = await response.json();
        if (isAgeVerificationError(data)) {
          setShowAgeGate(true);
          return;
        }
        setError(data.error || "Failed to create trade");
      }
    } catch {
      setError("Failed to create trade");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative bg-pop-white border-3 border-pop-black w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{ boxShadow: "6px 6px 0px #000" }}
      >
        {/* Header */}
        <div className="p-4 border-b-3 border-pop-black flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ArrowLeftRight className="w-6 h-6" />
            <h2 className="text-xl font-black font-comic">Propose Trade</h2>
            <span className="text-gray-600">with {recipientName}</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-pop-blue" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* My Comics */}
              <div>
                <h3 className="font-bold mb-3 text-sm text-gray-600">
                  You&apos;re Offering ({selectedMyComics.length} selected)
                </h3>
                {myComics.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    No comics marked for trade. Go to your collection to mark comics as available
                    for trade.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {myComics.map((comic) => (
                      <ComicSelectCard
                        key={comic.id}
                        comic={comic}
                        selected={selectedMyComics.includes(comic.id)}
                        onToggle={() => toggleMyComic(comic.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Their Comics */}
              <div>
                <h3 className="font-bold mb-3 text-sm text-gray-600">
                  You&apos;re Requesting ({selectedTheirComics.length} selected)
                </h3>
                {theirComics.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    {recipientName} has no comics marked for trade.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {theirComics.map((comic) => (
                      <ComicSelectCard
                        key={comic.id}
                        comic={comic}
                        selected={selectedTheirComics.includes(comic.id)}
                        onToggle={() => toggleTheirComic(comic.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-100 border-2 border-red-500 text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t-3 border-pop-black flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 font-bold border-2 border-pop-black bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              isSubmitting || selectedMyComics.length === 0 || selectedTheirComics.length === 0
            }
            className="px-6 py-2 font-bold border-2 border-pop-black bg-pop-green text-white shadow-[2px_2px_0px_#000] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Propose Trade"}
          </button>
        </div>
      </div>

      {showAgeGate && (
        <AgeVerificationModal
          action="propose a trade"
          onVerified={() => {
            setShowAgeGate(false);
            handleSubmit();
          }}
          onDismiss={() => setShowAgeGate(false)}
        />
      )}
    </div>
  );
}

// Sub-component for selectable comic card
function ComicSelectCard({
  comic,
  selected,
  onToggle,
}: {
  comic: Comic;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      className={`flex items-center gap-3 p-2 border-2 cursor-pointer transition-all ${
        selected ? "border-pop-green bg-green-50" : "border-gray-200 hover:border-gray-300"
      }`}
    >
      {/* Checkbox */}
      <div
        className={`w-5 h-5 border-2 flex items-center justify-center flex-shrink-0 ${
          selected ? "border-pop-green bg-pop-green text-white" : "border-gray-300"
        }`}
      >
        {selected && <Check className="w-3 h-3" />}
      </div>

      {/* Cover */}
      <div className="w-10 h-14 border border-gray-200 bg-gray-50 overflow-hidden flex-shrink-0">
        {comic.coverImageUrl && (
          <Image
            src={comic.coverImageUrl}
            alt={comic.title}
            width={40}
            height={56}
            className="object-cover w-full h-full"
          />
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{comic.title}</p>
        <p className="text-xs text-gray-500">#{comic.issueNumber}</p>
      </div>

      {/* Value */}
      {comic.estimatedValue && (
        <span className="text-sm font-bold text-pop-green">${comic.estimatedValue.toFixed(0)}</span>
      )}
    </div>
  );
}
