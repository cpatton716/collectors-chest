"use client";

import { useState } from "react";

import { ChevronDown, Search, X } from "lucide-react";

import { GRADE_SCALE } from "@/types/comic";

import { TitleAutocomplete } from "./TitleAutocomplete";

interface KeyHuntManualEntryProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, issueNumber: string, grade: number, years?: string) => void;
}

// Common grades for quick selection
const QUICK_GRADES = [
  { value: 9.8, label: "NM/M (9.8)" },
  { value: 9.4, label: "NM (9.4)" },
  { value: 8.0, label: "VF (8.0)" },
  { value: 6.0, label: "FN (6.0)" },
  { value: 4.0, label: "VG (4.0)" },
  { value: 2.0, label: "GD (2.0)" },
];

export function KeyHuntManualEntry({ isOpen, onClose, onSubmit }: KeyHuntManualEntryProps) {
  const [title, setTitle] = useState("");
  const [years, setYears] = useState<string | undefined>(undefined);
  const [issueNumber, setIssueNumber] = useState("");
  const [grade, setGrade] = useState<number>(9.4); // Default to NM
  const [showAllGrades, setShowAllGrades] = useState(false);

  if (!isOpen) return null;

  const handleTitleChange = (newTitle: string, newYears?: string) => {
    setTitle(newTitle);
    setYears(newYears);
  };

  const handleSubmit = () => {
    if (title.trim() && issueNumber.trim()) {
      onSubmit(title.trim(), issueNumber.trim(), grade, years);
    }
  };

  const isValid = title.trim() && issueNumber.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 mx-0 sm:mx-4 max-h-[85vh] overflow-y-auto mb-16 sm:mb-0">
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Manual Entry</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="px-6 py-4 space-y-5">
          {/* Title with Autocomplete */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Comic Title</label>
            <TitleAutocomplete
              value={title}
              onChange={handleTitleChange}
              placeholder="e.g., Amazing Spider-Man"
            />
            {years && (
              <div className="mt-2 px-3 py-2 bg-primary-50 border border-primary-200 rounded-lg">
                <p className="text-sm text-primary-700 font-medium">
                  Volume: {years}
                </p>
                <p className="text-xs text-primary-600 mt-0.5">
                  Select a different volume above if needed
                </p>
              </div>
            )}
          </div>

          {/* Issue Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Issue Number</label>
            <input
              type="text"
              value={issueNumber}
              onChange={(e) => setIssueNumber(e.target.value)}
              placeholder="e.g., 300"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900 placeholder-gray-400"
              inputMode="numeric"
            />
          </div>

          {/* Grade Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Condition Grade</label>

            {/* Quick Grade Buttons */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {QUICK_GRADES.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGrade(g.value)}
                  className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                    grade === g.value
                      ? "bg-primary-100 text-primary-700 ring-2 ring-primary-500"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            {/* Show All Grades Toggle */}
            <button
              type="button"
              onClick={() => setShowAllGrades(!showAllGrades)}
              className="flex items-center gap-1 text-sm text-primary-600 font-medium hover:text-primary-700"
            >
              {showAllGrades ? "Hide" : "More grades"}
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showAllGrades ? "rotate-180" : ""}`}
              />
            </button>

            {/* Full Grade Dropdown */}
            {showAllGrades && (
              <select
                value={grade}
                onChange={(e) => setGrade(parseFloat(e.target.value))}
                className="mt-2 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
              >
                {GRADE_SCALE.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className={`w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors ${
              isValid
                ? "bg-primary-600 text-white hover:bg-primary-700"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            <Search className="w-5 h-5" />
            Get Price
          </button>
        </div>

        {/* Safe area padding */}
        <div className="h-safe-area-inset-bottom" />
      </div>
    </div>
  );
}
