"use client";

import { useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  BarChart3,
  BookOpen,
  Building,
  Calendar,
  DollarSign,
  ExternalLink,
  KeyRound,
  Search,
  Shield,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { getComicValue } from "@/lib/gradePrice";
import {
  calculateDecadeStats,
  calculateFinancialStats,
  calculateGradingStats,
  calculateKeyComicStats,
  calculateOverviewStats,
  calculatePublisherStats,
  formatCurrency,
  formatPercentage,
} from "@/lib/statsCalculator";

import { CollectionItem } from "@/types/comic";

import { ComicImage } from "./ComicImage";

interface CollectionStatsProps {
  collection: CollectionItem[];
  onComicClick?: (item: CollectionItem) => void;
}

export function CollectionStats({ collection, onComicClick }: CollectionStatsProps) {
  const router = useRouter();
  const [selectedGrades, setSelectedGrades] = useState<Set<string>>(new Set());

  const toggleGrade = (grade: string) => {
    setSelectedGrades((prev) => {
      const next = new Set(prev);
      if (next.has(grade)) {
        next.delete(grade);
      } else {
        next.add(grade);
      }
      return next;
    });
  };

  const searchByGrades = () => {
    if (selectedGrades.size === 0) return;
    const grades = Array.from(selectedGrades).join(",");
    router.push(`/collection?grade=${grades}&sortBy=grade`);
  };

  // Calculate all statistics
  const overview = useMemo(() => calculateOverviewStats(collection), [collection]);
  const publisherStats = useMemo(() => calculatePublisherStats(collection), [collection]);
  const decadeStats = useMemo(() => calculateDecadeStats(collection), [collection]);
  const gradingStats = useMemo(() => calculateGradingStats(collection), [collection]);
  const financialStats = useMemo(() => calculateFinancialStats(collection), [collection]);
  const keyComicStats = useMemo(() => calculateKeyComicStats(collection), [collection]);

  const topPublishers = publisherStats.slice(0, 5);

  if (collection.length === 0) {
    return (
      <div
        className="bg-pop-white border-3 border-pop-black p-12 text-center"
        style={{ boxShadow: "4px 4px 0px #000" }}
      >
        <div className="w-16 h-16 bg-pop-yellow border-3 border-pop-black flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="w-8 h-8 text-pop-black" />
        </div>
        <h3 className="text-xl font-black text-pop-black font-comic uppercase mb-2">
          No Statistics Available
        </h3>
        <p className="text-gray-600 mb-6">
          Add comics to your collection to see detailed statistics.
        </p>
        <button
          onClick={() => router.push("/scan")}
          className="inline-flex items-center gap-2 px-5 py-3 bg-pop-blue border-2 border-pop-black text-white font-bold"
          style={{ boxShadow: "3px 3px 0px #000" }}
        >
          <BookOpen className="w-5 h-5" />
          Add Your First Comic
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Collection Overview */}
      <div
        className="bg-pop-white border-3 border-pop-black p-6"
        style={{ boxShadow: "4px 4px 0px #000" }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-pop-blue border-2 border-pop-black flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-black text-pop-black">Collection Overview</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            label="Total Comics"
            value={overview.totalCount.toString()}
            icon={<BookOpen className="w-5 h-5 text-blue-600" />}
            bgColor="bg-blue-100"
            borderColor="border-blue-200"
          />
          <StatCard
            label="Total Value"
            value={`$${formatCurrency(overview.totalValue)}`}
            icon={<DollarSign className="w-5 h-5 text-green-600" />}
            bgColor="bg-green-100"
            borderColor="border-green-200"
            subtext={overview.unpricedCount > 0 ? `${overview.unpricedCount} unpriced` : undefined}
          />
          <StatCard
            label="Average Value"
            value={`$${formatCurrency(overview.averageValue)}`}
            icon={<TrendingUp className="w-5 h-5 text-purple-600" />}
            bgColor="bg-purple-100"
            borderColor="border-purple-200"
            subtext={`Based on ${overview.pricedCount} priced`}
          />
          {overview.highestValueComic && (
            <div
              className="bg-white rounded-lg p-4 border border-amber-200 cursor-pointer hover:bg-amber-50 transition-colors"
              onClick={() => onComicClick?.(overview.highestValueComic!)}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Award className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-sm text-gray-500">Highest Value</span>
              </div>
              <p className="font-bold text-lg text-gray-900">
                ${formatCurrency(getComicValue(overview.highestValueComic))}
              </p>
              <p className="text-sm text-gray-600 truncate">
                {overview.highestValueComic.comic.title} #
                {overview.highestValueComic.comic.issueNumber}
              </p>
              <div className="flex items-center gap-1 mt-1 text-primary-600 text-xs">
                <ExternalLink className="w-3 h-3" />
                <span>View comic</span>
              </div>
            </div>
          )}
          {overview.lowestValueComic && (
            <div
              className="bg-white rounded-lg p-4 border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => onComicClick?.(overview.lowestValueComic!)}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-gray-600" />
                </div>
                <span className="text-sm text-gray-500">Lowest Value</span>
              </div>
              <p className="font-bold text-lg text-gray-900">
                ${formatCurrency(getComicValue(overview.lowestValueComic))}
              </p>
              <p className="text-sm text-gray-600 truncate">
                {overview.lowestValueComic.comic.title} #
                {overview.lowestValueComic.comic.issueNumber}
              </p>
              <div className="flex items-center gap-1 mt-1 text-primary-600 text-xs">
                <ExternalLink className="w-3 h-3" />
                <span>View comic</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Financial Summary */}
      <div
        className="bg-pop-white border-3 border-pop-black p-6"
        style={{ boxShadow: "4px 4px 0px #000" }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-pop-green border-2 border-pop-black flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-black text-pop-black">Financial Summary</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Cost"
            value={`$${formatCurrency(financialStats.totalPurchaseCost)}`}
            icon={<DollarSign className="w-5 h-5 text-gray-600" />}
            bgColor="bg-gray-100"
            borderColor="border-gray-200"
            subtext={`${financialStats.comicsWithCost} comics with cost`}
          />
          <StatCard
            label="Est. Value"
            value={`$${formatCurrency(financialStats.totalEstimatedValue)}`}
            icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
            bgColor="bg-blue-100"
            borderColor="border-blue-200"
            subtext={`${financialStats.comicsWithValue} comics valued`}
          />
          <StatCard
            label="Unrealized Gain/Loss"
            value={`${financialStats.unrealizedGainLoss >= 0 ? "+" : ""}$${formatCurrency(Math.abs(financialStats.unrealizedGainLoss))}`}
            icon={
              financialStats.unrealizedGainLoss >= 0 ? (
                <ArrowUpRight className="w-5 h-5 text-green-600" />
              ) : (
                <ArrowDownRight className="w-5 h-5 text-red-600" />
              )
            }
            bgColor={financialStats.unrealizedGainLoss >= 0 ? "bg-green-100" : "bg-red-100"}
            borderColor={
              financialStats.unrealizedGainLoss >= 0 ? "border-green-200" : "border-red-200"
            }
            valueColor={financialStats.unrealizedGainLoss >= 0 ? "text-green-600" : "text-red-600"}
          />
          <StatCard
            label="ROI"
            value={`${financialStats.roiPercentage >= 0 ? "+" : ""}${formatPercentage(financialStats.roiPercentage)}%`}
            icon={
              financialStats.roiPercentage >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )
            }
            bgColor={financialStats.roiPercentage >= 0 ? "bg-green-100" : "bg-red-100"}
            borderColor={financialStats.roiPercentage >= 0 ? "border-green-200" : "border-red-200"}
            valueColor={financialStats.roiPercentage >= 0 ? "text-green-600" : "text-red-600"}
          />
        </div>
      </div>

      {/* Two Column Layout for Publisher and Decade Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Publisher */}
        <div
          className="bg-pop-white border-3 border-pop-black p-6"
          style={{ boxShadow: "4px 4px 0px #000" }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-pop-red border-2 border-pop-black flex items-center justify-center">
              <Building className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-black text-pop-black">By Publisher</h2>
          </div>

          {topPublishers.length > 0 ? (
            <div className="space-y-4">
              {topPublishers.map((pub, index) => (
                <div key={pub.publisher} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-500 w-5">{index + 1}.</span>
                      <span className="font-medium text-gray-900">{pub.publisher}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-gray-900">
                        ${formatCurrency(pub.value)}
                      </span>
                      <span className="text-sm text-gray-500 ml-2">({pub.count} comics)</span>
                    </div>
                  </div>
                  <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="absolute h-full bg-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(pub.percentage, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 text-right">
                    {formatPercentage(pub.percentage)}% of value
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No publisher data available</p>
          )}
        </div>

        {/* By Decade */}
        <div
          className="bg-pop-white border-3 border-pop-black p-6"
          style={{ boxShadow: "4px 4px 0px #000" }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-pop-orange border-2 border-pop-black flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-black text-pop-black">By Decade</h2>
          </div>

          {decadeStats.length > 0 ? (
            <div className="space-y-4">
              {decadeStats.map((decade) => (
                <div key={decade.decade} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{decade.decade}</span>
                    <div className="text-right">
                      <span className="font-semibold text-gray-900">
                        ${formatCurrency(decade.value)}
                      </span>
                      <span className="text-sm text-gray-500 ml-2">({decade.count} comics)</span>
                    </div>
                  </div>
                  <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="absolute h-full bg-orange-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(decade.percentage, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 text-right">
                    {formatPercentage(decade.percentage)}% of value
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No decade data available</p>
          )}
        </div>
      </div>

      {/* Grading Breakdown */}
      <div
        className="bg-pop-white border-3 border-pop-black p-6"
        style={{ boxShadow: "4px 4px 0px #000" }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-pop-blue border-2 border-pop-black flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-black text-pop-black">Grading Breakdown</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Raw Comics"
            value={gradingStats.rawCount.toString()}
            icon={<BookOpen className="w-5 h-5 text-gray-600" />}
            bgColor="bg-gray-100"
            borderColor="border-gray-200"
          />
          <StatCard
            label="Slabbed Comics"
            value={gradingStats.slabbedCount.toString()}
            icon={<Shield className="w-5 h-5 text-indigo-600" />}
            bgColor="bg-indigo-100"
            borderColor="border-indigo-200"
          />
          <div className="col-span-2 bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-sm text-gray-500 mb-3">Grading Companies</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div
                className={`rounded-lg p-1 transition-colors ${gradingStats.cgcCount > 0 ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                onClick={gradingStats.cgcCount > 0 ? () => router.push('/collection?gradingCompany=CGC') : undefined}
              >
                <p className="text-lg font-bold text-blue-600">{gradingStats.cgcCount}</p>
                <p className="text-xs text-gray-500">CGC</p>
              </div>
              <div
                className={`rounded-lg p-1 transition-colors ${gradingStats.cbcsCount > 0 ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                onClick={gradingStats.cbcsCount > 0 ? () => router.push('/collection?gradingCompany=CBCS') : undefined}
              >
                <p className="text-lg font-bold text-purple-600">{gradingStats.cbcsCount}</p>
                <p className="text-xs text-gray-500">CBCS</p>
              </div>
              <div
                className={`rounded-lg p-1 transition-colors ${gradingStats.pgxCount > 0 ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                onClick={gradingStats.pgxCount > 0 ? () => router.push('/collection?gradingCompany=PGX') : undefined}
              >
                <p className="text-lg font-bold text-red-600">{gradingStats.pgxCount}</p>
                <p className="text-xs text-gray-500">PGX</p>
              </div>
              <div
                className={`rounded-lg p-1 transition-colors ${gradingStats.otherGradedCount > 0 ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                onClick={gradingStats.otherGradedCount > 0 ? () => router.push('/collection?gradingCompany=Other') : undefined}
              >
                <p className="text-lg font-bold text-gray-600">{gradingStats.otherGradedCount}</p>
                <p className="text-xs text-gray-500">Other</p>
              </div>
            </div>
          </div>
        </div>

        {/* Raw vs Slabbed Visual */}
        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-2">Raw vs Slabbed Distribution</p>
          <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden flex">
            {gradingStats.rawCount > 0 && (
              <div
                className="h-full bg-gray-400 flex items-center justify-center text-white text-xs font-medium"
                style={{ width: `${(gradingStats.rawCount / collection.length) * 100}%` }}
              >
                {gradingStats.rawCount > 0 && `Raw: ${gradingStats.rawCount}`}
              </div>
            )}
            {gradingStats.slabbedCount > 0 && (
              <div
                className="h-full bg-indigo-500 flex items-center justify-center text-white text-xs font-medium"
                style={{ width: `${(gradingStats.slabbedCount / collection.length) * 100}%` }}
              >
                {gradingStats.slabbedCount > 0 && `Slabbed: ${gradingStats.slabbedCount}`}
              </div>
            )}
          </div>
        </div>

        {/* Grade Distribution */}
        {gradingStats.gradeDistribution.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">Grade Distribution (Slabbed Comics)</p>
              {selectedGrades.size > 0 && (
                <button
                  onClick={searchByGrades}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-bold rounded-full hover:bg-indigo-700 transition-colors"
                >
                  <Search className="w-3.5 h-3.5" />
                  View {selectedGrades.size} Grade{selectedGrades.size > 1 ? "s" : ""}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {gradingStats.gradeDistribution.map((g) => (
                <div
                  key={g.grade}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-colors ${
                    selectedGrades.has(g.grade)
                      ? "bg-indigo-600 text-white"
                      : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                  }`}
                  onClick={() => toggleGrade(g.grade)}
                >
                  {g.grade}: {g.count}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Key Comics */}
      <div
        className="bg-pop-white border-3 border-pop-black p-6"
        style={{ boxShadow: "4px 4px 0px #000" }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-pop-yellow border-2 border-pop-black flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-pop-black" />
          </div>
          <h2 className="text-xl font-black text-pop-black">Key Comics</h2>
          <span className="ml-auto px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
            {keyComicStats.keyCount} Key Issues
          </span>
        </div>

        {keyComicStats.topKeyComics.length > 0 ? (
          <div className="space-y-3">
            {keyComicStats.topKeyComics.map((item, index) => (
              <div
                key={item.id}
                onClick={() => onComicClick?.(item)}
                className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <span className="text-lg font-bold text-gray-400 w-6">{index + 1}</span>
                <div className="w-12 h-16 rounded overflow-hidden flex-shrink-0">
                  <ComicImage
                    src={item.coverImageUrl}
                    alt={`${item.comic.title} #${item.comic.issueNumber}`}
                    aspectRatio="fill"
                    sizes="48px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {item.comic.title} #{item.comic.issueNumber}
                  </p>
                  <p className="text-sm text-gray-500 truncate">{item.comic.keyInfo?.join(", ")}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-gray-900">${formatCurrency(getComicValue(item))}</p>
                  <div className="flex items-center gap-1 text-primary-600 text-xs">
                    <ExternalLink className="w-3 h-3" />
                    <span>View</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">
            No key comics in your collection yet. Key comics include first appearances, major
            deaths, and other significant issues.
          </p>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  bgColor: string;
  borderColor: string;
  subtext?: string;
  valueColor?: string;
}

function StatCard({
  label,
  value,
  icon,
  bgColor,
  borderColor,
  subtext,
  valueColor,
}: StatCardProps) {
  return (
    <div className={`bg-white rounded-lg p-4 border ${borderColor}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-2 ${bgColor} rounded-lg`}>{icon}</div>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className={`font-bold text-lg ${valueColor || "text-gray-900"}`}>{value}</p>
      {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
    </div>
  );
}
