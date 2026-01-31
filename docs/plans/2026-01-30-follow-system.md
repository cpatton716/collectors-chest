# Follow System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a one-way follow system where users can follow sellers, see their new listings, and filter the shop to show only followed users.

**Architecture:** New `user_follows` table with denormalized counts on profiles. FollowButton component used across seller badges and profiles. Notifications created on listing creation for all followers.

**Tech Stack:** Next.js API routes, Supabase (Postgres), React components with Tailwind CSS, existing notification and email infrastructure.

---

## Phase 1: Database & Core API

### Task 1.1: Create Database Migration

**Files:**
- Create: `supabase/migrations/20260130_follow_system.sql`

**Step 1: Write the migration**

```sql
-- ============================================================================
-- FOLLOW SYSTEM MIGRATION
-- ============================================================================

-- User follows table
CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_follow UNIQUE (follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_created ON user_follows(created_at DESC);

-- Add count columns to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "follows_select_policy" ON user_follows FOR SELECT USING (TRUE);
CREATE POLICY "follows_insert_policy" ON user_follows FOR INSERT
  WITH CHECK (follower_id = public.current_profile_id());
CREATE POLICY "follows_delete_policy" ON user_follows FOR DELETE
  USING (follower_id = public.current_profile_id());

-- Trigger to update counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET follower_count = follower_count + 1 WHERE id = NEW.following_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = OLD.following_id;
    UPDATE profiles SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_follow_counts ON user_follows;
CREATE TRIGGER trigger_update_follow_counts
  AFTER INSERT OR DELETE ON user_follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260130_follow_system.sql
git commit -m "feat: add follow system database migration"
```

---

### Task 1.2: Create Follow Types

**Files:**
- Create: `src/types/follow.ts`

**Step 1: Write the types**

```typescript
export interface UserFollow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
}

export interface FollowUser {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isFollowing?: boolean; // Whether current user follows this person
}

export interface FollowListResponse {
  users: FollowUser[];
  total: number;
  limit: number;
  offset: number;
}

export interface FollowCheckResponse {
  isFollowing: boolean;
  followedAt: string | null;
}

export interface FollowCounts {
  followerCount: number;
  followingCount: number;
}
```

**Step 2: Commit**

```bash
git add src/types/follow.ts
git commit -m "feat(types): add follow system type definitions"
```

---

### Task 1.3: Create Follow Database Functions

**Files:**
- Create: `src/lib/followDb.ts`

**Step 1: Write the database functions**

```typescript
import { supabase, supabaseAdmin } from "./supabase";
import { FollowUser, FollowListResponse, FollowCheckResponse, FollowCounts } from "@/types/follow";

/**
 * Follow a user
 */
export async function followUser(
  followerId: string,
  followingId: string
): Promise<{ success: boolean; error?: string }> {
  if (followerId === followingId) {
    return { success: false, error: "Cannot follow yourself" };
  }

  const { error } = await supabaseAdmin
    .from("user_follows")
    .insert({ follower_id: followerId, following_id: followingId });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Already following this user" };
    }
    console.error("Error following user:", error);
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
    console.error("Error unfollowing user:", error);
    return { success: false, error: "Failed to unfollow user" };
  }

  return { success: true };
}

/**
 * Check if a user is following another user
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
    return { isFollowing: false, followedAt: null };
  }

  return { isFollowing: true, followedAt: data.created_at };
}

/**
 * Get a user's followers
 */
export async function getFollowers(
  userId: string,
  currentUserId: string | null,
  limit = 20,
  offset = 0
): Promise<FollowListResponse> {
  // Get followers with their profile info
  const { data, error, count } = await supabaseAdmin
    .from("user_follows")
    .select(`
      follower_id,
      profiles!user_follows_follower_id_fkey (
        id,
        username,
        display_name,
        avatar_url
      )
    `, { count: "exact" })
    .eq("following_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching followers:", error);
    return { users: [], total: 0, limit, offset };
  }

  // If we have a current user, check which ones they follow
  let followingSet = new Set<string>();
  if (currentUserId) {
    const { data: following } = await supabaseAdmin
      .from("user_follows")
      .select("following_id")
      .eq("follower_id", currentUserId);
    followingSet = new Set((following || []).map(f => f.following_id));
  }

  const users: FollowUser[] = (data || []).map((row: any) => ({
    id: row.profiles.id,
    username: row.profiles.username,
    displayName: row.profiles.display_name,
    avatarUrl: row.profiles.avatar_url,
    isFollowing: followingSet.has(row.profiles.id),
  }));

  return { users, total: count || 0, limit, offset };
}

/**
 * Get users that a user is following
 */
export async function getFollowing(
  userId: string,
  currentUserId: string | null,
  limit = 20,
  offset = 0
): Promise<FollowListResponse> {
  const { data, error, count } = await supabaseAdmin
    .from("user_follows")
    .select(`
      following_id,
      profiles!user_follows_following_id_fkey (
        id,
        username,
        display_name,
        avatar_url
      )
    `, { count: "exact" })
    .eq("follower_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching following:", error);
    return { users: [], total: 0, limit, offset };
  }

  // If we have a current user, check which ones they follow
  let followingSet = new Set<string>();
  if (currentUserId) {
    const { data: following } = await supabaseAdmin
      .from("user_follows")
      .select("following_id")
      .eq("follower_id", currentUserId);
    followingSet = new Set((following || []).map(f => f.following_id));
  }

  const users: FollowUser[] = (data || []).map((row: any) => ({
    id: row.profiles.id,
    username: row.profiles.username,
    displayName: row.profiles.display_name,
    avatarUrl: row.profiles.avatar_url,
    isFollowing: followingSet.has(row.profiles.id),
  }));

  return { users, total: count || 0, limit, offset };
}

/**
 * Get follow counts for a user
 */
export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("follower_count, following_count")
    .eq("id", userId)
    .single();

  if (error || !data) {
    return { followerCount: 0, followingCount: 0 };
  }

  return {
    followerCount: data.follower_count || 0,
    followingCount: data.following_count || 0,
  };
}

/**
 * Get IDs of users that a user is following (for filtering)
 */
export async function getFollowingIds(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", userId);

  if (error) {
    console.error("Error fetching following IDs:", error);
    return [];
  }

  return (data || []).map(row => row.following_id);
}

/**
 * Get all followers of a user (for notifications)
 */
export async function getAllFollowerIds(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("user_follows")
    .select("follower_id")
    .eq("following_id", userId);

  if (error) {
    console.error("Error fetching follower IDs:", error);
    return [];
  }

  return (data || []).map(row => row.follower_id);
}
```

**Step 2: Commit**

```bash
git add src/lib/followDb.ts
git commit -m "feat(lib): add follow database functions"
```

---

### Task 1.4: Create Follow/Unfollow API Route

**Files:**
- Create: `src/app/api/follows/[userId]/route.ts`

**Step 1: Write the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { getProfileByClerkId } from "@/lib/db";
import { followUser, unfollowUser, checkFollowStatus } from "@/lib/followDb";

interface RouteParams {
  params: Promise<{ userId: string }>;
}

// POST - Follow a user
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(clerkId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { userId: followingId } = await params;

    const result = await followUser(profile.id, followingId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error following user:", error);
    return NextResponse.json({ error: "Failed to follow user" }, { status: 500 });
  }
}

// DELETE - Unfollow a user
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(clerkId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { userId: followingId } = await params;

    const result = await unfollowUser(profile.id, followingId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unfollowing user:", error);
    return NextResponse.json({ error: "Failed to unfollow user" }, { status: 500 });
  }
}

// GET - Check follow status
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ isFollowing: false, followedAt: null });
    }

    const profile = await getProfileByClerkId(clerkId);
    if (!profile) {
      return NextResponse.json({ isFollowing: false, followedAt: null });
    }

    const { userId: followingId } = await params;

    const result = await checkFollowStatus(profile.id, followingId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error checking follow status:", error);
    return NextResponse.json({ isFollowing: false, followedAt: null });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/follows/[userId]/route.ts
git commit -m "feat(api): add follow/unfollow API endpoint"
```

---

### Task 1.5: Create Followers/Following List API Routes

**Files:**
- Create: `src/app/api/follows/[userId]/followers/route.ts`
- Create: `src/app/api/follows/[userId]/following/route.ts`

**Step 1: Write followers route**

```typescript
// src/app/api/follows/[userId]/followers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { getProfileByClerkId } from "@/lib/db";
import { getFollowers } from "@/lib/followDb";

interface RouteParams {
  params: Promise<{ userId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = Number(searchParams.get("limit")) || 20;
    const offset = Number(searchParams.get("offset")) || 0;

    // Get current user for isFollowing checks
    let currentUserId: string | null = null;
    const { userId: clerkId } = await auth();
    if (clerkId) {
      const profile = await getProfileByClerkId(clerkId);
      currentUserId = profile?.id || null;
    }

    const result = await getFollowers(userId, currentUserId, limit, offset);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching followers:", error);
    return NextResponse.json({ error: "Failed to fetch followers" }, { status: 500 });
  }
}
```

**Step 2: Write following route**

```typescript
// src/app/api/follows/[userId]/following/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { getProfileByClerkId } from "@/lib/db";
import { getFollowing } from "@/lib/followDb";

interface RouteParams {
  params: Promise<{ userId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = Number(searchParams.get("limit")) || 20;
    const offset = Number(searchParams.get("offset")) || 0;

    // Get current user for isFollowing checks
    let currentUserId: string | null = null;
    const { userId: clerkId } = await auth();
    if (clerkId) {
      const profile = await getProfileByClerkId(clerkId);
      currentUserId = profile?.id || null;
    }

    const result = await getFollowing(userId, currentUserId, limit, offset);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching following:", error);
    return NextResponse.json({ error: "Failed to fetch following" }, { status: 500 });
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/follows/[userId]/followers/route.ts src/app/api/follows/[userId]/following/route.ts
git commit -m "feat(api): add followers and following list endpoints"
```

---

## Phase 2: UI Components

### Task 2.1: Create FollowButton Component

**Files:**
- Create: `src/components/follows/FollowButton.tsx`

**Step 1: Write the component**

```typescript
"use client";

import { useState } from "react";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";

interface FollowButtonProps {
  userId: string;
  initialIsFollowing?: boolean;
  size?: "sm" | "md";
  onFollowChange?: (isFollowing: boolean) => void;
}

export function FollowButton({
  userId,
  initialIsFollowing = false,
  size = "md",
  onFollowChange,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    const newFollowState = !isFollowing;

    // Optimistic update
    setIsFollowing(newFollowState);

    try {
      const response = await fetch(`/api/follows/${userId}`, {
        method: newFollowState ? "POST" : "DELETE",
      });

      if (!response.ok) {
        // Rollback on error
        setIsFollowing(!newFollowState);
        const data = await response.json();
        console.error("Follow error:", data.error);
      } else {
        onFollowChange?.(newFollowState);
      }
    } catch (error) {
      // Rollback on error
      setIsFollowing(!newFollowState);
      console.error("Follow error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = size === "sm"
    ? "px-2 py-1 text-xs gap-1"
    : "px-3 py-1.5 text-sm gap-1.5";

  const iconSize = size === "sm" ? "w-3 h-3" : "w-4 h-4";

  if (isFollowing) {
    return (
      <button
        onClick={handleClick}
        disabled={isLoading}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`inline-flex items-center font-medium rounded-lg border-2 transition-colors ${sizeClasses} ${
          isHovered
            ? "bg-red-50 border-red-300 text-red-600"
            : "bg-pop-blue/10 border-pop-blue text-pop-blue"
        } disabled:opacity-50`}
      >
        {isLoading ? (
          <Loader2 className={`${iconSize} animate-spin`} />
        ) : (
          <UserCheck className={iconSize} />
        )}
        {isHovered ? "Unfollow" : "Following"}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`inline-flex items-center font-medium rounded-lg border-2 border-pop-black bg-pop-white hover:bg-pop-yellow transition-colors ${sizeClasses} disabled:opacity-50`}
    >
      {isLoading ? (
        <Loader2 className={`${iconSize} animate-spin`} />
      ) : (
        <UserPlus className={iconSize} />
      )}
      Follow
    </button>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/follows/FollowButton.tsx
git commit -m "feat(ui): add FollowButton component"
```

---

### Task 2.2: Create FollowerCount Component

**Files:**
- Create: `src/components/follows/FollowerCount.tsx`

**Step 1: Write the component**

```typescript
"use client";

import { useState } from "react";
import { FollowListModal } from "./FollowListModal";

interface FollowerCountProps {
  userId: string;
  followerCount: number;
  followingCount: number;
}

export function FollowerCount({ userId, followerCount, followingCount }: FollowerCountProps) {
  const [showModal, setShowModal] = useState<"followers" | "following" | null>(null);

  const formatCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <>
      <div className="flex items-center gap-3 text-sm">
        <button
          onClick={() => setShowModal("followers")}
          className="hover:underline"
        >
          <span className="font-bold text-pop-black">{formatCount(followerCount)}</span>{" "}
          <span className="text-gray-600">followers</span>
        </button>
        <span className="text-gray-400">·</span>
        <button
          onClick={() => setShowModal("following")}
          className="hover:underline"
        >
          <span className="font-bold text-pop-black">{formatCount(followingCount)}</span>{" "}
          <span className="text-gray-600">following</span>
        </button>
      </div>

      {showModal && (
        <FollowListModal
          userId={userId}
          type={showModal}
          isOpen={true}
          onClose={() => setShowModal(null)}
        />
      )}
    </>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/follows/FollowerCount.tsx
git commit -m "feat(ui): add FollowerCount component"
```

---

### Task 2.3: Create FollowListModal Component

**Files:**
- Create: `src/components/follows/FollowListModal.tsx`

**Step 1: Write the component**

```typescript
"use client";

import { useEffect, useState } from "react";
import { X, Loader2, Users } from "lucide-react";
import Link from "next/link";

import { FollowButton } from "./FollowButton";
import { FollowUser } from "@/types/follow";

interface FollowListModalProps {
  userId: string;
  type: "followers" | "following";
  isOpen: boolean;
  onClose: () => void;
}

export function FollowListModal({ userId, type, isOpen, onClose }: FollowListModalProps) {
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  useEffect(() => {
    if (isOpen) {
      loadUsers(0);
    }
  }, [isOpen, userId, type]);

  const loadUsers = async (newOffset: number) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/follows/${userId}/${type}?limit=${limit}&offset=${newOffset}`
      );
      const data = await response.json();

      if (newOffset === 0) {
        setUsers(data.users);
      } else {
        setUsers((prev) => [...prev, ...data.users]);
      }
      setTotal(data.total);
      setOffset(newOffset);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = () => {
    loadUsers(offset + limit);
  };

  const hasMore = users.length < total;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-lg font-bold text-pop-black capitalize">
            {type}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && users.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Users className="w-12 h-12 mb-3 text-gray-300" />
              <p>No {type} yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <Link
                    href={`/u/${user.username || user.id}`}
                    onClick={onClose}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <div className="w-10 h-10 rounded-full bg-pop-yellow border-2 border-pop-black flex items-center justify-center font-bold text-pop-black">
                      {(user.displayName || user.username || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-pop-black truncate">
                        {user.displayName || user.username || "Unknown"}
                      </p>
                      {user.username && (
                        <p className="text-sm text-gray-500 truncate">@{user.username}</p>
                      )}
                    </div>
                  </Link>
                  <FollowButton
                    userId={user.id}
                    initialIsFollowing={user.isFollowing}
                    size="sm"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Load More */}
          {hasMore && (
            <div className="px-4 py-3 border-t">
              <button
                onClick={handleLoadMore}
                disabled={isLoading}
                className="w-full py-2 text-sm font-medium text-pop-blue hover:bg-pop-blue/5 rounded-lg transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  "Load more"
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/follows/FollowListModal.tsx
git commit -m "feat(ui): add FollowListModal component"
```

---

### Task 2.4: Create Barrel Export and useFollow Hook

**Files:**
- Create: `src/components/follows/index.ts`
- Create: `src/hooks/useFollow.ts`

**Step 1: Write barrel export**

```typescript
// src/components/follows/index.ts
export { FollowButton } from "./FollowButton";
export { FollowerCount } from "./FollowerCount";
export { FollowListModal } from "./FollowListModal";
```

**Step 2: Write useFollow hook**

```typescript
// src/hooks/useFollow.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { FollowCounts } from "@/types/follow";

interface UseFollowOptions {
  userId: string;
  initialIsFollowing?: boolean;
}

export function useFollow({ userId, initialIsFollowing = false }: UseFollowOptions) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(false);
  const [counts, setCounts] = useState<FollowCounts | null>(null);

  // Check initial follow status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/follows/${userId}`);
        const data = await response.json();
        setIsFollowing(data.isFollowing);
      } catch (error) {
        console.error("Error checking follow status:", error);
      }
    };

    if (!initialIsFollowing) {
      checkStatus();
    }
  }, [userId, initialIsFollowing]);

  const toggleFollow = useCallback(async () => {
    setIsLoading(true);
    const newState = !isFollowing;
    setIsFollowing(newState); // Optimistic

    try {
      const response = await fetch(`/api/follows/${userId}`, {
        method: newState ? "POST" : "DELETE",
      });

      if (!response.ok) {
        setIsFollowing(!newState); // Rollback
      }
    } catch (error) {
      setIsFollowing(!newState); // Rollback
      console.error("Error toggling follow:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isFollowing]);

  return {
    isFollowing,
    isLoading,
    toggleFollow,
    counts,
  };
}
```

**Step 3: Commit**

```bash
git add src/components/follows/index.ts src/hooks/useFollow.ts
git commit -m "feat: add follows barrel export and useFollow hook"
```

---

## Phase 3: Profile Integration

### Task 3.1: Add FollowButton to SellerBadge

**Files:**
- Modify: `src/components/auction/SellerBadge.tsx`

**Step 1: Update SellerBadge to include FollowButton**

Add import at top:
```typescript
import { FollowButton } from "@/components/follows";
```

Add `currentUserId` prop and FollowButton after seller name (inside the component, after the ContributorIcon):
```typescript
{/* Follow Button - only show for other users */}
{currentUserId && currentUserId !== oddi && (
  <FollowButton userId={sellerId} size="sm" />
)}
```

**Step 2: Commit**

```bash
git add src/components/auction/SellerBadge.tsx
git commit -m "feat(ui): add FollowButton to SellerBadge"
```

---

### Task 3.2: Add Follow Section to CustomProfilePage

**Files:**
- Modify: `src/components/CustomProfilePage.tsx`

**Step 1: Add imports**

```typescript
import { FollowerCount, FollowButton } from "@/components/follows";
```

**Step 2: Fetch follow counts and add to profile display**

Add state and fetch for follow counts, then display FollowerCount and FollowButton components in the profile header area.

**Step 3: Commit**

```bash
git add src/components/CustomProfilePage.tsx
git commit -m "feat(ui): add follower counts and follow button to profile page"
```

---

## Phase 4: Shop Filter

### Task 4.1: Update Auctions API for Following Filter

**Files:**
- Modify: `src/app/api/auctions/route.ts`
- Modify: `src/lib/auctionDb.ts`

**Step 1: Add followingOnly param to GET handler**

In route.ts, parse the `followingOnly` param and pass to getActiveAuctions.

**Step 2: Update getActiveAuctions to filter by followed sellers**

Add optional `followedSellerIds` param and filter query when provided.

**Step 3: Commit**

```bash
git add src/app/api/auctions/route.ts src/lib/auctionDb.ts
git commit -m "feat(api): add followingOnly filter to auctions endpoint"
```

---

### Task 4.2: Add Following Filter to Shop Page

**Files:**
- Modify: `src/app/shop/page.tsx`

**Step 1: Add toggle for "From people I follow"**

Add state, UI toggle, and pass filter to API call.

**Step 2: Handle empty state**

Show message when following no one or no results from followed users.

**Step 3: Commit**

```bash
git add src/app/shop/page.tsx
git commit -m "feat(ui): add 'From people I follow' filter to Shop"
```

---

## Phase 5: Notifications

### Task 5.1: Add Notification on Listing Creation

**Files:**
- Modify: `src/lib/auctionDb.ts`

**Step 1: Import getAllFollowerIds**

```typescript
import { getAllFollowerIds } from "./followDb";
```

**Step 2: Create notifications after listing creation**

In `createAuction` and `createFixedPriceListing`, after successful insert:
```typescript
// Notify followers
const followerIds = await getAllFollowerIds(sellerId);
for (const followerId of followerIds) {
  await createNotification(followerId, "new_listing_from_followed", auction.id);
}
```

**Step 3: Add notification type**

Update notification types to include `"new_listing_from_followed"` with appropriate message.

**Step 4: Commit**

```bash
git add src/lib/auctionDb.ts
git commit -m "feat: notify followers when user creates new listing"
```

---

### Task 5.2: Add Email for New Listing Notifications

**Files:**
- Modify: `src/lib/email.ts`
- Modify: `src/lib/auctionDb.ts`

**Step 1: Add email template for new listing from followed user**

```typescript
const newListingFromFollowedTemplate = (data: NewListingEmailData) => `
  <h2>New listing from @${data.sellerUsername}</h2>
  <p>${data.comicTitle} #${data.issueNumber}</p>
  <p>Price: $${data.price}</p>
  <a href="${data.listingUrl}">View Listing</a>
`;
```

**Step 2: Send emails to followers with notifications enabled**

Check user preferences before sending.

**Step 3: Commit**

```bash
git add src/lib/email.ts src/lib/auctionDb.ts
git commit -m "feat(email): add new listing notification email for followers"
```

---

### Task 5.3: Update FEEDBACK Document

**Files:**
- Modify: `FEEDBACK_JAN_28.md`

**Step 1: Mark #23 as complete**

Update status and add implementation notes.

**Step 2: Commit**

```bash
git add FEEDBACK_JAN_28.md
git commit -m "docs: mark follow system as complete"
```
