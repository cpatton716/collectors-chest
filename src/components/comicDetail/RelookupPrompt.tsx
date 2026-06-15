"use client";

import { RefreshCw } from "lucide-react";

interface RelookupPromptProps {
  pendingRelookup: { title: string; issue: string };
  onRelookup: () => void;
  onDismiss: () => void;
}

/**
 * Re-lookup prompt extracted from ComicDetailsForm (R3 / M-CO15). Shown when the
 * title/issue changes in edit mode. Presentational; markup verbatim, parent
 * keeps all state + handlers.
 */
export function RelookupPrompt({ pendingRelookup, onRelookup, onDismiss }: RelookupPromptProps) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
      <RefreshCw className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-800">Title or issue number changed</p>
        <p className="text-sm text-amber-700 mt-1">
          Would you like to look up new details for &quot;{pendingRelookup.title} #
          {pendingRelookup.issue}&quot;? This will update the publisher, year, creative team, and key
          info.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={onRelookup}
            className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Look Up New Details
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="px-3 py-1.5 bg-white text-amber-700 text-sm rounded-lg border border-amber-300 hover:bg-amber-50 transition-colors"
          >
            Keep Current Details
          </button>
        </div>
      </div>
    </div>
  );
}
