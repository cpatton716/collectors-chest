"use client";

import { Star, Tag } from "lucide-react";

import { MARKETPLACE_ENABLED } from "@/lib/features";
import { getComicValue } from "@/lib/gradePrice";

import { ComicCard } from "@/components/ComicCard";
import { ComicImage } from "@/components/ComicImage";

import { CollectionItem } from "@/types/comic";

interface CollectionGridProps {
  viewMode: "grid" | "list";
  filteredCollection: CollectionItem[];
  showFinancials: boolean;
  isSelectionMode: boolean;
  selectedIds: Set<string>;
  onComicClick: (item: CollectionItem) => void;
  onToggleStar: (itemId: string) => void;
  onEdit: (item: CollectionItem) => void;
  onToggleSelect: (id: string) => void;
}

/**
 * Presentational grid/list renderer for the collection page (M-FE13).
 * Markup extracted verbatim from CollectionPageContent; parent owns all state.
 */
export function CollectionGrid({
  viewMode,
  filteredCollection,
  showFinancials,
  isSelectionMode,
  selectedIds,
  onComicClick,
  onToggleStar,
  onEdit,
  onToggleSelect,
}: CollectionGridProps) {
  if (viewMode === "grid") {
    return (
      <div
        className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 ${isSelectionMode ? "pb-28" : ""}`}
      >
        {filteredCollection.map((item) => (
          <ComicCard
            key={item.id}
            item={item}
            onClick={() => onComicClick(item)}
            onToggleStar={onToggleStar}
            onEdit={onEdit}
            isSelectionMode={isSelectionMode}
            isSelected={selectedIds.has(item.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    );
  }

  // Column count drops by one when the For Sale column is hidden. Literal
  // class names so Tailwind generates each one.
  const tableGridCols = MARKETPLACE_ENABLED
    ? showFinancials
      ? "grid-cols-12"
      : "grid-cols-10"
    : showFinancials
      ? "grid-cols-11"
      : "grid-cols-9";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Table Header */}
      <div
        className={`grid ${tableGridCols} gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider`}
      >
        <div className={showFinancials ? "col-span-5" : "col-span-5"}>Comic</div>
        <div className="col-span-2">Publisher</div>
        <div className="col-span-2 text-right">Est. Value</div>
        {showFinancials && <div className="col-span-2 text-right">Purchase Price</div>}
        {MARKETPLACE_ENABLED && <div className="col-span-1 text-center">For Sale</div>}
      </div>

      {/* Table Body */}
      <div className="divide-y divide-gray-100">
        {filteredCollection.map((item) => {
          const { comic } = item;
          const estimatedValue = getComicValue(item);
          const itemProfitLoss =
            estimatedValue && item.purchasePrice ? estimatedValue - item.purchasePrice : null;

          return (
            <div
              key={item.id}
              onClick={() => onComicClick(item)}
              className={`grid ${tableGridCols} gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors items-center`}
            >
              {/* Comic Info */}
              <div className="col-span-5 flex items-center gap-3">
                <div className="w-10 h-14 flex-shrink-0 rounded overflow-hidden">
                  <ComicImage
                    src={item.coverImageUrl}
                    alt={`${comic.title} #${comic.issueNumber}`}
                    aspectRatio="fill"
                    sizes="40px"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 truncate">
                      {comic.title || "Unknown Title"}
                    </p>
                    {item.isStarred && (
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    Issue #{comic.issueNumber || "?"}
                    {comic.variant && <span className="text-gray-400"> • {comic.variant}</span>}
                  </p>
                </div>
              </div>

              {/* Publisher */}
              <div className="col-span-2">
                <p className="text-sm text-gray-600 truncate">{comic.publisher || "Unknown"}</p>
              </div>

              {/* Est. Value */}
              <div className="col-span-2 text-right">
                {estimatedValue > 0 ? (
                  <div>
                    <p className="font-medium text-gray-900">
                      $
                      {estimatedValue.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    {showFinancials && itemProfitLoss !== null && (
                      <p
                        className={`text-xs ${itemProfitLoss >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {itemProfitLoss >= 0 ? "+" : ""}$
                        {itemProfitLoss.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </div>

              {/* Purchase Price */}
              {showFinancials && (
                <div className="col-span-2 text-right">
                  {item.purchasePrice ? (
                    <p className="font-medium text-gray-900">${item.purchasePrice.toFixed(2)}</p>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
              )}

              {/* For Sale (hidden while the marketplace is off) */}
              {MARKETPLACE_ENABLED && (
                <div className="col-span-1 flex justify-center">
                  {item.forSale ? (
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full">
                      <Tag className="w-3 h-3" />
                      <span className="text-xs font-medium">
                        ${item.askingPrice?.toFixed(0) || "-"}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
