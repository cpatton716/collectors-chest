import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { logAdminAction } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { schemas, validateBody, validateQuery } from "@/lib/validation";

const listQuerySchema = z.object({
  status: z.enum(["pending", "approved", "corrected", "rejected"]).optional().default("pending"),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

const patchSchema = z
  .object({
    reviewId: schemas.uuid,
    action: z.enum(["approve", "correct", "reject"]),
    correctedUpc: z.string().min(1).max(32).optional(),
    adminNotes: z.string().max(2000).optional(),
  })
  .refine((v) => v.action !== "correct" || !!v.correctedUpc, {
    message: "correctedUpc is required for correction",
    path: ["correctedUpc"],
  });

// Check if user is admin
async function isAdmin(clerkUserId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("clerk_user_id", clerkUserId)
    .single();

  return data?.is_admin === true;
}

// GET: Fetch pending barcode reviews
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isUserAdmin = await isAdmin(userId);
    if (!isUserAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const queryResult = validateQuery(listQuerySchema, searchParams);
    if (!queryResult.success) return queryResult.response;
    const { status, page, limit } = queryResult.data;
    const offset = (page - 1) * limit;

    // Get reviews with pagination
    const { data: reviews, error, count } = await supabaseAdmin
      .from("admin_barcode_reviews")
      .select("*", { count: "exact" })
      .eq("status", status)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching barcode reviews:", error);
      return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
    }

    return NextResponse.json({
      reviews: reviews || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error in barcode reviews GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH: Update a barcode review (approve, correct, reject)
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isUserAdmin = await isAdmin(userId);
    if (!isUserAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const validated = validateBody(patchSchema, body);
    if (!validated.success) return validated.response;
    const { reviewId, action, correctedUpc, adminNotes } = validated.data;

    // Get admin's profile ID
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("clerk_user_id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get the review
    const { data: review } = await supabaseAdmin
      .from("admin_barcode_reviews")
      .select("*, barcode_catalog_id")
      .eq("id", reviewId)
      .single();

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    // "correct" is guaranteed to carry a correctedUpc thanks to the Zod refine.
    const parsed = action === "correct" ? parseBarcode(correctedUpc!) : null;

    // M-SC14: the review + catalog writes must be atomic -- a half-applied
    // review (e.g. review marked approved but catalog still pending, or a
    // rejected review with the catalog row still present) corrupts the queue.
    // Route them through the transactional `review_barcode(...)` RPC. The RPC
    // is migration-gated; until it lands we fall back to per-write error checks
    // so a failed write aborts the request instead of silently half-applying.
    const writeError = await applyBarcodeReview({
      reviewId,
      action,
      resolvedBy: profile.id,
      adminNotes: adminNotes || null,
      correctedUpc: correctedUpc ?? null,
      parsed,
      barcodeCatalogId: review.barcode_catalog_id,
      now,
    });

    if (writeError) {
      console.error("Barcode review write failed:", writeError);
      return NextResponse.json({ error: "Failed to apply review" }, { status: 500 });
    }

    if (action === "approve") {
      await logAdminAction(profile.id, "approve_barcode", undefined, {
        reviewId,
        barcodeCatalogId: review.barcode_catalog_id,
      });
    } else if (action === "correct") {
      // "Correct" resolves the barcode to an approved (corrected) state; log it
      // as an approval with the corrected UPC captured in details.
      await logAdminAction(profile.id, "approve_barcode", undefined, {
        reviewId,
        barcodeCatalogId: review.barcode_catalog_id,
        corrected: true,
        correctedUpc,
      });
    } else if (action === "reject") {
      await logAdminAction(profile.id, "reject_barcode", undefined, {
        reviewId,
        barcodeCatalogId: review.barcode_catalog_id,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in barcode reviews PATCH:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

type ParsedBarcode = ReturnType<typeof parseBarcode>;

interface BarcodeReviewWrite {
  reviewId: string;
  action: "approve" | "correct" | "reject";
  resolvedBy: string;
  adminNotes: string | null;
  correctedUpc: string | null;
  parsed: ParsedBarcode;
  barcodeCatalogId: string;
  now: string;
}

/**
 * True when a Postgres error indicates the RPC function does not exist yet
 * (pre-migration). PostgREST surfaces this as code "42883" (undefined_function)
 * or "PGRST202" (no matching function in schema cache). Pure + exported so the
 * RPC-missing → fallback decision is unit-testable (M-SC14).
 */
export function isMissingFunctionError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42883" || error.code === "PGRST202") return true;
  return /review_barcode|function .* does not exist|could not find the function/i.test(
    error.message || ""
  );
}

/**
 * Apply the paired review + catalog writes for a barcode review.
 *
 * Primary path: the transactional `review_barcode(...)` RPC (atomic). Fallback
 * (until the migration lands): per-write error checks -- the first failed write
 * short-circuits and is returned so the caller aborts the request rather than
 * leaving the queue half-applied.
 *
 * Returns null on success, or the failing error otherwise.
 */
async function applyBarcodeReview(
  w: BarcodeReviewWrite
): Promise<{ code?: string; message?: string } | null> {
  // 1) Transactional RPC (migration-gated).
  const { error: rpcError } = await supabaseAdmin.rpc("review_barcode", {
    p_review_id: w.reviewId,
    p_action: w.action,
    p_resolved_by: w.resolvedBy,
    p_admin_notes: w.adminNotes,
    p_corrected_upc: w.correctedUpc,
    p_upc_prefix: w.parsed?.upcPrefix ?? null,
    p_item_number: w.parsed?.itemNumber ?? null,
    p_check_digit: w.parsed?.checkDigit ?? null,
    p_addon_issue: w.parsed?.addonIssue ?? null,
    p_addon_variant: w.parsed?.addonVariant ?? null,
    p_barcode_catalog_id: w.barcodeCatalogId,
  });

  if (!rpcError) {
    return null;
  }
  // A real RPC failure (not "function missing") must abort -- don't double-apply.
  if (!isMissingFunctionError(rpcError)) {
    return rpcError;
  }

  // 2) Pre-migration fallback: per-write paths with error checks.
  return applyBarcodeReviewFallback(w);
}

async function applyBarcodeReviewFallback(
  w: BarcodeReviewWrite
): Promise<{ code?: string; message?: string } | null> {
  if (w.action === "approve") {
    const { error: reviewErr } = await supabaseAdmin
      .from("admin_barcode_reviews")
      .update({
        status: "approved",
        admin_notes: w.adminNotes,
        resolved_at: w.now,
        resolved_by: w.resolvedBy,
      })
      .eq("id", w.reviewId);
    if (reviewErr) return reviewErr;

    const { error: catalogErr } = await supabaseAdmin
      .from("barcode_catalog")
      .update({
        status: "approved",
        reviewed_by: w.resolvedBy,
        reviewed_at: w.now,
      })
      .eq("id", w.barcodeCatalogId);
    if (catalogErr) return catalogErr;
    return null;
  }

  if (w.action === "correct") {
    const { error: reviewErr } = await supabaseAdmin
      .from("admin_barcode_reviews")
      .update({
        status: "corrected",
        corrected_upc: w.correctedUpc,
        admin_notes: w.adminNotes,
        resolved_at: w.now,
        resolved_by: w.resolvedBy,
      })
      .eq("id", w.reviewId);
    if (reviewErr) return reviewErr;

    const { error: catalogErr } = await supabaseAdmin
      .from("barcode_catalog")
      .update({
        raw_barcode: w.correctedUpc,
        upc_prefix: w.parsed?.upcPrefix || null,
        item_number: w.parsed?.itemNumber || null,
        check_digit: w.parsed?.checkDigit || null,
        addon_issue: w.parsed?.addonIssue || null,
        addon_variant: w.parsed?.addonVariant || null,
        status: "approved",
        reviewed_by: w.resolvedBy,
        reviewed_at: w.now,
      })
      .eq("id", w.barcodeCatalogId);
    if (catalogErr) return catalogErr;
    return null;
  }

  // action === "reject"
  const { error: reviewErr } = await supabaseAdmin
    .from("admin_barcode_reviews")
    .update({
      status: "rejected",
      admin_notes: w.adminNotes,
      resolved_at: w.now,
      resolved_by: w.resolvedBy,
    })
    .eq("id", w.reviewId);
  if (reviewErr) return reviewErr;

  const { error: catalogErr } = await supabaseAdmin
    .from("barcode_catalog")
    .delete()
    .eq("id", w.barcodeCatalogId);
  if (catalogErr) return catalogErr;
  return null;
}

// Helper function to parse barcode into components
function parseBarcode(barcode: string) {
  const cleanBarcode = barcode.replace(/\D/g, "");

  if (cleanBarcode.length < 12) {
    return null;
  }

  return {
    upcPrefix: cleanBarcode.slice(0, 5),
    itemNumber: cleanBarcode.slice(5, 11),
    checkDigit: cleanBarcode.slice(11, 12),
    addonIssue: cleanBarcode.length >= 15 ? cleanBarcode.slice(12, 15) : undefined,
    addonVariant: cleanBarcode.length >= 17 ? cleanBarcode.slice(15, 17) : undefined,
  };
}
