"use client";

import { Award, DollarSign } from "lucide-react";

import { CollectionItem } from "@/types/comic";

import { ComicImage } from "./ComicImage";

interface PublicComicCardProps {
  item: CollectionItem;
  onClick?: () => void;
}

export function PublicComicCard({ item, onClick }: PublicComicCardProps) {
  const { comic, coverImageUrl, conditionLabel } = item;
  const estimatedValue = comic.priceData?.estimatedValue || 0;

  return (
    <div
      onClick={onClick}
      className="comic-card cursor-pointer group"
    >
      {/* Cover Image */}
      <div className="relative aspect-[2/3] bg-pop-cream border-b-3 border-pop-black">
        <ComicImage
          src={coverImageUrl}
          alt={`${comic.title} #${comic.issueNumber}`}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
        />

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {comic.isSlabbed && (
            <span className="badge-pop badge-pop-blue flex items-center gap-1">
              <Award className="w-3 h-3" />
              {comic.gradingCompany} {comic.grade}
            </span>
          )}
          {!comic.isSlabbed && conditionLabel && (
            <span className="badge-pop badge-pop-blue">
              {conditionLabel}
            </span>
          )}
        </div>

        {/* Price Badge */}
        {estimatedValue > 0 && (
          <div className="absolute bottom-2 right-2">
            <span className="price-tag flex items-center gap-1 text-lg">
              <DollarSign className="w-4 h-4" />
              {estimatedValue.toFixed(0)}
            </span>
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-pop-blue/0 group-hover:bg-pop-blue/10 transition-colors duration-200 pointer-events-none" />
      </div>

      {/* Info */}
      <div className="p-3 bg-pop-white">
        <h3 className="font-comic text-pop-black truncate tracking-wide">
          {comic.title?.toUpperCase() || "UNKNOWN TITLE"}
        </h3>
        <p className="text-sm font-body text-pop-black mt-1">
          #{comic.issueNumber || "?"}
          {comic.variant && <span className="text-pop-blue ml-1">({comic.variant})</span>}
        </p>
        <p className="text-xs font-body text-pop-black/70 mt-1 truncate">
          {comic.publisher || "Unknown Publisher"}
          {comic.releaseYear && ` - ${comic.releaseYear}`}
        </p>
      </div>
    </div>
  );
}
