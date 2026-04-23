import { describe, it, expect } from "@jest/globals";

import { buildBuyerComicClone } from "../cloneSoldComic";

// Minimal seller row shape used across the tests. Values chosen so that if
// any catalog field is accidentally dropped by buildBuyerComicClone, the
// assertion will fail visibly.
const SELLER_ROW = {
  id: "seller-comic-id-1",
  user_id: "seller-profile-id",
  title: "Amazing Spider-Man",
  issue_number: "300",
  variant: "Cover A",
  publisher: "Marvel",
  cover_artist: "Todd McFarlane",
  writer: "David Michelinie",
  interior_artist: "Todd McFarlane",
  release_year: 1988,
  confidence: 0.95,
  is_slabbed: true,
  grading_company: "CGC",
  grade: 9.8,
  certification_number: "1234567890",
  label_type: "Blue",
  page_quality: "White",
  grade_date: "2024-06-01",
  grader_notes: "Pressed and cleaned",
  is_signature_series: false,
  signed_by: null,
  key_info: ["1st appearance of Venom"],
  price_data: { mean: 5000, last: 5200 },
  cover_image_url: "https://example.com/asm300.jpg",
  condition_grade: 9.8,
  condition_label: "Near Mint",
  is_graded: true,
  purchase_price: 2500,
  average_price: 5000,
};

describe("buildBuyerComicClone", () => {
  const fixedNow = new Date("2026-04-22T15:30:00.000Z");

  it("assigns the buyer's user_id on the clone", () => {
    const clone = buildBuyerComicClone(SELLER_ROW, "buyer-profile-id", 4500, fixedNow);
    expect(clone.user_id).toBe("buyer-profile-id");
  });

  it("does NOT copy the seller's row id (Supabase assigns a fresh UUID on insert)", () => {
    const clone = buildBuyerComicClone(SELLER_ROW, "buyer-profile-id", 4500, fixedNow);
    expect(clone.id).toBeUndefined();
  });

  it("copies catalog/identity fields verbatim", () => {
    const clone = buildBuyerComicClone(SELLER_ROW, "buyer-profile-id", 4500, fixedNow);
    expect(clone.title).toBe("Amazing Spider-Man");
    expect(clone.issue_number).toBe("300");
    expect(clone.variant).toBe("Cover A");
    expect(clone.publisher).toBe("Marvel");
    expect(clone.cover_artist).toBe("Todd McFarlane");
    expect(clone.writer).toBe("David Michelinie");
    expect(clone.interior_artist).toBe("Todd McFarlane");
    expect(clone.release_year).toBe(1988);
    expect(clone.is_slabbed).toBe(true);
    expect(clone.grading_company).toBe("CGC");
    expect(clone.grade).toBe(9.8);
    expect(clone.certification_number).toBe("1234567890");
    expect(clone.label_type).toBe("Blue");
    expect(clone.page_quality).toBe("White");
    expect(clone.grade_date).toBe("2024-06-01");
    expect(clone.grader_notes).toBe("Pressed and cleaned");
    expect(clone.is_signature_series).toBe(false);
    expect(clone.cover_image_url).toBe("https://example.com/asm300.jpg");
    expect(clone.condition_grade).toBe(9.8);
    expect(clone.condition_label).toBe("Near Mint");
    expect(clone.is_graded).toBe(true);
    expect(clone.average_price).toBe(5000);
    expect(clone.key_info).toEqual(["1st appearance of Venom"]);
    expect(clone.price_data).toEqual({ mean: 5000, last: 5200 });
  });

  it("sets purchase_price to the sale price, not the seller's original cost", () => {
    const clone = buildBuyerComicClone(SELLER_ROW, "buyer-profile-id", 4500, fixedNow);
    expect(clone.purchase_price).toBe(4500);
    // Seller paid 2500 for their copy — that must NOT carry over
    expect(clone.purchase_price).not.toBe(2500);
  });

  it("sets purchase_date to the sale date (today, YYYY-MM-DD)", () => {
    const clone = buildBuyerComicClone(SELLER_ROW, "buyer-profile-id", 4500, fixedNow);
    expect(clone.purchase_date).toBe("2026-04-22");
  });

  it("sets date_added to the sale timestamp (ISO string)", () => {
    const clone = buildBuyerComicClone(SELLER_ROW, "buyer-profile-id", 4500, fixedNow);
    expect(clone.date_added).toBe("2026-04-22T15:30:00.000Z");
  });

  it("resets owner-specific fields (notes, for_sale, asking_price, is_starred)", () => {
    const sellerWithPersonalData = {
      ...SELLER_ROW,
      // Mock seller had these set before sale
    };
    const clone = buildBuyerComicClone(sellerWithPersonalData, "buyer-profile-id", 4500, fixedNow);
    expect(clone.notes).toBeNull();
    expect(clone.for_sale).toBe(false);
    expect(clone.asking_price).toBeNull();
    expect(clone.is_starred).toBe(false);
  });

  it("resets custom key info (seller's pending custom data doesn't transfer)", () => {
    const clone = buildBuyerComicClone(SELLER_ROW, "buyer-profile-id", 4500, fixedNow);
    expect(clone.custom_key_info).toEqual([]);
    expect(clone.custom_key_info_status).toBeNull();
  });

  it("does not leak sold_at / sold_to_profile_id onto the buyer's fresh row", () => {
    // The buyer's clone is a fresh copy — it must not inherit the seller's
    // sold-history markers (which would make the buyer's row immediately
    // read-only).
    const clone = buildBuyerComicClone(SELLER_ROW, "buyer-profile-id", 4500, fixedNow);
    expect(clone.sold_at).toBeUndefined();
    expect(clone.sold_to_profile_id).toBeUndefined();
    expect(clone.sold_via_auction_id).toBeUndefined();
  });

  it("handles a sale price of zero gracefully (free giveaway edge case)", () => {
    const clone = buildBuyerComicClone(SELLER_ROW, "buyer-profile-id", 0, fixedNow);
    expect(clone.purchase_price).toBe(0);
  });
});
