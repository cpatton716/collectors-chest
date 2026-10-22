import {
  MARKETPLACE_API_PREFIXES,
  MARKETPLACE_ENABLED,
  MARKETPLACE_PAGE_PREFIXES,
  getMissionStatement,
  getMissionTradeClause,
  getVisibleLists,
  isForSaleDefaultList,
  isMarketplaceApiPath,
  isMarketplacePagePath,
  isMarketplacePath,
  resolveSelectedListId,
  shouldRedirectShopTab,
} from "../features";

describe("MARKETPLACE_ENABLED", () => {
  it("defaults to off", () => {
    expect(MARKETPLACE_ENABLED).toBe(false);
  });
});

describe("isMarketplacePath", () => {
  it.each([
    "/my-auctions",
    "/transactions",
    "/watchlist",
    "/seller-onboarding",
    "/seller-onboarding/step-2",
  ])("blocks marketplace page %s", (path) => {
    expect(isMarketplacePath(path)).toBe(true);
    expect(isMarketplacePagePath(path)).toBe(true);
    expect(isMarketplaceApiPath(path)).toBe(false);
  });

  it.each([
    "/api/auctions",
    "/api/auctions/abc-123",
    "/api/auctions/abc-123/bid",
    "/api/auctions/by-comic/xyz",
    "/api/listings/abc/purchase",
    "/api/offers",
    "/api/offers/abc",
    "/api/second-chance-offers",
    "/api/second-chance-offers/abc",
    "/api/checkout",
    "/api/connect/status",
    "/api/connect/onboarding-return",
    "/api/watchlist",
  ])("blocks marketplace API %s", (path) => {
    expect(isMarketplacePath(path)).toBe(true);
    expect(isMarketplaceApiPath(path)).toBe(true);
    expect(isMarketplacePagePath(path)).toBe(false);
  });

  it("covers every declared prefix", () => {
    for (const prefix of [...MARKETPLACE_PAGE_PREFIXES, ...MARKETPLACE_API_PREFIXES]) {
      expect(isMarketplacePath(prefix)).toBe(true);
    }
  });

  it.each([
    "/api/webhooks/stripe",
    "/api/billing/checkout",
    "/api/billing/portal",
    "/api/trades",
    "/api/trades/available",
    "/api/comics/abc/for-trade",
    "/api/sellers/abc/ratings",
    "/api/transactions",
    "/api/cron/process-auctions",
    "/sales",
    "/collection",
    "/trades",
    "/shop",
    "/",
  ])("allows kept route %s", (path) => {
    expect(isMarketplacePath(path)).toBe(false);
  });

  it("is segment-aware (no false prefix matches)", () => {
    expect(isMarketplacePath("/transactions-history")).toBe(false);
    expect(isMarketplacePath("/api/checkout-session")).toBe(false);
    expect(isMarketplacePath("/watchlists")).toBe(false);
  });
});

describe("shouldRedirectShopTab", () => {
  it("redirects /shop with no tab or a marketplace tab", () => {
    expect(shouldRedirectShopTab("/shop", null)).toBe(true);
    expect(shouldRedirectShopTab("/shop", "buy-now")).toBe(true);
    expect(shouldRedirectShopTab("/shop", "auctions")).toBe(true);
  });

  it("does not redirect the for-trade tab (no redirect loop)", () => {
    expect(shouldRedirectShopTab("/shop", "for-trade")).toBe(false);
  });

  it("ignores other paths", () => {
    expect(shouldRedirectShopTab("/collection", null)).toBe(false);
    expect(shouldRedirectShopTab("/shopping", null)).toBe(false);
  });
});

describe("mission statement", () => {
  const FULL =
    "Scan any cover. Track every book. Find your people. Collectors Chest is the all-in-one platform that helps comic collectors discover value, organize with pride, and buy, sell, and trade with confidence.";

  it("restores the original approved statement exactly when the marketplace is on", () => {
    expect(getMissionStatement(true)).toBe(FULL);
    expect(getMissionTradeClause(true)).toBe("buy, sell, and trade with confidence");
  });

  it("drops only 'buy, sell,' when the marketplace is off", () => {
    expect(getMissionTradeClause(false)).toBe("trade with confidence");
    expect(getMissionStatement(false)).toBe(FULL.replace("buy, sell, and trade", "trade"));
    expect(getMissionStatement(false)).not.toMatch(/\b(buy|sell)\b/i);
  });
});

describe("For Sale list visibility", () => {
  const guestLists = [
    { id: "collection", name: "My Collection", isDefault: true },
    { id: "want-list", name: "Want List", isDefault: true },
    { id: "for-sale", name: "For Sale", isDefault: true },
    { id: "slabbed", name: "Slabbed", isDefault: true },
  ];
  const cloudLists = [
    { id: "uuid-1", name: "My Collection", isDefault: true },
    { id: "uuid-2", name: "For Sale", isDefault: true },
    { id: "uuid-3", name: "For Sale", isDefault: false }, // user-created custom list
  ];

  it("identifies the default For Sale list by guest id or cloud name", () => {
    expect(isForSaleDefaultList(guestLists[2])).toBe(true);
    expect(isForSaleDefaultList(cloudLists[1])).toBe(true);
  });

  it("never treats a custom list named For Sale as the default list", () => {
    expect(isForSaleDefaultList(cloudLists[2])).toBe(false);
  });

  it("shows every list (same array) when the marketplace is enabled", () => {
    expect(getVisibleLists(guestLists, true)).toBe(guestLists);
    expect(getVisibleLists(cloudLists, true)).toBe(cloudLists);
  });

  it("hides only the default For Sale list when the marketplace is off", () => {
    expect(getVisibleLists(guestLists, false).map((l) => l.id)).toEqual([
      "collection",
      "want-list",
      "slabbed",
    ]);
    expect(getVisibleLists(cloudLists, false).map((l) => l.id)).toEqual(["uuid-1", "uuid-3"]);
  });

  it("does not mutate the input", () => {
    const copy = [...guestLists];
    getVisibleLists(guestLists, false);
    expect(guestLists).toEqual(copy);
  });

  it("matches the live flag", () => {
    expect(getVisibleLists(guestLists, MARKETPLACE_ENABLED).some((l) => l.id === "for-sale")).toBe(
      MARKETPLACE_ENABLED
    );
  });
});

describe("resolveSelectedListId", () => {
  const visible = [{ id: "collection" }, { id: "want-list" }];

  it("keeps the primary collection view", () => {
    expect(resolveSelectedListId("collection", visible)).toBe("collection");
  });

  it("keeps a visible list", () => {
    expect(resolveSelectedListId("want-list", visible)).toBe("want-list");
  });

  it("falls back to the collection when the selected list is hidden", () => {
    expect(resolveSelectedListId("for-sale", visible)).toBe("collection");
  });

  it("keeps the selection while lists are still loading", () => {
    expect(resolveSelectedListId("for-sale", [])).toBe("for-sale");
  });

  it("keeps the For Sale list when it is visible (marketplace on)", () => {
    const all = [
      { id: "collection", name: "My Collection", isDefault: true },
      { id: "for-sale", name: "For Sale", isDefault: true },
    ];
    expect(resolveSelectedListId("for-sale", getVisibleLists(all, true))).toBe("for-sale");
    expect(resolveSelectedListId("for-sale", getVisibleLists(all, false))).toBe("collection");
  });
});
