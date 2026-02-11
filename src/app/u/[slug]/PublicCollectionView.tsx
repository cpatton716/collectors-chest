"use client";

import { useState } from "react";

import {
  BookOpen,
  Building,
  Calendar,
  DollarSign,
  Grid3X3,
  List,
  Search,
  User,
} from "lucide-react";

import { useAuth } from "@clerk/nextjs";

import { PublicCollectionStats, PublicProfile } from "@/lib/db";

import { ComicImage } from "@/components/ComicImage";
import { FollowButton } from "@/components/follows";
import { PublicComicCard } from "@/components/PublicComicCard";
import { PublicComicModal } from "@/components/PublicComicModal";

import { CollectionItem, UserList } from "@/types/comic";

interface Props {
  profile: PublicProfile;
  comics: CollectionItem[];
  lists: UserList[];
  stats: PublicCollectionStats;
}

type ViewMode = "grid" | "list";
type SortOption = "date" | "title" | "value";

export function PublicCollectionView({ profile, comics, lists, stats }: Props) {
  const { userId } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [selectedList, setSelectedList] = useState<string>("all");
  const [selectedComic, setSelectedComic] = useState<CollectionItem | null>(null);

  const displayName = profile.publicDisplayName || profile.displayName || profile.username || "A Collector";

  // Filter and sort comics
  const filteredComics = comics
    .filter((item) => {
      // Filter by list
      if (selectedList !== "all") {
        if (!item.listIds.includes(selectedList)) return false;
      }

      // Filter by search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          item.comic.title?.toLowerCase().includes(query) ||
          item.comic.publisher?.toLowerCase().includes(query) ||
          item.comic.writer?.toLowerCase().includes(query) ||
          item.comic.issueNumber?.includes(query)
        );
      }

      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "title":
          return (a.comic.title || "").localeCompare(b.comic.title || "");
        case "value":
          return (
            (b.comic.priceData?.estimatedValue || 0) - (a.comic.priceData?.estimatedValue || 0)
          );
        case "date":
        default:
          return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
      }
    });

  return (
    <div className="max-w-7xl mx-auto">
      {/* Profile Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-10 h-10 text-white" />
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              {displayName}&apos;s Collection
            </h1>
            {profile.publicBio && <p className="text-gray-600 mt-2">{profile.publicBio}</p>}
            <p className="text-sm text-gray-400 mt-2">
              Member since{" "}
              {new Date(profile.createdAt).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </p>
            {userId && userId !== profile.id && (
              <div className="mt-3">
                <FollowButton userId={profile.id} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-200 flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-lg">
            <BookOpen className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Comics</p>
            <p className="text-xl font-bold text-gray-900">{stats.totalComics}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-green-200 flex items-center gap-3">
          <div className="p-3 bg-green-100 rounded-lg">
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Est. Value</p>
            <p className="text-xl font-bold text-gray-900">
              $
              {stats.totalValue.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-purple-200 flex items-center gap-3 min-w-0">
          <div className="p-3 bg-purple-100 rounded-lg shrink-0">
            <Building className="w-5 h-5 text-purple-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-gray-500">Top Publisher</p>
            <p className="text-lg font-bold text-gray-900 truncate">
              {stats.topPublishers[0]?.publisher || "N/A"}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-orange-200 flex items-center gap-3">
          <div className="p-3 bg-orange-100 rounded-lg">
            <Calendar className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Year Range</p>
            <p className="text-lg font-bold text-gray-900">
              {stats.oldestComic && stats.newestComic
                ? `${stats.oldestComic.year}-${stats.newestComic.year}`
                : "N/A"}
            </p>
          </div>
        </div>
      </div>

      {/* Top Publishers */}
      {stats.topPublishers.length > 1 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Collection Breakdown</h3>
          <div className="flex flex-wrap gap-2">
            {stats.topPublishers.map(({ publisher, count }) => (
              <span
                key={publisher}
                className="px-3 py-1.5 bg-gray-100 rounded-full text-sm text-gray-700"
              >
                {publisher}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title, publisher, writer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {/* List Filter */}
          {lists.length > 0 && (
            <select
              value={selectedList}
              onChange={(e) => setSelectedList(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-sm text-gray-900"
            >
              <option value="all">All Comics</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          )}

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-sm text-gray-900"
          >
            <option value="date">Recently Added</option>
            <option value="title">Title A-Z</option>
            <option value="value">Highest Value</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-md transition-colors ${
                viewMode === "grid"
                  ? "bg-white shadow-sm text-primary-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Grid3X3 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-md transition-colors ${
                viewMode === "list"
                  ? "bg-white shadow-sm text-primary-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Collection Display */}
      {filteredComics.length === 0 ? (
        <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {searchQuery ? "No comics match your search" : "No comics to display"}
          </h3>
          <p className="text-gray-600">
            {searchQuery
              ? "Try adjusting your search terms"
              : "This collection appears to be empty"}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredComics.map((item) => (
            <PublicComicCard key={item.id} item={item} onClick={() => setSelectedComic(item)} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <div className="col-span-6">Comic</div>
            <div className="col-span-3">Publisher</div>
            <div className="col-span-3 text-right">Est. Value</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-gray-100">
            {filteredComics.map((item) => {
              const { comic } = item;
              const estimatedValue = comic.priceData?.estimatedValue;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedComic(item)}
                  className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors items-center"
                >
                  {/* Comic Info */}
                  <div className="col-span-6 flex items-center gap-3">
                    <div className="w-10 h-14 flex-shrink-0 rounded overflow-hidden">
                      <ComicImage
                        src={item.coverImageUrl}
                        alt={`${comic.title} #${comic.issueNumber}`}
                        aspectRatio="fill"
                        sizes="40px"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {comic.title || "Unknown Title"}
                      </p>
                      <p className="text-sm text-gray-500">
                        Issue #{comic.issueNumber || "?"}
                        {comic.variant && <span className="text-gray-400"> - {comic.variant}</span>}
                      </p>
                    </div>
                  </div>

                  {/* Publisher */}
                  <div className="col-span-3">
                    <p className="text-sm text-gray-600 truncate">{comic.publisher || "Unknown"}</p>
                    {comic.releaseYear && (
                      <p className="text-xs text-gray-400">{comic.releaseYear}</p>
                    )}
                  </div>

                  {/* Est. Value */}
                  <div className="col-span-3 text-right">
                    {estimatedValue ? (
                      <p className="font-medium text-gray-900">${estimatedValue.toFixed(2)}</p>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="text-center mt-6 text-sm text-gray-500">
        Showing {filteredComics.length} of {comics.length} comics
      </div>

      {/* Comic Detail Modal */}
      {selectedComic && (
        <PublicComicModal item={selectedComic} onClose={() => setSelectedComic(null)} />
      )}
    </div>
  );
}
