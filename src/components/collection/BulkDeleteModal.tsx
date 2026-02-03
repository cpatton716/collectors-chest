"use client";

import { AlertTriangle, X } from "lucide-react";

import { CollectionItem } from "@/types/comic";

interface BulkDeleteModalProps {
  items: CollectionItem[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function BulkDeleteModal({ items, onConfirm, onCancel }: BulkDeleteModalProps) {
  const displayItems = items.slice(0, 5);
  const remainingCount = items.length - displayItems.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-pop-white border-4 border-pop-black shadow-[6px_6px_0px_#000] max-w-md w-full">
        {/* Header */}
        <div className="bg-pop-red border-b-4 border-pop-black p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-pop-white" />
            <h2 className="font-comic text-pop-white text-xl">
              DELETE {items.length} COMICS?
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-pop-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-pop-white" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <ul className="space-y-2 mb-4">
            {displayItems.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-pop-black font-body">
                <span className="w-2 h-2 bg-pop-black" />
                {item.comic.title} #{item.comic.issueNumber}
              </li>
            ))}
            {remainingCount > 0 && (
              <li className="text-pop-black/70 font-body italic">
                ...and {remainingCount} more
              </li>
            )}
          </ul>

          <p className="text-sm text-pop-black/70 font-body mb-4">
            This action can be undone for 10 seconds after deletion.
          </p>
        </div>

        {/* Footer */}
        <div className="border-t-3 border-pop-black p-4 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-pop-cream border-2 border-pop-black font-comic text-pop-black hover:shadow-[2px_2px_0px_#000] transition-all"
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-pop-red border-2 border-pop-black font-comic text-pop-white hover:shadow-[2px_2px_0px_#000] transition-all"
          >
            DELETE
          </button>
        </div>
      </div>
    </div>
  );
}
