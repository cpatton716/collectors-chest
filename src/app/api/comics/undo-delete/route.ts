// src/app/api/comics/undo-delete/route.ts
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

    // Restore by clearing deleted_at
    const { data: comics, error: restoreError } = await supabase
      .from("comics")
      .update({ deleted_at: null })
      .in("id", comicIds)
      .eq("profile_id", profile.id)
      .not("deleted_at", "is", null)
      .select("id");

    if (restoreError) {
      console.error("Error restoring comics:", restoreError);
      return NextResponse.json({ error: "Failed to restore comics" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      restoredCount: comics?.length || 0,
      restoredIds: comics?.map((c) => c.id) || [],
    });
  } catch (error) {
    console.error("Undo delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
