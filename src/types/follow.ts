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
