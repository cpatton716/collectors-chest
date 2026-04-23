import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getProfileByClerkId } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { validateQuery } from "@/lib/validation";

const transactionQuerySchema = z.object({
  type: z.enum(["purchases", "wins", "bids", "offers"]),
});

// Transaction row shape returned to the client. Kept small + flat so the
// Transactions page can render without additional lookups.
export interface TransactionRow {
  id: string;
  listingType: "auction" | "fixed_price";
  comicTitle: string;
  comicIssue: string | null;
  comicVariant: string | null;
  coverImageUrl: string | null;
  sellerId: string;
  sellerDisplayName: string;
  sellerUsername: string | null;
  salePrice: number;
  shippingCost: number;
  totalPrice: number;
  status: string;
  paymentStatus: string | null;
  paymentDeadline: string | null;
  shippedAt: string | null;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  endTime: string | null;
  createdAt: string;
}

export interface BidRow extends TransactionRow {
  bidAmount: number;
  bidTime: string;
  isWinning: boolean;
}

export interface OfferRow {
  offerId: string;
  offerAmount: number;
  offerStatus: string;
  offerExpiresAt: string | null;
  offerCreatedAt: string;
  listing: TransactionRow;
}

// Shape up an auctions row (with joined comic + seller) into the flat TransactionRow.
function toTransactionRow(row: Record<string, unknown>): TransactionRow {
  const comic = row.comics as Record<string, unknown> | null;
  const seller = row.seller as Record<string, unknown> | null;
  const salePrice =
    (row.winning_bid as number | null) ||
    (row.current_bid as number | null) ||
    (row.starting_price as number | null) ||
    0;
  const shippingCost = (row.shipping_cost as number | null) || 0;
  return {
    id: row.id as string,
    listingType: row.listing_type as "auction" | "fixed_price",
    comicTitle: (comic?.title as string | null) || "Comic",
    comicIssue: (comic?.issue_number as string | null) || null,
    comicVariant: (comic?.variant as string | null) || null,
    coverImageUrl: (comic?.cover_image_url as string | null) || null,
    sellerId: row.seller_id as string,
    sellerDisplayName:
      (seller?.display_name as string | null) ||
      (seller?.username as string | null) ||
      "Seller",
    sellerUsername: (seller?.username as string | null) || null,
    salePrice,
    shippingCost,
    totalPrice: salePrice + shippingCost,
    status: row.status as string,
    paymentStatus: (row.payment_status as string | null) || null,
    paymentDeadline: (row.payment_deadline as string | null) || null,
    shippedAt: (row.shipped_at as string | null) || null,
    trackingNumber: (row.tracking_number as string | null) || null,
    trackingCarrier: (row.tracking_carrier as string | null) || null,
    endTime: (row.end_time as string | null) || null,
    createdAt: row.created_at as string,
  };
}

const LISTING_SELECT = `
  id, listing_type, seller_id, status, payment_status, payment_deadline,
  starting_price, current_bid, winning_bid, shipping_cost, end_time, created_at,
  shipped_at, tracking_number, tracking_carrier,
  comics!auctions_comic_id_fkey(title, issue_number, variant, cover_image_url),
  seller:profiles!seller_id(display_name, username)
`;

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const validatedQuery = validateQuery(transactionQuerySchema, request.nextUrl.searchParams);
    if (!validatedQuery.success) return validatedQuery.response;
    const typeParam = validatedQuery.data.type;

    switch (typeParam) {
      case "purchases": {
        // Buy Now wins
        const { data, error } = await supabase
          .from("auctions")
          .select(LISTING_SELECT)
          .eq("winner_id", profile.id)
          .eq("listing_type", "fixed_price")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return NextResponse.json({
          items: (data || []).map(toTransactionRow),
        });
      }

      case "wins": {
        // Auction wins
        const { data, error } = await supabase
          .from("auctions")
          .select(LISTING_SELECT)
          .eq("winner_id", profile.id)
          .eq("listing_type", "auction")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return NextResponse.json({
          items: (data || []).map(toTransactionRow),
        });
      }

      case "bids": {
        // Active bids — most recent bid per auction where the user bid,
        // and the auction is still active (or recently ended awaiting payment).
        const { data, error } = await supabase
          .from("bids")
          .select(
            `
            id, amount, is_winning, created_at, auction_id,
            auctions!inner(
              id, listing_type, seller_id, status, payment_status, payment_deadline,
              starting_price, current_bid, winning_bid, shipping_cost, end_time, created_at, winner_id,
              shipped_at, tracking_number, tracking_carrier,
              comics!auctions_comic_id_fkey(title, issue_number, variant, cover_image_url),
              seller:profiles!seller_id(display_name, username)
            )
            `
          )
          .eq("bidder_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(100); // cap

        if (error) throw error;

        // Collapse to one row per auction, keeping the user's most recent bid.
        const seen = new Set<string>();
        const items: BidRow[] = [];
        for (const row of (data || []) as Record<string, unknown>[]) {
          const auction = row.auctions as Record<string, unknown>;
          const auctionId = auction.id as string;
          if (seen.has(auctionId)) continue;
          seen.add(auctionId);
          items.push({
            ...toTransactionRow(auction),
            bidAmount: row.amount as number,
            bidTime: row.created_at as string,
            isWinning: (row.is_winning as boolean) || false,
          });
        }
        return NextResponse.json({ items });
      }

      case "offers": {
        // Offers the user has made
        const { data, error } = await supabase
          .from("offers")
          .select(
            `
            id, amount, status, expires_at, created_at,
            listing:auctions!listing_id(
              id, listing_type, seller_id, status, payment_status, payment_deadline,
              starting_price, current_bid, winning_bid, shipping_cost, end_time, created_at,
              shipped_at, tracking_number, tracking_carrier,
              comics!auctions_comic_id_fkey(title, issue_number, variant, cover_image_url),
              seller:profiles!seller_id(display_name, username)
            )
            `
          )
          .eq("buyer_id", profile.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        const items: OfferRow[] = ((data || []) as Record<string, unknown>[]).map((row) => ({
          offerId: row.id as string,
          offerAmount: row.amount as number,
          offerStatus: row.status as string,
          offerExpiresAt: (row.expires_at as string | null) || null,
          offerCreatedAt: row.created_at as string,
          listing: toTransactionRow(row.listing as Record<string, unknown>),
        }));
        return NextResponse.json({ items });
      }
    }
  } catch (error) {
    console.error("[/api/transactions] Error:", error);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}
