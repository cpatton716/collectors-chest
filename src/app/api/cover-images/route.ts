import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { submitCoverImage } from "@/lib/coverImageDb";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get profile ID from Clerk user ID
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("clerk_user_id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      title,
      issueNumber,
      imageUrl,
      sourceQuery,
      candidateCount,
    } = body;

    if (!title || !issueNumber || !imageUrl) {
      return NextResponse.json(
        { error: "title, issueNumber, and imageUrl are required" },
        { status: 400 }
      );
    }

    // Auto-approve if single candidate (no ambiguity)
    const autoApprove = candidateCount === 1;

    const result = await submitCoverImage({
      title,
      issueNumber,
      imageUrl,
      submittedBy: profile.id,
      sourceQuery: sourceQuery || "",
      autoApprove,
    });

    return NextResponse.json({
      id: result.id,
      status: result.status,
      autoApproved: autoApprove,
    });
  } catch (error) {
    console.error("Cover submission error:", error);
    return NextResponse.json(
      { error: "Failed to submit cover image" },
      { status: 500 }
    );
  }
}
