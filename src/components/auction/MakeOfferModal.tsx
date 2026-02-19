"use client";

import { useState } from "react";

import { AlertCircle, DollarSign, Send, X } from "lucide-react";

import { Auction, MIN_FIXED_PRICE, formatPrice } from "@/types/auction";
import { isAgeVerificationError } from "@/lib/ageVerification";

import AgeVerificationModal from "@/components/AgeVerificationModal";
import { ComicImage } from "../ComicImage";

interface MakeOfferModalProps {
  listing: Auction;
  isOpen: boolean;
  onClose: () => void;
  onOfferMade?: () => void;
}

export function MakeOfferModal({ listing, isOpen, onClose, onOfferMade }: MakeOfferModalProps) {
  const [offerAmount, setOfferAmount] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showAgeGate, setShowAgeGate] = useState(false);

  const handleSubmit = async () => {
    const amount = parseFloat(offerAmount);

    if (isNaN(amount) || amount < MIN_FIXED_PRICE) {
      setError(`Offer must be at least ${formatPrice(MIN_FIXED_PRICE)}`);
      return;
    }

    if (amount >= listing.startingPrice) {
      setError(`For offers at or above the asking price, use the Buy Now button instead`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          amount,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          onOfferMade?.();
          onClose();
        }, 2000);
      } else {
        if (isAgeVerificationError(data)) {
          setShowAgeGate(true);
          return;
        }
        setError(data.error || "Failed to submit offer");
      }
    } catch {
      setError("Failed to submit offer. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setOfferAmount("");
    setError(null);
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Make an Offer</h2>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Send className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-green-700">Offer Sent!</h3>
              <p className="text-sm text-gray-600 mt-2">
                The seller will be notified. You'll receive a notification when they respond.
              </p>
            </div>
          ) : (
            <>
              {/* Listing Info */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                {listing.comic?.coverImageUrl && (
                  <div className="w-12 h-16 rounded overflow-hidden flex-shrink-0">
                    <ComicImage
                      src={listing.comic.coverImageUrl}
                      alt={listing.comic?.comic.title || "Comic"}
                      aspectRatio="fill"
                      sizes="48px"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{listing.comic?.comic.title}</p>
                  <p className="text-sm text-gray-600">#{listing.comic?.comic.issueNumber}</p>
                </div>
              </div>

              {/* Asking Price */}
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Asking Price</span>
                <span className="font-semibold text-lg">{formatPrice(listing.startingPrice)}</span>
              </div>

              {/* Offer Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Offer</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    placeholder="Enter your offer"
                    min={MIN_FIXED_PRICE}
                    step="0.01"
                    className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg bg-white text-gray-900"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Offers expire after 48 hours if no response
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="p-4 border-t bg-gray-50">
            <button
              onClick={handleSubmit}
              disabled={isLoading || !offerAmount}
              className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit Offer
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {showAgeGate && (
        <AgeVerificationModal
          action="make an offer"
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
