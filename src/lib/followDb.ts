/**
 * Follow System Database Functions
 *
 * Server-side database operations for the user follow system.
 * Uses supabaseAdmin to bypass RLS - only use in API routes.
 */

import { supabaseAdmin } from "./supabase";
import {
  FollowUser,
  FollowListResponse,
  FollowCheckResponse,
  FollowCounts,
} from "@/types/follow";

// ============================================================================
// DATABASE ROW TYPES (snake_case from Postgres)
// ============================================================================

interface UserFollowRow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface FollowCountsRow {
  follower_count: number;
  following_count: number;
}

// ============================================================================
// TRANSFORM HELPERS
// ============================================================================

/**
 * Build display name from profile data
 */
function buildDisplayName(profile: ProfileRow): string | null {
  return profile.display_name || null;
}

/**
 * Transform profile row to FollowUser type
 */
function transformToFollowUser(profile: ProfileRow, isFollowing?: boolean): FollowUser {
  return {
    id: profile.id,
    username: profile.username,
    displayName: buildDisplayName(profile),
    avatarUrl: profile.avatar_url,
    isFollowing,
  };
}

// ============================================================================
// FOLLOW / UNFOLLOW
// ============================================================================

/**
 * Follow a user
 */
export async function followUser(
  followerId: string,
  followingId: string
): Promise<{ success: boolean; error?: string }> {
  // Cannot follow yourself
  if (followerId === followingId) {
    return { success: false, error: "Cannot follow yourself" };
  }

  const { error } = await supabaseAdmin.from("user_follows").insert({
    follower_id: followerId,
    following_id: followingId,
  });

  if (error) {
    // Handle duplicate follow (unique constraint violation)
    if (error.code === "23505") {
      return { success: false, error: "Already following this user" };
    }
    console.error("[followDb] Failed to follow user:", error);
    return { success: false, error: "Failed to follow user" };
  }

  return { success: true };
}

/**
 * Unfollow a user
 */
export async function unfollowUser(
  followerId: string,
  followingId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from("user_follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("following_id", followingId);

  if (error) {
    console.error("[followDb] Failed to unfollow user:", error);
    return { success: false, error: "Failed to unfollow user" };
  }

  return { success: true };
}

// ============================================================================
// FOLLOW STATUS CHECK
// ============================================================================

/**
 * Check if one user follows another
 */
export async function checkFollowStatus(
  followerId: string,
  followingId: string
): Promise<FollowCheckResponse> {
  const { data, error } = await supabaseAdmin
    .from("user_follows")
    .select("created_at")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .single();

  if (error || !data) {
    return {
      isFollowing: false,
      followedAt: null,
    };
  }

  return {
    isFollowing: true,
    followedAt: data.created_at,
  };
}

// ============================================================================
// FOLLOWERS / FOLLOWING LISTS
// ============================================================================

/**
 * Get followers for a user
 */
export async function getFollowers(
  userId: string,
  currentUserId: string | null,
  limit: number = 20,
  offset: number = 0
): Promise<FollowListResponse> {
  // Get total count of followers
  const { count } = await supabaseAdmin
    .from("user_follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", userId);

  // Get follower records with profile info
  const { data: followRecords, error } = await supabaseAdmin
    .from("user_follows")
    .select(
      `
      follower_id,
      created_at,
      follower:profiles!follower_id(id, username, display_name, avatar_url)
    `
    )
    .eq("following_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[followDb] Failed to get followers:", error);
    return { users: [], total: 0, limit, offset };
  }

  // Get IDs of users the current user follows (for isFollowing flag)
  let currentUserFollowingIds: Set<string> = new Set();
  if (currentUserId) {
    const followingIds = await getFollowingIds(currentUserId);
    currentUserFollowingIds = new Set(followingIds);
  }

  // Transform to FollowUser array
  const users: FollowUser[] = (followRecords || []).map((record) => {
    const profile = record.follower as unknown as ProfileRow;
    const isFollowing = currentUserId ? currentUserFollowingIds.has(profile.id) : undefined;
    return transformToFollowUser(profile, isFollowing);
  });

  return {
    users,
    total: count || 0,
    limit,
    offset,
  };
}

/**
 * Get users that a user is following
 */
export async function getFollowing(
  userId: string,
  currentUserId: string | null,
  limit: number = 20,
  offset: number = 0
): Promise<FollowListResponse> {
  // Get total count of following
  const { count } = await supabaseAdmin
    .from("user_follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", userId);

  // Get following records with profile info
  const { data: followRecords, error } = await supabaseAdmin
    .from("user_follows")
    .select(
      `
      following_id,
      created_at,
      following:profiles!following_id(id, username, display_name, avatar_url)
    `
    )
    .eq("follower_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[followDb] Failed to get following:", error);
    return { users: [], total: 0, limit, offset };
  }

  // Get IDs of users the current user follows (for isFollowing flag)
  let currentUserFollowingIds: Set<string> = new Set();
  if (currentUserId) {
    const followingIds = await getFollowingIds(currentUserId);
    currentUserFollowingIds = new Set(followingIds);
  }

  // Transform to FollowUser array
  const users: FollowUser[] = (followRecords || []).map((record) => {
    const profile = record.following as unknown as ProfileRow;
    const isFollowing = currentUserId ? currentUserFollowingIds.has(profile.id) : undefined;
    return transformToFollowUser(profile, isFollowing);
  });

  return {
    users,
    total: count || 0,
    limit,
    offset,
  };
}

// ============================================================================
// COUNT RETRIEVAL
// ============================================================================

/**
 * Get follower and following counts for a user
 */
export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("follower_count, following_count")
    .eq("id", userId)
    .single();

  if (error || !data) {
    console.error("[followDb] Failed to get follow counts:", error);
    return { followerCount: 0, followingCount: 0 };
  }

  const counts = data as FollowCountsRow;
  return {
    followerCount: counts.follower_count,
    followingCount: counts.following_count,
  };
}

// ============================================================================
// ID ARRAYS (for filtering)
// ============================================================================

/**
 * Get array of user IDs that this user follows
 * Useful for filtering shop listings to followed sellers
 */
export async function getFollowingIds(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", userId);

  if (error) {
    console.error("[followDb] Failed to get following IDs:", error);
    return [];
  }

  return (data || []).map((row) => row.following_id);
}

/**
 * Get array of user IDs that follow this user
 * Useful for sending notifications to followers
 */
export async function getAllFollowerIds(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("user_follows")
    .select("follower_id")
    .eq("following_id", userId);

  if (error) {
    console.error("[followDb] Failed to get follower IDs:", error);
    return [];
  }

  return (data || []).map((row) => row.follower_id);
}
