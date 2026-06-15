"use client";

import Image from "next/image";

import { ExternalLink, Loader2, Search } from "lucide-react";

interface CoverSourceSectionProps {
  coverImageUrl: string;
  coverUrlInput: string;
  isSearchingCover: boolean;
  onCoverUrlInputChange: (value: string) => void;
  onSearchCover: () => void;
  onSetCover: () => void;
}

/**
 * Cover-image source block extracted from ComicDetailsForm (R3 / M-CO15).
 * Presentational; markup verbatim. The parent owns coverImageUrl,
 * onCoverImageChange, and all the search/set handlers + state.
 *
 * The parent still guards rendering on `comic.title && onCoverImageChange`, so
 * this component assumes it is only mounted when a cover source is editable.
 */
export function CoverSourceSection({
  coverImageUrl,
  coverUrlInput,
  isSearchingCover,
  onCoverUrlInputChange,
  onSearchCover,
  onSetCover,
}: CoverSourceSectionProps) {
  return (
    <div
      className={`p-4 rounded-lg space-y-3 order-first md:order-none ${coverImageUrl ? "bg-gray-50 border border-gray-200" : "bg-blue-50 border border-blue-200"}`}
    >
      <div>
        <p className={`text-sm font-medium ${coverImageUrl ? "text-gray-900" : "text-blue-900"}`}>
          {coverImageUrl ? "Cover Image" : "Add a cover image"}
        </p>
        {!coverImageUrl && (
          <>
            <p className="text-xs text-blue-700 hidden md:block">
              Paste a cover image URL or search Google Images to find one.
            </p>
            <p className="text-xs text-blue-700 md:hidden">
              Search for the cover image, then copy and paste the URL below.
            </p>
          </>
        )}
      </div>

      {/* Show current cover with change option */}
      {coverImageUrl && (
        <div className="flex items-start gap-4">
          <div className="w-16 h-24 flex-shrink-0 rounded-md overflow-hidden bg-gray-200 shadow-sm relative">
            <Image
              src={coverImageUrl}
              alt="Current cover"
              fill
              className="object-cover"
              sizes="64px"
              unoptimized
            />
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-xs text-gray-500">Current cover image</p>
            {/* Mobile: Full-width buttons stacked */}
            <div className="md:hidden space-y-2">
              <button
                type="button"
                onClick={onSearchCover}
                disabled={isSearchingCover}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                {isSearchingCover ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Find New Cover
                <ExternalLink className="w-3 h-3" />
              </button>
              <p className="text-xs text-gray-500 text-center">
                Tap &amp; hold image → Open in new tab → Copy URL
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={coverUrlInput}
                  onChange={(e) => onCoverUrlInputChange(e.target.value)}
                  placeholder="Paste new image URL..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={onSetCover}
                  disabled={!coverUrlInput}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  Set
                </button>
              </div>
            </div>
            {/* Desktop: Inline controls */}
            <div className="hidden md:block space-y-2">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={coverUrlInput}
                  onChange={(e) => onCoverUrlInputChange(e.target.value)}
                  placeholder="Paste new image URL..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={onSetCover}
                  disabled={!coverUrlInput}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
                >
                  Update
                </button>
              </div>
              <button
                type="button"
                onClick={onSearchCover}
                disabled={isSearchingCover}
                className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800"
              >
                {isSearchingCover ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Search Google Images
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No cover yet - show add options */}
      {!coverImageUrl && (
        <>
          {/* Mobile: Search button first, then paste area */}
          <div className="md:hidden space-y-3">
            <button
              type="button"
              onClick={onSearchCover}
              disabled={isSearchingCover}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              {isSearchingCover ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Search Google Images
              <ExternalLink className="w-4 h-4" />
            </button>
            <p className="text-xs text-blue-600 text-center">
              Tap &amp; hold image → Open in new tab → Copy URL from address bar
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={coverUrlInput}
                onChange={(e) => onCoverUrlInputChange(e.target.value)}
                placeholder="Paste image URL here..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={onSetCover}
                disabled={!coverUrlInput}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                Set
              </button>
            </div>
          </div>

          {/* Desktop: URL input first, then search link */}
          <div className="hidden md:block space-y-3">
            <div className="flex gap-2">
              <input
                type="url"
                value={coverUrlInput}
                onChange={(e) => onCoverUrlInputChange(e.target.value)}
                placeholder="Paste image URL here..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={onSetCover}
                disabled={!coverUrlInput}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
              >
                Set Cover
              </button>
            </div>
            <button
              type="button"
              onClick={onSearchCover}
              disabled={isSearchingCover}
              className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800"
            >
              {isSearchingCover ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Search Google Images
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
