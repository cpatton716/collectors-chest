"use client";

import { useState } from "react";

import Image from "next/image";

import { ChevronDown, ChevronUp, MessageCircle, Star, X } from "lucide-react";

import { isOptimizableImageSrc } from "@/lib/imageSrc";

import { GroupedMatch } from "@/types/trade";

interface TradeMatchCardProps {
  group: GroupedMatch;
  onDismiss: (matchId: string) => void;
  onMessage: (userId: string, comicId: string) => void;
}

export function TradeMatchCard({ group, onDismiss, onMessage }: TradeMatchCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDismiss = async (matchId: string) => {
    try {
      const response = await fetch(`/api/trades/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      });
      if (response.ok) {
        onDismiss(matchId);
      }
    } catch {
      // Error dismissing match - silently fail, user can retry
    }
  };

  return (
    <div
      className="bg-pop-white border-3 border-pop-black"
      style={{ boxShadow: "4px 4px 0px #000" }}
    >
      {/* Header - Your Comic */}
      <div className="p-4">
        <div className="flex items-center gap-4">
          {/* Your comic thumbnail */}
          <div className="w-16 h-24 border-2 border-pop-black bg-gray-100 overflow-hidden flex-shrink-0">
            {group.myComic?.coverImageUrl && (
              <Image
                src={group.myComic.coverImageUrl}
                unoptimized={!isOptimizableImageSrc(group.myComic.coverImageUrl)}
                alt={group.myComic.title || "Comic"}
                width={64}
                height={96}
                className="object-cover w-full h-full"
              />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold truncate">{group.myComic?.title}</h3>
            <p className="text-sm text-gray-600">#{group.myComic?.issueNumber}</p>
            {group.myComic?.grade && (
              <p className="text-xs text-gray-500">Grade: {group.myComic.grade}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Match count badge */}
            <div className="bg-pop-orange text-white px-3 py-1 font-bold border-2 border-pop-black">
              {group.matches.length} {group.matches.length === 1 ? "Match" : "Matches"}
            </div>

            {/* Expand button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-gray-100 rounded"
            >
              {isExpanded ? <ChevronUp /> : <ChevronDown />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded - List of matches */}
      {isExpanded && (
        <div className="border-t-3 border-pop-black">
          {group.matches.map((match, index) => (
            <div
              key={match.matchId}
              className={`p-4 ${index > 0 ? "border-t-2 border-gray-200" : ""}`}
            >
              <div className="flex items-center gap-4">
                {/* Other user's comic */}
                <div className="w-12 h-16 border-2 border-pop-black bg-gray-100 overflow-hidden flex-shrink-0">
                  {match.theirComic?.coverImageUrl && (
                    <Image
                      src={match.theirComic.coverImageUrl}
                      unoptimized={!isOptimizableImageSrc(match.theirComic.coverImageUrl)}
                      alt={match.theirComic.title || "Comic"}
                      width={48}
                      height={64}
                      className="object-cover w-full h-full"
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{match.theirComic?.title}</p>
                  <p className="text-sm text-gray-600">#{match.theirComic?.issueNumber}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-600">{match.otherUser.displayName}</span>
                    {match.otherUser.positivePercentage > 0 && (
                      <span className="flex items-center gap-1 text-sm">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        {match.otherUser.positivePercentage.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onMessage(match.otherUser.id, match.theirComic?.id || "")}
                    className="flex items-center gap-1 px-3 py-2 bg-pop-blue text-white font-bold border-2 border-pop-black shadow-[2px_2px_0px_#000] text-sm"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Message
                  </button>
                  <button
                    onClick={() => handleDismiss(match.matchId)}
                    className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded"
                    title="Dismiss match"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
