"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useUser } from "@clerk/nextjs";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Camera,
  ChevronRight,
  Clock,
  DollarSign,
  Flame,
  Loader2,
  Receipt,
  RefreshCw,
  Tag,
  TrendingDown,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";

import { calculateCollectionValue, getComicValue } from "@/lib/gradePrice";
import { formatCurrency } from "@/lib/statsCalculator";
import { storage } from "@/lib/storage";

import { useGuestScans } from "@/hooks/useGuestScans";

import { CollectionItem } from "@/types/comic";

// Duration filter options
type DurationDays = 30 | 60 | 90;

// Hottest books client-side cache (24 hours)
const HOT_BOOKS_CACHE_KEY = "hottest_books_cache";
const HOT_BOOKS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in ms

interface HotBooksCache {
  books: HotBook[];
  timestamp: number;
}

function getCachedHotBooks(): HotBook[] | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(HOT_BOOKS_CACHE_KEY);
    if (!cached) return null;

    const { books, timestamp }: HotBooksCache = JSON.parse(cached);
    const age = Date.now() - timestamp;

    if (age < HOT_BOOKS_CACHE_TTL) {
      return books;
    }
    // Cache expired, remove it
    localStorage.removeItem(HOT_BOOKS_CACHE_KEY);
    return null;
  } catch {
    return null;
  }
}

function setCachedHotBooks(books: HotBook[]): void {
  if (typeof window === "undefined") return;
  try {
    const cache: HotBooksCache = {
      books,
      timestamp: Date.now(),
    };
    localStorage.setItem(HOT_BOOKS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage might be full or disabled
  }
}

interface InsightBook {
  item: CollectionItem;
  change: number;
  changePercent: number;
  currentValue: number;
  previousValue: number;
}

interface BestBuyBook {
  item: CollectionItem;
  roi: number;
  purchasePrice: number;
  currentValue: number;
  profit: number;
}

interface HotBook {
  rank: number;
  title: string;
  issueNumber: string;
  publisher: string;
  year: string;
  keyFacts: string[];
  whyHot: string;
  priceRange: {
    low: number;
    mid: number;
    high: number;
  };
  coverImageUrl?: string;
}

export default function Home() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const { count: guestScanCount } = useGuestScans();
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<CollectionItem[]>([]);
  const [salesStats, setSalesStats] = useState({ totalSales: 0, totalRevenue: 0, totalProfit: 0 });

  // Insight modals state
  const [showBiggestIncrease, setShowBiggestIncrease] = useState(false);
  const [showBestBuy, setShowBestBuy] = useState(false);
  const [showBiggestDecline, setShowBiggestDecline] = useState(false);
  const [increaseDuration, setIncreaseDuration] = useState<DurationDays>(30);
  const [declineDuration, setDeclineDuration] = useState<DurationDays>(30);

  // Hottest books state
  const [hotBooks, setHotBooks] = useState<HotBook[]>([]);
  const [hotBooksLoading, setHotBooksLoading] = useState(true);
  const [hotBooksError, setHotBooksError] = useState<string | null>(null);

  // Redirect signed-in users to their collection
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/collection");
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    // Only load collection data for signed-in users
    if (isLoaded && isSignedIn) {
      setCollection(storage.getCollection());
      setRecentlyViewed(storage.getRecentlyViewedItems());
      setSalesStats(storage.getSalesStats());
    } else {
      // Clear data for logged-out users
      setCollection([]);
      setRecentlyViewed([]);
      setSalesStats({ totalSales: 0, totalRevenue: 0, totalProfit: 0 });
    }
  }, [isLoaded, isSignedIn]);

  // Fetch hottest books for all users (with client-side caching)
  useEffect(() => {
    const fetchHotBooks = async () => {
      // Check client-side cache first (prevents unnecessary API calls)
      const cached = getCachedHotBooks();
      if (cached && cached.length > 0) {
        setHotBooks(cached);
        setHotBooksLoading(false);
        return;
      }

      setHotBooksLoading(true);
      setHotBooksError(null);
      try {
        const response = await fetch("/api/hottest-books");
        const data = await response.json();
        if (data.error) {
          setHotBooksError(data.error);
        } else {
          const books = data.books || [];
          setHotBooks(books);
          // Cache the result in localStorage for 24 hours
          if (books.length > 0) {
            setCachedHotBooks(books);
          }
        }
      } catch (err) {
        console.error("Error fetching hot books:", err);
        setHotBooksError("Couldn't load hottest books");
      } finally {
        setHotBooksLoading(false);
      }
    };
    fetchHotBooks();
  }, []);

  // Calculate stats from collection using grade-aware pricing
  const collectionValue = calculateCollectionValue(collection);
  const stats = {
    totalComics: collection.length,
    totalValue: collectionValue.totalValue,
    unpricedCount: collectionValue.unpricedCount,
    totalCost: collection.reduce((sum, item) => sum + (item.purchasePrice || 0), 0),
  };
  const profitLoss = stats.totalValue - stats.totalCost;
  const profitLossPercent = stats.totalCost > 0 ? (profitLoss / stats.totalCost) * 100 : 0;

  // Calculate biggest increase (simulated based on current value vs "historical")
  // In production, this would use actual price history data
  const getBiggestIncrease = (days: DurationDays): InsightBook | null => {
    const booksWithValue = collection.filter(
      (item) => item.comic.priceData?.estimatedValue && item.comic.priceData.estimatedValue > 0
    );

    if (booksWithValue.length === 0) return null;

    // Simulate historical value change based on days
    // In production, use actual price history from database
    const multiplier = days === 30 ? 0.92 : days === 60 ? 0.88 : 0.82;

    let biggest: InsightBook | null = null;

    for (const item of booksWithValue) {
      const currentValue = getComicValue(item);
      // Simulate previous value (in production, fetch from price history)
      const previousValue = currentValue * multiplier;
      const change = currentValue - previousValue;
      const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0;

      if (!biggest || change > biggest.change) {
        biggest = { item, change, changePercent, currentValue, previousValue };
      }
    }

    return biggest;
  };

  // Calculate biggest decline
  const getBiggestDecline = (days: DurationDays): InsightBook | null => {
    const booksWithValue = collection.filter(
      (item) => item.comic.priceData?.estimatedValue && item.comic.priceData.estimatedValue > 0
    );

    if (booksWithValue.length === 0) return null;

    // Simulate some books declining in value
    // In production, use actual price history from database
    const declineMultiplier = days === 30 ? 1.05 : days === 60 ? 1.1 : 1.15;

    let biggest: InsightBook | null = null;

    for (const item of booksWithValue) {
      const currentValue = getComicValue(item);
      // Simulate previous value being higher (decline)
      const previousValue = currentValue * declineMultiplier;
      const change = currentValue - previousValue; // This will be negative
      const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0;

      if (!biggest || change < biggest.change) {
        biggest = { item, change, changePercent, currentValue, previousValue };
      }
    }

    return biggest;
  };

  // Calculate best buy (best ROI)
  const getBestBuy = (): BestBuyBook | null => {
    const booksWithPurchasePrice = collection.filter(
      (item) => item.purchasePrice && item.purchasePrice > 0 && item.comic.priceData?.estimatedValue
    );

    if (booksWithPurchasePrice.length === 0) return null;

    let best: BestBuyBook | null = null;

    for (const item of booksWithPurchasePrice) {
      const currentValue = getComicValue(item);
      const purchasePrice = item.purchasePrice!;
      const profit = currentValue - purchasePrice;
      const roi = (profit / purchasePrice) * 100;

      if (!best || roi > best.roi) {
        best = { item, roi, purchasePrice, currentValue, profit };
      }
    }

    return best;
  };

  const biggestIncrease = getBiggestIncrease(increaseDuration);
  const biggestDecline = getBiggestDecline(declineDuration);
  const bestBuy = getBestBuy();

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="text-center py-12">
        <div className="inline-block mb-6">
          <h1
            className="font-comic text-5xl md:text-7xl text-pop-yellow tracking-wide"
            style={{
              WebkitTextStroke: "3px black",
              paintOrder: "stroke fill",
              textShadow: "4px 4px 0px #000",
            }}
          >
            {isLoaded && isSignedIn ? "YOUR CHEST!" : "COLLECTORS CHEST!"}
          </h1>
        </div>
        <div className="speech-bubble max-w-2xl mx-auto mb-8 !shadow-comic-lg">
          <p className="text-xl font-body text-pop-black">
            {isLoaded && isSignedIn
              ? "Your collection at a glance. Track value changes, see your best investments, and discover what's hot in the market."
              : "Scan comics. Track value. Collect smarter."}
          </p>
          {isLoaded && !isSignedIn && (
            <p className="text-sm font-body text-gray-600 mt-2">
              Snap a photo of any comic cover to instantly identify it, track what it&#39;s worth, and manage your entire collection in one place.
            </p>
          )}
        </div>

        {/* Scan CTA */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <Link href="/scan" className="btn-pop btn-pop-blue text-xl px-8 py-4">
            <Camera className="w-6 h-6" />
            {isLoaded && isSignedIn
              ? "SCAN A BOOK!"
              : guestScanCount > 0
                ? "SCAN ANOTHER!"
                : "SCAN YOUR FIRST!"}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        {/* Collection Insights Cards - Only for signed-in users with collection */}
        {isLoaded && isSignedIn && stats.totalComics > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto">
            {/* Biggest Increase Card */}
            {biggestIncrease && (
              <button
                onClick={() => setShowBiggestIncrease(true)}
                className="comic-panel bg-pop-white p-4 text-left hover:shadow-comic-lg"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-pop-green border-2 border-pop-black">
                    <TrendingUp className="w-5 h-5 text-pop-white" />
                  </div>
                  <div>
                    <p className="text-xs font-comic text-pop-black">BIGGEST INCREASE</p>
                    <p className="text-lg font-comic text-pop-green">
                      +${biggestIncrease.change.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {biggestIncrease.item.coverImageUrl && (
                    <img
                      src={biggestIncrease.item.coverImageUrl}
                      alt=""
                      className="w-10 h-14 object-cover border-2 border-pop-black"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-comic text-pop-black truncate">
                      {biggestIncrease.item.comic.title?.toUpperCase()}
                    </p>
                    <p className="text-xs font-body text-pop-black/70">
                      #{biggestIncrease.item.comic.issueNumber}
                    </p>
                  </div>
                </div>
              </button>
            )}

            {/* Best Buy Card */}
            {bestBuy && (
              <button
                onClick={() => setShowBestBuy(true)}
                className="comic-panel bg-pop-white p-4 text-left hover:shadow-comic-lg"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-pop-blue border-2 border-pop-black">
                    <Trophy className="w-5 h-5 text-pop-yellow" />
                  </div>
                  <div>
                    <p className="text-xs font-comic text-pop-black">BEST BUY</p>
                    <p className="text-lg font-comic text-pop-blue">
                      +{bestBuy.roi.toFixed(0)}% ROI
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {bestBuy.item.coverImageUrl && (
                    <img
                      src={bestBuy.item.coverImageUrl}
                      alt=""
                      className="w-10 h-14 object-cover border-2 border-pop-black"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-comic text-pop-black truncate">
                      {bestBuy.item.comic.title?.toUpperCase()}
                    </p>
                    <p className="text-xs font-body text-pop-black/70">
                      #{bestBuy.item.comic.issueNumber}
                    </p>
                  </div>
                </div>
              </button>
            )}

            {/* Biggest Decline Card */}
            {biggestDecline && (
              <button
                onClick={() => setShowBiggestDecline(true)}
                className="comic-panel bg-pop-white p-4 text-left hover:shadow-comic-lg"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-pop-red border-2 border-pop-black">
                    <TrendingDown className="w-5 h-5 text-pop-white" />
                  </div>
                  <div>
                    <p className="text-xs font-comic text-pop-black">BIGGEST DECLINE</p>
                    <p className="text-lg font-comic text-pop-red">
                      ${biggestDecline.change.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {biggestDecline.item.coverImageUrl && (
                    <img
                      src={biggestDecline.item.coverImageUrl}
                      alt=""
                      className="w-10 h-14 object-cover border-2 border-pop-black"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-comic text-pop-black truncate">
                      {biggestDecline.item.comic.title?.toUpperCase()}
                    </p>
                    <p className="text-xs font-body text-pop-black/70">
                      #{biggestDecline.item.comic.issueNumber}
                    </p>
                  </div>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Features - Only shown to non-logged-in users */}
        {isLoaded && !isSignedIn && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 max-w-4xl mx-auto">
            <div className="bg-pop-white border-4 border-pop-black shadow-[6px_6px_0px_#000] p-6 text-center">
              <div className="w-16 h-16 bg-pop-red border-3 border-pop-black shadow-comic-sm flex items-center justify-center mx-auto mb-4">
                <Camera className="w-8 h-8 text-pop-white" />
              </div>
              <h3 className="font-comic text-lg text-pop-black mb-2">TECHNOPATHIC RECOGNITION</h3>
              <p className="font-body text-pop-black/80">
                Upload a photo and we&apos;ll instantly identify the title, issue #, publisher,
                creators, key info, and more.
              </p>
            </div>

            <div className="bg-pop-white border-4 border-pop-black shadow-[6px_6px_0px_#000] p-6 text-center">
              <div className="w-16 h-16 bg-pop-red border-3 border-pop-black shadow-comic-sm flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-pop-white" />
              </div>
              <h3 className="font-comic text-lg text-pop-black mb-2">TRACK VALUES</h3>
              <p className="font-body text-pop-black/80">
                Monitor the market value of your comics with price history charts and alerts for
                significant changes.
              </p>
            </div>

            <div className="bg-pop-white border-4 border-pop-black shadow-[6px_6px_0px_#000] p-6 text-center">
              <div className="w-16 h-16 bg-pop-red border-3 border-pop-black shadow-comic-sm flex items-center justify-center mx-auto mb-4">
                <Tag className="w-8 h-8 text-pop-white" />
              </div>
              <h3 className="font-comic text-lg text-pop-black mb-2">BUY & SELL</h3>
              <p className="font-body text-pop-black/80">
                List your comics for sale and connect with other collectors. Secure transactions
                powered by Stripe.
              </p>
            </div>
          </div>
        )}

        {/* How It Works - Only shown to non-logged-in users */}
        {isLoaded && !isSignedIn && (
          <div className="bg-pop-white border-4 border-pop-black shadow-[6px_6px_0px_#000] p-8 mb-8 max-w-4xl mx-auto">
            <h2 className="font-comic text-3xl text-pop-black text-center mb-8">HOW IT WORKS!</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-pop-red text-pop-white border-3 border-pop-black shadow-comic-sm flex items-center justify-center mx-auto mb-3 font-comic text-xl">
                  1
                </div>
                <h4 className="font-comic text-pop-black mb-1">UPLOAD PHOTO</h4>
                <p className="text-sm font-body text-pop-black/80">
                  Take a photo or upload an image of your comic cover
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-pop-red text-pop-white border-3 border-pop-black shadow-comic-sm flex items-center justify-center mx-auto mb-3 font-comic text-xl">
                  2
                </div>
                <h4 className="font-comic text-pop-black mb-1">ANALYZE</h4>
                <p className="text-sm font-body text-pop-black/80">
                  Uses our Technopathy to identify the book&apos;s details
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-pop-red text-pop-white border-3 border-pop-black shadow-comic-sm flex items-center justify-center mx-auto mb-3 font-comic text-xl">
                  3
                </div>
                <h4 className="font-comic text-pop-black mb-1">VERIFY & EDIT</h4>
                <p className="text-sm font-body text-pop-black/80">
                  Review the details and make any necessary corrections
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-pop-red text-pop-white border-3 border-pop-black shadow-comic-sm flex items-center justify-center mx-auto mb-3 font-comic text-xl">
                  4
                </div>
                <h4 className="font-comic text-pop-black mb-1">SAVE & TRACK</h4>
                <p className="text-sm font-body text-pop-black/80">
                  Add to your collection and track its value over time
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Collection Value Dashboard - Prominent Card for Logged-in Users */}
      {isLoaded && isSignedIn && stats.totalComics > 0 && (
        <div className="mb-8">
          <div className="bg-pop-blue border-4 border-pop-black shadow-comic-lg p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="font-comic text-lg text-pop-yellow mb-1">COLLECTION VALUE</h2>
                <div className="flex items-baseline gap-2">
                  <span className="font-comic text-4xl md:text-5xl text-pop-white">
                    $
                    {stats.totalValue.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  {stats.unpricedCount > 0 && (
                    <span className="text-sm text-pop-white/75 font-body">
                      ({stats.unpricedCount} unpriced)
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="font-comic text-3xl text-pop-white">{stats.totalComics}</p>
                  <p className="text-sm font-body text-pop-white/75">Comics</p>
                </div>
                <div className="h-12 w-px bg-pop-white/20" />
                <Link href="/collection" className="btn-pop btn-pop-yellow">
                  <BookOpen className="w-5 h-5" />
                  VIEW COLLECTION
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats.totalComics > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
          <div className="comic-panel bg-pop-white p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-pop-blue border-2 border-pop-black">
                <BookOpen className="w-5 h-5 text-pop-white" />
              </div>
              <div>
                <p className="text-xs font-comic text-pop-black/70">COMICS</p>
                <p className="text-xl font-comic text-pop-black">{stats.totalComics}</p>
              </div>
            </div>
          </div>

          <div className="comic-panel bg-pop-white p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-pop-pink border-2 border-pop-black">
                <DollarSign className="w-5 h-5 text-pop-white" />
              </div>
              <div>
                <p className="text-xs font-comic text-pop-black/70">TOTAL COST</p>
                <p className="text-xl font-comic text-pop-black">
                  $
                  {stats.totalCost.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="comic-panel bg-pop-white p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-pop-green border-2 border-pop-black">
                <TrendingUp className="w-5 h-5 text-pop-white" />
              </div>
              <div>
                <p className="text-xs font-comic text-pop-black/70">EST. VALUE</p>
                <p className="text-xl font-comic text-pop-black">
                  $
                  {stats.totalValue.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="comic-panel bg-pop-white p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-pop-orange border-2 border-pop-black">
                <Receipt className="w-5 h-5 text-pop-white" />
              </div>
              <div>
                <p className="text-xs font-comic text-pop-black/70">
                  SALES ({salesStats.totalSales})
                </p>
                <p className="text-xl font-comic text-pop-black">
                  ${salesStats.totalRevenue.toFixed(2)}
                </p>
                {salesStats.totalProfit !== 0 && (
                  <p
                    className={`text-xs font-body ${salesStats.totalProfit >= 0 ? "text-pop-green" : "text-pop-red"}`}
                  >
                    {salesStats.totalProfit >= 0 ? "+" : ""}${salesStats.totalProfit.toFixed(2)}{" "}
                    profit
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="comic-panel bg-pop-white p-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 border-2 border-pop-black ${profitLoss >= 0 ? "bg-pop-green" : "bg-pop-red"}`}
              >
                {profitLoss >= 0 ? (
                  <ArrowUpRight className="w-5 h-5 text-pop-white" />
                ) : (
                  <ArrowDownRight className="w-5 h-5 text-pop-white" />
                )}
              </div>
              <div>
                <p className="text-xs font-comic text-pop-black/70">PROFIT/LOSS</p>
                <p
                  className={`text-xl font-comic ${profitLoss >= 0 ? "text-pop-green" : "text-pop-red"}`}
                >
                  {profitLoss >= 0 ? "+" : ""}
                  {profitLoss.toFixed(2)}
                </p>
                {stats.totalCost > 0 && (
                  <p
                    className={`text-xs font-body ${profitLoss >= 0 ? "text-pop-green" : "text-pop-red"}`}
                  >
                    {profitLoss >= 0 ? "+" : ""}
                    {profitLossPercent.toFixed(1)}%
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Professor's Hottest Books - Inline List */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-pop-red border-3 border-pop-black shadow-comic-sm">
              <Flame className="w-6 h-6 text-pop-yellow" />
            </div>
            <div>
              <h2 className="font-comic text-2xl text-pop-black">
                PROFESSOR&apos;S HOTTEST BOOKS!
              </h2>
              <p className="text-sm font-body text-pop-black/70">
                Weekly market analysis of the most in-demand comics
              </p>
            </div>
          </div>
          <Link href="/hottest-books" className="btn-pop btn-pop-blue text-sm">
            VIEW ALL
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {hotBooksLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-pop-red" />
          </div>
        ) : hotBooksError ? (
          <div className="text-center py-8">
            <p className="font-body text-pop-black/70 mb-2">{hotBooksError}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn-pop btn-pop-yellow text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              TRY AGAIN
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {hotBooks.slice(0, 5).map((book) => (
              <Link
                key={book.rank}
                href="/hottest-books"
                className="comic-panel bg-pop-white p-4 hover:shadow-comic-lg"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 bg-pop-red border-2 border-pop-black shadow-comic-sm flex items-center justify-center text-pop-white font-comic text-lg flex-shrink-0">
                    {book.rank}
                  </div>
                  {book.coverImageUrl && (
                    <img
                      src={book.coverImageUrl}
                      alt={`${book.title} #${book.issueNumber}`}
                      className="w-12 h-18 object-cover border-2 border-pop-black shadow-comic-sm"
                    />
                  )}
                </div>
                <h3 className="font-comic text-pop-black text-sm leading-tight mb-1">
                  {book.title?.toUpperCase()} #{book.issueNumber}
                </h3>
                <p className="text-xs font-body text-pop-black/70 mb-2">{book.publisher}</p>
                <div className="price-tag text-sm">
                  <DollarSign className="w-3 h-3" />
                  <span>${formatCurrency(book.priceRange.mid)}</span>
                  <span className="text-pop-black/60 text-xs">mid</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recently Viewed */}
      {recentlyViewed.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-comic text-xl text-pop-black flex items-center gap-2">
              <Clock className="w-5 h-5 text-pop-blue" />
              RECENTLY VIEWED
            </h2>
            <Link href="/collection" className="btn-pop btn-pop-blue text-sm">
              VIEW ALL
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {recentlyViewed.map((item) => (
              <div
                key={item.id}
                onClick={() => router.push("/collection")}
                className="comic-card cursor-pointer"
              >
                <div className="aspect-[2/3] bg-pop-cream relative border-b-3 border-pop-black">
                  {item.coverImageUrl ? (
                    <img
                      src={item.coverImageUrl}
                      alt={`${item.comic.title} #${item.comic.issueNumber}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center dots-red">
                      <span className="font-comic text-4xl text-pop-blue text-comic-outline">
                        ?
                      </span>
                    </div>
                  )}
                  {item.comic.priceData?.estimatedValue && (
                    <div className="absolute bottom-2 right-2">
                      <span className="price-tag text-sm">
                        ${item.comic.priceData.estimatedValue.toFixed(0)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-2 bg-pop-white">
                  <p className="font-comic text-pop-black text-sm truncate">
                    {item.comic.title?.toUpperCase()}
                  </p>
                  <p className="text-xs font-body text-pop-black/70">#{item.comic.issueNumber}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Biggest Increase Modal */}
      {showBiggestIncrease && biggestIncrease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-pop-black/70"
            onClick={() => setShowBiggestIncrease(false)}
          />
          <div className="relative comic-panel bg-pop-white max-w-sm w-full p-6">
            <button
              onClick={() => setShowBiggestIncrease(false)}
              className="absolute top-4 right-4 p-1 bg-pop-red border-2 border-pop-black shadow-comic-sm hover:shadow-comic transition-all"
            >
              <X className="w-5 h-5 text-pop-white" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-pop-green border-2 border-pop-black">
                <TrendingUp className="w-5 h-5 text-pop-white" />
              </div>
              <h3 className="font-comic text-lg text-pop-black">BIGGEST INCREASE</h3>
            </div>

            {/* Duration Filter */}
            <div className="flex gap-2 mb-4">
              {([30, 60, 90] as DurationDays[]).map((days) => (
                <button
                  key={days}
                  onClick={() => setIncreaseDuration(days)}
                  className={`px-3 py-1 font-comic text-sm border-2 border-pop-black transition-all ${
                    increaseDuration === days
                      ? "bg-pop-green text-pop-white shadow-comic-sm"
                      : "bg-pop-white text-pop-black hover:bg-pop-green/20"
                  }`}
                >
                  {days} DAYS
                </button>
              ))}
            </div>

            {/* Book Info */}
            <div className="flex gap-4 mb-4">
              {biggestIncrease.item.coverImageUrl && (
                <img
                  src={biggestIncrease.item.coverImageUrl}
                  alt=""
                  className="w-24 h-36 object-cover border-3 border-pop-black shadow-comic"
                />
              )}
              <div>
                <h4 className="font-comic text-pop-black">
                  {biggestIncrease.item.comic.title?.toUpperCase()}
                </h4>
                <p className="text-sm font-body text-pop-black/70 mb-3">
                  #{biggestIncrease.item.comic.issueNumber}
                </p>
                <div className="space-y-1">
                  <p className="font-comic text-2xl text-pop-green">
                    +${biggestIncrease.change.toFixed(2)}
                  </p>
                  <p className="text-sm font-body text-pop-green">
                    +{biggestIncrease.changePercent.toFixed(1)}%
                  </p>
                  <p className="text-xs font-body text-pop-black/70">
                    Current: ${biggestIncrease.currentValue.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Best Buy Modal */}
      {showBestBuy && bestBuy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-pop-black/70" onClick={() => setShowBestBuy(false)} />
          <div className="relative comic-panel bg-pop-white max-w-sm w-full p-6">
            <button
              onClick={() => setShowBestBuy(false)}
              className="absolute top-4 right-4 p-1 bg-pop-red border-2 border-pop-black shadow-comic-sm hover:shadow-comic transition-all"
            >
              <X className="w-5 h-5 text-pop-white" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-pop-blue border-2 border-pop-black">
                <Trophy className="w-5 h-5 text-pop-yellow" />
              </div>
              <h3 className="font-comic text-lg text-pop-black">BEST BUY!</h3>
            </div>

            <p className="text-sm font-body text-pop-black/70 mb-4">
              Highest ROI based on purchase price
            </p>

            {/* Book Info */}
            <div className="flex gap-4 mb-4">
              {bestBuy.item.coverImageUrl && (
                <img
                  src={bestBuy.item.coverImageUrl}
                  alt=""
                  className="w-24 h-36 object-cover border-3 border-pop-black shadow-comic"
                />
              )}
              <div>
                <h4 className="font-comic text-pop-black">
                  {bestBuy.item.comic.title?.toUpperCase()}
                </h4>
                <p className="text-sm font-body text-pop-black/70 mb-3">
                  #{bestBuy.item.comic.issueNumber}
                </p>
                <div className="space-y-1">
                  <p className="font-comic text-2xl text-pop-blue">
                    +{bestBuy.roi.toFixed(0)}% ROI
                  </p>
                  <div className="text-xs font-body text-pop-black/70 space-y-0.5">
                    <p>Paid: ${bestBuy.purchasePrice.toFixed(2)}</p>
                    <p>Value: ${bestBuy.currentValue.toFixed(2)}</p>
                    <p className="text-pop-green font-medium">
                      Profit: +${bestBuy.profit.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Biggest Decline Modal */}
      {showBiggestDecline && biggestDecline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-pop-black/70"
            onClick={() => setShowBiggestDecline(false)}
          />
          <div className="relative comic-panel bg-pop-white max-w-sm w-full p-6">
            <button
              onClick={() => setShowBiggestDecline(false)}
              className="absolute top-4 right-4 p-1 bg-pop-red border-2 border-pop-black shadow-comic-sm hover:shadow-comic transition-all"
            >
              <X className="w-5 h-5 text-pop-white" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-pop-red border-2 border-pop-black">
                <TrendingDown className="w-5 h-5 text-pop-white" />
              </div>
              <h3 className="font-comic text-lg text-pop-black">BIGGEST DECLINE</h3>
            </div>

            {/* Duration Filter */}
            <div className="flex gap-2 mb-4">
              {([30, 60, 90] as DurationDays[]).map((days) => (
                <button
                  key={days}
                  onClick={() => setDeclineDuration(days)}
                  className={`px-3 py-1 font-comic text-sm border-2 border-pop-black transition-all ${
                    declineDuration === days
                      ? "bg-pop-red text-pop-white shadow-comic-sm"
                      : "bg-pop-white text-pop-black hover:bg-pop-red/20"
                  }`}
                >
                  {days} DAYS
                </button>
              ))}
            </div>

            {/* Book Info */}
            <div className="flex gap-4 mb-4">
              {biggestDecline.item.coverImageUrl && (
                <img
                  src={biggestDecline.item.coverImageUrl}
                  alt=""
                  className="w-24 h-36 object-cover border-3 border-pop-black shadow-comic"
                />
              )}
              <div>
                <h4 className="font-comic text-pop-black">
                  {biggestDecline.item.comic.title?.toUpperCase()}
                </h4>
                <p className="text-sm font-body text-pop-black/70 mb-3">
                  #{biggestDecline.item.comic.issueNumber}
                </p>
                <div className="space-y-1">
                  <p className="font-comic text-2xl text-pop-red">
                    ${biggestDecline.change.toFixed(2)}
                  </p>
                  <p className="text-sm font-body text-pop-red">
                    {biggestDecline.changePercent.toFixed(1)}%
                  </p>
                  <p className="text-xs font-body text-pop-black/70">
                    Current: ${biggestDecline.currentValue.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
