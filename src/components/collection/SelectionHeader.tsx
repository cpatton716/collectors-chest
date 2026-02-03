// src/components/collection/SelectionHeader.tsx
"use client";

import { CheckSquare, Square, X } from "lucide-react";

interface SelectionHeaderProps {
  selectionCount: number;
  isAllSelected: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onCancel: () => void;
}

export function SelectionHeader({
  selectionCount,
  isAllSelected,
  onSelectAll,
  onClear,
  onCancel,
}: SelectionHeaderProps) {
  return (
    <div className="bg-pop-yellow border-3 border-pop-black p-3 shadow-[4px_4px_0px_#000] mb-6 flex items-center justify-between">
      {/* Cancel Button */}
      <button
        onClick={onCancel}
        className="flex items-center gap-2 px-3 py-2 bg-pop-white border-2 border-pop-black font-comic text-sm hover:shadow-[2px_2px_0px_#000] transition-all"
      >
        <X className="w-4 h-4" />
        CANCEL
      </button>

      {/* Selection Count */}
      <div className="font-comic text-pop-black text-lg">
        {selectionCount} SELECTED
      </div>

      {/* Select All / Clear */}
      <div className="flex gap-2">
        {selectionCount > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-2 px-3 py-2 bg-pop-white border-2 border-pop-black font-comic text-sm hover:shadow-[2px_2px_0px_#000] transition-all"
          >
            <Square className="w-4 h-4" />
            CLEAR
          </button>
        )}
        <button
          onClick={onSelectAll}
          className={`flex items-center gap-2 px-3 py-2 border-2 border-pop-black font-comic text-sm hover:shadow-[2px_2px_0px_#000] transition-all ${
            isAllSelected
              ? "bg-pop-green text-pop-white"
              : "bg-pop-white text-pop-black"
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          {isAllSelected ? "ALL SELECTED" : "SELECT ALL"}
        </button>
      </div>
    </div>
  );
}
