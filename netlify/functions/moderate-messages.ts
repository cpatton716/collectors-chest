import type { Config, Context } from "@netlify/functions";

// Scheduled function to run AI moderation on flagged messages
// Runs every hour to check for messages needing review

export default async (req: Request, context: Context) => {
  const siteUrl = process.env.URL || "https://collectors-chest.com";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET not configured");
    return new Response("CRON_SECRET not configured", { status: 500 });
  }

  // The downstream route processes a batch of AI calls in bounded-concurrency
  // chunks (maxDuration = 60s there). Give the fetch a slightly larger ceiling
  // and abort rather than hang the scheduled function indefinitely.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 70_000);

  try {
    const response = await fetch(`${siteUrl}/api/cron/moderate-messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
      signal: controller.signal,
    });

    const data = await response.json();

    console.log("Message moderation completed:", data);

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error moderating messages:", error);
    return new Response(
      JSON.stringify({ error: "Failed to moderate messages" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  } finally {
    clearTimeout(timeout);
  }
};

export const config: Config = {
  // Run every hour at the top of the hour
  schedule: "0 * * * *",
};
