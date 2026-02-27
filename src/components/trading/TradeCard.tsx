"use client";

import { useState } from "react";

import Image from "next/image";

import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronUp,
  Package,
  Star,
  Truck,
  X,
} from "lucide-react";

import { useFeedbackEligibility } from "@/hooks/useFeedbackEligibility";

import { LeaveFeedbackButton } from "@/components/creatorCredits";

import { TradePreview, getTradeStatusColor, getTradeStatusLabel } from "@/types/trade";

interface TradeCardProps {
  trade: TradePreview;
  onStatusChange: () => void;
}

export function TradeCard({ trade, onStatusChange }: TradeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [trackingCarrier, setTrackingCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

  // Check feedback eligibility for completed trades
  const { eligibility } = useFeedbackEligibility(
    trade.status === "completed" ? trade.id : undefined,
    trade.status === "completed" ? "trade" : undefined
  );

  const handleAction = async (action: string, data?: Record<string, unknown>) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/trades/${trade.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...data }),
      });
      if (response.ok) {
        onStatusChange();
        setShowShippingForm(false);
        setTrackingCarrier("");
        setTrackingNumber("");
      }
    } catch (error) {
      console.error("Error updating trade:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusChange = async (status: string, cancelReason?: string) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/trades/${trade.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, cancelReason }),
      });
      if (response.ok) {
        onStatusChange();
      }
    } catch (error) {
      console.error("Error updating trade:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleShip = () => {
    handleAction("ship", {
      trackingCarrier: trackingCarrier || undefined,
      trackingNumber: trackingNumber || undefined,
    });
  };

  return (
    <div
      className="bg-pop-white border-3 border-pop-black"
      style={{ boxShadow: "4px 4px 0px #000" }}
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <p className="font-bold">{trade.otherUser.displayName}</p>
            {trade.otherUser.totalRatings > 0 && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                {trade.otherUser.positivePercentage}% ({trade.otherUser.totalRatings})
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 text-sm font-bold rounded ${getTradeStatusColor(trade.status)}`}
          >
            {getTradeStatusLabel(trade.status)}
          </span>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-gray-100 rounded"
          >
            {isExpanded ? <ChevronUp /> : <ChevronDown />}
          </button>
        </div>
      </div>

      {/* Comic previews (always shown) */}
      <div className="px-4 pb-4 flex items-center gap-4">
        {/* My items */}
        <div className="flex -space-x-2">
          {trade.myItems.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="w-12 h-16 border-2 border-pop-black bg-gray-100 overflow-hidden"
            >
              {item.comic?.coverImageUrl && (
                <Image
                  src={item.comic.coverImageUrl}
                  alt={item.comic.title || "Comic"}
                  width={48}
                  height={64}
                  className="object-cover w-full h-full"
                />
              )}
            </div>
          ))}
          {trade.myItems.length > 3 && (
            <div className="w-12 h-16 border-2 border-pop-black bg-gray-200 flex items-center justify-center text-xs font-bold">
              +{trade.myItems.length - 3}
            </div>
          )}
        </div>

        <ArrowLeftRight className="w-6 h-6 text-gray-400" />

        {/* Their items */}
        <div className="flex -space-x-2">
          {trade.theirItems.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="w-12 h-16 border-2 border-pop-black bg-gray-100 overflow-hidden"
            >
              {item.comic?.coverImageUrl && (
                <Image
                  src={item.comic.coverImageUrl}
                  alt={item.comic.title || "Comic"}
                  width={48}
                  height={64}
                  className="object-cover w-full h-full"
                />
              )}
            </div>
          ))}
          {trade.theirItems.length > 3 && (
            <div className="w-12 h-16 border-2 border-pop-black bg-gray-200 flex items-center justify-center text-xs font-bold">
              +{trade.theirItems.length - 3}
            </div>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t-3 border-pop-black p-4">
          <div className="grid grid-cols-2 gap-6">
            {/* You're giving */}
            <div>
              <h4 className="font-bold text-sm text-gray-600 mb-2">You&apos;re Giving</h4>
              <div className="space-y-2">
                {trade.myItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <div className="w-10 h-14 border border-gray-200 bg-gray-50 overflow-hidden flex-shrink-0">
                      {item.comic?.coverImageUrl && (
                        <Image
                          src={item.comic.coverImageUrl}
                          alt={item.comic.title || "Comic"}
                          width={40}
                          height={56}
                          className="object-cover w-full h-full"
                        />
                      )}
                    </div>
                    <div className="text-sm min-w-0">
                      <p className="font-medium truncate">{item.comic?.title}</p>
                      <p className="text-gray-500">#{item.comic?.issueNumber}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* You're getting */}
            <div>
              <h4 className="font-bold text-sm text-gray-600 mb-2">You&apos;re Getting</h4>
              <div className="space-y-2">
                {trade.theirItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <div className="w-10 h-14 border border-gray-200 bg-gray-50 overflow-hidden flex-shrink-0">
                      {item.comic?.coverImageUrl && (
                        <Image
                          src={item.comic.coverImageUrl}
                          alt={item.comic.title || "Comic"}
                          width={40}
                          height={56}
                          className="object-cover w-full h-full"
                        />
                      )}
                    </div>
                    <div className="text-sm min-w-0">
                      <p className="font-medium truncate">{item.comic?.title}</p>
                      <p className="text-gray-500">#{item.comic?.issueNumber}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Shipping Form */}
          {showShippingForm && (
            <div className="mt-4 p-4 bg-gray-50 border-2 border-pop-black">
              <h4 className="font-bold text-sm mb-3">Shipping Details (Optional)</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Carrier</label>
                  <select
                    value={trackingCarrier}
                    onChange={(e) => setTrackingCarrier(e.target.value)}
                    className="w-full border-2 border-pop-black px-3 py-2 text-sm"
                  >
                    <option value="">Select carrier</option>
                    <option value="usps">USPS</option>
                    <option value="ups">UPS</option>
                    <option value="fedex">FedEx</option>
                    <option value="dhl">DHL</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Tracking Number</label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Enter tracking #"
                    className="w-full border-2 border-pop-black px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleShip}
                  disabled={isUpdating}
                  className="flex items-center gap-2 px-4 py-2 bg-pop-blue text-white font-bold border-2 border-pop-black shadow-[2px_2px_0px_#000]"
                >
                  <Package className="w-4 h-4" />
                  {isUpdating ? "Sending..." : "Confirm Shipped"}
                </button>
                <button
                  onClick={() => setShowShippingForm(false)}
                  className="px-4 py-2 bg-gray-200 font-bold border-2 border-pop-black"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 pt-4 border-t flex gap-2 flex-wrap">
            {/* Proposed - Recipient can accept/decline */}
            {trade.status === "proposed" && !trade.isProposer && (
              <>
                <button
                  onClick={() => handleStatusChange("accepted")}
                  disabled={isUpdating}
                  className="flex items-center gap-2 px-4 py-2 bg-pop-green text-white font-bold border-2 border-pop-black shadow-[2px_2px_0px_#000] disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Accept
                </button>
                <button
                  onClick={() => handleStatusChange("declined")}
                  disabled={isUpdating}
                  className="flex items-center gap-2 px-4 py-2 bg-pop-red text-white font-bold border-2 border-pop-black shadow-[2px_2px_0px_#000] disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Decline
                </button>
              </>
            )}

            {/* Accepted - Both can ship */}
            {trade.status === "accepted" && !showShippingForm && (
              <button
                onClick={() => setShowShippingForm(true)}
                disabled={isUpdating}
                className="flex items-center gap-2 px-4 py-2 bg-pop-blue text-white font-bold border-2 border-pop-black shadow-[2px_2px_0px_#000] disabled:opacity-50"
              >
                <Truck className="w-4 h-4" />
                Mark as Shipped
              </button>
            )}

            {/* Shipped - Can confirm receipt */}
            {trade.status === "shipped" && (
              <button
                onClick={() => handleAction("confirm_receipt")}
                disabled={isUpdating}
                className="flex items-center gap-2 px-4 py-2 bg-pop-green text-white font-bold border-2 border-pop-black shadow-[2px_2px_0px_#000] disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Confirm Received
              </button>
            )}

            {/* Cancel option for proposed/accepted */}
            {(trade.status === "proposed" || trade.status === "accepted") && (
              <button
                onClick={() => handleStatusChange("cancelled", "Changed mind")}
                disabled={isUpdating}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 font-bold border-2 border-pop-black disabled:opacity-50"
              >
                Cancel Trade
              </button>
            )}

            {/* Completed status */}
            {trade.status === "completed" && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-pop-green font-bold">
                  <Check className="w-5 h-5" />
                  Trade Completed!
                </div>
                {eligibility?.canLeaveFeedback && trade.otherUser?.id && (
                  <LeaveFeedbackButton
                    transactionType="trade"
                    transactionId={trade.id}
                    revieweeId={trade.otherUser.id}
                    revieweeName={trade.otherUser.displayName || trade.otherUser.username || "User"}
                    onFeedbackSubmitted={onStatusChange}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
