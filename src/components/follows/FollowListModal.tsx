"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { Loader2, Users, X } from "lucide-react";

import { FollowButton } from "./FollowButton";
import type { FollowListResponse, FollowUser } from "@/types/follow";

interface FollowListModalProps {
  userId: string;
  type: "followers" | "following";
  isOpen: boolean;
  onClose: () => void;
}

export function FollowListModal({
  userId,
  type,
  isOpen,
  onClose,
}: FollowListModalProps) {
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const limit = 20;
  const hasMore = users.length < total;

  const fetchUsers = useCallback(
    async (currentOffset: number, append: boolean = false) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      // Abort any in-flight request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      try {
        const res = await fetch(
          `/api/follows/${userId}/${type}?limit=${limit}&offset=${currentOffset}`,
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
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [userId, type]
  );

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setUsers([]);
      setOffset(0);
      setTotal(0);
      fetchUsers(0);
    }

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [isOpen, fetchUsers]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchUsers(offset, true);
    }
  };

  const handleFollowChange = (targetUserId: string, isFollowing: boolean) => {
    // Update local state when follow status changes
    setUsers((prev) =>
      prev.map((user) =>
        user.id === targetUserId ? { ...user, isFollowing } : user
      )
    );
  };

  if (!isOpen) return null;

  const title = type === "followers" ? "Followers" : "Following";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[80vh] rounded-lg border-4 border-pop-black bg-pop-white shadow-comic flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-4 border-pop-black p-4">
          <h2 className="text-xl font-black">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-gray-500 hover:text-pop-black transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-pop-blue" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-pop-red">{error}</p>
              <button
                onClick={() => fetchUsers(0)}
                className="mt-4 text-sm text-pop-blue hover:underline"
              >
                Try again
              </button>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-gray-300 mb-4" />
              <p className="text-gray-500">
                {type === "followers"
                  ? "No followers yet"
                  : "Not following anyone yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {/* Avatar */}
                  <Link
                    href={`/u/${user.username}`}
                    onClick={onClose}
                    className="flex-shrink-0"
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden ring-2 ring-gray-200">
                      {user.avatarUrl ? (
                        <Image
                          src={user.avatarUrl}
                          alt={
                            user.displayName
                              ? `${user.displayName} (@${user.username})`
                              : `@${user.username}`
                          }
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Users className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </Link>

                  {/* Name */}
                  <Link
                    href={`/u/${user.username}`}
                    onClick={onClose}
                    className="flex-1 min-w-0"
                  >
                    <p className="font-bold text-sm truncate hover:underline">
                      {user.displayName || user.username || "Anonymous"}
                    </p>
                    {user.username && (
                      <p className="text-xs text-gray-500 truncate">
                        @{user.username}
                      </p>
                    )}
                  </Link>

                  {/* Follow Button */}
                  <FollowButton
                    userId={user.id}
                    initialIsFollowing={user.isFollowing}
                    size="sm"
                    onFollowChange={(isFollowing) =>
                      handleFollowChange(user.id, isFollowing)
                    }
                  />
                </div>
              ))}

              {/* Load More */}
              {hasMore && (
                <div className="pt-4 text-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    aria-label="Load more users"
                    className="px-4 py-2 text-sm font-bold text-pop-blue hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-2 mx-auto"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load more"
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
