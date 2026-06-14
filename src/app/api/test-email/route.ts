import { NextResponse } from "next/server";

import { Resend } from "resend";

// GET - Test email sending (development only)
export async function GET() {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not allowed in production" }, { status: 403 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  // Recipient comes from TEST_EMAIL_RECIPIENT so no personal address is
  // hardcoded in source. Falls back to a safe placeholder if unset.
  const recipient = process.env.TEST_EMAIL_RECIPIENT || "delivered@resend.dev";

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const { data, error } = await resend.emails.send({
      from: "Collectors Chest <notifications@collectors-chest.com>",
      to: recipient,
      subject: "Test Email from Collectors Chest",
      html: `
        <h2>Email is working!</h2>
        <p>If you're seeing this, Resend is configured correctly.</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      `,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageId: data?.id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
