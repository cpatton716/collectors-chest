/**
 * @jest-environment node
 */

import {
  NOTIFICATION_CATEGORY_MAP,
  getNotificationCategory,
  shouldSendEmailForUser,
  filterEmailsByPreference,
} from "../notificationPreferences";

describe("getNotificationCategory", () => {
  it("returns transactional for welcome", () => {
    expect(getNotificationCategory("welcome")).toBe("transactional");
  });

  it("returns transactional for auction_won (user must know they won)", () => {
    expect(getNotificationCategory("auction_won")).toBe("transactional");
  });

  it("returns transactional for payment_reminder", () => {
    expect(getNotificationCategory("payment_reminder")).toBe("transactional");
  });

  it("returns transactional for payment_missed_flagged (account status)", () => {
    expect(getNotificationCategory("payment_missed_flagged")).toBe("transactional");
  });

  it("returns marketplace for outbid", () => {
    expect(getNotificationCategory("outbid")).toBe("marketplace");
  });

  it("returns marketplace for offer_received", () => {
    expect(getNotificationCategory("offer_received")).toBe("marketplace");
  });

  it("returns marketplace for second_chance_offered", () => {
    expect(getNotificationCategory("second_chance_offered")).toBe("marketplace");
  });

  it("returns marketplace for watchlist_auction_ending", () => {
    expect(getNotificationCategory("watchlist_auction_ending")).toBe("marketplace");
  });

  it("returns social for new_follower", () => {
    expect(getNotificationCategory("new_follower")).toBe("social");
  });

  it("returns social for message_received", () => {
    expect(getNotificationCategory("message_received")).toBe("social");
  });

  it("returns social for mention", () => {
    expect(getNotificationCategory("mention")).toBe("social");
  });

  it("returns marketing for newsletter", () => {
    expect(getNotificationCategory("newsletter")).toBe("marketing");
  });

  it("returns marketing for promo", () => {
    expect(getNotificationCategory("promo")).toBe("marketing");
  });

  it("returns marketing for re_engagement", () => {
    expect(getNotificationCategory("re_engagement")).toBe("marketing");
  });

  it("falls through to marketplace for unknown types", () => {
    expect(getNotificationCategory("something_not_in_map")).toBe("marketplace");
  });
});

describe("NOTIFICATION_CATEGORY_MAP coverage", () => {
  // Every value currently in the `NotificationEmailType` union (src/lib/email.ts)
  // must appear in the map. Keep this list in sync with the union.
  const REQUIRED_TYPES = [
    "offer_received",
    "offer_accepted",
    "offer_rejected",
    "offer_countered",
    "offer_expired",
    "listing_expiring",
    "listing_expired",
    "message_received",
    "feedback_reminder",
    "new_listing_from_followed",
    "welcome",
    "trial_expiring",
    "purchase_confirmation",
    "item_sold",
    "outbid",
    "auction_won",
    "auction_sold",
    "payment_reminder",
    "auction_payment_expired",
    "auction_payment_expired_seller",
  ] as const;

  it.each(REQUIRED_TYPES)("has a category for %s", (type) => {
    expect(NOTIFICATION_CATEGORY_MAP[type]).toBeDefined();
  });

  it("maps every transactional type correctly", () => {
    const transactionalTypes = [
      "welcome",
      "trial_expiring",
      "auction_won",
      "auction_sold",
      "purchase_confirmation",
      "item_sold",
      "payment_reminder",
      "auction_payment_expired",
      "auction_payment_expired_seller",
    ];
    for (const t of transactionalTypes) {
      expect(NOTIFICATION_CATEGORY_MAP[t]).toBe("transactional");
    }
  });
});

describe("shouldSendEmailForUser", () => {
  // Minimal stub mirroring the parts of `SupabaseClient` we use.
  type Row = {
    email_pref_marketplace: boolean;
    email_pref_social: boolean;
    email_pref_marketing: boolean;
  };

  function makeClient(row: Row | null, errored = false) {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () =>
              errored
                ? { data: null, error: { message: "boom" } }
                : { data: row, error: null },
          }),
        }),
      }),
    } as unknown as Parameters<typeof shouldSendEmailForUser>[2];
  }

  it("always sends transactional regardless of prefs", async () => {
    const client = makeClient({
      email_pref_marketplace: false,
      email_pref_social: false,
      email_pref_marketing: false,
    });
    expect(await shouldSendEmailForUser("p1", "welcome", client)).toBe(true);
    expect(await shouldSendEmailForUser("p1", "payment_reminder", client)).toBe(true);
    expect(await shouldSendEmailForUser("p1", "auction_won", client)).toBe(true);
  });

  it("sends when no profileId is supplied (guest path)", async () => {
    const client = makeClient(null);
    expect(await shouldSendEmailForUser(null, "outbid", client)).toBe(true);
  });

  it("honors marketplace opt-out", async () => {
    const client = makeClient({
      email_pref_marketplace: false,
      email_pref_social: true,
      email_pref_marketing: true,
    });
    expect(await shouldSendEmailForUser("p1", "outbid", client)).toBe(false);
    expect(await shouldSendEmailForUser("p1", "offer_received", client)).toBe(false);
  });

  it("honors social opt-out", async () => {
    const client = makeClient({
      email_pref_marketplace: true,
      email_pref_social: false,
      email_pref_marketing: true,
    });
    expect(await shouldSendEmailForUser("p1", "new_follower", client)).toBe(false);
    expect(await shouldSendEmailForUser("p1", "message_received", client)).toBe(false);
  });

  it("honors marketing opt-out", async () => {
    const client = makeClient({
      email_pref_marketplace: true,
      email_pref_social: true,
      email_pref_marketing: false,
    });
    expect(await shouldSendEmailForUser("p1", "newsletter", client)).toBe(false);
    expect(await shouldSendEmailForUser("p1", "promo", client)).toBe(false);
  });

  it("sends opted-in categories when other categories are off", async () => {
    const client = makeClient({
      email_pref_marketplace: true,
      email_pref_social: false,
      email_pref_marketing: false,
    });
    expect(await shouldSendEmailForUser("p1", "outbid", client)).toBe(true);
  });

  it("errs on sending when profile lookup errors", async () => {
    const client = makeClient(null, true);
    expect(await shouldSendEmailForUser("p1", "outbid", client)).toBe(true);
  });

  it("errs on sending when profile row missing", async () => {
    const client = makeClient(null);
    expect(await shouldSendEmailForUser("p1", "outbid", client)).toBe(true);
  });
});

describe("filterEmailsByPreference", () => {
  function makeClient(rows: Array<{
    id: string;
    email_pref_marketplace: boolean;
    email_pref_social: boolean;
    email_pref_marketing: boolean;
  }>) {
    return {
      from: () => ({
        select: () => ({
          in: async () => ({ data: rows, error: null }),
        }),
      }),
    } as unknown as Parameters<typeof filterEmailsByPreference>[1];
  }

  it("returns empty when given empty input", async () => {
    const client = makeClient([]);
    expect(await filterEmailsByPreference([], client)).toEqual([]);
  });

  it("always keeps transactional regardless of pref rows", async () => {
    const client = makeClient([
      {
        id: "p1",
        email_pref_marketplace: false,
        email_pref_social: false,
        email_pref_marketing: false,
      },
    ]);
    const items = [
      { profileId: "p1", emailType: "welcome" },
      { profileId: "p1", emailType: "payment_reminder" },
    ];
    const result = await filterEmailsByPreference(items, client);
    expect(result).toHaveLength(2);
  });

  it("drops recipients who opted out of marketplace", async () => {
    const client = makeClient([
      {
        id: "p1",
        email_pref_marketplace: false,
        email_pref_social: true,
        email_pref_marketing: true,
      },
      {
        id: "p2",
        email_pref_marketplace: true,
        email_pref_social: true,
        email_pref_marketing: true,
      },
    ]);
    const items = [
      { profileId: "p1", emailType: "outbid" },
      { profileId: "p2", emailType: "outbid" },
    ];
    const result = await filterEmailsByPreference(items, client);
    expect(result).toHaveLength(1);
    expect(result[0].profileId).toBe("p2");
  });

  it("keeps null-profileId entries (no user context)", async () => {
    const client = makeClient([]);
    const items = [{ profileId: null, emailType: "outbid" }];
    const result = await filterEmailsByPreference(items, client);
    expect(result).toHaveLength(1);
  });

  it("mixes transactional keeps and marketplace drops correctly", async () => {
    const client = makeClient([
      {
        id: "p1",
        email_pref_marketplace: false,
        email_pref_social: true,
        email_pref_marketing: true,
      },
    ]);
    const items = [
      { profileId: "p1", emailType: "welcome" }, // transactional — keep
      { profileId: "p1", emailType: "outbid" }, // marketplace off — drop
      { profileId: "p1", emailType: "new_follower" }, // social on — keep
    ];
    const result = await filterEmailsByPreference(items, client);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.emailType).sort()).toEqual(["new_follower", "welcome"]);
  });
});
