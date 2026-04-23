"use client";

import { useEffect, useState } from "react";

import Image from "next/image";
import Link from "next/link";

import { useAuth } from "@clerk/nextjs";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Loader2,
  Package,
  PackageMinus,
  ShoppingCart,
  Tag,
  Trophy,
  X,
} from "lucide-react";

import { useFeedbackEligibility } from "@/hooks/useFeedbackEligibility";

import { LocationBadge } from "@/components/LocationBadge";
import { MessageButton } from "@/components/messaging/MessageButton";
import { LeaveFeedbackButton } from "@/components/creatorCredits";

import { Auction, formatPrice, isListingCompleted, isListingPendingPayment } from "@/types/auction";

import { ComicImage } from "../ComicImage";
import { MarkAsShippedForm } from "./MarkAsShippedForm";
import { PaymentButton } from "./PaymentButton";
import { SellerBadge } from "./SellerBadge";
import { WatchlistButton } from "./WatchlistButton";

type SellerAction = "mark_as_sold" | "pull_off_shelf";

interface ListingDetailModalProps {
  listingId: string;
  isOpen: boolean;
  onClose: () => void;
  onListingUpdated?: () => void;
}

export function ListingDetailModal({
  listingId,
  isOpen,
  onClose,
  onListingUpdated,
}: ListingDetailModalProps) {
  const { isSignedIn } = useAuth();
  const [listing, setListing] = useState<Auction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showActionConfirm, setShowActionConfirm] = useState<SellerAction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Check feedback eligibility for sold listings
  const completed = listing ? isListingCompleted(listing) : false;
  const { eligibility } = useFeedbackEligibility(
    completed && listing ? listing.id : undefined,
    completed ? "sale" : undefined
  );

  useEffect(() => {
    if (isOpen && listingId) {
      loadListing();
      setSelectedImageIndex(0);
      setPurchaseError(null);
    }
  }, [isOpen, listingId]);

  const loadListing = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/auctions/${listingId}`);
      if (response.ok) {
        const data = await response.json();
        setListing(data.auction);
      }
    } catch (error) {
      console.error("Error loading listing:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Buy Now: direct-to-Stripe-Checkout. No intermediate "reserve" state —
  // the listing stays active until the Stripe webhook confirms payment and
  // marks it sold. See BACKLOG bug #1 for flow design rationale.
  const handlePurchase = async () => {
    if (!isSignedIn) {
      setPurchaseError("Please sign in to make a purchase");
      return;
    }

    setIsPurchasing(true);
    setPurchaseError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });

      const data = await response.json();

      if (response.ok && data.url) {
        // Redirect to Stripe Checkout. On success, Stripe redirects to
        // /collection?purchase=success; on cancel, back to /shop?listing=<id>.
        window.location.href = data.url;
        return;
      }

      if (data.error === "AGE_VERIFICATION_REQUIRED") {
        setPurchaseError(data.message || "You must confirm you are 18+ to use the marketplace.");
      } else {
        setPurchaseError(data.error || "Failed to start checkout");
      }
    } catch {
      setPurchaseError("Failed to start checkout. Please try again.");
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleSellerAction = async (action: SellerAction) => {
    if (!listing) return;

    setIsProcessing(true);
    setActionError(null);
    try {
      // Cancel/remove the listing
      const reason = action === "mark_as_sold" ? "sold_elsewhere" : "changed_mind";
      const response = await fetch(`/api/auctions/${listingId}?reason=${reason}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to process request");
      }

      // If "Mark as Sold", also remove the comic from collection
      if (action === "mark_as_sold" && listing.comicId) {
        const deleteResponse = await fetch(`/api/comics/${listing.comicId}`, {
          method: "DELETE",
        });
        if (!deleteResponse.ok) {
          console.warn("Listing removed but comic deletion failed");
        }
      }

      setShowActionConfirm(null);
      onListingUpdated?.();
      onClose();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to process request");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  // Get all images (cover + detail images)
  const allImages = listing
    ? ([listing.comic?.coverImageUrl, ...(listing.detailImages || [])].filter(Boolean) as string[])
    : [];

  const hasMultipleImages = allImages.length > 1;

  const prevImage = () => {
    setSelectedImageIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  };

  const nextImage = () => {
    setSelectedImageIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  };

  const comic = listing?.comic?.comic;
  const totalPrice = (listing?.startingPrice || 0) + (listing?.shippingCost || 0);

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

          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            </div>
          ) : !listing ? (
            <div className="flex items-center justify-center h-96">
              <p className="text-gray-500">Listing not found</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-0 max-h-[90vh] overflow-y-auto">
              {/* Left Column - Images */}
              <div className="relative bg-gray-900 aspect-[3/4] md:aspect-auto md:min-h-[400px] md:max-h-[70vh]">
                {allImages.length > 0 ? (
                  <>
                    <Image
                      src={allImages[selectedImageIndex]}
                      alt={comic?.title || "Comic"}
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />

                    {/* Image Navigation */}
                    {hasMultipleImages && (
                      <>
                        <button
                          onClick={prevImage}
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          onClick={nextImage}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>

                        {/* Image Dots */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                          {allImages.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedImageIndex(idx)}
                              className={`w-2 h-2 rounded-full transition-colors ${
                                idx === selectedImageIndex
                                  ? "bg-white"
                                  : "bg-white/50 hover:bg-white/75"
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center dots-red">
                    <span className="font-comic text-6xl text-pop-blue text-comic-outline">?</span>
                  </div>
                )}

                {/* Watchlist Button */}
                <div className="absolute top-4 left-4">
                  <WatchlistButton
                    auctionId={listing.id}
                    isWatching={listing.isWatching || false}
                    onToggle={() => loadListing()}
                  />
                </div>
              </div>

              {/* Right Column - Details */}
              <div className="p-6 space-y-6">
                {/* Title */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      Buy Now
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {comic?.title || "Unknown Title"} #{comic?.issueNumber || "?"}
                  </h2>
                  {comic?.variant && <p className="text-gray-500 mt-1">{comic.variant}</p>}
                  <p className="text-gray-600 mt-1">
                    {comic?.publisher || "Unknown Publisher"}
                    {comic?.releaseYear && ` (${comic.releaseYear})`}
                  </p>

                  {/* Key Info */}
                  {listing.comic?.comic?.keyInfo && listing.comic.comic.keyInfo.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {listing.comic.comic.keyInfo.map((info, idx) => (
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
                </div>

                {/* Seller */}
                {listing.seller && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between gap-3">
                      <SellerBadge seller={listing.seller} />
                      {/* Message Seller button - only show if not the seller */}
                      {!listing.isSeller && listing.sellerId && (
                        <MessageButton
                          sellerId={listing.sellerId}
                          sellerName={
                            listing.seller.username ? `@${listing.seller.username}` : undefined
                          }
                          listingId={listing.id}
                          listingTitle={listing.comic?.comic?.title || undefined}
                          listingIssue={listing.comic?.comic?.issueNumber || undefined}
                          listingGrade={listing.comic?.comic?.grade || undefined}
                          listingGradingCompany={listing.comic?.comic?.gradingCompany || undefined}
                          size="sm"
                        />
                      )}
                    </div>
                    {listing.seller.locationPrivacy && listing.seller.locationPrivacy !== "hidden" && (
                      <LocationBadge
                        city={listing.seller.locationCity}
                        state={listing.seller.locationState}
                        country={listing.seller.locationCountry}
                        privacy={listing.seller.locationPrivacy}
                        className="mt-2"
                      />
                    )}
                  </div>
                )}

                {/* Price */}
                <div className="bg-green-50 rounded-xl p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Price</span>
                      <span className="text-2xl font-bold text-green-600">
                        {formatPrice(listing.startingPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 flex items-center gap-1">
                        <Package className="w-4 h-4" />
                        Shipping
                      </span>
                      <span className="text-gray-700">
                        {listing.shippingCost > 0 ? formatPrice(listing.shippingCost) : "Free"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-green-200">
                      <span className="font-medium text-gray-700">Total</span>
                      <span className="text-xl font-bold text-green-700">
                        {formatPrice(totalPrice)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Purchase Button */}
                <div className="space-y-3">
                  {isListingPendingPayment(listing) && !listing.isSeller ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center gap-2 py-3 bg-amber-50 text-amber-800 rounded-xl border border-amber-200">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-semibold">Payment required to complete your purchase</span>
                      </div>
                      <PaymentButton
                        auctionId={listing.id}
                        amount={listing.winningBid || listing.startingPrice}
                        shippingCost={listing.shippingCost || 0}
                      />
                    </div>
                  ) : isListingCompleted(listing) ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 py-4 bg-gray-100 text-gray-700 rounded-xl justify-center">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        <span className="font-semibold">
                          {listing.isSeller ? "Sold!" : "You purchased this item!"}
                        </span>
                      </div>

                      {/* Shipping state: unshipped vs shipped */}
                      {!listing.shippedAt && listing.isSeller && (
                        <MarkAsShippedForm listingId={listing.id} onShipped={loadListing} />
                      )}
                      {!listing.shippedAt && !listing.isSeller && (
                        <div className="flex items-center gap-2 py-3 px-4 bg-amber-50 text-amber-800 rounded-lg border border-amber-200 text-sm">
                          <Package className="w-4 h-4" />
                          <span>Awaiting shipment from the seller.</span>
                        </div>
                      )}
                      {listing.shippedAt && (
                        <div className="flex items-start gap-2 py-3 px-4 bg-green-50 text-green-800 rounded-lg border border-green-200 text-sm">
                          <Package className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="font-semibold">Shipped</div>
                            {listing.trackingNumber ? (
                              <div className="text-xs mt-1">
                                {listing.trackingCarrier ? `${listing.trackingCarrier} · ` : ""}
                                Tracking: {listing.trackingNumber}
                              </div>
                            ) : (
                              <div className="text-xs mt-1">No tracking number provided.</div>
                            )}
                          </div>
                        </div>
                      )}

                      {eligibility?.canLeaveFeedback && (
                        <div className="flex justify-center">
                          <LeaveFeedbackButton
                            transactionType="sale"
                            transactionId={listing.id}
                            revieweeId={listing.isSeller ? listing.winnerId : listing.sellerId}
                            revieweeName={
                              listing.isSeller
                                ? "the buyer"
                                : listing.seller?.username
                                  ? `@${listing.seller.username}`
                                  : listing.seller?.displayName || "the seller"
                            }
                            onFeedbackSubmitted={loadListing}
                          />
                        </div>
                      )}
                      {eligibility && !eligibility.canLeaveFeedback && eligibility.feedbackLeftAt && (
                        <p className="text-sm text-green-600 text-center">
                          Feedback submitted on {new Date(eligibility.feedbackLeftAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ) : listing.status === "active" && listing.isSeller ? (
                    // Seller viewing their own active listing — no Buy Now.
                    // Seller controls (Mark as Sold / Pull off the Shelf) render below.
                    null
                  ) : listing.status === "active" ? (
                    <button
                      onClick={handlePurchase}
                      disabled={isPurchasing}
                      className="w-full py-4 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
                    >
                      {isPurchasing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-5 h-5" />
                          Buy Now for {formatPrice(totalPrice)}
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="py-4 bg-gray-100 text-gray-600 text-center rounded-xl">
                      This listing is no longer available
                    </div>
                  )}

                  {purchaseError && (
                    <div className="flex items-center gap-2 text-red-600 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      {purchaseError}
                    </div>
                  )}

                  {!isSignedIn && listing.status === "active" && (
                    <p className="text-center text-sm text-gray-500">
                      <Link href="/sign-in" className="text-green-600 hover:underline">
                        Sign in
                      </Link>{" "}
                      to make a purchase
                    </p>
                  )}
                </div>

                {/* Seller Controls */}
                {listing.isSeller && listing.status === "active" && (
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Manage Listing</h4>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowActionConfirm("mark_as_sold")}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Mark as Sold
                      </button>
                      <button
                        onClick={() => setShowActionConfirm("pull_off_shelf")}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                      >
                        <PackageMinus className="w-4 h-4" />
                        Pull off the Shelf
                      </button>
                    </div>

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

                {/* Description */}
                {listing.description && (
                  <div className="pt-4 border-t">
                    <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                    <p className="text-gray-600 whitespace-pre-wrap">{listing.description}</p>
                  </div>
                )}

                {/* Comic Details */}
                <div className="pt-4 border-t">
                  <h3 className="font-semibold text-gray-900 mb-3">Details</h3>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {comic?.writer && (
                      <>
                        <dt className="text-gray-500">Writer</dt>
                        <dd className="text-gray-900">{comic.writer}</dd>
                      </>
                    )}
                    {comic?.coverArtist && (
                      <>
                        <dt className="text-gray-500">Cover Artist</dt>
                        <dd className="text-gray-900">{comic.coverArtist}</dd>
                      </>
                    )}
                    {comic?.isSlabbed && (
                      <>
                        <dt className="text-gray-500">Graded</dt>
                        <dd className="text-gray-900">
                          {comic.gradingCompany} {comic.grade}
                        </dd>
                      </>
                    )}
                  </dl>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

