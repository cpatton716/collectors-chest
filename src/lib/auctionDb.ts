// ============================================================================
// auctionDb — RE-EXPORT BARREL (R1-auctiondb / M-AU9)
// ----------------------------------------------------------------------------
// The implementation was decomposed into cohesive submodules under
// ./auction/ during the M-AU9 refactor. This file is a behavior-preserving
// barrel that re-exports the public symbols so every caller that
// imports "@/lib/auctionDb" keeps working with ZERO changes.
//
// Internal helpers (transformDb*, AUCTION_COLUMNS, CRON_BATCH_LIMIT,
// handleRunnerUpForExpiredAuction, recordPaymentMissStrike, etc.) are exported
// from their submodules ONLY so siblings can import them — they are
// intentionally NOT re-exported here and remain off the public surface.
// ============================================================================

// --- shared / email formatting ---
export { formatDeadlineForEmail } from "./auction/shared";

// --- auction CRUD ---
export {
  createAuction,
  createFixedPriceListing,
  getAuction,
  getActiveAuctions,
  updateAuction,
  cancelAuction,
} from "./auction/auctions";

// --- bidding ---
export {
  placeBid,
  getBidHistory,
  executeBuyItNow,
  cloneSoldComicToBuyer,
} from "./auction/bids";

// --- watchlist ---
export {
  addToWatchlist,
  removeFromWatchlist,
  getUserWatchlist,
} from "./auction/watchlist";

// --- offers ---
export {
  createOffer,
  respondToOffer,
  respondToCounterOffer,
  getBuyerOffers,
} from "./auction/offers";

// --- notifications ---
export {
  createNotification,
  getUserNotifications,
  getUserNotificationsPaginated,
  getNotificationByIdForUser,
  deleteNotificationForUser,
  pruneOldNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
} from "./auction/notifications";

// --- seller ratings ---
export {
  submitSellerRating,
  getSellerRatings,
  getSellerProfile,
} from "./auction/ratings";

// --- cron / background processing ---
export {
  processEndedAuctions,
  expireOffers,
  expireListings,
  sendPaymentReminders,
  sendAuctionEndingSoonReminders,
  expireUnpaidAuctions,
} from "./auction/cron";

// --- second chance offers ---
export {
  createSecondChanceOffer,
  respondToSecondChanceOffer,
  expireSecondChanceOffers,
  getPendingSecondChanceOffersForRunnerUp,
} from "./auction/secondChance";
