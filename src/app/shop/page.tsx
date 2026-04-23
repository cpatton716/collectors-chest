"use client";

import { Suspense, useEffect, useState } from "react";

import { useSearchParams } from "next/navigation";

import { useAuth } from "@clerk/nextjs";

import { ArrowLeftRight, ChevronDown, Clock, Gavel, Search, Tag, Users } from "lucide-react";

import {
  AuctionCard,
  AuctionDetailModal,
  ListingCard,
  ListingDetailModal,
} from "@/components/auction";
import { TradeableComicCard } from "@/components/trading";

import { Auction, AuctionSortBy, ListingSortBy } from "@/types/auction";

type ShopTab = "buy-now" | "auctions" | "for-trade";

interface TradeableComic {
  id: string;
  title: string;
  issueNumber: string;
  publisher: string;
  coverImageUrl?: string;
  grade?: string;
  estimatedValue?: number;
  owner: {
    id: string;
    displayName: string;
    username?: string;
    rating?: number;
    ratingCount?: number;
  };
}

const AUCTION_SORT_OPTIONS: { value: AuctionSortBy; label: string }[] = [
  { value: "ending_soonest", label: "Ending Soonest" },
  { value: "ending_latest", label: "Ending Latest" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
  { value: "most_bids", label: "Most Bids" },
  { value: "newest", label: "Newest Listed" },
];

const LISTING_SORT_OPTIONS: { value: ListingSortBy; label: string }[] = [
  { value: "newest", label: "Newest Listed" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
];

export default function ShopPage() {
  return (
    <Suspense fallback={<ShopPageSkeleton />}>
      <ShopPageContent />
    </Suspense>
  );
}

function ShopPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b py-6">
        <div className="container mx-auto px-4">
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-md overflow-hidden animate-pulse">
              <div className="aspect-[2/3] bg-gray-200" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShopPageContent() {
  const { isSignedIn } = useAuth();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<ShopTab>("buy-now");

  // Handle URL params for tab and listing selection.
  // When a listing id is in the URL, route the modal based on the listing's
  // canonical listing_type (fetched from the API), not the URL tab param —
  // otherwise /shop?tab=buy-now&listing=<auctionId> renders an auction inside
  // the Buy Now modal. The URL tab still controls the browse-tab selection.
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const listingParam = searchParams.get("listing");

    const activateTabFromParam = () => {
      if (tabParam === "auctions") setActiveTab("auctions");
      else if (tabParam === "for-trade") setActiveTab("for-trade");
      else setActiveTab("buy-now");
    };

    if (!listingParam) {
      activateTabFromParam();
      return;
    }

    // Fetch the listing and route the modal by its real type.
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/auctions/${listingParam}`);
        if (cancelled) return;
        if (res.ok) {
          const { auction } = await res.json();
          // getAuction returns camelCase (listingType), not snake_case.
          const actualType = auction?.listingType;
          if (actualType === "auction") {
            setActiveTab("auctions");
            setSelectedAuctionId(listingParam);
            return;
          }
          if (actualType === "fixed_price") {
            setActiveTab("buy-now");
            setSelectedListingId(listingParam);
            return;
          }
        }
      } catch {
        // fall through to tab-param behavior
      }
      if (cancelled) return;
      activateTabFromParam();
      if (tabParam === "auctions") setSelectedAuctionId(listingParam);
      else setSelectedListingId(listingParam);
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  // Auctions state
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [isLoadingAuctions, setIsLoadingAuctions] = useState(false);
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
  const [auctionSortBy, setAuctionSortBy] = useState<AuctionSortBy>("ending_soonest");
  const [endingSoonOnly, setEndingSoonOnly] = useState(false);
  const [hasBuyItNow, setHasBuyItNow] = useState(false);
  const [auctionSearchQuery, setAuctionSearchQuery] = useState("");
  const [followingOnlyAuctions, setFollowingOnlyAuctions] = useState(false);

  // Listings state
  const [listings, setListings] = useState<Auction[]>([]);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [listingSortBy, setListingSortBy] = useState<ListingSortBy>("newest");
  const [listingSearchQuery, setListingSearchQuery] = useState("");
  const [followingOnlyListings, setFollowingOnlyListings] = useState(false);

  // Tradeable comics state
  const [tradeableComics, setTradeableComics] = useState<TradeableComic[]>([]);
  const [isLoadingTradeable, setIsLoadingTradeable] = useState(false);
  const [tradeSearchQuery, setTradeSearchQuery] = useState("");
  const [selectedTradeComic, setSelectedTradeComic] = useState<TradeableComic | null>(null);

  // Load auctions when tab changes or filters change
  useEffect(() => {
    if (activeTab === "auctions") {
      loadAuctions();
    }
  }, [activeTab, auctionSortBy, endingSoonOnly, hasBuyItNow, followingOnlyAuctions]);

  // Load listings when tab changes or filters change
  useEffect(() => {
    if (activeTab === "buy-now") {
      loadListings();
    }
  }, [activeTab, listingSortBy, followingOnlyListings]);

  // Load tradeable comics when tab changes
  useEffect(() => {
    if (activeTab === "for-trade") {
      loadTradeableComics();
    }
  }, [activeTab]);

  const loadAuctions = async () => {
    setIsLoadingAuctions(true);
    try {
      const params = new URLSearchParams({
        listingType: "auction",
        sortBy: auctionSortBy,
        ...(endingSoonOnly && { endingSoon: "true" }),
        ...(hasBuyItNow && { hasBuyItNow: "true" }),
        ...(followingOnlyAuctions && { followingOnly: "true" }),
      });

      const response = await fetch(`/api/auctions?${params}`);
      if (response.ok) {
        const data = await response.json();
        setAuctions(data.auctions || []);
      }
    } catch (error) {
      console.error("Error loading auctions:", error);
    } finally {
      setIsLoadingAuctions(false);
    }
  };

  const loadListings = async () => {
    setIsLoadingListings(true);
    try {
      const params = new URLSearchParams({
        listingType: "fixed_price",
        sortBy: listingSortBy,
        ...(followingOnlyListings && { followingOnly: "true" }),
      });

      const response = await fetch(`/api/auctions?${params}`);
      if (response.ok) {
        const data = await response.json();
        setListings(data.auctions || []);
      }
    } catch (error) {
      console.error("Error loading listings:", error);
    } finally {
      setIsLoadingListings(false);
    }
  };

  const loadTradeableComics = async () => {
    setIsLoadingTradeable(true);
    try {
      const response = await fetch("/api/trades/available");
      if (response.ok) {
        const data = await response.json();
        setTradeableComics(data.comics || []);
      }
    } catch (error) {
      console.error("Error loading tradeable comics:", error);
    } finally {
      setIsLoadingTradeable(false);
    }
  };

  const handleAuctionWatchlistChange = (auctionId: string, isWatching: boolean) => {
    setAuctions((prev) => prev.map((a) => (a.id === auctionId ? { ...a, isWatching } : a)));
  };

  const handleListingWatchlistChange = (listingId: string, isWatching: boolean) => {
    setListings((prev) => prev.map((l) => (l.id === listingId ? { ...l, isWatching } : l)));
  };

  // Filter auctions by search query (client-side)
  const filteredAuctions = auctions.filter((auction) => {
    if (!auctionSearchQuery.trim()) return true;
    const query = auctionSearchQuery.toLowerCase();
    const title = auction.comic?.comic?.title?.toLowerCase() || "";
    const publisher = auction.comic?.comic?.publisher?.toLowerCase() || "";
    return title.includes(query) || publisher.includes(query);
  });

  // Filter listings by search query (client-side)
  const filteredListings = listings.filter((listing) => {
    if (!listingSearchQuery.trim()) return true;
    const query = listingSearchQuery.toLowerCase();
    const title = listing.comic?.comic?.title?.toLowerCase() || "";
    const publisher = listing.comic?.comic?.publisher?.toLowerCase() || "";
    return title.includes(query) || publisher.includes(query);
  });

  // Filter tradeable comics by search query
  const filteredTradeableComics = tradeableComics.filter((comic) => {
    if (!tradeSearchQuery.trim()) return true;
    const query = tradeSearchQuery.toLowerCase();
    const title = comic.title?.toLowerCase() || "";
    const publisher = comic.publisher?.toLowerCase() || "";
    return title.includes(query) || publisher.includes(query);
  });

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl shadow-md overflow-hidden animate-pulse">
          <div className="aspect-[2/3] bg-gray-200" />
          <div className="p-3 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-3xl font-black text-pop-black font-comic">SHOP</h1>
        <p className="text-gray-600 mt-1">Find your next addition to the collection</p>

        {/* Tabs - Pop Art Style */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={() => setActiveTab("buy-now")}
            className={`flex items-center gap-1 px-3 py-1 text-sm font-bold border-2 border-pop-black transition-all whitespace-nowrap ${
              activeTab === "buy-now"
                ? "bg-pop-green text-white shadow-[2px_2px_0px_#000]"
                : "bg-pop-white text-pop-black hover:shadow-[2px_2px_0px_#000]"
            }`}
          >
            <Tag className="w-3 h-3" />
            Buy Now
          </button>
          <button
            onClick={() => setActiveTab("auctions")}
            className={`flex items-center gap-1 px-3 py-1 text-sm font-bold border-2 border-pop-black transition-all whitespace-nowrap ${
              activeTab === "auctions"
                ? "bg-pop-blue text-white shadow-[2px_2px_0px_#000]"
                : "bg-pop-white text-pop-black hover:shadow-[2px_2px_0px_#000]"
            }`}
          >
            <Gavel className="w-3 h-3" />
            Auctions
          </button>
          <button
            onClick={() => setActiveTab("for-trade")}
            className={`flex items-center gap-1 px-3 py-1 text-sm font-bold border-2 border-pop-black transition-all whitespace-nowrap ${
              activeTab === "for-trade"
                ? "bg-pop-orange text-white shadow-[2px_2px_0px_#000]"
                : "bg-pop-white text-pop-black hover:shadow-[2px_2px_0px_#000]"
            }`}
          >
            <ArrowLeftRight className="w-3 h-3" />
            For Trade
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {activeTab === "buy-now" && (
          <>
            {/* Buy Now Search & Filters - Pop Art Style */}
            <div
              className="bg-pop-white border-3 border-pop-black p-4 mb-6"
              style={{ boxShadow: "4px 4px 0px #000" }}
            >
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search listings..."
                  value={listingSearchQuery}
                  onChange={(e) => setListingSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-pop-black focus:ring-2 focus:ring-pop-green bg-white text-gray-900 font-medium"
                />
              </div>

              {/* Sort and Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={listingSortBy}
                  onChange={(e) => setListingSortBy(e.target.value as ListingSortBy)}
                  className="bg-white border-2 border-pop-black px-4 py-2 pr-8 font-bold focus:ring-2 focus:ring-pop-green cursor-pointer"
                >
                  {LISTING_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                {/* Following Only Filter - only show when logged in */}
                {isSignedIn && (
                  <button
                    onClick={() => setFollowingOnlyListings(!followingOnlyListings)}
                    className={`flex items-center gap-2 px-4 py-2 border-2 border-pop-black font-bold transition-all ${
                      followingOnlyListings
                        ? "bg-pop-blue text-white shadow-[2px_2px_0px_#000]"
                        : "bg-pop-white text-pop-black hover:shadow-[2px_2px_0px_#000]"
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Following
                  </button>
                )}
              </div>
            </div>

            {/* Listings Grid */}
            {isLoadingListings ? (
              <LoadingSkeleton />
            ) : filteredListings.length === 0 ? (
              <div
                className="bg-pop-white border-3 border-pop-black p-12 text-center"
                style={{ boxShadow: "4px 4px 0px #000" }}
              >
                <div className="w-16 h-16 bg-pop-yellow border-3 border-pop-black flex items-center justify-center mx-auto mb-4">
                  {followingOnlyListings ? (
                    <Users className="w-8 h-8 text-pop-black" />
                  ) : (
                    <Tag className="w-8 h-8 text-pop-black" />
                  )}
                </div>
                <p className="text-xl font-black text-pop-black font-comic uppercase">
                  {followingOnlyListings ? "No listings from followed sellers" : "No listings found"}
                </p>
                <p className="mt-2 text-gray-600">
                  {listingSearchQuery
                    ? "Try adjusting your search"
                    : followingOnlyListings
                      ? "Follow more sellers or check back later"
                      : "Check back soon for new listings"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    onClick={() => setSelectedListingId(listing.id)}
                    onWatchlistChange={handleListingWatchlistChange}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "auctions" && (
          <>
            {/* Auctions Search & Filters - Pop Art Style */}
            <div
              className="bg-pop-white border-3 border-pop-black p-4 mb-6"
              style={{ boxShadow: "4px 4px 0px #000" }}
            >
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search auctions..."
                  value={auctionSearchQuery}
                  onChange={(e) => setAuctionSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-pop-black focus:ring-2 focus:ring-pop-blue bg-white text-gray-900 font-medium"
                />
              </div>

              {/* Filter/Sort Bar */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Sort Dropdown */}
                <select
                  value={auctionSortBy}
                  onChange={(e) => setAuctionSortBy(e.target.value as AuctionSortBy)}
                  className="bg-white border-2 border-pop-black px-4 py-2 pr-8 font-bold focus:ring-2 focus:ring-pop-blue cursor-pointer"
                >
                  {AUCTION_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                {/* Filter Toggles */}
                <button
                  onClick={() => setEndingSoonOnly(!endingSoonOnly)}
                  className={`flex items-center gap-2 px-4 py-2 border-2 border-pop-black font-bold transition-all ${
                    endingSoonOnly
                      ? "bg-pop-orange text-white shadow-[2px_2px_0px_#000]"
                      : "bg-pop-white text-pop-black hover:shadow-[2px_2px_0px_#000]"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Ending Soon
                </button>

                <button
                  onClick={() => setHasBuyItNow(!hasBuyItNow)}
                  className={`flex items-center gap-2 px-4 py-2 border-2 border-pop-black font-bold transition-all ${
                    hasBuyItNow
                      ? "bg-pop-green text-white shadow-[2px_2px_0px_#000]"
                      : "bg-pop-white text-pop-black hover:shadow-[2px_2px_0px_#000]"
                  }`}
                >
                  <Tag className="w-4 h-4" />
                  Buy It Now
                </button>

                {/* Following Only Filter - only show when logged in */}
                {isSignedIn && (
                  <button
                    onClick={() => setFollowingOnlyAuctions(!followingOnlyAuctions)}
                    className={`flex items-center gap-2 px-4 py-2 border-2 border-pop-black font-bold transition-all ${
                      followingOnlyAuctions
                        ? "bg-pop-blue text-white shadow-[2px_2px_0px_#000]"
                        : "bg-pop-white text-pop-black hover:shadow-[2px_2px_0px_#000]"
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    Following
                  </button>
                )}
              </div>
            </div>

            {/* Auctions Grid */}
            {isLoadingAuctions ? (
              <LoadingSkeleton />
            ) : filteredAuctions.length === 0 ? (
              <div
                className="bg-pop-white border-3 border-pop-black p-12 text-center"
                style={{ boxShadow: "4px 4px 0px #000" }}
              >
                <div className="w-16 h-16 bg-pop-yellow border-3 border-pop-black flex items-center justify-center mx-auto mb-4">
                  {followingOnlyAuctions ? (
                    <Users className="w-8 h-8 text-pop-black" />
                  ) : (
                    <Gavel className="w-8 h-8 text-pop-black" />
                  )}
                </div>
                <p className="text-xl font-black text-pop-black font-comic uppercase">
                  {followingOnlyAuctions ? "No auctions from followed sellers" : "No auctions found"}
                </p>
                <p className="mt-2 text-gray-600">
                  {auctionSearchQuery
                    ? "Try adjusting your search"
                    : followingOnlyAuctions
                      ? "Follow more sellers or check back later"
                      : "Check back soon for new listings"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredAuctions.map((auction) => (
                  <AuctionCard
                    key={auction.id}
                    auction={auction}
                    onClick={() => setSelectedAuctionId(auction.id)}
                    onWatchlistChange={handleAuctionWatchlistChange}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "for-trade" && (
          <>
            {/* For Trade Search & Filters */}
            <div
              className="bg-pop-white border-3 border-pop-black p-4 mb-6"
              style={{ boxShadow: "4px 4px 0px #000" }}
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search tradeable comics..."
                  value={tradeSearchQuery}
                  onChange={(e) => setTradeSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-pop-black focus:ring-2 focus:ring-pop-orange bg-white text-gray-900 font-medium"
                />
              </div>
            </div>

            {/* Tradeable Comics Grid */}
            {isLoadingTradeable ? (
              <LoadingSkeleton />
            ) : filteredTradeableComics.length === 0 ? (
              <div
                className="bg-pop-white border-3 border-pop-black p-12 text-center"
                style={{ boxShadow: "4px 4px 0px #000" }}
              >
                <div className="w-16 h-16 bg-pop-yellow border-3 border-pop-black flex items-center justify-center mx-auto mb-4">
                  <ArrowLeftRight className="w-8 h-8 text-pop-black" />
                </div>
                <p className="text-xl font-black text-pop-black font-comic uppercase">
                  No comics for trade
                </p>
                <p className="mt-2 text-gray-600">
                  {tradeSearchQuery
                    ? "Try adjusting your search"
                    : "Check back soon for tradeable comics"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredTradeableComics.map((comic) => (
                  <TradeableComicCard
                    key={comic.id}
                    comic={comic}
                    onClick={() => setSelectedTradeComic(comic)}
                  />
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
        onAuctionUpdated={loadAuctions}
      />

      {/* Listing Detail Modal */}
      <ListingDetailModal
        listingId={selectedListingId || ""}
        isOpen={!!selectedListingId}
        onClose={() => setSelectedListingId(null)}
        onListingUpdated={loadListings}
      />
    </div>
  );
}
