"use client";

import { KeyHuntOfflineSearch } from "@/components/KeyHuntOfflineSearch";
import { KeyHuntWishlist } from "@/components/KeyHuntWishlist";

import { CachedLookup } from "@/lib/offlineCache";

interface KeyHuntSearchFormProps {
  flow: string;
  onSelectCachedResult: (data: CachedLookup["data"]) => void;
  onBackToOptions: () => void;
}

export function KeyHuntSearchForm({
  flow,
  onSelectCachedResult,
  onBackToOptions,
}: KeyHuntSearchFormProps) {
  return (
    <>
      {/* Offline Search View */}
      {flow === "offline-search" && (
        <div className="flex-1">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">Cached Lookups</h2>
              <button onClick={onBackToOptions} className="text-amber-400 text-sm">
                Back
              </button>
            </div>
          </div>
          <KeyHuntOfflineSearch onSelectResult={onSelectCachedResult} />
        </div>
      )}

      {/* My Hunt List View */}
      {flow === "my-list" && (
        <div className="flex-1 bg-gray-50 min-h-[calc(100vh-120px)]">
          <div className="p-4 bg-white border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">My Hunt List</h2>
              <button
                onClick={onBackToOptions}
                className="text-amber-600 text-sm font-medium"
              >
                Back
              </button>
            </div>
          </div>
          <div className="p-4">
            <KeyHuntWishlist onClose={onBackToOptions} />
          </div>
        </div>
      )}
    </>
  );
}
