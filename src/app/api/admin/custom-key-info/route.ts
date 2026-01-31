import { NextResponse } from "next/server";

import { getAdminProfile } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

// GET - Get comics with pending custom key info
export async function GET() {
  try {
    // Check admin access
    const adminProfile = await getAdminProfile();
    if (!adminProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get comics with pending custom key info
    const { data: comics, error } = await supabase
      .from("comics")
      .select(`
        id,
        title,
        issue_number,
        publisher,
        cover_image_url,
        key_info,
        custom_key_info,
        custom_key_info_status,
        user_id,
        created_at
      `)
      .eq("custom_key_info_status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) {
      console.error("Error fetching pending custom key info:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get counts for stats
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      supabase
        .from("comics")
        .select("*", { count: "exact", head: true })
        .eq("custom_key_info_status", "pending"),
      supabase
        .from("comics")
        .select("*", { count: "exact", head: true })
        .eq("custom_key_info_status", "approved"),
      supabase
        .from("comics")
        .select("*", { count: "exact", head: true })
        .eq("custom_key_info_status", "rejected"),
    ]);

    return NextResponse.json({
      comics: (comics || []).map((c) => ({
        id: c.id,
        title: c.title,
        issueNumber: c.issue_number,
        publisher: c.publisher,
        coverImageUrl: c.cover_image_url,
        existingKeyInfo: c.key_info || [],
        customKeyInfo: c.custom_key_info || [],
        userId: c.user_id,
        createdAt: c.created_at,
      })),
      counts: {
        pending: pendingCount.count || 0,
        approved: approvedCount.count || 0,
        rejected: rejectedCount.count || 0,
      },
    });
  } catch (error) {
    console.error("Error in custom key info admin API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
