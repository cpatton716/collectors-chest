"use client";

interface SkeletonProps {
  className?: string;
}

// The base shimmer block is purely decorative — the surrounding container
// carries the role=status/aria-busy announcement (see CollectionPageSkeleton),
// so each individual bar is hidden from assistive tech to avoid noise. L-CC37.
function Skeleton({ className = "" }: SkeletonProps) {
  return <div aria-hidden="true" className={`skeleton rounded ${className}`} />;
}

function ComicCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <Skeleton className="aspect-[2/3] w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );
}

function StatsCardSkeleton() {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 flex items-center gap-4">
      <Skeleton className="w-11 h-11 rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-6 w-20" />
      </div>
    </div>
  );
}

export function CollectionPageSkeleton() {
  return (
    <div role="status" aria-busy="true" className="max-w-7xl mx-auto">
      <span className="sr-only">Loading collection…</span>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[...Array(5)].map((_, i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>

      {/* List Tabs */}
      <div className="flex gap-2 mb-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-32 rounded-lg" />
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <Skeleton className="h-10 flex-1 rounded-lg" />
            <Skeleton className="h-10 w-20 rounded-lg" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-24 rounded-lg" />
            <Skeleton className="h-10 w-32 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {[...Array(12)].map((_, i) => (
          <ComicCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
