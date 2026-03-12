import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateProfileCache } from "@/lib/db";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, age_confirmed_at")
      .eq("clerk_user_id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Already verified
    if (profile.age_confirmed_at) {
      return NextResponse.json({ alreadyVerified: true });
    }

    // Set age_confirmed_at
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ age_confirmed_at: new Date().toISOString() })
      .eq("id", profile.id);

    if (error) {
      console.error("Age verification update error:", error);
      return NextResponse.json(
        { error: "Failed to save verification" },
        { status: 500 }
      );
    }

    // Bust profile cache so subsequent API calls see the updated age_confirmed_at
    await invalidateProfileCache(userId);

    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error("Age verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
