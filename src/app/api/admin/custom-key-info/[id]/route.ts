import { NextRequest, NextResponse } from "next/server";

import { getAdminProfile } from "@/lib/adminAuth";
import { createNotification } from "@/lib/auctionDb";
import { submitKeyInfo } from "@/lib/keyComicsDb";
import { recordContribution } from "@/lib/creatorCreditsDb";
import { supabase } from "@/lib/supabase";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST - Approve or reject custom key info (supports per-item decisions)
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // Check admin access
    const adminProfile = await getAdminProfile();
    if (!adminProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: comicId } = await context.params;
    const body = await request.json();

    // Support both legacy (action: "approve"/"reject") and new per-item format (decisions: { fact: "approve"|"reject" })
    const { action, reason, decisions } = body;

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

    // Per-item decisions: { "First Appearance of X": "approve", "Some Wrong Fact": "reject" }
    if (decisions && typeof decisions === "object") {
      const existingKeyInfo = comic.key_info || [];
      const approved: string[] = [];
      const rejected: string[] = [];

      for (const [fact, decision] of Object.entries(decisions)) {
        if (decision === "approve") {
          approved.push(fact);
        } else {
          rejected.push(fact);
        }
      }

      const mergedKeyInfo = [...new Set([...existingKeyInfo, ...approved])];
      const status = approved.length > 0 && rejected.length > 0
        ? "partially_approved"
        : approved.length > 0
          ? "approved"
          : "rejected";

      const { error: updateError } = await supabase
        .from("comics")
        .update({
          key_info: mergedKeyInfo,
          custom_key_info: [],
          custom_key_info_status: status,
        })
        .eq("id", comicId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Submit approved facts to global key_comics database
      if (approved.length > 0 && comic.title && comic.issue_number) {
        await submitKeyInfo(comic.user_id, {
          title: comic.title,
          issueNumber: comic.issue_number,
          publisher: comic.publisher,
          suggestedKeyInfo: approved,
          notes: "Auto-submitted from approved custom key info",
        });

        await recordContribution(comic.user_id, "key_info", comicId);
        await createNotification(comic.user_id, "key_info_approved").catch(() => {});
      } else if (rejected.length > 0 && approved.length === 0) {
        await createNotification(comic.user_id, "key_info_rejected").catch(() => {});
      }

      return NextResponse.json({
        success: true,
        approved: approved.length,
        rejected: rejected.length,
        status,
      });
    }

    // Legacy: single action for all items
    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (action === "approve") {
      const existingKeyInfo = comic.key_info || [];
      const customKeyInfo = comic.custom_key_info || [];
      const mergedKeyInfo = [...new Set([...existingKeyInfo, ...customKeyInfo])];

      const { error: updateError } = await supabase
        .from("comics")
        .update({
          key_info: mergedKeyInfo,
          custom_key_info: [],
          custom_key_info_status: "approved",
        })
        .eq("id", comicId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      if (comic.title && comic.issue_number && customKeyInfo.length > 0) {
        await submitKeyInfo(comic.user_id, {
          title: comic.title,
          issueNumber: comic.issue_number,
          publisher: comic.publisher,
          suggestedKeyInfo: customKeyInfo,
          notes: "Auto-submitted from approved custom key info",
        });
      }

      await recordContribution(comic.user_id, "key_info", comicId);
      await createNotification(comic.user_id, "key_info_approved").catch(() => {});

      return NextResponse.json({ success: true, action: "approved" });
    } else {
      const { error: updateError } = await supabase
        .from("comics")
        .update({
          custom_key_info: [],
          custom_key_info_status: "rejected",
        })
        .eq("id", comicId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      await createNotification(comic.user_id, "key_info_rejected").catch(() => {});

      return NextResponse.json({ success: true, action: "rejected", reason });
    }
  } catch (error) {
    console.error("Error processing custom key info:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
