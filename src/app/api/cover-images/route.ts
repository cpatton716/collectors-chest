import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { submitCoverImage } from "@/lib/coverImageDb";
import { supabaseAdmin } from "@/lib/supabase";
import { validateBody } from "@/lib/validation";

const coverImageSubmitSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  issueNumber: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .pipe(z.string().min(1, "Issue number is required").max(50)),
  imageUrl: z.string().url("Must be a valid URL").max(2048),
  sourceQuery: z.string().max(500).optional().nullable(),
  candidateCount: z.number().int().min(0).max(100).optional(),
});

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

    const rawBody = await request.json().catch(() => null);
    const validated = validateBody(coverImageSubmitSchema, rawBody);
    if (!validated.success) return validated.response;
    const {
      title,
      issueNumber,
      imageUrl,
      sourceQuery,
      candidateCount,
    } = validated.data;

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
