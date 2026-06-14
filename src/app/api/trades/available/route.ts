import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getProfileByClerkId } from "@/lib/db";
import { normalizeTitle } from "@/lib/normalizeTitle";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Build the per-comic "want count" map from a single batched key_hunt_lists
 * fetch. Counts, for each tradeable comic, how many OTHER users (not the comic
 * owner) have a matching (normalized title, trimmed issue) hunt-list entry.
 *
 * Replaces the previous N+1 (one `count` query per comic). Pure + exported so
 * the tally logic is unit-tested without a live DB.
 *
 * Matching mirrors the DB equality predicates (and the functional indexes added
 * in the closeout migration): `title_normalized` is stored normalized, so we
 * compare against `normalizeTitle(title)` and the trimmed issue number.
 */
export interface HuntListRow {
  user_id: string | null;
  title_normalized: string | null;
  issue_number: string | null;
}

export interface WantCountComic {
  id: string;
  title: string | null;
  issue_number: string | null;
  ownerClerkId: string | null;
}

export function tallyWantCounts(
  comics: WantCountComic[],
  huntRows: HuntListRow[]
): Map<string, number> {
  // Index hunt-list entries by their match key -> set of distinct wanter ids.
  // A user wanting the same book twice (data quirk) is counted once.
  const wantersByKey = new Map<string, Set<string>>();
  for (const row of huntRows) {
    const title = row.title_normalized?.trim();
    const issue = row.issue_number?.trim();
    const wanter = row.user_id;
    if (!title || !issue || !wanter) continue;
    const key = `${title}|${issue}`;
    let set = wantersByKey.get(key);
    if (!set) {
      set = new Set<string>();
      wantersByKey.set(key, set);
    }
    set.add(wanter);
  }

  const result = new Map<string, number>();
  for (const comic of comics) {
    const title = comic.title?.trim();
    const issue = comic.issue_number?.trim();
    if (!title || !issue) {
      result.set(comic.id, 0);
      continue;
    }
    const key = `${normalizeTitle(title)}|${issue}`;
    const wanters = wantersByKey.get(key);
    if (!wanters) {
      result.set(comic.id, 0);
      continue;
    }
    // Exclude the comic's own owner from the want count.
    const ownerClerkId = comic.ownerClerkId;
    let count = 0;
    for (const wanter of wanters) {
      if (wanter !== ownerClerkId) count += 1;
    }
    result.set(comic.id, count);
  }
  return result;
}

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

    // Want-counts (H-MK4): one batched fetch of matching key_hunt_lists rows,
    // then tally in JS. Replaces the previous N+1 (one `count` query per comic).
    // Build the distinct set of (normalized title, trimmed issue) keys to fetch,
    // and use `.eq` on the normalized column (the closeout migration's composite
    // functional index on key_hunt_lists supports this equality lookup).
    const distinctTitles = new Set<string>();
    const distinctIssues = new Set<string>();
    for (const comic of comics) {
      const title = comic.title?.trim();
      const issue = comic.issue_number?.trim();
      if (title && issue) {
        distinctTitles.add(normalizeTitle(title));
        distinctIssues.add(issue);
      }
    }

    let huntRows: HuntListRow[] = [];
    if (distinctTitles.size > 0 && distinctIssues.size > 0) {
      // Over-fetch by the (title, issue) cross-product then narrow precisely in
      // JS via tallyWantCounts (exact key match per comic). The `.in()` filters
      // keep the scan bounded by the page's distinct titles/issues.
      const { data: hunts } = await supabaseAdmin
        .from("key_hunt_lists")
        .select("user_id, title_normalized, issue_number")
        .in("title_normalized", Array.from(distinctTitles))
        .in("issue_number", Array.from(distinctIssues));
      huntRows = (hunts || []) as HuntListRow[];
    }

    const wantCountMap = tallyWantCounts(
      comics.map((c) => ({
        id: c.id,
        title: c.title,
        issue_number: c.issue_number,
        ownerClerkId: c.profiles?.clerk_user_id ?? null,
      })),
      huntRows
    );

    const comicsWithWantCount = comics.map((comic) => {
      const owner = comic.profiles;
      return {
        id: comic.id,
        title: comic.title ?? "Unknown Title",
        issueNumber: comic.issue_number ?? "",
        publisher: comic.publisher ?? "",
        coverImageUrl: comic.cover_image_url ?? undefined,
        grade: comic.grade ?? undefined,
        estimatedValue: comic.estimated_value ?? undefined,
        wantCount: wantCountMap.get(comic.id) ?? 0,
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
    });

    return NextResponse.json({ comics: comicsWithWantCount });
  } catch (error) {
    console.error("Error fetching tradeable comics:", error);
    return NextResponse.json({ error: "Failed to fetch tradeable comics" }, { status: 500 });
  }
}
