"use client";

import { DollarSign, Info, TrendingUp } from "lucide-react";

import { calculateValueAtGrade } from "@/lib/gradePrice";

import { ComicDetails } from "@/types/comic";

import { GradePricingBreakdown } from "../GradePricingBreakdown";

interface PricingSectionProps {
  comic: ComicDetails;
  grade: string;
  isGraded: boolean;
  isSignatureSeries: boolean;
}

/**
 * Estimated Value block extracted from ComicDetailsForm (R3 / M-CO15).
 * Presentational; computation + markup are verbatim from the original IIFE.
 * The parent only renders this when `comic.priceData?.estimatedValue` is truthy
 * (same guard as the original), but we keep the same internal guards too.
 */
export function PricingSection({ comic, grade, isGraded, isSignatureSeries }: PricingSectionProps) {
  if (!comic.priceData || !comic.priceData.estimatedValue) return null;

  // Calculate grade-adjusted value
  const selectedGrade = grade ? parseFloat(grade) : null;
  const gradeAdjustedValue =
    selectedGrade && comic.priceData?.gradeEstimates
      ? calculateValueAtGrade(comic.priceData, selectedGrade, isGraded)
      : comic.priceData.estimatedValue;
  const displayValue = gradeAdjustedValue || comic.priceData.estimatedValue;

  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Avg List Price
            </div>
          </h3>
          <div className="flex items-baseline gap-1">
            <DollarSign className="w-5 h-5 text-green-600" />
            <span className="text-3xl font-bold text-green-700">
              {displayValue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        {/* Recent Sales Summary */}
        {comic.priceData.recentSales?.length > 0 && (
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-1">Recent Sales</p>
            <div className="space-y-0.5">
              {comic.priceData.recentSales.slice(0, 3).map((sale, idx) => (
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
              copies. Signed/authenticated comics often command a premium depending on the signer.
            </span>
          </p>
        </div>
      )}

      {/* Disclaimer */}
      {comic.priceData.disclaimer && (
        <div className="mt-3 pt-3 border-t border-green-200">
          <p className="text-xs text-gray-500 flex items-start gap-1">
            <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
            {comic.priceData.disclaimer}
          </p>
        </div>
      )}

      {/* Grade-aware pricing breakdown */}
      <GradePricingBreakdown
        priceData={comic.priceData}
        currentGrade={selectedGrade}
        isSlabbed={isGraded}
      />
    </div>
  );
}
