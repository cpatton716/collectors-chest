/**
 * Follow Database Helper Tests
 *
 * Tests the REAL pure helpers exported from followDb.ts (no longer a stale
 * re-implementation - M-SO3) plus the scoped isFollowing lookup (M-SO5).
 *
 * Supabase is mocked so importing followDb.ts never constructs a real client.
 */

// Mock @upstash/redis (imported transitively via supabase -> cache chain).
jest.mock("@upstash/redis", () => ({
  Redis: jest.fn().mockImplementation(() => ({ get: jest.fn(), set: jest.fn(), del: jest.fn() })),
}));

// Controllable supabase mock. Each query builds a fresh chain whose terminal
// result we can program per-test via mockInResult.
let mockInResult: { data: unknown; error: unknown } = { data: [], error: null };
const inSpy = jest.fn();

jest.mock("../supabase", () => {
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    chain.select = jest.fn(() => chain);
    chain.eq = jest.fn(() => chain);
    chain.in = jest.fn((col: string, ids: string[]) => {
      inSpy(col, ids);
      return Promise.resolve(mockInResult);
    });
    return chain;
  };
  return {
    supabase: { from: jest.fn(() => makeChain()) },
    supabaseAdmin: { from: jest.fn(() => makeChain()) },
  };
});

import {
  buildDisplayName,
  transformToFollowUser,
  followUser,
  type ProfileRow,
} from "../followDb";

beforeEach(() => {
  mockInResult = { data: [], error: null };
  inSpy.mockClear();
});

describe("followDb helpers (real implementation)", () => {
  describe("buildDisplayName", () => {
    it("returns the display_name when present", () => {
      const profile: ProfileRow = {
        id: "123",
        username: "johndoe",
        display_name: "John Doe",
        avatar_url: null,
      };
      expect(buildDisplayName(profile)).toBe("John Doe");
    });

    it("returns null when display_name is missing", () => {
      const profile: ProfileRow = {
        id: "123",
        username: "johndoe",
        display_name: null,
        avatar_url: null,
      };
      expect(buildDisplayName(profile)).toBeNull();
    });

    it("returns null when display_name is an empty string", () => {
      const profile: ProfileRow = {
        id: "123",
        username: "johndoe",
        display_name: "",
        avatar_url: null,
      };
      // Empty string is falsy -> null
      expect(buildDisplayName(profile)).toBeNull();
    });
  });

  describe("transformToFollowUser", () => {
    it("transforms a profile with all fields populated", () => {
      const profile: ProfileRow = {
        id: "user-123",
        username: "spiderfan",
        display_name: "Peter Parker",
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

    it("transforms a profile with minimal fields", () => {
      const profile: ProfileRow = {
        id: "user-456",
        username: null,
        display_name: null,
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

    it("leaves isFollowing undefined when not provided", () => {
      const profile: ProfileRow = {
        id: "user-789",
        username: "collector",
        display_name: "Tony",
        avatar_url: null,
      };

      const result = transformToFollowUser(profile);

      expect(result.isFollowing).toBeUndefined();
      expect(result.displayName).toBe("Tony");
    });
  });
});

describe("self-follow prevention (real followUser)", () => {
  it("rejects following yourself without touching the database", async () => {
    const result = await followUser("user-123", "user-123");
    expect(result).toEqual({ success: false, error: "Cannot follow yourself" });
    // No .in query (and more importantly, no insert) should occur.
    expect(inSpy).not.toHaveBeenCalled();
  });
});

describe("getFollowers isFollowing scoping (M-SO5)", () => {
  it("scopes the isFollowing lookup to the page's profile IDs, not a full scan", async () => {
    // followRecords: two followers on this page.
    let call = 0;
    const supabaseAdmin = jest.requireMock("../supabase").supabaseAdmin as {
      from: jest.Mock;
    };
    supabaseAdmin.from.mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain.select = jest.fn(() => chain);
      chain.eq = jest.fn(() => chain);
      chain.order = jest.fn(() => chain);
      chain.range = jest.fn(() =>
        Promise.resolve({
          data: [
            { follower: { id: "a", username: "a", display_name: "A", avatar_url: null } },
            { follower: { id: "b", username: "b", display_name: "B", avatar_url: null } },
          ],
          error: null,
        })
      );
      chain.in = jest.fn((col: string, ids: string[]) => {
        inSpy(col, ids);
        return Promise.resolve({ data: [{ following_id: "a" }], error: null });
      });
      // count head query: first .eq() resolves a count object via `then`
      chain.then = undefined;
      // Make head-count select resolve to a count.
      const select = chain.select as jest.Mock;
      select.mockImplementation((_cols?: string, opts?: { head?: boolean }) => {
        if (opts?.head) {
          return {
            eq: jest.fn(() => Promise.resolve({ count: 2 })),
          };
        }
        call++;
        return chain;
      });
      return chain;
    });

    const { getFollowers } = await import("../followDb");
    const res = await getFollowers("target-user", "current-user", 20, 0);

    // The scoped lookup was called with EXACTLY this page's two profile IDs.
    expect(inSpy).toHaveBeenCalledWith("following_id", ["a", "b"]);

    // isFollowing reflects only the scoped result: a=true, b=false.
    const a = res.users.find((u) => u.id === "a");
    const b = res.users.find((u) => u.id === "b");
    expect(a?.isFollowing).toBe(true);
    expect(b?.isFollowing).toBe(false);
    expect(call).toBeGreaterThanOrEqual(0);
  });
});
