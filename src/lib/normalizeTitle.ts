/** For comic_metadata/cover_images DB queries only. Do NOT use for key comics matching. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeIssueNumber(issue: string): string {
  return issue
    .toLowerCase()
    .trim()
    .replace(/#/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize a title for matching against the `key_comics` / `key_info_submissions`
 * tables' `title_normalized` column.
 *
 * This MUST mirror the Postgres `normalize_comic_title()` trigger
 * (supabase/migrations/20250117_key_info_community.sql):
 *   lower → strip `[^a-zA-Z0-9\s]` → collapse whitespace → trim.
 *
 * Single source of truth so keyComicsDb.ts queries always produce the same
 * key the DB stored. See M-PR7. (The static in-memory key DB in
 * keyComicsDatabase.ts intentionally uses a *different*, more aggressive
 * normalizer — it also drops leading "The" and hyphens for fuzzy map lookups —
 * so it is NOT consolidated here.)
 */
export function normalizeKeyComicTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "") // Remove special chars except spaces (matches SQL trigger)
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}
