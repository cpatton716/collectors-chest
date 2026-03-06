"use client";

import { ReactNode, useState } from "react";

import { BarChart3, Download, Lock, Target, TrendingUp, Zap } from "lucide-react";

import { SubscriptionTier, useSubscription } from "@/hooks/useSubscription";

type FeatureKey =
  | "keyHunt"
  | "csvExport"
  | "fullStats"
  | "unlimitedListings"
  | "unlimitedScans"
  | "shopBuying"
  | "cloudSync";

interface FeatureGateProps {
  feature: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
}

// Feature metadata for upgrade prompts
const featureInfo: Record<FeatureKey, { name: string; description: string; icon: ReactNode }> = {
  keyHunt: {
    name: "Key Hunt",
    description: "Quick price lookups at conventions with offline barcode caching",
    icon: <Target className="w-5 h-5" />,
  },
  csvExport: {
    name: "CSV Export",
    description: "Export your collection to CSV for backup or analysis",
    icon: <Download className="w-5 h-5" />,
  },
  fullStats: {
    name: "Full Statistics",
    description: "Detailed insights, trends, and value analysis for your collection",
    icon: <BarChart3 className="w-5 h-5" />,
  },
  unlimitedListings: {
    name: "Unlimited Listings",
    description: "List as many comics as you want in the Shop",
    icon: <TrendingUp className="w-5 h-5" />,
  },
  unlimitedScans: {
    name: "Unlimited Scans",
    description: "Scan as many comics as you want each month",
    icon: <Zap className="w-5 h-5" />,
  },
  shopBuying: {
    name: "Shop Access",
    description: "Buy and bid on comics in the marketplace",
    icon: <TrendingUp className="w-5 h-5" />,
  },
  cloudSync: {
    name: "Cloud Sync",
    description: "Sync your collection across all your devices",
    icon: <Zap className="w-5 h-5" />,
  },
};

/**
 * FeatureGate component - wraps content that requires a specific subscription tier
 *
 * Usage:
 * <FeatureGate feature="keyHunt">
 *   <KeyHuntContent />
 * </FeatureGate>
 *
 * Or with custom fallback:
 * <FeatureGate feature="csvExport" fallback={<ExportDisabled />}>
 *   <ExportButton />
 * </FeatureGate>
 */
export function FeatureGate({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
}: FeatureGateProps) {
  const { features, isLoading, tier, isTrialing, startFreeTrial, startCheckout } =
    useSubscription();

  // Show loading state
  if (isLoading) {
    return <div className="animate-pulse bg-gray-100 rounded-lg h-20" />;
  }

  // Check access
  const hasAccess = features[feature];

  if (hasAccess) {
    return <>{children}</>;
  }

  // Use custom fallback if provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default upgrade prompt
  if (!showUpgradePrompt) {
    return null;
  }

  const info = featureInfo[feature];

  return (
    <UpgradePrompt
      info={info}
      tier={tier}
      isTrialing={isTrialing}
      startFreeTrial={startFreeTrial}
      startCheckout={startCheckout}
    />
  );
}

function UpgradePrompt({
  info,
  tier,
  isTrialing,
  startFreeTrial,
  startCheckout,
}: {
  info: { name: string; description: string; icon: ReactNode };
  tier: SubscriptionTier;
  isTrialing: boolean;
  startFreeTrial: () => Promise<{ success: boolean; error?: string }>;
  startCheckout: (
    priceType: "monthly" | "annual" | "scan_pack",
    withTrial?: boolean
  ) => Promise<string | null>;
}) {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgradeClick = async () => {
    setIsStarting(true);
    setError(null);

    // If free tier, try direct trial first
    if (tier === "free" && !isTrialing) {
      const result = await startFreeTrial();
      if (result.success) {
        window.location.reload();
        return;
      }
    }
    // Fall back to Stripe checkout
    const url = await startCheckout("monthly", tier === "free" && !isTrialing);
    if (url) {
      window.location.href = url;
      return;
    }

    setIsStarting(false);
    setError("Something went wrong. Please try again or contact support.");
  };

  return (
    <div
      className="bg-pop-white border-3 border-pop-black p-8 text-center"
      style={{ boxShadow: "4px 4px 0px #000" }}
    >
      <div className="w-16 h-16 bg-pop-yellow border-3 border-pop-black flex items-center justify-center mx-auto mb-4">
        <Lock className="w-8 h-8 text-pop-black" />
      </div>

      <h3 className="text-xl font-black text-pop-black font-comic uppercase mb-2">
        {info.name} is a Premium Feature
      </h3>

      <p className="text-gray-600 mb-6 max-w-sm mx-auto">{info.description}</p>

      {error && (
        <p className="text-red-600 text-sm mb-4 font-bold">{error}</p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {tier === "free" && !isTrialing && (
          <button
            onClick={handleUpgradeClick}
            disabled={isStarting}
            className="px-5 py-3 bg-pop-blue border-2 border-pop-black text-white font-bold transition-all hover:shadow-[3px_3px_0px_#000] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: "2px 2px 0px #000" }}
          >
            {isStarting ? "Starting..." : "Start 7-Day Free Trial"}
          </button>
        )}
        <a
          href="/pricing"
          className="px-5 py-3 bg-pop-white border-2 border-pop-black text-pop-black font-bold transition-all hover:shadow-[3px_3px_0px_#000]"
          style={{ boxShadow: "2px 2px 0px #000" }}
        >
          View Pricing
        </a>
      </div>
    </div>
  );
}

/**
 * Inline feature badge for buttons/links that are gated
 * Shows a lock icon and "Premium" badge
 */
export function PremiumBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full ${className}`}
    >
      <Lock className="w-3 h-3" />
      Premium
    </span>
  );
}

/**
 * Hook to check if user can access a feature
 */
export function useCanAccessFeature(feature: FeatureKey): boolean {
  const { features, isLoading } = useSubscription();
  if (isLoading) return false;
  return features[feature];
}

/**
 * FeatureButton - A button that's disabled for non-premium users
 */
interface FeatureButtonProps {
  feature: FeatureKey;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function FeatureButton({
  feature,
  onClick,
  children,
  className = "",
  disabled = false,
}: FeatureButtonProps) {
  const { features, isLoading, tier, isTrialing, startFreeTrial, startCheckout } =
    useSubscription();
  const [isStarting, setIsStarting] = useState(false);
  const hasAccess = features[feature];

  const handleClick = async () => {
    if (hasAccess) {
      onClick();
    } else {
      setIsStarting(true);
      // If free tier, try direct trial first
      if (tier === "free" && !isTrialing) {
        const result = await startFreeTrial();
        if (result.success) {
          window.location.reload();
          return;
        }
      }
      // Fall back to Stripe checkout
      const url = await startCheckout("monthly", tier === "free" && !isTrialing);
      if (url) {
        window.location.href = url;
        return;
      }
      setIsStarting(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading || isStarting}
      className={`relative ${className} ${!hasAccess ? "opacity-75" : ""}`}
    >
      {children}
      {!hasAccess && (
        <span className="absolute -top-1 -right-1">
          <PremiumBadge />
        </span>
      )}
    </button>
  );
}

/**
 * RequiresTier - Shows content only if user has at least the specified tier
 */
interface RequiresTierProps {
  tier: SubscriptionTier;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequiresTier({ tier: requiredTier, children, fallback }: RequiresTierProps) {
  const { tier, isGuest, isLoading } = useSubscription();

  if (isLoading) {
    return <div className="animate-pulse bg-gray-100 rounded h-8" />;
  }

  // Tier hierarchy: guest < free < premium
  const tierLevel = { guest: 0, free: 1, premium: 2 };
  const userLevel = isGuest ? 0 : tierLevel[tier] || 0;
  const requiredLevel = tierLevel[requiredTier] || 0;

  if (userLevel >= requiredLevel) {
    return <>{children}</>;
  }

  return fallback ? <>{fallback}</> : null;
}
