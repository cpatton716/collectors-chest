/**
 * Feature flags.
 *
 * MARKETPLACE_ENABLED gates buying, selling, auctions, offers, watchlist and
 * seller (Stripe Connect) onboarding. Collection, scanning, Mark as Sold, the
 * /sales page, For Trade, Trades and subscriptions/billing are NOT gated.
 *
 * To re-enable the marketplace: set this to `true` (one line). Decide the
 * Stripe fee model first (who bears processing fees on destination charges).
 */
export const MARKETPLACE_ENABLED = false;

/** Marketplace-only page routes, redirected to /collection when the flag is off. */
export const MARKETPLACE_PAGE_PREFIXES = [
  "/my-auctions",
  "/transactions",
  "/watchlist",
  "/seller-onboarding",
] as const;

/** Marketplace-only API routes, answered with a 404 when the flag is off. */
export const MARKETPLACE_API_PREFIXES = [
  "/api/auctions",
  "/api/listings",
  "/api/offers",
  "/api/second-chance-offers",
  "/api/checkout",
  "/api/connect",
  "/api/watchlist",
] as const;

/** True when `pathname` equals `prefix` or is nested beneath it (segment-aware). */
function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** True when `pathname` is a marketplace-only page route. */
export function isMarketplacePagePath(pathname: string): boolean {
  return MARKETPLACE_PAGE_PREFIXES.some((p) => matchesPrefix(pathname, p));
}

/** True when `pathname` is a marketplace-only API route. */
export function isMarketplaceApiPath(pathname: string): boolean {
  return MARKETPLACE_API_PREFIXES.some((p) => matchesPrefix(pathname, p));
}

/**
 * True when `pathname` is any marketplace-only route (page or API).
 * Segment-aware, so `/transactions` is blocked but `/api/transactions`
 * (used by the kept /sales page) is not.
 */
export function isMarketplacePath(pathname: string): boolean {
  return isMarketplacePagePath(pathname) || isMarketplaceApiPath(pathname);
}

/**
 * True when a /shop request should be redirected to the For Trade tab:
 * any tab other than `for-trade` (including no tab) is marketplace-only.
 */
export function shouldRedirectShopTab(pathname: string, tab: string | null): boolean {
  return pathname === "/shop" && tab !== "for-trade";
}

/**
 * Pure: the closing clause of the approved mission statement. With the
 * marketplace off, "buy, sell," is dropped; flipping the flag restores it.
 */
export function getMissionTradeClause(marketplaceEnabled: boolean): string {
  return marketplaceEnabled ? "buy, sell, and trade with confidence" : "trade with confidence";
}

/** Pure: the full approved mission statement for a given marketplace flag value. */
export function getMissionStatement(marketplaceEnabled: boolean): string {
  return `Scan any cover. Track every book. Find your people. Collectors Chest is the all-in-one platform that helps comic collectors discover value, organize with pride, and ${getMissionTradeClause(marketplaceEnabled)}.`;
}

/**
 * Pure: true for the built-in "For Sale" default list (guest id sentinel
 * "for-sale", or the cloud default named "For Sale"). A user-created custom
 * list that happens to be named "For Sale" (isDefault=false) is NOT matched.
 */
export function isForSaleDefaultList(list: {
  id: string;
  name: string;
  isDefault: boolean;
}): boolean {
  return list.isDefault && (list.id === "for-sale" || list.name === "For Sale");
}

/**
 * Pure: the lists to show in the UI. With the marketplace off, the default
 * "For Sale" list is hidden (nothing can be sold); its memberships stay in
 * the database untouched. Flipping the flag restores it.
 */
export function getVisibleLists<T extends { id: string; name: string; isDefault: boolean }>(
  lists: T[],
  marketplaceEnabled: boolean
): T[] {
  return marketplaceEnabled ? lists : lists.filter((l) => !isForSaleDefaultList(l));
}

/**
 * Pure: the list id the collection page should filter by. If the selected
 * list is no longer visible (e.g. the hidden "For Sale" list, or a deleted
 * list), fall back to the primary "collection" view. While lists are still
 * loading (empty array) the selection is kept as-is.
 */
export function resolveSelectedListId(
  selectedList: string,
  visibleLists: { id: string }[]
): string {
  if (selectedList === "collection" || visibleLists.length === 0) return selectedList;
  return visibleLists.some((l) => l.id === selectedList) ? selectedList : "collection";
}
