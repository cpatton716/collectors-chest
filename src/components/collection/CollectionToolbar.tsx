"use client";

import {
  ArrowLeftRight,
  CheckSquare,
  Filter,
  Grid3X3,
  List,
  Search,
  SortAsc,
  Star,
  X,
} from "lucide-react";

import { CollectionItem } from "@/types/comic";

type ViewMode = "grid" | "list";
type SortOption = "date" | "title" | "value" | "value-asc" | "issue" | "grade";
type FilterOption = "all" | string;

interface CollectionList {
  id: string;
  name: string;
}

interface CollectionToolbarProps {
  // Search
  searchQuery: string;
  setSearchQuery: (value: string) => void;

  // View mode
  viewMode: ViewMode;
  setViewMode: (value: ViewMode) => void;

  // Selection
  enterSelectionMode: () => void;

  // List switcher
  selectedList: string;
  setSelectedList: (value: string) => void;
  lists: CollectionList[];
  collection: CollectionItem[];
  isPrimaryList: (list: { id: string; name: string } | undefined) => boolean;

  // Filters
  activeFilterCount: number;
  setShowFiltersDrawer: (value: boolean) => void;
  sortBy: SortOption;
  setSortBy: (value: SortOption) => void;
  showStarredOnly: boolean;
  setShowStarredOnly: (value: boolean) => void;
  showForTradeOnly: boolean;
  setShowForTradeOnly: (value: boolean) => void;
  publisherFilter: FilterOption;
  setPublisherFilter: (value: FilterOption) => void;
  titleFilter: FilterOption;
  setTitleFilter: (value: FilterOption) => void;
  gradingCompanyFilter: FilterOption;
  setGradingCompanyFilter: (value: FilterOption) => void;
  gradeFilter: FilterOption;
  setGradeFilter: (value: FilterOption) => void;
  uniquePublishers: string[];
  uniqueTitles: string[];
  uniqueGradingCompanies: string[];
  isDefaultListSelected: boolean;
}

/**
 * Presentational filters/search/view toolbar for the collection page (M-FE13).
 * Markup extracted verbatim from CollectionPageContent; parent owns all state.
 */
export function CollectionToolbar({
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
  enterSelectionMode,
  selectedList,
  setSelectedList,
  lists,
  collection,
  isPrimaryList,
  activeFilterCount,
  setShowFiltersDrawer,
  sortBy,
  setSortBy,
  showStarredOnly,
  setShowStarredOnly,
  showForTradeOnly,
  setShowForTradeOnly,
  publisherFilter,
  setPublisherFilter,
  titleFilter,
  setTitleFilter,
  gradingCompanyFilter,
  setGradingCompanyFilter,
  gradeFilter,
  setGradeFilter,
  uniquePublishers,
  uniqueTitles,
  uniqueGradingCompanies,
  isDefaultListSelected,
}: CollectionToolbarProps) {
  return (
    <div className="bg-pop-white border-3 border-pop-black p-4 shadow-[4px_4px_0px_#000] mb-6">
      <div className="flex flex-col gap-3">
        {/* Row 1 - Search + View Toggle + Select (Select desktop-only;
            mobile gets it next to the Viewing dropdown to free space) */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pop-black/50" />
            <input
              type="text"
              placeholder="Search by title, publisher, writer..."
              aria-label="Search collection by title, publisher, or writer"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-1.5 border-2 border-pop-black bg-pop-white font-comic text-sm text-pop-black placeholder:text-pop-black/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-pop-blue focus:shadow-[2px_2px_0px_#000] transition-all"
            />
          </div>

          <div className="flex items-center bg-gray-100 rounded-lg p-1 flex-shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              title="Grid View - Display comics as cover thumbnails"
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
              className={`p-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pop-blue ${
                viewMode === "grid"
                  ? "bg-white shadow-sm text-primary-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Grid3X3 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              title="List View - Display comics in a detailed table format"
              aria-label="List view"
              aria-pressed={viewMode === "list"}
              className={`p-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pop-blue ${
                viewMode === "list"
                  ? "bg-white shadow-sm text-primary-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={enterSelectionMode}
            className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 bg-pop-white border-2 border-pop-black text-pop-black font-bold hover:shadow-[2px_2px_0px_#000] transition-all flex-shrink-0 text-sm"
          >
            <CheckSquare className="w-4 h-4" />
            <span>Select</span>
          </button>
        </div>

        {/* Row 2 - Viewing (list switcher with counts) */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm font-comic font-bold text-pop-black/70 flex-shrink-0">
            Viewing:
          </label>
          <select
            value={selectedList}
            onChange={(e) => setSelectedList(e.target.value)}
            className="px-3 py-1.5 border-2 border-pop-black bg-pop-white text-sm font-comic font-bold text-pop-black focus:outline-none focus-visible:ring-2 focus-visible:ring-pop-blue hover:shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
          >
            {lists.map((list) => {
              const count = isPrimaryList(list)
                ? collection.length
                : collection.filter((item) =>
                    item.listIds.includes(list.id)
                  ).length;
              return (
                <option key={list.id} value={list.id}>
                  {list.name} ({count})
                </option>
              );
            })}
          </select>

          <button
            onClick={enterSelectionMode}
            className="md:hidden ml-auto inline-flex items-center gap-2 px-3 py-1.5 bg-pop-white border-2 border-pop-black text-pop-black font-bold hover:shadow-[2px_2px_0px_#000] transition-all flex-shrink-0 text-sm"
          >
            <CheckSquare className="w-4 h-4" />
            <span>Select</span>
          </button>
        </div>

        {/* Row 3 (mobile) - Filters drawer trigger + inline Sort.
            Sort stays out of the drawer because users change it often. */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={() => setShowFiltersDrawer(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 border-2 border-pop-black bg-pop-white font-comic text-sm font-bold hover:shadow-[2px_2px_0px_#000] transition-all"
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-pop-blue text-white text-xs font-black border border-pop-black min-w-[20px] text-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="flex items-center gap-1.5 ml-auto">
            <SortAsc className="w-4 h-4 text-pop-black flex-shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-2 py-1.5 border-2 border-pop-black bg-pop-white text-sm font-comic text-pop-black focus:outline-none cursor-pointer"
            >
              <option value="date">Date Added</option>
              <option value="title">Title</option>
              <option value="issue">Issue #</option>
              <option value="value">Value (High to Low)</option>
              <option value="value-asc">Value (Low to High)</option>
              <option value="grade">Grade (High to Low)</option>
            </select>
          </div>
        </div>

        {/* Row 3 (desktop) - Filters inline + Sort + Clear */}
        <div className="hidden md:flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowStarredOnly(!showStarredOnly)}
            aria-pressed={showStarredOnly}
            className={`flex items-center gap-1.5 px-3 py-1.5 border-2 border-pop-black font-comic text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pop-blue ${
              showStarredOnly
                ? "bg-pop-yellow text-pop-black shadow-[2px_2px_0px_#000]"
                : "bg-pop-white text-pop-black hover:shadow-[2px_2px_0px_#000]"
            }`}
          >
            <Star
              className={`w-4 h-4 ${showStarredOnly ? "fill-pop-black" : ""}`}
            />
            Starred
          </button>

          <button
            onClick={() => setShowForTradeOnly(!showForTradeOnly)}
            aria-pressed={showForTradeOnly}
            className={`flex items-center gap-1.5 px-3 py-1.5 border-2 border-pop-black font-comic text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pop-blue ${
              showForTradeOnly
                ? "bg-pop-orange text-pop-white shadow-[2px_2px_0px_#000]"
                : "bg-pop-white text-pop-black hover:shadow-[2px_2px_0px_#000]"
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            For Trade
          </button>

          <select
            value={publisherFilter}
            onChange={(e) => setPublisherFilter(e.target.value)}
            className="px-3 py-1.5 border-2 border-pop-black bg-pop-white text-sm font-comic text-pop-black focus:outline-none focus-visible:ring-2 focus-visible:ring-pop-blue hover:shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
          >
            <option value="all">Publishers</option>
            {uniquePublishers.map((publisher) => (
              <option key={publisher} value={publisher}>
                {publisher}
              </option>
            ))}
          </select>

          <select
            value={titleFilter}
            onChange={(e) => setTitleFilter(e.target.value)}
            className="px-3 py-1.5 border-2 border-pop-black bg-pop-white text-sm font-comic text-pop-black focus:outline-none focus-visible:ring-2 focus-visible:ring-pop-blue hover:shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
          >
            <option value="all">Titles</option>
            {uniqueTitles.map((title) => (
              <option key={title} value={title}>
                {title}
              </option>
            ))}
          </select>

          {uniqueGradingCompanies.length > 0 && (
            <select
              value={gradingCompanyFilter}
              onChange={(e) => setGradingCompanyFilter(e.target.value)}
              className="px-3 py-1.5 border-2 border-pop-black bg-pop-white text-sm font-comic text-pop-black focus:outline-none focus-visible:ring-2 focus-visible:ring-pop-blue hover:shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
            >
              <option value="all">Graders</option>
              {uniqueGradingCompanies.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <label className="text-sm font-comic text-pop-black flex items-center gap-1">
              <SortAsc className="w-4 h-4" />
              Sort:
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-1.5 border-2 border-pop-black bg-pop-white text-sm font-comic text-pop-black focus:outline-none focus-visible:ring-2 focus-visible:ring-pop-blue hover:shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
            >
              <option value="date">Date Added</option>
              <option value="title">Title</option>
              <option value="issue">Issue #</option>
              <option value="value">Value (High to Low)</option>
              <option value="value-asc">Value (Low to High)</option>
              <option value="grade">Grade (High to Low)</option>
            </select>
          </div>

          {(publisherFilter !== "all" ||
            titleFilter !== "all" ||
            gradingCompanyFilter !== "all" ||
            gradeFilter !== "all" ||
            showStarredOnly ||
            showForTradeOnly ||
            searchQuery ||
            !isDefaultListSelected) && (
            <button
              onClick={() => {
                setPublisherFilter("all");
                setTitleFilter("all");
                setGradingCompanyFilter("all");
                setGradeFilter("all");
                setShowStarredOnly(false);
                setShowForTradeOnly(false);
                setSearchQuery("");
                setSelectedList("collection");
              }}
              className="text-sm text-primary-600 hover:text-primary-700 underline whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </div>

        {/* Row 4 (mobile only) - Active filter chips with one-tap remove.
            Mirrors the desktop inline filter row so users can see/clear
            what's active without re-opening the drawer. */}
        {activeFilterCount > 0 && (
          <div className="md:hidden flex flex-wrap items-center gap-1.5 pt-3 border-t-2 border-pop-black/20">
            <span className="text-xs font-comic font-bold text-pop-black/60 uppercase mr-1">
              Active:
            </span>
            {showStarredOnly && (
              <button
                onClick={() => setShowStarredOnly(false)}
                className="inline-flex items-center gap-1 px-2 py-1 border-2 border-pop-black bg-pop-yellow text-pop-black text-xs font-bold hover:shadow-[1px_1px_0px_#000] transition-all"
              >
                Starred
                <X className="w-3 h-3" />
              </button>
            )}
            {showForTradeOnly && (
              <button
                onClick={() => setShowForTradeOnly(false)}
                className="inline-flex items-center gap-1 px-2 py-1 border-2 border-pop-black bg-pop-orange text-pop-white text-xs font-bold hover:shadow-[1px_1px_0px_#000] transition-all"
              >
                For Trade
                <X className="w-3 h-3" />
              </button>
            )}
            {publisherFilter !== "all" && (
              <button
                onClick={() => setPublisherFilter("all")}
                className="inline-flex items-center gap-1 px-2 py-1 border-2 border-pop-black bg-pop-white text-pop-black text-xs font-bold hover:shadow-[1px_1px_0px_#000] transition-all"
              >
                {publisherFilter}
                <X className="w-3 h-3" />
              </button>
            )}
            {titleFilter !== "all" && (
              <button
                onClick={() => setTitleFilter("all")}
                className="inline-flex items-center gap-1 px-2 py-1 border-2 border-pop-black bg-pop-white text-pop-black text-xs font-bold hover:shadow-[1px_1px_0px_#000] transition-all"
              >
                {titleFilter}
                <X className="w-3 h-3" />
              </button>
            )}
            {uniqueGradingCompanies.length > 0 &&
              gradingCompanyFilter !== "all" && (
                <button
                  onClick={() => setGradingCompanyFilter("all")}
                  className="inline-flex items-center gap-1 px-2 py-1 border-2 border-pop-black bg-pop-white text-pop-black text-xs font-bold hover:shadow-[1px_1px_0px_#000] transition-all"
                >
                  {gradingCompanyFilter}
                  <X className="w-3 h-3" />
                </button>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
