"use client";

import { X, TrendingUp, Zap, Star } from "lucide-react";
import Link from "next/link";

interface PremiumSellerUpsellProps {
  totalFeesPaid: number;
  totalSales: number;
  currentFeePercent: number;
  premiumFeePercent: number;
  onDismiss: () => void;
}

export default function PremiumSellerUpsell({
  totalFeesPaid,
  totalSales,
  currentFeePercent,
  premiumFeePercent,
  onDismiss,
}: PremiumSellerUpsellProps) {
  const savings = totalFeesPaid * ((currentFeePercent - premiumFeePercent) / currentFeePercent);
  const savingsFormatted = savings.toFixed(2);
  const feesPaidFormatted = totalFeesPaid.toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-pop-white border-3 border-pop-black shadow-[6px_6px_0px_#000] rounded-lg max-w-md w-full relative">
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-pop-black/60 hover:text-pop-black z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-pop-blue to-purple-600 border-b-3 border-pop-black p-5 rounded-t-lg text-center">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <h2 className="font-comic text-2xl text-white">YOU&apos;RE ON A ROLL!</h2>
          <p className="text-white/80 text-sm font-body mt-1">
            {totalSales} sales completed
          </p>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Fee comparison */}
          <div className="bg-pop-yellow/20 border-2 border-pop-black rounded-lg p-4 text-center">
            <p className="font-body text-sm text-pop-black/70 mb-1">
              You&apos;ve paid in seller fees
            </p>
            <p className="font-comic text-3xl text-pop-red">${feesPaidFormatted}</p>
            <p className="font-body text-sm text-pop-black/70 mt-2">
              With Premium, you would have saved
            </p>
            <p className="font-comic text-2xl text-pop-green">${savingsFormatted}</p>
          </div>

          {/* Benefits */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-pop-green rounded-full flex items-center justify-center flex-shrink-0">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-body text-sm">
                <strong>{premiumFeePercent}% seller fees</strong> instead of {currentFeePercent}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-pop-green rounded-full flex items-center justify-center flex-shrink-0">
                <Star className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-body text-sm">
                Unlimited scans, Key Hunt, CSV export & more
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t-3 border-pop-black flex gap-3">
          <button
            onClick={onDismiss}
            className="btn-pop btn-pop-white flex-1 py-2 text-sm font-comic"
          >
            MAYBE LATER
          </button>
          <Link
            href="/pricing"
            className="btn-pop btn-pop-blue flex-1 py-2 text-sm font-comic text-center"
            onClick={onDismiss}
          >
            VIEW PLANS
          </Link>
        </div>
      </div>
    </div>
  );
}
