"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@clerk/nextjs";

import { ArrowLeftRight, History, Package, Sparkles } from "lucide-react";

import { TradeCard, TradeMatchCard } from "@/components/trading";

import { GroupedMatch, TradePreview } from "@/types/trade";

type TradesTab = "matches" | "active" | "history";

export default function TradesPage() {
  return (
    <Suspense fallback={<TradesPageSkeleton />}>
      <TradesPageContent />
    </Suspense>
  );
}

function TradesPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="mt-6 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white h-32 rounded animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

function TradesPageContent() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TradesTab>("matches");
  const [trades, setTrades] = useState<TradePreview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [matches, setMatches] = useState<GroupedMatch[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);

  // Per-tab caches so switching active <-> history (or back to matches) renders
  // instantly from memory instead of refetching every time. Caches are
  // invalidated by an explicit `force` reload (e.g. after a status change).
  const tradesCache = useRef<{ active?: TradePreview[]; history?: TradePreview[] }>({});
  const matchesCache = useRef<GroupedMatch[] | null>(null);

  const loadTrades = useCallback(
    async (force = false) => {
      const cacheKey = activeTab === "active" ? "active" : "history";
      if (!force && tradesCache.current[cacheKey]) {
        setTrades(tradesCache.current[cacheKey]!);
        return;
      }
      setIsLoading(true);
      try {
        const statuses =
          cacheKey === "active" ? "proposed,accepted,shipped" : "completed,cancelled,declined";

        const response = await fetch(`/api/trades?status=${statuses}`);
        if (response.ok) {
          const data = await response.json();
          const list = data.trades || [];
          tradesCache.current[cacheKey] = list;
          setTrades(list);
        }
      } catch (error) {
        console.error("Error loading trades:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [activeTab]
  );

  // Stable reload that always refetches the current tab (used by child cards
  // after a status change so the cache doesn't serve stale data).
  const reloadTrades = useCallback(() => loadTrades(true), [loadTrades]);

  const loadMatches = useCallback(async (force = false) => {
    if (!force && matchesCache.current) {
      setMatches(matchesCache.current);
      return;
    }
    setIsLoadingMatches(true);
    try {
      const response = await fetch("/api/trades/matches");
      if (response.ok) {
        const data = await response.json();
        const list = data.matches || [];
        matchesCache.current = list;
        setMatches(list);
      }
    } catch (error) {
      console.error("Error loading matches:", error);
    } finally {
      setIsLoadingMatches(false);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && isSignedIn && (activeTab === "active" || activeTab === "history")) {
      loadTrades();
    }
  }, [isLoaded, isSignedIn, activeTab, loadTrades]);

  useEffect(() => {
    if (isLoaded && isSignedIn && activeTab === "matches") {
      loadMatches();
    }
  }, [isLoaded, isSignedIn, activeTab, loadMatches]);

  const handleDismissMatch = (matchId: string) => {
    setMatches((prev) => {
      const next = prev
        .map((group) => ({
          ...group,
          matches: group.matches.filter((m) => m.matchId !== matchId),
        }))
        .filter((group) => group.matches.length > 0);
      matchesCache.current = next;
      return next;
    });
  };

  const handleMessageFromMatch = (userId: string, comicId: string) => {
    router.push(`/messages?user=${userId}&comic=${comicId}`);
  };

  if (!isLoaded) {
    return <TradesPageSkeleton />;
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div
          className="bg-pop-white border-3 border-pop-black p-8 text-center"
          style={{ boxShadow: "4px 4px 0px #000" }}
        >
          <h1 className="text-2xl font-black font-comic mb-4">Sign In Required</h1>
          <p className="text-gray-600 mb-4">Sign in to view and manage your trades</p>
          <Link
            href="/sign-in"
            className="inline-block px-6 py-2 bg-pop-blue text-white font-bold border-2 border-pop-black shadow-[3px_3px_0px_#000]"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-3xl font-black text-pop-black font-comic">TRADES</h1>
        <p className="text-gray-600 mt-1">Manage your comic trades</p>

        {/* Tabs */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={() => setActiveTab("matches")}
            className={`flex items-center gap-2 px-4 py-2 font-bold border-2 border-pop-black transition-all ${
              activeTab === "matches"
                ? "bg-pop-green text-white shadow-[3px_3px_0px_#000]"
                : "bg-pop-white text-pop-black hover:shadow-[2px_2px_0px_#000]"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Matches
            {matches.length > 0 && (
              <span className="ml-1 bg-white text-pop-green text-xs px-1.5 py-0.5 rounded-full font-bold">
                {matches.reduce((sum, g) => sum + g.matches.length, 0)}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("active")}
            className={`flex items-center gap-2 px-4 py-2 font-bold border-2 border-pop-black transition-all ${
              activeTab === "active"
                ? "bg-pop-orange text-white shadow-[3px_3px_0px_#000]"
                : "bg-pop-white text-pop-black hover:shadow-[2px_2px_0px_#000]"
            }`}
          >
            <Package className="w-4 h-4" />
            Active
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-4 py-2 font-bold border-2 border-pop-black transition-all ${
              activeTab === "history"
                ? "bg-pop-blue text-white shadow-[3px_3px_0px_#000]"
                : "bg-pop-white text-pop-black hover:shadow-[2px_2px_0px_#000]"
            }`}
          >
            <History className="w-4 h-4" />
            History
          </button>
        </div>

        {/* Content */}
        <div className="mt-6">
          {activeTab === "matches" && (
            <>
              {isLoadingMatches ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="bg-white border-3 border-pop-black h-32 animate-pulse"
                    />
                  ))}
                </div>
              ) : matches.length === 0 ? (
                <div
                  className="bg-pop-white border-3 border-pop-black p-12 text-center"
                  style={{ boxShadow: "4px 4px 0px #000" }}
                >
                  <div className="w-16 h-16 bg-pop-yellow border-3 border-pop-black flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-pop-black" />
                  </div>
                  <p className="text-xl font-black text-pop-black font-comic uppercase">
                    No matches yet
                  </p>
                  <p className="mt-2 text-gray-600">
                    Mark comics as &quot;For Trade&quot; and add comics to your Key Hunt list to
                    find matches
                  </p>
                  <div className="flex gap-3 justify-center mt-4">
                    <Link
                      href="/collection"
                      className="px-4 py-2 bg-pop-orange text-white font-bold border-2 border-pop-black shadow-[2px_2px_0px_#000]"
                    >
                      My Collection
                    </Link>
                    <Link
                      href="/key-hunt"
                      className="px-4 py-2 bg-pop-blue text-white font-bold border-2 border-pop-black shadow-[2px_2px_0px_#000]"
                    >
                      Key Hunt
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {matches.map((group) => (
                    <TradeMatchCard
                      key={group.myComic?.id}
                      group={group}
                      onDismiss={handleDismissMatch}
                      onMessage={handleMessageFromMatch}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {(activeTab === "active" || activeTab === "history") && (
            <>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="bg-white border-3 border-pop-black h-32 animate-pulse"
                    />
                  ))}
                </div>
              ) : trades.length === 0 ? (
                <div
                  className="bg-pop-white border-3 border-pop-black p-12 text-center"
                  style={{ boxShadow: "4px 4px 0px #000" }}
                >
                  <div className="w-16 h-16 bg-pop-yellow border-3 border-pop-black flex items-center justify-center mx-auto mb-4">
                    <ArrowLeftRight className="w-8 h-8 text-pop-black" />
                  </div>
                  <p className="text-xl font-black text-pop-black font-comic uppercase">
                    {activeTab === "active" ? "No active trades" : "No trade history"}
                  </p>
                  <p className="mt-2 text-gray-600">
                    {activeTab === "active"
                      ? "Start trading by browsing the Shop's For Trade tab"
                      : "Your completed trades will appear here"}
                  </p>
                  {activeTab === "active" && (
                    <Link
                      href="/shop?tab=for-trade"
                      className="inline-block mt-4 px-6 py-2 bg-pop-orange text-white font-bold border-2 border-pop-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] transition-all"
                    >
                      Browse Trades
                    </Link>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {trades.map((trade) => (
                    <TradeCard key={trade.id} trade={trade} onStatusChange={reloadTrades} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
