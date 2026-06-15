"use client";

import { useMemo, useState } from "react";

import { ArrowLeft, Search } from "lucide-react";

import { useModalA11y } from "@/hooks/useModalA11y";
import { CollectionItem } from "@/types/comic";

import { ComicImage } from "./ComicImage";

interface VariantsModalProps {
  title: string;
  issueNumber: string;
  year: string | null;
  variants: CollectionItem[];
  onClose: () => void;
  onSelectVariant: (item: CollectionItem) => void;
}

export function VariantsModal({
  title,
  issueNumber,
  year,
  variants,
  onClose,
  onSelectVariant,
}: VariantsModalProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { dialogProps, titleId } = useModalA11y({ isOpen: true, onClose });

  const filteredVariants = useMemo(() => {
    if (!searchTerm.trim()) return variants;
    const term = searchTerm.toLowerCase();
    return variants.filter(
      (v) =>
        v.comic.variant?.toLowerCase().includes(term) ||
        v.comic.coverArtist?.toLowerCase().includes(term)
    );
  }, [variants, searchTerm]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div
        {...dialogProps}
        className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col outline-none"
      >
        {/* Header */}
        <div className="bg-primary-600 text-white p-4">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg mb-3 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h2 id={titleId} className="text-xl sm:text-2xl font-bold">
            {title} #{issueNumber} {year && `(${year})`} Variants
          </h2>
          <p className="text-white/80 text-sm mt-1">
            {variants.length} variant{variants.length !== 1 ? "s" : ""} in your collection
          </p>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search variants..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Results: {filteredVariants.length} Issue{filteredVariants.length !== 1 ? "s" : ""} Found
          </p>
        </div>

        {/* Variants List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {filteredVariants.map((variant) => (
            <div
              key={variant.id}
              onClick={() => onSelectVariant(variant)}
              className="flex gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-primary-300 hover:shadow-md transition-all cursor-pointer"
            >
              {/* Cover Image */}
              <div className="flex-shrink-0 w-24 h-36 rounded-lg overflow-hidden">
                <ComicImage
                  src={variant.coverImageUrl}
                  alt={`${variant.comic.title} #${variant.comic.issueNumber}`}
                  aspectRatio="fill"
                  sizes="96px"
                />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900">
                  {variant.comic.title} #{variant.comic.issueNumber}
                </h3>
                <p className="text-sm text-gray-500">
                  {variant.comic.variant || "Regular Cover"}
                  {variant.comic.publisher && ` · ${variant.comic.publisher}`}
                  {variant.comic.releaseYear && ` · ${variant.comic.releaseYear}`}
                </p>

                {/* Key Info badges */}
                {variant.comic.keyInfo && variant.comic.keyInfo.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {variant.comic.keyInfo.slice(0, 2).map((info, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded text-xs"
                      >
                        {info}
                      </span>
                    ))}
                    {variant.comic.keyInfo.length > 2 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                        +{variant.comic.keyInfo.length - 2} more
                      </span>
                    )}
                  </div>
                )}

                {/* Grading info */}
                {variant.isGraded && variant.gradingCompany && (
                  <p className="text-sm text-blue-600 mt-1">
                    {variant.gradingCompany} {variant.conditionGrade}
                  </p>
                )}

                {/* Price Range */}
                {variant.comic.priceData?.estimatedValue && (
                  <div className="flex items-center gap-4 mt-3 text-sm">
                    <span className="text-gray-500">Est. Value:</span>
                    <span className="font-semibold text-green-600">
                      ${variant.comic.priceData.estimatedValue.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Right side indicator - hidden on mobile */}
              <div className="flex-shrink-0 items-center hidden sm:flex">
                <span className="text-gray-400 text-sm">View Details →</span>
              </div>
            </div>
          ))}

          {filteredVariants.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p>No variants match your search.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
