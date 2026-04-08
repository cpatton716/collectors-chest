import type { Config, Context } from "@netlify/functions";

// Scheduled function to reset monthly scan counts
// Runs at midnight UTC on the 1st of each month

export default async (req: Request, context: Context) => {
  const siteUrl = process.env.URL || "https://collectors-chest.com";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET not configured");
    return new Response("CRON_SECRET not configured", { status: 500 });
  }

  try {
    const response = await fetch(`${siteUrl}/api/cron/reset-scans`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    });

    const data = await response.json();

    console.log("Scan reset completed:", data);

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error resetting scans:", error);
    return new Response(
      JSON.stringify({ error: "Failed to reset scans" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config: Config = {
  // Run at midnight UTC on the 1st of each month
  schedule: "0 0 1 * *",
};
