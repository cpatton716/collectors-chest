import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabase";
import { validateBody } from "@/lib/validation";

const patchSchema = z
  .object({
    msgPushEnabled: z.boolean().optional(),
    msgEmailEnabled: z.boolean().optional(),
    // Per-category email preferences. Transactional is always-on and not
    // exposed as a togglable field.
    emailPrefMarketplace: z.boolean().optional(),
    emailPrefSocial: z.boolean().optional(),
    emailPrefMarketing: z.boolean().optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.msgPushEnabled !== undefined ||
      v.msgEmailEnabled !== undefined ||
      v.emailPrefMarketplace !== undefined ||
      v.emailPrefSocial !== undefined ||
      v.emailPrefMarketing !== undefined,
    {
      message: "No valid fields to update",
    }
  );

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select(
        "msg_push_enabled, msg_email_enabled, email_pref_marketplace, email_pref_social, email_pref_marketing"
      )
      .eq("clerk_user_id", clerkId)
      .single();

    if (error) {
      console.error("Fetch notification settings error:", error);
      return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
    }

    return NextResponse.json({
      msgPushEnabled: data.msg_push_enabled ?? true,
      msgEmailEnabled: data.msg_email_enabled ?? true,
      emailPrefMarketplace: data.email_pref_marketplace ?? true,
      emailPrefSocial: data.email_pref_social ?? true,
      emailPrefMarketing: data.email_pref_marketing ?? true,
      // Transactional is always-on — surfaced for UI clarity.
      emailPrefTransactional: true,
    });
  } catch (error) {
    console.error("Notification settings GET error:", error);
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
    if (validated.data.msgPushEnabled !== undefined) {
      updates.msg_push_enabled = validated.data.msgPushEnabled;
    }
    if (validated.data.msgEmailEnabled !== undefined) {
      updates.msg_email_enabled = validated.data.msgEmailEnabled;
    }
    if (validated.data.emailPrefMarketplace !== undefined) {
      updates.email_pref_marketplace = validated.data.emailPrefMarketplace;
    }
    if (validated.data.emailPrefSocial !== undefined) {
      updates.email_pref_social = validated.data.emailPrefSocial;
    }
    if (validated.data.emailPrefMarketing !== undefined) {
      updates.email_pref_marketing = validated.data.emailPrefMarketing;
    }

    const { error } = await supabaseAdmin.from("profiles").update(updates).eq("clerk_user_id", clerkId);

    if (error) {
      console.error("Update notification settings error:", error);
      return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notification settings PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
