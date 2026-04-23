"use client";

import { useState } from "react";

import { AlertCircle, Loader2, Package } from "lucide-react";

/**
 * Inline form for a seller to mark a sold+paid listing as shipped.
 * Option A — tracking number + carrier are both optional and not validated.
 * Submitting triggers the comic ownership transfer to the buyer and unlocks
 * feedback eligibility for both parties.
 *
 * Shared by ListingDetailModal (fixed_price) and AuctionDetailModal (auction)
 * since the shipping flow is identical across listing types.
 */
export function MarkAsShippedForm({
  listingId,
  onShipped,
}: {
  listingId: string;
  onShipped: () => void;
}) {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingCarrier, setTrackingCarrier] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/auctions/${listingId}/mark-shipped`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingNumber: trackingNumber.trim() || undefined,
          trackingCarrier: trackingCarrier.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onShipped();
        return;
      }
      setError(data.error || "Failed to mark as shipped");
    } catch {
      setError("Failed to mark as shipped");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-2 p-4 border-2 border-pop-black rounded-lg bg-amber-50 mb-3">
      <div className="flex items-center gap-2 text-pop-black font-semibold">
        <Package className="w-4 h-4" />
        Mark as Shipped
      </div>
      <p className="text-xs text-gray-600">
        Once you ship, the comic transfers to the buyer and both parties can leave feedback.
        Tracking info is optional for now but strongly recommended.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="Carrier (USPS, UPS, …)"
          value={trackingCarrier}
          onChange={(e) => setTrackingCarrier(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded text-sm"
          maxLength={50}
          disabled={isSubmitting}
        />
        <input
          type="text"
          placeholder="Tracking number"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded text-sm"
          maxLength={100}
          disabled={isSubmitting}
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Marking as shipped…
          </>
        ) : (
          <>
            <Package className="w-4 h-4" />
            Mark as Shipped
          </>
        )}
      </button>
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}
