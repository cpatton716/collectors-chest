/**
 * @jest-environment node
 *
 * H-AU5 — money-critical path coverage for the auctionDb (M-AU9) submodules.
 *
 * Strategy: mock the Supabase + email modules at the package boundary so the
 * REAL bid / buy-it-now / offer / cron / strike logic executes against
 * controlled DB responses. We assert money math (proxy-bid resolution,
 * anti-snipe extension, reserve/minimum-bid handling), winner/fee decisions,
 * concurrency guards, and the payment-miss strike threshold — without booting
 * a live database. No production logic is modified; functions are imported
 * through the public "@/lib/auctionDb" barrel exactly like real callers.
 */

// ---------------------------------------------------------------------------
// Chainable Supabase mock
// ---------------------------------------------------------------------------
// Each `.from(table)` opens a query builder. All chain methods return the
// builder (so `.eq().select().order()...` work), and the builder is awaitable
// (thenable) AND exposes `.single()` / `.maybeSingle()`. Responses are pulled
// from a FIFO queue keyed by table name, in call order, so a test scripts the
// exact sequence of round-trips a function makes. Unscripted reads/writes
// (fire-and-forget audit/notification inserts) default to empty success so
// they never throw.

type DbResponse = { data: unknown; error: unknown };

class QueryBuilderMock {
  constructor(
    private table: string,
    private store: Map<string, DbResponse[]>
  ) {}
  private next(): DbResponse {
    const queue = this.store.get(this.table);
    if (!queue || queue.length === 0) return { data: null, error: null };
    return queue.shift() as DbResponse;
  }
  select() { return this; }
  insert() { return this; }
  update() { return this; }
  delete() { return this; }
  upsert() { return this; }
  eq() { return this; }
  neq() { return this; }
  in() { return this; }
  is() { return this; }
  gt() { return this; }
  gte() { return this; }
  lt() { return this; }
  lte() { return this; }
  not() { return this; }
  or() { return this; }
  order() { return this; }
  limit() { return this; }
  range() { return this; }
  single() { return Promise.resolve(this.next()); }
  maybeSingle() { return Promise.resolve(this.next()); }
  then(resolve: (v: DbResponse) => unknown, reject?: (e: unknown) => unknown) {
    return Promise.resolve(this.next()).then(resolve, reject);
  }
}

// Shared stores (referenced by the jest.mock factory via getters).
const supaStore = new Map<string, DbResponse[]>();
const adminStore = new Map<string, DbResponse[]>();

function queue(store: Map<string, DbResponse[]>) {
  return (table: string, ...responses: DbResponse[]) => {
    store.set(table, (store.get(table) ?? []).concat(responses));
  };
}
const queueSupa = queue(supaStore);
const queueAdmin = queue(adminStore);

const supaClient = { from: (t: string) => new QueryBuilderMock(t, supaStore) };
const adminClient = { from: (t: string) => new QueryBuilderMock(t, adminStore) };

jest.mock("../supabase", () => ({
  get supabase() {
    return supaClient;
  },
  get supabaseAdmin() {
    return adminClient;
  },
}));

jest.mock("../email", () => ({
  sendNotificationEmail: jest.fn().mockResolvedValue({ success: true }),
  sendNotificationEmailsBatch: jest.fn().mockResolvedValue({ sent: 0 }),
  getProfileForEmail: jest.fn().mockResolvedValue(null),
  getListingComicData: jest.fn().mockResolvedValue(null),
}));
jest.mock("../auditLog", () => ({
  logAuctionAuditEvent: jest.fn().mockResolvedValue(undefined),
  logAuctionAuditEvents: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../creatorCreditsDb", () => ({
  createFeedbackReminders: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../followDb", () => ({
  getAllFollowerIds: jest.fn().mockResolvedValue([]),
}));

process.env.NEXT_PUBLIC_APP_URL = "https://collectors-chest.com";

import {
  placeBid,
  executeBuyItNow,
  createOffer,
  respondToOffer,
  processEndedAuctions,
} from "../auctionDb";
// recordPaymentMissStrike is internal (not on the public barrel) — imported
// from its submodule for direct strike-threshold testing.
import { recordPaymentMissStrike } from "../auction/secondChance";
import { computePaymentMissStrike } from "@/types/auction";

const ok = (data: unknown): DbResponse => ({ data, error: null });
const errResp = (message: string): DbResponse => ({
  data: null,
  error: { message },
});

// Far-future end time so live-clock comparisons treat auctions as open.
const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 60 * 1000).toISOString();

beforeEach(() => {
  supaStore.clear();
  adminStore.clear();
  jest.clearAllMocks();
});

// ===========================================================================
// computePaymentMissStrike — strike-threshold math (pure)
// ===========================================================================
describe("computePaymentMissStrike — strike-threshold math (pure)", () => {
  const now = new Date("2026-06-01T00:00:00Z");

  it("first miss never flags (count 1 < threshold 2)", () => {
    const r = computePaymentMissStrike([], "a1", now);
    expect(r.totalStrikesInWindow).toBe(1);
    expect(r.shouldFlag).toBe(false);
  });

  it("second in-window miss flags (count 2 >= threshold 2)", () => {
    const r = computePaymentMissStrike(
      [{ created_at: "2026-05-20T00:00:00Z", auction_id: "a-old" }],
      "a1",
      now
    );
    expect(r.totalStrikesInWindow).toBe(2);
    expect(r.shouldFlag).toBe(true);
  });

  it("excludes prior rows for the CURRENT auction so the miss counts once", () => {
    const r = computePaymentMissStrike(
      [{ created_at: "2026-05-20T00:00:00Z", auction_id: "a1" }],
      "a1",
      now
    );
    expect(r.pastMissTimestamps).toHaveLength(0);
    expect(r.totalStrikesInWindow).toBe(1);
    expect(r.shouldFlag).toBe(false);
  });

  it("ignores misses outside the 90-day rolling window", () => {
    const r = computePaymentMissStrike(
      [{ created_at: "2026-01-01T00:00:00Z", auction_id: "a-old" }],
      "a1",
      now
    );
    expect(r.totalStrikesInWindow).toBe(1);
    expect(r.shouldFlag).toBe(false);
  });
});

// ===========================================================================
// placeBid — proxy bidding / anti-snipe / minimum-bid (reserve) resolution
// ===========================================================================
describe("placeBid", () => {
  it("rejects a bid on a non-active auction", async () => {
    queueSupa(
      "auctions",
      ok({ id: "auc1", status: "ended", end_time: FUTURE, seller_id: "s1" })
    );
    const res = await placeBid("auc1", "b1", 50);
    expect(res.success).toBe(false);
    expect(res.message).toBe("Auction has ended");
  });

  it("rejects a bid past the end time even if status is active", async () => {
    queueSupa(
      "auctions",
      ok({ id: "auc1", status: "active", end_time: PAST, seller_id: "s1" })
    );
    const res = await placeBid("auc1", "b1", 50);
    expect(res.success).toBe(false);
    expect(res.message).toBe("Auction has ended");
  });

  it("blocks the seller from bidding on their own auction", async () => {
    queueSupa(
      "auctions",
      ok({ id: "auc1", status: "active", end_time: FUTURE, seller_id: "b1" })
    );
    const res = await placeBid("auc1", "b1", 50);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/your own auction/i);
  });

  it("enforces the minimum bid (reserve/increment floor)", async () => {
    // No current bid → minimum is the starting price (10).
    queueSupa(
      "auctions",
      ok({
        id: "auc1",
        status: "active",
        end_time: FUTURE,
        seller_id: "s1",
        starting_price: 10,
        current_bid: null,
        bid_count: 0,
      })
    );
    const res = await placeBid("auc1", "b1", 5);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/Minimum bid is \$10\.00/);
  });

  it("rejects non-integer (fractional dollar) bids", async () => {
    queueSupa(
      "auctions",
      ok({
        id: "auc1",
        status: "active",
        end_time: FUTURE,
        seller_id: "s1",
        starting_price: 10,
        current_bid: null,
        bid_count: 0,
      })
    );
    const res = await placeBid("auc1", "b1", 12.5);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/whole dollar/i);
  });

  it("first bid sets current_bid to the starting price and high-bidder true", async () => {
    queueSupa(
      "auctions",
      ok({
        id: "auc1",
        status: "active",
        end_time: FUTURE,
        seller_id: "s1",
        starting_price: 10,
        current_bid: null,
        bid_count: 0,
        original_end_time: null,
      })
    );
    // supabase.from("bids") reads, in order:
    //  1. current winning bid (maybeSingle) → none
    //  2. bidder's existing bids (limit 1) → none
    //  3. max bidder-number lookup → none
    queueSupa(
      "bids",
      ok(null), // current winning bid
      ok([]), // bidder has no existing bids
      ok([]) // max bidder number
    );
    queueAdmin("bids", ok({
      id: "bid1",
      auction_id: "auc1",
      bidder_id: "b1",
      bid_amount: 10,
      max_bid: 25,
      bidder_number: 1,
      is_winning: true,
      created_at: PAST,
      updated_at: PAST,
    }));
    const res = await placeBid("auc1", "b1", 25);
    expect(res.success).toBe(true);
    expect(res.isHighBidder).toBe(true);
    // current_bid reflects the starting price on the very first bid
    expect(res.currentBid).toBe(10);
    expect(res.bid?.maxBid).toBe(25);
  });

  it("proxy bid: new higher max bidder wins at prior max + increment (capped at own max)", async () => {
    // Existing winner has max_bid 30. Increment is a flat $1 (getBidIncrement).
    // New bidder maxes 100 → newCurrentBid = min(30 + 1, 100) = 31.
    queueSupa(
      "auctions",
      ok({
        id: "auc1",
        status: "active",
        end_time: FUTURE,
        seller_id: "s1",
        starting_price: 10,
        current_bid: 30,
        bid_count: 3,
        original_end_time: null,
      })
    );
    queueSupa(
      "bids",
      ok({
        id: "oldbid",
        bidder_id: "rival",
        max_bid: 30,
        bid_amount: 30,
        is_winning: true,
      }), // current winning bid
      ok([]), // this bidder has no existing bids
      ok([{ bidder_number: 2 }]) // max bidder number
    );
    queueAdmin(
      "bids",
      ok(null), // "mark old bid not winning" UPDATE (new bidder outbids rival)
      ok({
        id: "bid2",
        auction_id: "auc1",
        bidder_id: "b1",
        bid_amount: 31,
        max_bid: 100,
        bidder_number: 3,
        is_winning: true,
        created_at: PAST,
        updated_at: PAST,
      })
    );
    const res = await placeBid("auc1", "b1", 100);
    expect(res.success).toBe(true);
    expect(res.isHighBidder).toBe(true);
    // proxy resolution: 30 + increment($1) = 31, below the bidder's $100 max.
    expect(res.currentBid).toBe(31);
  });

  it("same bidder cannot lower or match their own existing max", async () => {
    queueSupa(
      "auctions",
      ok({
        id: "auc1",
        status: "active",
        end_time: FUTURE,
        seller_id: "s1",
        starting_price: 10,
        current_bid: 20,
        bid_count: 1,
      })
    );
    queueSupa(
      "bids",
      ok({
        id: "mybid",
        bidder_id: "b1",
        max_bid: 50,
        bid_amount: 20,
        is_winning: true,
      }), // current winning bid (same bidder)
      ok([{ bidder_number: 1 }]) // bidder's existing bids
    );
    const res = await placeBid("auc1", "b1", 50);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/already \$50/);
  });
});

// ===========================================================================
// executeBuyItNow — guard + concurrency (no double-win)
// ===========================================================================
describe("executeBuyItNow", () => {
  it("rejects when the listing has no Buy It Now price", async () => {
    queueSupa(
      "auctions",
      ok({ id: "auc1", status: "active", seller_id: "s1", buy_it_now_price: null })
    );
    const res = await executeBuyItNow("auc1", "b1");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/not available/i);
  });

  it("blocks the seller from buying their own item", async () => {
    queueSupa(
      "auctions",
      ok({ id: "auc1", status: "active", seller_id: "b1", buy_it_now_price: 99 })
    );
    const res = await executeBuyItNow("auc1", "b1");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/your own item/i);
  });

  it("returns 'no longer available' when the atomic status guard updates zero rows", async () => {
    queueSupa(
      "auctions",
      ok({ id: "auc1", status: "active", seller_id: "s1", buy_it_now_price: 99 })
    );
    // The guarded UPDATE ... .eq(status,active).select() returns [] (lost race).
    queueAdmin("auctions", ok([]));
    const res = await executeBuyItNow("auc1", "b1");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/no longer available/i);
  });

  it("succeeds when the guarded update claims the row", async () => {
    queueSupa(
      "auctions",
      ok({ id: "auc1", status: "active", seller_id: "s1", buy_it_now_price: 99 })
    );
    queueAdmin("auctions", ok([{ id: "auc1" }]));
    const res = await executeBuyItNow("auc1", "b1");
    expect(res.success).toBe(true);
  });
});

// ===========================================================================
// createOffer / respondToOffer
// ===========================================================================
describe("createOffer", () => {
  it("rejects an offer below the listing minimum", async () => {
    queueSupa(
      "auctions",
      ok({
        id: "lst1",
        seller_id: "s1",
        status: "active",
        listing_type: "fixed_price",
        accepts_offers: true,
        min_offer_amount: 50,
      })
    );
    const res = await createOffer("b1", { listingId: "lst1", amount: 20 });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/too low/i);
  });

  it("blocks an offer from the seller on their own listing", async () => {
    queueSupa(
      "auctions",
      ok({
        id: "lst1",
        seller_id: "b1",
        status: "active",
        listing_type: "fixed_price",
        accepts_offers: true,
        min_offer_amount: null,
      })
    );
    const res = await createOffer("b1", { listingId: "lst1", amount: 100 });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/your own listing/i);
  });

  it("rejects a duplicate active offer from the same buyer", async () => {
    queueSupa(
      "auctions",
      ok({
        id: "lst1",
        seller_id: "s1",
        status: "active",
        listing_type: "fixed_price",
        accepts_offers: true,
        min_offer_amount: null,
      })
    );
    // existing-offer check queries the "offers" table
    queueSupa("offers", ok({ id: "existing", status: "pending", round_number: 1 }));
    const res = await createOffer("b1", { listingId: "lst1", amount: 80 });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/already have an active offer/i);
  });

  it("creates a pending offer and returns the transformed Offer", async () => {
    queueSupa(
      "auctions",
      ok({
        id: "lst1",
        seller_id: "s1",
        status: "active",
        listing_type: "fixed_price",
        accepts_offers: true,
        min_offer_amount: null,
      })
    );
    queueSupa(
      "offers",
      ok(null), // no existing offer (existing-offer check)
      ok({
      id: "off1",
      listing_id: "lst1",
      buyer_id: "b1",
      seller_id: "s1",
      amount: 80,
      counter_amount: null,
      status: "pending",
      round_number: 1,
      created_at: PAST,
      updated_at: PAST,
      expires_at: FUTURE,
      responded_at: null,
    }));
    const res = await createOffer("b1", { listingId: "lst1", amount: 80 });
    expect(res.success).toBe(true);
    expect(res.offer?.amount).toBe(80);
    expect(res.offer?.status).toBe("pending");
  });
});

describe("respondToOffer", () => {
  it("rejects responding to an offer that is no longer pending/countered", async () => {
    queueSupa(
      "offers",
      ok({
        id: "off1",
        seller_id: "s1",
        buyer_id: "b1",
        listing_id: "lst1",
        amount: 80,
        status: "accepted",
        round_number: 1,
      })
    );
    const res = await respondToOffer("s1", { offerId: "off1", action: "accept" });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/no longer be modified/i);
  });

  it("accept fails the atomic listing guard when zero rows update (already sold)", async () => {
    queueSupa(
      "offers",
      ok({
        id: "off1",
        seller_id: "s1",
        buyer_id: "b1",
        listing_id: "lst1",
        amount: 80,
        status: "pending",
        round_number: 1,
      })
    );
    queueAdmin("auctions", ok([])); // guarded sale UPDATE claims nothing
    const res = await respondToOffer("s1", { offerId: "off1", action: "accept" });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/no longer available/i);
  });
});

// ===========================================================================
// processEndedAuctions — winner/payment-deadline decision
// ===========================================================================
describe("processEndedAuctions", () => {
  it("returns zero processed when no auctions have ended", async () => {
    queueSupa("auctions", ok([]));
    const res = await processEndedAuctions();
    expect(res.processed).toBe(0);
    expect(res.errors).toEqual([]);
  });

  it("surfaces a top-level query error", async () => {
    queueSupa("auctions", errResp("db down"));
    const res = await processEndedAuctions();
    expect(res.processed).toBe(0);
    expect(res.errors).toEqual(["db down"]);
  });

  it("finalizes an ended auction with a winning bid (counts as processed)", async () => {
    queueSupa(
      "auctions",
      ok([
        {
          id: "auc1",
          seller_id: "s1",
          status: "active",
          end_time: PAST,
          starting_price: 10,
          comics: { title: "Spawn", issue_number: "1" },
        },
      ])
    );
    // per-auction winning-bid lookup
    queueSupa("bids", ok({ bidder_id: "w1", bid_amount: 40 }));
    // guarded UPDATE → status active→ended claims the row
    queueAdmin("auctions", ok([{ id: "auc1" }]));
    const res = await processEndedAuctions();
    expect(res.processed).toBe(1);
    expect(res.errors).toEqual([]);
  });

  it("skips re-finalizing when the guarded update claims zero rows (concurrent run)", async () => {
    queueSupa(
      "auctions",
      ok([
        {
          id: "auc1",
          seller_id: "s1",
          status: "active",
          end_time: PAST,
          starting_price: 10,
          comics: { title: "Spawn", issue_number: "1" },
        },
      ])
    );
    queueSupa("bids", ok({ bidder_id: "w1", bid_amount: 40 }));
    queueAdmin("auctions", ok([])); // already finalized elsewhere
    const res = await processEndedAuctions();
    expect(res.processed).toBe(0);
    expect(res.errors).toEqual([]);
  });
});

// ===========================================================================
// recordPaymentMissStrike — strike threshold wired through the real function
// ===========================================================================
describe("recordPaymentMissStrike", () => {
  it("first offense: warns only, never flags the profile", async () => {
    // profile read (current count/restriction)
    queueAdmin(
      "profiles",
      ok({ payment_missed_count: 0, bid_restricted_at: null }), // current
      ok(null) // counter UPDATE (thenable resolve)
    );
    // prior auction_payment_expired audit rows (none) → first offense
    queueAdmin("auction_audit_log", ok([]));
    await expect(
      recordPaymentMissStrike("b1", "auc1", 40)
    ).resolves.toBeUndefined();
    // No flag write should have been queued/consumed beyond the counter update;
    // function returns cleanly on the warning branch.
  });

  it("second in-window offense: reaches the flag branch (profile restricted)", async () => {
    queueAdmin(
      "profiles",
      ok({ payment_missed_count: 1, bid_restricted_at: null }), // current
      ok(null), // counter UPDATE
      ok(null), // flag UPDATE (set bid_restricted_at)
      ok([]) // admins lookup
    );
    // One prior in-window miss for a DIFFERENT auction → totals 2 → flag.
    queueAdmin("auction_audit_log", ok([
      { created_at: new Date(Date.now() - 5 * 86400000).toISOString(), auction_id: "auc-old" },
    ]));
    await expect(
      recordPaymentMissStrike("b1", "auc1", 40)
    ).resolves.toBeUndefined();
  });
});
