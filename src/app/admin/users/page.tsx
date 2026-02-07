"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { useUser } from "@clerk/nextjs";

import {
  AlertTriangle,
  Ban,
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  Gift,
  Loader2,
  Mail,
  RefreshCw,
  RotateCcw,
  Scan,
  Search,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
  XCircle,
} from "lucide-react";

interface UserSearchResult {
  id: string;
  clerk_user_id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  is_suspended: boolean;
  created_at: string;
}

interface UserDetails {
  id: string;
  clerk_user_id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_status: "available" | "active" | "expired";
  scans_used_this_month: number;
  scan_month_start: string | null;
  purchased_scans: number;
  is_admin: boolean;
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string;
  updated_at: string;
  scans_this_month: number;
  comic_count: number;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function TierBadge({ tier }: { tier: string | null }) {
  if (tier === "premium") {
    return (
      <span className="badge-pop badge-pop-blue">
        <CreditCard className="w-3 h-3" />
        Premium
      </span>
    );
  }
  return (
    <span className="badge-pop" style={{ background: "var(--pop-cream)" }}>
      Free
    </span>
  );
}

function StatusBadge({ suspended }: { suspended: boolean }) {
  if (suspended) {
    return (
      <span className="badge-pop badge-pop-red">
        <Ban className="w-3 h-3" />
        Suspended
      </span>
    );
  }
  return (
    <span className="badge-pop badge-pop-green">
      <CheckCircle className="w-3 h-3" />
      Active
    </span>
  );
}

function TrialBadge({ status }: { status: "available" | "active" | "expired" }) {
  if (status === "active") {
    return (
      <span className="badge-pop badge-pop-blue">
        <Clock className="w-3 h-3" />
        Trial Active
      </span>
    );
  }
  if (status === "expired") {
    return (
      <span className="badge-pop" style={{ background: "#ccc" }}>
        <XCircle className="w-3 h-3" />
        Trial Used
      </span>
    );
  }
  return (
    <span className="badge-pop badge-pop-green">
      <Gift className="w-3 h-3" />
      Trial Available
    </span>
  );
}

export default function AdminUsersPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [isPerformingAction, setIsPerformingAction] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const searchUsers = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setError("Please enter at least 2 characters to search");
      return;
    }

    setIsSearching(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/admin/users/search?email=${encodeURIComponent(searchQuery)}`
      );
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Access denied. Admin privileges required.");
        }
        throw new Error("Failed to search users");
      }
      const data = await response.json();
      setSearchResults(data.users);
      setSelectedUser(null);
      setHasSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const loadUserDetails = async (userId: string) => {
    setIsLoadingUser(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`);
      if (!response.ok) {
        throw new Error("Failed to load user details");
      }
      const data = await response.json();
      setSelectedUser(data.user);
      setSuspendReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsLoadingUser(false);
    }
  };

  const resetTrial = async () => {
    if (!selectedUser) return;
    setIsPerformingAction(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/reset-trial`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to reset trial");
      }
      setSuccessMessage("Trial reset successfully");
      loadUserDetails(selectedUser.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsPerformingAction(false);
    }
  };

  const grantPremium = async (days: number = 30) => {
    if (!selectedUser) return;
    setIsPerformingAction(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/grant-premium`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      if (!response.ok) {
        throw new Error("Failed to grant premium");
      }
      const data = await response.json();
      setSuccessMessage(data.message);
      loadUserDetails(selectedUser.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsPerformingAction(false);
    }
  };

  const toggleSuspension = async () => {
    if (!selectedUser) return;
    setIsPerformingAction(true);
    setError(null);

    const suspend = !selectedUser.is_suspended;

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suspend,
          reason: suspend ? suspendReason : undefined,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update suspension");
      }
      const data = await response.json();
      setSuccessMessage(data.message);
      loadUserDetails(selectedUser.id);
      setSuspendReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsPerformingAction(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      searchUsers();
    }
  };

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

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
      <header className="border-b-4 border-black mb-6" style={{ background: "var(--pop-yellow)" }}>
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8" />
            <h1
              className="text-2xl font-bold tracking-wide"
              style={{ fontFamily: "var(--font-bangers)" }}
            >
              User Management
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

        {/* Search Section */}
        <div className="comic-panel p-6 mb-6">
          <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "var(--font-bangers)" }}>
            Search Users
          </h2>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search by email..."
                className="input-pop"
                style={{ paddingLeft: "2.75rem" }}
              />
            </div>
            <button
              onClick={searchUsers}
              disabled={isSearching}
              className="btn-pop btn-pop-blue disabled:opacity-50"
            >
              {isSearching ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Search
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Results List */}
          <div className="comic-panel overflow-hidden">
            <div
              className="p-4 border-b-4 border-black"
              style={{ background: "var(--pop-yellow)" }}
            >
              <h3 className="font-bold" style={{ fontFamily: "var(--font-bangers)" }}>
                Results {searchResults.length > 0 && `(${searchResults.length})`}
              </h3>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500">
                    {hasSearched
                      ? `No users found matching "${searchQuery}"`
                      : "Search for users by email"}
                  </p>
                </div>
              ) : (
                <div>
                  {searchResults.map((user, index) => (
                    <button
                      key={user.id}
                      onClick={() => loadUserDetails(user.id)}
                      className={`w-full p-4 text-left transition-colors border-b-2 border-black last:border-b-0 ${
                        selectedUser?.id === user.id
                          ? "bg-blue-50"
                          : index % 2 === 0
                            ? "bg-white"
                            : "bg-gray-50"
                      } hover:bg-blue-50`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold truncate">{user.email || "No email"}</p>
                          {user.username && (
                            <p className="text-sm text-gray-600">@{user.username}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            Joined {formatDate(user.created_at)}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          <TierBadge tier={user.subscription_tier} />
                          <StatusBadge suspended={user.is_suspended} />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* User Details Panel */}
          <div className="comic-panel overflow-hidden">
            <div
              className="p-4 border-b-4 border-black"
              style={{ background: "var(--pop-blue)", color: "white" }}
            >
              <h3 className="font-bold" style={{ fontFamily: "var(--font-bangers)" }}>
                User Details
              </h3>
            </div>
            {isLoadingUser ? (
              <div className="p-8 text-center">
                <RefreshCw
                  className="w-8 h-8 mx-auto animate-spin"
                  style={{ color: "var(--pop-blue)" }}
                />
              </div>
            ) : selectedUser ? (
              <div className="p-4 space-y-4">
                {/* Basic Info */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="font-bold">{selectedUser.email || "No email"}</span>
                  </div>
                  {selectedUser.username && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span>@{selectedUser.username}</span>
                    </div>
                  )}
                  {selectedUser.display_name && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span>{selectedUser.display_name}</span>
                    </div>
                  )}
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap gap-2">
                  <TierBadge tier={selectedUser.subscription_tier} />
                  <StatusBadge suspended={selectedUser.is_suspended} />
                  <TrialBadge status={selectedUser.trial_status} />
                  {selectedUser.is_admin && (
                    <span className="badge-pop badge-pop-yellow">
                      <ShieldCheck className="w-3 h-3" />
                      Admin
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 py-3 border-t-2 border-b-2 border-black">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500 text-sm mb-1">
                      <Scan className="w-4 h-4" />
                      Scans This Month
                    </div>
                    <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-bangers)" }}>
                      {selectedUser.scans_this_month}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-500 text-sm mb-1">
                      <BookOpen className="w-4 h-4" />
                      Comics
                    </div>
                    <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-bangers)" }}>
                      {selectedUser.comic_count}
                    </p>
                  </div>
                </div>

                {/* Dates */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>Member since {formatDate(selectedUser.created_at)}</span>
                  </div>
                  {selectedUser.trial_ends_at && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span>Trial ends {formatDate(selectedUser.trial_ends_at)}</span>
                    </div>
                  )}
                  {selectedUser.is_suspended && selectedUser.suspended_at && (
                    <div className="flex items-center gap-2" style={{ color: "var(--pop-red)" }}>
                      <Ban className="w-4 h-4" />
                      <span>Suspended {formatDate(selectedUser.suspended_at)}</span>
                    </div>
                  )}
                </div>

                {/* Suspension Reason */}
                {selectedUser.is_suspended && selectedUser.suspended_reason && (
                  <div className="p-3 border-2 border-black" style={{ background: "#fff0f0" }}>
                    <p className="text-sm" style={{ color: "var(--pop-red)" }}>
                      <strong>Reason:</strong> {selectedUser.suspended_reason}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-4 border-t-2 border-black space-y-3">
                  <h4 className="font-bold" style={{ fontFamily: "var(--font-bangers)" }}>
                    Actions
                  </h4>

                  {/* Row 1: Trial and Premium */}
                  <div className="flex gap-2">
                    <button
                      onClick={resetTrial}
                      disabled={isPerformingAction || selectedUser.trial_status === "available"}
                      className="flex-1 btn-pop btn-pop-white text-sm disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset Trial
                    </button>
                    <button
                      onClick={() => grantPremium(30)}
                      disabled={isPerformingAction}
                      className="flex-1 btn-pop btn-pop-blue text-sm disabled:opacity-50"
                    >
                      <Gift className="w-4 h-4" />
                      Grant 30 Days
                    </button>
                  </div>

                  {/* Suspend/Unsuspend */}
                  <div className="space-y-2">
                    {!selectedUser.is_suspended && (
                      <input
                        type="text"
                        value={suspendReason}
                        onChange={(e) => setSuspendReason(e.target.value)}
                        placeholder="Suspension reason (optional)"
                        className="input-pop text-sm"
                      />
                    )}
                    <button
                      onClick={toggleSuspension}
                      disabled={isPerformingAction || selectedUser.is_admin}
                      className={`w-full btn-pop text-sm disabled:opacity-50 ${
                        selectedUser.is_suspended ? "btn-pop-green" : "btn-pop-red"
                      }`}
                    >
                      {selectedUser.is_suspended ? (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          Unsuspend User
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="w-4 h-4" />
                          Suspend User
                        </>
                      )}
                    </button>
                    {selectedUser.is_admin && (
                      <p className="text-xs text-gray-500 text-center">
                        Cannot suspend admin accounts
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center">
                <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">Select a user to view details</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
