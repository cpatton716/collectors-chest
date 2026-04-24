"use client";

import { useState } from "react";

import Image from "next/image";
import { useRouter } from "next/navigation";

import { useUser } from "@clerk/nextjs";

import { ArrowLeft, DollarSign, Lock, TrendingDown, TrendingUp } from "lucide-react";

import { useCollection } from "@/hooks/useCollection";
import { useSubscription } from "@/hooks/useSubscription";

import { CollectionPageSkeleton } from "@/components/Skeleton";

import { SaleRecord } from "@/types/comic";

export default function SalesPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded: authLoaded } = useUser();
  const { sales, isLoading } = useCollection();
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const { features, tier, isTrialing, startFreeTrial, startCheckout } = useSubscription();
  const hasStatsAccess = features.fullStats;
  const [isStartingUpgrade, setIsStartingUpgrade] = useState(false);

  const handleUpgrade = async () => {
    setIsStartingUpgrade(true);
    if (tier === "free" && !isTrialing) {
      const result = await startFreeTrial();
      if (result.success) {
        window.location.reload();
        return;
      }
    }
    const url = await startCheckout("monthly", tier === "free" && !isTrialing);
    if (url) {
      window.location.href = url;
      return;
    }
    setIsStartingUpgrade(false);
  };

  // Calculate summary stats
  const totalSales = sales.reduce((sum, sale) => sum + sale.salePrice, 0);
  const totalProfit = sales.reduce((sum, sale) => sum + sale.profit, 0);
  const avgProfit = sales.length > 0 ? totalProfit / sales.length : 0;

  const formatPrice = (price: number | null) => {
    if (price === null) return "-";
    return `$${price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!authLoaded || isLoading) {
    return <CollectionPageSkeleton />;
  }

  if (!isSignedIn) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-pop-black mb-4">Sign in to view your sales</h2>
          <p className="text-gray-600">Track your sales history and profit margins</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/collection")}
            className="p-2 border-2 border-pop-black bg-pop-white hover:shadow-[2px_2px_0px_#000] transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-pop-black" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-pop-green border-2 border-pop-black flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-3xl font-black text-pop-black font-comic">SALES HISTORY</h1>
            </div>
            <p className="text-gray-600 mt-1 ml-14">Track your sales and profit margins</p>
          </div>
        </div>
      </div>

      {/* Summary Cards — blurred + overlaid with upgrade CTA for free users.
          Data is still persisted on every sale regardless of tier, so stats
          become available retroactively on upgrade. */}
      <div className="relative mb-8">
        <div
          className={
            hasStatsAccess ? "" : "filter blur-sm pointer-events-none select-none"
          }
          aria-hidden={!hasStatsAccess}
        >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Sales */}
          <div className="bg-pop-white border-2 border-pop-black p-4 shadow-[4px_4px_0px_#000]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-pop-blue border-2 border-pop-black flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-bold text-gray-600 uppercase">Total Sales</span>
            </div>
            <p className="text-3xl font-black text-pop-black">{formatPrice(totalSales)}</p>
            <p className="text-sm text-gray-500">{sales.length} comics sold</p>
          </div>

          {/* Total Profit */}
          <div className="bg-pop-white border-2 border-pop-black p-4 shadow-[4px_4px_0px_#000]">
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`w-8 h-8 ${totalProfit >= 0 ? "bg-pop-green" : "bg-pop-red"} border-2 border-pop-black flex items-center justify-center`}
              >
                {totalProfit >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-white" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-white" />
                )}
              </div>
              <span className="text-sm font-bold text-gray-600 uppercase">Total Profit</span>
            </div>
            <p
              className={`text-3xl font-black ${totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {totalProfit >= 0 ? "+" : ""}
              {formatPrice(totalProfit)}
            </p>
            <p className="text-sm text-gray-500">
              {totalProfit >= 0 ? "Net gain" : "Net loss"} from all sales
            </p>
          </div>

          {/* Average Profit */}
          <div className="bg-pop-white border-2 border-pop-black p-4 shadow-[4px_4px_0px_#000]">
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`w-8 h-8 ${avgProfit >= 0 ? "bg-pop-yellow" : "bg-pop-red"} border-2 border-pop-black flex items-center justify-center`}
              >
                {avgProfit >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-pop-black" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-white" />
                )}
              </div>
              <span className="text-sm font-bold text-gray-600 uppercase">Avg. Profit</span>
            </div>
            <p
              className={`text-3xl font-black ${avgProfit >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {avgProfit >= 0 ? "+" : ""}
              {formatPrice(avgProfit)}
            </p>
            <p className="text-sm text-gray-500">Per comic sold</p>
          </div>
        </div>
        </div>

        {!hasStatsAccess && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div
              className="bg-pop-white border-3 border-pop-black p-6 max-w-sm text-center"
              style={{ boxShadow: "4px 4px 0px #000" }}
            >
              <div className="w-12 h-12 bg-pop-yellow border-2 border-pop-black flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6 text-pop-black" />
              </div>
              <h3 className="text-lg font-black text-pop-black font-comic uppercase mb-2">
                Unlock your Sales Stats
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Total sales, profit, and averages are a Premium feature. Your sale data is
                still being saved, so stats become available instantly on upgrade.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                {tier === "free" && !isTrialing && (
                  <button
                    onClick={handleUpgrade}
                    disabled={isStartingUpgrade}
                    className="px-4 py-2 bg-pop-blue border-2 border-pop-black text-white font-bold text-sm transition-all hover:shadow-[3px_3px_0px_#000] disabled:opacity-50"
                    style={{ boxShadow: "2px 2px 0px #000" }}
                  >
                    {isStartingUpgrade ? "Starting..." : "Start 7-Day Free Trial"}
                  </button>
                )}
                <a
                  href="/pricing"
                  className="px-4 py-2 bg-pop-white border-2 border-pop-black text-pop-black font-bold text-sm transition-all hover:shadow-[3px_3px_0px_#000]"
                  style={{ boxShadow: "2px 2px 0px #000" }}
                >
                  View Pricing
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sales List — always visible regardless of tier. */}
        {sales.length === 0 ? (
          <div className="bg-pop-white border-2 border-pop-black p-8 text-center shadow-[4px_4px_0px_#000]">
            <div className="w-16 h-16 bg-pop-yellow border-2 border-pop-black flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-pop-black" />
            </div>
            <h3 className="text-xl font-black text-pop-black mb-2">No sales yet</h3>
            <p className="text-gray-600">
              When you mark comics as sold, they&apos;ll appear here with profit tracking.
            </p>
          </div>
        ) : (
          <div className="bg-pop-white border-2 border-pop-black shadow-[4px_4px_0px_#000] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-pop-black bg-pop-yellow">
                    <th className="px-4 py-3 text-left text-sm font-black text-pop-black uppercase">
                      Comic
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-black text-pop-black uppercase hidden md:table-cell">
                      Cost
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-black text-pop-black uppercase">
                      Sale Price
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-black text-pop-black uppercase">
                      Profit
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-black text-pop-black uppercase hidden sm:table-cell">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale, index) => (
                    <tr
                      key={sale.id}
                      className={`border-b border-gray-200 transition-colors md:hover:bg-transparent hover:bg-gray-50 md:cursor-default cursor-pointer ${
                        index % 2 === 0 ? "bg-white" : "bg-gray-50"
                      }`}
                      onClick={() => setSelectedSale(selectedSale?.id === sale.id ? null : sale)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {sale.coverImageUrl ? (
                            <div className="w-10 h-14 relative flex-shrink-0 border border-gray-200 rounded overflow-hidden">
                              <Image
                                src={sale.coverImageUrl}
                                alt={sale.comic.title || "Comic cover"}
                                fill
                                className="object-cover"
                                sizes="40px"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-14 bg-gray-200 border border-gray-300 rounded flex items-center justify-center flex-shrink-0">
                              <span className="text-xs text-gray-400">?</span>
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-pop-black truncate">
                              {sale.comic.title || "Unknown Title"}
                            </p>
                            <p className="text-sm text-gray-500">
                              #{sale.comic.issueNumber || "?"}
                              {sale.comic.variant && ` - ${sale.comic.variant}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell">
                        {formatPrice(sale.purchasePrice)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-pop-black">
                        {formatPrice(sale.salePrice)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold ${
                          sale.profit >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {sale.profit >= 0 ? "+" : ""}
                        {formatPrice(sale.profit)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 text-sm hidden sm:table-cell">
                        {formatDate(sale.saleDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Selected Sale Detail (Mobile) */}
        {selectedSale && (
          <div className="mt-4 p-4 bg-pop-white border-2 border-pop-black shadow-[4px_4px_0px_#000] md:hidden">
            <h4 className="font-bold text-pop-black mb-3">Sale Details</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Cost:</span>
                <span className="ml-2 font-bold">{formatPrice(selectedSale.purchasePrice)}</span>
              </div>
              <div>
                <span className="text-gray-500">Sale:</span>
                <span className="ml-2 font-bold">{formatPrice(selectedSale.salePrice)}</span>
              </div>
              <div>
                <span className="text-gray-500">Profit:</span>
                <span
                  className={`ml-2 font-bold ${selectedSale.profit >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {selectedSale.profit >= 0 ? "+" : ""}
                  {formatPrice(selectedSale.profit)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Date:</span>
                <span className="ml-2">{formatDate(selectedSale.saleDate)}</span>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
