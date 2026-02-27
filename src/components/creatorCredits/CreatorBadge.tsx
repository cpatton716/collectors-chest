"use client";

import { Award, BadgeCheck, Crown, Shield, Skull, Star, User } from "lucide-react";
import type { CreatorBadgeInfo, TransactionTrust } from "@/types/creatorCredits";

// ============================================================================
// TRUST BADGE - Full display with percentage and count
// ============================================================================

interface TrustBadgeProps {
  trust: TransactionTrust;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  onClick?: () => void;
}

export function TrustBadge({
  trust,
  size = "md",
  showCount = true,
  onClick,
}: TrustBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5 gap-1",
    md: "text-sm px-2 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2",
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  const baseClasses = `inline-flex items-center rounded-full font-medium ${sizeClasses[size]}`;

  // New seller display
  if (trust.display.type === "new_seller") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={`${baseClasses} bg-gray-100 text-gray-600 ${
          onClick ? "cursor-pointer hover:bg-gray-200" : "cursor-default"
        }`}
      >
        <User size={iconSizes[size]} />
        <span>New Seller</span>
      </button>
    );
  }

  // Percentage-based display
  const { percentage, count, color } = trust.display;

  const colorClasses = {
    green: "bg-green-100 text-green-700 hover:bg-green-200",
    yellow: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200",
    red: "bg-red-100 text-red-700 hover:bg-red-200",
  };

  const IconComponent = {
    green: Shield,
    yellow: Star,
    red: Skull,
  }[color];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`${baseClasses} ${colorClasses[color]} ${
        onClick ? "cursor-pointer" : "cursor-default"
      }`}
    >
      <IconComponent size={iconSizes[size]} />
      <span>{percentage}%</span>
      {showCount && (
        <span className="opacity-75">({count})</span>
      )}
    </button>
  );
}

/** @deprecated Use TrustBadge instead */
export const ReputationBadge = TrustBadge;

// ============================================================================
// TRUST BADGE COMPACT - Card version for list items
// ============================================================================

interface TrustBadgeCompactProps {
  trust: TransactionTrust;
  onClick?: () => void;
}

export function TrustBadgeCompact({ trust, onClick }: TrustBadgeCompactProps) {
  const baseClasses = "inline-flex items-center gap-1 text-xs font-medium";

  // New seller display
  if (trust.display.type === "new_seller") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={`${baseClasses} text-gray-500 ${
          onClick ? "cursor-pointer hover:text-gray-700" : "cursor-default"
        }`}
      >
        <User size={12} />
        <span>New</span>
      </button>
    );
  }

  // Percentage-based display
  const { percentage, color } = trust.display;

  const colorClasses = {
    green: "text-green-600 hover:text-green-700",
    yellow: "text-yellow-600 hover:text-yellow-700",
    red: "text-red-600 hover:text-red-700",
  };

  const IconComponent = {
    green: Shield,
    yellow: Star,
    red: Skull,
  }[color];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`${baseClasses} ${colorClasses[color]} ${
        onClick ? "cursor-pointer" : "cursor-default"
      }`}
    >
      <IconComponent size={12} />
      <span>{percentage}%</span>
    </button>
  );
}

/** @deprecated Use TrustBadgeCompact instead */
export const ReputationBadgeCompact = TrustBadgeCompact;

// ============================================================================
// CREATOR BADGE - Tier-based badge display for Creator Credits
// ============================================================================

interface CreatorBadgeProps {
  badge: CreatorBadgeInfo;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function CreatorBadge({
  badge,
  size = "md",
  showLabel = true,
}: CreatorBadgeProps) {
  if (badge.tier === "none") {
    return null;
  }

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5 gap-1",
    md: "text-sm px-2 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2",
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  const tierConfig = {
    contributor: {
      classes: "bg-blue-100 text-blue-700",
      Icon: Award,
    },
    verified: {
      classes: "bg-purple-100 text-purple-700",
      Icon: BadgeCheck,
    },
    top: {
      classes: "bg-amber-100 text-amber-700",
      Icon: Crown,
    },
  };

  const config = tierConfig[badge.tier];
  const { Icon, classes } = config;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]} ${classes}`}
    >
      <Icon size={iconSizes[size]} />
      {showLabel && badge.label && <span>{badge.label}</span>}
    </span>
  );
}

/** @deprecated Use CreatorBadge instead */
export const ContributorBadge = CreatorBadge;

// ============================================================================
// CREATOR ICON - Icon-only version for inline display
// ============================================================================

interface CreatorIconProps {
  badge: CreatorBadgeInfo;
  size?: "sm" | "md";
}

export function CreatorIcon({ badge, size = "sm" }: CreatorIconProps) {
  if (badge.tier === "none") {
    return null;
  }

  const iconSizes = {
    sm: 14,
    md: 16,
  };

  const tierConfig = {
    contributor: {
      className: "text-blue-600",
      Icon: Award,
    },
    verified: {
      className: "text-purple-600",
      Icon: BadgeCheck,
    },
    top: {
      className: "text-amber-600",
      Icon: Crown,
    },
  };

  const config = tierConfig[badge.tier];
  const { Icon, className } = config;

  return <Icon size={iconSizes[size]} className={className} />;
}

/** @deprecated Use CreatorIcon instead */
export const ContributorIcon = CreatorIcon;
