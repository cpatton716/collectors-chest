// src/app/api/comics/bulk-update/route.ts
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getOrCreateProfile } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { schemas, validateBody } from "@/lib/validation";

const bulkUpdateSchema = z.object({
  comicIds: z.array(schemas.uuid).min(1, "At least one comic ID is required").max(500),
  field: z.enum(["for_trade", "is_sold"]),
  value: z.boolean(),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await request.json().catch(() => null);
    const validated = validateBody(bulkUpdateSchema, rawBody);
    if (!validated.success) return validated.response;
    const { comicIds, field, value } = validated.data;

    // Get user's profile
    const profile = await getOrCreateProfile(userId);

    // Verify ownership and update
    const { data: comics, error: fetchError } = await supabase
      .from("comics")
      .select("id")
      .in("id", comicIds)
      .eq("user_id", profile.id)
      .is("deleted_at", null);

    if (fetchError) {
      console.error("Error fetching comics:", fetchError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const ownedIds = comics?.map((c) => c.id) || [];

    if (ownedIds.length === 0) {
      return NextResponse.json({ error: "No comics found to update" }, { status: 404 });
    }

    // Build update object
    const updateData: Record<string, unknown> = { [field]: value };

    // If marking as sold, also set sold_at timestamp
    if (field === "is_sold" && value) {
      updateData.sold_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("comics")
      .update(updateData)
      .in("id", ownedIds);

    if (updateError) {
      console.error("Error updating comics:", updateError);
      return NextResponse.json({ error: "Failed to update comics" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updatedCount: ownedIds.length,
      updatedIds: ownedIds,
    });
  } catch (error) {
    console.error("Bulk update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
