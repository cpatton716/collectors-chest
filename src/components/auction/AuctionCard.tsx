"use client";

import { Clock, Gavel, Package, ShoppingCart } from "lucide-react";

import { Auction, formatPrice } from "@/types/auction";

import { ComicImage } from "../ComicImage";
import { LocationBadge } from "../LocationBadge";
import { MessageButton } from "../messaging/MessageButton";
import { AuctionCountdown } from "./AuctionCountdown";
import { SellerBadgeCompact } from "./SellerBadge";
import { WatchlistButton } from "./WatchlistButton";

interface AuctionCardProps {
  auction: Auction;
  onClick?: () => void;
  onWatchlistChange?: (auctionId: string, isWatching: boolean) => void;
  showSeller?: boolean;
}

// Helper to format upcoming start time
function formatStartTime(startTime: string): string {
  const start = new Date(startTime);
  const now = new Date();
  const diffMs = start.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (diffDays > 1) {
    return `Starts in ${diffDays} days`;
  } else if (diffDays === 1) {
    return `Starts tomorrow`;
  } else if (diffHours > 0) {
    return `Starts in ${diffHours}h`;
  } else {
    return `Starting soon`;
  }
}

export function AuctionCard({
  auction,
  onClick,
  onWatchlistChange,
  showSeller = true,
}: AuctionCardProps) {
  const {
    id,
    currentBid,
    startingPrice,
    buyItNowPrice,
    startTime,
    endTime,
    bidCount,
    shippingCost,
    comic,
    seller,
    isWatching,
  } = auction;

  // Check if auction is scheduled for the future (Coming Soon)
  const isComingSoon = new Date(startTime) > new Date();

  const coverImageUrl = comic?.coverImageUrl;
  const title = comic?.comic?.title || "Unknown Title";
  const issueNumber = comic?.comic?.issueNumber || "?";
  const displayPrice = currentBid || startingPrice;

  return (
    <div
      onClick={onClick}
      className="bg-pop-white border-3 border-pop-black overflow-hidden cursor-pointer group hover:shadow-[4px_4px_0px_#000] transition-all"
    >
      {/* Cover Image */}
      <div className="relative aspect-[2/3]">
        <ComicImage
          src={coverImageUrl}
          alt={`${title} #${issueNumber}`}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
        />

        {/* Watchlist Button */}
        <div className="absolute top-2 right-2">
          <WatchlistButton
            auctionId={id}
            isWatching={isWatching || false}
            onToggle={onWatchlistChange}
            size="sm"
          />
        </div>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {isComingSoon && (
            <span className="px-2 py-1 bg-purple-500 text-white text-xs font-semibold rounded-full flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Coming Soon
            </span>
          )}
          {!isComingSoon && buyItNowPrice && (
            <span className="px-2 py-1 bg-green-500 text-white text-xs font-semibold rounded-full flex items-center gap-1">
              <ShoppingCart className="w-3 h-3" />
              Buy Now
            </span>
          )}
          {!isComingSoon && bidCount > 0 && (
            <span className="px-2 py-1 bg-blue-500 text-white text-xs font-semibold rounded-full flex items-center gap-1">
              <Gavel className="w-3 h-3" />
              {bidCount} bid{bidCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Price Badge */}
        <div className="absolute bottom-2 right-2">
          <span className="px-2 py-1 bg-black/70 text-white text-sm font-bold rounded-lg">
            {isComingSoon ? `Starting at ${formatPrice(startingPrice)}` : formatPrice(displayPrice)}
          </span>
        </div>

        {/* Countdown or Start Time */}
        <div className="absolute bottom-2 left-2">
          <div className={`px-2 py-1 rounded-lg ${isComingSoon ? "bg-purple-100" : "bg-white/90"}`}>
            {isComingSoon ? (
              <span className="text-xs font-medium text-purple-700">
                {formatStartTime(startTime)}
              </span>
            ) : (
              <AuctionCountdown endTime={endTime} size="sm" />
            )}
          </div>
        </div>

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 pointer-events-none" />
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-semibold text-gray-900 truncate">{title}</h3>
        <p className="text-sm text-gray-600">
          #{issueNumber}
          {comic?.comic?.variant && (
            <span className="text-gray-400 ml-1">({comic.comic.variant})</span>
          )}
        </p>

        {/* Shipping Info */}
        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
          <Package className="w-3 h-3" />
          {shippingCost > 0 ? `+${formatPrice(shippingCost)} shipping` : "Free shipping"}
        </div>

        {/* Seller Badge */}
        {showSeller && seller && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <SellerBadgeCompact seller={seller} />
              {/* Message button - only show if not the seller */}
              {!auction.isSeller && seller.id && (
                <div onClick={(e) => e.stopPropagation()}>
                  <MessageButton
                    sellerId={seller.id}
                    sellerName={seller.username ? `@${seller.username}` : undefined}
                    listingId={id}
                    listingTitle={comic?.comic?.title || undefined}
                    listingIssue={comic?.comic?.issueNumber || undefined}
                    listingGrade={comic?.comic?.grade || undefined}
                    listingGradingCompany={comic?.comic?.gradingCompany || undefined}
                    size="sm"
                    variant="icon"
                  />
                </div>
              )}
            </div>
            {seller.locationPrivacy && seller.locationPrivacy !== "hidden" && (
              <LocationBadge
                city={seller.locationCity}
                state={seller.locationState}
                country={seller.locationCountry}
                privacy={seller.locationPrivacy}
                className="mt-1"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
