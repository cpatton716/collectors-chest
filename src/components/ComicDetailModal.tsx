"use client";

import { useEffect, useMemo, useState } from "react";

import Image from "next/image";

import {
  AlertTriangle,
  ArrowLeftRight,
  Award,
  Building,
  Calendar,
  Check,
  CheckCircle,
  DollarSign,
  ExternalLink,
  Eye,
  FileCheck,
  Info,
  KeyRound,
  Layers,
  ListPlus,
  PackageMinus,
  Palette,
  PenTool,
  Pencil,
  Plus,
  Star,
  Store,
  Tag,
  Trash2,
  TrendingUp,
  User,
  X,
  ZoomIn,
} from "lucide-react";

import { CollectionItem, GRADE_SCALE, PriceData, UserList } from "@/types/comic";

import { ComicImage } from "./ComicImage";
import { GradePricingBreakdown } from "./GradePricingBreakdown";
import { SuggestKeyInfoModal } from "./SuggestKeyInfoModal";
import { VariantsModal } from "./VariantsModal";
import { ListInShopModal } from "./auction/ListInShopModal";

// Helper to generate certification verification URLs
function getCertVerificationUrl(certNumber: string, gradingCompany: string): string | null {
  if (!certNumber || !gradingCompany) return null;

  switch (gradingCompany.toUpperCase()) {
    case "CGC":
      return `https://www.cgccomics.com/certlookup/${certNumber}`;
    case "CBCS":
      return `https://cbcscomics.com/grading-notes/${certNumber}`;
    case "PGX":
      return `https://www.pgxcomics.com/certverification/pgxlabel.aspx?CertNo=${certNumber}`;
    default:
      return null;
  }
}

interface ComicDetailModalProps {
  item: CollectionItem;
  lists: UserList[];
  collection: CollectionItem[];
  onClose: () => void;
  onRemove: (id: string) => void;
  onAddToList: (itemId: string, listId: string) => void;
  onRemoveFromList: (itemId: string, listId: string) => void;
  onCreateList: (name: string) => UserList | Promise<UserList>;
  onMarkSold: (itemId: string, salePrice: number, buyerId?: string) => void;
  onToggleStar: (itemId: string) => void;
  onEdit: (item: CollectionItem) => void;
  onViewItem?: (item: CollectionItem) => void;
  onListInShop?: () => void; // Called after successfully listing in shop
}

export function ComicDetailModal({
  item,
  lists,
  collection,
  onClose,
  onRemove,
  onAddToList,
  onRemoveFromList,
  onCreateList,
  onMarkSold,
  onToggleStar,
  onEdit,
  onViewItem,
  onListInShop,
}: ComicDetailModalProps) {
  const [showListMenu, setShowListMenu] = useState(false);
  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [activeListingWarning, setActiveListingWarning] = useState(false);
  const [showSoldConfirm, setShowSoldConfirm] = useState(false);
  const [showVariantsModal, setShowVariantsModal] = useState(false);
  const [showImageLightbox, setShowImageLightbox] = useState(false);
  const [showListInShopModal, setShowListInShopModal] = useState(false);
  const [showSuggestKeyInfoModal, setShowSuggestKeyInfoModal] = useState(false);
  const [salePrice, setSalePrice] = useState<string>(
    item.askingPrice?.toString() || item.comic.priceData?.estimatedValue?.toString() || ""
  );
  const [activeListing, setActiveListing] = useState<{
    id: string;
    listingType: string;
    bidCount?: number;
  } | null>(null);
  const [showSellerAction, setShowSellerAction] = useState<
    "mark_as_sold" | "pull_off_shelf" | null
  >(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isForTrade, setIsForTrade] = useState(item.forTrade || false);
  const [isUpdatingTrade, setIsUpdatingTrade] = useState(false);
  const [localPriceData, setLocalPriceData] = useState<PriceData | null>(null);
  const [isRefreshingValue, setIsRefreshingValue] = useState(false);
  const [valueLookupMessage, setValueLookupMessage] = useState<string | null>(null);

  const { comic } = item;
  const effectivePriceData = localPriceData ?? comic.priceData;

  // Check if this comic has an active listing
  useEffect(() => {
    async function checkActiveListing() {
      try {
        const response = await fetch(`/api/auctions/by-comic/${item.id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.listing) {
            setActiveListing({
              id: data.listing.id,
              listingType: data.listing.listingType,
              bidCount: data.listing.bidCount || 0,
            });
          }
        }
      } catch {
        // Ignore errors - just means we can't check listing status
      }
    }
    checkActiveListing();
  }, [item.id]);

  // Handle seller actions (Mark as Sold, Pull off Shelf)
  const handleSellerAction = async (action: "mark_as_sold" | "pull_off_shelf") => {
    if (!activeListing) return;

    setIsProcessingAction(true);
    setActionError(null);
    try {
      // Cancel/remove the listing
      const reason = action === "mark_as_sold" ? "sold_elsewhere" : "changed_mind";
      const response = await fetch(`/api/auctions/${activeListing.id}?reason=${reason}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to process request");
      }

      // If "Mark as Sold", also remove the comic from collection
      if (action === "mark_as_sold") {
        onRemove(item.id);
      }

      setShowSellerAction(null);
      setActiveListing(null);
      onClose();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to process request");
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle market value lookup / refresh
  const handleRefreshValue = async () => {
    setIsRefreshingValue(true);
    setValueLookupMessage(null);
    try {
      const response = await fetch(`/api/comics/${item.id}/refresh-value`, {
        method: "POST",
      });
      const data = await response.json();
      if (response.ok && data.success) {
        if (data.priceData) {
          setLocalPriceData(data.priceData);
          setValueLookupMessage(null);
        } else {
          setValueLookupMessage(data.message || "No eBay sales data found for this comic.");
        }
      } else {
        setValueLookupMessage(
          data.message || "Couldn't reach the market data service. Try again later."
        );
      }
    } catch {
      setValueLookupMessage("Couldn't reach the market data service. Try again later.");
    } finally {
      setIsRefreshingValue(false);
    }
  };

  // Find all variants of this title/issue in the collection
  const variants = useMemo(() => {
    if (!comic.title || !comic.issueNumber) return [];
    return collection.filter(
      (c) =>
        c.comic.title?.toLowerCase() === comic.title?.toLowerCase() &&
        c.comic.issueNumber === comic.issueNumber
    );
  }, [collection, comic.title, comic.issueNumber]);

  const variantCount = variants.length;

  // Get custom lists (non-default)
  const customLists = lists.filter((l) => !l.isDefault);
  const hasCustomLists = customLists.length > 0;

  // Get grade label
  const gradeLabel = item.conditionGrade
    ? GRADE_SCALE.find((g) => g.value === item.conditionGrade?.toString())?.label ||
      `${item.conditionGrade}`
    : null;

  const handleCreateList = async () => {
    if (newListName.trim()) {
      const newList = await onCreateList(newListName.trim());
      onAddToList(item.id, newList.id);
      setNewListName("");
      setShowCreateList(false);
      setShowListMenu(false);
    }
  };

  const handleRemove = async () => {
    try {
      await onRemove(item.id);
      onClose();
    } catch (err) {
      if (err instanceof Error && (err as Error & { code?: string }).code === "active_listing") {
        setActiveListingWarning(true);
        setShowRemoveConfirm(false);
      }
    }
  };

  const handleMarkSold = () => {
    const price = parseFloat(salePrice);
    if (isNaN(price) || price <= 0) {
      return; // Don't proceed without a valid price
    }
    onMarkSold(item.id, price);
    onClose();
  };

  const isInList = (listId: string) => item.listIds.includes(listId);

  const handleToggleForTrade = async () => {
    setIsUpdatingTrade(true);
    try {
      const response = await fetch(`/api/comics/${item.id}/for-trade`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forTrade: !isForTrade }),
      });
      if (response.ok) {
        setIsForTrade(!isForTrade);
      }
    } catch (error) {
      console.error("Error toggling for trade:", error);
    } finally {
      setIsUpdatingTrade(false);
    }
  };

  const toggleList = (listId: string) => {
    if (isInList(listId)) {
      onRemoveFromList(item.id, listId);
    } else {
      onAddToList(item.id, listId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-white/90 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>

        <div className="flex flex-col md:flex-row max-h-[90vh]">
          {/* Cover Image - Hidden on mobile, shown on desktop */}
          <div className="hidden md:flex md:w-1/3 bg-gray-100 p-6 items-center justify-center">
            <div
              onClick={() => item.coverImageUrl && setShowImageLightbox(true)}
              className={`aspect-[2/3] w-full max-w-[250px] rounded-lg overflow-hidden shadow-lg relative ${item.coverImageUrl ? "cursor-pointer group" : ""}`}
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
          <div className="md:w-2/3 p-4 md:p-6 overflow-y-auto">
            {/* Mobile Header with Cover Thumbnail */}
            <div className="md:hidden flex gap-4 mb-4 pr-8">
              {/* Mobile Cover Thumbnail */}
              <div
                onClick={() => item.coverImageUrl && setShowImageLightbox(true)}
                className={`flex-shrink-0 w-20 h-30 rounded-lg overflow-hidden shadow-md ${item.coverImageUrl ? "cursor-pointer" : ""}`}
              >
                <ComicImage
                  src={item.coverImageUrl}
                  alt={`${comic.title} #${comic.issueNumber}`}
                  aspectRatio="fill"
                  sizes="80px"
                />
              </div>
              {/* Mobile Title Info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-gray-900 leading-tight">
                  {comic.title || "Unknown Title"}
                </h2>
                <p className="text-base text-gray-600">Issue #{comic.issueNumber || "?"}</p>
                {comic.variant && <p className="text-sm text-gray-400">{comic.variant}</p>}
                {variantCount > 1 && (
                  <button
                    onClick={() => setShowVariantsModal(true)}
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    <Layers className="w-3 h-3" />
                    View Variants ({variantCount})
                  </button>
                )}
              </div>
            </div>

            {/* Desktop Header */}
            <div className="hidden md:block mb-6 pr-10">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {comic.title || "Unknown Title"}
                  </h2>
                  <p className="text-lg text-gray-600">
                    Issue #{comic.issueNumber || "?"}
                    {comic.variant && <span className="text-gray-400 ml-2">({comic.variant})</span>}
                  </p>
                  {/* View Variants Link */}
                  {variantCount > 1 && (
                    <button
                      onClick={() => setShowVariantsModal(true)}
                      className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      <Layers className="w-4 h-4" />
                      View Variants ({variantCount})
                    </button>
                  )}
                </div>
                <button
                  onClick={() => onToggleStar(item.id)}
                  className={`p-2 rounded-full transition-colors flex-shrink-0 ${
                    item.isStarred
                      ? "bg-yellow-100 text-yellow-500 hover:bg-yellow-200"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-yellow-500"
                  }`}
                  title={item.isStarred ? "Remove from favorites" : "Add to favorites"}
                >
                  <Star className={`w-6 h-6 ${item.isStarred ? "fill-yellow-500" : ""}`} />
                </button>
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-6">
              {item.isGraded && item.gradingCompany && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center gap-1">
                  <Award className="w-4 h-4" />
                  {item.gradingCompany} {gradeLabel}
                </span>
              )}
              {item.forSale && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-1">
                  <Tag className="w-4 h-4" />
                  For Sale - ${item.askingPrice?.toFixed(2)}
                </span>
              )}
            </div>

            {/* Grading Details Section - only show for graded books */}
            {item.isGraded &&
              (comic.certificationNumber ||
                comic.pageQuality ||
                comic.gradeDate ||
                comic.graderNotes) && (
                <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <FileCheck className="w-4 h-4" />
                    Grading Details
                  </h3>
                  <div className="space-y-3">
                    {/* Certification Number with Link */}
                    {comic.certificationNumber && item.gradingCompany && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Certification #</p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-slate-700">
                            {comic.certificationNumber}
                          </span>
                          {getCertVerificationUrl(
                            comic.certificationNumber,
                            item.gradingCompany
                          ) && (
                            <a
                              href={
                                getCertVerificationUrl(
                                  comic.certificationNumber,
                                  item.gradingCompany
                                ) || "#"
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Verify
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Page Quality */}
                    {comic.pageQuality && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Page Quality</p>
                        <p className="text-sm text-slate-700">{comic.pageQuality}</p>
                      </div>
                    )}

                    {/* Grade Date */}
                    {comic.gradeDate && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Grade Date</p>
                        <p className="text-sm text-slate-700">{comic.gradeDate}</p>
                      </div>
                    )}

                    {/* Grader Notes */}
                    {comic.graderNotes && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Grader Notes</p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">
                          {comic.graderNotes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-yellow-600" />
                  Key Info
                </h3>
                <button
                  onClick={() => setShowSuggestKeyInfoModal(true)}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Suggest
                </button>
              </div>
              {(comic.keyInfo && comic.keyInfo.length > 0) || (item.customKeyInfo && item.customKeyInfo.length > 0) ? (
                <div className="flex flex-wrap gap-2">
                  {/* Key info — show source badge */}
                  {comic.keyInfo?.map((info, idx) => {
                    const isVerified = comic.keyInfoSource === "database" || comic.keyInfoSource === "cgc";
                    return (
                      <span
                        key={`db-${idx}`}
                        className={`px-2 py-1 rounded text-xs ${
                          isVerified
                            ? "bg-yellow-50 border border-yellow-200 text-yellow-800"
                            : "bg-gray-50 border border-gray-200 text-gray-600"
                        }`}
                      >
                        {info}
                      </span>
                    );
                  })}
                  {/* Custom key info (pending review, only visible to owner) */}
                  {item.customKeyInfo?.map((info, idx) => (
                    <span
                      key={`custom-${idx}`}
                      className="px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded text-xs flex items-center gap-1"
                    >
                      {info}
                      <span className="text-[10px] text-amber-500">(pending)</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  No key info recorded. Know something about this issue?{" "}
                  <button
                    onClick={() => setShowSuggestKeyInfoModal(true)}
                    className="text-primary-600 hover:underline"
                  >
                    Suggest key info
                  </button>
                </p>
              )}
            </div>

            {/* Value Section */}
            {effectivePriceData && effectivePriceData.estimatedValue && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      Avg List Price
                    </h3>
                    <div className="flex items-baseline gap-1">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      <span className="text-2xl font-bold text-green-700">
                        {effectivePriceData.estimatedValue.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                  {effectivePriceData.recentSales?.length > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-1">Recent Sales</p>
                      <div className="space-y-0.5">
                        {effectivePriceData.recentSales.slice(0, 3).map((sale, idx) => (
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
                {/* Signature Series Price Note */}
                {comic.isSignatureSeries && (
                  <div
                    className="mt-3 pt-3 border-t border-blue-200 bg-blue-50 -mx-4 -mb-4 px-4 py-3 rounded-b-lg"
                  >
                    <p className="text-xs text-blue-700 flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span>
                        <span className="font-semibold">Signature Series:</span> Price based on
                        unsigned copies. Signed/authenticated comics often command a premium
                        depending on the signer.
                      </span>
                    </p>
                  </div>
                )}

                {/* Disclaimer */}
                {effectivePriceData.disclaimer && (
                  <div className="mt-3 pt-3 border-t border-green-200">
                    <p className="text-xs text-gray-500 flex items-start gap-1">
                      <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      {effectivePriceData.disclaimer}
                    </p>
                  </div>
                )}

                {/* Refresh value link */}
                <div className="mt-3 pt-3 border-t border-green-200 flex justify-end">
                  <button
                    type="button"
                    onClick={handleRefreshValue}
                    disabled={isRefreshingValue}
                    className="text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400 underline"
                  >
                    {isRefreshingValue ? "Refreshing…" : "Refresh value"}
                  </button>
                </div>

                {/* Grade-aware pricing breakdown */}
                <GradePricingBreakdown
                  priceData={effectivePriceData}
                  currentGrade={item.conditionGrade}
                  isSlabbed={item.isGraded}
                />
              </div>
            )}

            {/* No Market Value — Look Up Button */}
            {!effectivePriceData?.estimatedValue && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-center">
                <p className="text-sm text-gray-700 mb-3">No market value on file for this book yet.</p>
                <button
                  type="button"
                  onClick={handleRefreshValue}
                  disabled={isRefreshingValue}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRefreshingValue ? "Looking up…" : "Look Up Market Value"}
                </button>
                {valueLookupMessage && (
                  <p className="text-xs text-gray-600 mt-3">{valueLookupMessage}</p>
                )}
              </div>
            )}

            {/* Purchase Info & Profit/Loss */}
            {item.purchasePrice && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Investment Summary</h3>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Purchase Price:</span>
                    <span className="font-medium text-gray-900">
                      ${item.purchasePrice.toFixed(2)}
                    </span>
                  </div>
                  {effectivePriceData?.estimatedValue && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Current Value:</span>
                        <span className="font-medium text-gray-900">
                          ${effectivePriceData.estimatedValue.toFixed(2)}
                        </span>
                      </div>
                      <div className="border-t pt-2 flex justify-between text-sm">
                        <span className="text-gray-600 font-medium">Profit/Loss:</span>
                        {(() => {
                          const profitLoss = effectivePriceData.estimatedValue - item.purchasePrice;
                          const profitPercent = (profitLoss / item.purchasePrice) * 100;
                          return (
                            <span
                              className={`font-bold ${profitLoss >= 0 ? "text-green-600" : "text-red-600"}`}
                            >
                              {profitLoss >= 0 ? "+" : ""}${profitLoss.toFixed(2)}
                              <span className="text-xs font-normal ml-1">
                                ({profitPercent >= 0 ? "+" : ""}
                                {profitPercent.toFixed(1)}%)
                              </span>
                            </span>
                          );
                        })()}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {item.notes && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Notes</h3>
                <p className="text-sm text-gray-600">{item.notes}</p>
              </div>
            )}

            {/* Lists */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">In Lists</h3>
              <div className="flex flex-wrap gap-2">
                {lists
                  .filter((l) => item.listIds.includes(l.id))
                  .map((list) => (
                    <span
                      key={list.id}
                      className={`px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs flex items-center gap-1 ${
                        list.id !== "collection" ? "pr-1" : ""
                      }`}
                    >
                      {list.name}
                      {list.id !== "collection" && (
                        <button
                          onClick={() => onRemoveFromList(item.id, list.id)}
                          className="ml-1 p-0.5 hover:bg-gray-200 rounded-full text-gray-500 hover:text-red-500 transition-colors"
                          title={`Remove from ${list.name}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
              </div>
            </div>

            {/* Action Buttons - Mobile-friendly layout */}
            <div className="pt-4 border-t space-y-3">
              {/* Primary CTA - List in Shop / View Listing */}
              {activeListing ? (
                <>
                  <a
                    href={`/shop?listing=${activeListing.id}&tab=${activeListing.listingType === "auction" ? "auctions" : "buy-now"}`}
                    className="w-full px-4 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-semibold text-lg"
                  >
                    <Eye className="w-6 h-6" />
                    View Listing
                  </a>

                  {/* Seller Controls for active listing */}
                  <div className="flex gap-2">
                    {/* Mark as Sold - only for fixed_price */}
                    {activeListing.listingType === "fixed_price" && (
                      <button
                        onClick={() => setShowSellerAction("mark_as_sold")}
                        className="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors flex items-center justify-center gap-1.5 text-sm font-medium"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Mark as Sold
                      </button>
                    )}
                    {/* Pull off the Shelf */}
                    <button
                      onClick={() => setShowSellerAction("pull_off_shelf")}
                      disabled={
                        activeListing.listingType === "auction" && (activeListing.bidCount || 0) > 0
                      }
                      className={`flex-1 px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 text-sm font-medium ${
                        activeListing.listingType === "auction" && (activeListing.bidCount || 0) > 0
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      title={
                        activeListing.listingType === "auction" && (activeListing.bidCount || 0) > 0
                          ? "Cannot remove auction with bids"
                          : undefined
                      }
                    >
                      <PackageMinus className="w-4 h-4" />
                      Pull off Shelf
                    </button>
                  </div>

                  {/* Seller Action Confirmation */}
                  {showSellerAction && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h5 className="font-medium text-amber-800">
                            {showSellerAction === "mark_as_sold"
                              ? "Mark as Sold?"
                              : "Pull off the Shelf?"}
                          </h5>
                          <p className="text-sm text-amber-700 mt-1">
                            {showSellerAction === "mark_as_sold"
                              ? "This will remove the listing from the shop AND remove the comic from your collection."
                              : "This will remove the listing from the shop. The comic will remain in your collection."}
                          </p>
                          {actionError && (
                            <p className="text-sm text-red-600 mt-2">{actionError}</p>
                          )}
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => handleSellerAction(showSellerAction)}
                              disabled={isProcessingAction}
                              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                                showSellerAction === "mark_as_sold"
                                  ? "bg-green-600 text-white hover:bg-green-700"
                                  : "bg-blue-600 text-white hover:bg-blue-700"
                              } disabled:opacity-50`}
                            >
                              {isProcessingAction
                                ? "Processing..."
                                : showSellerAction === "mark_as_sold"
                                  ? "Yes, Mark as Sold"
                                  : "Yes, Pull it"}
                            </button>
                            <button
                              onClick={() => {
                                setShowSellerAction(null);
                                setActionError(null);
                              }}
                              disabled={isProcessingAction}
                              className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={() => setShowListInShopModal(true)}
                  className="w-full px-4 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-semibold text-lg"
                >
                  <Store className="w-6 h-6" />
                  List in Shop
                </button>
              )}

              {/* Secondary Actions - All same size */}
              <div className="grid grid-cols-3 gap-2">
                {/* Edit Details Button */}
                <button
                  onClick={() => onEdit(item)}
                  className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center justify-center gap-1.5 text-sm font-medium"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>

                {/* Add to List Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowListMenu(!showListMenu)}
                    className="w-full px-3 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors flex items-center justify-center gap-1.5 text-sm font-medium"
                  >
                    <ListPlus className="w-4 h-4" />
                    Add to List
                  </button>

                  {/* List Menu Dropdown */}
                  {showListMenu && (
                    <>
                      {/* Invisible overlay to close dropdown when clicking outside */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => {
                          setShowListMenu(false);
                          setShowCreateList(false);
                          setNewListName("");
                        }}
                      />
                      <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                        {!hasCustomLists && !showCreateList ? (
                          <div className="px-4 py-3 text-center">
                            <p className="text-sm text-gray-500 mb-3">
                              You don&apos;t have any custom lists yet.
                            </p>
                            <button
                              onClick={() => setShowCreateList(true)}
                              className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors flex items-center gap-1 mx-auto"
                            >
                              <Plus className="w-4 h-4" />
                              Create New List
                            </button>
                          </div>
                        ) : showCreateList ? (
                          <div className="px-3 py-2">
                            <input
                              type="text"
                              value={newListName}
                              onChange={(e) => setNewListName(e.target.value)}
                              placeholder="List name..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 bg-white text-gray-900"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleCreateList}
                                disabled={!newListName.trim()}
                                className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
                              >
                                Create & Add
                              </button>
                              <button
                                onClick={() => {
                                  setShowCreateList(false);
                                  setNewListName("");
                                }}
                                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Default Lists */}
                            <div className="px-3 py-1">
                              <p className="text-xs text-gray-400 uppercase font-medium mb-1">
                                Default Lists
                              </p>
                              {lists
                                .filter((l) => l.isDefault && l.id !== "collection")
                                .map((list) => (
                                  <button
                                    key={list.id}
                                    onClick={() => toggleList(list.id)}
                                    className="w-full px-2 py-1.5 text-left text-sm text-gray-900 hover:bg-gray-100 rounded flex items-center justify-between"
                                  >
                                    <span>{list.name}</span>
                                    {isInList(list.id) && (
                                      <Check className="w-4 h-4 text-green-600" />
                                    )}
                                  </button>
                                ))}
                            </div>

                            {/* Custom Lists */}
                            {customLists.length > 0 && (
                              <div className="px-3 py-1 border-t mt-1 pt-1">
                                <p className="text-xs text-gray-400 uppercase font-medium mb-1">
                                  Custom Lists
                                </p>
                                {customLists.map((list) => (
                                  <button
                                    key={list.id}
                                    onClick={() => toggleList(list.id)}
                                    className="w-full px-2 py-1.5 text-left text-sm text-gray-900 hover:bg-gray-100 rounded flex items-center justify-between"
                                  >
                                    <span>{list.name}</span>
                                    {isInList(list.id) && (
                                      <Check className="w-4 h-4 text-green-600" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Create New */}
                            <div className="border-t mt-1 pt-1 px-3">
                              <button
                                onClick={() => setShowCreateList(true)}
                                className="w-full px-2 py-1.5 text-left text-sm text-primary-600 hover:bg-primary-50 rounded flex items-center gap-1"
                              >
                                <Plus className="w-4 h-4" />
                                Create New List
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => setShowRemoveConfirm(true)}
                  className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center gap-1.5 text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>

              {/* Mark as Sold - small link for external sales (we encourage selling through the shop) */}
              {!activeListing && (
                <button
                  onClick={() => setShowSoldConfirm(true)}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Sold elsewhere? Record sale
                </button>
              )}

              {/* For Trade Toggle */}
              <button
                onClick={handleToggleForTrade}
                disabled={isUpdatingTrade}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-pop-black font-bold transition-all ${
                  isForTrade
                    ? "bg-pop-orange text-white shadow-[2px_2px_0px_#000]"
                    : "bg-pop-white text-pop-black hover:shadow-[2px_2px_0px_#000]"
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" />
                {isUpdatingTrade ? "Updating..." : isForTrade ? "For Trade" : "Mark for Trade"}
              </button>
            </div>

            {/* Remove Confirmation */}
            {showRemoveConfirm && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
                <div className="bg-white rounded-xl border-4 border-black p-6 mx-4 max-w-sm w-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <Trash2 className="w-5 h-5 text-red-600" />
                    </div>
                    <h3 className="text-lg font-black">Delete Comic?</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-5">
                    Are you sure you want to delete this comic from your collection?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleRemove}
                      className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg border-2 border-black font-bold hover:bg-red-700 transition-colors text-sm"
                    >
                      Yes, Delete
                    </button>
                    <button
                      onClick={() => setShowRemoveConfirm(false)}
                      className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg border-2 border-gray-300 font-bold hover:bg-gray-200 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeListingWarning && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
                <div className="bg-white rounded-xl border-4 border-yellow-400 p-6 mx-4 max-w-sm w-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                      <Trash2 className="w-5 h-5 text-yellow-600" />
                    </div>
                    <h3 className="text-lg font-black">Cannot Delete Comic</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-5">
                    This comic has an active shop listing. You must cancel the listing before deleting it from your collection.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setActiveListingWarning(false)}
                      className="flex-1 px-4 py-2.5 bg-yellow-400 text-black rounded-lg border-2 border-black font-bold hover:bg-yellow-300 transition-colors text-sm"
                    >
                      Got It
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Sold Confirmation */}
            {showSoldConfirm && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700 mb-3">
                  Enter the sale price to record this sale.
                </p>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sale Price ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    className="w-full md:w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900"
                    placeholder="Enter sale price"
                  />
                  {item.purchasePrice && salePrice && parseFloat(salePrice) > 0 && (
                    <p
                      className={`text-xs mt-1 ${
                        parseFloat(salePrice) >= item.purchasePrice
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {parseFloat(salePrice) >= item.purchasePrice ? "Profit" : "Loss"}: $
                      {Math.abs(parseFloat(salePrice) - item.purchasePrice).toFixed(2)}
                    </p>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Note: In the future, you&apos;ll be able to select the buyer and the comic will
                  automatically transfer to their collection.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleMarkSold}
                    disabled={!salePrice || parseFloat(salePrice) <= 0}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Confirm Sale
                  </button>
                  <button
                    onClick={() => setShowSoldConfirm(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
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

      {/* Variants Modal */}
      {showVariantsModal && (
        <VariantsModal
          title={comic.title || "Unknown"}
          issueNumber={comic.issueNumber || "?"}
          year={comic.releaseYear}
          variants={variants}
          onClose={() => setShowVariantsModal(false)}
          onSelectVariant={(selectedItem) => {
            setShowVariantsModal(false);
            if (selectedItem.id !== item.id && onViewItem) {
              onViewItem(selectedItem);
            }
          }}
        />
      )}

      {/* Image Lightbox */}
      {showImageLightbox && (
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
          {item.coverImageUrl && (
            <img
              src={item.coverImageUrl}
              alt={`${comic.title} #${comic.issueNumber}`}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}

      {/* List in Shop Modal */}
      {showListInShopModal && (
        <ListInShopModal
          comic={item}
          isOpen={showListInShopModal}
          onClose={() => setShowListInShopModal(false)}
          onCreated={(listingId: string) => {
            setShowListInShopModal(false);
            setActiveListing({ id: listingId, listingType: "fixed_price" });
            onListInShop?.();
          }}
        />
      )}

      {/* Suggest Key Info Modal */}
      <SuggestKeyInfoModal
        isOpen={showSuggestKeyInfoModal}
        onClose={() => setShowSuggestKeyInfoModal(false)}
        comicTitle={comic.title || "Unknown Title"}
        issueNumber={comic.issueNumber || "?"}
        publisher={comic.publisher || undefined}
        releaseYear={comic.releaseYear}
        existingKeyInfo={comic.keyInfo}
      />
    </div>
  );
}
