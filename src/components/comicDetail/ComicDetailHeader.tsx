"use client";

import { Layers, Star } from "lucide-react";

import { CollectionItem } from "@/types/comic";

import { ComicImage } from "../ComicImage";

interface ComicDetailHeaderProps {
  item: CollectionItem;
  variantCount: number;
  onOpenImageLightbox: () => void;
  onOpenVariants: () => void;
  onToggleStar: () => void;
}

/**
 * Title/header block extracted from ComicDetailModal (R3 / M-CO15).
 * Renders the mobile header (with thumbnail) and the desktop header (with
 * favourite star). Markup is verbatim; the parent retains all state + handlers.
 */
export function ComicDetailHeader({
  item,
  variantCount,
  onOpenImageLightbox,
  onOpenVariants,
  onToggleStar,
}: ComicDetailHeaderProps) {
  const { comic } = item;

  return (
    <>
      {/* Mobile Header with Cover Thumbnail */}
      <div className="md:hidden flex gap-4 mb-4 pr-8">
        {/* Mobile Cover Thumbnail */}
        <div
          onClick={() => item.coverImageUrl && onOpenImageLightbox()}
          className={`flex-shrink-0 self-start w-20 aspect-[2/3] rounded-lg overflow-hidden shadow-md ${item.coverImageUrl ? "cursor-pointer" : ""}`}
        >
          <ComicImage
            src={item.coverImageUrl}
            alt={`${comic.title} #${comic.issueNumber}`}
            aspectRatio="fill"
            sizes="80px"
          />
        </div>
        {/* Mobile Title Info */}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-gray-900 leading-tight">
            {comic.title || "Unknown Title"}
          </h2>
          <p className="text-base text-gray-600">Issue #{comic.issueNumber || "?"}</p>
          {comic.variant && <p className="text-sm text-gray-400">{comic.variant}</p>}
          {variantCount > 1 && (
            <button
              onClick={onOpenVariants}
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              <Layers className="w-3 h-3" />
              View Variants ({variantCount})
            </button>
          )}
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:block mb-6 pr-10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">{comic.title || "Unknown Title"}</h2>
            <p className="text-lg text-gray-600">
              Issue #{comic.issueNumber || "?"}
              {comic.variant && <span className="text-gray-400 ml-2">({comic.variant})</span>}
            </p>
            {/* View Variants Link */}
            {variantCount > 1 && (
              <button
                onClick={onOpenVariants}
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                <Layers className="w-4 h-4" />
                View Variants ({variantCount})
              </button>
            )}
          </div>
          <button
            onClick={onToggleStar}
            className={`p-2 rounded-full transition-colors flex-shrink-0 ${
              item.isStarred
                ? "bg-yellow-100 text-yellow-500 hover:bg-yellow-200"
                : "bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-yellow-500"
            }`}
            title={item.isStarred ? "Remove from favorites" : "Add to favorites"}
          >
            <Star className={`w-6 h-6 ${item.isStarred ? "fill-yellow-500" : ""}`} />
          </button>
        </div>
      </div>
    </>
  );
}
