import { supabaseAdmin } from "@/lib/supabase";
import { firstJoined } from "./helpers";

// ============================================================================
// DATA HELPERS FOR EMAIL WIRING
// ============================================================================

export async function getProfileForEmail(
  userId: string
): Promise<{ email: string | null; displayName: string } | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("email, display_name, username")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    email: data.email ?? null,
    displayName: data.display_name || data.username || "Collector",
  };
}

// PostgREST returns embedded one-to-one joins as either a single object or an
// array depending on the relationship cardinality it infers. Type the joined
// shape explicitly instead of casting through `as any` (L-EM16).
type JoinedComicFields = { title: string | null; issue_number: string | null };
type ListingComicJoinRow = {
  starting_price: number | null;
  comics: JoinedComicFields | JoinedComicFields[] | null;
};

export async function getListingComicData(
  listingId: string
): Promise<{ comicTitle: string; issueNumber: string; price: number } | null> {
  // Qualify FK path to disambiguate from sold_via_auction_id (added in the
  // comic sold-tracking migration). Without the explicit hint, PostgREST
  // throws PGRST201 because auctions now has two FK paths to comics.
  const { data, error } = await supabaseAdmin
    .from("auctions")
    .select("starting_price, comics!auctions_comic_id_fkey(title, issue_number)")
    .eq("id", listingId)
    .maybeSingle<ListingComicJoinRow>();
  if (error) {
    console.error(`[getListingComicData] Supabase error for ${listingId}:`, error);
    return null;
  }
  if (!data) return null;
  const comic = firstJoined(data.comics);
  return {
    comicTitle: comic?.title || "Unknown",
    issueNumber: comic?.issue_number || "",
    price: data.starting_price || 0,
  };
}

/**
 * Look up a profile's ID by email. Used when callers don't have the ID
 * handy but we still want to gate on the recipient's preferences.
 * Returns null when the email isn't tied to a known profile (e.g., guest
 * or unsubscribed legacy account) - in which case gating is skipped.
 */
export async function resolveProfileIdByEmail(email: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    return data?.id ?? null;
  } catch {
    return null;
  }
}
