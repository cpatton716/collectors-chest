import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getProfileByClerkId } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

// GET - Get all comics marked for trade (excluding user's own)
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    // Get current user's profile ID to exclude their comics
    let excludeUserId: string | null = null;
    if (userId) {
      const profile = await getProfileByClerkId(userId);
      if (profile) {
        excludeUserId = profile.id;
      }
    }

    // Query comics marked for trade
    let query = supabaseAdmin
      .from("comics")
      .select(
        `
        id,
        title,
        issue_number,
        publisher,
        cover_image_url,
        grade,
        estimated_value,
        user_id,
        profiles!comics_user_id_fkey (
          id,
          clerk_user_id,
          display_name,
          username,
          seller_rating,
          seller_rating_count,
          location_city,
          location_state,
          location_country,
          location_privacy
        )
      `
      )
      .eq("for_trade", true)
      .order("updated_at", { ascending: false })
      .limit(100);

    // Exclude current user's comics
    if (excludeUserId) {
      query = query.neq("user_id", excludeUserId);
    }

    const { data: comics, error } = await query;

    if (error) throw error;

    // Transform to response format with want counts
    const comicsWithWantCount = await Promise.all(
      (comics || []).map(async (comic: any) => {
        // Count users who want this comic (excluding the owner)
        const { count } = await supabaseAdmin
          .from("key_hunt_lists")
          .select("*", { count: "exact", head: true })
          .ilike("title_normalized", comic.title.toLowerCase().trim())
          .eq("issue_number", comic.issue_number.trim())
          .neq("user_id", comic.profiles?.clerk_user_id || "");

        return {
          id: comic.id,
          title: comic.title,
          issueNumber: comic.issue_number,
          publisher: comic.publisher,
          coverImageUrl: comic.cover_image_url,
          grade: comic.grade,
          estimatedValue: comic.estimated_value,
          wantCount: count || 0,
          owner: {
            id: comic.profiles?.id,
            displayName: comic.profiles?.display_name || "Collector",
            username: comic.profiles?.username,
            rating: comic.profiles?.seller_rating,
            ratingCount: comic.profiles?.seller_rating_count,
            locationCity: comic.profiles?.location_city,
            locationState: comic.profiles?.location_state,
            locationCountry: comic.profiles?.location_country,
            locationPrivacy: comic.profiles?.location_privacy || "state_country",
          },
        };
      })
    );

    return NextResponse.json({ comics: comicsWithWantCount });
  } catch (error) {
    console.error("Error fetching tradeable comics:", error);
    return NextResponse.json({ error: "Failed to fetch tradeable comics" }, { status: 500 });
  }
}
