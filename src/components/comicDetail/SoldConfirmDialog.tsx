"use client";

import { CollectionItem } from "@/types/comic";

interface SoldConfirmDialogProps {
  item: CollectionItem;
  salePrice: string;
  onSalePriceChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * "Sold elsewhere? Record sale" inline panel extracted from ComicDetailModal
 * (R3 / M-CO15). This is an inline form panel within the modal body (not an
 * overlay dialog), so its markup is reproduced verbatim without overlay dialog
 * semantics — preserving the original layout and behavior exactly.
 */
export function SoldConfirmDialog({
  item,
  salePrice,
  onSalePriceChange,
  onConfirm,
  onCancel,
}: SoldConfirmDialogProps) {
  return (
    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
      <p className="text-sm text-green-700 mb-3">Enter the sale price to record this sale.</p>
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">Sale Price ($)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={salePrice}
          onChange={(e) => onSalePriceChange(e.target.value)}
          className="w-full md:w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900"
          placeholder="Enter sale price"
        />
        {item.purchasePrice && salePrice && parseFloat(salePrice) > 0 && (
          <p
            className={`text-xs mt-1 ${
              parseFloat(salePrice) >= item.purchasePrice ? "text-green-600" : "text-red-600"
            }`}
          >
            {parseFloat(salePrice) >= item.purchasePrice ? "Profit" : "Loss"}: $
            {Math.abs(parseFloat(salePrice) - item.purchasePrice).toFixed(2)}
          </p>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Note: In the future, you&apos;ll be able to select the buyer and the comic will automatically
        transfer to their collection.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={!salePrice || parseFloat(salePrice) <= 0}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Confirm Sale
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
