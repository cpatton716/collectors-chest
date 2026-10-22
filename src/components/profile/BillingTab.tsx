"use client";

import Link from "next/link";

import {
  AlertCircle,
  Calendar,
  Check,
  Crown,
  ExternalLink,
  Store,
  X,
  Zap,
} from "lucide-react";

import { MARKETPLACE_ENABLED } from "@/lib/features";

import { ConnectStatus, formatBillingDate } from "./profileTabHelpers";

interface BillingTabProps {
  // Banners
  connectBanner: "success" | "incomplete" | "error" | null;
  setConnectBanner: (value: "success" | "incomplete" | "error" | null) => void;
  billingBanner: "success" | "cancelled" | null;
  setBillingBanner: (value: "success" | "cancelled" | null) => void;

  // Subscription
  tier: string;
  isTrialing: boolean;
  trialDaysRemaining: number;
  trialEndsAt: Date | null;
  scansUsed: number;
  purchasedScans: number;
  monthResetDate: Date | null;
  trialAvailable: boolean;
  isSubscriptionLoading: boolean;
  openBillingPortal: () => void;
  handleUpgrade: () => void;
  handleStartTrial: () => void;

  // Connect
  connectStatus: ConnectStatus | null;
  connectSetupLoading: boolean;
  handleSetupConnect: () => void;
  handleOpenDashboard: () => void;
}

export function BillingTab({
  connectBanner,
  setConnectBanner,
  billingBanner,
  setBillingBanner,
  tier,
  isTrialing,
  trialDaysRemaining,
  trialEndsAt,
  scansUsed,
  purchasedScans,
  monthResetDate,
  trialAvailable,
  isSubscriptionLoading,
  openBillingPortal,
  handleUpgrade,
  handleStartTrial,
  connectStatus,
  connectSetupLoading,
  handleSetupConnect,
  handleOpenDashboard,
}: BillingTabProps) {
  return (
    <div className="space-y-6">
      {/* Connect Onboarding Banner */}
      {MARKETPLACE_ENABLED && connectBanner === "success" && (
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3 flex items-center gap-2">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="font-body text-sm text-green-800">
            Seller payments set up successfully! You&apos;re ready to sell.
          </p>
          <button onClick={() => setConnectBanner(null)} className="ml-auto text-green-600 hover:text-green-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {MARKETPLACE_ENABLED && connectBanner === "incomplete" && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="font-body text-sm text-amber-800">
            Seller setup is not yet complete. Please finish the remaining steps.
          </p>
          <button onClick={() => setConnectBanner(null)} className="ml-auto text-amber-600 hover:text-amber-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {MARKETPLACE_ENABLED && connectBanner === "error" && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="font-body text-sm text-red-800">
            Something went wrong during seller setup. Please try again.
          </p>
          <button onClick={() => setConnectBanner(null)} className="ml-auto text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Billing Checkout Banner */}
      {billingBanner === "success" && (
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3 flex items-center gap-2">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="font-body text-sm text-green-800">
            Purchase successful! Your account has been updated.
          </p>
          <button onClick={() => setBillingBanner(null)} className="ml-auto text-green-600 hover:text-green-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {billingBanner === "cancelled" && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="font-body text-sm text-amber-800">
            Checkout was cancelled. No charges were made.
          </p>
          <button onClick={() => setBillingBanner(null)} className="ml-auto text-amber-600 hover:text-amber-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Current Plan */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {tier === "premium" || isTrialing ? (
              <Crown className="w-5 h-5 text-amber-500" />
            ) : (
              <Zap className="w-5 h-5 text-gray-400" />
            )}
            <span className="text-lg font-semibold text-gray-900">
              {isTrialing ? "Premium (Trial)" : tier === "premium" ? "Premium" : "Free"}
            </span>
            {isTrialing && (
              <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
                {trialDaysRemaining} days left
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">
            {tier === "premium"
              ? "Unlimited scans, all features included"
              : isTrialing
                ? `Trial ends ${formatBillingDate(trialEndsAt)}`
                : "10 scans per month, basic features"}
          </p>
        </div>

        {tier === "premium" && !isTrialing ? (
          <button
            onClick={openBillingPortal}
            disabled={isSubscriptionLoading}
            className="flex items-center gap-2 px-4 py-2 font-comic text-pop-black bg-pop-yellow border-2 border-pop-black shadow-comic-sm hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50"
          >
            Manage Plan
            <ExternalLink className="w-4 h-4" />
          </button>
        ) : isTrialing ? (
          <button
            onClick={handleUpgrade}
            disabled={isSubscriptionLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-comic text-pop-black bg-pop-green border-2 border-pop-black shadow-comic-sm hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50"
          >
            <Crown className="w-4 h-4" />
            Subscribe Now
          </button>
        ) : trialAvailable ? (
          <button
            onClick={handleStartTrial}
            disabled={isSubscriptionLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-comic text-pop-black bg-pop-green border-2 border-pop-black shadow-comic-sm hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            Start Free Trial
          </button>
        ) : (
          <Link
            href="/pricing"
            className="flex items-center gap-2 px-4 py-2 text-sm font-comic text-white bg-pop-blue border-2 border-pop-black shadow-comic-sm hover:translate-y-0.5 hover:shadow-none transition-all"
          >
            <Crown className="w-4 h-4" />
            Upgrade
          </Link>
        )}
      </div>

      {/* Usage Stats (for free tier) */}
      {tier === "free" && !isTrialing && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Monthly Usage</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              {(() => {
                const totalAvailable = 10 + (purchasedScans || 0);
                const progressPercent = Math.min(100, (scansUsed / totalAvailable) * 100);
                return (
                  <>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Scans used</span>
                      <span className="font-medium text-gray-900">{scansUsed} / {totalAvailable}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          scansUsed >= totalAvailable
                            ? "bg-red-500"
                            : scansUsed >= totalAvailable * 0.7
                              ? "bg-amber-500"
                              : "bg-green-500"
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    {purchasedScans > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Includes {purchasedScans} bonus scans from scan pack
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
          {monthResetDate && (
            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Resets {formatBillingDate(monthResetDate)}
            </p>
          )}
        </div>
      )}

      {/* Feature Comparison */}
      <div className="border-t border-gray-100 pt-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          {tier === "premium" || isTrialing
            ? "Your Premium Features"
            : "Upgrade to Premium"}
        </h3>
        <ul className="space-y-2">
          {[
            { feature: "Unlimited scans", included: tier === "premium" || isTrialing },
            {
              feature: "Key Hunt (offline lookups)",
              included: tier === "premium" || isTrialing,
            },
            { feature: "CSV export", included: tier === "premium" || isTrialing },
            { feature: "Advanced statistics", included: tier === "premium" || isTrialing },
            {
              feature: "Unlimited listings",
              included: tier === "premium" || isTrialing,
              marketplaceOnly: true,
            },
            {
              feature: "5% seller fee (vs 8%)",
              included: tier === "premium" || isTrialing,
              marketplaceOnly: true,
            },
          ]
            .filter((item) => MARKETPLACE_ENABLED || !item.marketplaceOnly)
            .map((item) => (
            <li key={item.feature} className="flex items-center gap-2 text-sm">
              <Check
                className={`w-4 h-4 ${item.included ? "text-green-500" : "text-gray-300"}`}
              />
              <span className={item.included ? "text-gray-900" : "text-gray-500"}>
                {item.feature}
              </span>
            </li>
          ))}
        </ul>

        {tier === "free" && !isTrialing && (
          <Link
            href="/pricing"
            className="inline-block mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            View all pricing details →
          </Link>
        )}
      </div>

      {/* Seller Payments */}
      {MARKETPLACE_ENABLED && (
        <div id="seller-payments" className="bg-pop-white border-3 border-pop-black shadow-[4px_4px_0px_#000] rounded-lg p-4">
          <h3 className="font-comic text-lg mb-3 flex items-center gap-2">
            <Store className="w-5 h-5" />
            SELLER PAYMENTS
          </h3>
          {connectStatus === null ? (
            <p className="font-body text-sm text-pop-black/60">Loading...</p>
          ) : connectStatus.onboardingComplete ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-pop-green rounded-full" />
                <span className="font-body text-sm">Payment setup complete</span>
              </div>
              <p className="font-body text-sm text-pop-black/60">
                {connectStatus.completedSales} sale{connectStatus.completedSales !== 1 ? "s" : ""} completed
              </p>
              <button
                onClick={handleOpenDashboard}
                className="btn-pop btn-pop-blue py-2 px-4 text-sm font-comic"
              >
                VIEW PAYOUT DASHBOARD
              </button>
            </div>
          ) : connectStatus.connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-pop-yellow rounded-full" />
                <span className="font-body text-sm">Setup incomplete</span>
              </div>
              <button
                onClick={handleSetupConnect}
                className="btn-pop btn-pop-green py-2 px-4 text-sm font-comic"
              >
                COMPLETE SETUP
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="font-body text-sm text-pop-black/60">
                Set up payments to start selling comics on the marketplace.
              </p>
              <button
                onClick={handleSetupConnect}
                disabled={connectSetupLoading}
                className="btn-pop btn-pop-green py-2 px-4 text-sm font-comic disabled:opacity-50"
              >
                {connectSetupLoading ? "CONNECTING..." : "SET UP SELLER PAYMENTS"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
