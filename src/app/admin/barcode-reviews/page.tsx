"use client";

import { useEffect, useState } from "react";

import Image from "next/image";
import Link from "next/link";

import { useUser } from "@clerk/nextjs";

import {
  AlertTriangle,
  ArrowLeft,
  Barcode,
  Check,
  CheckCircle,
  Edit2,
  Loader2,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";

interface BarcodeReview {
  id: string;
  barcode_catalog_id: string;
  detected_upc: string;
  corrected_upc: string | null;
  cover_image_url: string;
  comic_title: string | null;
  comic_issue: string | null;
  status: "pending" | "approved" | "corrected" | "rejected";
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function BarcodeReviewsPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [reviews, setReviews] = useState<BarcodeReview[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedUpc, setEditedUpc] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");

  useEffect(() => {
    fetchReviews();
  }, [statusFilter]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  async function fetchReviews(page = 1) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/barcode-reviews?${params}`);
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("Access denied. Admin privileges required.");
        }
        throw new Error("Failed to fetch reviews");
      }

      const data = await res.json();
      setReviews(data.reviews);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch reviews");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(reviewId: string, action: "approve" | "correct" | "reject") {
    setUpdating(reviewId);
    setError(null);

    try {
      const body: Record<string, string> = { reviewId, action };

      if (action === "correct") {
        if (!editedUpc || editedUpc.replace(/\D/g, "").length < 12) {
          throw new Error("Please enter a valid UPC (at least 12 digits)");
        }
        body.correctedUpc = editedUpc.replace(/\D/g, "");
      }

      if (adminNotes) {
        body.adminNotes = adminNotes;
      }

      const res = await fetch("/api/admin/barcode-reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update review");
      }

      setSuccessMessage(
        action === "approve"
          ? "Barcode approved!"
          : action === "correct"
            ? "Barcode corrected and approved!"
            : "Barcode rejected and removed."
      );

      // Reset editing state
      setEditingId(null);
      setEditedUpc("");
      setAdminNotes("");

      // Refresh list
      fetchReviews(pagination?.page || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update review");
    } finally {
      setUpdating(null);
    }
  }

  function startEditing(review: BarcodeReview) {
    setEditingId(review.id);
    setEditedUpc(review.detected_upc);
    setAdminNotes("");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditedUpc("");
    setAdminNotes("");
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Please sign in to access this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/usage"
          className="flex items-center gap-2 text-pop-black font-bold hover:underline mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Link>
        <h1 className="text-3xl font-black text-pop-black font-comic flex items-center gap-3">
          <Barcode className="w-8 h-8" />
          BARCODE REVIEWS
        </h1>
        <p className="text-gray-600 mt-2">
          Review and verify barcodes detected from cover scans with low/medium confidence.
        </p>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border-2 border-green-500 rounded-lg flex items-center gap-2 text-green-700">
          <CheckCircle className="w-5 h-5" />
          {successMessage}
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border-2 border-red-500 rounded-lg flex items-center gap-2 text-red-700">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {["pending", "approved", "corrected", "rejected"].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
              statusFilter === status
                ? "bg-pop-blue text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {status}
          </button>
        ))}
        <button
          onClick={() => fetchReviews(pagination?.page || 1)}
          className="ml-auto px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Reviews List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Barcode className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No {statusFilter} reviews found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="bg-white border-2 border-pop-black p-4 rounded-lg"
              style={{ boxShadow: "3px 3px 0px #000" }}
            >
              <div className="flex gap-4">
                {/* Cover Image */}
                <div className="w-24 h-36 flex-shrink-0 bg-gray-100 rounded overflow-hidden relative">
                  {review.cover_image_url ? (
                    <Image
                      src={review.cover_image_url}
                      alt="Comic cover"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      No image
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-lg">
                        {review.comic_title || "Unknown Title"}
                        {review.comic_issue && ` #${review.comic_issue}`}
                      </h3>
                      <p className="text-gray-500 text-sm">
                        Submitted {new Date(review.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                        review.status === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : review.status === "approved"
                            ? "bg-green-100 text-green-800"
                            : review.status === "corrected"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-red-100 text-red-800"
                      }`}
                    >
                      {review.status}
                    </span>
                  </div>

                  {/* UPC Display */}
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <label className="text-xs font-bold text-gray-500 uppercase">Detected UPC</label>
                    {editingId === review.id ? (
                      <input
                        type="text"
                        value={editedUpc}
                        onChange={(e) => setEditedUpc(e.target.value)}
                        className="w-full mt-1 px-3 py-2 font-mono text-lg border-2 border-pop-black rounded focus:outline-none focus:ring-2 focus:ring-pop-blue"
                        placeholder="Enter corrected UPC"
                      />
                    ) : (
                      <p className="font-mono text-lg mt-1">{review.detected_upc}</p>
                    )}
                    {review.corrected_upc && (
                      <p className="text-sm text-blue-600 mt-1">
                        Corrected to: <span className="font-mono">{review.corrected_upc}</span>
                      </p>
                    )}
                  </div>

                  {/* Admin Notes Input (when editing) */}
                  {editingId === review.id && (
                    <div className="mt-3">
                      <label className="text-xs font-bold text-gray-500 uppercase">Admin Notes (optional)</label>
                      <textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border-2 border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-pop-blue"
                        rows={2}
                        placeholder="Add any notes about this review..."
                      />
                    </div>
                  )}

                  {/* Display existing admin notes */}
                  {review.admin_notes && !editingId && (
                    <p className="mt-2 text-sm text-gray-600 italic">
                      Note: {review.admin_notes}
                    </p>
                  )}

                  {/* Action Buttons */}
                  {review.status === "pending" && (
                    <div className="mt-4 flex gap-2">
                      {editingId === review.id ? (
                        <>
                          <button
                            onClick={() => handleAction(review.id, "correct")}
                            disabled={updating === review.id}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white font-bold rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
                          >
                            {updating === review.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                            Save Correction
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 font-bold rounded hover:bg-gray-300 transition-colors"
                          >
                            <X className="w-4 h-4" />
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleAction(review.id, "approve")}
                            disabled={updating === review.id}
                            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white font-bold rounded hover:bg-green-600 disabled:opacity-50 transition-colors"
                          >
                            {updating === review.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            Approve
                          </button>
                          <button
                            onClick={() => startEditing(review)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white font-bold rounded hover:bg-blue-600 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit & Approve
                          </button>
                          <button
                            onClick={() => handleAction(review.id, "reject")}
                            disabled={updating === review.id}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white font-bold rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
                          >
                            {updating === review.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => fetchReviews(pagination.page - 1)}
            disabled={pagination.page === 1 || loading}
            className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => fetchReviews(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages || loading}
            className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
