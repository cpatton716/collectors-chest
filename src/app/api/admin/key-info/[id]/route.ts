import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAdminProfile } from "@/lib/adminAuth";
import { approveSubmission, rejectSubmission } from "@/lib/keyComicsDb";
import { schemas, validateBody, validateParams } from "@/lib/validation";

const paramsSchema = z.object({ id: schemas.uuid });

const submissionActionSchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    reason: z.string().max(1000).optional(),
  })
  .refine((v) => v.action !== "reject" || (v.reason && v.reason.trim().length > 0), {
    message: "Rejection reason is required",
    path: ["reason"],
  });

// POST - Approve or reject a submission
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check admin access using centralized helper
    const adminProfile = await getAdminProfile();
    if (!adminProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rawParams = await params;
    const paramsResult = validateParams(paramsSchema, rawParams);
    if (!paramsResult.success) return paramsResult.response;
    const { id } = paramsResult.data;

    const body = await request.json().catch(() => null);
    const validated = validateBody(submissionActionSchema, body);
    if (!validated.success) return validated.response;
    const { action, reason } = validated.data;

    let result;
    if (action === "approve") {
      result = await approveSubmission(id, adminProfile.clerk_user_id);
    } else {
      result = await rejectSubmission(id, adminProfile.clerk_user_id, reason!);
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message:
        action === "approve"
          ? "Submission approved and added to key comics database"
          : "Submission rejected",
    });
  } catch (error) {
    console.error("Error processing submission:", error);
    return NextResponse.json({ error: "Failed to process submission" }, { status: 500 });
  }
}
