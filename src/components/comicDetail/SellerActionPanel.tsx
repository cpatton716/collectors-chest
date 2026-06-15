"use client";

import { AlertTriangle, CheckCircle, Eye, PackageMinus, Store } from "lucide-react";

interface ActiveListing {
  id: string;
  listingType: string;
  bidCount?: number;
}

interface SellerActionPanelProps {
  activeListing: ActiveListing | null;
  showSellerAction: "mark_as_sold" | "pull_off_shelf" | null;
  isProcessingAction: boolean;
  actionError: string | null;
  onSetSellerAction: (action: "mark_as_sold" | "pull_off_shelf") => void;
  onCancelSellerAction: () => void;
  onConfirmSellerAction: (action: "mark_as_sold" | "pull_off_shelf") => void;
  onListInShop: () => void;
}

/**
 * Primary CTA block extracted from ComicDetailModal (R3 / M-CO15): either the
 * "List in Shop" button (no active listing) or the active-listing "View
 * Listing" + seller controls + confirmation panel. Markup verbatim; parent
 * keeps all state + handlers.
 */
export function SellerActionPanel({
  activeListing,
  showSellerAction,
  isProcessingAction,
  actionError,
  onSetSellerAction,
  onCancelSellerAction,
  onConfirmSellerAction,
  onListInShop,
}: SellerActionPanelProps) {
  if (!activeListing) {
    return (
      <button
        onClick={onListInShop}
        className="w-full px-4 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-semibold text-lg"
      >
        <Store className="w-6 h-6" />
        List in Shop
      </button>
    );
  }

  return (
    <>
      <a
        href={`/shop?listing=${activeListing.id}&tab=${activeListing.listingType === "auction" ? "auctions" : "buy-now"}`}
        className="w-full px-4 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-semibold text-lg"
      >
        <Eye className="w-6 h-6" />
        View Listing
      </a>

      {/* Seller Controls for active listing */}
      <div className="flex gap-2">
        {/* Mark as Sold - only for fixed_price */}
        {activeListing.listingType === "fixed_price" && (
          <button
            onClick={() => onSetSellerAction("mark_as_sold")}
            className="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors flex items-center justify-center gap-1.5 text-sm font-medium"
          >
            <CheckCircle className="w-4 h-4" />
            Mark as Sold
          </button>
        )}
        {/* Pull off the Shelf */}
        <button
          onClick={() => onSetSellerAction("pull_off_shelf")}
          disabled={activeListing.listingType === "auction" && (activeListing.bidCount || 0) > 0}
          className={`flex-1 px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-sm font-medium ${
            activeListing.listingType === "auction" && (activeListing.bidCount || 0) > 0
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
          title={
            activeListing.listingType === "auction" && (activeListing.bidCount || 0) > 0
              ? "Cannot remove auction with bids"
              : undefined
          }
        >
          <PackageMinus className="w-4 h-4" />
          Pull off Shelf
        </button>
      </div>

      {/* Seller Action Confirmation */}
      {showSellerAction && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h5 className="font-medium text-amber-800">
                {showSellerAction === "mark_as_sold" ? "Mark as Sold?" : "Pull off the Shelf?"}
              </h5>
              <p className="text-sm text-amber-700 mt-1">
                {showSellerAction === "mark_as_sold"
                  ? "This will remove the listing from the shop AND remove the comic from your collection."
                  : "This will remove the listing from the shop. The comic will remain in your collection."}
              </p>
              {actionError && <p className="text-sm text-red-600 mt-2">{actionError}</p>}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => onConfirmSellerAction(showSellerAction)}
                  disabled={isProcessingAction}
                  className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                    showSellerAction === "mark_as_sold"
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  } disabled:opacity-50`}
                >
                  {isProcessingAction
                    ? "Processing..."
                    : showSellerAction === "mark_as_sold"
                      ? "Yes, Mark as Sold"
                      : "Yes, Pull it"}
                </button>
                <button
                  onClick={onCancelSellerAction}
                  disabled={isProcessingAction}
                  className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
