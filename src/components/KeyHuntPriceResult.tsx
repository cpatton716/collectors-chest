"use client";

import { useState } from "react";

import {
  Check,
  CloudOff,
  Database,
  ExternalLink,
  Loader2,
  Plus,
  RotateCcw,
  Target,
  X,
} from "lucide-react";

import { ComicImage } from "./ComicImage";

interface RecentSale {
  price: number;
  date: string;
}

interface GradeEstimate {
  grade: number;
  label: string;
  rawValue: number;
  slabbedValue: number;
}

interface KeyHuntPriceResultProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCollection: () => void;
  onAddToHuntList?: () => Promise<{ success: boolean; error?: string }>;
  onNewLookup: () => void;
  title: string;
  issueNumber: string;
  grade: number;
  averagePrice: number | null;
  recentSale: RecentSale | null;
  coverImageUrl?: string | null;
  gradeEstimates?: GradeEstimate[];
  isInHuntList?: boolean;
  fromCache?: boolean;
  isOffline?: boolean;
  source?: "database" | "ebay";
  totalListings?: number;
  ebaySearchQuery?: string;
}

export function KeyHuntPriceResult({
  isOpen,
  onClose,
  onAddToCollection,
  onAddToHuntList,
  onNewLookup,
  title,
  issueNumber,
  grade,
  averagePrice,
  recentSale,
  coverImageUrl,
  gradeEstimates,
  isInHuntList = false,
  fromCache = false,
  isOffline = false,
  source = "ebay",
  totalListings,
  ebaySearchQuery,
}: KeyHuntPriceResultProps) {
  const [showSlabbed, setShowSlabbed] = useState(false);
  const [isAddingToHunt, setIsAddingToHunt] = useState(false);
  const [addedToHunt, setAddedToHunt] = useState(isInHuntList);
  const [huntError, setHuntError] = useState<string | null>(null);

  // Get the current grade's estimate for raw/slabbed values
  const currentGradeEstimate = gradeEstimates?.find((g) => g.grade === grade);
  const hasRawSlabbedData = currentGradeEstimate && currentGradeEstimate.rawValue > 0;

  // Calculate display price based on toggle
  const displayPrice = hasRawSlabbedData
    ? showSlabbed
      ? currentGradeEstimate.slabbedValue
      : currentGradeEstimate.rawValue
    : averagePrice;

  // Build eBay search URL for "For Sale Now" link
  const buildEbaySearchUrl = () => {
    let query = title.trim();
    const cleanIssue = issueNumber.replace(/^#/, "").trim();
    query += ` #${cleanIssue}`;
    const encodedQuery = encodeURIComponent(query);
    // Comic book category, sorted by most recent, SOLD listings only
    return `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}&_sacat=259104&_sop=10&LH_Complete=1&LH_Sold=1`;
  };
  if (!isOpen) return null;

  // Format grade display
  const formatGrade = (g: number) => {
    if (g >= 9.8) return `${g} (NM/M)`;
    if (g >= 9.4) return `${g} (NM)`;
    if (g >= 8.0) return `${g} (VF)`;
    if (g >= 6.0) return `${g} (FN)`;
    if (g >= 4.0) return `${g} (VG)`;
    return `${g} (GD)`;
  };

  // Format price
  const formatPrice = (price: number | null) => {
    if (price === null) return "N/A";
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Result Card */}
      <div className="relative w-full max-w-sm max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl animate-in zoom-in-95 fade-in duration-300">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/30 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Source Badge */}
        <div className="absolute top-4 left-4 z-10 flex gap-1.5">
          {source === "ebay" && (
            <span className="flex items-center gap-1 px-2 py-1 bg-blue-500 rounded-full text-xs font-medium text-white">
              eBay Data
            </span>
          )}
          {fromCache && (
            <span className="flex items-center gap-1 px-2 py-1 bg-amber-500 rounded-full text-xs font-medium text-white">
              <Database className="w-3 h-3" />
              Cached
            </span>
          )}
        </div>

        {/* Cover Image Header */}
        <div className="relative h-40 bg-gradient-to-br from-primary-500 to-primary-700 overflow-hidden">
          {/* Background cover image (blurred) */}
          {coverImageUrl && (
            <div className="absolute inset-0 scale-110 blur-sm">
              <ComicImage src={coverImageUrl} alt="" aspectRatio="fill" sizes="400px" />
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary-600/90 via-primary-600/70 to-primary-600/40" />

          {/* Content with cover thumbnail */}
          <div className="absolute inset-0 flex items-center px-4 gap-4">
            {/* Cover thumbnail */}
            <div className="flex-shrink-0 w-20 h-28 rounded-lg overflow-hidden shadow-lg ring-2 ring-white/20">
              <ComicImage
                src={coverImageUrl}
                alt={`${title} #${issueNumber}`}
                aspectRatio="fill"
                sizes="80px"
              />
            </div>

            {/* Title info */}
            <div className="flex-1 min-w-0 pr-10">
              <h2 className="text-xl font-bold text-white truncate">{title}</h2>
              <p className="text-white/80">Issue #{issueNumber}</p>
            </div>
          </div>
        </div>

        {/* Price Info */}
        <div className="p-6">
          {/* Grade Badge */}
          <div className="flex justify-center mb-4">
            <span className="px-4 py-1.5 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
              Grade: {formatGrade(grade)}
            </span>
          </div>

          {/* Raw/Slabbed Toggle */}
          {hasRawSlabbedData && (
            <div className="flex justify-center mb-4">
              <div className="inline-flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setShowSlabbed(false)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    !showSlabbed
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Raw
                </button>
                <button
                  onClick={() => setShowSlabbed(true)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    showSlabbed
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Slabbed
                </button>
              </div>
            </div>
          )}

          {/* Average Price */}
          <div className="text-center mb-4">
            <p className="text-sm text-gray-500 mb-1">
              {hasRawSlabbedData
                ? showSlabbed
                  ? "Avg List Price (Slabbed)"
                  : "Avg List Price (Raw)"
                : "Avg List Price"}
            </p>
            <p className="text-4xl font-bold text-gray-900">{formatPrice(displayPrice)}</p>
            {fromCache && <p className="text-xs text-amber-600 mt-1">Price from cached lookup</p>}
          </div>

          {/* eBay Source Note */}
          {source === "ebay" && averagePrice && (
            <p className="text-xs text-gray-400 text-center mb-4">
              Based on current eBay listings
            </p>
          )}

          {/* Below-threshold display */}
          {totalListings && totalListings > 0 && !averagePrice && (
            <div className="text-center text-gray-400 mt-2 mb-4">
              <p>{totalListings} active listing{totalListings !== 1 ? "s" : ""} found</p>
              {ebaySearchQuery && (
                <a
                  href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(ebaySearchQuery)}&_sacat=259104`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline text-sm"
                >
                  View on eBay
                </a>
              )}
            </div>
          )}

          {/* No Price Data */}
          {!averagePrice && (
            <div className="text-center py-4 mb-6 bg-gray-50 rounded-xl">
              <p className="text-gray-500">No price data available for this grade</p>
            </div>
          )}

          {/* Offline Queue Notice */}
          {isOffline && (
            <div className="mb-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
              <CloudOff className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-700">Adding will queue for sync when back online</p>
            </div>
          )}

          {/* For Sale Now Link */}
          <a
            href={buildEbaySearchUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full mb-3 py-2.5 px-4 bg-[#0064D2] text-white rounded-xl font-medium hover:bg-[#004BA0] transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Recent Sales on eBay
          </a>

          {/* Add to Hunt List Button */}
          {onAddToHuntList && !isOffline && (
            <button
              onClick={async () => {
                if (addedToHunt || isAddingToHunt) return;
                setIsAddingToHunt(true);
                setHuntError(null);
                const result = await onAddToHuntList();
                setIsAddingToHunt(false);
                if (result.success) {
                  setAddedToHunt(true);
                } else {
                  setHuntError(result.error || "Failed to add");
                }
              }}
              disabled={addedToHunt || isAddingToHunt}
              className={`w-full mb-4 py-2.5 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 text-sm ${
                addedToHunt
                  ? "bg-amber-100 text-amber-700 cursor-default"
                  : isAddingToHunt
                    ? "bg-amber-50 text-amber-600"
                    : "bg-amber-500 text-white hover:bg-amber-600"
              }`}
            >
              {isAddingToHunt ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : addedToHunt ? (
                <>
                  <Check className="w-4 h-4" />
                  In Hunt List
                </>
              ) : (
                <>
                  <Target className="w-4 h-4" />
                  Add to Hunt List
                </>
              )}
            </button>
          )}

          {/* Hunt List Error */}
          {huntError && (
            <p className="text-xs text-red-600 text-center mb-3">{huntError}</p>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onAddToCollection}
              className="flex-1 py-3 px-4 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              {isOffline ? "Queue to Add" : "Add to Collection"}
            </button>
            <button
              onClick={onNewLookup}
              className="py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
