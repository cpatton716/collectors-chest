"use client";

import { useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import { useAuth } from "@clerk/nextjs";

import { Clock, Gavel, Heart } from "lucide-react";

import { AuctionCard } from "@/components/auction/AuctionCard";
import { AuctionDetailModal } from "@/components/auction/AuctionDetailModal";

import { WatchlistItem, calculateTimeRemaining } from "@/types/auction";

export default function WatchlistPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (isSignedIn) {
      loadWatchlist();
    }
  }, [isSignedIn]);

  const loadWatchlist = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/watchlist");
      if (response.ok) {
        const data = await response.json();
        setWatchlist(data.watchlist || []);
      }
    } catch (error) {
      console.error("Error loading watchlist:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWatchlistChange = (auctionId: string, isWatching: boolean) => {
    if (!isWatching) {
      setWatchlist((prev) => prev.filter((w) => w.auctionId !== auctionId));
    }
  };

  // Bucket each item exactly once per render instead of calling
  // calculateTimeRemaining three times per item across separate filters.
  // Declared before the loading early-return so the hook order stays stable.
  // L-MK24.
  const { endingSoon, others, ended } = useMemo(() => {
    const soon: WatchlistItem[] = [];
    const active: WatchlistItem[] = [];
    const done: WatchlistItem[] = [];
    const DAY_MS = 24 * 60 * 60 * 1000;

    for (const w of watchlist) {
      if (!w.auction) {
        done.push(w);
        continue;
      }
      const remaining = calculateTimeRemaining(w.auction.endTime);
      if (remaining.isEnded) {
        done.push(w);
      } else if (remaining.totalMs <= DAY_MS) {
        soon.push(w);
      } else {
        active.push(w);
      }
    }

    return { endingSoon: soon, others: active, ended: done };
  }, [watchlist]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Heart className="w-6 h-6 text-red-500" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Watchlist</h1>
              <p className="text-gray-600 mt-1">
                {watchlist.length} auction{watchlist.length !== 1 ? "s" : ""} watched
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
        ) : watchlist.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Heart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">Your watchlist is empty</p>
            <p className="mt-2">Add auctions to your watchlist to track them here</p>
            <button
              onClick={() => router.push("/shop")}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Browse Auctions
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Ending Soon */}
            {endingSoon.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-orange-500" />
                  <h2 className="text-lg font-semibold text-gray-900">Ending Soon</h2>
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs rounded-full">
                    {endingSoon.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {endingSoon.map((item) =>
                    item.auction ? (
                      <AuctionCard
                        key={item.id}
                        auction={{ ...item.auction, isWatching: true }}
                        onClick={() => setSelectedAuctionId(item.auctionId)}
                        onWatchlistChange={handleWatchlistChange}
                      />
                    ) : null
                  )}
                </div>
              </div>
            )}

            {/* Other Active */}
            {others.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Gavel className="w-5 h-5 text-blue-500" />
                  <h2 className="text-lg font-semibold text-gray-900">Active Auctions</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {others.map((item) =>
                    item.auction ? (
                      <AuctionCard
                        key={item.id}
                        auction={{ ...item.auction, isWatching: true }}
                        onClick={() => setSelectedAuctionId(item.auctionId)}
                        onWatchlistChange={handleWatchlistChange}
                      />
                    ) : null
                  )}
                </div>
              </div>
            )}

            {/* Ended */}
            {ended.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-500 mb-4">Ended ({ended.length})</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 opacity-60">
                  {ended.map((item) =>
                    item.auction ? (
                      <AuctionCard
                        key={item.id}
                        auction={{ ...item.auction, isWatching: true }}
                        onClick={() => setSelectedAuctionId(item.auctionId)}
                        onWatchlistChange={handleWatchlistChange}
                      />
                    ) : null
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Auction Detail Modal */}
      <AuctionDetailModal
        auctionId={selectedAuctionId || ""}
        isOpen={!!selectedAuctionId}
        onClose={() => setSelectedAuctionId(null)}
        onAuctionUpdated={loadWatchlist}
      />
    </div>
  );
}
