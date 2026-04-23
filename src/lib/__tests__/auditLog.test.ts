// Mock Supabase before importing — prevents needing real env vars and lets
// us assert on the insert payload that the helper builds.
const mockInsert = jest.fn().mockResolvedValue({ error: null });

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      insert: mockInsert,
    })),
  },
}));

import {
  buildAuditLogRow,
  logAuctionAuditEvent,
  logAuctionAuditEvents,
} from "../auditLog";

describe("auditLog helpers", () => {
  beforeEach(() => {
    mockInsert.mockClear();
    mockInsert.mockResolvedValue({ error: null });
  });

  describe("buildAuditLogRow", () => {
    it("maps all fields when fully populated", () => {
      const row = buildAuditLogRow({
        auctionId: "auc-1",
        offerId: "off-1",
        actorProfileId: "prof-1",
        eventType: "bid_placed",
        eventData: { amount: 50 },
      });
      expect(row).toEqual({
        auction_id: "auc-1",
        offer_id: "off-1",
        actor_profile_id: "prof-1",
        event_type: "bid_placed",
        event_data: { amount: 50 },
      });
    });

    it("defaults missing auctionId to null", () => {
      const row = buildAuditLogRow({ eventType: "auction_created" });
      expect(row.auction_id).toBeNull();
    });

    it("defaults missing offerId to null", () => {
      const row = buildAuditLogRow({ eventType: "auction_created" });
      expect(row.offer_id).toBeNull();
    });

    it("defaults missing actorProfileId to null (system-initiated events)", () => {
      const row = buildAuditLogRow({ eventType: "auction_ended" });
      expect(row.actor_profile_id).toBeNull();
    });

    it("defaults missing eventData to empty object", () => {
      const row = buildAuditLogRow({ eventType: "auction_created" });
      expect(row.event_data).toEqual({});
    });

    it("converts explicit undefined values to null", () => {
      const row = buildAuditLogRow({
        auctionId: undefined,
        offerId: undefined,
        actorProfileId: undefined,
        eventType: "listing_expired",
      });
      expect(row.auction_id).toBeNull();
      expect(row.offer_id).toBeNull();
      expect(row.actor_profile_id).toBeNull();
    });

    it("preserves explicit null values", () => {
      const row = buildAuditLogRow({
        auctionId: null,
        offerId: null,
        actorProfileId: null,
        eventType: "auction_completed",
      });
      expect(row.auction_id).toBeNull();
      expect(row.offer_id).toBeNull();
      expect(row.actor_profile_id).toBeNull();
    });
  });

  describe("logAuctionAuditEvent", () => {
    it("inserts a single row with defaulted optional fields", async () => {
      await logAuctionAuditEvent({
        auctionId: "auc-1",
        eventType: "auction_created",
      });
      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockInsert).toHaveBeenCalledWith({
        auction_id: "auc-1",
        offer_id: null,
        actor_profile_id: null,
        event_type: "auction_created",
        event_data: {},
      });
    });

    it("passes event_data through when provided", async () => {
      await logAuctionAuditEvent({
        auctionId: "auc-1",
        actorProfileId: "prof-1",
        eventType: "bid_placed",
        eventData: { amount: 100, isProxy: true },
      });
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_data: { amount: 100, isProxy: true },
        })
      );
    });

    it("does not throw when the insert returns an error", async () => {
      mockInsert.mockResolvedValueOnce({ error: { message: "boom" } });
      await expect(
        logAuctionAuditEvent({ eventType: "auction_created" })
      ).resolves.toBeUndefined();
    });

    it("does not throw when the insert call itself throws", async () => {
      mockInsert.mockRejectedValueOnce(new Error("network down"));
      await expect(
        logAuctionAuditEvent({ eventType: "auction_created" })
      ).resolves.toBeUndefined();
    });
  });

  describe("logAuctionAuditEvents", () => {
    it("early-returns on empty array without calling insert", async () => {
      await logAuctionAuditEvents([]);
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("batch-inserts all rows in a single call", async () => {
      await logAuctionAuditEvents([
        { auctionId: "a1", eventType: "auction_ended" },
        { auctionId: "a2", eventType: "listing_expired" },
      ]);
      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockInsert).toHaveBeenCalledWith([
        {
          auction_id: "a1",
          offer_id: null,
          actor_profile_id: null,
          event_type: "auction_ended",
          event_data: {},
        },
        {
          auction_id: "a2",
          offer_id: null,
          actor_profile_id: null,
          event_type: "listing_expired",
          event_data: {},
        },
      ]);
    });

    it("does not throw when the batch insert returns an error", async () => {
      mockInsert.mockResolvedValueOnce({ error: { message: "boom" } });
      await expect(
        logAuctionAuditEvents([{ eventType: "auction_ended" }])
      ).resolves.toBeUndefined();
    });

    it("does not throw when the batch insert call itself throws", async () => {
      mockInsert.mockRejectedValueOnce(new Error("network down"));
      await expect(
        logAuctionAuditEvents([{ eventType: "auction_ended" }])
      ).resolves.toBeUndefined();
    });
  });
});
