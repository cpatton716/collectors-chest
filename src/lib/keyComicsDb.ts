/**
 * Key Comics Database - Supabase-backed
 *
 * Provides fast key info lookups from the community-maintained database.
 * Falls back to the static curated list if database is unavailable.
 *
 * Features:
 * - Redis caching for fast lookups
 * - Fallback to static database
 * - Community contribution support
 */
import { createClient } from "@supabase/supabase-js";

import { createNotification } from "./auctionDb";
import { lookupKeyInfo as lookupKeyInfoStatic } from "./keyComicsDatabase";
import { recordContribution } from "./creatorCreditsDb";

// Supabase client for key info lookups
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase =
  supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

// Normalize title for database matching
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "") // Remove special chars except spaces
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Look up key info from the database with fallback to static file
 */
export async function lookupKeyInfoFromDb(
  title: string,
  issueNumber: string,
  releaseYear?: number | null
): Promise<string[] | null> {
  // Try database first
  if (supabase) {
    try {
      const normalizedTitle = normalizeTitle(title);

      const { data, error } = await supabase
        .from("key_comics")
        .select("key_info")
        .eq("title_normalized", normalizedTitle)
        .eq("issue_number", issueNumber)
        .single();

      if (!error && data?.key_info) {
        return data.key_info;
      }

      // Try without leading zeros
      if (issueNumber.startsWith("0")) {
        const cleanIssue = issueNumber.replace(/^0+/, "") || "0";
        const { data: data2 } = await supabase
          .from("key_comics")
          .select("key_info")
          .eq("title_normalized", normalizedTitle)
          .eq("issue_number", cleanIssue)
          .single();

        if (data2?.key_info) {
          return data2.key_info;
        }
      }
    } catch (error) {
      console.error("Error looking up key info from DB:", error);
      // Fall through to static lookup
    }
  }

  // Fallback to static database
  return lookupKeyInfoStatic(title, issueNumber, releaseYear);
}

/**
 * Check if a comic is a key comic (DB or static)
 */
export async function isKeyComicFromDb(title: string, issueNumber: string): Promise<boolean> {
  const keyInfo = await lookupKeyInfoFromDb(title, issueNumber);
  return keyInfo !== null && keyInfo.length > 0;
}

/**
 * Get key comics count from database
 */
export async function getKeyComicsCountFromDb(): Promise<number> {
  if (supabase) {
    try {
      const { count, error } = await supabase
        .from("key_comics")
        .select("*", { count: "exact", head: true });

      if (!error && count !== null) {
        return count;
      }
    } catch (error) {
      console.error("Error getting key comics count:", error);
    }
  }

  // Fallback to static count
  const { getKeyComicsCount } = await import("./keyComicsDatabase");
  return getKeyComicsCount();
}

// ==========================================
// Submission Functions
// ==========================================

interface KeyInfoSubmission {
  title: string;
  issueNumber: string;
  publisher?: string;
  releaseYear?: number;
  suggestedKeyInfo: string[];
  sourceUrl?: string;
  notes?: string;
}

/**
 * Submit a key info suggestion for moderation
 */
export async function submitKeyInfo(
  userId: string,
  submission: KeyInfoSubmission
): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!supabase) {
    return { success: false, error: "Database not available" };
  }

  try {
    // Check if this comic already has key info
    const existingKeyInfo = await lookupKeyInfoFromDb(submission.title, submission.issueNumber);

    // Check if there's already a pending submission for this comic
    const normalizedTitle = normalizeTitle(submission.title);
    const { data: pendingSubmission } = await supabase
      .from("key_info_submissions")
      .select("id")
      .eq("title_normalized", normalizedTitle)
      .eq("issue_number", submission.issueNumber)
      .eq("status", "pending")
      .single();

    if (pendingSubmission) {
      return {
        success: false,
        error: "A submission for this comic is already pending review",
      };
    }

    // Create the submission
    const { data, error } = await supabase
      .from("key_info_submissions")
      .insert({
        user_id: userId,
        title: submission.title,
        title_normalized: normalizedTitle,
        issue_number: submission.issueNumber,
        publisher: submission.publisher,
        release_year: submission.releaseYear,
        suggested_key_info: submission.suggestedKeyInfo,
        source_url: submission.sourceUrl,
        notes: existingKeyInfo
          ? `Adding to existing: ${existingKeyInfo.join(", ")}. ${submission.notes || ""}`
          : submission.notes,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error submitting key info:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  } catch (error) {
    console.error("Error submitting key info:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get pending submissions (for admin)
 */
export async function getPendingSubmissions(limit = 50): Promise<{
  submissions: Array<{
    id: string;
    userId: string;
    title: string;
    issueNumber: string;
    publisher?: string;
    suggestedKeyInfo: string[];
    sourceUrl?: string;
    notes?: string;
    createdAt: string;
  }>;
  error?: string;
}> {
  if (!supabase) {
    return { submissions: [], error: "Database not available" };
  }

  try {
    const { data, error } = await supabase
      .from("key_info_submissions")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      return { submissions: [], error: error.message };
    }

    return {
      submissions: (data || []).map((s) => ({
        id: s.id,
        userId: s.user_id,
        title: s.title,
        issueNumber: s.issue_number,
        publisher: s.publisher,
        suggestedKeyInfo: s.suggested_key_info,
        sourceUrl: s.source_url,
        notes: s.notes,
        createdAt: s.created_at,
      })),
    };
  } catch (error) {
    return {
      submissions: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get user's own submissions
 */
export async function getUserSubmissions(userId: string): Promise<{
  submissions: Array<{
    id: string;
    title: string;
    issueNumber: string;
    suggestedKeyInfo: string[];
    status: string;
    rejectionReason?: string;
    createdAt: string;
    reviewedAt?: string;
  }>;
  error?: string;
}> {
  if (!supabase) {
    return { submissions: [], error: "Database not available" };
  }

  try {
    const { data, error } = await supabase
      .from("key_info_submissions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return { submissions: [], error: error.message };
    }

    return {
      submissions: (data || []).map((s) => ({
        id: s.id,
        title: s.title,
        issueNumber: s.issue_number,
        suggestedKeyInfo: s.suggested_key_info,
        status: s.status,
        rejectionReason: s.rejection_reason,
        createdAt: s.created_at,
        reviewedAt: s.reviewed_at,
      })),
    };
  } catch (error) {
    return {
      submissions: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Approve a submission (admin only)
 */
export async function approveSubmission(
  submissionId: string,
  adminUserId: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: "Database not available" };
  }

  try {
    // Get the submission
    const { data: submission, error: fetchError } = await supabase
      .from("key_info_submissions")
      .select("*")
      .eq("id", submissionId)
      .single();

    if (fetchError || !submission) {
      return { success: false, error: "Submission not found" };
    }

    if (submission.status !== "pending") {
      return { success: false, error: "Submission already processed" };
    }

    // Check if this comic already exists in key_comics
    const { data: existing } = await supabase
      .from("key_comics")
      .select("id, key_info")
      .eq("title_normalized", submission.title_normalized)
      .eq("issue_number", submission.issue_number)
      .single();

    let keyComicId: string;

    if (existing) {
      // Merge the new key info with existing
      const mergedKeyInfo = [...new Set([...existing.key_info, ...submission.suggested_key_info])];

      const { error: updateError } = await supabase
        .from("key_comics")
        .update({
          key_info: mergedKeyInfo,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      keyComicId = existing.id;
    } else {
      // Create new key_comics entry
      const { data: newEntry, error: insertError } = await supabase
        .from("key_comics")
        .insert({
          title: submission.title,
          title_normalized: submission.title_normalized,
          issue_number: submission.issue_number,
          publisher: submission.publisher,
          key_info: submission.suggested_key_info,
          source: "community",
          contributed_by: submission.user_id,
        })
        .select("id")
        .single();

      if (insertError) {
        return { success: false, error: insertError.message };
      }

      keyComicId = newEntry.id;
    }

    // Update the submission status
    const { error: statusError } = await supabase
      .from("key_info_submissions")
      .update({
        status: "approved",
        reviewed_by: adminUserId,
        reviewed_at: new Date().toISOString(),
        merged_into: keyComicId,
      })
      .eq("id", submissionId);

    if (statusError) {
      return { success: false, error: statusError.message };
    }

    // Notify the submitter
    await createNotification(submission.user_id, "key_info_approved").catch(() => {});

    // Record community contribution for creator credits badge system
    await recordContribution(submission.user_id, "key_info", keyComicId).catch(() => {});

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Reject a submission (admin only)
 */
export async function rejectSubmission(
  submissionId: string,
  adminUserId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: "Database not available" };
  }

  try {
    // Get submission to find the submitter
    const { data: submission } = await supabase
      .from("key_info_submissions")
      .select("user_id")
      .eq("id", submissionId)
      .single();

    const { error } = await supabase
      .from("key_info_submissions")
      .update({
        status: "rejected",
        reviewed_by: adminUserId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq("id", submissionId)
      .eq("status", "pending");

    if (error) {
      return { success: false, error: error.message };
    }

    // Notify the submitter
    if (submission?.user_id) {
      await createNotification(submission.user_id, "key_info_rejected").catch(() => {});
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get submission counts (for admin dashboard)
 */
export async function getSubmissionCounts(): Promise<{
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}> {
  if (!supabase) {
    return { pending: 0, approved: 0, rejected: 0, total: 0 };
  }

  try {
    const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
      supabase
        .from("key_info_submissions")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("key_info_submissions")
        .select("*", { count: "exact", head: true })
        .eq("status", "approved"),
      supabase
        .from("key_info_submissions")
        .select("*", { count: "exact", head: true })
        .eq("status", "rejected"),
    ]);

    const pending = pendingRes.count || 0;
    const approved = approvedRes.count || 0;
    const rejected = rejectedRes.count || 0;

    return {
      pending,
      approved,
      rejected,
      total: pending + approved + rejected,
    };
  } catch (error) {
    console.error("Error getting submission counts:", error);
    return { pending: 0, approved: 0, rejected: 0, total: 0 };
  }
}

// ==========================================
// Admin CRUD Functions for key_comics
// ==========================================

/**
 * Search/list key_comics entries with pagination
 */
export async function searchKeyComics(params: {
  search?: string;
  source?: string;
  page?: number;
  limit?: number;
}): Promise<{
  entries: Array<{
    id: string;
    title: string;
    issueNumber: string;
    publisher: string | null;
    keyInfo: string[];
    source: string;
    contributedBy: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
  error?: string;
}> {
  if (!supabase) return { entries: [], total: 0, error: "Database not available" };

  const page = params.page || 1;
  const limit = params.limit || 25;
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from("key_comics")
      .select("*", { count: "exact" });

    if (params.search) {
      const normalized = normalizeTitle(params.search);
      query = query.ilike("title_normalized", `%${normalized}%`);
    }

    if (params.source) {
      query = query.eq("source", params.source);
    }

    const { data, count, error } = await query
      .order("title", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) return { entries: [], total: 0, error: error.message };

    return {
      entries: (data || []).map((e) => ({
        id: e.id,
        title: e.title,
        issueNumber: e.issue_number,
        publisher: e.publisher,
        keyInfo: e.key_info || [],
        source: e.source,
        contributedBy: e.contributed_by,
        createdAt: e.created_at,
        updatedAt: e.updated_at,
      })),
      total: count || 0,
    };
  } catch (error) {
    return {
      entries: [],
      total: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create a new key_comics entry
 */
export async function createKeyComic(params: {
  title: string;
  issueNumber: string;
  publisher?: string;
  keyInfo: string[];
}): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!supabase) return { success: false, error: "Database not available" };

  try {
    const normalizedTitle = normalizeTitle(params.title);

    // Check for duplicates
    const { data: existing } = await supabase
      .from("key_comics")
      .select("id")
      .eq("title_normalized", normalizedTitle)
      .eq("issue_number", params.issueNumber)
      .single();

    if (existing) {
      return { success: false, error: "An entry for this comic already exists" };
    }

    const { data, error } = await supabase
      .from("key_comics")
      .insert({
        title: params.title,
        title_normalized: normalizedTitle,
        issue_number: params.issueNumber,
        publisher: params.publisher || null,
        key_info: params.keyInfo,
        source: "curated",
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, id: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update a key_comics entry
 */
export async function updateKeyComic(
  id: string,
  params: {
    title?: string;
    issueNumber?: string;
    publisher?: string;
    keyInfo?: string[];
  }
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: "Database not available" };

  try {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (params.title !== undefined) {
      updateData.title = params.title;
      updateData.title_normalized = normalizeTitle(params.title);
    }
    if (params.issueNumber !== undefined) updateData.issue_number = params.issueNumber;
    if (params.publisher !== undefined) updateData.publisher = params.publisher;
    if (params.keyInfo !== undefined) updateData.key_info = params.keyInfo;

    const { error } = await supabase
      .from("key_comics")
      .update(updateData)
      .eq("id", id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete a key_comics entry
 */
export async function deleteKeyComic(
  id: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: "Database not available" };

  try {
    const { error } = await supabase
      .from("key_comics")
      .delete()
      .eq("id", id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
