import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { supabase } from "@/lib/supabase";
import { schemas, validateParams } from "@/lib/validation";

const paramsSchema = z.object({ comicId: schemas.uuid });

// GET - Check if a comic has an active listing (auction or fixed_price)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ comicId: string }> }
) {
  try {
    const validatedParams = validateParams(paramsSchema, await params);
    if (!validatedParams.success) return validatedParams.response;
    const { comicId } = validatedParams.data;

    // Check for any active listing (both auctions and fixed-price)
    const { data, error } = await supabase
      .from("auctions")
      .select("id, listing_type, status")
      .eq("comic_id", comicId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error checking listing for comic:", comicId, error);
      throw error;
    }

    if (data) {
      return NextResponse.json({
        listing: {
          id: data.id,
          listingType: data.listing_type,
          status: data.status,
        },
      });
    }

    return NextResponse.json({ listing: null });
  } catch (error) {
    console.error("Error checking listing:", error);
    return NextResponse.json({ listing: null });
  }
}
