"use client";

import { useState } from "react";

import { Clock, Gauge, Minus, Plus, RotateCcw, TrendingDown, TrendingUp, X } from "lucide-react";

import { KeyHuntHistoryEntry } from "@/lib/offlineCache";

import { ComicImage } from "./ComicImage";
import { GradeSelector } from "./GradeSelector";

interface KeyHuntHistoryDetailProps {
  entry: KeyHuntHistoryEntry;
  onClose: () => void;
  onLookupAgain: (title: string, issueNumber: string, grade: number) => void;
  onAddToCollection: (entry: KeyHuntHistoryEntry) => void;
  isOffline?: boolean;
}

export function KeyHuntHistoryDetail({
  entry,
  onClose,
  onLookupAgain,
  onAddToCollection,
  isOffline = false,
}: KeyHuntHistoryDetailProps) {
  const [showGradeSelector, setShowGradeSelector] = useState(false);

  const formatPrice = (price: number | null) => {
    if (price === null) return "N/A";
    return `$${price.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatGrade = (g: number) => {
    if (g >= 9.8) return `${g} (NM/M)`;
    if (g >= 9.4) return `${g} (NM)`;
    if (g >= 8.0) return `${g} (VF)`;
    if (g >= 6.0) return `${g} (FN)`;
    if (g >= 4.0) return `${g} (VG)`;
    return `${g} (GD)`;
  };

  // Calculate if recent sale differs significantly from average
  const getRecentSaleStatus = () => {
    const recentSale = entry.priceResult.recentSale;
    const averagePrice = entry.priceResult.rawPrice;
    if (!recentSale || !averagePrice || averagePrice === 0) return "normal";

    const percentDiff = ((recentSale.price - averagePrice) / averagePrice) * 100;

    if (percentDiff >= 20) return "high";
    if (percentDiff <= -20) return "low";
    return "normal";
  };

  const recentSaleStatus = getRecentSaleStatus();

  const handleLookupAgain = () => {
    onLookupAgain(entry.title, entry.issueNumber, entry.grade);
  };

  const handleDifferentGrade = (grade: number) => {
    setShowGradeSelector(false);
    onLookupAgain(entry.title, entry.issueNumber, grade);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/70 animate-in fade-in duration-200"
          onClick={onClose}
        />

        {/* Detail Card */}
        <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl animate-in zoom-in-95 fade-in duration-300 overflow-hidden max-h-[90vh] overflow-y-auto">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/30 rounded-full transition-colors z-10"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {/* History Badge */}
          <div className="absolute top-4 left-4 z-10">
            <span className="flex items-center gap-1 px-2 py-1 bg-gray-800/80 rounded-full text-xs font-medium text-white">
              <Clock className="w-3 h-3" />
              History
            </span>
          </div>

          {/* Cover Image or Gradient Header */}
          <div className="relative h-40 bg-gradient-to-br from-primary-500 to-primary-700">
            {entry.coverImageUrl && (
              <div className="absolute inset-0 opacity-40">
                <ComicImage
                  src={entry.coverImageUrl}
                  alt={`${entry.title} #${entry.issueNumber}`}
                  aspectRatio="fill"
                  sizes="400px"
                />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <h2 className="text-xl font-bold text-white truncate">{entry.title}</h2>
              <p className="text-white/80">
                Issue #{entry.issueNumber}
                {entry.variant && <span className="text-white/60"> - {entry.variant}</span>}
              </p>
              {entry.publisher && <p className="text-white/60 text-sm">{entry.publisher}</p>}
            </div>
          </div>

          {/* Price Info */}
          <div className="p-6">
            {/* Grade & Slabbed Badge */}
            <div className="flex justify-center gap-2 mb-4">
              <span className="px-4 py-1.5 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
                Grade: {formatGrade(entry.grade)}
              </span>
              {entry.isSlabbed && (
                <span className="px-3 py-1.5 bg-amber-100 rounded-full text-sm font-medium text-amber-700">
                  Slabbed
                </span>
              )}
            </div>

            {/* Average Price */}
            <div className="text-center mb-6">
              <p className="text-sm text-gray-500 mb-1">Listed Value</p>
              <p className="text-4xl font-bold text-gray-900">
                {formatPrice(entry.priceResult.rawPrice)}
              </p>
              <p className="text-xs text-gray-400 mt-2 flex items-center justify-center gap-1">
                <Clock className="w-3 h-3" />
                Looked up {formatTimestamp(entry.timestamp)}
              </p>
            </div>

            {/* Recent Sale */}
            {entry.priceResult.recentSale && (
              <div
                className={`rounded-xl p-4 mb-6 ${
                  recentSaleStatus === "high"
                    ? "bg-red-50 border border-red-200"
                    : recentSaleStatus === "low"
                      ? "bg-green-50 border border-green-200"
                      : "bg-gray-50 border border-gray-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p
                      className={`text-xs font-medium mb-1 ${
                        recentSaleStatus === "high"
                          ? "text-red-600"
                          : recentSaleStatus === "low"
                            ? "text-green-600"
                            : "text-gray-500"
                      }`}
                    >
                      Most Recent Sale
                    </p>
                    <p
                      className={`text-xl font-bold ${
                        recentSaleStatus === "high"
                          ? "text-red-700"
                          : recentSaleStatus === "low"
                            ? "text-green-700"
                            : "text-gray-900"
                      }`}
                    >
                      {formatPrice(entry.priceResult.recentSale.price)}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(entry.priceResult.recentSale.date)}
                    </p>
                  </div>
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      recentSaleStatus === "high"
                        ? "bg-red-100"
                        : recentSaleStatus === "low"
                          ? "bg-green-100"
                          : "bg-gray-100"
                    }`}
                  >
                    {recentSaleStatus === "high" ? (
                      <TrendingUp className="w-5 h-5 text-red-600" />
                    ) : recentSaleStatus === "low" ? (
                      <TrendingDown className="w-5 h-5 text-green-600" />
                    ) : (
                      <Minus className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Add to Collection */}
              <button
                onClick={() => onAddToCollection(entry)}
                className="w-full py-3 px-4 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add to Collection
              </button>

              {/* Lookup Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleLookupAgain}
                  disabled={isOffline}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${
                    isOffline
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  Refresh
                </button>
                <button
                  onClick={() => setShowGradeSelector(true)}
                  disabled={isOffline}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${
                    isOffline
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <Gauge className="w-4 h-4" />
                  New Grade
                </button>
              </div>

              {isOffline && (
                <p className="text-xs text-center text-amber-600">
                  Connect to internet for fresh lookups
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grade Selector */}
      <GradeSelector
        isOpen={showGradeSelector}
        onClose={() => setShowGradeSelector(false)}
        onSelect={handleDifferentGrade}
        comicTitle={entry.title}
        issueNumber={entry.issueNumber}
        preselectedGrade={entry.grade}
      />
    </>
  );
}
