"use client";

import Link from "next/link";

import { Shield, Skull, User } from "lucide-react";

import { FollowButton } from "@/components/follows";
import { ContributorIcon } from "@/components/reputation";
import { SellerProfile } from "@/types/auction";
import { calculateContributorBadge } from "@/types/reputation";

import { MessageButton } from "../messaging/MessageButton";

interface SellerBadgeProps {
  seller: SellerProfile & { communityContributionCount?: number };
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  onClick?: () => void;
  showMessageButton?: boolean;
  listingId?: string;
  isSeller?: boolean;
  currentUserId?: string | null;
}

/**
 * Get display name based on user's preference
 */
function getSellerDisplayName(seller: SellerProfile): string {
  const { username, displayName, publicDisplayName, displayPreference } = seller;
  const preference = displayPreference || "username_only";

  // If user has a username, use it based on preference
  if (username) {
    switch (preference) {
      case "username_only":
        return `@${username}`;
      case "display_name_only":
        return publicDisplayName || displayName || `@${username}`;
      case "both":
        const name = publicDisplayName || displayName;
        return name ? `${name} (@${username})` : `@${username}`;
      default:
        return `@${username}`;
    }
  }

  // Fallback to display name or generic
  return publicDisplayName || displayName || "Seller";
}

export function SellerBadge({
  seller,
  size = "md",
  showCount = true,
  onClick,
  showMessageButton = false,
  listingId,
  isSeller = false,
  currentUserId,
}: SellerBadgeProps) {
  const { reputation, positivePercentage, totalRatings } = seller;
  const name = getSellerDisplayName(seller);

  const sizeClasses = {
    sm: "text-xs gap-1",
    md: "text-sm gap-1.5",
    lg: "text-base gap-2",
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  const getReputationStyles = () => {
    switch (reputation) {
      case "hero":
        return {
          icon: Shield,
          bgColor: "bg-blue-100",
          textColor: "text-blue-700",
          iconColor: "text-blue-600",
          label: "Hero",
        };
      case "villain":
        return {
          icon: Skull,
          bgColor: "bg-purple-100",
          textColor: "text-purple-700",
          iconColor: "text-purple-600",
          label: "Villain",
        };
      default:
        return {
          icon: User,
          bgColor: "bg-gray-100",
          textColor: "text-gray-700",
          iconColor: "text-gray-600",
          label: "Neutral",
        };
    }
  };

  const styles = getReputationStyles();
  const Icon = styles.icon;

  return (
    <div
      className={`inline-flex items-center ${sizeClasses[size]} ${
        onClick ? "cursor-pointer hover:opacity-80" : ""
      }`}
    >
      {seller.username ? (
        <Link
          href={`/u/${seller.username}`}
          onClick={onClick}
          className={`flex items-center gap-1 px-2 py-1 rounded-full ${styles.bgColor} hover:opacity-80 transition-opacity`}
        >
          <Icon className={`${iconSizes[size]} ${styles.iconColor}`} />
          <span className={`font-medium ${styles.textColor}`}>{name}</span>
          {seller.communityContributionCount !== undefined &&
            seller.communityContributionCount > 0 && (
              <ContributorIcon
                badge={calculateContributorBadge(seller.communityContributionCount)}
              />
            )}
          {showCount && totalRatings > 0 && (
            <span className={`${styles.textColor} opacity-75`}>({positivePercentage}%)</span>
          )}
        </Link>
      ) : (
        <div
          onClick={onClick}
          className={`flex items-center gap-1 px-2 py-1 rounded-full ${styles.bgColor} cursor-default`}
          title="This user hasn't set up a public collection"
        >
          <Icon className={`${iconSizes[size]} ${styles.iconColor}`} />
          <span className={`font-medium ${styles.textColor}`}>{name}</span>
          {seller.communityContributionCount !== undefined &&
            seller.communityContributionCount > 0 && (
              <ContributorIcon
                badge={calculateContributorBadge(seller.communityContributionCount)}
              />
            )}
          {showCount && totalRatings > 0 && (
            <span className={`${styles.textColor} opacity-75`}>({positivePercentage}%)</span>
          )}
        </div>
      )}
      {/* Follow button - only show when viewing another user's badge */}
      {currentUserId && seller.id && seller.id !== currentUserId && (
        <FollowButton userId={seller.id} size="sm" />
      )}
      {showMessageButton && !isSeller && seller.id && (
        <MessageButton
          sellerId={seller.id}
          sellerName={seller.username ? `@${seller.username}` : undefined}
          listingId={listingId}
          size={size}
          variant="icon"
          className="ml-2"
        />
      )}
    </div>
  );
}

// Compact version for cards
export function SellerBadgeCompact({
  seller,
  onClick,
}: {
  seller: SellerProfile;
  onClick?: () => void;
}) {
  const { reputation, positivePercentage, totalRatings } = seller;

  const getStyles = () => {
    switch (reputation) {
      case "hero":
        return { icon: Shield, color: "text-blue-600", bg: "bg-blue-50" };
      case "villain":
        return { icon: Skull, color: "text-purple-600", bg: "bg-purple-50" };
      default:
        return { icon: User, color: "text-gray-500", bg: "bg-gray-50" };
    }
  };

  const styles = getStyles();
  const Icon = styles.icon;

  if (totalRatings === 0) {
    return <span className="text-xs text-gray-500">New Seller</span>;
  }

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${styles.bg} ${
        onClick ? "hover:opacity-80" : ""
      }`}
    >
      <Icon className={`w-3 h-3 ${styles.color}`} />
      <span className={`text-xs font-medium ${styles.color}`}>{positivePercentage}%</span>
    </button>
  );
}
