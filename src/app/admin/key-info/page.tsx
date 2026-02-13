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
  Pencil,
  RefreshCw,
  Trash2,
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
  const [activeTab, setActiveTab] = useState<"review" | "database">("review");
  // Database tab state
  const [dbEntries, setDbEntries] = useState<Array<{
    id: string;
    title: string;
    issueNumber: string;
    publisher: string | null;
    keyInfo: string[];
    source: string;
    contributedBy: string | null;
    createdAt: string;
    updatedAt: string;
  }>>([]);
  const [dbTotal, setDbTotal] = useState(0);
  const [dbPage, setDbPage] = useState(1);
  const [dbSearch, setDbSearch] = useState("");
  const [dbSourceFilter, setDbSourceFilter] = useState("");
  const [dbLoading, setDbLoading] = useState(false);
  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createIssue, setCreateIssue] = useState("");
  const [createPublisher, setCreatePublisher] = useState("");
  const [createKeyInfo, setCreateKeyInfo] = useState("");
  // Edit state
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editIssue, setEditIssue] = useState("");
  const [editPublisher, setEditPublisher] = useState("");
  const [editKeyInfo, setEditKeyInfo] = useState("");
  // Delete confirmation
  const [deletingEntry, setDeletingEntry] = useState<{id: string; title: string; issueNumber: string} | null>(null);

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

  // Database tab: fetch key comics
  const fetchKeyComics = async (page = 1) => {
    setDbLoading(true);
    try {
      const params = new URLSearchParams();
      if (dbSearch) params.set("search", dbSearch);
      if (dbSourceFilter) params.set("source", dbSourceFilter);
      params.set("page", String(page));
      params.set("limit", "25");

      const res = await fetch(`/api/admin/key-comics?${params}`);
      const data = await res.json();

      if (res.ok) {
        setDbEntries(data.entries);
        setDbTotal(data.total);
        setDbPage(page);
      }
    } catch (err) {
      console.error("Failed to fetch key comics:", err);
    } finally {
      setDbLoading(false);
    }
  };

  // Load database tab data when switching to it
  useEffect(() => {
    if (activeTab === "database" && dbEntries.length === 0) {
      fetchKeyComics();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleCreateKeyComic = async () => {
    const keyInfoArray = createKeyInfo.split("\n").map(s => s.trim()).filter(Boolean);
    if (!createTitle || !createIssue || keyInfoArray.length === 0) {
      alert("Title, issue number, and at least one key info line are required");
      return;
    }

    setProcessingId("create");
    try {
      const res = await fetch("/api/admin/key-comics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createTitle,
          issueNumber: createIssue,
          publisher: createPublisher || undefined,
          keyInfo: keyInfoArray,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create");
      }

      setCreateTitle("");
      setCreateIssue("");
      setCreatePublisher("");
      setCreateKeyInfo("");
      setShowCreateForm(false);
      fetchKeyComics(dbPage);
      setKeyComicsCount(prev => prev + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setProcessingId(null);
    }
  };

  const handleEditKeyComic = async (id: string) => {
    const keyInfoArray = editKeyInfo.split("\n").map(s => s.trim()).filter(Boolean);
    if (keyInfoArray.length === 0) {
      alert("At least one key info line is required");
      return;
    }

    setProcessingId(id);
    try {
      const res = await fetch(`/api/admin/key-comics/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          issueNumber: editIssue,
          publisher: editPublisher || undefined,
          keyInfo: keyInfoArray,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }

      setEditingEntry(null);
      fetchKeyComics(dbPage);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteKeyComic = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/admin/key-comics/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }

      setDeletingEntry(null);
      fetchKeyComics(dbPage);
      setKeyComicsCount(prev => prev - 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setProcessingId(null);
    }
  };

  const startEdit = (entry: (typeof dbEntries)[0]) => {
    setEditingEntry(entry.id);
    setEditTitle(entry.title);
    setEditIssue(entry.issueNumber);
    setEditPublisher(entry.publisher || "");
    setEditKeyInfo(entry.keyInfo.join("\n"));
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

  // Merge submissions and custom key info into a single review list
  const reviewItems: Array<
    | { type: "suggestion"; id: string; date: number; submission: Submission }
    | { type: "comic"; id: string; date: number; comic: CustomKeyInfoComic }
  > = [
    ...submissions.map(s => ({ type: "suggestion" as const, id: `s-${s.id}`, date: new Date(s.createdAt).getTime(), submission: s })),
    ...customKeyInfoComics.map(c => ({ type: "comic" as const, id: `c-${c.id}`, date: new Date(c.createdAt).getTime(), comic: c })),
  ].sort((a, b) => a.date - b.date);

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
        <div className="grid grid-cols-4 gap-2 md:gap-4 mb-4">
          <div className="comic-panel p-2 md:p-4">
            <div className="flex items-center gap-1 mb-0.5">
              <Database className="w-3 h-3 md:w-4 md:h-4" />
              <span className="text-xs md:text-sm font-medium">Total</span>
            </div>
            <p className="text-lg md:text-2xl font-bold">{keyComicsCount}</p>
          </div>
          <div className="comic-panel p-2 md:p-4" style={{ borderColor: "#d97706" }}>
            <div className="flex items-center gap-1 mb-0.5" style={{ color: "#d97706" }}>
              <Clock className="w-3 h-3 md:w-4 md:h-4" />
              <span className="text-xs md:text-sm font-medium">Pending</span>
            </div>
            <p className="text-lg md:text-2xl font-bold" style={{ color: "#d97706" }}>
              {counts.pending + customCounts.pending}
            </p>
          </div>
          <div className="comic-panel p-2 md:p-4" style={{ borderColor: "var(--pop-green)" }}>
            <div className="flex items-center gap-1 mb-0.5" style={{ color: "var(--pop-green)" }}>
              <CheckCircle className="w-3 h-3 md:w-4 md:h-4" />
              <span className="text-xs md:text-sm font-medium">Approved</span>
            </div>
            <p className="text-lg md:text-2xl font-bold" style={{ color: "var(--pop-green)" }}>
              {counts.approved + customCounts.approved}
            </p>
          </div>
          <div className="comic-panel p-2 md:p-4" style={{ borderColor: "var(--pop-red)" }}>
            <div className="flex items-center gap-1 mb-0.5" style={{ color: "var(--pop-red)" }}>
              <XCircle className="w-3 h-3 md:w-4 md:h-4" />
              <span className="text-xs md:text-sm font-medium">Rejected</span>
            </div>
            <p className="text-lg md:text-2xl font-bold" style={{ color: "var(--pop-red)" }}>
              {counts.rejected + customCounts.rejected}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex gap-1 flex-1 min-w-0">
            {(["review", "database"] as const).map((tab) => {
              const totalPending = counts.pending + customCounts.pending;
              const labels = {
                review: `Review (${totalPending})`,
                database: `DB (${keyComicsCount})`,
              };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2 md:px-4 py-1.5 text-sm font-bold transition-colors border-2 border-black whitespace-nowrap ${
                    activeTab === tab
                      ? "text-white"
                      : "bg-white hover:bg-gray-100"
                  }`}
                  style={
                    activeTab === tab
                      ? { background: "var(--pop-blue)", fontFamily: "var(--font-bangers)" }
                      : { fontFamily: "var(--font-bangers)" }
                  }
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2 rounded hover:bg-gray-100 flex-shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
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
        ) : activeTab === "review" && reviewItems.length === 0 ? (
          <div className="comic-panel p-8 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--pop-green)" }} />
            <h3
              className="text-xl font-bold mb-1"
              style={{ fontFamily: "var(--font-bangers)" }}
            >
              All caught up!
            </h3>
            <p>No pending key info to review.</p>
          </div>
        ) : activeTab === "database" ? (
          <div>
            {/* Search + Filters + Add button */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                type="text"
                value={dbSearch}
                onChange={(e) => setDbSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchKeyComics(1)}
                placeholder="Search by title..."
                className="flex-1 px-3 py-2 border-3 border-black text-sm"
              />
              <select
                value={dbSourceFilter}
                onChange={(e) => {
                  setDbSourceFilter(e.target.value);
                }}
                className="px-3 py-2 border-3 border-black text-sm bg-white"
              >
                <option value="">All Sources</option>
                <option value="curated">Curated</option>
                <option value="community">Community</option>
              </select>
              <button
                onClick={() => fetchKeyComics(1)}
                className="btn-pop btn-pop-blue text-sm"
              >
                Search
              </button>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="btn-pop btn-pop-green text-sm whitespace-nowrap"
              >
                + Add Entry
              </button>
            </div>

            {/* Create Form */}
            {showCreateForm && (
              <div className="comic-panel p-4 mb-4" style={{ background: "var(--pop-cream)" }}>
                <h3 className="font-bold mb-3" style={{ fontFamily: "var(--font-bangers)" }}>
                  Add New Key Comic
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <input
                    type="text"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    placeholder="Title (e.g. Amazing Spider-Man)"
                    className="px-3 py-2 border-3 border-black text-sm"
                  />
                  <input
                    type="text"
                    value={createIssue}
                    onChange={(e) => setCreateIssue(e.target.value)}
                    placeholder="Issue # (e.g. 300)"
                    className="px-3 py-2 border-3 border-black text-sm"
                  />
                  <input
                    type="text"
                    value={createPublisher}
                    onChange={(e) => setCreatePublisher(e.target.value)}
                    placeholder="Publisher (optional)"
                    className="px-3 py-2 border-3 border-black text-sm"
                  />
                </div>
                <textarea
                  value={createKeyInfo}
                  onChange={(e) => setCreateKeyInfo(e.target.value)}
                  placeholder={"Key info (one per line)\ne.g. First appearance of Venom\nFirst full appearance of Venom (Eddie Brock)"}
                  rows={3}
                  className="w-full px-3 py-2 border-3 border-black text-sm mb-3"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateKeyComic}
                    disabled={processingId === "create"}
                    className="btn-pop btn-pop-green flex items-center gap-2 disabled:opacity-50"
                  >
                    {processingId === "create" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Create
                  </button>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="btn-pop btn-pop-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Results info */}
            <p className="text-sm text-gray-600 mb-3">
              Showing {dbEntries.length} of {dbTotal} entries
              {dbSearch && ` matching "${dbSearch}"`}
            </p>

            {/* Loading */}
            {dbLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--pop-blue)" }} />
              </div>
            ) : dbEntries.length === 0 ? (
              <div className="comic-panel p-8 text-center">
                <Database className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>No entries found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dbEntries.map((entry) => (
                  <div key={entry.id} className="comic-panel overflow-hidden">
                    {editingEntry === entry.id ? (
                      /* Edit Mode */
                      <div className="p-4" style={{ background: "var(--pop-cream)" }}>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="Title"
                            className="px-3 py-2 border-3 border-black text-sm"
                          />
                          <input
                            type="text"
                            value={editIssue}
                            onChange={(e) => setEditIssue(e.target.value)}
                            placeholder="Issue #"
                            className="px-3 py-2 border-3 border-black text-sm"
                          />
                          <input
                            type="text"
                            value={editPublisher}
                            onChange={(e) => setEditPublisher(e.target.value)}
                            placeholder="Publisher"
                            className="px-3 py-2 border-3 border-black text-sm"
                          />
                        </div>
                        <textarea
                          value={editKeyInfo}
                          onChange={(e) => setEditKeyInfo(e.target.value)}
                          placeholder="Key info (one per line)"
                          rows={3}
                          className="w-full px-3 py-2 border-3 border-black text-sm mb-3"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditKeyComic(entry.id)}
                            disabled={processingId === entry.id}
                            className="btn-pop btn-pop-green flex items-center gap-2 disabled:opacity-50"
                          >
                            {processingId === entry.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Save
                          </button>
                          <button
                            onClick={() => setEditingEntry(null)}
                            className="btn-pop btn-pop-white"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold">
                                {entry.title} #{entry.issueNumber}
                              </h3>
                              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                entry.source === "curated"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}>
                                {entry.source}
                              </span>
                            </div>
                            {entry.publisher && (
                              <p className="text-sm text-gray-600">{entry.publisher}</p>
                            )}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {entry.keyInfo.map((info, idx) => (
                                <span key={idx} className="badge-pop badge-pop-yellow text-xs">
                                  {info}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => startEdit(entry)}
                              className="p-2 rounded hover:bg-gray-100 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingEntry({ id: entry.id, title: entry.title, issueNumber: entry.issueNumber })}
                              className="p-2 rounded hover:bg-red-50 transition-colors"
                              title="Delete"
                              style={{ color: "var(--pop-red)" }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Pagination */}
                {dbTotal > 25 && (
                  <div className="flex items-center justify-center gap-3 pt-4">
                    <button
                      onClick={() => fetchKeyComics(dbPage - 1)}
                      disabled={dbPage <= 1 || dbLoading}
                      className="btn-pop btn-pop-white text-sm disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm font-medium">
                      Page {dbPage} of {Math.ceil(dbTotal / 25)}
                    </span>
                    <button
                      onClick={() => fetchKeyComics(dbPage + 1)}
                      disabled={dbPage >= Math.ceil(dbTotal / 25) || dbLoading}
                      className="btn-pop btn-pop-white text-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletingEntry && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="comic-panel p-6 max-w-sm w-full bg-white">
                  <h3 className="font-bold text-lg mb-2" style={{ fontFamily: "var(--font-bangers)" }}>
                    Delete Entry?
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Are you sure you want to delete <strong>{deletingEntry.title} #{deletingEntry.issueNumber}</strong> from the key comics database? This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeleteKeyComic(deletingEntry.id)}
                      disabled={processingId === deletingEntry.id}
                      className="btn-pop btn-pop-red flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {processingId === deletingEntry.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Delete
                    </button>
                    <button
                      onClick={() => setDeletingEntry(null)}
                      className="btn-pop btn-pop-white flex-1"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {reviewItems.map((item) =>
              item.type === "suggestion" ? (
                <div key={item.id} className="comic-panel overflow-hidden">
                  {/* Suggestion Header */}
                  <div
                    className="p-4 border-b-3 border-black"
                    style={{ background: "var(--pop-cream)" }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold">
                          {item.submission.title} #{item.submission.issueNumber}
                        </h3>
                        {item.submission.publisher && (
                          <p className="text-sm text-gray-600">{item.submission.publisher}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Submitted {new Date(item.submission.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded font-medium bg-purple-100 text-purple-700 whitespace-nowrap">
                        Suggestion
                      </span>
                    </div>
                  </div>

                  {/* Suggested Key Info */}
                  <div className="p-4">
                    <p className="text-sm font-bold mb-2">Suggested Key Info:</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {item.submission.suggestedKeyInfo.map((info, idx) => (
                        <span key={idx} className="badge-pop badge-pop-blue text-sm">
                          <KeyRound className="w-3 h-3" />
                          {info}
                        </span>
                      ))}
                    </div>

                    {/* Source URL */}
                    {item.submission.sourceUrl && (
                      <div className="flex items-center gap-2 text-sm mb-2">
                        <ExternalLink className="w-4 h-4" />
                        <a
                          href={item.submission.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline truncate"
                          style={{ color: "var(--pop-blue)" }}
                        >
                          {item.submission.sourceUrl}
                        </a>
                      </div>
                    )}

                    {/* Notes */}
                    {item.submission.notes && (
                      <div className="flex items-start gap-2 text-sm text-gray-600 mb-4">
                        <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p className="whitespace-pre-wrap">{item.submission.notes}</p>
                      </div>
                    )}

                    {/* Actions */}
                    {rejectingId === item.submission.id ? (
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
                            onClick={() => handleReject(item.submission.id)}
                            disabled={processingId === item.submission.id}
                            className="btn-pop btn-pop-red flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {processingId === item.submission.id ? (
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
                          onClick={() => handleApprove(item.submission.id)}
                          disabled={processingId === item.submission.id}
                          className="btn-pop btn-pop-green flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {processingId === item.submission.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          Approve
                        </button>
                        <button
                          onClick={() => setRejectingId(item.submission.id)}
                          disabled={processingId === item.submission.id}
                          className="btn-pop btn-pop-white flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div key={item.id} className="comic-panel overflow-hidden">
                  {/* Comic Header */}
                  <div
                    className="p-4 border-b-3 border-black"
                    style={{ background: "var(--pop-cream)" }}
                  >
                    <div className="flex items-start gap-4">
                      {item.comic.coverImageUrl && (
                        <img
                          src={item.comic.coverImageUrl}
                          alt={item.comic.title}
                          className="w-16 h-24 object-cover border-2 border-black"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold">
                              {item.comic.title} #{item.comic.issueNumber}
                            </h3>
                            {item.comic.publisher && (
                              <p className="text-sm text-gray-600">{item.comic.publisher}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              Added {new Date(item.comic.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded font-medium bg-blue-100 text-blue-700 whitespace-nowrap">
                            From Comic
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    {/* Existing Key Info */}
                    {item.comic.existingKeyInfo.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm font-bold mb-2">Existing Key Info:</p>
                        <div className="flex flex-wrap gap-2">
                          {item.comic.existingKeyInfo.map((info, idx) => (
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
                      {item.comic.customKeyInfo.map((info, idx) => (
                        <span key={idx} className="badge-pop badge-pop-blue text-sm">
                          <KeyRound className="w-3 h-3" />
                          {info}
                        </span>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 border-t-3 border-black pt-4 mt-4">
                      <button
                        onClick={() => handleApproveCustom(item.comic.id)}
                        disabled={processingId === item.comic.id}
                        className="btn-pop btn-pop-green flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {processingId === item.comic.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectCustom(item.comic.id)}
                        disabled={processingId === item.comic.id}
                        className="btn-pop btn-pop-white flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </main>
    </div>
  );
}
