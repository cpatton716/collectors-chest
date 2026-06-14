"use client";

import { memo, useEffect, useRef, useState } from "react";

import Image from "next/image";

import { DollarSign, Pencil, Star, Tag, TrendingDown, TrendingUp } from "lucide-react";

import { SelectionCheckbox } from "@/components/collection/SelectionCheckbox";
import { CollectionItem } from "@/types/comic";

interface ComicCardProps {
  item: CollectionItem;
  onClick?: () => void;
  onToggleStar?: (id: string) => void;
  onEdit?: (item: CollectionItem) => void;
  // Selection mode props
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

function ComicCardComponent({
  item,
  onClick,
  onToggleStar,
  onEdit,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
}: ComicCardProps) {
  const { comic, coverImageUrl, conditionLabel, forSale, askingPrice } = item;

  // iOS Safari sometimes leaves a loaded <img> unpainted until a reflow (cover
  // shows blank until the card re-renders). Fading the image in on load forces
  // the repaint; the complete-check covers cached images that finished loading
  // before React attached onLoad, so they don't stay invisible.
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgReady, setImgReady] = useState(false);
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setImgReady(true);
    }
  }, [coverImageUrl]);

  // Calculate profit/loss
  const estimatedValue = comic.priceData?.estimatedValue || 0;
  const purchasePrice = item.purchasePrice || 0;
  const hasProfitData = estimatedValue > 0 && purchasePrice > 0;
  const profitLoss = hasProfitData ? estimatedValue - purchasePrice : 0;

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleStar?.(item.id);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(item);
  };

  const handleCardClick = () => {
    if (isSelectionMode && onToggleSelect) {
      onToggleSelect(item.id);
    } else {
      onClick?.();
    }
  };

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    // Activate on Enter/Space like a native button; don't hijack other keys.
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCardClick();
    }
  };

  const cardLabel = `${comic.title || "Unknown title"} #${comic.issueNumber || "?"}`;

  return (
    <div
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={isSelectionMode ? isSelected : undefined}
      aria-label={
        isSelectionMode
          ? `${isSelected ? "Deselect" : "Select"} ${cardLabel}`
          : `View details for ${cardLabel}`
      }
      className={`comic-card cursor-pointer group focus:outline-none focus-visible:ring-4 focus-visible:ring-pop-blue ${isSelected ? "ring-4 ring-pop-yellow" : ""}`}
    >
      {/* Cover Image */}
      <div className="relative aspect-[2/3] bg-pop-cream border-b-3 border-pop-black">
        {coverImageUrl ? (
          <Image
            ref={imgRef}
            src={coverImageUrl}
            alt={`${comic.title} #${comic.issueNumber}`}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
            onLoad={() => setImgReady(true)}
            decoding="async"
            className={`object-cover transition-opacity duration-200 ${imgReady ? "opacity-100" : "opacity-0"}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center dots-red">
            <span className="font-comic text-6xl text-pop-blue text-comic-outline">?</span>
          </div>
        )}

        {/* Selection Checkbox */}
        {isSelectionMode && onToggleSelect && (
          <div className="absolute top-2 left-2 z-10">
            <SelectionCheckbox
              checked={isSelected}
              onChange={() => onToggleSelect(item.id)}
              label={cardLabel}
            />
          </div>
        )}

        {/* Badges */}
        <div className={`absolute ${isSelectionMode ? "top-12" : "top-2"} left-2 flex flex-col gap-1`}>
          {forSale && (
            <span className="badge-pop badge-pop-green flex items-center gap-1">
              <Tag className="w-3 h-3" />
              FOR SALE!
            </span>
          )}
          {conditionLabel && <span className="badge-pop badge-pop-blue">{conditionLabel}</span>}
        </div>

        {/* Quick Actions - revealed on hover, keyboard focus, and touch focus */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
          {onToggleStar && (
            <button
              onClick={handleStarClick}
              className={`p-2 border-2 border-pop-black shadow-comic-sm transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-comic ${
                item.isStarred
                  ? "bg-pop-yellow text-pop-black"
                  : "bg-pop-white text-pop-black hover:bg-pop-yellow"
              }`}
              title={item.isStarred ? "Remove from favorites" : "Add to favorites"}
              aria-label={item.isStarred ? "Remove from favorites" : "Add to favorites"}
            >
              <Star className={`w-4 h-4 ${item.isStarred ? "fill-current" : ""}`} />
            </button>
          )}
          {onEdit && (
            <button
              onClick={handleEditClick}
              className="p-2 bg-pop-white text-pop-black border-2 border-pop-black shadow-comic-sm hover:bg-pop-blue hover:text-pop-white transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-comic"
              title="Edit details"
              aria-label="Edit comic details"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Price/Profit Badge */}
        <div className="absolute bottom-2 right-2 flex flex-col gap-1 items-end">
          {estimatedValue > 0 && (
            <span className="price-tag flex items-center gap-1 text-lg">
              <DollarSign className="w-4 h-4" />
              {estimatedValue.toFixed(0)}
            </span>
          )}
          {hasProfitData && (
            <span
              className={`badge-pop flex items-center gap-0.5 ${
                profitLoss >= 0 ? "badge-pop-green" : "badge-pop-red"
              }`}
            >
              {profitLoss >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {profitLoss >= 0 ? "+" : ""}${profitLoss.toFixed(0)}
            </span>
          )}
        </div>

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-pop-blue/0 group-hover:bg-pop-blue/10 transition-colors duration-200 pointer-events-none" />
      </div>

      {/* Info */}
      <div className="p-3 bg-pop-white">
        <h3 className="font-comic text-pop-black truncate tracking-wide">
          {comic.title?.toUpperCase() || "UNKNOWN TITLE"}
        </h3>
        <div className="flex items-center justify-between mt-1">
          <p className="text-sm font-body text-pop-black">
            #{comic.issueNumber || "?"}
            {comic.variant && <span className="text-pop-blue ml-1">({comic.variant})</span>}
          </p>
          {item.isStarred && <Star className="w-4 h-4 text-pop-yellow fill-pop-yellow" />}
        </div>
        <p className="text-xs font-body text-pop-black/70 mt-1 truncate">
          {comic.publisher || "Unknown Publisher"}
          {comic.releaseYear && ` • ${comic.releaseYear}`}
        </p>
      </div>
    </div>
  );
}

/**
 * Memoized so the grid only re-renders cards whose props actually changed.
 * Parent handlers are stabilized with useCallback on the collection page so
 * the memo holds (M-CO8).
 */
export const ComicCard = memo(ComicCardComponent);
