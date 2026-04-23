import { NextRequest, NextResponse } from "next/server";

import { Resend } from "resend";
import { z } from "zod";

import { generateVerificationToken, validateEmail } from "@/lib/emailValidation";
import { checkRateLimit, getRateLimitIdentifier, rateLimiters } from "@/lib/rateLimit";
import { supabaseAdmin } from "@/lib/supabase";
import { validateBody } from "@/lib/validation";

// Honeypot field is validated as optional string — if present it triggers the
// silent-success bot trap, so we don't reject here.
const emailCaptureSchema = z.object({
  email: z.string().min(1, "Email is required").max(320, "Email is too long"),
  honeypot: z.string().optional(),
});

const resend = new Resend(process.env.RESEND_API_KEY);

// Token expiration: 24 hours
const TOKEN_EXPIRY_HOURS = 24;

/**
 * POST - Request bonus scans (step 1: send verification email)
 *
 * Validates email, checks for abuse, sends verification email.
 * Bonus scans are NOT granted until email is verified.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit - 5 requests per minute per IP
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const identifier = getRateLimitIdentifier(null, ip);
    const { success: rateLimitSuccess, response: rateLimitResponse } = await checkRateLimit(
      rateLimiters.analyze, // Using analyze limiter (5/min) for stricter protection
      identifier
    );
    if (!rateLimitSuccess) return rateLimitResponse;

    const body = await request.json().catch(() => null);
    const validated = validateBody(emailCaptureSchema, body);
    if (!validated.success) return validated.response;
    const { email, honeypot } = validated.data;

    // Honeypot check - bots will fill this hidden field
    if (honeypot) {
      // Silently reject but return success to confuse bots
      return NextResponse.json({
        success: true,
        message: "Verification email sent! Check your inbox.",
      });
    }

    // Comprehensive email validation (format, disposable, MX)
    const validation = await validateEmail(email);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const normalizedEmail = validation.normalized!;
    const userAgent = request.headers.get("user-agent") || null;

    // Check if this email has already claimed bonus scans
    const { data: existingClaim } = await supabaseAdmin
      .from("bonus_scan_claims")
      .select("id, verified_at")
      .eq("email_normalized", normalizedEmail)
      .single();

    if (existingClaim) {
      if (existingClaim.verified_at) {
        // Already verified - can't claim again
        return NextResponse.json(
          { error: "This email has already been used for bonus scans" },
          { status: 409 }
        );
      } else {
        // Pending verification - resend email
        // First, delete the old claim and create a new one with fresh token
        await supabaseAdmin.from("bonus_scan_claims").delete().eq("id", existingClaim.id);
      }
    }

    // Check if this IP has already claimed bonus scans (abuse prevention)
    const { data: ipClaim } = await supabaseAdmin
      .from("bonus_scan_claims")
      .select("id, verified_at")
      .eq("ip_address", ip)
      .not("verified_at", "is", null)
      .single();

    if (ipClaim) {
      return NextResponse.json(
        { error: "Bonus scans have already been claimed from this device" },
        { status: 409 }
      );
    }

    // Generate verification token
    const verificationToken = generateVerificationToken();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Store claim (unverified)
    const { error: insertError } = await supabaseAdmin.from("bonus_scan_claims").insert({
      email: email.trim(),
      email_normalized: normalizedEmail,
      ip_address: ip,
      user_agent: userAgent,
      verification_token: verificationToken,
      expires_at: expiresAt.toISOString(),
    });

    if (insertError) {
      console.error("[EmailCapture] Failed to create claim:", insertError);
      return NextResponse.json(
        { error: "Failed to process request. Please try again." },
        { status: 500 }
      );
    }

    // Send verification email
    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/api/email-capture/verify?token=${verificationToken}`;

    if (process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: "Collectors Chest <noreply@collectors-chest.com>",
          to: normalizedEmail,
          subject: "Verify your email for 5 bonus scans",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #d97706;">Almost there!</h1>
              <p>Click the button below to verify your email and unlock 5 bonus scans:</p>
              <p style="margin: 32px 0;">
                <a href="${verifyUrl}"
                   style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  Verify Email & Get Bonus Scans
                </a>
              </p>
              <p style="color: #6b7280; font-size: 14px;">
                This link expires in 24 hours. If you didn't request this, you can ignore this email.
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
              <p style="color: #6b7280; font-size: 12px;">
                Collectors Chest - Track your comic collection
              </p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("[EmailCapture] Failed to send verification email:", emailError);
        // Clean up the claim since we couldn't send the email
        await supabaseAdmin
          .from("bonus_scan_claims")
          .delete()
          .eq("verification_token", verificationToken);

        return NextResponse.json(
          { error: "Failed to send verification email. Please try again." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message:
        "Verification email sent! Check your inbox and click the link to unlock your bonus scans.",
      requiresVerification: true,
    });
  } catch (err) {
    console.error("[EmailCapture] Error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
