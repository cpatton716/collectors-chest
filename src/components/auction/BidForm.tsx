"use client";

import { useState } from "react";

import { AlertCircle, CheckCircle, DollarSign, Gavel } from "lucide-react";

import { calculateMinimumBid, formatPrice, getBidIncrement } from "@/types/auction";
import { isAgeVerificationError } from "@/lib/ageVerification";

import AgeVerificationModal from "@/components/AgeVerificationModal";

interface BidFormProps {
  auctionId: string;
  currentBid: number | null;
  startingPrice: number;
  buyItNowPrice: number | null;
  userMaxBid?: number | null;
  isHighBidder?: boolean;
  onBidPlaced?: (result: BidResult) => void;
  onBuyItNow?: () => void;
  disabled?: boolean;
}

interface BidResult {
  success: boolean;
  message: string;
  currentBid?: number;
  isHighBidder?: boolean;
}

export function BidForm({
  auctionId,
  currentBid,
  startingPrice,
  buyItNowPrice,
  userMaxBid,
  isHighBidder,
  onBidPlaced,
  onBuyItNow,
  disabled = false,
}: BidFormProps) {
  const minimumBid = calculateMinimumBid(currentBid, startingPrice);
  const increment = getBidIncrement(currentBid || startingPrice);

  const [bidAmount, setBidAmount] = useState<string>(minimumBid.toString());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [pendingAction, setPendingAction] = useState<"bid" | "buyNow" | null>(null);

  const handleBidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    setBidAmount(value);
    setError(null);
    setSuccess(null);
  };

  const validateBid = (): boolean => {
    const amount = parseInt(bidAmount, 10);

    if (isNaN(amount)) {
      setError("Please enter a valid bid amount");
      return false;
    }

    if (amount < minimumBid) {
      setError(`Minimum bid is ${formatPrice(minimumBid)}`);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateBid()) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/auctions/${auctionId}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxBid: parseInt(bidAmount, 10) }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(data.message);
        onBidPlaced?.(data);
        // Update minimum bid for next bid
        if (data.currentBid) {
          setBidAmount(calculateMinimumBid(data.currentBid, startingPrice).toString());
        }
      } else {
        if (isAgeVerificationError(data)) {
          setPendingAction("bid");
          setShowAgeGate(true);
          return;
        }
        setError(data.error || data.message || "Failed to place bid");
      }
    } catch (err) {
      setError("Failed to place bid. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuyItNow = async () => {
    if (!buyItNowPrice) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/auctions/${auctionId}/buy-now`, {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess("Purchase complete! Check your notifications.");
        onBuyItNow?.();
      } else {
        if (isAgeVerificationError(data)) {
          setPendingAction("buyNow");
          setShowAgeGate(true);
          return;
        }
        setError(data.error || "Failed to complete purchase");
      }
    } catch (err) {
      setError("Failed to complete purchase. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const submitBid = async () => {
    if (!validateBid()) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/auctions/${auctionId}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxBid: parseInt(bidAmount, 10) }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(data.message);
        onBidPlaced?.(data);
        if (data.currentBid) {
          setBidAmount(calculateMinimumBid(data.currentBid, startingPrice).toString());
        }
      } else {
        if (isAgeVerificationError(data)) {
          setPendingAction("bid");
          setShowAgeGate(true);
          return;
        }
        setError(data.error || data.message || "Failed to place bid");
      }
    } catch (err) {
      setError("Failed to place bid. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current Bid Display */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">Current bid:</span>
        <span className="font-bold text-lg text-gray-900">
          {currentBid ? formatPrice(currentBid) : formatPrice(startingPrice)}
        </span>
      </div>

      {/* User's Max Bid Status */}
      {userMaxBid && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            isHighBidder ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"
          }`}
        >
          {isHighBidder ? (
            <>
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">
                You&apos;re winning! Max bid: {formatPrice(userMaxBid)}
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">
                You&apos;ve been outbid. Your max: {formatPrice(userMaxBid)}
              </span>
            </>
          )}
        </div>
      )}

      {/* Bid Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Your max bid</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={bidAmount}
              onChange={handleBidChange}
              disabled={disabled || isLoading}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-lg text-gray-900 bg-white"
              placeholder={minimumBid.toString()}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Minimum: {formatPrice(minimumBid)} • Increment: ${increment}
          </p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle className="w-4 h-4" />
            {success}
          </div>
        )}

        {/* Place Bid Button */}
        <button
          type="submit"
          disabled={disabled || isLoading}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Gavel className="w-5 h-5" />
          {isLoading ? "Placing bid..." : "Place Bid"}
        </button>
      </form>

      {/* Buy It Now Option */}
      {buyItNowPrice && !isHighBidder && (
        <div className="pt-3 border-t">
          <button
            onClick={handleBuyItNow}
            disabled={disabled || isLoading}
            className="w-full py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Buy It Now - {formatPrice(buyItNowPrice)}
          </button>
        </div>
      )}

      {showAgeGate && (
        <AgeVerificationModal
          action="place a bid"
          onVerified={() => {
            setShowAgeGate(false);
            if (pendingAction === "buyNow") {
              handleBuyItNow();
            } else {
              submitBid();
            }
            setPendingAction(null);
          }}
          onDismiss={() => {
            setShowAgeGate(false);
            setPendingAction(null);
          }}
        />
      )}
    </div>
  );
}
