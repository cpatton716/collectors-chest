// src/components/collection/SelectionToolbar.tsx
"use client";

import { ArrowLeftRight, DollarSign, ListPlus, Trash2 } from "lucide-react";

interface SelectionToolbarProps {
  selectionCount: number;
  onDelete: () => void;
  onMarkForTrade: () => void;
  onAddToList: () => void;
  onMarkSold: () => void;
  disabled?: boolean;
}

export function SelectionToolbar({
  selectionCount,
  onDelete,
  onMarkForTrade,
  onAddToList,
  onMarkSold,
  disabled = false,
}: SelectionToolbarProps) {
  const isDisabled = disabled || selectionCount === 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-pop-cream border-t-4 border-pop-black shadow-[0_-4px_0px_#000]">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-center gap-3 md:gap-5">
          {/* Add to List */}
          <button
            onClick={onAddToList}
            disabled={isDisabled}
            className={`flex items-center gap-2 px-4 md:px-5 py-2.5 border-3 border-pop-black font-comic text-base transition-all ${
              isDisabled
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-pop-blue text-pop-white shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-y-0.5"
            }`}
          >
            <ListPlus className="w-5 h-5" />
            <span className="hidden sm:inline">ADD TO LIST</span>
          </button>

          {/* Mark for Trade */}
          <button
            onClick={onMarkForTrade}
            disabled={isDisabled}
            className={`flex items-center gap-2 px-4 md:px-5 py-2.5 border-3 border-pop-black font-comic text-base transition-all ${
              isDisabled
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-pop-orange text-pop-white shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-y-0.5"
            }`}
          >
            <ArrowLeftRight className="w-5 h-5" />
            <span className="hidden sm:inline">TRADE</span>
          </button>

          {/* Mark as Sold */}
          <button
            onClick={onMarkSold}
            disabled={isDisabled}
            className={`flex items-center gap-2 px-4 md:px-5 py-2.5 border-3 border-pop-black font-comic text-base transition-all ${
              isDisabled
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-pop-green text-pop-white shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-y-0.5"
            }`}
          >
            <DollarSign className="w-5 h-5" />
            <span className="hidden sm:inline">SOLD</span>
          </button>

          {/* Delete */}
          <button
            onClick={onDelete}
            disabled={isDisabled}
            className={`flex items-center gap-2 px-4 md:px-5 py-2.5 border-3 border-pop-black font-comic text-base transition-all ${
              isDisabled
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-pop-red text-pop-white shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-y-0.5"
            }`}
          >
            <Trash2 className="w-5 h-5" />
            <span className="hidden sm:inline">DELETE</span>
          </button>
        </div>
      </div>
    </div>
  );
}
