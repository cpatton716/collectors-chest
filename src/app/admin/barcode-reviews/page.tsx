"use client";

import { useEffect, useState } from "react";

import Image from "next/image";
import Link from "next/link";

import { useUser } from "@clerk/nextjs";

import {
  AlertTriangle,
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--pop-blue)" }} />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="comic-panel p-8 text-center max-w-md">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--pop-red)" }} />
          <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-bangers)" }}>
            Sign In Required
          </h1>
          <p className="mb-6">Please sign in to access this page.</p>
          <Link href="/sign-in" className="btn-pop btn-pop-red">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <header className="border-b-4 border-black mb-6" style={{ background: "var(--pop-yellow)" }}>
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Barcode className="w-8 h-8" />
            <div>
              <h1
                className="text-2xl font-bold tracking-wide"
                style={{ fontFamily: "var(--font-bangers)" }}
              >
                Barcode Reviews
              </h1>
              <p className="text-sm">Review barcodes detected from cover scans.</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4">
        {/* Success/Error Messages */}
        {successMessage && (
          <div
            className="comic-panel p-4 mb-6"
            style={{ borderColor: "var(--pop-green)", background: "#f0fff0" }}
          >
            <div className="flex items-center gap-2" style={{ color: "var(--pop-green)" }}>
              <CheckCircle className="w-5 h-5" />
              <p className="font-bold">{successMessage}</p>
            </div>
          </div>
        )}
        {error && (
          <div
            className="comic-panel p-4 mb-6"
            style={{ borderColor: "var(--pop-red)", background: "#fff0f0" }}
          >
            <div className="flex items-center gap-2" style={{ color: "var(--pop-red)" }}>
              <AlertTriangle className="w-5 h-5" />
              <p className="font-bold">{error}</p>
            </div>
          </div>
        )}

        {/* Status Filter Tabs */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {["pending", "approved", "corrected", "rejected"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 font-bold capitalize transition-colors border-3 border-black ${
                  statusFilter === status
                    ? "text-white"
                    : "bg-white hover:bg-gray-100"
                }`}
                style={
                  statusFilter === status
                    ? { background: "var(--pop-blue)", fontFamily: "var(--font-bangers)" }
                    : { fontFamily: "var(--font-bangers)" }
                }
              >
                {status}
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchReviews(pagination?.page || 1)}
            className="btn-pop btn-pop-white text-sm flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Reviews List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--pop-blue)" }} />
          </div>
        ) : reviews.length === 0 ? (
          <div className="comic-panel p-8 text-center">
            <Barcode className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3
              className="text-xl font-bold mb-1"
              style={{ fontFamily: "var(--font-bangers)" }}
            >
              No {statusFilter} reviews
            </h3>
            <p>Nothing to show here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="comic-panel overflow-hidden">
                <div className="p-4">
                  <div className="flex gap-4">
                    {/* Cover Image */}
                    <div className="w-24 h-36 flex-shrink-0 border-2 border-black overflow-hidden relative">
                      {review.cover_image_url ? (
                        <Image
                          src={review.cover_image_url}
                          alt="Comic cover"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
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
                          className={`badge-pop text-xs ${
                            review.status === "pending"
                              ? "badge-pop-yellow"
                              : review.status === "approved"
                                ? "badge-pop-green"
                                : review.status === "corrected"
                                  ? "badge-pop-blue"
                                  : "badge-pop-red"
                          }`}
                        >
                          {review.status}
                        </span>
                      </div>

                      {/* UPC Display */}
                      <div
                        className="mt-3 p-3 border-2 border-black"
                        style={{ background: "var(--pop-cream)" }}
                      >
                        <label className="text-xs font-bold uppercase">Detected UPC</label>
                        {editingId === review.id ? (
                          <input
                            type="text"
                            value={editedUpc}
                            onChange={(e) => setEditedUpc(e.target.value)}
                            className="w-full mt-1 px-3 py-2 font-mono text-lg border-3 border-black focus:outline-none text-gray-900"
                            placeholder="Enter corrected UPC"
                          />
                        ) : (
                          <p className="font-mono text-lg mt-1">{review.detected_upc}</p>
                        )}
                        {review.corrected_upc && (
                          <p className="text-sm mt-1" style={{ color: "var(--pop-blue)" }}>
                            Corrected to: <span className="font-mono">{review.corrected_upc}</span>
                          </p>
                        )}
                      </div>

                      {/* Admin Notes Input (when editing) */}
                      {editingId === review.id && (
                        <div className="mt-3">
                          <label className="text-xs font-bold uppercase">Admin Notes (optional)</label>
                          <textarea
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            className="w-full mt-1 px-3 py-2 border-3 border-black text-gray-900"
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
                        <div className="mt-4 flex gap-2 border-t-3 border-black pt-4">
                          {editingId === review.id ? (
                            <>
                              <button
                                onClick={() => handleAction(review.id, "correct")}
                                disabled={updating === review.id}
                                className="btn-pop btn-pop-blue flex items-center gap-2 disabled:opacity-50"
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
                                className="btn-pop btn-pop-white flex items-center gap-2"
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
                                className="btn-pop btn-pop-green flex items-center gap-2 disabled:opacity-50"
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
                                className="btn-pop btn-pop-blue flex items-center gap-2"
                              >
                                <Edit2 className="w-4 h-4" />
                                Edit & Approve
                              </button>
                              <button
                                onClick={() => handleAction(review.id, "reject")}
                                disabled={updating === review.id}
                                className="btn-pop btn-pop-red flex items-center gap-2 disabled:opacity-50"
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
              className="btn-pop btn-pop-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span
              className="px-4 py-2 font-bold"
              style={{ fontFamily: "var(--font-bangers)" }}
            >
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => fetchReviews(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages || loading}
              className="btn-pop btn-pop-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
