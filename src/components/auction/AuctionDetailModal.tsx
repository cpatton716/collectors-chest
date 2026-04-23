"use client";

import { useEffect, useState } from "react";

import Image from "next/image";

import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Package,
  PackageMinus,
  Trophy,
  X,
} from "lucide-react";

import { useFeedbackEligibility } from "@/hooks/useFeedbackEligibility";

import { LeaveFeedbackButton } from "@/components/creatorCredits";

import { Auction, formatPrice, isListingCompleted, isListingPendingPayment } from "@/types/auction";

import { AlertCircle } from "lucide-react";

import { ComicImage } from "../ComicImage";
import { LocationBadge } from "../LocationBadge";
import { MarkAsShippedForm } from "./MarkAsShippedForm";
import { MessageButton } from "../messaging/MessageButton";
import { AuctionCountdown } from "./AuctionCountdown";
import { BidForm } from "./BidForm";
import { BidHistory } from "./BidHistory";
import { PaymentButton } from "./PaymentButton";
import { SellerBadge } from "./SellerBadge";
import { WatchlistButton } from "./WatchlistButton";

type SellerAction = "mark_as_sold" | "pull_off_shelf";

interface AuctionDetailModalProps {
  auctionId: string;
  isOpen: boolean;
  onClose: () => void;
  onAuctionUpdated?: () => void;
}

export function AuctionDetailModal({
  auctionId,
  isOpen,
  onClose,
  onAuctionUpdated,
}: AuctionDetailModalProps) {
  const [auction, setAuction] = useState<Auction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showActionConfirm, setShowActionConfirm] = useState<SellerAction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Check feedback eligibility for sold auctions
  const completed = auction ? isListingCompleted(auction) : false;
  const { eligibility } = useFeedbackEligibility(
    completed && auction ? auction.id : undefined,
    completed ? "auction" : undefined
  );

  useEffect(() => {
    if (isOpen && auctionId) {
      loadAuction();
    }
  }, [isOpen, auctionId]);

  const loadAuction = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/auctions/${auctionId}`);
      if (response.ok) {
        const data = await response.json();
        setAuction(data.auction);
      }
    } catch (error) {
      console.error("Error loading auction:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBidPlaced = () => {
    loadAuction();
    onAuctionUpdated?.();
  };

  const handleBuyItNow = () => {
    loadAuction();
    onAuctionUpdated?.();
  };

  const handleSellerAction = async (action: SellerAction) => {
    if (!auction) return;

    setIsProcessing(true);
    setActionError(null);
    try {
      // Cancel/remove the listing
      const reason = action === "mark_as_sold" ? "sold_elsewhere" : "changed_mind";
      const response = await fetch(`/api/auctions/${auctionId}?reason=${reason}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to process request");
      }

      // If "Mark as Sold", also remove the comic from collection
      if (action === "mark_as_sold" && auction.comicId) {
        const deleteResponse = await fetch(`/api/comics/${auction.comicId}`, {
          method: "DELETE",
        });
        // Note: We don't fail if comic deletion fails - the listing is already removed
        if (!deleteResponse.ok) {
          console.warn("Listing removed but comic deletion failed");
        }
      }

      setShowActionConfirm(null);
      onAuctionUpdated?.();
      onClose();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to process request");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  // Get all images (cover + detail images)
  const allImages = auction
    ? ([auction.comic?.coverImageUrl, ...(auction.detailImages || [])].filter(Boolean) as string[])
    : [];

  const hasMultipleImages = allImages.length > 1;

  const prevImage = () => {
    setSelectedImageIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  };

  const nextImage = () => {
    setSelectedImageIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative min-h-full flex items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 bg-white/90 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>

          {isLoading || !auction ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
              <p className="mt-4 text-gray-600">Loading auction...</p>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row max-h-[90vh] overflow-auto">
              {/* Left: Image Gallery */}
              <div className="md:w-1/2 flex-shrink-0 bg-gray-100 relative">
                {/* Main Image */}
                <div className="aspect-square relative max-h-[60vh] md:max-h-[70vh]">
                  {allImages[selectedImageIndex] ? (
                    <Image
                      src={allImages[selectedImageIndex]}
                      alt="Auction item"
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  ) : (
                    <ComicImage src={null} alt="No image" aspectRatio="fill" />
                  )}

                  {/* Navigation Arrows */}
                  {hasMultipleImages && (
                    <>
                      <button
                        onClick={prevImage}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                      </button>
                      <button
                        onClick={nextImage}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      </button>
                    </>
                  )}

                  {/* Watchlist Button */}
                  <div className="absolute top-4 right-4">
                    <WatchlistButton
                      auctionId={auction.id}
                      isWatching={auction.isWatching || false}
                    />
                  </div>
                </div>

                {/* Thumbnail Strip */}
                {hasMultipleImages && (
                  <div className="flex gap-2 p-4 overflow-x-auto">
                    {allImages.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedImageIndex(idx)}
                        className={`w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors relative ${
                          idx === selectedImageIndex ? "border-blue-500" : "border-transparent"
                        }`}
                      >
                        <Image
                          src={img}
                          alt={`Thumbnail ${idx + 1}`}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Details */}
              <div className="md:w-1/2 p-6 overflow-y-auto">
                {/* Title */}
                <h2 className="text-2xl font-bold text-gray-900">
                  {auction.comic?.comic?.title || "Unknown Title"} #
                  {auction.comic?.comic?.issueNumber || "?"}
                </h2>

                {auction.comic?.comic?.variant && (
                  <p className="text-gray-600 mt-1">{auction.comic.comic.variant}</p>
                )}

                {/* Publisher & Year */}
                <p className="text-sm text-gray-500 mt-2">
                  {auction.comic?.comic?.publisher || "Unknown Publisher"}
                  {auction.comic?.comic?.releaseYear && ` • ${auction.comic.comic.releaseYear}`}
                </p>

                {/* Key Info */}
                {auction.comic?.comic?.keyInfo && auction.comic.comic.keyInfo.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {auction.comic.comic.keyInfo.map((info, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full"
                      >
                        <KeyRound className="w-3 h-3" />
                        {info}
                      </span>
                    ))}
                  </div>
                )}

                {/* Countdown */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Time left:</span>
                    <AuctionCountdown endTime={auction.endTime} size="lg" />
                  </div>
                </div>

                {/* Seller */}
                {auction.seller && (
                  <div className="mt-4">
                    <span className="text-sm text-gray-600">Seller:</span>
                    <div className="mt-1 flex items-center gap-2">
                      <SellerBadge seller={auction.seller} />
                      {!auction.isSeller && auction.seller.id && (
                        <MessageButton
                          sellerId={auction.seller.id}
                          sellerName={auction.seller.username ? `@${auction.seller.username}` : undefined}
                          listingId={auction.id}
                          size="sm"
                          variant="button"
                        />
                      )}
                    </div>
                    {auction.seller.locationPrivacy && auction.seller.locationPrivacy !== "hidden" && (
                      <LocationBadge
                        city={auction.seller.locationCity}
                        state={auction.seller.locationState}
                        country={auction.seller.locationCountry}
                        privacy={auction.seller.locationPrivacy}
                        className="mt-2"
                      />
                    )}
                  </div>
                )}

                {/* Shipping */}
                <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                  <Package className="w-4 h-4" />
                  <span>
                    {auction.shippingCost > 0
                      ? `${formatPrice(auction.shippingCost)} shipping`
                      : "Free shipping"}
                  </span>
                </div>

                {/* End Date */}
                <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Ends{" "}
                    {new Date(auction.endTime).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Description */}
                {auction.description && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                      {auction.description}
                    </p>
                  </div>
                )}

                {/* Seller Controls */}
                {auction.isSeller && auction.status === "active" && (
                  <div className="mt-6 pt-4 border-t">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Manage Listing</h4>
                    <div className="flex gap-2">
                      {/* Mark as Sold - Only for fixed_price listings */}
                      {auction.listingType === "fixed_price" && (
                        <button
                          onClick={() => setShowActionConfirm("mark_as_sold")}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Mark as Sold
                        </button>
                      )}
                      {/* Pull off the Shelf - For both, but disabled for auctions with bids */}
                      <button
                        onClick={() => setShowActionConfirm("pull_off_shelf")}
                        disabled={auction.listingType === "auction" && auction.bidCount > 0}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm ${
                          auction.listingType === "auction" && auction.bidCount > 0
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                        title={
                          auction.listingType === "auction" && auction.bidCount > 0
                            ? "Cannot remove auction with bids"
                            : undefined
                        }
                      >
                        <PackageMinus className="w-4 h-4" />
                        Pull off the Shelf
                      </button>
                    </div>
                    {/* Info message for auctions with bids */}
                    {auction.listingType === "auction" && auction.bidCount > 0 && (
                      <p className="text-xs text-gray-500 mt-2">
                        Auctions with bids cannot be removed.
                      </p>
                    )}

                    {/* Action Confirmation Dialog */}
                    {showActionConfirm && (
                      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h5 className="font-medium text-amber-800">
                              {showActionConfirm === "mark_as_sold"
                                ? "Mark as Sold?"
                                : "Pull off the Shelf?"}
                            </h5>
                            <p className="text-sm text-amber-700 mt-1">
                              {showActionConfirm === "mark_as_sold"
                                ? "This will remove the listing from the shop AND remove the comic from your collection."
                                : "This will remove the listing from the shop. The comic will remain in your collection."}
                            </p>
                            {actionError && (
                              <p className="text-sm text-red-600 mt-2">{actionError}</p>
                            )}
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => handleSellerAction(showActionConfirm)}
                                disabled={isProcessing}
                                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                                  showActionConfirm === "mark_as_sold"
                                    ? "bg-green-600 text-white hover:bg-green-700"
                                    : "bg-blue-600 text-white hover:bg-blue-700"
                                } disabled:opacity-50`}
                              >
                                {isProcessing
                                  ? "Processing..."
                                  : showActionConfirm === "mark_as_sold"
                                    ? "Yes, Mark as Sold"
                                    : "Yes, Pull it"}
                              </button>
                              <button
                                onClick={() => {
                                  setShowActionConfirm(null);
                                  setActionError(null);
                                }}
                                disabled={isProcessing}
                                className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
                              >
                                No, Keep Listing
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Bid Form */}
                {auction.status === "active" && !auction.isSeller && (
                  <div className="mt-6 pt-4 border-t">
                    <BidForm
                      auctionId={auction.id}
                      currentBid={auction.currentBid}
                      startingPrice={auction.startingPrice}
                      buyItNowPrice={auction.buyItNowPrice}
                      userMaxBid={auction.userBid?.maxBid}
                      isHighBidder={auction.userBid?.isWinning}
                      onBidPlaced={handleBidPlaced}
                      onBuyItNow={handleBuyItNow}
                    />
                  </div>
                )}

                {/* Winner payment-pending: show PaymentButton for auction winner */}
                {isListingPendingPayment(auction) && !auction.isSeller && (
                    <div className="mt-6 pt-4 border-t space-y-3">
                      <div className="flex items-center justify-center gap-2 py-3 bg-amber-50 text-amber-800 rounded-xl border border-amber-200">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-semibold">
                          You won! Complete payment to finalize your purchase
                        </span>
                      </div>
                      <PaymentButton
                        auctionId={auction.id}
                        amount={auction.winningBid || auction.currentBid || auction.startingPrice}
                        shippingCost={auction.shippingCost || 0}
                      />
                    </div>
                  )}

                {/* Sold Status with Feedback */}
                {isListingCompleted(auction) && (
                  <div className="mt-6 pt-4 border-t">
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="w-5 h-5 text-amber-500" />
                      <span className="font-semibold text-gray-900">
                        {auction.isSeller ? "Sold!" : "You won this auction!"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Final price: <span className="font-bold">{formatPrice(auction.winningBid)}</span>
                    </p>

                    {/* Shipping state */}
                    {auction.paymentStatus === "paid" && !auction.shippedAt && auction.isSeller && (
                      <MarkAsShippedForm listingId={auction.id} onShipped={loadAuction} />
                    )}
                    {auction.paymentStatus === "paid" && !auction.shippedAt && !auction.isSeller && (
                      <div className="flex items-center gap-2 py-2 px-3 mb-3 bg-amber-50 text-amber-800 rounded-lg border border-amber-200 text-sm">
                        <Package className="w-4 h-4" />
                        <span>Awaiting shipment from the seller.</span>
                      </div>
                    )}
                    {auction.shippedAt && (
                      <div className="flex items-start gap-2 py-2 px-3 mb-3 bg-green-50 text-green-800 rounded-lg border border-green-200 text-sm">
                        <Package className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-semibold">Shipped</div>
                          {auction.trackingNumber ? (
                            <div className="text-xs mt-1">
                              {auction.trackingCarrier ? `${auction.trackingCarrier} · ` : ""}
                              Tracking: {auction.trackingNumber}
                            </div>
                          ) : (
                            <div className="text-xs mt-1">No tracking number provided.</div>
                          )}
                        </div>
                      </div>
                    )}

                    {eligibility?.canLeaveFeedback && (
                      <div className="flex items-center gap-2">
                        <LeaveFeedbackButton
                          transactionType="auction"
                          transactionId={auction.id}
                          revieweeId={auction.isSeller ? auction.winnerId : auction.sellerId}
                          revieweeName={
                            auction.isSeller
                              ? "the buyer"
                              : auction.seller?.username
                                ? `@${auction.seller.username}`
                                : auction.seller?.displayName || "the seller"
                          }
                          onFeedbackSubmitted={loadAuction}
                        />
                      </div>
                    )}
                    {eligibility && !eligibility.canLeaveFeedback && eligibility.feedbackLeftAt && (
                      <p className="text-sm text-green-600">
                        Feedback submitted on {new Date(eligibility.feedbackLeftAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                {/* Bid History */}
                <div className="mt-6 pt-4 border-t">
                  <BidHistory auctionId={auction.id} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
