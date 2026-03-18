"use client";

import { useState } from "react";

import Link from "next/link";

import {
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Package,
  Target,
  Trash2,
} from "lucide-react";

import { formatCurrency } from "@/lib/statsCalculator";

import { KeyHuntItem, useKeyHunt } from "@/hooks/useKeyHunt";

import { ComicImage } from "./ComicImage";

interface KeyHuntWishlistProps {
  onClose?: () => void;
}

export function KeyHuntWishlist({ onClose }: KeyHuntWishlistProps) {
  const { items, isLoading, error, isSignedIn, removeFromKeyHunt, updateKeyHuntItem } =
    useKeyHunt();

  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = async (itemId: string) => {
    setRemovingId(itemId);
    await removeFromKeyHunt(itemId);
    setRemovingId(null);
  };

  const toggleNotifications = async (item: KeyHuntItem) => {
    await updateKeyHuntItem(item.id, {
      notifyPriceDrop: !item.notifyPriceDrop,
    });
  };

  if (!isSignedIn) {
    return (
      <div className="text-center py-12">
        <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Sign in to use Key Hunt</h3>
        <p className="text-gray-600 mb-6">
          Track comics you&apos;re hunting for and get notified when prices drop.
        </p>
        <Link
          href="/sign-in"
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Your Key Hunt list is empty</h3>
        <p className="text-gray-600 mb-6">
          Scan comics or use Quick Price Lookup to find books, then add them to your hunt list.
        </p>
      </div>
    );
  }

  // Calculate total estimated value
  const totalValue = items.reduce((sum, item) => sum + (item.currentPriceMid || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg">
        <div>
          <p className="text-sm text-amber-700">Hunting {items.length} comics</p>
          <p className="text-lg font-semibold text-amber-900">
            ~${formatCurrency(totalValue)} total value
          </p>
        </div>
        <Target className="w-8 h-8 text-amber-500" />
      </div>

      {/* Item List */}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Main Row */}
            <div
              className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
            >
              {/* Cover Image */}
              {item.coverImageUrl ? (
                <div className="w-12 h-16 flex-shrink-0 rounded overflow-hidden">
                  <ComicImage
                    src={item.coverImageUrl}
                    alt={`${item.title} #${item.issueNumber}`}
                    aspectRatio="fill"
                    sizes="48px"
                  />
                </div>
              ) : (
                <div className="w-12 h-16 flex-shrink-0 bg-gray-100 rounded flex items-center justify-center">
                  <Package className="w-6 h-6 text-gray-400" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 truncate">
                  {item.title} #{item.issueNumber}
                </h4>
                <p className="text-sm text-gray-500">
                  {item.publisher || "Unknown"} &middot; {item.releaseYear || "Unknown"}
                </p>
                {item.currentPriceMid && (
                  <p className="text-sm text-green-600 font-medium">
                    ~${formatCurrency(item.currentPriceMid)}
                  </p>
                )}
              </div>

              {/* Priority Badge */}
              {item.priority > 5 && (
                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                  High Priority
                </span>
              )}

              {/* Expand Icon */}
              {expandedItem === item.id ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </div>

            {/* Expanded Details */}
            {expandedItem === item.id && (
              <div className="border-t border-gray-100 p-3 bg-gray-50">
                {/* Key Info */}
                {item.keyInfo && item.keyInfo.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-500 mb-1">Key Info</p>
                    <div className="flex flex-wrap gap-1">
                      {item.keyInfo.map((info, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded"
                        >
                          {info}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Price Range */}
                {(item.currentPriceLow || item.currentPriceHigh) && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-500 mb-1">Price Range</p>
                    <div className="flex items-center gap-3 text-sm">
                      {item.currentPriceLow && (
                        <span className="text-gray-600">
                          Low: ${formatCurrency(item.currentPriceLow)}
                        </span>
                      )}
                      {item.currentPriceMid && (
                        <span className="text-green-600 font-medium">
                          Mid: ${formatCurrency(item.currentPriceMid)}
                        </span>
                      )}
                      {item.currentPriceHigh && (
                        <span className="text-gray-600">
                          High: ${formatCurrency(item.currentPriceHigh)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {item.notes && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                    <p className="text-sm text-gray-600">{item.notes}</p>
                  </div>
                )}

                {/* Added Info */}
                <div className="mb-3 text-xs text-gray-400">
                  Added from {item.addedFrom} on {new Date(item.createdAt).toLocaleDateString()}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleNotifications(item);
                    }}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm transition-colors ${
                      item.notifyPriceDrop
                        ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {item.notifyPriceDrop ? (
                      <>
                        <Bell className="w-4 h-4" />
                        Alerts On
                      </>
                    ) : (
                      <>
                        <BellOff className="w-4 h-4" />
                        Alerts Off
                      </>
                    )}
                  </button>

                  <a
                    href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(
                      `${item.title} ${item.issueNumber}`
                    )}&LH_Sold=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 rounded text-sm hover:bg-gray-200 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    eBay
                  </a>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(item.id);
                    }}
                    disabled={removingId === item.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded text-sm hover:bg-red-100 transition-colors disabled:opacity-50 ml-auto"
                  >
                    {removingId === item.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
