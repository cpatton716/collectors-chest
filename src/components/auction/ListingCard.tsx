"use client";

import { MessageSquare, Package, ShoppingCart, Tag } from "lucide-react";

import { Auction, formatPrice } from "@/types/auction";

import { ComicImage } from "../ComicImage";
import { LocationBadge } from "../LocationBadge";
import { SellerBadgeCompact } from "./SellerBadge";
import { WatchlistButton } from "./WatchlistButton";

interface ListingCardProps {
  listing: Auction;
  onClick?: () => void;
  onWatchlistChange?: (listingId: string, isWatching: boolean) => void;
  showSeller?: boolean;
}

export function ListingCard({
  listing,
  onClick,
  onWatchlistChange,
  showSeller = true,
}: ListingCardProps) {
  const { id, startingPrice, shippingCost, comic, seller, isWatching, acceptsOffers } = listing;

  const coverImageUrl = comic?.coverImageUrl;
  const title = comic?.comic?.title || "Unknown Title";
  const issueNumber = comic?.comic?.issueNumber || "?";

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl shadow-md overflow-hidden cursor-pointer group hover:shadow-lg transition-shadow"
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
          <span className="px-2 py-1 bg-green-500 text-white text-xs font-semibold rounded-full flex items-center gap-1">
            <Tag className="w-3 h-3" />
            Buy Now
          </span>
          {acceptsOffers && (
            <span className="px-2 py-1 bg-blue-500 text-white text-xs font-semibold rounded-full flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              Offers
            </span>
          )}
        </div>

        {/* Price Badge */}
        <div className="absolute bottom-2 right-2">
          <span className="px-2 py-1 bg-green-600 text-white text-sm font-bold rounded-lg">
            {formatPrice(startingPrice)}
          </span>
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

        {/* Buy Now Call to Action */}
        <div className="mt-2 flex items-center gap-1 text-xs text-green-600 font-medium">
          <ShoppingCart className="w-3 h-3" />
          <span>Buy Now</span>
        </div>

        {/* Seller Badge */}
        {showSeller && seller && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <SellerBadgeCompact seller={seller} />
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
