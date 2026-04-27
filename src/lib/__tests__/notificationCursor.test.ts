/**
 * @jest-environment node
 */

import {
  buildCursorFilter,
  decodeNotificationCursor,
  encodeNotificationCursor,
  NOTIFICATIONS_PAGE_LIMIT_DEFAULT,
  NOTIFICATIONS_PAGE_LIMIT_MAX,
} from "../notificationCursor";

describe("notificationCursor", () => {
  describe("encode / decode roundtrip", () => {
    it("preserves a typical (createdAt, id) pair", () => {
      const cursor = {
        createdAt: "2026-04-27T15:30:00.123456Z",
        id: "11111111-2222-3333-4444-555555555555",
      };
      const encoded = encodeNotificationCursor(cursor);
      const decoded = decodeNotificationCursor(encoded);
      expect(decoded).toEqual(cursor);
    });

    it("URL-safe encoding has no '+', '/', or '=' characters", () => {
      const cursor = {
        createdAt: "2026-04-27T15:30:00.123456Z",
        id: "abcdef00-1111-2222-3333-444444444444",
      };
      const encoded = encodeNotificationCursor(cursor);
      expect(encoded).not.toMatch(/[+/=]/);
    });

    it("returns empty string for null cursor", () => {
      expect(encodeNotificationCursor(null)).toBe("");
      expect(encodeNotificationCursor(undefined)).toBe("");
    });
  });

  describe("decode error tolerance", () => {
    it("returns null for empty / non-string input", () => {
      expect(decodeNotificationCursor("")).toBeNull();
      expect(decodeNotificationCursor(null)).toBeNull();
      expect(decodeNotificationCursor(undefined)).toBeNull();
    });

    it("returns null for malformed base64", () => {
      expect(decodeNotificationCursor("!!!not-base64!!!")).toBeNull();
    });

    it("returns null for base64 missing the '|' separator", () => {
      const encoded = Buffer.from("no-separator-here", "utf-8")
        .toString("base64")
        .replace(/=+$/, "");
      expect(decodeNotificationCursor(encoded)).toBeNull();
    });

    it("returns null when separator is at the start or end", () => {
      const encodedStart = Buffer.from("|abc", "utf-8")
        .toString("base64")
        .replace(/=+$/, "");
      const encodedEnd = Buffer.from("abc|", "utf-8")
        .toString("base64")
        .replace(/=+$/, "");
      expect(decodeNotificationCursor(encodedStart)).toBeNull();
      expect(decodeNotificationCursor(encodedEnd)).toBeNull();
    });
  });

  describe("buildCursorFilter", () => {
    it("returns empty string when cursor is null (caller should skip .or())", () => {
      expect(buildCursorFilter(null)).toBe("");
    });

    it("emits the composite (created_at, id) < (X, Y) PostgREST predicate", () => {
      const filter = buildCursorFilter({
        createdAt: "2026-04-27T15:30:00.123456Z",
        id: "abcdef00-1111-2222-3333-444444444444",
      });
      // Two-branch predicate: strictly-less timestamp OR (equal timestamp AND smaller id).
      expect(filter).toBe(
        "created_at.lt.2026-04-27T15:30:00.123456Z,and(created_at.eq.2026-04-27T15:30:00.123456Z,id.lt.abcdef00-1111-2222-3333-444444444444)"
      );
    });
  });

  describe("limits", () => {
    it("default page limit is 50", () => {
      expect(NOTIFICATIONS_PAGE_LIMIT_DEFAULT).toBe(50);
    });

    it("max page limit is 100 (DoS guard)", () => {
      expect(NOTIFICATIONS_PAGE_LIMIT_MAX).toBe(100);
    });
  });
});
