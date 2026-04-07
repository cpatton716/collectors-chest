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
        <!-- Welcome title -->
        <div style="background: #0066FF; padding: 0 24px 28px; text-align: center; position: relative;">
          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: radial-gradient(circle, rgba(255,255,255,0.15) 1.5px, transparent 1.5px); background-size: 12px 12px; pointer-events: none;"></div>
          <div style="position: relative; z-index: 1; display: inline-block; background: #FFF200; color: #000; font-weight: 900; font-size: 18px; padding: 8px 20px; border: 3px solid #000; border-radius: 4px; margin-bottom: 10px; letter-spacing: 1px;">WELCOME TO THE CHEST!</div>
          <p style="position: relative; z-index: 1; color: #ffffff; font-size: 15px; margin: 0; opacity: 0.9;">Your collection journey starts now.</p>
        </div>
        <div style="padding: 32px 24px;">
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
