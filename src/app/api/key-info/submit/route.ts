import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getUserSubmissions, submitKeyInfo } from "@/lib/keyComicsDb";
import { validateBody } from "@/lib/validation";

const keyInfoSubmitSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  issueNumber: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .pipe(z.string().min(1, "Issue number is required").max(50)),
  publisher: z.string().trim().max(100).optional().nullable(),
  releaseYear: z
    .union([z.string(), z.number()])
    .transform((v) => (v === undefined || v === null ? undefined : String(v)))
    .optional()
    .nullable(),
  suggestedKeyInfo: z
    .array(z.string().trim().min(1, "Key info entry cannot be empty").max(200))
    .min(1, "At least one key info entry is required")
    .max(20),
  sourceUrl: z.string().trim().url().max(2048).optional().nullable().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().nullable(),
});

// POST - Submit a new key info suggestion
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await request.json().catch(() => null);
    const validated = validateBody(keyInfoSubmitSchema, rawBody);
    if (!validated.success) return validated.response;
    const { title, issueNumber, publisher, releaseYear, suggestedKeyInfo, sourceUrl, notes } =
      validated.data;

    // Submit the suggestion
    const result = await submitKeyInfo(userId, {
      title: title.trim(),
      issueNumber: issueNumber.trim(),
      publisher: publisher?.trim() || undefined,
      releaseYear: releaseYear ? parseInt(String(releaseYear), 10) : undefined,
      suggestedKeyInfo: suggestedKeyInfo.map((s: string) => s.trim()),
      sourceUrl: sourceUrl?.trim() || undefined,
      notes: notes?.trim() || undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      submissionId: result.id,
      message: "Your suggestion has been submitted for review. Thank you!",
    });
  } catch (error) {
    console.error("Error submitting key info:", error);
    return NextResponse.json({ error: "Failed to submit key info suggestion" }, { status: 500 });
  }
}

// GET - Get user's own submissions
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await getUserSubmissions(userId);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ submissions: result.submissions });
  } catch (error) {
    console.error("Error fetching user submissions:", error);
    return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 });
  }
}
