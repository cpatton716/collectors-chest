import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { Webhook } from "svix";

import { sendNotificationEmail } from "@/lib/email";
import { supabase } from "@/lib/supabase";

// Clerk webhook types
interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    deleted?: boolean;
    email_addresses?: Array<{ email_address: string; id: string }>;
    primary_email_address_id?: string;
    first_name?: string | null;
    last_name?: string | null;
  };
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("Missing CLERK_WEBHOOK_SECRET environment variable");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  // Get headers for verification
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Verify the webhook signature
  const wh = new Webhook(WEBHOOK_SECRET);
  let event: ClerkWebhookEvent;

  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Handle the user.created event — upsert profile + send welcome email.
  // Upserting here (rather than relying on lazy getOrCreateProfile) guarantees
  // every new user — including social sign-ins — gets their email synced into
  // profiles.email from day one. Without this, social-OAuth users could hit a
  // server route that calls getOrCreateProfile(userId) before any client-side
  // component passes the email, creating a profile with email=null.
  if (event.type === "user.created") {
    const clerkUserId = event.data.id;
    const { email_addresses, primary_email_address_id } = event.data;

    // Find the primary email address
    const primaryEmail = email_addresses?.find(
      (e) => e.id === primary_email_address_id
    )?.email_address;

    try {
      await supabase
        .from("profiles")
        .upsert(
          { clerk_user_id: clerkUserId, email: primaryEmail ?? null },
          { onConflict: "clerk_user_id" }
        );
    } catch (err) {
      console.error("[Webhook] Failed to upsert profile for new user:", err);
    }

    if (primaryEmail) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";

      // Fire and forget — don't block webhook response
      sendNotificationEmail({
        to: primaryEmail,
        type: "welcome",
        data: { collectionUrl: `${appUrl}/collection` },
      }).catch((err) => {
        console.error("[Webhook] Failed to send welcome email:", err);
      });
    }

    return NextResponse.json({ received: true });
  }

  // Handle user.updated — sync email changes back to profiles.email so older
  // profiles created without email, or users who add a primary email later,
  // stay in sync.
  if (event.type === "user.updated") {
    const clerkUserId = event.data.id;
    const { email_addresses, primary_email_address_id } = event.data;
    const primaryEmail = email_addresses?.find(
      (e) => e.id === primary_email_address_id
    )?.email_address;

    if (primaryEmail) {
      try {
        await supabase
          .from("profiles")
          .update({ email: primaryEmail })
          .eq("clerk_user_id", clerkUserId);
      } catch (err) {
        console.error("[Webhook] Failed to sync email on user.updated:", err);
      }
    }

    return NextResponse.json({ received: true });
  }

  // Handle the user.deleted event
  if (event.type === "user.deleted") {
    const clerkUserId = event.data.id;

    try {
      // Find the user's profile in Supabase
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("clerk_user_id", clerkUserId)
        .single();

      if (profileError || !profile) {
        return NextResponse.json({ received: true });
      }

      const profileId = profile.id;

      // Delete all user data (cascade will handle related records)
      // But let's be explicit for audit purposes

      // 1. Delete sales records
      const { error: salesError } = await supabase.from("sales").delete().eq("user_id", profileId);

      if (salesError) {
        console.error("Error deleting sales:", salesError);
      }

      // 2. Delete comic_lists associations (will cascade, but being explicit)
      const { data: userComics } = await supabase
        .from("comics")
        .select("id")
        .eq("user_id", profileId);

      if (userComics && userComics.length > 0) {
        const comicIds = userComics.map((c) => c.id);
        await supabase.from("comic_lists").delete().in("comic_id", comicIds);
      }

      // 3. Delete comics
      const { error: comicsError } = await supabase
        .from("comics")
        .delete()
        .eq("user_id", profileId);

      if (comicsError) {
        console.error("Error deleting comics:", comicsError);
      }

      // 4. Delete lists
      const { error: listsError } = await supabase.from("lists").delete().eq("user_id", profileId);

      if (listsError) {
        console.error("Error deleting lists:", listsError);
      }

      // 5. Finally, delete the profile
      const { error: deleteProfileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", profileId);

      if (deleteProfileError) {
        console.error("Error deleting profile:", deleteProfileError);
        return NextResponse.json({ error: "Failed to delete user data" }, { status: 500 });
      }

      return NextResponse.json({ received: true, deleted: true });
    } catch (err) {
      console.error("Error processing user deletion:", err);
      return NextResponse.json({ error: "Failed to process deletion" }, { status: 500 });
    }
  }

  // Return success for other event types
  return NextResponse.json({ received: true });
}
