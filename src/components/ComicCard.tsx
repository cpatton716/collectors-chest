"use client";

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

export function ComicCard({
  item,
  onClick,
  onToggleStar,
  onEdit,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
}: ComicCardProps) {
  const { comic, coverImageUrl, conditionLabel, forSale, askingPrice } = item;

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

  return (
    <div
      onClick={handleCardClick}
      className={`comic-card cursor-pointer group ${isSelected ? "ring-4 ring-pop-yellow" : ""}`}
    >
      {/* Cover Image */}
      <div className="relative aspect-[2/3] bg-pop-cream border-b-3 border-pop-black">
        {coverImageUrl ? (
          <img
            src={coverImageUrl}
            alt={`${comic.title} #${comic.issueNumber}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center dots-red">
            <span className="font-comic text-6xl text-pop-blue text-comic-outline">?</span>
          </div>
        )}

        {/* Selection Checkbox */}
        {isSelectionMode && onToggleSelect && (
          <div className="absolute top-2 left-2 z-10">
            <SelectionCheckbox checked={isSelected} onChange={() => onToggleSelect(item.id)} />
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

        {/* Quick Actions - Show on hover */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {onToggleStar && (
            <button
              onClick={handleStarClick}
              className={`p-2 border-2 border-pop-black shadow-comic-sm transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-comic ${
                item.isStarred
                  ? "bg-pop-yellow text-pop-black"
                  : "bg-pop-white text-pop-black hover:bg-pop-yellow"
              }`}
              title={item.isStarred ? "Remove from favorites" : "Add to favorites"}
            >
              <Star className={`w-4 h-4 ${item.isStarred ? "fill-current" : ""}`} />
            </button>
          )}
          {onEdit && (
            <button
              onClick={handleEditClick}
              className="p-2 bg-pop-white text-pop-black border-2 border-pop-black shadow-comic-sm hover:bg-pop-blue hover:text-pop-white transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-comic"
              title="Edit details"
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
