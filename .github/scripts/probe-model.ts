// .github/scripts/probe-model.ts
//
// Probes the current Anthropic model with a minimal vision API call.
// Uses a 1x1 transparent PNG to match production usage (cover scanning).
// Writes status to $GITHUB_OUTPUT: healthy | deprecated | transient.
// Always exits 0 — the workflow reads the output status to decide next steps.
// This avoids GitHub Actions conflating exit code 1 and 2 under continue-on-error.

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

const MODEL_ID = process.env.CURRENT_MODEL_ID;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const GITHUB_OUTPUT = process.env.GITHUB_OUTPUT;

if (!MODEL_ID || !API_KEY) {
  console.error("Missing CURRENT_MODEL_ID or ANTHROPIC_API_KEY");
  if (GITHUB_OUTPUT) {
    fs.appendFileSync(GITHUB_OUTPUT, "status=transient\n");
  }
  process.exit(0);
}

// 1x1 transparent PNG as base64 (smallest valid PNG)
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function probe(): Promise<void> {
  const client = new Anthropic({ apiKey: API_KEY });

  try {
    await client.messages.create({
      model: MODEL_ID!,
      max_tokens: 10,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: TINY_PNG_BASE64,
              },
            },
            {
              type: "text",
              text: "Say OK",
            },
          ],
        },
      ],
    });
    console.log(`Model ${MODEL_ID} is healthy (vision probe passed)`);
    if (GITHUB_OUTPUT) {
      fs.appendFileSync(GITHUB_OUTPUT, "status=healthy\n");
    }
    process.exit(0);
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    const status = error.status || 0;
    const message = error.message || "Unknown error";

    if (status === 403 || status === 404) {
      console.log(
        `MODEL_DEPRECATED: ${MODEL_ID} returned ${status}: ${message}`
      );
      if (GITHUB_OUTPUT) {
        fs.appendFileSync(GITHUB_OUTPUT, "status=deprecated\n");
      }
      process.exit(0);
    }

    // Other errors (rate limit, server error) — don't trigger model change
    console.error(`Transient error (${status}): ${message}`);
    if (GITHUB_OUTPUT) {
      fs.appendFileSync(GITHUB_OUTPUT, "status=transient\n");
    }
    process.exit(0);
  }
}

probe();
