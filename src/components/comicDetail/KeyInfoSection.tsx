"use client";

import { Info, KeyRound, Plus, X } from "lucide-react";

import { ComicDetails } from "@/types/comic";

interface KeyInfoSectionProps {
  comic: ComicDetails;
  customKeyInfo: string[];
  newKeyInfo: string;
  onNewKeyInfoChange: (value: string) => void;
  onAddKeyInfo: () => void;
  onRemoveKeyInfo: (index: number) => void;
}

/**
 * Key Info field group extracted from ComicDetailsForm (R3 / M-CO15).
 * Presentational; markup verbatim. Parent owns comic state, customKeyInfo,
 * newKeyInfo, and all handlers.
 */
export function KeyInfoSection({
  comic,
  customKeyInfo,
  newKeyInfo,
  onNewKeyInfoChange,
  onAddKeyInfo,
  onRemoveKeyInfo,
}: KeyInfoSectionProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-yellow-600" />
        Key Info
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        First appearances, deaths, team changes, and other significant events
      </p>

      {/* Database Key Info (read-only) */}
      {comic.keyInfo && comic.keyInfo.length > 0 && (
        <div className="space-y-2 mb-3">
          {comic.keyInfo.map((info, index) => {
            const isVerified =
              comic.keyInfoSource === "database" || comic.keyInfoSource === "cgc";
            return (
              <div
                key={`db-${index}`}
                className={`flex items-start gap-2 p-2 rounded-lg ${
                  isVerified
                    ? "bg-yellow-50 border border-yellow-200"
                    : "bg-gray-50 border border-gray-200"
                }`}
              >
                <span className="flex-1 text-sm text-gray-700">{info}</span>
                {isVerified ? (
                  <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded">
                    Verified
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                    Technopathic
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Custom Key Info (user-added, with remove buttons) */}
      {customKeyInfo.length > 0 && (
        <div className="space-y-2 mb-3">
          {customKeyInfo.map((info, index) => (
            <div
              key={`custom-${index}`}
              className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg"
            >
              <span className="flex-1 text-sm text-gray-700">{info}</span>
              <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
                Pending
              </span>
              <button
                type="button"
                onClick={() => onRemoveKeyInfo(index)}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                aria-label="Remove key info"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add New Key Info */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newKeyInfo}
          onChange={(e) => onNewKeyInfoChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newKeyInfo.trim()) {
              e.preventDefault();
              onAddKeyInfo();
            }
          }}
          placeholder="e.g., First appearance of Venom"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900 text-sm"
        />
        <button
          type="button"
          onClick={onAddKeyInfo}
          disabled={!newKeyInfo.trim()}
          className="px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {customKeyInfo.length > 0 && (
        <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
          <Info className="w-3 h-3" />
          Custom key info is reviewed before appearing publicly
        </p>
      )}
    </div>
  );
}
