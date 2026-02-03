// src/app/api/comics/bulk-update/route.ts
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getOrCreateProfile } from "@/lib/db";
import { supabase } from "@/lib/supabase";

type BulkUpdateField = "for_trade" | "is_sold";

interface BulkUpdateRequest {
  comicIds: string[];
  field: BulkUpdateField;
  value: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { comicIds, field, value }: BulkUpdateRequest = await request.json();

    if (!Array.isArray(comicIds) || comicIds.length === 0) {
      return NextResponse.json({ error: "Invalid comic IDs" }, { status: 400 });
    }

    const allowedFields: BulkUpdateField[] = ["for_trade", "is_sold"];
    if (!allowedFields.includes(field)) {
      return NextResponse.json({ error: "Invalid field" }, { status: 400 });
    }

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
