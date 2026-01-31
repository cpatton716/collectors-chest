import { NextRequest, NextResponse } from "next/server";

import { getAdminProfile } from "@/lib/adminAuth";
import { submitKeyInfo } from "@/lib/keyComicsDb";
import { recordContribution } from "@/lib/reputationDb";
import { supabase } from "@/lib/supabase";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST - Approve or reject custom key info
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // Check admin access
    const adminProfile = await getAdminProfile();
    if (!adminProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: comicId } = await context.params;
    const body = await request.json();
    const { action, reason } = body;

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Get the comic
    const { data: comic, error: fetchError } = await supabase
      .from("comics")
      .select("id, title, issue_number, publisher, key_info, custom_key_info, custom_key_info_status, user_id")
      .eq("id", comicId)
      .single();

    if (fetchError || !comic) {
      return NextResponse.json({ error: "Comic not found" }, { status: 404 });
    }

    if (comic.custom_key_info_status !== "pending") {
      return NextResponse.json({ error: "Custom key info already processed" }, { status: 400 });
    }

    if (action === "approve") {
      // Merge custom key info into the main key_info array
      const existingKeyInfo = comic.key_info || [];
      const customKeyInfo = comic.custom_key_info || [];
      const mergedKeyInfo = [...new Set([...existingKeyInfo, ...customKeyInfo])];

      // Update the comic
      const { error: updateError } = await supabase
        .from("comics")
        .update({
          key_info: mergedKeyInfo,
          custom_key_info: [], // Clear custom key info after merging
          custom_key_info_status: "approved",
        })
        .eq("id", comicId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Also submit to the global key_comics database
      // This creates a submission that's pre-approved
      if (comic.title && comic.issue_number && customKeyInfo.length > 0) {
        await submitKeyInfo(comic.user_id, {
          title: comic.title,
          issueNumber: comic.issue_number,
          publisher: comic.publisher,
          suggestedKeyInfo: customKeyInfo,
          notes: "Auto-submitted from approved custom key info",
        });
      }

      // Record community contribution for the user
      await recordContribution(comic.user_id, "key_info", comicId);

      return NextResponse.json({ success: true, action: "approved" });
    } else {
      // Reject - just clear the custom key info and update status
      const { error: updateError } = await supabase
        .from("comics")
        .update({
          custom_key_info: [], // Clear the rejected key info
          custom_key_info_status: "rejected",
        })
        .eq("id", comicId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // TODO: Optionally notify the user about rejection with reason

      return NextResponse.json({ success: true, action: "rejected", reason });
    }
  } catch (error) {
    console.error("Error processing custom key info:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
