import type { Config, Context } from "@netlify/functions";

// Scheduled function to send feedback reminders to buyers/sellers
// Runs daily at 3 PM UTC (10 AM EST / 7 AM PST)

export default async (req: Request, context: Context) => {
  const siteUrl = process.env.URL || "https://collectors-chest.com";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET not configured");
    return new Response("CRON_SECRET not configured", { status: 500 });
  }

  try {
    const response = await fetch(`${siteUrl}/api/cron/send-feedback-reminders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    });

    const data = await response.json();

    console.log("Feedback reminders completed:", data);

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending feedback reminders:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send feedback reminders" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config: Config = {
  // Run daily at 3 PM UTC (10 AM Eastern)
  schedule: "0 15 * * *",
};
