"use client";

import { useEffect, useRef, useState } from "react";

import { Clock, Loader2, TrendingUp } from "lucide-react";

import { expandAbbreviation, normalizeSearchQuery } from "@/lib/titleNormalization";

const RECENT_TITLES_KEY = "comic-tracker-recent-titles-v2";
const MAX_RECENT_TITLES = 5;

export interface TitleSuggestion {
  title: string;
  years: string;
  publisher?: string;
}

interface TitleAutocompleteProps {
  value: string;
  onChange: (value: string, years?: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

// Helper to get recent titles from localStorage
const getRecentTitles = (): TitleSuggestion[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_TITLES_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    // Handle migration from old string[] format
    if (Array.isArray(parsed)) {
      return parsed.map((item: string | TitleSuggestion) => {
        if (typeof item === "string") {
          return { title: item, years: "" };
        }
        return item;
      });
    }
    return [];
  } catch {
    return [];
  }
};

// Helper to save a title to recent searches
const saveRecentTitle = (suggestion: TitleSuggestion) => {
  if (typeof window === "undefined") return;
  try {
    const recent = getRecentTitles();
    // Remove if already exists (matching both title and years), then add to front
    const filtered = recent.filter(
      (t) =>
        !(t.title.toLowerCase() === suggestion.title.toLowerCase() && t.years === suggestion.years)
    );
    const updated = [suggestion, ...filtered].slice(0, MAX_RECENT_TITLES);
    localStorage.setItem(RECENT_TITLES_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
};

export function TitleAutocomplete({
  value,
  onChange,
  placeholder = "e.g., Amazing Spider-Man",
  required = false,
  className = "",
}: TitleAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<TitleSuggestion[]>([]);
  const [recentTitles, setRecentTitles] = useState<TitleSuggestion[]>([]);
  const [popularTitles, setPopularTitles] = useState<
    Array<{ title: string; publisher: string | null }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [hasFocused, setHasFocused] = useState(false);
  const [expandedFrom, setExpandedFrom] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load recent titles on mount
  useEffect(() => {
    setRecentTitles(getRecentTitles());
  }, []);

  // Fetch popular titles on mount
  useEffect(() => {
    fetch("/api/titles/popular")
      .then((res) => res.json())
      .then((data) => setPopularTitles(data.titles || []))
      .catch(() => {});
  }, []);

  // Fetch suggestions when value changes (only if user has focused)
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Don't fetch suggestions if user hasn't focused on the input yet
    if (!hasFocused) {
      return;
    }

    if (!value || value.length < 2) {
      setSuggestions([]);
      // Keep dropdown open if we have popular titles or recent titles to show
      if (!recentTitles.length && popularTitles.length < 5) {
        setShowDropdown(false);
      }
      return;
    }

    // Clear stale suggestions immediately when input changes
    setSuggestions([]);

    const expanded = expandAbbreviation(value);
    setExpandedFrom(expanded ? value.trim() : null);

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/titles/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: normalizeSearchQuery(value) }),
        });

        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);
          setShowDropdown(data.suggestions?.length > 0);
          setHighlightedIndex(-1);
        }
      } catch (error) {
        console.error("Error fetching suggestions:", error);
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, hasFocused, recentTitles.length, popularTitles.length]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get filtered recent titles that match current input
  const getFilteredRecent = (): TitleSuggestion[] => {
    if (!value || value.length < 2) return recentTitles;
    const query = value.toLowerCase();
    return recentTitles.filter((t) => t.title.toLowerCase().includes(query));
  };

  // Determine if we should show the popular section
  const showPopular = value.length < 2 && popularTitles.length >= 5;

  // Filter popular titles to exclude any that appear in recent titles
  const filteredPopular = showPopular
    ? popularTitles
        .filter(
          (p) =>
            !recentTitles.some((r) => r.title.toLowerCase() === p.title.toLowerCase())
        )
        .slice(0, 8)
    : [];

  // Combine recent titles with API suggestions, removing duplicates
  const filteredRecent = getFilteredRecent();
  const apiSuggestionsFiltered = suggestions
    .filter(
      (s) =>
        !filteredRecent.some(
          (r) => r.title.toLowerCase() === s.title.toLowerCase() && r.years === s.years
        )
    )
    .sort((a, b) => a.title.localeCompare(b.title)); // Sort alphabetically by title
  const allSuggestions: TitleSuggestion[] = [...filteredRecent, ...filteredPopular.map((p) => ({ title: p.title, years: "", publisher: p.publisher ?? undefined })), ...apiSuggestionsFiltered];
  const hasAnySuggestions = allSuggestions.length > 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || allSuggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < allSuggestions.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < allSuggestions.length) {
          handleSelect(allSuggestions[highlightedIndex]);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        break;
    }
  };

  const handleSelect = (suggestion: TitleSuggestion) => {
    onChange(suggestion.title, suggestion.years);
    setShowDropdown(false);
    setSuggestions([]);
    // Save to recent titles
    saveRecentTitle(suggestion);
    setRecentTitles(getRecentTitles());
  };

  // Helper to format display text with years
  const formatSuggestion = (suggestion: TitleSuggestion): string => {
    if (suggestion.years) {
      return `${suggestion.title} (${suggestion.years})`;
    }
    return suggestion.title;
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            setHasFocused(true);
            // Show dropdown if we have suggestions, recent titles, or popular titles
            if (hasAnySuggestions || recentTitles.length > 0 || popularTitles.length >= 5)
              setShowDropdown(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900 ${className}`}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          </div>
        )}
      </div>

      {showDropdown && hasAnySuggestions && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {/* Abbreviation expansion hint */}
          {expandedFrom && (
            <div className="px-3 py-1.5 text-xs text-gray-500 bg-gray-50 border-b border-gray-100">
              Searching for &ldquo;{normalizeSearchQuery(expandedFrom)}&rdquo;
            </div>
          )}

          {/* Recent titles section */}
          {filteredRecent.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-100 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Recent
              </div>
              {filteredRecent.map((suggestion, index) => (
                <button
                  key={`recent-${suggestion.title}-${suggestion.years}`}
                  type="button"
                  onClick={() => handleSelect(suggestion)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors flex items-center gap-2 ${
                    index === highlightedIndex ? "bg-gray-100" : ""
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="flex-1">
                    <span className="text-gray-900">{suggestion.title}</span>
                    {suggestion.years && (
                      <span className="text-gray-500 ml-1.5">({suggestion.years})</span>
                    )}
                  </span>
                </button>
              ))}
            </>
          )}

          {/* Popular titles section */}
          {filteredPopular.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-100 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Popular
              </div>
              {filteredPopular.map((popular, index) => {
                const globalIndex = filteredRecent.length + index;
                return (
                  <button
                    key={`popular-${popular.title}`}
                    type="button"
                    onClick={() =>
                      handleSelect({ title: popular.title, years: "", publisher: popular.publisher ?? undefined })
                    }
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors flex items-center gap-2 ${
                      globalIndex === highlightedIndex ? "bg-gray-100" : ""
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="flex-1">
                      <span className="text-gray-900">{popular.title}</span>
                      {popular.publisher && (
                        <span className="text-gray-400 ml-1.5 text-xs">{popular.publisher}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </>
          )}

          {/* API suggestions section */}
          {apiSuggestionsFiltered.length > 0 && (
            <>
              {filteredRecent.length > 0 && (
                <div className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 border-y border-gray-100">
                  Suggestions
                </div>
              )}
              {apiSuggestionsFiltered.map((suggestion, index) => {
                const globalIndex = filteredRecent.length + filteredPopular.length + index;
                // Check if there are multiple runs of the same title to show volume indicator
                const sameTitle = apiSuggestionsFiltered.filter(
                  (s) => s.title.toLowerCase() === suggestion.title.toLowerCase()
                );
                const isMultiVolume = sameTitle.length > 1;
                const volumeIndex = isMultiVolume
                  ? sameTitle.findIndex((s) => s.years === suggestion.years) + 1
                  : null;
                return (
                  <button
                    key={`${suggestion.title}-${suggestion.years}`}
                    type="button"
                    onClick={() => handleSelect(suggestion)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                      globalIndex === highlightedIndex ? "bg-gray-100" : ""
                    } ${globalIndex === allSuggestions.length - 1 ? "rounded-b-lg" : ""}`}
                  >
                    <span className="text-gray-900">{suggestion.title}</span>
                    {suggestion.years && (
                      <span className="text-gray-500 ml-1.5">
                        {isMultiVolume && volumeIndex ? `Vol. ${volumeIndex} ` : ""}({suggestion.years})
                      </span>
                    )}
                    {suggestion.publisher && (
                      <span className="text-gray-400 ml-1.5 text-xs">{suggestion.publisher}</span>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
