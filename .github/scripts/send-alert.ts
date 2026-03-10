// .github/scripts/send-alert.ts
//
// Sends email alert via Resend API.
// Usage: ALERT_TYPE=success|failure|abort|healthy|heartbeat npx tsx send-alert.ts
// Includes DISCOVERY_CANDIDATES in body when available.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ALERT_TYPE = process.env.ALERT_TYPE || "info";
const ALERT_DETAILS = process.env.ALERT_DETAILS || "No details provided";
const OLD_MODEL = process.env.OLD_MODEL_ID || "unknown";
const NEW_MODEL = process.env.NEW_MODEL_ID || "unknown";
const DISCOVERY_CANDIDATES = process.env.DISCOVERY_CANDIDATES || "";

if (!RESEND_API_KEY || !ADMIN_EMAIL) {
  console.error("Missing RESEND_API_KEY or ADMIN_EMAIL — skipping alert");
  process.exit(0); // Don't fail the pipeline over alerts
}

const subjects: Record<string, string> = {
  success: `[Collectors Chest] Model auto-updated: ${OLD_MODEL} -> ${NEW_MODEL}`,
  failure: `[Collectors Chest] Model auto-update FAILED — manual intervention needed`,
  abort: `[Collectors Chest] Model auto-update ABORTED — guardrail triggered`,
  healthy: `[Collectors Chest] Daily model check — all healthy`,
  heartbeat: `[Collectors Chest] Weekly heartbeat — pipeline alive, all models healthy`,
  rollback: `[Collectors Chest] Model update ROLLED BACK — smoke test failed`,
};

const subject =
  subjects[ALERT_TYPE] || `[Collectors Chest] Model Pipeline: ${ALERT_TYPE}`;

const candidatesHtml = DISCOVERY_CANDIDATES
  ? `<h3>Discovery Candidates</h3><pre>${DISCOVERY_CANDIDATES}</pre>`
  : "";

async function sendAlert(): Promise<void> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Collectors Chest <alerts@collectors-chest.com>",
        to: ADMIN_EMAIL,
        subject,
        html: `
          <h2>Model Pipeline: ${ALERT_TYPE.toUpperCase()}</h2>
          <p><strong>Current Model:</strong> ${OLD_MODEL}</p>
          <p><strong>New Model:</strong> ${NEW_MODEL}</p>
          ${candidatesHtml}
          <hr>
          <pre>${ALERT_DETAILS}</pre>
          <hr>
          <p><em>Automated by Collectors Chest Self-Healing Pipeline</em></p>
        `,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`Resend API error (${response.status}): ${body}`);
    } else {
      console.log(`Alert sent: ${ALERT_TYPE}`);
    }
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error(`Failed to send alert: ${error.message}`);
  }
}

sendAlert();
