import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getProfileByClerkId } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import { schemas, validateQuery } from "@/lib/validation";

const forTradeQuerySchema = z.object({
  userId: schemas.uuid.optional(),
});

// GET - Get for-trade comics (own or another user's)
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();

    const validated = validateQuery(forTradeQuerySchema, new URL(request.url).searchParams);
    if (!validated.success) return validated.response;
    const { userId: targetUserId } = validated.data;

    let profileId: string;

    if (targetUserId) {
      // Get another user's for-trade comics
      profileId = targetUserId;
    } else {
      // Get own for-trade comics
      if (!clerkUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const profile = await getProfileByClerkId(clerkUserId);
      if (!profile) {
        return NextResponse.json({ error: "Profile not found" }, { status: 404 });
      }
      profileId = profile.id;
    }

    // Scoped to a single profile's for-trade comics. Uses supabaseAdmin so the
    // public "view another collector's tradeables" path isn't blocked by RLS,
    // while the `.eq("user_id", profileId)` filter keeps the result scoped to
    // exactly that owner.
    const { data: comics, error } = await supabaseAdmin
      .from("comics")
      .select("id, title, issue_number, publisher, cover_image_url, grade, estimated_value:price_data->estimatedValue")
      .eq("user_id", profileId)
      .eq("for_trade", true)
      .order("title");

    if (error) throw error;

    const transformed = (comics || []).map((c) => ({
      id: c.id,
      title: c.title ?? "Unknown Title",
      issueNumber: c.issue_number ?? "",
      publisher: c.publisher ?? "",
      coverImageUrl: c.cover_image_url ?? undefined,
      grade: c.grade ?? undefined,
      estimatedValue: c.estimated_value ?? undefined,
    }));

    return NextResponse.json({ comics: transformed });
  } catch (error) {
    console.error("Error fetching for-trade comics:", error);
    return NextResponse.json({ error: "Failed to fetch comics" }, { status: 500 });
  }
}
