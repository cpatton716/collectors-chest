/**
 * completeTrade RPC-routing tests (M-MK6 — migration-gated).
 *
 * completeTrade swaps comic ownership + cleans up hunt lists. The closeout
 * migration ships a transactional `complete_trade(...)` SECURITY DEFINER RPC;
 * this code prefers it but MUST keep a build-safe fallback (the original
 * per-step path) so trades still complete pre-migration. These tests assert:
 *
 *   - RPC success short-circuits (no per-step fallback fires)
 *   - a "function does not exist" RPC error falls back to the per-step path
 *   - any OTHER RPC error is surfaced (NOT silently retried via the
 *     non-atomic path — that would risk a partial swap reporting as success)
 *
 * Because this is an ownership/permissions-sensitive money-adjacent flow, the
 * fallback gating is treated as a required test.
 */

jest.mock("@upstash/redis", () => ({
  Redis: jest.fn().mockImplementation(() => ({ get: jest.fn(), set: jest.fn(), del: jest.fn() })),
}));

type DbResponse = { data: unknown; error: unknown };

const mockState: {
  rpcResponse: DbResponse;
  rpcCalls: Array<{ fn: string; args: unknown }>;
  fromCalls: string[];
  responseQueue: DbResponse[];
} = {
  rpcResponse: { data: null, error: null },
  rpcCalls: [],
  fromCalls: [],
  responseQueue: [],
};

jest.mock("../supabase", () => {
  const nextResponse = (): DbResponse =>
    mockState.responseQueue.shift() ?? { data: [], error: null };

  const createBuilder = () => {
    const builder: any = {
      select: jest.fn(() => builder),
      update: jest.fn(() => builder),
      delete: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      ilike: jest.fn(() => builder),
      maybeSingle: jest.fn(() => Promise.resolve(nextResponse())),
      single: jest.fn(() => Promise.resolve(nextResponse())),
      then: (resolve: (v: DbResponse) => unknown) => resolve(nextResponse()),
    };
    return builder;
  };

  return {
    supabase: { from: jest.fn() },
    supabaseAdmin: {
      from: jest.fn((table: string) => {
        mockState.fromCalls.push(table);
        return createBuilder();
      }),
      rpc: jest.fn((fn: string, args: unknown) => {
        mockState.rpcCalls.push({ fn, args });
        return Promise.resolve(mockState.rpcResponse);
      }),
    },
  };
});

jest.mock("../creatorCreditsDb", () => ({
  createFeedbackReminders: jest.fn(),
}));

import { completeTrade } from "../tradingDb";
import { supabaseAdmin } from "../supabase";

beforeEach(() => {
  jest.clearAllMocks();
  mockState.rpcResponse = { data: null, error: null };
  mockState.rpcCalls = [];
  mockState.fromCalls = [];
  mockState.responseQueue = [];
});

describe("completeTrade (M-MK6 atomic RPC + fallback)", () => {
  it("calls the complete_trade RPC with the trade id", async () => {
    await completeTrade("trade-1");
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith("complete_trade", { p_trade_id: "trade-1" });
  });

  it("short-circuits on RPC success without running the per-step fallback", async () => {
    mockState.rpcResponse = { data: null, error: null };
    await completeTrade("trade-1");
    // The fallback reads trade_items / trades / comics tables; none should run.
    expect(mockState.fromCalls).toHaveLength(0);
  });

  it("falls back to the per-step path when the RPC function is absent (42883)", async () => {
    mockState.rpcResponse = {
      data: null,
      error: { code: "42883", message: "function complete_trade(uuid) does not exist" },
    };
    // Fallback: trade_items select returns empty -> loop is a no-op, no throw.
    mockState.responseQueue.push({ data: [], error: null }); // trade_items
    mockState.responseQueue.push({ data: { proposer_id: "p", recipient_id: "r" }, error: null }); // trades

    await expect(completeTrade("trade-1")).resolves.toBeUndefined();
    // Fallback path touched the DB tables.
    expect(mockState.fromCalls).toContain("trade_items");
  });

  it("falls back when PostgREST reports a missing function (PGRST202)", async () => {
    mockState.rpcResponse = {
      data: null,
      error: { code: "PGRST202", message: "Could not find the function" },
    };
    mockState.responseQueue.push({ data: [], error: null }); // trade_items
    mockState.responseQueue.push({ data: { proposer_id: "p", recipient_id: "r" }, error: null });

    await expect(completeTrade("trade-1")).resolves.toBeUndefined();
    expect(mockState.fromCalls).toContain("trade_items");
  });

  it("surfaces a real RPC failure instead of silently falling back", async () => {
    mockState.rpcResponse = {
      data: null,
      error: { code: "P0001", message: "trade already completed" },
    };
    await expect(completeTrade("trade-1")).rejects.toMatchObject({ code: "P0001" });
    // Must NOT have run the non-atomic fallback on a genuine failure.
    expect(mockState.fromCalls).toHaveLength(0);
  });
});
