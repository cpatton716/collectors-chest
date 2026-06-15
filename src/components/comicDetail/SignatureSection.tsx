"use client";

import { Info, Plus, X } from "lucide-react";

interface SignatureSectionProps {
  isGraded: boolean;
  isSignatureSeries: boolean;
  signatures: string[];
  newSignature: string;
  onIsSignatureSeriesChange: (value: boolean) => void;
  onNewSignatureChange: (value: string) => void;
  onAddSignature: () => void;
  onRemoveSignature: (index: number) => void;
}

/**
 * Signatures field group extracted from ComicDetailsForm (R3 / M-CO15).
 * Presentational; markup verbatim. Parent owns all signature state + handlers.
 */
export function SignatureSection({
  isGraded,
  isSignatureSeries,
  signatures,
  newSignature,
  onIsSignatureSeriesChange,
  onNewSignatureChange,
  onAddSignature,
  onRemoveSignature,
}: SignatureSectionProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Signatures</h3>

      {isGraded && (
        <div className="mb-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isSignatureSeries}
              onChange={(e) => onIsSignatureSeriesChange(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Signature Series (Signed &amp; Authenticated)</span>
          </label>
        </div>
      )}

      {/* Signature chips */}
      {signatures.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {signatures.map((sig, index) => (
            <span
              key={`sig-${index}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-800"
            >
              {sig}
              <button
                type="button"
                onClick={() => onRemoveSignature(index)}
                className="p-0.5 text-blue-400 hover:text-red-500 transition-colors rounded-full hover:bg-blue-100"
                aria-label={`Remove ${sig}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add signature input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newSignature}
          onChange={(e) => onNewSignatureChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newSignature.trim()) {
              e.preventDefault();
              onAddSignature();
            }
          }}
          placeholder="e.g., Stan Lee"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900 text-sm"
        />
        <button
          type="button"
          onClick={onAddSignature}
          disabled={!newSignature.trim()}
          className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {!isGraded && signatures.length > 0 && (
        <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
          <Info className="w-3 h-3" />
          Unsigned raw books are valued higher when signed by notable creators
        </p>
      )}
    </div>
  );
}
