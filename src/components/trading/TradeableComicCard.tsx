"use client";

import Image from "next/image";

import { ArrowLeftRight, Star } from "lucide-react";

import { LocationBadge } from "@/components/LocationBadge";
import { MessageButton } from "@/components/messaging/MessageButton";

import { LocationPrivacy } from "@/app/api/location/route";

interface TradeableComicCardProps {
  comic: {
    id: string;
    title: string;
    issueNumber: string;
    publisher: string;
    coverImageUrl?: string;
    grade?: string;
    estimatedValue?: number;
    wantCount?: number;
    owner: {
      id: string;
      displayName: string;
      username?: string;
      rating?: number;
      ratingCount?: number;
      locationCity?: string | null;
      locationState?: string | null;
      locationCountry?: string | null;
      locationPrivacy?: LocationPrivacy;
    };
  };
  onClick: () => void;
  isCurrentUser?: boolean;
}

export function TradeableComicCard({ comic, onClick, isCurrentUser = false }: TradeableComicCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-pop-white border-3 border-pop-black cursor-pointer transition-all hover:shadow-[4px_4px_0px_#000] hover:-translate-y-1"
    >
      {/* Cover Image */}
      <div className="relative aspect-[2/3] bg-gray-100">
        {comic.coverImageUrl ? (
          <Image
            src={comic.coverImageUrl}
            alt={`${comic.title} #${comic.issueNumber}`}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            No Image
          </div>
        )}
        {/* For Trade Badge */}
        <div className="absolute top-2 right-2 bg-pop-orange text-white px-2 py-1 text-xs font-bold border-2 border-pop-black">
          <ArrowLeftRight className="w-3 h-3 inline mr-1" />
          FOR TRADE
        </div>
        {/* Want Count Badge */}
        {comic.wantCount && comic.wantCount > 0 && (
          <div className="absolute bottom-2 left-2 bg-pop-blue text-white px-2 py-1 text-xs font-bold border-2 border-pop-black">
            {comic.wantCount} {comic.wantCount === 1 ? "wants" : "want"} this
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-3">
        <h3 className="font-bold text-sm line-clamp-1">{comic.title}</h3>
        <p className="text-xs text-gray-600">#{comic.issueNumber}</p>

        {comic.grade && <p className="text-xs text-gray-500 mt-1">Grade: {comic.grade}</p>}

        {comic.estimatedValue && (
          <p className="text-sm font-bold text-pop-green mt-1">
            ~${comic.estimatedValue.toFixed(0)}
          </p>
        )}

        {/* Owner Info */}
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-600 truncate">{comic.owner.displayName}</p>
            {!isCurrentUser && comic.owner.id && (
              <div onClick={(e) => e.stopPropagation()}>
                <MessageButton
                  sellerId={comic.owner.id}
                  sellerName={comic.owner.username ? `@${comic.owner.username}` : undefined}
                  size="sm"
                  variant="icon"
                />
              </div>
            )}
          </div>
          {comic.owner.rating !== undefined && comic.owner.rating > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
              <span className="text-xs">
                {comic.owner.rating.toFixed(1)}
                {comic.owner.ratingCount && (
                  <span className="text-gray-400"> ({comic.owner.ratingCount})</span>
                )}
              </span>
            </div>
          )}
          {comic.owner.locationPrivacy && comic.owner.locationPrivacy !== "hidden" && (
            <LocationBadge
              city={comic.owner.locationCity}
              state={comic.owner.locationState}
              country={comic.owner.locationCountry}
              privacy={comic.owner.locationPrivacy}
              className="mt-1"
            />
          )}
        </div>
      </div>
    </div>
  );
}
