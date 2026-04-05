"use client";

import { useState } from "react";

import { ChevronDown, ChevronUp, Minus, TrendingDown, TrendingUp } from "lucide-react";

import { calculateValueAtGrade } from "@/lib/gradePrice";

import { GradeEstimate, PriceData } from "@/types/comic";

interface GradePricingBreakdownProps {
  priceData: PriceData;
  currentGrade?: number | null;
  isSlabbed?: boolean;
}

export function GradePricingBreakdown({
  priceData,
  currentGrade,
  isSlabbed = false,
}: GradePricingBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!priceData.gradeEstimates || priceData.gradeEstimates.length === 0) {
    return null;
  }

  const estimates = priceData.gradeEstimates;
  const baseGrade = currentGrade || priceData.baseGrade || 9.4;
  const currentValue = calculateValueAtGrade(priceData, baseGrade, isSlabbed);

  // Get trend indicator for a grade compared to current
  const getTrend = (estimate: GradeEstimate) => {
    const value = isSlabbed ? estimate.slabbedValue : estimate.rawValue;
    if (!currentValue) return null;
    const diff = value - currentValue;
    const percent = (diff / currentValue) * 100;

    if (Math.abs(percent) < 1) {
      return { icon: Minus, color: "text-gray-400", label: "~same" };
    }
    if (diff > 0) {
      return {
        icon: TrendingUp,
        color: "text-green-600",
        label: `+${percent.toFixed(0)}%`,
      };
    }
    return {
      icon: TrendingDown,
      color: "text-red-500",
      label: `${percent.toFixed(0)}%`,
    };
  };

  return (
    <div className="mt-3 pt-3 border-t border-green-200">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="text-sm font-medium text-gray-700">Value by Grade</span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {/* Header */}
          <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-500 pb-1 border-b border-gray-200">
            <span>Grade</span>
            <span className="text-right">Raw</span>
            <span className="text-right">Slabbed</span>
            <span className="text-right">vs Current</span>
          </div>

          {/* Grade rows */}
          {estimates.map((estimate) => {
            const trend = getTrend(estimate);
            const isCurrentGrade = currentGrade && Math.abs(estimate.grade - currentGrade) < 0.1;

            return (
              <div
                key={estimate.grade}
                className={`grid grid-cols-4 gap-2 text-sm py-1.5 rounded ${
                  isCurrentGrade ? "bg-primary-50 -mx-2 px-2" : ""
                }`}
              >
                <span
                  className={`font-medium ${isCurrentGrade ? "text-primary-700" : "text-gray-700"}`}
                >
                  {estimate.grade.toFixed(1)}
                  {isCurrentGrade && <span className="ml-1 text-xs text-primary-500">(yours)</span>}
                </span>
                <span className="text-right text-gray-600">
                  ${estimate.rawValue.toLocaleString()}
                </span>
                <span className="text-right text-gray-600">
                  ${estimate.slabbedValue.toLocaleString()}
                </span>
                <span
                  className={`text-right flex items-center justify-end gap-1 ${trend?.color || "text-gray-400"}`}
                >
                  {trend && (
                    <>
                      <trend.icon className="w-3 h-3" />
                      <span className="text-xs">{trend.label}</span>
                    </>
                  )}
                </span>
              </div>
            );
          })}

          {/* Legend */}
          <div className="pt-2 mt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              <strong>Raw</strong> = ungraded copy &bull; <strong>Slabbed</strong> = professionally graded
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
