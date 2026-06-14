/**
 * creatorCreditsDb pure-helper tests
 *
 * Covers transformFeedback field mapping + null/joined-field handling (L-SO12).
 * Supabase is mocked so importing creatorCreditsDb.ts never constructs a real
 * client - transformFeedback itself is a pure transform.
 */

// Mock @upstash/redis (imported transitively via supabase -> cache chain).
jest.mock("@upstash/redis", () => ({
  Redis: jest.fn().mockImplementation(() => ({ get: jest.fn(), set: jest.fn(), del: jest.fn() })),
}));

// Mock the supabase clients - the pure helper never calls them, but importing
// creatorCreditsDb.ts evaluates the module which imports supabaseAdmin.
jest.mock("../supabase", () => ({
  supabase: { from: jest.fn() },
  supabaseAdmin: { from: jest.fn() },
}));

import { transformFeedback } from "../creatorCreditsDb";

// Mirror of the (non-exported) FeedbackRow shape consumed by transformFeedback.
type FeedbackRowInput = Parameters<typeof transformFeedback>[0];

function baseRow(overrides: Partial<FeedbackRowInput> = {}): FeedbackRowInput {
  return {
    id: "fb-1",
    transaction_type: "auction",
    transaction_id: "txn-1",
    reviewer_id: "rev-1",
    reviewee_id: "tgt-1",
    rating_type: "positive",
    comment: "Great seller",
    seller_response: null,
    seller_response_at: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: null,
    reviewer: { display_name: "Reviewer Name", username: "reviewer1" },
    ...overrides,
  } as FeedbackRowInput;
}

describe("transformFeedback", () => {
  it("maps every snake_case column to its camelCase field", () => {
    const result = transformFeedback(baseRow());

    expect(result).toEqual({
      id: "fb-1",
      transactionType: "auction",
      transactionId: "txn-1",
      reviewerId: "rev-1",
      revieweeId: "tgt-1",
      ratingType: "positive",
      comment: "Great seller",
      sellerResponse: null,
      sellerResponseAt: null,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: null,
      reviewerName: "Reviewer Name",
      reviewerUsername: "reviewer1",
    });
  });

  it("prefers display_name, then falls back to username for reviewerName", () => {
    const result = transformFeedback(
      baseRow({ reviewer: { display_name: null, username: "reviewer1" } })
    );

    expect(result.reviewerName).toBe("reviewer1");
    expect(result.reviewerUsername).toBe("reviewer1");
  });

  it("returns undefined reviewerName/reviewerUsername when reviewer join is missing", () => {
    const result = transformFeedback(baseRow({ reviewer: undefined }));

    expect(result.reviewerName).toBeUndefined();
    expect(result.reviewerUsername).toBeUndefined();
  });

  it("returns undefined reviewerName when both joined name fields are null", () => {
    const result = transformFeedback(
      baseRow({ reviewer: { display_name: null, username: null } })
    );

    expect(result.reviewerName).toBeUndefined();
    expect(result.reviewerUsername).toBeUndefined();
  });

  it("preserves seller_response fields and a null comment", () => {
    const result = transformFeedback(
      baseRow({
        comment: null,
        seller_response: "Thanks for the feedback",
        seller_response_at: "2026-06-02T00:00:00.000Z",
        updated_at: "2026-06-03T00:00:00.000Z",
        rating_type: "negative",
      })
    );

    expect(result.comment).toBeNull();
    expect(result.sellerResponse).toBe("Thanks for the feedback");
    expect(result.sellerResponseAt).toBe("2026-06-02T00:00:00.000Z");
    expect(result.updatedAt).toBe("2026-06-03T00:00:00.000Z");
    expect(result.ratingType).toBe("negative");
  });
});
