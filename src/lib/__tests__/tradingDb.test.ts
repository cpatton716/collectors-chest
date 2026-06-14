/**
 * tradingDb pure-helper tests (H-MK7, M-MK12, M-MK13, M-MK15, H-MK10)
 *
 * Covers the extracted, side-effect-free trade decision logic:
 *  - participant / proposer-side permission checks
 *  - ship / receipt / status state-transition builders (incl. both-sides-done
 *    -> "shipped" / "completed" promotion)
 *  - limit/offset clamping for paginated list queries
 *
 * Supabase + creatorCreditsDb are mocked so importing tradingDb.ts never
 * constructs a real client or touches the network - these are pure-function
 * tests.
 */

// Mock @upstash/redis (imported transitively via supabase -> cache chain).
jest.mock("@upstash/redis", () => ({
  Redis: jest.fn().mockImplementation(() => ({ get: jest.fn(), set: jest.fn(), del: jest.fn() })),
}));

// Mock the supabase clients - the pure helpers never call them, but importing
// tradingDb.ts evaluates the module which imports supabaseAdmin.
jest.mock("../supabase", () => ({
  supabase: { from: jest.fn() },
  supabaseAdmin: { from: jest.fn() },
}));

// createFeedbackReminders is only called by confirmReceipt (not under test here).
jest.mock("../creatorCreditsDb", () => ({
  createFeedbackReminders: jest.fn(),
}));

import {
  buildReceiptUpdate,
  buildShipUpdate,
  buildStatusUpdate,
  clampLimit,
  clampOffset,
  isProposerSide,
  isTradeParticipant,
  MATCH_LIST_MAX_LIMIT,
  TRADE_LIST_DEFAULT_LIMIT,
  TRADE_LIST_MAX_LIMIT,
} from "../tradingDb";

const PROPOSER = "proposer-id";
const RECIPIENT = "recipient-id";
const OUTSIDER = "outsider-id";
const NOW = "2026-06-14T12:00:00.000Z";

function baseTrade(overrides: Record<string, unknown> = {}) {
  return {
    proposer_id: PROPOSER,
    recipient_id: RECIPIENT,
    proposer_shipped_at: null,
    recipient_shipped_at: null,
    proposer_received_at: null,
    recipient_received_at: null,
    ...overrides,
  } as any;
}

describe("isTradeParticipant", () => {
  it("returns true for the proposer", () => {
    expect(isTradeParticipant(baseTrade(), PROPOSER)).toBe(true);
  });
  it("returns true for the recipient", () => {
    expect(isTradeParticipant(baseTrade(), RECIPIENT)).toBe(true);
  });
  it("returns false for an outsider (IDOR guard)", () => {
    expect(isTradeParticipant(baseTrade(), OUTSIDER)).toBe(false);
  });
});

describe("isProposerSide", () => {
  it("is true only for the proposer", () => {
    expect(isProposerSide(baseTrade(), PROPOSER)).toBe(true);
    expect(isProposerSide(baseTrade(), RECIPIENT)).toBe(false);
  });
});

describe("buildShipUpdate", () => {
  it("stamps proposer fields when the proposer ships", () => {
    const update = buildShipUpdate(baseTrade(), PROPOSER, NOW, "usps", "1Z123");
    expect(update.proposer_shipped_at).toBe(NOW);
    expect(update.proposer_tracking_carrier).toBe("usps");
    expect(update.proposer_tracking_number).toBe("1Z123");
    expect(update.recipient_shipped_at).toBeUndefined();
    // Other side has not shipped -> status NOT promoted.
    expect(update.status).toBeUndefined();
  });

  it("stamps recipient fields when the recipient ships", () => {
    const update = buildShipUpdate(baseTrade(), RECIPIENT, NOW, "ups", "9999");
    expect(update.recipient_shipped_at).toBe(NOW);
    expect(update.recipient_tracking_carrier).toBe("ups");
    expect(update.recipient_tracking_number).toBe("9999");
    expect(update.status).toBeUndefined();
  });

  it("promotes status to shipped once BOTH parties have shipped", () => {
    // Recipient already shipped; now the proposer ships -> both done.
    const trade = baseTrade({ recipient_shipped_at: "2026-06-13T00:00:00Z" });
    const update = buildShipUpdate(trade, PROPOSER, NOW);
    expect(update.proposer_shipped_at).toBe(NOW);
    expect(update.status).toBe("shipped");
  });

  it("omits tracking fields when none provided", () => {
    const update = buildShipUpdate(baseTrade(), PROPOSER, NOW);
    expect(update).not.toHaveProperty("proposer_tracking_carrier");
    expect(update).not.toHaveProperty("proposer_tracking_number");
  });
});

describe("buildReceiptUpdate", () => {
  it("records proposer receipt without completing when other side pending", () => {
    const { update, bothConfirmed } = buildReceiptUpdate(baseTrade(), PROPOSER, NOW);
    expect(update.proposer_received_at).toBe(NOW);
    expect(bothConfirmed).toBe(false);
    expect(update.status).toBeUndefined();
    expect(update.completed_at).toBeUndefined();
  });

  it("completes the trade when both parties have confirmed receipt", () => {
    const trade = baseTrade({ proposer_received_at: "2026-06-13T00:00:00Z" });
    const { update, bothConfirmed } = buildReceiptUpdate(trade, RECIPIENT, NOW);
    expect(update.recipient_received_at).toBe(NOW);
    expect(bothConfirmed).toBe(true);
    expect(update.status).toBe("completed");
    expect(update.completed_at).toBe(NOW);
  });
});

describe("buildStatusUpdate", () => {
  it("stamps cancelled_at + cancel_reason on cancellation", () => {
    const update = buildStatusUpdate(
      { status: "cancelled", cancelReason: "changed mind" },
      baseTrade(),
      PROPOSER,
      NOW
    );
    expect(update.status).toBe("cancelled");
    expect(update.cancelled_at).toBe(NOW);
    expect(update.cancel_reason).toBe("changed mind");
  });

  it("stamps completed_at on completion", () => {
    const update = buildStatusUpdate({ status: "completed" }, baseTrade(), RECIPIENT, NOW);
    expect(update.status).toBe("completed");
    expect(update.completed_at).toBe(NOW);
  });

  it("routes tracking to the correct side", () => {
    const proposerUpdate = buildStatusUpdate(
      { trackingCarrier: "fedex", trackingNumber: "F1" },
      baseTrade(),
      PROPOSER,
      NOW
    );
    expect(proposerUpdate.proposer_tracking_number).toBe("F1");
    expect(proposerUpdate.proposer_shipped_at).toBe(NOW);

    const recipientUpdate = buildStatusUpdate(
      { trackingCarrier: "fedex", trackingNumber: "F2" },
      baseTrade(),
      RECIPIENT,
      NOW
    );
    expect(recipientUpdate.recipient_tracking_number).toBe("F2");
    expect(recipientUpdate.recipient_shipped_at).toBe(NOW);
  });

  it("returns an empty object when no status/tracking provided", () => {
    expect(buildStatusUpdate({}, baseTrade(), PROPOSER, NOW)).toEqual({});
  });
});

describe("clampLimit / clampOffset (pagination guards)", () => {
  it("falls back to the default when limit is undefined", () => {
    expect(clampLimit(undefined, TRADE_LIST_DEFAULT_LIMIT, TRADE_LIST_MAX_LIMIT)).toBe(
      TRADE_LIST_DEFAULT_LIMIT
    );
  });

  it("caps at the max", () => {
    expect(clampLimit(99999, TRADE_LIST_DEFAULT_LIMIT, TRADE_LIST_MAX_LIMIT)).toBe(
      TRADE_LIST_MAX_LIMIT
    );
    expect(clampLimit(99999, 100, MATCH_LIST_MAX_LIMIT)).toBe(MATCH_LIST_MAX_LIMIT);
  });

  it("floors values below 1 to 1", () => {
    expect(clampLimit(0, TRADE_LIST_DEFAULT_LIMIT, TRADE_LIST_MAX_LIMIT)).toBe(1);
    expect(clampLimit(-5, TRADE_LIST_DEFAULT_LIMIT, TRADE_LIST_MAX_LIMIT)).toBe(1);
  });

  it("truncates fractional limits", () => {
    expect(clampLimit(10.9, TRADE_LIST_DEFAULT_LIMIT, TRADE_LIST_MAX_LIMIT)).toBe(10);
  });

  it("clamps offset to a non-negative integer", () => {
    expect(clampOffset(undefined)).toBe(0);
    expect(clampOffset(-3)).toBe(0);
    expect(clampOffset(7.8)).toBe(7);
    expect(clampOffset(25)).toBe(25);
  });
});
