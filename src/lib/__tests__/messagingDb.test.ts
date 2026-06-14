/**
 * Messaging Database Helper Tests
 *
 * Covers:
 *   - markMessagesAsRead query construction
 *   - sendMessage permission + state logic (validation, self-message guard,
 *     content-filter block, block-list enforcement, flagged insert)
 *
 * Uses a small fluent Supabase query-builder mock (M-MS11) instead of the
 * previous hand-chained jest.fn() mocks, so each terminal call resolves from a
 * per-test response queue.
 */

// ---------------------------------------------------------------------------
// Mock external collaborators BEFORE importing the module under test.
// ---------------------------------------------------------------------------

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn() },
    contacts: { create: jest.fn() },
  })),
}));

// Redis disabled in tests - exercises the non-cached path.
jest.mock("../redis", () => ({
  redis: null,
  isRedisAvailable: () => false,
}));

// Email + seller-profile collaborators are stubbed; sendMessage's email send is
// fire-and-forget so we don't need to assert on it.
jest.mock("../email", () => ({
  sendNotificationEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../auctionDb", () => ({
  getSellerProfile: jest.fn().mockResolvedValue({ id: "other", displayName: "Other" }),
}));

// ---------------------------------------------------------------------------
// Fluent Supabase mock builder.
// ---------------------------------------------------------------------------

type DbResponse = { data: unknown; error: unknown };

// State shared between the mock factory and the tests. `mock`-prefixed names are
// the only out-of-scope references jest permits inside a jest.mock factory.
const mockState: {
  responseQueue: DbResponse[];
  rpcResponse: DbResponse;
  insertedRows: Array<Record<string, unknown>>;
  lastTable: string | null;
} = {
  responseQueue: [],
  rpcResponse: { data: "conv-1", error: null },
  insertedRows: [],
  lastTable: null,
};

jest.mock("../supabase", () => {
  const nextResponse = (): DbResponse =>
    mockState.responseQueue.shift() ?? { data: null, error: null };

  // A chainable builder: non-terminal methods return `this`; terminal methods
  // (`single`, `maybeSingle`) and awaiting the builder resolve from the queue.
  const createBuilder = () => {
    const builder: any = {
      select: jest.fn(() => builder),
      insert: jest.fn((row: Record<string, unknown>) => {
        mockState.insertedRows.push(row);
        return builder;
      }),
      update: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      neq: jest.fn(() => builder),
      or: jest.fn(() => builder),
      in: jest.fn(() => builder),
      order: jest.fn(() => builder),
      limit: jest.fn(() => builder),
      single: jest.fn(() => Promise.resolve(nextResponse())),
      maybeSingle: jest.fn(() => Promise.resolve(nextResponse())),
      then: (resolve: (v: DbResponse) => unknown) => resolve(nextResponse()),
    };
    return builder;
  };

  return {
    supabaseAdmin: {
      from: jest.fn((table: string) => {
        mockState.lastTable = table;
        return createBuilder();
      }),
      rpc: jest.fn(() => Promise.resolve(mockState.rpcResponse)),
    },
  };
});

import { markMessagesAsRead, sendMessage } from "../messagingDb";
import { supabaseAdmin } from "../supabase";

function queueResponse(resp: DbResponse) {
  mockState.responseQueue.push(resp);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockState.responseQueue = [];
  mockState.rpcResponse = { data: "conv-1", error: null };
  mockState.insertedRows.length = 0;
  mockState.lastTable = null;
});

describe("markMessagesAsRead", () => {
  it("targets the messages table", async () => {
    await markMessagesAsRead("conv-123", "user-456");
    expect(supabaseAdmin.from).toHaveBeenCalledWith("messages");
  });

  it("does not throw when no messages match", async () => {
    await expect(markMessagesAsRead("empty-conv", "user-456")).resolves.not.toThrow();
  });
});

describe("sendMessage - validation", () => {
  it("rejects when neither content nor images are provided", async () => {
    await expect(
      sendMessage("sender-1", { recipientId: "recip-1", content: "" })
    ).rejects.toThrow(/content or image is required/i);
  });

  it("rejects content over 2000 characters", async () => {
    await expect(
      sendMessage("sender-1", { recipientId: "recip-1", content: "x".repeat(2001) })
    ).rejects.toThrow(/too long/i);
  });

  it("rejects messaging yourself", async () => {
    await expect(
      sendMessage("same-id", { recipientId: "same-id", content: "hello" })
    ).rejects.toThrow(/cannot send message to yourself/i);
  });
});

describe("sendMessage - content filter", () => {
  it("blocks a message containing an email address", async () => {
    await expect(
      sendMessage("sender-1", { recipientId: "recip-1", content: "email me at a@b.com" })
    ).rejects.toThrow(/email addresses are not allowed/i);
  });

  it("blocks a message containing a phone number", async () => {
    await expect(
      sendMessage("sender-1", { recipientId: "recip-1", content: "call 555-123-4567" })
    ).rejects.toThrow(/phone numbers are not allowed/i);
  });
});

describe("sendMessage - block-list enforcement", () => {
  it("rejects when the sender is blocked by the recipient", async () => {
    // user_blocks lookup returns a row -> blocked.
    queueResponse({ data: { id: "block-1" }, error: null });

    await expect(
      sendMessage("sender-1", { recipientId: "recip-1", content: "hi there" })
    ).rejects.toThrow(/cannot message this user/i);
  });
});

describe("sendMessage - happy path + state", () => {
  it("inserts a message and persists flagged state for suspicious content", async () => {
    // 1) user_blocks lookup -> no block
    queueResponse({ data: null, error: null });
    // 2) messages insert -> returned row
    queueResponse({
      data: {
        id: "msg-1",
        conversation_id: "conv-1",
        sender_id: "sender-1",
        content: "can you venmo me",
        listing_id: null,
        is_read: false,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        image_urls: [],
        embedded_listing_id: null,
      },
      error: null,
    });

    const message = await sendMessage("sender-1", {
      recipientId: "recip-1",
      content: "can you venmo me", // triggers FLAG, not BLOCK
    });

    expect(message.id).toBe("msg-1");
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith("get_or_create_conversation", {
      user_a: "sender-1",
      user_b: "recip-1",
    });

    // The inserted message row should be flagged with a reason.
    const inserted = mockState.insertedRows.find((r) => r.conversation_id === "conv-1");
    expect(inserted).toBeDefined();
    expect(inserted?.is_flagged).toBe(true);
    expect(inserted?.flag_reason).toBeTruthy();
    expect(mockState.lastTable).toBeTruthy();
  });

  it("inserts a clean message as not flagged", async () => {
    queueResponse({ data: null, error: null }); // no block
    queueResponse({
      data: {
        id: "msg-2",
        conversation_id: "conv-1",
        sender_id: "sender-1",
        content: "Is this still available?",
        listing_id: null,
        is_read: false,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        image_urls: [],
        embedded_listing_id: null,
      },
      error: null,
    });

    await sendMessage("sender-1", {
      recipientId: "recip-1",
      content: "Is this still available?",
    });

    const inserted = mockState.insertedRows.find((r) => r.conversation_id === "conv-1");
    expect(inserted?.is_flagged).toBe(false);
    expect(inserted?.flag_reason).toBeNull();
  });
});
