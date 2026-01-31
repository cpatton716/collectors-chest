"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { useUser } from "@clerk/nextjs";

import {
  AlertTriangle,
  Check,
  CheckCircle,
  Clock,
  Database,
  ExternalLink,
  KeyRound,
  Loader2,
  MessageSquare,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";

interface Submission {
  id: string;
  userId: string;
  title: string;
  issueNumber: string;
  publisher?: string;
  suggestedKeyInfo: string[];
  sourceUrl?: string;
  notes?: string;
  createdAt: string;
}

interface Counts {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

interface CustomKeyInfoComic {
  id: string;
  title: string;
  issueNumber: string;
  publisher?: string;
  coverImageUrl?: string;
  existingKeyInfo: string[];
  customKeyInfo: string[];
  userId: string;
  createdAt: string;
}

export default function AdminKeyInfoPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [counts, setCounts] = useState<Counts>({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [keyComicsCount, setKeyComicsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  // Custom key info from user comics
  const [customKeyInfoComics, setCustomKeyInfoComics] = useState<CustomKeyInfoComic[]>([]);
  const [customCounts, setCustomCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [activeTab, setActiveTab] = useState<"submissions" | "custom">("submissions");

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch both submissions and custom key info in parallel
      const [submissionsRes, customRes] = await Promise.all([
        fetch("/api/admin/key-info"),
        fetch("/api/admin/custom-key-info"),
      ]);

      const submissionsData = await submissionsRes.json();
      const customData = await customRes.json();

      if (!submissionsRes.ok) {
        if (submissionsRes.status === 403) {
          setError("You do not have permission to access this page");
        } else {
          throw new Error(submissionsData.error || "Failed to load");
        }
        return;
      }

      setSubmissions(submissionsData.submissions);
      setCounts(submissionsData.counts);
      setKeyComicsCount(submissionsData.keyComicsCount);

      if (customRes.ok) {
        setCustomKeyInfoComics(customData.comics || []);
        setCustomCounts(customData.counts || { pending: 0, approved: 0, rejected: 0 });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load submissions");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchData();
    }
  }, [isLoaded, isSignedIn]);

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      const response = await fetch(`/api/admin/key-info/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to approve");
      }

      // Remove from list and update counts
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      setCounts((prev) => ({
        ...prev,
        pending: prev.pending - 1,
        approved: prev.approved + 1,
      }));
      setKeyComicsCount((prev) => prev + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectionReason.trim()) {
      alert("Please provide a rejection reason");
      return;
    }

    setProcessingId(id);
    try {
      const response = await fetch(`/api/admin/key-info/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: rejectionReason }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to reject");
      }

      // Remove from list and update counts
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      setCounts((prev) => ({
        ...prev,
        pending: prev.pending - 1,
        rejected: prev.rejected + 1,
      }));
      setRejectingId(null);
      setRejectionReason("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setProcessingId(null);
    }
  };

  // Custom key info handlers
  const handleApproveCustom = async (comicId: string) => {
    setProcessingId(comicId);
    try {
      const response = await fetch(`/api/admin/custom-key-info/${comicId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to approve");
      }

      setCustomKeyInfoComics((prev) => prev.filter((c) => c.id !== comicId));
      setCustomCounts((prev) => ({
        ...prev,
        pending: prev.pending - 1,
        approved: prev.approved + 1,
      }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectCustom = async (comicId: string) => {
    setProcessingId(comicId);
    try {
      const response = await fetch(`/api/admin/custom-key-info/${comicId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: "Key info not accurate" }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to reject");
      }

      setCustomKeyInfoComics((prev) => prev.filter((c) => c.id !== comicId));
      setCustomCounts((prev) => ({
        ...prev,
        pending: prev.pending - 1,
        rejected: prev.rejected + 1,
      }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setProcessingId(null);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900">Not Signed In</h1>
          <p className="text-gray-600 mt-2">Please sign in to access this page.</p>
        </div>
      </div>
    );
  }

  if (error === "You do not have permission to access this page") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-gray-600 mt-2">You do not have permission to access this page.</p>
          <Link href="/" className="text-primary-600 hover:underline mt-4 inline-block">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <KeyRound className="w-6 h-6 text-amber-500" />
            <h1 className="text-xl font-bold text-gray-900">Key Info Moderation</h1>
          </div>
          <Link href="/" className="text-sm text-primary-600 hover:underline">
            Back to App
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <Database className="w-4 h-4" />
              <span className="text-sm">Total Key Comics</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{keyComicsCount}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Pending</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{counts.pending}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Approved</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{counts.approved}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <XCircle className="w-4 h-4" />
              <span className="text-sm">Rejected</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{counts.rejected}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("submissions")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "submissions"
                  ? "bg-amber-500 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              Suggestions ({counts.pending})
            </button>
            <button
              onClick={() => setActiveTab("custom")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === "custom"
                  ? "bg-amber-500 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              From Comics ({customCounts.pending})
            </button>
          </div>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Content based on active tab */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <p className="text-red-700">{error}</p>
          </div>
        ) : activeTab === "submissions" && submissions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
            <p className="text-gray-600 mt-1">No pending submissions to review.</p>
          </div>
        ) : activeTab === "custom" && customKeyInfoComics.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
            <p className="text-gray-600 mt-1">No pending custom key info to review.</p>
          </div>
        ) : activeTab === "custom" ? (
          <div className="space-y-4">
            {customKeyInfoComics.map((comic) => (
              <div key={comic.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-4 border-b bg-gray-50">
                  <div className="flex items-start gap-4">
                    {comic.coverImageUrl && (
                      <img
                        src={comic.coverImageUrl}
                        alt={comic.title}
                        className="w-16 h-24 object-cover rounded border border-gray-200"
                      />
                    )}
                    <div>
                      <h3 className="font-bold text-gray-900">
                        {comic.title} #{comic.issueNumber}
                      </h3>
                      {comic.publisher && (
                        <p className="text-sm text-gray-600">{comic.publisher}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Added {new Date(comic.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  {/* Existing Key Info */}
                  {comic.existingKeyInfo.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Existing Key Info:</p>
                      <div className="flex flex-wrap gap-2">
                        {comic.existingKeyInfo.map((info, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded text-xs"
                          >
                            {info}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Key Info to Review */}
                  <p className="text-sm font-medium text-gray-700 mb-2">Custom Key Info (Pending):</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {comic.customKeyInfo.map((info, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-800 text-sm font-medium rounded-full"
                      >
                        <KeyRound className="w-3 h-3" />
                        {info}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 border-t pt-4 mt-4">
                    <button
                      onClick={() => handleApproveCustom(comic.id)}
                      disabled={processingId === comic.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {processingId === comic.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectCustom(comic.id)}
                      disabled={processingId === comic.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => (
              <div key={submission.id} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Submission Header */}
                <div className="p-4 border-b bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900">
                        {submission.title} #{submission.issueNumber}
                      </h3>
                      {submission.publisher && (
                        <p className="text-sm text-gray-600">{submission.publisher}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Submitted {new Date(submission.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Suggested Key Info */}
                <div className="p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Suggested Key Info:</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {submission.suggestedKeyInfo.map((info, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-800 text-sm font-medium rounded-full"
                      >
                        <KeyRound className="w-3 h-3" />
                        {info}
                      </span>
                    ))}
                  </div>

                  {/* Source URL */}
                  {submission.sourceUrl && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <ExternalLink className="w-4 h-4" />
                      <a
                        href={submission.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:underline truncate"
                      >
                        {submission.sourceUrl}
                      </a>
                    </div>
                  )}

                  {/* Notes */}
                  {submission.notes && (
                    <div className="flex items-start gap-2 text-sm text-gray-600 mb-4">
                      <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <p className="whitespace-pre-wrap">{submission.notes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  {rejectingId === submission.id ? (
                    <div className="border-t pt-4 mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Rejection Reason *
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Why is this submission being rejected?"
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3 text-gray-900"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReject(submission.id)}
                          disabled={processingId === submission.id}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          {processingId === submission.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                          Confirm Reject
                        </button>
                        <button
                          onClick={() => {
                            setRejectingId(null);
                            setRejectionReason("");
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 border-t pt-4 mt-4">
                      <button
                        onClick={() => handleApprove(submission.id)}
                        disabled={processingId === submission.id}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {processingId === submission.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => setRejectingId(submission.id)}
                        disabled={processingId === submission.id}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Admin Links */}
        <div className="mt-8 flex gap-4">
          <Link href="/admin/users" className="text-sm text-blue-600 hover:underline">
            → User Management
          </Link>
          <Link href="/admin/usage" className="text-sm text-blue-600 hover:underline">
            → Service Usage Monitor
          </Link>
        </div>
      </main>
    </div>
  );
}
