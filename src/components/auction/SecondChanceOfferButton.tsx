"use client";

import { useState } from "react";

import { Gift, Loader2 } from "lucide-react";

import { formatPrice } from "@/types/auction";

interface SecondChanceOfferButtonProps {
  auctionId: string;
  runnerUpLastBid: number;
  /**
   * Called with the created offer id on success so parent can hide the
   * button or refresh state.
   */
  onOfferCreated?: (offerId: string) => void;
  disabled?: boolean;
}

/**
 * Seller-facing CTA that appears on a cancelled auction where a runner-up
 * exists and no second-chance offer has been created yet. Clicking sends
 * a POST to /api/auctions/:id/second-chance and, after a confirm, creates
 * the 48-hour offer.
 */
export function SecondChanceOfferButton({
  auctionId,
  runnerUpLastBid,
  onOfferCreated,
  disabled = false,
}: SecondChanceOfferButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleClick = () => {
    setError(null);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/auctions/${auctionId}/second-chance`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create offer");
        return;
      }
      onOfferCreated?.(data.offer?.id);
      setConfirmOpen(false);
    } catch {
      setError("Failed to create offer");
    } finally {
      setIsLoading(false);
    }
  };

  if (confirmOpen) {
    return (
      <div className="p-4 bg-white border-2 border-pop-black rounded-lg shadow-[3px_3px_0_#000] space-y-3">
        <div className="flex items-start gap-2">
          <Gift className="w-5 h-5 text-pop-blue flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-pop-black">
              Offer to runner-up for {formatPrice(runnerUpLastBid)}?
            </p>
            <p className="text-sm text-gray-600 mt-1">
              The runner-up will get 48 hours to accept or decline at their
              last bid price.
            </p>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setConfirmOpen(false)}
            disabled={isLoading}
            className="px-4 py-2 border-2 border-pop-black font-semibold rounded-md hover:bg-gray-100 disabled:opacity-50 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-pop-blue text-white font-bold rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm inline-flex items-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Send Offer
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className="w-full sm:w-auto px-4 py-2 bg-pop-blue text-white font-bold border-2 border-pop-black rounded-md hover:bg-blue-700 shadow-[3px_3px_0_#000] disabled:opacity-50 inline-flex items-center gap-2"
    >
      <Gift className="w-4 h-4" />
      Offer to Runner-up for {formatPrice(runnerUpLastBid)}
    </button>
  );
}

export default SecondChanceOfferButton;
