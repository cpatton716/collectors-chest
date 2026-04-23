import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabase";
import { validateBody } from "@/lib/validation";

const patchSchema = z
  .object({
    showFinancials: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.showFinancials !== undefined, {
    message: "No valid fields to update",
  });

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("show_financials")
      .eq("clerk_user_id", clerkId)
      .single();

    if (error) {
      console.error("Fetch preferences error:", error);
      return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
    }

    return NextResponse.json({
      showFinancials: data.show_financials ?? true,
    });
  } catch (error) {
    console.error("Preferences GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const validated = validateBody(patchSchema, body);
    if (!validated.success) return validated.response;

    const updates: Record<string, boolean> = {};
    if (validated.data.showFinancials !== undefined) {
      updates.show_financials = validated.data.showFinancials;
    }

    const { error } = await supabaseAdmin.from("profiles").update(updates).eq("clerk_user_id", clerkId);

    if (error) {
      console.error("Update preferences error:", error);
      return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Preferences PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
