/**
 * List-Unsubscribe header tests (M-EM4).
 *
 * Covers:
 *   - Non-transactional sends attach RFC 8058 List-Unsubscribe +
 *     List-Unsubscribe-Post headers carrying a signed token.
 *   - The token round-trips through signedToken.verify (correct profile +
 *     category, not expired).
 *   - Transactional sends carry NO unsubscribe headers (must always reach the
 *     user).
 *   - No profile context → no headers (nothing to scope the unsubscribe to).
 *
 * @jest-environment node
 */

// Mock Resend before importing email.ts.
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: "test-id" }, error: null }),
    },
    batch: {
      send: jest.fn().mockResolvedValue({ data: { data: [] }, error: null }),
    },
  })),
}));

// Required env vars before importing the module under test.
process.env.RESEND_API_KEY = "test-key";
process.env.NEXT_PUBLIC_APP_URL = "https://collectors-chest.com";
process.env.UNSUBSCRIBE_SECRET = "test-unsubscribe-secret";

import { sendNotificationEmail, buildUnsubscribeHeaders } from "../email";
import { getNotificationCategory } from "../notificationPreferences";
import { verify } from "../signedToken";
import { verifyUnsubscribeToken } from "@/app/api/unsubscribe/route";

function getMockSend() {
  const { Resend } = require("resend");
  return Resend.mock.results[0].value.emails.send;
}

/** Pull the token out of a `<url?token=...>, <mailto:...>` List-Unsubscribe value. */
function extractToken(listUnsubscribe: string): string {
  const match = listUnsubscribe.match(/token=([^>&]+)/);
  if (!match) throw new Error(`no token in: ${listUnsubscribe}`);
  return decodeURIComponent(match[1]);
}

describe("List-Unsubscribe headers (M-EM4)", () => {
  const PROFILE_ID = "11111111-1111-1111-1111-111111111111";

  it("attaches List-Unsubscribe + List-Unsubscribe-Post to a non-transactional send", async () => {
    const mockSend = getMockSend();
    mockSend.mockClear();

    await sendNotificationEmail({
      to: "buyer@example.com",
      type: "new_listing_from_followed",
      profileId: PROFILE_ID,
      data: {
        sellerName: "Seller",
        username: "seller",
        comicTitle: "Batman",
        issueNumber: "1",
        price: 100,
        listingUrl: "https://collectors-chest.com/shop/1",
      } as never,
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const headers = mockSend.mock.calls[0][0].headers as Record<string, string>;
    expect(headers).toBeDefined();
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(headers["List-Unsubscribe"]).toContain(
      "https://collectors-chest.com/api/unsubscribe?token="
    );
    // Owner-supplied mailto fallback is present alongside the one-click URL.
    expect(headers["List-Unsubscribe"]).toContain("mailto:");
  });

  it("signs a verifiable unsubscribe token (profile + category, not expired)", async () => {
    const mockSend = getMockSend();
    mockSend.mockClear();

    await sendNotificationEmail({
      to: "buyer@example.com",
      type: "offer_received",
      profileId: PROFILE_ID,
      data: {
        buyerName: "Buyer",
        sellerName: "Seller",
        comicTitle: "Batman",
        issueNumber: "1",
        amount: 50,
        listingUrl: "https://collectors-chest.com/shop/1",
      } as never,
    });

    const headers = mockSend.mock.calls[0][0].headers as Record<string, string>;
    const token = extractToken(headers["List-Unsubscribe"]);
    const result = verify<{ profileId: string; category: string }>(
      token,
      "UNSUBSCRIBE_SECRET"
    );
    expect(result.valid).toBe(true);
    expect(result.payload?.profileId).toBe(PROFILE_ID);
    expect(result.payload?.category).toBe("marketplace");
  });

  it("mints a token (in email) that verifies in the unsubscribe ROUTE (single source of truth)", async () => {
    const mockSend = getMockSend();
    mockSend.mockClear();

    await sendNotificationEmail({
      to: "buyer@example.com",
      type: "offer_received", // → "marketplace"
      profileId: PROFILE_ID,
      data: {
        buyerName: "Buyer",
        sellerName: "Seller",
        comicTitle: "Batman",
        issueNumber: "1",
        amount: 50,
        listingUrl: "https://collectors-chest.com/shop/1",
      } as never,
    });

    const headers = mockSend.mock.calls[0][0].headers as Record<string, string>;
    const token = extractToken(headers["List-Unsubscribe"]);
    // The route's verifier requires the shared `purpose` marker — proving the
    // email-side mint and the route-side verify share one contract.
    const verified = verifyUnsubscribeToken(token);
    expect(verified).toEqual({ profileId: PROFILE_ID, category: "marketplace" });
  });

  it("does NOT attach unsubscribe headers to a transactional send", async () => {
    const mockSend = getMockSend();
    mockSend.mockClear();

    await sendNotificationEmail({
      to: "user@example.com",
      type: "welcome",
      profileId: PROFILE_ID,
      data: { collectionUrl: "https://collectors-chest.com/collection" } as never,
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    // No headers key (or an empty one) — transactional mail must always deliver.
    const call = mockSend.mock.calls[0][0];
    expect(call.headers).toBeUndefined();
  });
});

describe("buildUnsubscribeHeaders helper", () => {
  const PROFILE_ID = "22222222-2222-2222-2222-222222222222";

  it("returns headers for a non-transactional type with a profile", () => {
    const headers = buildUnsubscribeHeaders(
      "message_received",
      PROFILE_ID,
      getNotificationCategory
    );
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(headers["List-Unsubscribe"]).toContain("/api/unsubscribe?token=");
    const token = headers["List-Unsubscribe"].match(/token=([^>&]+)/)![1];
    const result = verify<{ category: string }>(
      decodeURIComponent(token),
      "UNSUBSCRIBE_SECRET"
    );
    expect(result.valid).toBe(true);
    expect(result.payload?.category).toBe("social");
  });

  it("returns no headers for a transactional type", () => {
    const headers = buildUnsubscribeHeaders(
      "payment_reminder",
      PROFILE_ID,
      getNotificationCategory
    );
    expect(headers).toEqual({});
  });

  it("returns no headers when there is no profile to scope to", () => {
    const headers = buildUnsubscribeHeaders(
      "new_listing_from_followed",
      null,
      getNotificationCategory
    );
    expect(headers).toEqual({});
  });
});
