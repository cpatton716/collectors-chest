import {
  CreateTradeInput,
  GroupedMatch,
  Trade,
  TradeItem,
  TradePreview,
  TradeStatus,
  UpdateTradeInput,
} from "@/types/trade";

import { calculateSellerReputation, SellerProfile } from "@/types/auction";

import { createFeedbackReminders } from "./creatorCreditsDb";
import { supabaseAdmin } from "./supabase";

// Default + max page sizes for list queries. Callers may request fewer rows but
// never more than the hard cap so a single request can't pull an unbounded set.
export const TRADE_LIST_DEFAULT_LIMIT = 50;
export const TRADE_LIST_MAX_LIMIT = 100;
export const MATCH_LIST_DEFAULT_LIMIT = 100;
export const MATCH_LIST_MAX_LIMIT = 200;

export interface ListOptions {
  limit?: number;
  offset?: number;
}

/** Clamp a requested limit into [1, max], falling back to a default. */
export function clampLimit(requested: number | undefined, fallback: number, max: number): number {
  if (requested === undefined || !Number.isFinite(requested)) return fallback;
  const n = Math.floor(requested);
  if (n < 1) return 1;
  if (n > max) return max;
  return n;
}

/** Clamp a requested offset to a non-negative integer. */
export function clampOffset(requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested)) return 0;
  const n = Math.floor(requested);
  return n < 0 ? 0 : n;
}

// ============================================================================
// DB ROW TYPES
// ============================================================================

/** Raw comic columns selected for trade displays. Nullable to surface bad data. */
export interface TradeComicRow {
  id: string;
  title: string | null;
  issue_number: string | null;
  publisher: string | null;
  cover_image_url: string | null;
  grade: string | null;
  estimated_value: number | null;
}

/** Raw trade_items row with optional joined comic. */
export interface TradeItemRow {
  id: string;
  trade_id: string;
  comic_id: string;
  owner_id: string;
  created_at: string;
  comics?: TradeComicRow | null;
}

/** Raw trades row with optional joined items. */
export interface TradeRow {
  id: string;
  proposer_id: string;
  recipient_id: string;
  status: TradeStatus;
  proposer_tracking_carrier?: string | null;
  proposer_tracking_number?: string | null;
  recipient_tracking_carrier?: string | null;
  recipient_tracking_number?: string | null;
  proposer_shipped_at?: string | null;
  recipient_shipped_at?: string | null;
  proposer_received_at?: string | null;
  recipient_received_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  created_at: string;
  updated_at: string;
  trade_items?: TradeItemRow[] | null;
}

// ============================================================================
// PURE TRADE DECISION HELPERS (unit-tested)
// ============================================================================

/** Returns true iff the user is a participant in the trade. */
export function isTradeParticipant(
  trade: Pick<TradeRow, "proposer_id" | "recipient_id">,
  userId: string
): boolean {
  return trade.proposer_id === userId || trade.recipient_id === userId;
}

/** Returns true iff the user is the proposer side of the trade. */
export function isProposerSide(
  trade: Pick<TradeRow, "proposer_id">,
  userId: string
): boolean {
  return trade.proposer_id === userId;
}

/**
 * Build the partial update for a shipping action. Returns the side-specific
 * tracking fields plus a derived `status` of "shipped" once both parties have
 * shipped. Pure: takes the current row + actor and returns only changed fields.
 */
export function buildShipUpdate(
  trade: Pick<
    TradeRow,
    "proposer_id" | "recipient_id" | "proposer_shipped_at" | "recipient_shipped_at"
  >,
  userId: string,
  shippedAt: string,
  trackingCarrier?: string,
  trackingNumber?: string
): Record<string, unknown> {
  const isProposer = isProposerSide(trade, userId);
  const update: Record<string, unknown> = {};

  if (isProposer) {
    update.proposer_shipped_at = shippedAt;
    if (trackingCarrier) update.proposer_tracking_carrier = trackingCarrier;
    if (trackingNumber) update.proposer_tracking_number = trackingNumber;
  } else {
    update.recipient_shipped_at = shippedAt;
    if (trackingCarrier) update.recipient_tracking_carrier = trackingCarrier;
    if (trackingNumber) update.recipient_tracking_number = trackingNumber;
  }

  // Both shipped => advance status. The "other" side's prior value drives this.
  const otherShipped = isProposer ? trade.recipient_shipped_at : trade.proposer_shipped_at;
  if (otherShipped) {
    update.status = "shipped";
  }

  return update;
}

/**
 * Build the partial update for a receipt-confirmation action. When both parties
 * have confirmed receipt the trade completes. Returns `{ update, bothConfirmed }`.
 */
export function buildReceiptUpdate(
  trade: Pick<
    TradeRow,
    "proposer_id" | "recipient_id" | "proposer_received_at" | "recipient_received_at"
  >,
  userId: string,
  receivedAt: string
): { update: Record<string, unknown>; bothConfirmed: boolean } {
  const isProposer = isProposerSide(trade, userId);
  const update: Record<string, unknown> = {};

  if (isProposer) {
    update.proposer_received_at = receivedAt;
  } else {
    update.recipient_received_at = receivedAt;
  }

  const otherReceived = isProposer ? trade.recipient_received_at : trade.proposer_received_at;
  const bothConfirmed = Boolean(otherReceived);
  if (bothConfirmed) {
    update.status = "completed";
    update.completed_at = receivedAt;
  }

  return { update, bothConfirmed };
}

/**
 * Build the partial update for a generic status change. Stamps the matching
 * timestamp column for terminal states. Pure.
 */
export function buildStatusUpdate(
  updates: UpdateTradeInput,
  trade: Pick<TradeRow, "proposer_id">,
  userId: string,
  now: string
): Record<string, unknown> {
  const update: Record<string, unknown> = {};

  if (updates.status) {
    update.status = updates.status;
    if (updates.status === "cancelled") {
      update.cancelled_at = now;
      update.cancel_reason = updates.cancelReason;
    }
    if (updates.status === "completed") {
      update.completed_at = now;
    }
  }

  if (updates.trackingNumber) {
    if (isProposerSide(trade, userId)) {
      update.proposer_tracking_carrier = updates.trackingCarrier;
      update.proposer_tracking_number = updates.trackingNumber;
      update.proposer_shipped_at = now;
    } else {
      update.recipient_tracking_carrier = updates.trackingCarrier;
      update.recipient_tracking_number = updates.trackingNumber;
      update.recipient_shipped_at = now;
    }
  }

  return update;
}

// ============================================================================
// PROFILE BATCH HELPER (N+1 elimination)
// ============================================================================

const SELLER_PROFILE_COLUMNS =
  "id, display_name, public_display_name, username, display_preference, positive_ratings, negative_ratings, seller_since, location_city, location_state, location_country, location_privacy";

function rowToSellerProfile(data: any): SellerProfile {
  const { percentage, reputation } = calculateSellerReputation(
    data.positive_ratings || 0,
    data.negative_ratings || 0
  );
  return {
    id: data.id,
    displayName: data.display_name,
    publicDisplayName: data.public_display_name,
    username: data.username,
    displayPreference: data.display_preference,
    positiveRatings: data.positive_ratings || 0,
    negativeRatings: data.negative_ratings || 0,
    sellerSince: data.seller_since,
    locationCity: data.location_city,
    locationState: data.location_state,
    locationCountry: data.location_country,
    locationPrivacy: data.location_privacy,
    totalRatings: (data.positive_ratings || 0) + (data.negative_ratings || 0),
    positivePercentage: percentage,
    reputation,
  };
}

/**
 * Fetch many seller profiles in a single query. Replaces per-row
 * getSellerProfile() calls (N+1) in trade list/match builders.
 */
async function getSellerProfilesByIds(ids: string[]): Promise<Map<string, SellerProfile>> {
  const map = new Map<string, SellerProfile>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return map;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(SELLER_PROFILE_COLUMNS)
    .in("id", unique);

  if (error || !data) return map;

  for (const row of data) {
    map.set(row.id, rowToSellerProfile(row));
  }
  return map;
}

const TRADE_COMIC_COLUMNS =
  "id, title, issue_number, publisher, cover_image_url, grade, estimated_value";

/** Fetch many comics (trade-display columns) in a single query. */
async function getTradeComicsByIds(ids: string[]): Promise<Map<string, TradeComicRow>> {
  const map = new Map<string, TradeComicRow>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return map;

  const { data, error } = await supabaseAdmin
    .from("comics")
    .select(TRADE_COMIC_COLUMNS)
    .in("id", unique);

  if (error || !data) return map;

  for (const row of data as TradeComicRow[]) {
    map.set(row.id, row);
  }
  return map;
}

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

  return transformDbTrade(trade as TradeRow);
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
    .maybeSingle();

  if (error || !trade) return null;

  // Verify visitor is a participant
  if (!isTradeParticipant(trade as TradeRow, visitorId)) {
    return null;
  }

  // Batch-fetch both participant profiles in one query.
  const profiles = await getSellerProfilesByIds([trade.proposer_id, trade.recipient_id]);
  const proposer = profiles.get(trade.proposer_id) || null;
  const recipient = profiles.get(trade.recipient_id) || null;

  return transformDbTradeWithDetails(trade as TradeRow, proposer, recipient);
}

/**
 * Get all trades for a user. Batches the "other user" profile fetch across all
 * trades (single .in query) instead of one round-trip per trade.
 */
export async function getUserTrades(
  userId: string,
  status?: TradeStatus[],
  options: ListOptions = {}
): Promise<TradePreview[]> {
  const limit = clampLimit(options.limit, TRADE_LIST_DEFAULT_LIMIT, TRADE_LIST_MAX_LIMIT);
  const offset = clampOffset(options.offset);

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
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status.length > 0) {
    query = query.in("status", status);
  }

  const { data: trades, error } = await query;

  if (error) throw error;
  if (!trades || trades.length === 0) return [];

  // Batch all "other user" profile fetches into one query (N+1 fix).
  const otherUserIds = (trades as TradeRow[]).map((t) =>
    t.proposer_id === userId ? t.recipient_id : t.proposer_id
  );
  const profiles = await getSellerProfilesByIds(otherUserIds);

  const previews: TradePreview[] = [];
  for (const trade of trades as TradeRow[]) {
    const isProposer = trade.proposer_id === userId;
    const otherUserId = isProposer ? trade.recipient_id : trade.proposer_id;

    const otherUser = profiles.get(otherUserId);
    if (!otherUser) continue;

    const items = trade.trade_items || [];
    const myItems = items.filter((i) => i.owner_id === userId).map(transformDbTradeItem);
    const theirItems = items.filter((i) => i.owner_id !== userId).map(transformDbTradeItem);

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
    .maybeSingle();

  if (!trade) throw new Error("Trade not found");
  if (!isTradeParticipant(trade as TradeRow, userId)) {
    throw new Error("Not a participant");
  }

  const updateData = buildStatusUpdate(updates, trade as TradeRow, userId, new Date().toISOString());

  const { data: updated, error } = await supabaseAdmin
    .from("trades")
    .update(updateData)
    .eq("id", tradeId)
    .select()
    .single();

  if (error) throw error;

  return transformDbTrade(updated as TradeRow);
}

/**
 * Mark user as shipped (updates their shipping info and potentially status).
 * Idempotent: re-calling after this side already shipped is a no-op return of
 * the current trade (no duplicate timestamp churn / status flips).
 */
export async function markAsShipped(
  tradeId: string,
  userId: string,
  trackingCarrier?: string,
  trackingNumber?: string
): Promise<Trade> {
  const { data: trade } = await supabaseAdmin
    .from("trades")
    .select("*")
    .eq("id", tradeId)
    .maybeSingle();

  if (!trade) throw new Error("Trade not found");
  if (!isTradeParticipant(trade as TradeRow, userId)) {
    throw new Error("Not a participant");
  }
  if (trade.status !== "accepted") {
    throw new Error("Trade must be accepted before shipping");
  }

  const row = trade as TradeRow;
  const alreadyShipped = isProposerSide(row, userId)
    ? row.proposer_shipped_at
    : row.recipient_shipped_at;
  // Idempotent guard: this side already marked shipped -> return current state.
  if (alreadyShipped) {
    return transformDbTrade(row);
  }

  const updateData = buildShipUpdate(
    row,
    userId,
    new Date().toISOString(),
    trackingCarrier,
    trackingNumber
  );

  const { data: updated, error } = await supabaseAdmin
    .from("trades")
    .update(updateData)
    .eq("id", tradeId)
    .select()
    .single();

  if (error) throw error;
  return transformDbTrade(updated as TradeRow);
}

/**
 * Confirm receipt of comics
 */
export async function confirmReceipt(tradeId: string, userId: string): Promise<Trade> {
  const { data: trade } = await supabaseAdmin
    .from("trades")
    .select("*")
    .eq("id", tradeId)
    .maybeSingle();

  if (!trade) throw new Error("Trade not found");
  if (!isTradeParticipant(trade as TradeRow, userId)) {
    throw new Error("Not a participant");
  }

  const row = trade as TradeRow;
  const alreadyReceived = isProposerSide(row, userId)
    ? row.proposer_received_at
    : row.recipient_received_at;
  // Idempotent guard: this side already confirmed -> return current state.
  if (alreadyReceived) {
    return transformDbTrade(row);
  }

  const now = new Date().toISOString();
  const { update: updateData, bothConfirmed } = buildReceiptUpdate(row, userId, now);

  if (bothConfirmed) {
    // Both confirmed - complete trade and swap ownership
    await completeTrade(tradeId);

    // Create feedback reminders for both parties
    // In trades, proposer is "seller-like" (initiated), recipient is "buyer-like"
    await createFeedbackReminders("trade", tradeId, row.recipient_id, row.proposer_id);
  }

  const { data: updated, error } = await supabaseAdmin
    .from("trades")
    .update(updateData)
    .eq("id", tradeId)
    .select()
    .single();

  if (error) throw error;
  return transformDbTrade(updated as TradeRow);
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
    .maybeSingle();

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
      .maybeSingle();

    if (newOwnerProfile) {
      // Get comic details for hunt list matching
      const { data: comicDetails } = await supabaseAdmin
        .from("comics")
        .select("title, issue_number")
        .eq("id", item.comic_id)
        .maybeSingle();

      // Null-safe: skip hunt-list cleanup for comics missing title/issue.
      if (comicDetails && comicDetails.title && comicDetails.issue_number) {
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

function transformDbTrade(db: TradeRow): Trade {
  return {
    id: db.id,
    proposerId: db.proposer_id,
    recipientId: db.recipient_id,
    status: db.status,
    proposerTrackingCarrier: db.proposer_tracking_carrier ?? undefined,
    proposerTrackingNumber: db.proposer_tracking_number ?? undefined,
    recipientTrackingCarrier: db.recipient_tracking_carrier ?? undefined,
    recipientTrackingNumber: db.recipient_tracking_number ?? undefined,
    proposerShippedAt: db.proposer_shipped_at ?? undefined,
    recipientShippedAt: db.recipient_shipped_at ?? undefined,
    proposerReceivedAt: db.proposer_received_at ?? undefined,
    recipientReceivedAt: db.recipient_received_at ?? undefined,
    completedAt: db.completed_at ?? undefined,
    cancelledAt: db.cancelled_at ?? undefined,
    cancelReason: db.cancel_reason ?? undefined,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

function transformDbTradeWithDetails(
  db: TradeRow,
  proposer: SellerProfile | null,
  recipient: SellerProfile | null
): Trade {
  const trade = transformDbTrade(db);
  const items = db.trade_items || [];

  return {
    ...trade,
    proposer: proposer ?? undefined,
    recipient: recipient ?? undefined,
    proposerItems: items.filter((i) => i.owner_id === db.proposer_id).map(transformDbTradeItem),
    recipientItems: items.filter((i) => i.owner_id === db.recipient_id).map(transformDbTradeItem),
  };
}

function transformDbTradeItem(db: TradeItemRow): TradeItem {
  return {
    id: db.id,
    tradeId: db.trade_id,
    comicId: db.comic_id,
    ownerId: db.owner_id,
    comic: db.comics ? transformComicRow(db.comics) : undefined,
    createdAt: db.created_at,
  };
}

/**
 * Map a raw comic row to the trade-item comic shape. Null-safe: missing
 * title/issue fall back to display placeholders so the UI never renders
 * "undefined" or crashes on `.toLowerCase()` downstream.
 */
function transformComicRow(c: TradeComicRow): NonNullable<TradeItem["comic"]> {
  return {
    id: c.id,
    title: c.title ?? "Unknown Title",
    issueNumber: c.issue_number ?? "",
    publisher: c.publisher ?? "",
    coverImageUrl: c.cover_image_url ?? undefined,
    grade: c.grade ?? undefined,
    estimatedValue: c.estimated_value ?? undefined,
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
 * Get all pending matches for a user, grouped by their comic.
 * Batches all comic + profile fetches into two `.in` queries (N+1 fix).
 */
export async function getUserMatches(
  userId: string,
  options: ListOptions = {}
): Promise<GroupedMatch[]> {
  const limit = clampLimit(options.limit, MATCH_LIST_DEFAULT_LIMIT, MATCH_LIST_MAX_LIMIT);
  const offset = clampOffset(options.offset);

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
    .order("quality_score", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  if (!matches || matches.length === 0) return [];

  // Collect every comic + other-user id, then batch-fetch in two queries.
  const comicIds: string[] = [];
  const otherUserIds: string[] = [];
  for (const match of matches) {
    const isUserA = match.user_a_id === userId;
    comicIds.push(isUserA ? match.user_a_comic_id : match.user_b_comic_id);
    comicIds.push(isUserA ? match.user_b_comic_id : match.user_a_comic_id);
    otherUserIds.push(isUserA ? match.user_b_id : match.user_a_id);
  }

  const [comicsMap, profilesMap] = await Promise.all([
    getTradeComicsByIds(comicIds),
    getSellerProfilesByIds(otherUserIds),
  ]);

  // Group matches by user's comic
  const groupedMap = new Map<string, GroupedMatch>();

  for (const match of matches) {
    const isUserA = match.user_a_id === userId;
    const myComicId = isUserA ? match.user_a_comic_id : match.user_b_comic_id;
    const theirComicId = isUserA ? match.user_b_comic_id : match.user_a_comic_id;
    const otherUserId = isUserA ? match.user_b_id : match.user_a_id;

    const myComicRow = comicsMap.get(myComicId);
    const theirComicRow = comicsMap.get(theirComicId);
    const otherUser = profilesMap.get(otherUserId);
    if (!otherUser || !myComicRow || !theirComicRow) continue;

    const myComic = transformComicRow(myComicRow);
    const theirComic = transformComicRow(theirComicRow);

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
 * Mark a match as viewed. `userId` MUST be the caller's profile id -
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
