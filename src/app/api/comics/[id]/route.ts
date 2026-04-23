import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getProfileByClerkId } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { schemas, validateParams } from "@/lib/validation";

const comicIdParamsSchema = z.object({
  id: schemas.uuid,
});

// DELETE - Remove comic from user's collection
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const rawParams = await params;
    const paramsValidated = validateParams(comicIdParamsSchema, rawParams);
    if (!paramsValidated.success) return paramsValidated.response;
    const { id } = paramsValidated.data;

    // Guard: sold comics live in the seller's read-only sold history.
    const { data: soldRow } = await supabase
      .from("comics")
      .select("sold_at")
      .eq("id", id)
      .eq("user_id", profile.id)
      .single();

    if (soldRow?.sold_at) {
      return NextResponse.json(
        {
          error: "comic_sold",
          message:
            "This comic has been sold and is part of your sold history. It cannot be deleted.",
        },
        { status: 409 }
      );
    }

    // Check for active shop listings before deletion
    const { data: activeListing } = await supabase
      .from("auctions")
      .select("id, status")
      .eq("comic_id", id)
      .in("status", ["active", "ended"])
      .limit(1)
      .single();

    if (activeListing) {
      return NextResponse.json(
        {
          error: "active_listing",
          message: "This comic has an active shop listing. Cancel the listing before removing it from your collection.",
          listingId: activeListing.id
        },
        { status: 409 }
      );
    }

    // Delete the comic, ensuring it belongs to the user
    const { error } = await supabase.from("comics").delete().eq("id", id).eq("user_id", profile.id);

    if (error) {
      console.error("Error deleting comic:", error);
      return NextResponse.json({ error: "Failed to delete comic" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting comic:", error);
    return NextResponse.json({ error: "Failed to delete comic" }, { status: 500 });
  }
}
