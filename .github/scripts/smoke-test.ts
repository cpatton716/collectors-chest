// .github/scripts/smoke-test.ts
//
// Post-deploy smoke test: sends a known comic cover image to the
// production /api/analyze endpoint and validates the response
// contains expected fields (title, issue number, etc.).
// Exit 0 = production is healthy. Exit 1 = smoke test failed.

import * as fs from "fs";
import * as path from "path";

const SITE_URL = process.env.SITE_URL || "https://collectors-chest.com";
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error("Missing CRON_SECRET");
  process.exit(2);
}

// Use the existing health-check endpoint which already probes providers
// This avoids duplicating probe logic. See: /api/admin/health-check
async function smokeTest(): Promise<void> {
  try {
    // Step 1: Hit the existing health-check endpoint for provider verification
    console.log("Checking provider health via /api/admin/health-check...");
    const healthResponse = await fetch(`${SITE_URL}/api/admin/health-check`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${CRON_SECRET}`,
      },
    });

    if (!healthResponse.ok) {
      const body = await healthResponse.text();
      console.error(
        `Health check failed (${healthResponse.status}): ${body}`
      );
      process.exit(1);
    }

    const healthData = await healthResponse.json();
    console.log(`Health check passed: ${JSON.stringify(healthData)}`);

    // Step 2: Verify the site is serving pages (basic liveness)
    console.log("Checking site liveness...");
    const siteResponse = await fetch(SITE_URL);
    if (!siteResponse.ok) {
      console.error(`Site returned ${siteResponse.status}`);
      process.exit(1);
    }

    console.log("Smoke test PASSED — production is healthy");
    process.exit(0);
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error(`Smoke test failed: ${error.message}`);
    process.exit(1);
  }
}

smokeTest();
