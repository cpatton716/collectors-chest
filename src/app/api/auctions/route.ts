import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { isUserSuspended } from "@/lib/adminAuth";
import { createAuction, createFixedPriceListing, getActiveAuctions } from "@/lib/auctionDb";
import { ensureComicInSupabase, getProfileByClerkId } from "@/lib/db";
import { getFollowingIds } from "@/lib/followDb";
import { supabaseAdmin } from "@/lib/supabase";

import {
  AuctionFilters,
  AuctionSortBy,
  ListingType,
  MIN_FIXED_PRICE,
  MIN_STARTING_PRICE,
} from "@/types/auction";

// GET - List active auctions/listings with filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse filters
    const filters: AuctionFilters = {};
    if (searchParams.get("listingType")) {
      filters.listingType = searchParams.get("listingType") as ListingType;
    }
    if (searchParams.get("sellerId")) {
      const sellerIdParam = searchParams.get("sellerId")!;
      // Handle "me" to get current user's listings
      if (sellerIdParam === "me") {
        const { userId } = await auth();
        if (userId) {
          const profile = await getProfileByClerkId(userId);
          if (profile) {
            filters.sellerId = profile.id;
          }
        }
      } else {
        filters.sellerId = sellerIdParam;
      }
    }
    if (searchParams.get("minPrice")) {
      filters.minPrice = Number(searchParams.get("minPrice"));
    }
    if (searchParams.get("maxPrice")) {
      filters.maxPrice = Number(searchParams.get("maxPrice"));
    }
    if (searchParams.get("hasBuyItNow") === "true") {
      filters.hasBuyItNow = true;
    }
    if (searchParams.get("endingSoon") === "true") {
      filters.endingSoon = true;
    }

    // Parse sorting - default to "newest" for fixed_price, "ending_soonest" for auctions
    const defaultSort = filters.listingType === "fixed_price" ? "newest" : "ending_soonest";
    const sortBy = (searchParams.get("sortBy") || defaultSort) as AuctionSortBy;

    // Parse pagination
    const limit = Number(searchParams.get("limit")) || 50;
    const offset = Number(searchParams.get("offset")) || 0;

    // Parse followingOnly filter
    const followingOnly = searchParams.get("followingOnly") === "true";
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

    const body = await request.json();
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
    } = body;

    // Common validation
    if (!comicId) {
      return NextResponse.json({ error: "Comic ID is required" }, { status: 400 });
    }

    // Ensure comic exists in Supabase (sync from localStorage if needed)
    if (comicData) {
      await ensureComicInSupabase(profile.id, comicData);
    }

    if (typeof shippingCost !== "number" || shippingCost < 0) {
      return NextResponse.json(
        { error: "Shipping cost must be a positive number" },
        { status: 400 }
      );
    }

    if (detailImages && (!Array.isArray(detailImages) || detailImages.length > 4)) {
      return NextResponse.json({ error: "Maximum 4 detail images allowed" }, { status: 400 });
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
