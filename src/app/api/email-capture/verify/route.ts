import { NextRequest, NextResponse } from "next/server";

import { Resend } from "resend";
import { z } from "zod";

import { sendNotificationEmail } from "@/lib/email";
import { supabaseAdmin } from "@/lib/supabase";
import { validateQuery } from "@/lib/validation";

const verifyQuerySchema = z.object({
  token: z.string().min(1, "Verification token is required").max(256),
});

const resend = new Resend(process.env.RESEND_API_KEY);

// Resend Audience ID for bonus scan recipients
const BONUS_SCANS_AUDIENCE_ID = process.env.RESEND_BONUS_SCANS_AUDIENCE_ID;

/**
 * GET - Verify email and grant bonus scans
 *
 * User clicks link in verification email, which hits this endpoint.
 * If token is valid and not expired, marks claim as verified and grants bonus scans.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryResult = validateQuery(verifyQuerySchema, searchParams);
    if (!queryResult.success) {
      // This is a user-facing redirect flow, so preserve the redirect UX.
      return redirectWithMessage("error", "Invalid verification link");
    }
    const { token } = queryResult.data;

    // Look up the claim by token
    const { data: claim, error: lookupError } = await supabaseAdmin
      .from("bonus_scan_claims")
      .select("*")
      .eq("verification_token", token)
      .single();

    if (lookupError || !claim) {
      return redirectWithMessage("error", "Invalid or expired verification link");
    }

    // Check if already verified
    if (claim.verified_at) {
      return redirectWithMessage(
        "already_verified",
        "Your bonus scans have already been activated!"
      );
    }

    // Check if token expired
    if (new Date(claim.expires_at) < new Date()) {
      // Clean up expired claim
      await supabaseAdmin.from("bonus_scan_claims").delete().eq("id", claim.id);

      return redirectWithMessage(
        "expired",
        "This verification link has expired. Please request new bonus scans."
      );
    }

    // Mark as verified
    const { error: updateError } = await supabaseAdmin
      .from("bonus_scan_claims")
      .update({
        verified_at: new Date().toISOString(),
      })
      .eq("id", claim.id);

    if (updateError) {
      console.error("[EmailVerify] Failed to verify claim:", updateError);
      return redirectWithMessage("error", "Failed to verify email. Please try again.");
    }

    // Add to Resend audience (for marketing, optional)
    if (BONUS_SCANS_AUDIENCE_ID && process.env.RESEND_API_KEY) {
      try {
        await resend.contacts.create({
          email: claim.email_normalized,
          audienceId: BONUS_SCANS_AUDIENCE_ID,
          unsubscribed: false,
        });
      } catch {
        // Non-critical - don't fail verification if audience add fails
        console.error("[EmailVerify] Failed to add to audience");
      }
    }

    // Send confirmation email through the shared template system (branded
    // header/footer, unified From identity). Non-critical: the user already
    // got their scans, so a send failure is logged, not surfaced.
    if (process.env.RESEND_API_KEY) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";
      const { success: confirmSent } = await sendNotificationEmail({
        to: claim.email_normalized,
        type: "bonus_scan_granted",
        data: {
          scanUrl: `${appUrl}/scan`,
          signUpUrl: `${appUrl}/sign-up`,
        },
      });
      if (!confirmSent) {
        console.error("[EmailVerify] Failed to send confirmation email");
      }
    }

    // Redirect to scan page with success message
    return redirectWithMessage("success", "Email verified! You now have 5 bonus scans.");
  } catch (err) {
    console.error("[EmailVerify] Error:", err);
    return redirectWithMessage("error", "Something went wrong. Please try again.");
  }
}

/**
 * Redirect to scan page with a status message
 */
function redirectWithMessage(status: string, message: string): NextResponse {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";
  const url = new URL("/scan", baseUrl);
  url.searchParams.set("bonus_status", status);
  url.searchParams.set("bonus_message", message);

  // Also set a flag that client-side code can check to grant the scans
  if (status === "success") {
    url.searchParams.set("bonus_granted", "true");
  }

  return NextResponse.redirect(url.toString());
}
