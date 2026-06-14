/**
 * notificationsCache tests (L-CC29)
 *
 * Focus: the versioned localStorage contract - round-trip read/write, the
 * version-mismatch discard-and-refetch path, per-profile key isolation, and
 * graceful no-op behavior on parse/quota failures.
 */
import type { Notification } from "@/types/auction";

import {
  clearNotificationsCache,
  readNotificationsCache,
  writeNotificationsCache,
} from "../notificationsCache";

const CACHE_KEY_PREFIX = "cc_notifications_inbox_";
const CURRENT_VERSION = 1;

// Real in-memory localStorage so versioning/parse behavior is exercised end to
// end (jest.setup mocks global.localStorage with jest.fn stubs, which don't
// store anything). We attach a fresh store to window before each test.
function installMemoryLocalStorage(): Record<string, string> {
  const store: Record<string, string> = {};
  const mock = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
  Object.defineProperty(window, "localStorage", { value: mock, writable: true, configurable: true });
  return store;
}

const sampleNotifications: Notification[] = [
  { id: "n1" } as unknown as Notification,
  { id: "n2" } as unknown as Notification,
];

describe("notificationsCache", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = installMemoryLocalStorage();
  });

  describe("write + read round-trip", () => {
    it("returns the snapshot it wrote", () => {
      writeNotificationsCache("profile-a", sampleNotifications, 2);
      const entry = readNotificationsCache("profile-a");
      expect(entry).not.toBeNull();
      expect(entry!.version).toBe(CURRENT_VERSION);
      expect(entry!.unreadCount).toBe(2);
      expect(entry!.notifications).toHaveLength(2);
      expect(typeof entry!.savedAt).toBe("string");
    });

    it("scopes cache entries per profile id", () => {
      writeNotificationsCache("profile-a", sampleNotifications, 2);
      writeNotificationsCache("profile-b", [], 0);
      expect(readNotificationsCache("profile-a")!.unreadCount).toBe(2);
      expect(readNotificationsCache("profile-b")!.unreadCount).toBe(0);
      expect(store[`${CACHE_KEY_PREFIX}profile-a`]).toBeDefined();
      expect(store[`${CACHE_KEY_PREFIX}profile-b`]).toBeDefined();
    });
  });

  describe("misses and invalid input", () => {
    it("returns null on a cache miss", () => {
      expect(readNotificationsCache("nobody")).toBeNull();
    });

    it("returns null for an empty profile id", () => {
      expect(readNotificationsCache("")).toBeNull();
      writeNotificationsCache("", sampleNotifications, 1);
      expect(Object.keys(store)).toHaveLength(0);
    });

    it("returns null and self-heals when stored JSON is corrupt", () => {
      store[`${CACHE_KEY_PREFIX}profile-a`] = "{not valid json";
      expect(readNotificationsCache("profile-a")).toBeNull();
    });
  });

  describe("version mismatch (L-CC29)", () => {
    it("discards and removes an entry written under an older version", () => {
      const stale = {
        version: CURRENT_VERSION - 1,
        savedAt: new Date().toISOString(),
        notifications: sampleNotifications,
        unreadCount: 5,
      };
      store[`${CACHE_KEY_PREFIX}profile-a`] = JSON.stringify(stale);

      // Mismatch -> treated as a miss (caller refetches from network)...
      expect(readNotificationsCache("profile-a")).toBeNull();
      // ...and the stale key is purged so it can't be re-read.
      expect(store[`${CACHE_KEY_PREFIX}profile-a`]).toBeUndefined();
    });

    it("discards an entry from a future version too", () => {
      const future = {
        version: CURRENT_VERSION + 1,
        savedAt: new Date().toISOString(),
        notifications: [],
        unreadCount: 0,
      };
      store[`${CACHE_KEY_PREFIX}profile-a`] = JSON.stringify(future);
      expect(readNotificationsCache("profile-a")).toBeNull();
      expect(store[`${CACHE_KEY_PREFIX}profile-a`]).toBeUndefined();
    });
  });

  describe("clearNotificationsCache", () => {
    it("removes only the targeted profile's entry", () => {
      writeNotificationsCache("profile-a", sampleNotifications, 2);
      writeNotificationsCache("profile-b", sampleNotifications, 3);
      clearNotificationsCache("profile-a");
      expect(readNotificationsCache("profile-a")).toBeNull();
      expect(readNotificationsCache("profile-b")).not.toBeNull();
    });

    it("is a no-op for an empty profile id", () => {
      writeNotificationsCache("profile-a", sampleNotifications, 2);
      clearNotificationsCache("");
      expect(readNotificationsCache("profile-a")).not.toBeNull();
    });
  });
});
