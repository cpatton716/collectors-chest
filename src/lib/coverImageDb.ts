import { supabaseAdmin } from "./supabase";
import { normalizeTitle, normalizeIssueNumber } from "./normalizeTitle";
import { saveComicMetadata } from "./db";

// --- Pure helpers (exported for testing) ---

export function buildCoverLookupKey(title: string, issue: string): string {
  return `${normalizeTitle(title)}|${normalizeIssueNumber(issue)}`;
}

// --- Database functions ---

export interface CoverImage {
  id: string;
  title_normalized: string;
  issue_number: string;
  image_url: string;
  submitted_by: string | null;
  approved_by: string | null;
  status: "pending" | "approved" | "rejected";
  source_query: string | null;
  created_at: string;
  approved_at: string | null;
}

/**
 * Look up an approved community cover for a comic.
 * Returns the image URL if found, null otherwise.
 */
export async function getCommunityCovers(
  title: string,
  issueNumber: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("cover_images")
    .select("image_url")
    .eq("title_normalized", normalizeTitle(title))
    .eq("issue_number", normalizeIssueNumber(issueNumber))
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data.image_url;
}

/**
 * Submit a cover image to the community database.
 * Auto-approved covers (single match) get status='approved'.
 * Multi-match covers get status='pending' for admin review.
 */
export async function submitCoverImage(params: {
  title: string;
  issueNumber: string;
  imageUrl: string;
  submittedBy: string;
  sourceQuery: string;
  autoApprove: boolean;
}): Promise<{ id: string; status: string }> {
  const status = params.autoApprove ? "approved" : "pending";
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("cover_images")
    .insert({
      title_normalized: normalizeTitle(params.title),
      issue_number: normalizeIssueNumber(params.issueNumber),
      image_url: params.imageUrl,
      submitted_by: params.submittedBy,
      status,
      source_query: params.sourceQuery,
      approved_by: params.autoApprove ? params.submittedBy : null,
      approved_at: params.autoApprove ? now : null,
    })
    .select("id, status")
    .single();

  if (error) throw new Error(`Failed to submit cover: ${error.message}`);
  return data;
}

/**
 * Get pending cover submissions for admin review.
 */
export async function getPendingCovers(
  page = 1,
  limit = 20
): Promise<{ covers: CoverImage[]; total: number }> {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabaseAdmin
    .from("cover_images")
    .select("*", { count: "exact" })
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(`Failed to fetch covers: ${error.message}`);
  return { covers: (data as CoverImage[]) || [], total: count || 0 };
}

/**
 * Admin approves a cover — sets status to approved, records approver.
 */
export async function approveCover(
  coverId: string,
  adminId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("cover_images")
    .update({
      status: "approved",
      approved_by: adminId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", coverId);

  if (error) throw new Error(`Failed to approve cover: ${error.message}`);

  // Sync to comic_metadata so the pipeline uses this cover immediately
  const { data: coverRow } = await supabaseAdmin
    .from("cover_images")
    .select("title_normalized, issue_number, image_url")
    .eq("id", coverId)
    .single();

  if (coverRow) {
    // @ts-expect-error — coverSource and coverValidated added in Task 4
    await saveComicMetadata({
      title: coverRow.title_normalized,
      issueNumber: coverRow.issue_number,
      coverImageUrl: coverRow.image_url,
      coverSource: "community",
      coverValidated: true,
    });
  }
}

/**
 * Admin rejects a cover — stays private to submitter.
 */
export async function rejectCover(coverId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("cover_images")
    .update({ status: "rejected" })
    .eq("id", coverId);

  if (error) throw new Error(`Failed to reject cover: ${error.message}`);
}
