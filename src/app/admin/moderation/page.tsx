"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { useUser } from "@clerk/nextjs";

import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Loader2,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { Report, ReportCard } from "@/components/admin/ReportCard";

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Stats {
  pending: number;
  reviewed: number;
  actioned: number;
  dismissed: number;
}

export default function ModerationPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [reports, setReports] = useState<Report[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [stats, setStats] = useState<Stats>({ pending: 0, reviewed: 0, actioned: 0, dismissed: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, [statusFilter]);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  async function fetchStats() {
    setLoadingStats(true);
    try {
      // Fetch counts for each status
      const statuses = ["pending", "reviewed", "actioned", "dismissed"];
      const counts: Stats = { pending: 0, reviewed: 0, actioned: 0, dismissed: 0 };

      await Promise.all(
        statuses.map(async (status) => {
          const res = await fetch(`/api/admin/message-reports?status=${status}&limit=1`);
          if (res.ok) {
            const data = await res.json();
            counts[status as keyof Stats] = data.pagination.total;
          }
        })
      );

      setStats(counts);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoadingStats(false);
    }
  }

  async function fetchReports(page = 1) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/message-reports?${params}`);
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("Access denied. Admin privileges required.");
        }
        throw new Error("Failed to fetch reports");
      }
      const data = await res.json();
      setReports(data.reports);
      setPagination(data.pagination);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unknown error");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }

  async function updateReportStatus(reportId: string, status: string, adminNotes?: string) {
    setUpdating(reportId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/message-reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNotes }),
      });
      if (!res.ok) {
        throw new Error("Failed to update report");
      }
      setSuccessMessage(
        `Report ${status === "dismissed" ? "dismissed" : status === "actioned" ? "actioned - user warned" : "marked as reviewed"}`
      );
      // Refresh both the list and stats
      fetchReports(pagination?.page || 1);
      fetchStats();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setUpdating(null);
    }
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
          <p className="mb-6">Please sign in to access the admin dashboard.</p>
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
      <header className="border-b-4 border-black mb-6" style={{ background: "var(--pop-red)" }}>
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 text-white">
            <ShieldAlert className="w-8 h-8" />
            <h1
              className="text-2xl font-bold tracking-wide"
              style={{ fontFamily: "var(--font-bangers)" }}
            >
              Message Moderation
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4">
        {/* Messages */}
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

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div
            className="comic-panel p-4 text-center cursor-pointer hover:scale-105 transition-transform"
            style={{
              background: statusFilter === "pending" ? "var(--pop-yellow)" : undefined,
              borderWidth: statusFilter === "pending" ? "3px" : undefined,
            }}
            onClick={() => setStatusFilter("pending")}
          >
            <Clock className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--pop-yellow)" }} />
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-bangers)" }}>
              {loadingStats ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : stats.pending}
            </p>
            <p className="text-sm text-gray-600">Pending</p>
          </div>
          <div
            className="comic-panel p-4 text-center cursor-pointer hover:scale-105 transition-transform"
            style={{
              background: statusFilter === "reviewed" ? "var(--pop-blue)" : undefined,
              borderWidth: statusFilter === "reviewed" ? "3px" : undefined,
            }}
            onClick={() => setStatusFilter("reviewed")}
          >
            <Eye className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--pop-blue)" }} />
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-bangers)" }}>
              {loadingStats ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : stats.reviewed}
            </p>
            <p className="text-sm text-gray-600">Reviewed</p>
          </div>
          <div
            className="comic-panel p-4 text-center cursor-pointer hover:scale-105 transition-transform"
            style={{
              background: statusFilter === "actioned" ? "var(--pop-green)" : undefined,
              borderWidth: statusFilter === "actioned" ? "3px" : undefined,
            }}
            onClick={() => setStatusFilter("actioned")}
          >
            <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--pop-green)" }} />
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-bangers)" }}>
              {loadingStats ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : stats.actioned}
            </p>
            <p className="text-sm text-gray-600">Actioned</p>
          </div>
          <div
            className="comic-panel p-4 text-center cursor-pointer hover:scale-105 transition-transform"
            style={{
              background: statusFilter === "dismissed" ? "#ccc" : undefined,
              borderWidth: statusFilter === "dismissed" ? "3px" : undefined,
            }}
            onClick={() => setStatusFilter("dismissed")}
          >
            <XCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-bangers)" }}>
              {loadingStats ? (
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              ) : (
                stats.dismissed
              )}
            </p>
            <p className="text-sm text-gray-600">Dismissed</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="comic-panel p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="font-bold text-sm">Filter by status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-pop py-2 text-sm"
              style={{ width: "auto" }}
            >
              <option value="">All Reports</option>
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
              <option value="actioned">Actioned</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
          <button
            onClick={() => {
              fetchReports();
              fetchStats();
            }}
            className="btn-pop btn-pop-white text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Reports List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--pop-blue)" }} />
          </div>
        ) : reports.length === 0 ? (
          <div className="comic-panel p-12 text-center">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "var(--font-bangers)" }}>
              No Reports Found
            </h2>
            <p className="text-gray-500">
              {statusFilter
                ? `No ${statusFilter} reports at this time.`
                : "No message reports have been submitted yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onAction={updateReportStatus}
                updating={updating === report.id}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <button
              onClick={() => fetchReports(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="btn-pop btn-pop-white text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="flex items-center px-4 font-bold">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => fetchReports(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="btn-pop btn-pop-white text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}

        {/* Admin Links */}
        <div className="mt-8 pt-4 border-t-2 border-black flex flex-wrap gap-4">
          <Link
            href="/admin/users"
            className="text-sm font-bold hover:underline"
            style={{ color: "var(--pop-blue)" }}
          >
            User Management
          </Link>
          <Link
            href="/admin/usage"
            className="text-sm font-bold hover:underline"
            style={{ color: "var(--pop-blue)" }}
          >
            Service Usage Monitor
          </Link>
          <Link
            href="/admin/key-info"
            className="text-sm font-bold hover:underline"
            style={{ color: "var(--pop-blue)" }}
          >
            Key Info Moderation
          </Link>
        </div>
      </div>
    </div>
  );
}
