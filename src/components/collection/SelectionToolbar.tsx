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
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-pop-white border-t-4 border-pop-black shadow-[0_-4px_0px_#000]">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-center gap-2 md:gap-4">
          {/* Delete */}
          <button
            onClick={onDelete}
            disabled={isDisabled}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 border-2 border-pop-black font-comic text-sm transition-all ${
              isDisabled
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-pop-red text-pop-white hover:shadow-[2px_2px_0px_#000]"
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">DELETE</span>
          </button>

          {/* Mark for Trade */}
          <button
            onClick={onMarkForTrade}
            disabled={isDisabled}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 border-2 border-pop-black font-comic text-sm transition-all ${
              isDisabled
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-pop-orange text-pop-white hover:shadow-[2px_2px_0px_#000]"
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span className="hidden sm:inline">TRADE</span>
          </button>

          {/* Add to List */}
          <button
            onClick={onAddToList}
            disabled={isDisabled}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 border-2 border-pop-black font-comic text-sm transition-all ${
              isDisabled
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-pop-blue text-pop-white hover:shadow-[2px_2px_0px_#000]"
            }`}
          >
            <ListPlus className="w-4 h-4" />
            <span className="hidden sm:inline">ADD TO LIST</span>
          </button>

          {/* Mark as Sold */}
          <button
            onClick={onMarkSold}
            disabled={isDisabled}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 border-2 border-pop-black font-comic text-sm transition-all ${
              isDisabled
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-pop-green text-pop-white hover:shadow-[2px_2px_0px_#000]"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span className="hidden sm:inline">SOLD</span>
          </button>
        </div>
      </div>
    </div>
  );
}
