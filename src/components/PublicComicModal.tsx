"use client";

import { useState } from "react";

import Image from "next/image";

import {
  Award,
  Building,
  Calendar,
  DollarSign,
  Info,
  KeyRound,
  Palette,
  PenTool,
  TrendingUp,
  User,
  X,
  ZoomIn,
} from "lucide-react";

import { CollectionItem, GRADE_SCALE } from "@/types/comic";

import { ComicImage } from "./ComicImage";

interface PublicComicModalProps {
  item: CollectionItem;
  onClose: () => void;
}

export function PublicComicModal({ item, onClose }: PublicComicModalProps) {
  const [showImageLightbox, setShowImageLightbox] = useState(false);

  const { comic } = item;

  // Get grade label
  const gradeLabel = item.conditionGrade
    ? GRADE_SCALE.find((g) => g.value === item.conditionGrade?.toString())?.label ||
      `${item.conditionGrade}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-white/90 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>

        <div className="flex flex-col md:flex-row max-h-[90vh]">
          {/* Cover Image */}
          <div className="md:w-1/3 bg-gray-100 p-6 flex items-center justify-center">
            <div
              onClick={() => item.coverImageUrl && setShowImageLightbox(true)}
              className={`aspect-[2/3] w-full max-w-[250px] rounded-lg overflow-hidden shadow-lg group relative ${item.coverImageUrl ? "cursor-pointer" : ""}`}
            >
              <ComicImage
                src={item.coverImageUrl}
                alt={`${comic.title} #${comic.issueNumber}`}
                aspectRatio="fill"
                sizes="250px"
              />
              {/* Zoom overlay on hover */}
              {item.coverImageUrl && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2">
                    <ZoomIn className="w-6 h-6 text-gray-700" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="md:w-2/3 p-6 overflow-y-auto">
            {/* Header */}
            <div className="mb-6 pr-10">
              <h2 className="text-2xl font-bold text-gray-900">{comic.title || "Unknown Title"}</h2>
              <p className="text-lg text-gray-600">
                Issue #{comic.issueNumber || "?"}
                {comic.variant && <span className="text-gray-400 ml-2">({comic.variant})</span>}
              </p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-6">
              {comic.isSlabbed && comic.gradingCompany && (
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium flex items-center gap-1">
                  <Award className="w-4 h-4" />
                  {comic.gradingCompany} {comic.grade}
                </span>
              )}
              {!comic.isSlabbed && item.conditionLabel && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center gap-1">
                  <Award className="w-4 h-4" />
                  {item.conditionLabel} {gradeLabel && `(${gradeLabel})`}
                </span>
              )}
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="flex items-center gap-2 text-sm">
                <Building className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Publisher:</span>
                <span className="font-medium text-gray-900">{comic.publisher || "Unknown"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Year:</span>
                <span className="font-medium text-gray-900">{comic.releaseYear || "Unknown"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <PenTool className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Writer:</span>
                <span className="font-medium text-gray-900">{comic.writer || "Unknown"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Palette className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Cover Artist:</span>
                <span className="font-medium text-gray-900">{comic.coverArtist || "Unknown"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Interior Artist:</span>
                <span className="font-medium text-gray-900">
                  {comic.interiorArtist || "Unknown"}
                </span>
              </div>
              {comic.isSignatureSeries && comic.signedBy && (
                <div className="flex items-center gap-2 text-sm">
                  <Award className="w-4 h-4 text-yellow-500" />
                  <span className="text-gray-600">Signed by:</span>
                  <span className="font-medium text-gray-900">{comic.signedBy}</span>
                </div>
              )}
            </div>

            {/* Key Info Section */}
            {comic.keyInfo && comic.keyInfo.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-yellow-600" />
                  Key Info
                </h3>
                <div className="flex flex-wrap gap-2">
                  {comic.keyInfo.map((info, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded text-xs"
                    >
                      {info}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Value Section */}
            {comic.priceData && comic.priceData.estimatedValue && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      Estimated Value
                    </h3>
                    <div className="flex items-baseline gap-1">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      <span className="text-2xl font-bold text-green-700">
                        {comic.priceData.estimatedValue.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    {comic.priceData.mostRecentSaleDate && (
                      <p className="text-xs text-gray-500 mt-1">
                        Most recent sale:{" "}
                        {new Date(comic.priceData.mostRecentSaleDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                  {comic.priceData.recentSales.length > 0 && comic.priceData.priceSource !== "ai" && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-1">Recent Sales</p>
                      <div className="space-y-0.5">
                        {comic.priceData.recentSales.slice(0, 3).map((sale, idx) => (
                          <p key={idx} className="text-xs text-gray-600">
                            ${sale.price.toLocaleString()}
                            <span className="text-gray-400 ml-1">
                              (
                              {new Date(sale.date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                              )
                            </span>
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {comic.priceData.disclaimer && (
                  <div className="mt-3 pt-3 border-t border-green-200">
                    <p className="text-xs text-gray-500 flex items-start gap-1">
                      <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      {comic.priceData.disclaimer}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Notes (if public) */}
            {item.notes && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Notes</h3>
                <p className="text-sm text-gray-600">{item.notes}</p>
              </div>
            )}

            {/* Date Added */}
            <p className="text-xs text-gray-400 mt-4">
              Added to collection:{" "}
              {new Date(item.dateAdded).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Image Lightbox */}
      {showImageLightbox && item.coverImageUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowImageLightbox(false)}
        >
          <button
            onClick={() => setShowImageLightbox(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <div
            className="relative max-w-full max-h-[90vh] aspect-[2/3]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={item.coverImageUrl}
              alt={`${comic.title} #${comic.issueNumber}`}
              fill
              className="object-contain rounded-lg shadow-2xl"
              sizes="90vw"
            />
          </div>
        </div>
      )}
    </div>
  );
}
