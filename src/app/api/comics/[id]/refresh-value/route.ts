import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { cacheGet, cacheSet, generateEbayPriceCacheKey } from "@/lib/cache";
import { getProfileByClerkId } from "@/lib/db";
import {
  convertBrowseToPriceData,
  isBrowseApiConfigured,
  searchActiveListings,
} from "@/lib/ebayBrowse";
import { supabaseAdmin } from "@/lib/supabase";
import { schemas, validateParams } from "@/lib/validation";

import type { PriceData } from "@/types/comic";

const paramsSchema = z.object({ id: schemas.uuid });

// POST /api/comics/[id]/refresh-value
// Triggers an eBay price lookup for the owner's comic and persists the
// resulting price_data. Used when a purchased-in comic lands without a value,
// or when the owner wants a fresh market read. Honors the same Redis cache
// as /api/ebay-prices (12h TTL) so repeated clicks don't hammer eBay.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const validated = validateParams(paramsSchema, await params);
    if (!validated.success) return validated.response;
    const { id } = validated.data;

    const { data: comic, error: fetchError } = await supabaseAdmin
      .from("comics")
      .select(
        "id, user_id, title, issue_number, release_year, grade, is_slabbed, grading_company"
      )
      .eq("id", id)
      .single();

    if (fetchError || !comic) {
      return NextResponse.json({ error: "Comic not found" }, { status: 404 });
    }

    if (comic.user_id !== profile.id) {
      return NextResponse.json(
        { error: "You don't own this comic" },
        { status: 403 }
      );
    }

    const title = (comic.title as string | null)?.trim();
    const issueNumber = (comic.issue_number as string | null)?.trim() || undefined;
    if (!title) {
      return NextResponse.json(
        { error: "Comic is missing a title, cannot look up value" },
        { status: 400 }
      );
    }

    const numericGrade = (comic.grade as number | null) ?? 9.4;
    const slabbed = Boolean(comic.is_slabbed);
    const company = (comic.grading_company as string | null)?.trim() || undefined;
    const year = comic.release_year ? String(comic.release_year) : undefined;

    const cacheKey = generateEbayPriceCacheKey(
      title,
      issueNumber || "",
      numericGrade,
      slabbed,
      company
    );

    let priceData: PriceData | null = null;
    let source: "ebay" | "cache" | "none" = "none";

    const cached = await cacheGet<PriceData | { noData: true }>(cacheKey, "ebayPrice");
    if (cached !== null) {
      if (!("noData" in cached)) {
        priceData = cached;
        source = "cache";
      }
    } else if (isBrowseApiConfigured()) {
      const browseResult = await searchActiveListings(
        title,
        issueNumber,
        String(numericGrade),
        slabbed,
        company,
        year
      );
      priceData = browseResult
        ? convertBrowseToPriceData(browseResult, String(numericGrade), slabbed)
        : null;
      if (priceData?.estimatedValue) {
        cacheSet(cacheKey, priceData, "ebayPrice").catch(() => {});
        source = "ebay";
      } else {
        cacheSet(cacheKey, { noData: true }, "ebayPrice", 60 * 60).catch(() => {});
      }
    }

    if (!priceData?.estimatedValue) {
      return NextResponse.json({
        success: true,
        priceData: null,
        source,
        message: "No eBay sales data found for this comic.",
      });
    }

    // Persist to the owner's row so subsequent reads see the value without a
    // re-lookup. `average_price` mirrors estimatedValue (used by some grid views).
    const { error: updateError } = await supabaseAdmin
      .from("comics")
      .update({
        price_data: priceData,
        average_price: priceData.estimatedValue,
      })
      .eq("id", id);

    if (updateError) {
      console.error("[refresh-value] DB update failed:", updateError);
      return NextResponse.json(
        { error: "Failed to save updated value" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      priceData,
      source,
    });
  } catch (error) {
    console.error("[refresh-value] Error:", error);
    return NextResponse.json(
      { error: "Failed to refresh market value" },
      { status: 500 }
    );
  }
}
