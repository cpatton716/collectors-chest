import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAdminProfile, logAdminAction } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { schemas, validateBody, validateParams } from "@/lib/validation";

const paramsSchema = z.object({ reportId: schemas.uuid });

const patchSchema = z.object({
  status: z.enum(["pending", "reviewed", "actioned", "dismissed"]),
  adminNotes: z.string().max(2000).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const adminProfile = await getAdminProfile();
    if (!adminProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rawParams = await params;
    const paramsResult = validateParams(paramsSchema, rawParams);
    if (!paramsResult.success) return paramsResult.response;
    const { reportId } = paramsResult.data;

    const body = await request.json().catch(() => null);
    const validated = validateBody(patchSchema, body);
    if (!validated.success) return validated.response;
    const { status, adminNotes } = validated.data;

    const { data, error } = await supabaseAdmin
      .from("message_reports")
      .update({
        status,
        admin_notes: adminNotes || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminProfile.id,
      })
      .eq("id", reportId)
      .select()
      .single();

    if (error) throw error;

    await logAdminAction(adminProfile.id, "update_report", reportId, {
      status,
      adminNotes,
    });

    return NextResponse.json({ report: data });
  } catch (error) {
    console.error("Error updating report:", error);
    return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
  }
}
