// AUTO-EXTRACTED from auctionDb.ts during R1-auctiondb refactor (M-AU9).
// Behavior-preserving: function bodies moved verbatim.

import { WatchlistItem } from "@/types/auction";

import { supabase } from "../supabase";
import { AUCTION_WITH_COMIC_SELECT } from "./columns";
import { transformDbAuction } from "./transforms";

// ============================================================================
// WATCHLIST
// ============================================================================

/**
 * Add auction to watchlist
 */
export async function addToWatchlist(userId: string, auctionId: string): Promise<void> {
  const { error } = await supabase.from("auction_watchlist").insert({
    user_id: userId,
    auction_id: auctionId,
  });

  // Ignore duplicate errors
  if (error && !error.message.includes("duplicate")) {
    throw error;
  }
}

/**
 * Remove auction from watchlist
 */
export async function removeFromWatchlist(userId: string, auctionId: string): Promise<void> {
  const { error } = await supabase
    .from("auction_watchlist")
    .delete()
    .eq("user_id", userId)
    .eq("auction_id", auctionId);

  if (error) throw error;
}

/**
 * Get user's watchlist
 */
export async function getUserWatchlist(userId: string): Promise<WatchlistItem[]> {
  const { data, error } = await supabase
    .from("auction_watchlist")
    .select(`id, user_id, auction_id, created_at, auctions(${AUCTION_WITH_COMIC_SELECT})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  // Cast: explicit column-list select built from a constant string defeats
  // Supabase's literal-only type parser (see getActiveAuctions).
  const rows = (data as unknown as Record<string, unknown>[]) || [];
  return rows.map((item) => ({
    id: item.id as string,
    userId: item.user_id as string,
    auctionId: item.auction_id as string,
    createdAt: item.created_at as string,
    auction: item.auctions
      ? transformDbAuction(item.auctions as Record<string, unknown>)
      : undefined,
  }));
}
