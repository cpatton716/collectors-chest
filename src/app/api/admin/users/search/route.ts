import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAdminProfile, logAdminAction, searchUsersByEmail } from "@/lib/adminAuth";
import { validateQuery } from "@/lib/validation";

const searchQuerySchema = z.object({
  email: z
    .string()
    .min(2, "Email search query must be at least 2 characters")
    .max(320, "Email search query is too long"),
});

export async function GET(request: NextRequest) {
  try {
    // Check admin access
    const adminProfile = await getAdminProfile();
    if (!adminProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get search query
    const queryResult = validateQuery(searchQuerySchema, request.nextUrl.searchParams);
    if (!queryResult.success) return queryResult.response;
    const { email } = queryResult.data;

    // Search users
    const users = await searchUsersByEmail(email);

    // Log the search action
    await logAdminAction(adminProfile.id, "search_users", undefined, {
      query: email,
      results_count: users.length,
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
  }
}
