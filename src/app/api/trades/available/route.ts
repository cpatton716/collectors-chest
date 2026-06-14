import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getProfileByClerkId } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

// Raw row shape for a for-trade comic with its joined owner profile. Comic
// fields are nullable so we surface (and guard) bad data instead of crashing
// on `.toLowerCase()` / `.trim()` of an undefined title or issue number.
interface ForTradeOwnerRow {
  id: string;
  clerk_user_id: string | null;
  display_name: string | null;
  username: string | null;
  positive_ratings: number | null;
  negative_ratings: number | null;
  location_city: string | null;
  location_state: string | null;
  location_country: string | null;
  location_privacy: string | null;
}

interface ForTradeComicRow {
  id: string;
  title: string | null;
  issue_number: string | null;
  publisher: string | null;
  cover_image_url: string | null;
  grade: string | null;
  estimated_value: number | null;
  user_id: string;
  profiles: ForTradeOwnerRow | null;
}

const MAX_TRADEABLE = 100;

// GET - Get all comics marked for trade (excluding user's own)
export async function GET(_request: NextRequest) {
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
          positive_ratings,
          negative_ratings,
          location_city,
          location_state,
          location_country,
          location_privacy
        )
      `
      )
      .eq("for_trade", true)
      .order("updated_at", { ascending: false })
      .limit(MAX_TRADEABLE);

    // Exclude current user's comics
    if (excludeUserId) {
      query = query.neq("user_id", excludeUserId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const comics = (data || []) as unknown as ForTradeComicRow[];

    // Compute want-counts in parallel. Skip comics missing title/issue (can't
    // match a hunt list) and guard nullable fields before string operations.
    const comicsWithWantCount = await Promise.all(
      comics.map(async (comic) => {
        const title = comic.title?.trim();
        const issue = comic.issue_number?.trim();
        const owner = comic.profiles;

        let wantCount = 0;
        if (title && issue) {
          const { count } = await supabaseAdmin
            .from("key_hunt_lists")
            .select("*", { count: "exact", head: true })
            .ilike("title_normalized", title.toLowerCase())
            .eq("issue_number", issue)
            .neq("user_id", owner?.clerk_user_id || "");
          wantCount = count || 0;
        }

        return {
          id: comic.id,
          title: comic.title ?? "Unknown Title",
          issueNumber: comic.issue_number ?? "",
          publisher: comic.publisher ?? "",
          coverImageUrl: comic.cover_image_url ?? undefined,
          grade: comic.grade ?? undefined,
          estimatedValue: comic.estimated_value ?? undefined,
          wantCount,
          owner: {
            id: owner?.id,
            displayName: owner?.display_name || "Collector",
            username: owner?.username,
            positiveRatings: owner?.positive_ratings || 0,
            negativeRatings: owner?.negative_ratings || 0,
            ratingCount: (owner?.positive_ratings || 0) + (owner?.negative_ratings || 0),
            locationCity: owner?.location_city,
            locationState: owner?.location_state,
            locationCountry: owner?.location_country,
            locationPrivacy: owner?.location_privacy || "state_country",
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
