/**
 * Messaging Database Helper Tests
 *
 * Tests for markMessagesAsRead function
 */

// Mock dependencies before importing
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn() },
    contacts: { create: jest.fn() },
  })),
}));

const mockUpdate = jest.fn().mockReturnThis();
const mockEq = jest.fn().mockReturnThis();
const mockNeq = jest.fn().mockReturnThis();

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      update: mockUpdate,
    })),
  },
}));

import { markMessagesAsRead } from "../messagingDb";
import { supabaseAdmin } from "../supabase";

describe("markMessagesAsRead", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-chain mocks for each test
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ neq: mockNeq });
    mockNeq.mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: null, error: null }) });
  });

  it("targets the messages table", async () => {
    await markMessagesAsRead("conv-123", "user-456");
    expect(supabaseAdmin.from).toHaveBeenCalledWith("messages");
  });

  it("updates is_read to true", async () => {
    await markMessagesAsRead("conv-123", "user-456");
    expect(mockUpdate).toHaveBeenCalledWith({ is_read: true });
  });

  it("filters by conversation_id", async () => {
    await markMessagesAsRead("conv-123", "user-456");
    expect(mockEq).toHaveBeenCalledWith("conversation_id", "conv-123");
  });

  it("excludes messages sent by the user (only marks received messages)", async () => {
    await markMessagesAsRead("conv-123", "user-456");
    expect(mockNeq).toHaveBeenCalledWith("sender_id", "user-456");
  });

  it("only targets unread messages", async () => {
    const finalEq = jest.fn().mockResolvedValue({ data: null, error: null });
    mockNeq.mockReturnValue({ eq: finalEq });

    await markMessagesAsRead("conv-123", "user-456");
    expect(finalEq).toHaveBeenCalledWith("is_read", false);
  });

  it("does not throw when no messages match", async () => {
    await expect(markMessagesAsRead("empty-conv", "user-456")).resolves.not.toThrow();
  });
});
