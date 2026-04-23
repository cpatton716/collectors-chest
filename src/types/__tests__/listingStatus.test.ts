import { describe, it, expect } from "@jest/globals";

import { isListingFinalized, isListingCompleted, isListingPendingPayment } from "../auction";

describe("isListingFinalized", () => {
  it("returns false for active listings", () => {
    expect(isListingFinalized("active")).toBe(false);
  });

  it("returns true for sold, ended, and cancelled", () => {
    expect(isListingFinalized("sold")).toBe(true);
    expect(isListingFinalized("ended")).toBe(true);
    expect(isListingFinalized("cancelled")).toBe(true);
  });
});

describe("isListingCompleted", () => {
  it("returns true for Buy Now paid (status=sold + winner + paid)", () => {
    expect(
      isListingCompleted({
        status: "sold",
        winnerId: "buyer-1",
        paymentStatus: "paid",
      })
    ).toBe(true);
  });

  it("returns true for auction paid via ended state (status=ended + winner + paid)", () => {
    // Edge case: if an auction was marked ended + paid before our webhook
    // normalization flipped it to sold, the UI should still show it as completed.
    expect(
      isListingCompleted({
        status: "ended",
        winnerId: "buyer-1",
        paymentStatus: "paid",
      })
    ).toBe(true);
  });

  it("returns false when payment is still pending (awaiting buyer)", () => {
    expect(
      isListingCompleted({
        status: "ended",
        winnerId: "buyer-1",
        paymentStatus: "pending",
      })
    ).toBe(false);
    expect(
      isListingCompleted({
        status: "sold",
        winnerId: "buyer-1",
        paymentStatus: "pending",
      })
    ).toBe(false);
  });

  it("returns false when there is no winner (auction expired unsold)", () => {
    expect(
      isListingCompleted({
        status: "ended",
        winnerId: null,
        paymentStatus: null,
      })
    ).toBe(false);
  });

  it("returns false for active listings regardless of winner/payment", () => {
    expect(
      isListingCompleted({
        status: "active",
        winnerId: "buyer-1",
        paymentStatus: "paid",
      })
    ).toBe(false);
  });

  it("returns false for cancelled listings", () => {
    expect(
      isListingCompleted({
        status: "cancelled",
        winnerId: null,
        paymentStatus: null,
      })
    ).toBe(false);
  });
});

describe("isListingPendingPayment", () => {
  it("returns true when winner is picked but payment is pending", () => {
    expect(
      isListingPendingPayment({
        status: "ended",
        winnerId: "buyer-1",
        paymentStatus: "pending",
      })
    ).toBe(true);
    expect(
      isListingPendingPayment({
        status: "sold",
        winnerId: "buyer-1",
        paymentStatus: "pending",
      })
    ).toBe(true);
  });

  it("returns false once payment clears", () => {
    expect(
      isListingPendingPayment({
        status: "sold",
        winnerId: "buyer-1",
        paymentStatus: "paid",
      })
    ).toBe(false);
  });

  it("returns false for active listings", () => {
    expect(
      isListingPendingPayment({
        status: "active",
        winnerId: null,
        paymentStatus: null,
      })
    ).toBe(false);
  });

  it("returns false for auction that ended without winner", () => {
    expect(
      isListingPendingPayment({
        status: "ended",
        winnerId: null,
        paymentStatus: null,
      })
    ).toBe(false);
  });
});
