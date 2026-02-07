"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useUser } from "@clerk/nextjs";

import { Loader2, UserCheck, Users } from "lucide-react";

import { FollowButton } from "@/components/follows/FollowButton";
import type { FollowListResponse, FollowUser } from "@/types/follow";

type Tab = "following" | "followers";

export default function FollowingPage() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("following");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const limit = 20;
  const hasMore = users.length < total;

  // Load current user's profile ID
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    const loadProfile = async () => {
      try {
        const res = await fetch("/api/username/current");
        if (res.ok) {
          const data = await res.json();
          setProfileId(data.profileId);
        }
      } catch {
        setError("Failed to load profile");
      }
    };

    loadProfile();
  }, [isLoaded, isSignedIn, router]);

  const fetchUsers = useCallback(
    async (currentOffset: number, append: boolean = false) => {
      if (!profileId) return;

      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      try {
        const res = await fetch(
          `/api/follows/${profileId}/${tab}?limit=${limit}&offset=${currentOffset}`,
          { signal: abortControllerRef.current.signal }
        );

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to load users");
        }

        const data: FollowListResponse = await res.json();

        if (append) {
          setUsers((prev) => [...prev, ...data.users]);
        } else {
          setUsers(data.users);
        }
        setTotal(data.total);
        setOffset(currentOffset + data.users.length);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [profileId, tab]
  );

  // Fetch when tab or profileId changes
  useEffect(() => {
    if (profileId) {
      setUsers([]);
      setOffset(0);
      setTotal(0);
      fetchUsers(0);
    }

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [profileId, fetchUsers]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchUsers(offset, true);
    }
  };

  const handleFollowChange = (targetUserId: string, isFollowing: boolean) => {
    setUsers((prev) =>
      prev.map((user) =>
        user.id === targetUserId ? { ...user, isFollowing } : user
      )
    );
    // If we unfollowed someone on the "following" tab, decrement the total
    if (tab === "following" && !isFollowing) {
      setTotal((prev) => Math.max(0, prev - 1));
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--pop-blue)" }} />
      </div>
    );
  }

  if (!isSignedIn) return null;

  return (
    <div className="min-h-screen pb-8" style={{ background: "var(--pop-cream)" }}>
      {/* Header */}
      <header className="border-b-4 border-black" style={{ background: "var(--pop-yellow)" }}>
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div
              className="p-2 border-2 border-black shadow-[2px_2px_0px_#000]"
              style={{ background: "var(--pop-blue)" }}
            >
              <UserCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1
                className="text-2xl font-bold tracking-wide"
                style={{ fontFamily: "var(--font-bangers)" }}
              >
                Following
              </h1>
              <p className="text-sm text-gray-700">
                People you follow and your followers
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 mt-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(["following", "followers"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 font-bold capitalize border-3 border-black transition-all ${
                tab === t
                  ? "text-white shadow-[2px_2px_0px_#000]"
                  : "bg-white hover:bg-gray-50"
              }`}
              style={
                tab === t
                  ? { background: "var(--pop-blue)", fontFamily: "var(--font-bangers)" }
                  : { fontFamily: "var(--font-bangers)" }
              }
            >
              {t}
              {!isLoading && tab === t && (
                <span className="ml-2 text-sm opacity-80">({total})</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--pop-blue)" }} />
          </div>
        ) : error ? (
          <div className="comic-panel p-8 text-center">
            <p className="font-bold mb-4" style={{ color: "var(--pop-red)" }}>{error}</p>
            <button
              onClick={() => fetchUsers(0)}
              className="btn-pop btn-pop-blue"
            >
              Try Again
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="comic-panel p-8 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3
              className="text-xl font-bold mb-2"
              style={{ fontFamily: "var(--font-bangers)" }}
            >
              {tab === "following"
                ? "Not Following Anyone Yet"
                : "No Followers Yet"}
            </h3>
            <p className="text-gray-500">
              {tab === "following"
                ? "Visit other collectors' pages and hit Follow to see them here."
                : "Share your collection to attract followers!"}
            </p>
          </div>
        ) : (
          <div className="comic-panel overflow-hidden">
            <div className="divide-y-2 divide-black">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
                >
                  {/* Avatar */}
                  <Link href={`/u/${user.username}`} className="flex-shrink-0">
                    <div className="w-12 h-12 border-2 border-black overflow-hidden flex items-center justify-center bg-gray-100">
                      {user.avatarUrl ? (
                        <Image
                          src={user.avatarUrl}
                          alt={user.displayName || `@${user.username}`}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Users className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                  </Link>

                  {/* Name */}
                  <Link href={`/u/${user.username}`} className="flex-1 min-w-0">
                    <p className="font-bold truncate hover:underline">
                      {user.displayName || user.username || "Anonymous"}
                    </p>
                    {user.username && (
                      <p className="text-sm text-gray-500 truncate">
                        @{user.username}
                      </p>
                    )}
                  </Link>

                  {/* Follow Button */}
                  <FollowButton
                    userId={user.id}
                    initialIsFollowing={tab === "following" ? true : user.isFollowing}
                    size="sm"
                    onFollowChange={(isFollowing) =>
                      handleFollowChange(user.id, isFollowing)
                    }
                  />
                </div>
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="border-t-2 border-black p-4 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="btn-pop btn-pop-white flex items-center gap-2 mx-auto disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
