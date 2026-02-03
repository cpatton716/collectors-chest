// src/app/api/comics/bulk-add-to-list/route.ts
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

    const { comicIds, listId } = await request.json();

    if (!Array.isArray(comicIds) || comicIds.length === 0) {
      return NextResponse.json({ error: "Invalid comic IDs" }, { status: 400 });
    }

    if (!listId) {
      return NextResponse.json({ error: "List ID required" }, { status: 400 });
    }

    // Get user's profile
    const profile = await getOrCreateProfile(userId);

    // Verify list ownership
    const { data: list, error: listError } = await supabase
      .from("lists")
      .select("id")
      .eq("id", listId)
      .eq("profile_id", profile.id)
      .single();

    if (listError || !list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    // Verify comic ownership
    const { data: comics, error: comicsError } = await supabase
      .from("comics")
      .select("id")
      .in("id", comicIds)
      .eq("profile_id", profile.id)
      .is("deleted_at", null);

    if (comicsError) {
      console.error("Error fetching comics:", comicsError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const ownedIds = comics?.map((c) => c.id) || [];

    if (ownedIds.length === 0) {
      return NextResponse.json({ error: "No comics found" }, { status: 404 });
    }

    // Get existing list memberships to avoid duplicates
    const { data: existing } = await supabase
      .from("comic_lists")
      .select("comic_id")
      .eq("list_id", listId)
      .in("comic_id", ownedIds);

    const existingIds = new Set(existing?.map((e) => e.comic_id) || []);
    const newIds = ownedIds.filter((id) => !existingIds.has(id));

    if (newIds.length === 0) {
      return NextResponse.json({
        success: true,
        addedCount: 0,
        message: "All comics already in list",
      });
    }

    // Add to list
    const { error: insertError } = await supabase.from("comic_lists").insert(
      newIds.map((comicId) => ({
        comic_id: comicId,
        list_id: listId,
      }))
    );

    if (insertError) {
      console.error("Error adding to list:", insertError);
      return NextResponse.json({ error: "Failed to add to list" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      addedCount: newIds.length,
      skippedCount: existingIds.size,
    });
  } catch (error) {
    console.error("Bulk add to list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
