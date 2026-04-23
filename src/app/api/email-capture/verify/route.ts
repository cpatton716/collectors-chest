import { NextRequest, NextResponse } from "next/server";

import { Resend } from "resend";
import { z } from "zod";

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

    // Send confirmation email
    if (process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: "Collectors Chest <noreply@collectors-chest.com>",
          to: claim.email_normalized,
          subject: "You unlocked 5 bonus scans!",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #d97706;">You got 5 bonus scans!</h1>
              <p>Your email has been verified and you now have 5 extra scans to explore your comic collection.</p>
              <p>Here's what you can do:</p>
              <ul>
                <li>Scan comic covers for instant AI recognition</li>
                <li>Get real-time eBay price estimates</li>
                <li>See key issue information and first appearances</li>
              </ul>
              <p style="margin: 32px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/scan"
                   style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  Start Scanning
                </a>
              </p>
              <p>Want unlimited scans? <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/sign-up" style="color: #4f46e5;">Create a free account</a> to get 10 scans per month, plus cloud sync and more!</p>
              <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">Happy collecting!<br>The Collectors Chest Team</p>
            </div>
          `,
        });
      } catch (emailError) {
        // Non-critical - user already got their scans
        console.error("[EmailVerify] Failed to send confirmation email:", emailError);
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
