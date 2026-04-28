import {
  CreateTradeInput,
  GroupedMatch,
  Trade,
  TradeItem,
  TradePreview,
  TradeStatus,
  UpdateTradeInput,
} from "@/types/trade";

import { getSellerProfile } from "./auctionDb";
import { createFeedbackReminders } from "./creatorCreditsDb";
import { supabase, supabaseAdmin } from "./supabase";

// ============================================================================
// TRADE HELPERS
// ============================================================================

/**
 * Create a new trade proposal
 */
export async function createTrade(proposerId: string, input: CreateTradeInput): Promise<Trade> {
  // 1. Create the trade
  const { data: trade, error: tradeError } = await supabaseAdmin
    .from("trades")
    .insert({
      proposer_id: proposerId,
      recipient_id: input.recipientId,
      status: "proposed",
    })
    .select()
    .single();

  if (tradeError) throw tradeError;

  // 2. Add proposer's items
  const proposerItems = input.myComicIds.map((comicId) => ({
    trade_id: trade.id,
    comic_id: comicId,
    owner_id: proposerId,
  }));

  // 3. Add recipient's items
  const recipientItems = input.theirComicIds.map((comicId) => ({
    trade_id: trade.id,
    comic_id: comicId,
    owner_id: input.recipientId,
  }));

  const { error: itemsError } = await supabaseAdmin
    .from("trade_items")
    .insert([...proposerItems, ...recipientItems]);

  if (itemsError) {
    // Rollback: delete the trade
    await supabaseAdmin.from("trades").delete().eq("id", trade.id);
    throw itemsError;
  }

  return transformDbTrade(trade);
}

/**
 * Get a trade by ID with all details
 */
export async function getTradeById(tradeId: string, visitorId: string): Promise<Trade | null> {
  const { data: trade, error } = await supabaseAdmin
    .from("trades")
    .select(
      `
      *,
      trade_items (
        id,
        trade_id,
        comic_id,
        owner_id,
        created_at,
        comics (
          id,
          title,
          issue_number,
          publisher,
          cover_image_url,
          grade,
          estimated_value
        )
      )
    `
    )
    .eq("id", tradeId)
    .single();

  if (error || !trade) return null;

  // Verify visitor is a participant
  if (trade.proposer_id !== visitorId && trade.recipient_id !== visitorId) {
    return null;
  }

  // Get participant profiles
  const [proposer, recipient] = await Promise.all([
    getSellerProfile(trade.proposer_id),
    getSellerProfile(trade.recipient_id),
  ]);

  return transformDbTradeWithDetails(trade, proposer, recipient);
}

/**
 * Get all trades for a user
 */
export async function getUserTrades(
  userId: string,
  status?: TradeStatus[]
): Promise<TradePreview[]> {
  let query = supabaseAdmin
    .from("trades")
    .select(
      `
      *,
      trade_items (
        id,
        trade_id,
        comic_id,
        owner_id,
        created_at,
        comics (
          id,
          title,
          issue_number,
          publisher,
          cover_image_url,
          grade,
          estimated_value
        )
      )
    `
    )
    .or(`proposer_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("updated_at", { ascending: false });

  if (status && status.length > 0) {
    query = query.in("status", status);
  }

  const { data: trades, error } = await query;

  if (error) throw error;
  if (!trades) return [];

  // Build previews
  const previews: TradePreview[] = [];
  for (const trade of trades) {
    const isProposer = trade.proposer_id === userId;
    const otherUserId = isProposer ? trade.recipient_id : trade.proposer_id;

    const otherUser = await getSellerProfile(otherUserId);
    if (!otherUser) continue;

    const items = trade.trade_items || [];
    const myItems = items.filter((i: any) => i.owner_id === userId).map(transformDbTradeItem);
    const theirItems = items.filter((i: any) => i.owner_id !== userId).map(transformDbTradeItem);

    previews.push({
      id: trade.id,
      status: trade.status,
      otherUser,
      myItems,
      theirItems,
      createdAt: trade.created_at,
      updatedAt: trade.updated_at,
      isProposer,
    });
  }

  return previews;
}

/**
 * Update trade status
 */
export async function updateTradeStatus(
  tradeId: string,
  userId: string,
  updates: UpdateTradeInput
): Promise<Trade> {
  // First verify user is participant
  const { data: trade } = await supabaseAdmin
    .from("trades")
    .select("proposer_id, recipient_id, status")
    .eq("id", tradeId)
    .single();

  if (!trade) throw new Error("Trade not found");
  if (trade.proposer_id !== userId && trade.recipient_id !== userId) {
    throw new Error("Not a participant");
  }

  // Build update object
  const updateData: Record<string, any> = {};

  if (updates.status) {
    updateData.status = updates.status;
    if (updates.status === "cancelled") {
      updateData.cancelled_at = new Date().toISOString();
      updateData.cancel_reason = updates.cancelReason;
    }
    if (updates.status === "completed") {
      updateData.completed_at = new Date().toISOString();
    }
  }

  // Handle shipping updates based on which user
  if (updates.trackingNumber) {
    if (trade.proposer_id === userId) {
      updateData.proposer_tracking_carrier = updates.trackingCarrier;
      updateData.proposer_tracking_number = updates.trackingNumber;
      updateData.proposer_shipped_at = new Date().toISOString();
    } else {
      updateData.recipient_tracking_carrier = updates.trackingCarrier;
      updateData.recipient_tracking_number = updates.trackingNumber;
      updateData.recipient_shipped_at = new Date().toISOString();
    }
  }

  const { data: updated, error } = await supabaseAdmin
    .from("trades")
    .update(updateData)
    .eq("id", tradeId)
    .select()
    .single();

  if (error) throw error;

  return transformDbTrade(updated);
}

/**
 * Mark user as shipped (updates their shipping info and potentially status)
 */
export async function markAsShipped(
  tradeId: string,
  userId: string,
  trackingCarrier?: string,
  trackingNumber?: string
): Promise<Trade> {
  const { data: trade } = await supabaseAdmin.from("trades").select("*").eq("id", tradeId).single();

  if (!trade) throw new Error("Trade not found");
  if (trade.proposer_id !== userId && trade.recipient_id !== userId) {
    throw new Error("Not a participant");
  }
  if (trade.status !== "accepted") {
    throw new Error("Trade must be accepted before shipping");
  }

  const isProposer = trade.proposer_id === userId;
  const updateData: Record<string, any> = {};

  if (isProposer) {
    updateData.proposer_shipped_at = new Date().toISOString();
    if (trackingCarrier) updateData.proposer_tracking_carrier = trackingCarrier;
    if (trackingNumber) updateData.proposer_tracking_number = trackingNumber;
  } else {
    updateData.recipient_shipped_at = new Date().toISOString();
    if (trackingCarrier) updateData.recipient_tracking_carrier = trackingCarrier;
    if (trackingNumber) updateData.recipient_tracking_number = trackingNumber;
  }

  // Check if both have shipped - update status to shipped
  const otherShipped = isProposer ? trade.recipient_shipped_at : trade.proposer_shipped_at;
  if (otherShipped) {
    updateData.status = "shipped";
  }

  const { data: updated, error } = await supabaseAdmin
    .from("trades")
    .update(updateData)
    .eq("id", tradeId)
    .select()
    .single();

  if (error) throw error;
  return transformDbTrade(updated);
}

/**
 * Confirm receipt of comics
 */
export async function confirmReceipt(tradeId: string, userId: string): Promise<Trade> {
  const { data: trade } = await supabaseAdmin.from("trades").select("*").eq("id", tradeId).single();

  if (!trade) throw new Error("Trade not found");
  if (trade.proposer_id !== userId && trade.recipient_id !== userId) {
    throw new Error("Not a participant");
  }

  const isProposer = trade.proposer_id === userId;
  const updateData: Record<string, any> = {};

  if (isProposer) {
    updateData.proposer_received_at = new Date().toISOString();
  } else {
    updateData.recipient_received_at = new Date().toISOString();
  }

  // Check if both have confirmed - complete the trade
  const otherReceived = isProposer ? trade.recipient_received_at : trade.proposer_received_at;
  if (otherReceived) {
    // Both confirmed - complete trade and swap ownership
    await completeTrade(tradeId);
    updateData.status = "completed";
    updateData.completed_at = new Date().toISOString();

    // Create feedback reminders for both parties
    // In trades, proposer is "seller-like" (initiated), recipient is "buyer-like"
    await createFeedbackReminders("trade", tradeId, trade.recipient_id, trade.proposer_id);
  }

  const { data: updated, error } = await supabaseAdmin
    .from("trades")
    .update(updateData)
    .eq("id", tradeId)
    .select()
    .single();

  if (error) throw error;
  return transformDbTrade(updated);
}

/**
 * Complete a trade - swap comic ownership
 */
export async function completeTrade(tradeId: string): Promise<void> {
  // Get trade items
  const { data: items, error: itemsError } = await supabaseAdmin
    .from("trade_items")
    .select("comic_id, owner_id")
    .eq("trade_id", tradeId);

  if (itemsError) throw itemsError;

  // Get the trade to know proposer/recipient
  const { data: trade } = await supabaseAdmin
    .from("trades")
    .select("proposer_id, recipient_id")
    .eq("id", tradeId)
    .single();

  if (!trade) throw new Error("Trade not found");

  // Swap ownership for each comic
  for (const item of items || []) {
    const newOwnerId = item.owner_id === trade.proposer_id ? trade.recipient_id : trade.proposer_id;

    await supabaseAdmin
      .from("comics")
      .update({
        user_id: newOwnerId,
        for_trade: false,
        acquired_via: "trade",
      })
      .eq("id", item.comic_id);

    // Remove from new owner's hunt list if present
    // First get the new owner's clerk_user_id
    const { data: newOwnerProfile } = await supabaseAdmin
      .from("profiles")
      .select("clerk_user_id")
      .eq("id", newOwnerId)
      .single();

    if (newOwnerProfile) {
      // Get comic details for hunt list matching
      const { data: comicDetails } = await supabaseAdmin
        .from("comics")
        .select("title, issue_number")
        .eq("id", item.comic_id)
        .single();

      if (comicDetails) {
        // Remove from hunt list (case-insensitive match)
        await supabaseAdmin
          .from("key_hunt_lists")
          .delete()
          .eq("user_id", newOwnerProfile.clerk_user_id)
          .ilike("title_normalized", comicDetails.title.toLowerCase().trim())
          .eq("issue_number", comicDetails.issue_number.trim());
      }
    }
  }
}

// ============================================================================
// TRANSFORM HELPERS
// ============================================================================

function transformDbTrade(db: any): Trade {
  return {
    id: db.id,
    proposerId: db.proposer_id,
    recipientId: db.recipient_id,
    status: db.status,
    proposerTrackingCarrier: db.proposer_tracking_carrier,
    proposerTrackingNumber: db.proposer_tracking_number,
    recipientTrackingCarrier: db.recipient_tracking_carrier,
    recipientTrackingNumber: db.recipient_tracking_number,
    proposerShippedAt: db.proposer_shipped_at,
    recipientShippedAt: db.recipient_shipped_at,
    proposerReceivedAt: db.proposer_received_at,
    recipientReceivedAt: db.recipient_received_at,
    completedAt: db.completed_at,
    cancelledAt: db.cancelled_at,
    cancelReason: db.cancel_reason,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

function transformDbTradeWithDetails(db: any, proposer: any, recipient: any): Trade {
  const trade = transformDbTrade(db);
  const items = db.trade_items || [];

  return {
    ...trade,
    proposer,
    recipient,
    proposerItems: items
      .filter((i: any) => i.owner_id === db.proposer_id)
      .map(transformDbTradeItem),
    recipientItems: items
      .filter((i: any) => i.owner_id === db.recipient_id)
      .map(transformDbTradeItem),
  };
}

function transformDbTradeItem(db: any): TradeItem {
  return {
    id: db.id,
    tradeId: db.trade_id,
    comicId: db.comic_id,
    ownerId: db.owner_id,
    comic: db.comics
      ? {
          id: db.comics.id,
          title: db.comics.title,
          issueNumber: db.comics.issue_number,
          publisher: db.comics.publisher,
          coverImageUrl: db.comics.cover_image_url,
          grade: db.comics.grade,
          estimatedValue: db.comics.estimated_value,
        }
      : undefined,
    createdAt: db.created_at,
  };
}

// ============================================================================
// MATCHING HELPERS
// ============================================================================

/**
 * Trigger match finding for a user (call after marking comic for trade or adding to hunt list)
 */
export async function triggerMatchFinding(userId: string, comicId?: string): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc("find_trade_matches", {
    p_user_id: userId,
    p_comic_id: comicId || null,
  });

  if (error) {
    console.error("Error finding matches:", error);
    return 0;
  }

  return data || 0;
}

/**
 * Get all pending matches for a user, grouped by their comic
 */
export async function getUserMatches(userId: string): Promise<GroupedMatch[]> {
  const { data: matches, error } = await supabaseAdmin
    .from("trade_matches")
    .select(
      `
      id,
      user_a_id,
      user_b_id,
      user_a_comic_id,
      user_b_comic_id,
      quality_score,
      status,
      created_at
    `
    )
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .in("status", ["pending", "viewed"])
    .order("quality_score", { ascending: false });

  if (error) throw error;
  if (!matches || matches.length === 0) return [];

  // Group matches by user's comic
  const groupedMap = new Map<string, GroupedMatch>();

  for (const match of matches) {
    const isUserA = match.user_a_id === userId;
    const myComicId = isUserA ? match.user_a_comic_id : match.user_b_comic_id;
    const theirComicId = isUserA ? match.user_b_comic_id : match.user_a_comic_id;
    const otherUserId = isUserA ? match.user_b_id : match.user_a_id;

    // Fetch comic details
    const [myComicData, theirComicData] = await Promise.all([
      supabaseAdmin
        .from("comics")
        .select("id, title, issue_number, publisher, cover_image_url, grade, estimated_value")
        .eq("id", myComicId)
        .single(),
      supabaseAdmin
        .from("comics")
        .select("id, title, issue_number, publisher, cover_image_url, grade, estimated_value")
        .eq("id", theirComicId)
        .single(),
    ]);

    const otherUser = await getSellerProfile(otherUserId);
    if (!otherUser || !myComicData.data || !theirComicData.data) continue;

    const myComic = {
      id: myComicData.data.id,
      title: myComicData.data.title,
      issueNumber: myComicData.data.issue_number,
      publisher: myComicData.data.publisher,
      coverImageUrl: myComicData.data.cover_image_url,
      grade: myComicData.data.grade,
      estimatedValue: myComicData.data.estimated_value,
    };

    const theirComic = {
      id: theirComicData.data.id,
      title: theirComicData.data.title,
      issueNumber: theirComicData.data.issue_number,
      publisher: theirComicData.data.publisher,
      coverImageUrl: theirComicData.data.cover_image_url,
      grade: theirComicData.data.grade,
      estimatedValue: theirComicData.data.estimated_value,
    };

    // Group by my comic
    if (!groupedMap.has(myComicId)) {
      groupedMap.set(myComicId, {
        myComic,
        matches: [],
      });
    }

    groupedMap.get(myComicId)!.matches.push({
      otherUser,
      theirComic,
      qualityScore: match.quality_score,
      matchId: match.id,
    });
  }

  return Array.from(groupedMap.values());
}

/**
 * Mark a match as viewed. `userId` MUST be the caller's profile id —
 * `supabaseAdmin` bypasses RLS, so an `.eq("id", matchId)`-only update
 * would be IDOR (any user could mark anyone's match viewed by guessing
 * UUIDs). Returns true iff a row matched.
 */
export async function markMatchViewed(
  matchId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("trade_matches")
    .update({
      status: "viewed",
      viewed_at: new Date().toISOString(),
    })
    .eq("id", matchId)
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .select("id");
  return (data?.length ?? 0) > 0;
}

/**
 * Dismiss a match. See ownership-scoping note on `markMatchViewed`.
 * Returns true iff a row matched.
 */
export async function dismissMatch(
  matchId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("trade_matches")
    .update({
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
    })
    .eq("id", matchId)
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .select("id");
  return (data?.length ?? 0) > 0;
}

/**
 * Mark match as traded (when a trade is created from a match).
 * See ownership-scoping note on `markMatchViewed`.
 */
export async function markMatchTraded(
  matchId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("trade_matches")
    .update({ status: "traded" })
    .eq("id", matchId)
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .select("id");
  return (data?.length ?? 0) > 0;
}
