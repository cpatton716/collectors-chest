import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getProfileByClerkId } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

import { SellerProfile, calculateSellerReputation } from "@/types/auction";
import { UserBlock } from "@/types/messaging";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(clerkId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { data: blocks, error } = await supabaseAdmin
      .from("user_blocks")
      .select("*")
      .eq("blocker_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const blockList = blocks || [];

    // Batch-fetch all blocked profiles in a single .in query instead of one
    // getSellerProfile round-trip per block (M-SO4).
    const blockedIds = blockList.map((b) => b.blocked_id);
    const profileById = new Map<string, SellerProfile>();

    if (blockedIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from("profiles")
        .select(
          "id, display_name, public_display_name, username, display_preference, positive_ratings, negative_ratings, seller_since, location_city, location_state, location_country, location_privacy"
        )
        .in("id", blockedIds);

      if (profilesError) throw profilesError;

      for (const p of profiles || []) {
        const { percentage, reputation } = calculateSellerReputation(
          p.positive_ratings || 0,
          p.negative_ratings || 0
        );
        profileById.set(p.id, {
          id: p.id,
          displayName: p.display_name,
          publicDisplayName: p.public_display_name,
          username: p.username,
          displayPreference: p.display_preference,
          positiveRatings: p.positive_ratings || 0,
          negativeRatings: p.negative_ratings || 0,
          sellerSince: p.seller_since,
          locationCity: p.location_city,
          locationState: p.location_state,
          locationCountry: p.location_country,
          locationPrivacy: p.location_privacy,
          totalRatings: (p.positive_ratings || 0) + (p.negative_ratings || 0),
          positivePercentage: percentage,
          reputation,
        });
      }
    }

    const blocksWithProfiles: UserBlock[] = blockList.map((block) => ({
      id: block.id,
      blockerId: block.blocker_id,
      blockedId: block.blocked_id,
      createdAt: block.created_at,
      blockedUser: profileById.get(block.blocked_id) || undefined,
    }));

    return NextResponse.json({ blocks: blocksWithProfiles });
  } catch (error) {
    console.error("Get blocked users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
