"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Check, X, ImageIcon } from "lucide-react";

interface PendingCover {
  id: string;
  title_normalized: string;
  issue_number: string;
  image_url: string;
  source_query: string | null;
  created_at: string;
}

export default function AdminCoverQueuePage() {
  const [covers, setCovers] = useState<PendingCover[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchCovers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cover-queue");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCovers(data.covers);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to load cover queue:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCovers();
  }, [fetchCovers]);

  const handleAction = async (coverId: string, action: "approve" | "reject") => {
    setProcessing(coverId);
    try {
      const res = await fetch("/api/admin/cover-queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverId, action }),
      });
      if (!res.ok) throw new Error("Failed to process");
      setCovers((prev) => prev.filter((c) => c.id !== coverId));
      setTotal((prev) => prev - 1);
    } catch (err) {
      console.error("Failed to process cover:", err);
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-comic font-bold mb-4">Cover Queue</h1>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-comic font-bold">Cover Queue</h1>
        <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
          {total} pending
        </span>
      </div>

      {covers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No covers pending review</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {covers.map((cover) => (
            <div
              key={cover.id}
              className="border-2 border-black rounded-lg overflow-hidden bg-white"
            >
              <div className="relative aspect-[2/3] bg-gray-100">
                <Image
                  src={cover.image_url}
                  alt={`${cover.title_normalized} #${cover.issue_number}`}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>

              <div className="p-3 border-t-2 border-black">
                <p className="font-comic font-bold capitalize">
                  {cover.title_normalized}
                </p>
                <p className="text-sm text-gray-600">
                  Issue #{cover.issue_number}
                </p>
                {cover.source_query && (
                  <p className="text-xs text-gray-400 mt-1 truncate">
                    Query: {cover.source_query}
                  </p>
                )}
                <p className="text-xs text-gray-400">
                  {new Date(cover.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex border-t-2 border-black">
                <button
                  onClick={() => handleAction(cover.id, "approve")}
                  disabled={processing === cover.id}
                  className="flex-1 flex items-center justify-center gap-1 py-2 bg-green-500 text-white font-bold hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={() => handleAction(cover.id, "reject")}
                  disabled={processing === cover.id}
                  className="flex-1 flex items-center justify-center gap-1 py-2 bg-red-500 text-white font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
