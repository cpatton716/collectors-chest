"use client";

import { DollarSign, Info, TrendingUp } from "lucide-react";

import { CollectionItem, PriceData } from "@/types/comic";

import { GradePricingBreakdown } from "../GradePricingBreakdown";

interface ValueSectionProps {
  item: CollectionItem;
  effectivePriceData: PriceData | null | undefined;
  isSignatureSeries: boolean;
  isRefreshingValue: boolean;
  valueLookupMessage: string | null;
  onRefreshValue: () => void;
}

/**
 * Market-value display + lookup block extracted from ComicDetailModal
 * (R3 / M-CO15). Covers both the populated "Avg List Price" card and the
 * empty-state "Look Up Market Value" prompt. Markup verbatim; parent keeps
 * all state + the refresh handler.
 */
export function ValueSection({
  item,
  effectivePriceData,
  isSignatureSeries,
  isRefreshingValue,
  valueLookupMessage,
  onRefreshValue,
}: ValueSectionProps) {
  return (
    <>
      {/* Value Section */}
      {effectivePriceData && effectivePriceData.estimatedValue && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                Avg List Price
              </h3>
              <div className="flex items-baseline gap-1">
                <DollarSign className="w-5 h-5 text-green-600" />
                <span className="text-2xl font-bold text-green-700">
                  {effectivePriceData.estimatedValue.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
            {effectivePriceData.recentSales?.length > 0 && (
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1">Recent Sales</p>
                <div className="space-y-0.5">
                  {effectivePriceData.recentSales.slice(0, 3).map((sale, idx) => (
                    <p key={idx} className="text-xs text-gray-600">
                      ${sale.price.toLocaleString()}
                      <span className="text-gray-400 ml-1">
                        (
                        {new Date(sale.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                        )
                      </span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Signature Series Price Note */}
          {isSignatureSeries && (
            <div className="mt-3 pt-3 border-t border-blue-200 bg-blue-50 -mx-4 -mb-4 px-4 py-3 rounded-b-lg">
              <p className="text-xs text-blue-700 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <span>
                  <span className="font-semibold">Signature Series:</span> Price based on unsigned
                  copies. Signed/authenticated comics often command a premium depending on the
                  signer.
                </span>
              </p>
            </div>
          )}

          {/* Disclaimer */}
          {effectivePriceData.disclaimer && (
            <div className="mt-3 pt-3 border-t border-green-200">
              <p className="text-xs text-gray-500 flex items-start gap-1">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                {effectivePriceData.disclaimer}
              </p>
            </div>
          )}

          {/* Refresh value link */}
          <div className="mt-3 pt-3 border-t border-green-200 flex justify-end">
            <button
              type="button"
              onClick={onRefreshValue}
              disabled={isRefreshingValue}
              className="text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400 underline"
            >
              {isRefreshingValue ? "Refreshing…" : "Refresh value"}
            </button>
          </div>

          {/* Grade-aware pricing breakdown */}
          <GradePricingBreakdown
            priceData={effectivePriceData}
            currentGrade={item.conditionGrade}
            isSlabbed={item.isGraded}
          />
        </div>
      )}

      {/* No Market Value - Look Up Button */}
      {!effectivePriceData?.estimatedValue && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-center">
          <p className="text-sm text-gray-700 mb-3">No market value on file for this book yet.</p>
          <button
            type="button"
            onClick={onRefreshValue}
            disabled={isRefreshingValue}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRefreshingValue ? "Looking up…" : "Look Up Market Value"}
          </button>
          {valueLookupMessage && <p className="text-xs text-gray-600 mt-3">{valueLookupMessage}</p>}
        </div>
      )}
    </>
  );
}
