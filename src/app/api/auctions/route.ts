import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { isUserSuspended } from "@/lib/adminAuth";
import { createAuction, createFixedPriceListing, getActiveAuctions } from "@/lib/auctionDb";
import { ensureComicInSupabase, getProfileByClerkId } from "@/lib/db";
import type { CollectionItem } from "@/types/comic";
import { getFollowingIds } from "@/lib/followDb";
import { supabaseAdmin } from "@/lib/supabase";
import { schemas, validateBody, validateQuery } from "@/lib/validation";

import {
  AuctionFilters,
  MIN_FIXED_PRICE,
  MIN_STARTING_PRICE,
} from "@/types/auction";

const listingTypeEnum = z.enum(["auction", "fixed_price"]);
const sortByEnum = z.enum([
  "ending_soonest",
  "ending_latest",
  "price_low",
  "price_high",
  "most_bids",
  "newest",
]);

const listAuctionsQuerySchema = z.object({
  listingType: listingTypeEnum.optional(),
  sellerId: z
    .string()
    .refine((v) => v === "me" || z.string().uuid().safeParse(v).success, {
      message: "Must be 'me' or a valid UUID",
    })
    .optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  hasBuyItNow: z.enum(["true", "false"]).optional(),
  endingSoon: z.enum(["true", "false"]).optional(),
  followingOnly: z.enum(["true", "false"]).optional(),
  sortBy: sortByEnum.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const createListingBodySchema = z
  .object({
    comicId: schemas.uuid,
    comicData: z.unknown().optional(),
    listingType: listingTypeEnum.optional(),
    startingPrice: z.number().nonnegative().max(1_000_000).optional(),
    price: z.number().nonnegative().max(1_000_000).optional(),
    buyItNowPrice: z.number().positive().max(1_000_000).nullable().optional(),
    durationDays: z.number().int().min(1).max(14).optional(),
    shippingCost: z.number().nonnegative().max(10_000),
    detailImages: z.array(z.string().max(2048)).max(4).optional(),
    description: z.string().max(5000).optional(),
    acceptsOffers: z.boolean().optional(),
    minOfferAmount: z.number().nonnegative().max(1_000_000).optional(),
    startDate: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

// GET - List active auctions/listings with filters
export async function GET(request: NextRequest) {
  try {
    const validated = validateQuery(listAuctionsQuerySchema, request.nextUrl.searchParams);
    if (!validated.success) return validated.response;
    const query = validated.data;

    // Parse filters
    const filters: AuctionFilters = {};
    if (query.listingType) {
      filters.listingType = query.listingType;
    }
    if (query.sellerId) {
      // Handle "me" to get current user's listings
      if (query.sellerId === "me") {
        const { userId } = await auth();
        if (userId) {
          const profile = await getProfileByClerkId(userId);
          if (profile) {
            filters.sellerId = profile.id;
          }
        }
      } else {
        filters.sellerId = query.sellerId;
      }
    }
    if (query.minPrice !== undefined) {
      filters.minPrice = query.minPrice;
    }
    if (query.maxPrice !== undefined) {
      filters.maxPrice = query.maxPrice;
    }
    if (query.hasBuyItNow === "true") {
      filters.hasBuyItNow = true;
    }
    if (query.endingSoon === "true") {
      filters.endingSoon = true;
    }

    // Parse sorting - default to "newest" for fixed_price, "ending_soonest" for auctions
    const defaultSort = filters.listingType === "fixed_price" ? "newest" : "ending_soonest";
    const sortBy = query.sortBy || defaultSort;

    // Parse pagination
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    // Parse followingOnly filter
    const followingOnly = query.followingOnly === "true";
    let followedSellerIds: string[] | undefined;

    if (followingOnly) {
      const { userId } = await auth();
      if (userId) {
        const profile = await getProfileByClerkId(userId);
        if (profile) {
          followedSellerIds = await getFollowingIds(profile.id);
        }
      }
      // If user is not logged in or no profile, followedSellerIds stays undefined
      // and getActiveAuctions will return all auctions (graceful degradation)
    }

    const { auctions, total } = await getActiveAuctions(filters, sortBy, limit, offset, followedSellerIds);

    return NextResponse.json({
      auctions,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching auctions:", error);
    return NextResponse.json({ error: "Failed to fetch auctions" }, { status: 500 });
  }
}

// POST - Create a new auction or fixed-price listing
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is suspended
    const suspensionStatus = await isUserSuspended(userId);
    if (suspensionStatus.suspended) {
      return NextResponse.json(
        {
          error: "account_suspended",
          message: "Your account has been suspended.",
          suspended: true,
        },
        { status: 403 }
      );
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Age verification gate
    if (!profile.age_confirmed_at) {
      return NextResponse.json(
        { error: "AGE_VERIFICATION_REQUIRED", message: "You must confirm you are 18+ to use the marketplace." },
        { status: 403 }
      );
    }

    // Check seller has completed Stripe Connect onboarding
    const { data: connectCheck } = await supabaseAdmin
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_onboarding_complete")
      .eq("id", profile.id)
      .single();

    if (!connectCheck?.stripe_connect_account_id || !connectCheck.stripe_connect_onboarding_complete) {
      return NextResponse.json(
        { error: "CONNECT_REQUIRED", message: "You must set up seller payments before listing items." },
        { status: 403 }
      );
    }

    const rawBody = await request.json().catch(() => null);
    const validatedBody = validateBody(createListingBodySchema, rawBody);
    if (!validatedBody.success) return validatedBody.response;
    const {
      comicId,
      comicData, // Full comic data from localStorage
      listingType = "auction",
      startingPrice,
      price, // For fixed-price listings
      buyItNowPrice,
      durationDays,
      shippingCost,
      detailImages,
      description,
      // Fixed-price offer support
      acceptsOffers,
      minOfferAmount,
      // Scheduled auction support
      startDate,
    } = validatedBody.data;

    // Ensure comic exists in Supabase (sync from localStorage if needed).
    // Zod validated structural shape only — helper does deeper validation.
    if (comicData) {
      await ensureComicInSupabase(profile.id, comicData as CollectionItem);
    }

    // Handle fixed-price listing
    if (listingType === "fixed_price") {
      const listingPrice = price || startingPrice;

      if (typeof listingPrice !== "number" || listingPrice < MIN_FIXED_PRICE) {
        return NextResponse.json(
          { error: `Price must be at least $${MIN_FIXED_PRICE}` },
          { status: 400 }
        );
      }

      // Validate minOfferAmount if acceptsOffers is true
      if (acceptsOffers && minOfferAmount !== undefined) {
        if (typeof minOfferAmount !== "number" || minOfferAmount < MIN_FIXED_PRICE) {
          return NextResponse.json(
            { error: `Minimum offer must be at least $${MIN_FIXED_PRICE}` },
            { status: 400 }
          );
        }
        if (minOfferAmount >= listingPrice) {
          return NextResponse.json(
            { error: "Minimum offer must be less than asking price" },
            { status: 400 }
          );
        }
      }

      const listing = await createFixedPriceListing(profile.id, {
        comicId,
        price: listingPrice,
        shippingCost,
        detailImages: detailImages || [],
        description: description || "",
        acceptsOffers: acceptsOffers || false,
        minOfferAmount: acceptsOffers ? minOfferAmount : undefined,
      });

      return NextResponse.json({ auction: listing }, { status: 201 });
    }

    // Handle auction
    if (typeof startingPrice !== "number" || startingPrice < MIN_STARTING_PRICE) {
      return NextResponse.json(
        { error: `Starting price must be at least $${MIN_STARTING_PRICE}` },
        { status: 400 }
      );
    }

    if (!Number.isInteger(startingPrice) && startingPrice !== 0.99) {
      return NextResponse.json(
        { error: "Starting price must be a whole dollar amount (except $0.99)" },
        { status: 400 }
      );
    }

    if (buyItNowPrice !== undefined && buyItNowPrice !== null) {
      if (typeof buyItNowPrice !== "number" || buyItNowPrice <= startingPrice) {
        return NextResponse.json(
          { error: "Buy It Now price must be higher than starting price" },
          { status: 400 }
        );
      }
    }

    if (typeof durationDays !== "number" || durationDays < 1 || durationDays > 14) {
      return NextResponse.json(
        { error: "Duration must be between 1 and 14 days" },
        { status: 400 }
      );
    }

    // Validate startDate if provided
    if (startDate) {
      const selectedDate = new Date(startDate);
      const now = new Date();
      if (selectedDate <= now) {
        return NextResponse.json({ error: "Start date must be in the future" }, { status: 400 });
      }
    }

    const auction = await createAuction(profile.id, {
      comicId,
      listingType: "auction",
      startingPrice,
      buyItNowPrice: buyItNowPrice || null,
      durationDays,
      shippingCost,
      detailImages: detailImages || [],
      description: description || "",
      startDate: startDate || undefined,
    });

    return NextResponse.json({ auction }, { status: 201 });
  } catch (error) {
    console.error("Error creating listing:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Return 400 for user errors like duplicate listings
    if (errorMessage.includes("already has an active listing")) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    return NextResponse.json(
      { error: `Failed to create listing: ${errorMessage}` },
      { status: 500 }
    );
  }
}
