import type { Config, Context } from "@netlify/functions";

// Scheduled function to send trial expiration reminder emails daily
// Runs at 2 PM UTC (9 AM EST / 6 AM PST)

export default async (req: Request, context: Context) => {
  const siteUrl = process.env.URL || "https://collectors-chest.com";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET not configured");
    return new Response("CRON_SECRET not configured", { status: 500 });
  }

  try {
    const response = await fetch(`${siteUrl}/api/cron/send-trial-reminders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    });

    const data = await response.json();

    console.log("Trial reminders completed:", data);

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending trial reminders:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send trial reminders" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config: Config = {
  // Run daily at 2 PM UTC (9 AM Eastern)
  schedule: "0 14 * * *",
};
