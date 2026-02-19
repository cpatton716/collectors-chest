"use client";

import { useState } from "react";

import { AlertCircle, CreditCard, Loader2 } from "lucide-react";

import { formatPrice } from "@/types/auction";
import { isAgeVerificationError } from "@/lib/ageVerification";

import AgeVerificationModal from "@/components/AgeVerificationModal";

interface PaymentButtonProps {
  auctionId: string;
  amount: number;
  shippingCost: number;
  disabled?: boolean;
}

export function PaymentButton({
  auctionId,
  amount,
  shippingCost,
  disabled = false,
}: PaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAgeGate, setShowAgeGate] = useState(false);

  const total = amount + shippingCost;

  const handlePayment = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionId }),
      });

      const data = await response.json();

      if (response.ok && data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        if (isAgeVerificationError(data)) {
          setShowAgeGate(true);
          return;
        }
        setError(data.error || "Failed to start checkout");
      }
    } catch (err) {
      setError("Failed to connect to payment system");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Price Breakdown */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Winning Bid</span>
          <span className="font-medium text-gray-900">{formatPrice(amount)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Shipping</span>
          <span className="font-medium text-gray-900">
            {shippingCost > 0 ? formatPrice(shippingCost) : "Free"}
          </span>
        </div>
        <div className="border-t pt-2 flex justify-between">
          <span className="font-semibold text-gray-900">Total</span>
          <span className="font-bold text-lg">{formatPrice(total)}</span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Pay Button */}
      <button
        onClick={handlePayment}
        disabled={disabled || isLoading}
        className="w-full py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="w-5 h-5" />
            Pay {formatPrice(total)}
          </>
        )}
      </button>

      {/* Security Note */}
      <p className="text-xs text-center text-gray-500">Secure payment powered by Stripe</p>

      {showAgeGate && (
        <AgeVerificationModal
          action="make a purchase"
          onVerified={() => {
            setShowAgeGate(false);
            handlePayment();
          }}
          onDismiss={() => setShowAgeGate(false)}
        />
      )}
    </div>
  );
}
