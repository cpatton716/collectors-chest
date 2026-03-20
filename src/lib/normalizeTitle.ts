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
