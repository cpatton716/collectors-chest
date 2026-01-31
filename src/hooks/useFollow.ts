"use client";

import { useCallback, useEffect, useState } from "react";

import type { FollowCheckResponse, FollowCounts } from "@/types/follow";

interface UseFollowState {
  isFollowing: boolean;
  isLoading: boolean;
  followerCount: number;
  followingCount: number;
  error: string | null;
}

interface UseFollowReturn extends UseFollowState {
  toggleFollow: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing follow state for a specific user
 *
 * @param userId - The profile ID of the user to follow/unfollow
 * @returns Object with follow state and actions
 *
 * @example
 * ```tsx
 * const { isFollowing, toggleFollow, followerCount } = useFollow(userId);
 *
 * return (
 *   <button onClick={toggleFollow}>
 *     {isFollowing ? 'Unfollow' : 'Follow'}
 *   </button>
 * );
 * ```
 */
export function useFollow(userId: string): UseFollowReturn {
  const [state, setState] = useState<UseFollowState>({
    isFollowing: false,
    isLoading: true,
    followerCount: 0,
    followingCount: 0,
    error: null,
  });

  // Fetch follow status and counts
  const fetchStatus = useCallback(async () => {
    if (!userId) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`/api/follows/${userId}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch follow status");
      }

      const data: FollowCheckResponse & FollowCounts = await response.json();

      setState({
        isFollowing: data.isFollowing,
        isLoading: false,
        followerCount: data.followerCount,
        followingCount: data.followingCount,
        error: null,
      });
    } catch (err) {
      console.error("[useFollow] Error fetching status:", err);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to fetch follow status",
      }));
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Toggle follow/unfollow with optimistic update
  const toggleFollow = useCallback(async () => {
    if (!userId) return;

    const previousState = { ...state };
    const newIsFollowing = !state.isFollowing;

    // Optimistic update
    setState((prev) => ({
      ...prev,
      isFollowing: newIsFollowing,
      // Adjust follower count optimistically
      followerCount: newIsFollowing
        ? prev.followerCount + 1
        : Math.max(0, prev.followerCount - 1),
      error: null,
    }));

    try {
      const response = await fetch(`/api/follows/${userId}`, {
        method: newIsFollowing ? "POST" : "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Follow action failed");
      }

      // After successful follow/unfollow, fetch fresh counts
      // This ensures counts are accurate even if other users followed/unfollowed
      await fetchStatus();
    } catch (err) {
      // Rollback on error
      console.error("[useFollow] Toggle error:", err);
      setState({
        ...previousState,
        error: err instanceof Error ? err.message : "Follow action failed",
      });
    }
  }, [userId, state, fetchStatus]);

  return {
    ...state,
    toggleFollow,
    refresh: fetchStatus,
  };
}
