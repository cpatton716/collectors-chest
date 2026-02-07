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

  if (error === "You do not have permission to access this page") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="comic-panel p-8 text-center max-w-md">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--pop-red)" }} />
          <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-bangers)" }}>
            Access Denied
          </h1>
          <p className="mb-6">You do not have permission to access this page.</p>
          <Link href="/" className="btn-pop btn-pop-blue">
            Return Home
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
            <KeyRound className="w-8 h-8" />
            <h1
              className="text-2xl font-bold tracking-wide"
              style={{ fontFamily: "var(--font-bangers)" }}
            >
              Key Info Moderation
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="comic-panel p-4">
            <div className="flex items-center gap-2 mb-1">
              <Database className="w-4 h-4" />
              <span className="text-sm font-medium">Total Key Comics</span>
            </div>
            <p className="text-2xl font-bold">{keyComicsCount}</p>
          </div>
          <div className="comic-panel p-4" style={{ borderColor: "#d97706" }}>
            <div className="flex items-center gap-2 mb-1" style={{ color: "#d97706" }}>
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">Pending</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: "#d97706" }}>
              {counts.pending}
            </p>
          </div>
          <div className="comic-panel p-4" style={{ borderColor: "var(--pop-green)" }}>
            <div className="flex items-center gap-2 mb-1" style={{ color: "var(--pop-green)" }}>
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Approved</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: "var(--pop-green)" }}>
              {counts.approved}
            </p>
          </div>
          <div className="comic-panel p-4" style={{ borderColor: "var(--pop-red)" }}>
            <div className="flex items-center gap-2 mb-1" style={{ color: "var(--pop-red)" }}>
              <XCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Rejected</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: "var(--pop-red)" }}>
              {counts.rejected}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("submissions")}
              className={`px-4 py-2 font-bold transition-colors border-3 border-black ${
                activeTab === "submissions"
                  ? "text-white"
                  : "bg-white hover:bg-gray-100"
              }`}
              style={
                activeTab === "submissions"
                  ? { background: "var(--pop-blue)", fontFamily: "var(--font-bangers)" }
                  : { fontFamily: "var(--font-bangers)" }
              }
            >
              Suggestions ({counts.pending})
            </button>
            <button
              onClick={() => setActiveTab("custom")}
              className={`px-4 py-2 font-bold transition-colors border-3 border-black ${
                activeTab === "custom"
                  ? "text-white"
                  : "bg-white hover:bg-gray-100"
              }`}
              style={
                activeTab === "custom"
                  ? { background: "var(--pop-blue)", fontFamily: "var(--font-bangers)" }
                  : { fontFamily: "var(--font-bangers)" }
              }
            >
              From Comics ({customCounts.pending})
            </button>
          </div>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="btn-pop btn-pop-white text-sm flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Content based on active tab */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--pop-blue)" }} />
          </div>
        ) : error ? (
          <div
            className="comic-panel p-4 text-center"
            style={{ borderColor: "var(--pop-red)", background: "#fff0f0" }}
          >
            <p className="font-bold" style={{ color: "var(--pop-red)" }}>{error}</p>
          </div>
        ) : activeTab === "submissions" && submissions.length === 0 ? (
          <div className="comic-panel p-8 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--pop-green)" }} />
            <h3
              className="text-xl font-bold mb-1"
              style={{ fontFamily: "var(--font-bangers)" }}
            >
              All caught up!
            </h3>
            <p>No pending submissions to review.</p>
          </div>
        ) : activeTab === "custom" && customKeyInfoComics.length === 0 ? (
          <div className="comic-panel p-8 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--pop-green)" }} />
            <h3
              className="text-xl font-bold mb-1"
              style={{ fontFamily: "var(--font-bangers)" }}
            >
              All caught up!
            </h3>
            <p>No pending custom key info to review.</p>
          </div>
        ) : activeTab === "custom" ? (
          <div className="space-y-4">
            {customKeyInfoComics.map((comic) => (
              <div key={comic.id} className="comic-panel overflow-hidden">
                <div
                  className="p-4 border-b-3 border-black"
                  style={{ background: "var(--pop-cream)" }}
                >
                  <div className="flex items-start gap-4">
                    {comic.coverImageUrl && (
                      <img
                        src={comic.coverImageUrl}
                        alt={comic.title}
                        className="w-16 h-24 object-cover border-2 border-black"
                      />
                    )}
                    <div>
                      <h3 className="font-bold">
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
                      <p className="text-sm font-bold mb-2">Existing Key Info:</p>
                      <div className="flex flex-wrap gap-2">
                        {comic.existingKeyInfo.map((info, idx) => (
                          <span key={idx} className="badge-pop badge-pop-yellow text-xs">
                            {info}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Key Info to Review */}
                  <p className="text-sm font-bold mb-2">Custom Key Info (Pending):</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {comic.customKeyInfo.map((info, idx) => (
                      <span key={idx} className="badge-pop badge-pop-blue text-sm">
                        <KeyRound className="w-3 h-3" />
                        {info}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 border-t-3 border-black pt-4 mt-4">
                    <button
                      onClick={() => handleApproveCustom(comic.id)}
                      disabled={processingId === comic.id}
                      className="btn-pop btn-pop-green flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
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
                      className="btn-pop btn-pop-white flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
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
              <div key={submission.id} className="comic-panel overflow-hidden">
                {/* Submission Header */}
                <div
                  className="p-4 border-b-3 border-black"
                  style={{ background: "var(--pop-cream)" }}
                >
                  <div>
                    <h3 className="font-bold">
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

                {/* Suggested Key Info */}
                <div className="p-4">
                  <p className="text-sm font-bold mb-2">Suggested Key Info:</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {submission.suggestedKeyInfo.map((info, idx) => (
                      <span key={idx} className="badge-pop badge-pop-blue text-sm">
                        <KeyRound className="w-3 h-3" />
                        {info}
                      </span>
                    ))}
                  </div>

                  {/* Source URL */}
                  {submission.sourceUrl && (
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <ExternalLink className="w-4 h-4" />
                      <a
                        href={submission.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline truncate"
                        style={{ color: "var(--pop-blue)" }}
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
                    <div className="border-t-3 border-black pt-4 mt-4">
                      <label className="block text-sm font-bold mb-2">
                        Rejection Reason *
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Why is this submission being rejected?"
                        rows={2}
                        className="w-full px-3 py-2 border-3 border-black text-sm mb-3 text-gray-900"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReject(submission.id)}
                          disabled={processingId === submission.id}
                          className="btn-pop btn-pop-red flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
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
                          className="btn-pop btn-pop-white"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 border-t-3 border-black pt-4 mt-4">
                      <button
                        onClick={() => handleApprove(submission.id)}
                        disabled={processingId === submission.id}
                        className="btn-pop btn-pop-green flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
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
                        className="btn-pop btn-pop-white flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
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
      </main>
    </div>
  );
}
