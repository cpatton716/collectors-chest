"use client";

import { Database, Info, KeyRound, Loader2 } from "lucide-react";

import { ImageUpload } from "@/components/ImageUpload";

interface KeyHuntResultsProps {
  flow: string;
  pendingComic: { title: string; issueNumber: string } | null | undefined;
  error: string | null;
  isOfflineMode: boolean;
  onCoverImageSelect: (file: File, preview: string) => void;
  onCancelToOptions: () => void;
  onNewLookup: () => void;
  onOfflineSearch: () => void;
}

export function KeyHuntResults({
  flow,
  pendingComic,
  error,
  isOfflineMode,
  onCoverImageSelect,
  onCancelToOptions,
  onNewLookup,
  onOfflineSearch,
}: KeyHuntResultsProps) {
  return (
    <>
      {/* Main content area for cover scan */}
      {flow === "cover-scan" && (
        <div className="p-4">
          <div className="text-center mb-4">
            <p className="text-lg font-medium text-gray-900">Take a photo of the cover</p>
            <p className="text-sm text-gray-600">
              We&apos;ll identify the comic and check if it&apos;s graded
            </p>
          </div>
          <ImageUpload onImageSelect={onCoverImageSelect} disabled={false} />
          {/* Foil/shiny cover tip */}
          <p className="flex items-start gap-1.5 mt-3 text-xs text-gray-400">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>For foil, holographic, or shiny covers, photograph at a slight angle to reduce glare for best results.</span>
          </p>
          <button
            onClick={onCancelToOptions}
            className="mt-4 w-full py-3 text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Analyzing state */}
      {flow === "cover-analyzing" && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center text-white">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-amber-400" />
            <p className="text-lg font-medium">Analyzing cover...</p>
            <p className="text-sm text-gray-400 mt-2">Identifying comic and checking for grade</p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {flow === "loading" && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center text-white">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-amber-400" />
            <p className="text-lg font-medium">Getting price...</p>
            <p className="text-sm text-gray-400 mt-2">
              {pendingComic?.title} #{pendingComic?.issueNumber}
            </p>
          </div>
        </div>
      )}

      {/* Error state */}
      {flow === "error" && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-lg font-medium text-white mb-2">Something went wrong</p>
            <p className="text-sm text-gray-400 mb-6">{error}</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={onNewLookup}
                className="px-6 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors"
              >
                Try Again
              </button>
              {isOfflineMode && (
                <button
                  onClick={onOfflineSearch}
                  className="px-6 py-3 bg-gray-700 text-white rounded-xl font-medium hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Database className="w-4 h-4" />
                  Search Cached Lookups
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
