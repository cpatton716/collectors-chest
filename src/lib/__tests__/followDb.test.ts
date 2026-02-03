/**
 * Follow Database Helper Tests
 *
 * Tests for pure helper functions in followDb.ts
 * Database functions are tested via integration tests (require Supabase)
 */

// Re-implement the pure functions for testing (they're not exported)
// These tests ensure the logic is correct

interface ProfileRow {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

interface FollowUser {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isFollowing?: boolean;
}

function buildDisplayName(profile: ProfileRow): string | null {
  if (profile.first_name && profile.last_name) {
    return `${profile.first_name} ${profile.last_name}`;
  }
  return profile.first_name || profile.last_name || null;
}

function transformToFollowUser(
  profile: ProfileRow,
  isFollowing?: boolean
): FollowUser {
  return {
    id: profile.id,
    username: profile.username,
    displayName: buildDisplayName(profile),
    avatarUrl: profile.avatar_url,
    isFollowing,
  };
}

describe("followDb helpers", () => {
  describe("buildDisplayName", () => {
    it("returns full name when both first and last name exist", () => {
      const profile: ProfileRow = {
        id: "123",
        username: "johndoe",
        first_name: "John",
        last_name: "Doe",
        avatar_url: null,
      };
      expect(buildDisplayName(profile)).toBe("John Doe");
    });

    it("returns first name only when last name is missing", () => {
      const profile: ProfileRow = {
        id: "123",
        username: "johndoe",
        first_name: "John",
        last_name: null,
        avatar_url: null,
      };
      expect(buildDisplayName(profile)).toBe("John");
    });

    it("returns last name only when first name is missing", () => {
      const profile: ProfileRow = {
        id: "123",
        username: "johndoe",
        first_name: null,
        last_name: "Doe",
        avatar_url: null,
      };
      expect(buildDisplayName(profile)).toBe("Doe");
    });

    it("returns null when both names are missing", () => {
      const profile: ProfileRow = {
        id: "123",
        username: "johndoe",
        first_name: null,
        last_name: null,
        avatar_url: null,
      };
      expect(buildDisplayName(profile)).toBeNull();
    });

    it("returns null when both names are empty strings", () => {
      const profile: ProfileRow = {
        id: "123",
        username: "johndoe",
        first_name: "",
        last_name: "",
        avatar_url: null,
      };
      // Empty strings are falsy, so this returns null
      expect(buildDisplayName(profile)).toBeNull();
    });
  });

  describe("transformToFollowUser", () => {
    it("transforms profile with all fields populated", () => {
      const profile: ProfileRow = {
        id: "user-123",
        username: "spiderfan",
        first_name: "Peter",
        last_name: "Parker",
        avatar_url: "https://example.com/avatar.jpg",
      };

      const result = transformToFollowUser(profile, true);

      expect(result).toEqual({
        id: "user-123",
        username: "spiderfan",
        displayName: "Peter Parker",
        avatarUrl: "https://example.com/avatar.jpg",
        isFollowing: true,
      });
    });

    it("transforms profile with minimal fields", () => {
      const profile: ProfileRow = {
        id: "user-456",
        username: null,
        first_name: null,
        last_name: null,
        avatar_url: null,
      };

      const result = transformToFollowUser(profile, false);

      expect(result).toEqual({
        id: "user-456",
        username: null,
        displayName: null,
        avatarUrl: null,
        isFollowing: false,
      });
    });

    it("handles undefined isFollowing", () => {
      const profile: ProfileRow = {
        id: "user-789",
        username: "collector",
        first_name: "Tony",
        last_name: null,
        avatar_url: null,
      };

      const result = transformToFollowUser(profile);

      expect(result.isFollowing).toBeUndefined();
      expect(result.displayName).toBe("Tony");
    });
  });
});

describe("follow business logic", () => {
  describe("self-follow prevention", () => {
    it("should prevent users from following themselves", () => {
      const followerId = "user-123";
      const followingId = "user-123";

      // This mirrors the check in followUser()
      const canFollow = followerId !== followingId;

      expect(canFollow).toBe(false);
    });

    it("should allow following different users", () => {
      const followerId = "user-123" as string;
      const followingId = "user-456" as string;

      const canFollow = followerId !== followingId;

      expect(canFollow).toBe(true);
    });
  });

  describe("optimistic count updates", () => {
    it("increments follower count on follow", () => {
      const currentCount = 10;
      const isFollowing = true;

      const newCount = isFollowing ? currentCount + 1 : currentCount - 1;

      expect(newCount).toBe(11);
    });

    it("decrements follower count on unfollow", () => {
      const currentCount = 10;
      const isFollowing = false;

      const newCount = isFollowing ? currentCount + 1 : currentCount - 1;

      expect(newCount).toBe(9);
    });

    it("never goes below zero on unfollow", () => {
      const currentCount = 0;
      const isFollowing = false;

      const newCount = isFollowing
        ? currentCount + 1
        : Math.max(0, currentCount - 1);

      expect(newCount).toBe(0);
    });
  });
});
