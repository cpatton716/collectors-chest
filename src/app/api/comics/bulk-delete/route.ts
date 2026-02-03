// src/app/api/comics/bulk-delete/route.ts
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getOrCreateProfile } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { comicIds } = await request.json();

    if (!Array.isArray(comicIds) || comicIds.length === 0) {
      return NextResponse.json({ error: "Invalid comic IDs" }, { status: 400 });
    }

    // Get user's profile
    const profile = await getOrCreateProfile(userId);

    // Verify ownership and soft delete
    const { data: comics, error: fetchError } = await supabase
      .from("comics")
      .select("id")
      .in("id", comicIds)
      .eq("profile_id", profile.id)
      .is("deleted_at", null);

    if (fetchError) {
      console.error("Error fetching comics:", fetchError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const ownedIds = comics?.map((c) => c.id) || [];

    if (ownedIds.length === 0) {
      return NextResponse.json({ error: "No comics found to delete" }, { status: 404 });
    }

    // Soft delete by setting deleted_at
    const { error: deleteError } = await supabase
      .from("comics")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", ownedIds);

    if (deleteError) {
      console.error("Error deleting comics:", deleteError);
      return NextResponse.json({ error: "Failed to delete comics" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deletedCount: ownedIds.length,
      deletedIds: ownedIds,
    });
  } catch (error) {
    console.error("Bulk delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
