import { NextResponse } from "next/server";
import { emailHeader, emailFooter } from "@/lib/email";

/**
 * GET /api/email-preview - Preview email header template in browser
 * Dev-only endpoint for iterating on email styling without deploying
 */
export async function GET() {
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Email Preview</title></head>
    <body style="margin: 0; padding: 20px; background: #f0f0f0;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden;">
        ${emailHeader("POW!")}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 24px; font-weight: 900; color: #FFF200; text-align: center; margin: 0 0 8px;">WELCOME TO THE CHEST!</h2>
          <p style="font-size: 14px; color: #fff; text-align: center; margin: 0 0 24px;">Your collection journey starts now.</p>
          <p style="font-size: 16px; color: #333; line-height: 1.6;">Hey there, Collector! This is a preview of the email template.</p>
        </div>
        ${emailFooter()}
      </div>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
