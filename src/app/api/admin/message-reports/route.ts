import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAdminProfile, logAdminAction } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { validateQuery } from "@/lib/validation";

const listQuerySchema = z.object({
  status: z.enum(["pending", "reviewed", "actioned", "dismissed"]).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export async function GET(request: NextRequest) {
  try {
    const adminProfile = await getAdminProfile();
    if (!adminProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const queryResult = validateQuery(listQuerySchema, searchParams);
    if (!queryResult.success) return queryResult.response;
    const { status, page, limit } = queryResult.data;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("message_reports")
      .select(
        `
        *,
        messages (
          id,
          content,
          sender_id,
          created_at
        ),
        reporter:profiles!reporter_id (
          id,
          display_name,
          email
        )
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    await logAdminAction(adminProfile.id, "view_reports", undefined);

    return NextResponse.json({
      reports: data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}
