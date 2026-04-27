/**
 * @jest-environment node
 */

import {
  getNotificationDeepLink,
  isNonDeletableNotification,
  isNotificationClickableInBell,
  NON_DELETABLE_NOTIFICATION_TYPES,
} from "../notificationLinks";

import type { Notification } from "@/types/auction";

function makeNotification(overrides: Partial<Notification>): Notification {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    userId: "user-1",
    type: "outbid",
    title: "Test",
    message: "Test message",
    auctionId: null,
    isRead: false,
    readAt: null,
    createdAt: "2026-04-27T15:30:00.123456Z",
    ...overrides,
  };
}

describe("getNotificationDeepLink", () => {
  it("links auction-targeted notifications to /shop?listing=ID", () => {
    const n = makeNotification({ type: "outbid", auctionId: "auction-1" });
    expect(getNotificationDeepLink(n)).toBe("/shop?listing=auction-1");
  });

  it("appends &leave-feedback=true for rating_request", () => {
    const n = makeNotification({ type: "rating_request", auctionId: "auction-1" });
    expect(getNotificationDeepLink(n)).toBe(
      "/shop?listing=auction-1&leave-feedback=true"
    );
  });

  it("falls back to /notifications?focus=ID when there is no auction_id", () => {
    const n = makeNotification({
      id: "abc-123",
      type: "payment_missed_warning",
      auctionId: null,
    });
    expect(getNotificationDeepLink(n)).toBe("/notifications?focus=abc-123");
  });
});

describe("isNotificationClickableInBell", () => {
  it("returns true for auction-targeted notifications", () => {
    const n = makeNotification({ type: "outbid", auctionId: "auction-1" });
    expect(isNotificationClickableInBell(n)).toBe(true);
  });

  it("returns false for system-only notifications", () => {
    const n = makeNotification({ type: "payment_missed_warning", auctionId: null });
    expect(isNotificationClickableInBell(n)).toBe(false);
  });
});

describe("NON_DELETABLE_NOTIFICATION_TYPES", () => {
  it("blocks deletion of payment-miss strike-system warnings", () => {
    expect(isNonDeletableNotification("payment_missed_warning")).toBe(true);
    expect(isNonDeletableNotification("payment_missed_flagged")).toBe(true);
  });

  it("blocks deletion of payment-expiry seller/buyer notices", () => {
    expect(isNonDeletableNotification("auction_payment_expired")).toBe(true);
    expect(isNonDeletableNotification("auction_payment_expired_seller")).toBe(true);
  });

  it("allows deletion of normal lifecycle notifications", () => {
    expect(isNonDeletableNotification("outbid")).toBe(false);
    expect(isNonDeletableNotification("won")).toBe(false);
    expect(isNonDeletableNotification("shipped")).toBe(false);
    expect(isNonDeletableNotification("rating_request")).toBe(false);
    expect(isNonDeletableNotification("auction_sold")).toBe(false);
  });

  it("set membership matches isNonDeletableNotification", () => {
    NON_DELETABLE_NOTIFICATION_TYPES.forEach((t) => {
      expect(isNonDeletableNotification(t)).toBe(true);
    });
  });
});
