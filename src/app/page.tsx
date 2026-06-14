"use client";

import { useEffect, useMemo, useState } from "react";

import Image from "next/image";
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
  Receipt,
  Tag,
  TrendingDown,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";

import { calculateCollectionValue, getComicValue } from "@/lib/gradePrice";
import { storage } from "@/lib/storage";

import { useGuestScans } from "@/hooks/useGuestScans";

import { CollectionItem } from "@/types/comic";

// Duration filter options
type DurationDays = 30 | 60 | 90;


export interface InsightBook {
  item: CollectionItem;
  change: number;
  changePercent: number;
  currentValue: number;
  previousValue: number;
}

export interface BestBuyBook {
  item: CollectionItem;
  roi: number;
  purchasePrice: number;
  currentValue: number;
  profit: number;
}

export interface HomeStats {
  totalComics: number;
  totalValue: number;
  unpricedCount: number;
  totalCost: number;
  profitLoss: number;
  profitLossPercent: number;
}

// ---------------------------------------------------------------------------
// Pure collection-insight calculations. Extracted to module scope so they are
// referentially stable (no per-render closures) and unit-testable. The
// component memoizes their results via useMemo. See audit refs M-FE5 / L-FE16.
// ---------------------------------------------------------------------------

/** Roll up collection totals, cost basis, and profit/loss. */
export function computeHomeStats(collection: CollectionItem[]): HomeStats {
  const collectionValue = calculateCollectionValue(collection);
  const totalCost = collection.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);
  const profitLoss = collectionValue.totalValue - totalCost;
  const profitLossPercent = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;
  return {
    totalComics: collection.length,
    totalValue: collectionValue.totalValue,
    unpricedCount: collectionValue.unpricedCount,
    totalCost,
    profitLoss,
    profitLossPercent,
  };
}

// Simulate historical value change based on the selected lookback window.
// In production this would use actual price history from the database.
export function getBiggestIncrease(
  collection: CollectionItem[],
  days: DurationDays
): InsightBook | null {
  const booksWithValue = collection.filter(
    (item) => item.comic.priceData?.estimatedValue && item.comic.priceData.estimatedValue > 0
  );
  if (booksWithValue.length === 0) return null;

  const multiplier = days === 30 ? 0.92 : days === 60 ? 0.88 : 0.82;
  let biggest: InsightBook | null = null;

  for (const item of booksWithValue) {
    const currentValue = getComicValue(item);
    const previousValue = currentValue * multiplier;
    const change = currentValue - previousValue;
    const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0;
    if (!biggest || change > biggest.change) {
      biggest = { item, change, changePercent, currentValue, previousValue };
    }
  }
  return biggest;
}

export function getBiggestDecline(
  collection: CollectionItem[],
  days: DurationDays
): InsightBook | null {
  const booksWithValue = collection.filter(
    (item) => item.comic.priceData?.estimatedValue && item.comic.priceData.estimatedValue > 0
  );
  if (booksWithValue.length === 0) return null;

  const declineMultiplier = days === 30 ? 1.05 : days === 60 ? 1.1 : 1.15;
  let biggest: InsightBook | null = null;

  for (const item of booksWithValue) {
    const currentValue = getComicValue(item);
    const previousValue = currentValue * declineMultiplier;
    const change = currentValue - previousValue; // negative
    const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0;
    if (!biggest || change < biggest.change) {
      biggest = { item, change, changePercent, currentValue, previousValue };
    }
  }
  return biggest;
}

export function getBestBuy(collection: CollectionItem[]): BestBuyBook | null {
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

  // Redirect signed-in users to their collection. Runs before any heavy
  // collection/insight work below so we don't render-and-discard the guest
  // marketing view (or compute insights) for a user we're about to navigate
  // away. See audit ref M-FE6.
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

  // Calculate stats from collection using grade-aware pricing. Memoized so the
  // O(n) roll-up only re-runs when the collection actually changes, not on
  // every unrelated re-render (modal open/close, duration toggle). M-FE5.
  const stats = useMemo(() => computeHomeStats(collection), [collection]);
  const profitLoss = stats.profitLoss;
  const profitLossPercent = stats.profitLossPercent;

  const biggestIncrease = useMemo(
    () => getBiggestIncrease(collection, increaseDuration),
    [collection, increaseDuration]
  );
  const biggestDecline = useMemo(
    () => getBiggestDecline(collection, declineDuration),
    [collection, declineDuration]
  );
  const bestBuy = useMemo(() => getBestBuy(collection), [collection]);

  // While the signed-in redirect is in flight, skip the heavy guest/dashboard
  // render entirely. M-FE6.
  if (isLoaded && isSignedIn) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="text-center py-12">
        <div className="inline-block mb-6">
          <h1
            className="font-comic text-5xl md:text-7xl text-pop-yellow tracking-wide"
            style={{
              textShadow:
                "-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000, " +
                "-3px 0 0 #000, 3px 0 0 #000, 0 -3px 0 #000, 0 3px 0 #000, " +
                "5px 5px 0 #000",
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
                : "SCAN YOUR FIRST BOOK!"}
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
                aria-label={`Biggest increase: ${biggestIncrease.item.comic.title} #${biggestIncrease.item.comic.issueNumber}, up $${biggestIncrease.change.toFixed(2)}. View details.`}
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
                    <Image
                      src={biggestIncrease.item.coverImageUrl}
                      alt=""
                      width={40}
                      height={56}
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
                aria-label={`Best buy: ${bestBuy.item.comic.title} #${bestBuy.item.comic.issueNumber}, ${bestBuy.roi.toFixed(0)} percent ROI. View details.`}
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
                    <Image
                      src={bestBuy.item.coverImageUrl}
                      alt=""
                      width={40}
                      height={56}
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
                aria-label={`Biggest decline: ${biggestDecline.item.comic.title} #${biggestDecline.item.comic.issueNumber}, down $${Math.abs(biggestDecline.change).toFixed(2)}. View details.`}
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
                    <Image
                      src={biggestDecline.item.coverImageUrl}
                      alt=""
                      width={40}
                      height={56}
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
            <div className="relative overflow-hidden bg-pop-white border-4 border-pop-black shadow-[6px_6px_0px_#000] p-6 text-center">
              <div className="absolute top-0 left-0 w-20 h-20 dots-blue opacity-20 pointer-events-none" />
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
          <div className="relative overflow-hidden bg-pop-white border-4 border-pop-black shadow-[6px_6px_0px_#000] p-8 mb-8 max-w-4xl mx-auto">
            <div className="absolute bottom-0 right-0 w-24 h-24 dots-red opacity-25 pointer-events-none" />
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
          <div className="relative overflow-hidden comic-panel bg-pop-white p-4">
            <div className="absolute top-0 right-0 w-16 h-16 dots-red opacity-20 pointer-events-none" />
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

          <div className="relative overflow-hidden comic-panel bg-pop-white p-4">
            <div className="absolute bottom-0 left-0 w-20 h-20 dots-blue opacity-30 pointer-events-none" />
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
                    <Image
                      src={item.coverImageUrl}
                      alt={`${item.comic.title} #${item.comic.issueNumber}`}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                      className="object-cover"
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
                <Image
                  src={biggestIncrease.item.coverImageUrl}
                  alt=""
                  width={96}
                  height={144}
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
                <Image
                  src={bestBuy.item.coverImageUrl}
                  alt=""
                  width={96}
                  height={144}
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
                <Image
                  src={biggestDecline.item.coverImageUrl}
                  alt=""
                  width={96}
                  height={144}
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
