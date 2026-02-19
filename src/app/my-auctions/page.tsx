"use client";

import { useEffect, useState } from "react";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { useAuth } from "@clerk/nextjs";

import { Clock, Gavel, Plus, Tag, Trophy } from "lucide-react";

import {
  AuctionCard,
  AuctionDetailModal,
  ListingCard,
  ListingDetailModal,
} from "@/components/auction";
import PremiumSellerUpsell from "@/components/auction/PremiumSellerUpsell";

import { shouldShowPremiumUpsell } from "@/lib/stripeConnect";
import { Auction, formatPrice } from "@/types/auction";

type ListingsTab = "active" | "ended";

export default function MyListingsPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ListingsTab>("active");
  const [listings, setListings] = useState<Auction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);
  const [upsellData, setUpsellData] = useState<{
    totalFeesPaid: number;
    totalSales: number;
  } | null>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (isSignedIn) {
      loadListings();
    }
  }, [isSignedIn]);

  // Check if we should show the premium seller upsell modal
  useEffect(() => {
    if (!isSignedIn) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("premium-upsell-dismissed")) return;

    async function checkUpsell() {
      try {
        const res = await fetch("/api/connect/status");
        if (!res.ok) return;
        const data = await res.json();

        const tier = data.subscriptionTier || "free";

        if (shouldShowPremiumUpsell(tier, data.completedSales)) {
          setUpsellData({
            totalFeesPaid: data.totalFeesPaid || 0,
            totalSales: data.completedSales,
          });
          setShowUpsell(true);
        }
      } catch {
        // Silent fail - upsell is non-critical
      }
    }
    checkUpsell();
  }, [isSignedIn]);

  const loadListings = async () => {
    setIsLoading(true);
    try {
      // Load all seller's listings (both auctions and fixed-price)
      const response = await fetch("/api/auctions?sellerId=me");
      if (response.ok) {
        const data = await response.json();
        setListings(data.auctions || []);
      }
    } catch (error) {
      console.error("Error loading listings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Separate by status
  const activeListings = listings.filter((l) => l.status === "active");
  const endedListings = listings.filter((l) => l.status !== "active");

  // Further separate active by type
  const activeAuctions = activeListings.filter((l) => l.listingType === "auction");
  const activeFixedPrice = activeListings.filter((l) => l.listingType === "fixed_price");

  const handleListingClick = (listing: Auction) => {
    if (listing.listingType === "auction") {
      setSelectedAuctionId(listing.id);
    } else {
      setSelectedListingId(listing.id);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-pop-black font-comic">MY LISTINGS</h1>
            <p className="text-gray-600 mt-1">Manage your auctions and items for sale</p>
          </div>
          <button
            onClick={() => router.push("/collection")}
            className="flex items-center gap-2 px-4 py-2 bg-pop-blue border-2 border-pop-black text-white font-bold transition-all"
            style={{ boxShadow: "3px 3px 0px #000" }}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create Listing</span>
          </button>
        </div>

        {/* Tabs - Pop Art Style */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={() => setActiveTab("active")}
            className={`flex items-center gap-2 px-4 py-2 font-bold border-2 border-pop-black transition-all ${
              activeTab === "active"
                ? "bg-pop-blue text-white shadow-[3px_3px_0px_#000]"
                : "bg-pop-white text-pop-black hover:shadow-[2px_2px_0px_#000]"
            }`}
          >
            Active
            {activeListings.length > 0 && (
              <span
                className={`px-1.5 py-0.5 text-xs font-black border border-pop-black ${
                  activeTab === "active" ? "bg-white text-pop-black" : "bg-pop-blue text-white"
                }`}
              >
                {activeListings.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("ended")}
            className={`flex items-center gap-2 px-4 py-2 font-bold border-2 border-pop-black transition-all ${
              activeTab === "ended"
                ? "bg-pop-blue text-white shadow-[3px_3px_0px_#000]"
                : "bg-pop-white text-pop-black hover:shadow-[2px_2px_0px_#000]"
            }`}
          >
            Ended
            {endedListings.length > 0 && (
              <span
                className={`px-1.5 py-0.5 text-xs font-black border border-pop-black ${
                  activeTab === "ended" ? "bg-white text-pop-black" : "bg-gray-200 text-pop-black"
                }`}
              >
                {endedListings.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-md overflow-hidden animate-pulse">
                <div className="aspect-[2/3] bg-gray-200" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === "active" ? (
          <>
            {activeListings.length === 0 ? (
              <div
                className="bg-pop-white border-3 border-pop-black p-12 text-center"
                style={{ boxShadow: "4px 4px 0px #000" }}
              >
                <div className="w-16 h-16 bg-pop-yellow border-3 border-pop-black flex items-center justify-center mx-auto mb-4">
                  <Tag className="w-8 h-8 text-pop-black" />
                </div>
                <p className="text-xl font-black text-pop-black font-comic uppercase">
                  No active listings
                </p>
                <p className="mt-2 text-gray-600">
                  Create your first listing from your collection!
                </p>
                <button
                  onClick={() => router.push("/collection")}
                  className="mt-4 px-5 py-3 bg-pop-blue border-2 border-pop-black text-white font-bold"
                  style={{ boxShadow: "3px 3px 0px #000" }}
                >
                  Go to Collection
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Active Fixed-Price Listings */}
                {activeFixedPrice.length > 0 && (
                  <div>
                    <h2 className="text-lg font-black text-pop-black mb-4 flex items-center gap-2">
                      <div className="w-8 h-8 bg-pop-green border-2 border-pop-black flex items-center justify-center">
                        <Tag className="w-4 h-4 text-white" />
                      </div>
                      For Sale ({activeFixedPrice.length})
                    </h2>
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                      {activeFixedPrice.map((listing) => (
                        <ListingCard
                          key={listing.id}
                          listing={listing}
                          onClick={() => handleListingClick(listing)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Auctions */}
                {activeAuctions.length > 0 && (
                  <div>
                    <h2 className="text-lg font-black text-pop-black mb-4 flex items-center gap-2">
                      <div className="w-8 h-8 bg-pop-blue border-2 border-pop-black flex items-center justify-center">
                        <Gavel className="w-4 h-4 text-white" />
                      </div>
                      Auctions ({activeAuctions.length})
                    </h2>
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                      {activeAuctions.map((auction) => (
                        <AuctionCard
                          key={auction.id}
                          auction={auction}
                          onClick={() => handleListingClick(auction)}
                          showSeller={false}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {endedListings.length === 0 ? (
              <div
                className="bg-pop-white border-3 border-pop-black p-12 text-center"
                style={{ boxShadow: "4px 4px 0px #000" }}
              >
                <div className="w-16 h-16 bg-pop-yellow border-3 border-pop-black flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-pop-black" />
                </div>
                <p className="text-xl font-black text-pop-black font-comic uppercase">
                  No ended listings
                </p>
                <p className="mt-2 text-gray-600">Your completed listings will appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                {endedListings.map((listing) => (
                  <div
                    key={listing.id}
                    onClick={() => handleListingClick(listing)}
                    className="bg-white rounded-xl shadow-md overflow-hidden cursor-pointer opacity-75 hover:opacity-100 transition-opacity"
                  >
                    <div className="aspect-[2/3] bg-gray-100 relative">
                      {listing.comic?.coverImageUrl && (
                        <Image
                          src={listing.comic.coverImageUrl}
                          alt=""
                          fill
                          className="object-cover grayscale"
                          sizes="(max-width: 768px) 33vw, (max-width: 1024px) 25vw, 12.5vw"
                          unoptimized
                        />
                      )}
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <span className="px-3 py-1 bg-gray-900 text-white text-sm rounded-full">
                          {listing.status === "sold"
                            ? "Sold"
                            : listing.status === "cancelled"
                              ? "Cancelled"
                              : "Ended"}
                        </span>
                      </div>
                      {/* Listing type badge */}
                      <div className="absolute top-2 left-2">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            listing.listingType === "auction"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {listing.listingType === "auction" ? "Auction" : "Sale"}
                        </span>
                      </div>
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {listing.comic?.comic?.title || "Unknown"}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {listing.listingType === "auction"
                          ? listing.winningBid
                            ? `Final: ${formatPrice(listing.winningBid)}`
                            : "No bids"
                          : `Price: ${formatPrice(listing.startingPrice)}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Auction Detail Modal */}
      <AuctionDetailModal
        auctionId={selectedAuctionId || ""}
        isOpen={!!selectedAuctionId}
        onClose={() => setSelectedAuctionId(null)}
        onAuctionUpdated={loadListings}
      />

      {/* Listing Detail Modal */}
      <ListingDetailModal
        listingId={selectedListingId || ""}
        isOpen={!!selectedListingId}
        onClose={() => setSelectedListingId(null)}
        onListingUpdated={loadListings}
      />

      {/* Premium Seller Upsell Modal */}
      {showUpsell && upsellData && (
        <PremiumSellerUpsell
          totalFeesPaid={upsellData.totalFeesPaid}
          totalSales={upsellData.totalSales}
          currentFeePercent={8}
          premiumFeePercent={5}
          onDismiss={() => {
            setShowUpsell(false);
            sessionStorage.setItem("premium-upsell-dismissed", "true");
          }}
        />
      )}
    </div>
  );
}
