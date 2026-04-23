import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

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

    if (action === "approve") {
      // Update review status
      await supabaseAdmin
        .from("admin_barcode_reviews")
        .update({
          status: "approved",
          admin_notes: adminNotes || null,
          resolved_at: now,
          resolved_by: profile.id,
        })
        .eq("id", reviewId);

      // Update catalog entry status
      await supabaseAdmin
        .from("barcode_catalog")
        .update({
          status: "approved",
          reviewed_by: profile.id,
          reviewed_at: now,
        })
        .eq("id", review.barcode_catalog_id);

    } else if (action === "correct") {
      // correctedUpc is guaranteed present here thanks to the Zod refine above.
      // Parse corrected UPC
      const parsed = parseBarcode(correctedUpc!);

      // Update review status with correction
      await supabaseAdmin
        .from("admin_barcode_reviews")
        .update({
          status: "corrected",
          corrected_upc: correctedUpc,
          admin_notes: adminNotes || null,
          resolved_at: now,
          resolved_by: profile.id,
        })
        .eq("id", reviewId);

      // Update catalog entry with corrected data
      await supabaseAdmin
        .from("barcode_catalog")
        .update({
          raw_barcode: correctedUpc!,
          upc_prefix: parsed?.upcPrefix || null,
          item_number: parsed?.itemNumber || null,
          check_digit: parsed?.checkDigit || null,
          addon_issue: parsed?.addonIssue || null,
          addon_variant: parsed?.addonVariant || null,
          status: "approved",
          reviewed_by: profile.id,
          reviewed_at: now,
        })
        .eq("id", review.barcode_catalog_id);

    } else if (action === "reject") {
      // Update review status
      await supabaseAdmin
        .from("admin_barcode_reviews")
        .update({
          status: "rejected",
          admin_notes: adminNotes || null,
          resolved_at: now,
          resolved_by: profile.id,
        })
        .eq("id", reviewId);

      // Delete the catalog entry (rejected = barcode not valid)
      await supabaseAdmin
        .from("barcode_catalog")
        .delete()
        .eq("id", review.barcode_catalog_id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in barcode reviews PATCH:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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
