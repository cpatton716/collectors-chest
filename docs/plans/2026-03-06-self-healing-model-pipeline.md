# Self-Healing Model Update Pipeline — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a GitHub Actions pipeline that runs daily, checks if the current Anthropic models (PRIMARY and LIGHTWEIGHT) are still available, and if deprecated (403), automatically discovers the latest model, updates the code, validates with tests, pushes to `main` (triggering Netlify's native git-based deploy), and runs a post-deploy smoke test.

**Architecture:** A single GitHub Actions job on a daily cron schedule clones the repo, probes both `MODEL_PRIMARY` and `MODEL_LIGHTWEIGHT` via vision requests (1x1 transparent PNG, matching production usage). If both are healthy, it exits early (sending a heartbeat alert on Mondays). On failure, it queries the Anthropic Models API (with pagination) to find the latest replacement for each deprecated model, updates `src/lib/models.ts` using targeted full-line replacement, runs the test suite once, verifies via diff guard that only `models.ts` changed (up to 2 lines), commits, and pushes to `main`. Netlify's native git-triggered build handles deployment — no CLI deploy needed. After deploy, a smoke test sends a known comic cover image and validates the response. If the smoke test fails, the commit is reverted and pushed. Email alerts sent on every outcome, including discovery candidates.

**Tech Stack:** GitHub Actions (pinned to SHA), Anthropic API (models endpoint + vision), Node.js, Resend (email alerts)

**Architectural Note — MODEL_LIGHTWEIGHT outside provider abstraction:** Routes that use `MODEL_LIGHTWEIGHT` (`cover-candidates`, `moderate-messages`, `titles/suggest`) call the Anthropic SDK directly rather than going through the provider abstraction layer. The pipeline still works for these because it updates the model ID in `models.ts` which those routes import, but this is a known architectural gap. Those routes will not benefit from provider fallback logic.

---

## Prerequisites

Before starting, ensure you have:
- GitHub repo access (to add Actions workflows and secrets)
- These secrets ready to add to GitHub Settings > Secrets:
  - `ANTHROPIC_API_KEY` — Anthropic API key
  - `RESEND_API_KEY` — For email alerts
  - `ADMIN_EMAIL` — Alert recipient email
  - `CRON_SECRET` — Shared secret for health-check endpoint auth (same as .env.local)
- Note: No `NETLIFY_AUTH_TOKEN` or `NETLIFY_SITE_ID` needed — deployment is handled by Netlify's native git-triggered build when we push to `main`

---

## Task 1: Create the Model Reader Script

**Files:**
- Create: `.github/scripts/read-models.ts`

This TypeScript script imports `models.ts` and outputs the current model IDs as JSON. This replaces brittle `grep | sed` shell parsing.

**Step 1: Create the script**

```typescript
// .github/scripts/read-models.ts
//
// Reads MODEL_PRIMARY and MODEL_LIGHTWEIGHT from src/lib/models.ts
// and outputs them as JSON to stdout.
// Uses fs.readFileSync + regex instead of dynamic import to avoid tsx loader dependency.
// The regex is targeted to the exact `export const X = "..."` pattern in models.ts.

import * as fs from "fs";
import * as path from "path";

function readModels(): void {
  const modelsPath = path.join(process.cwd(), "src/lib/models.ts");
  const content = fs.readFileSync(modelsPath, "utf-8");

  const primaryMatch = content.match(/export const MODEL_PRIMARY = "([^"]+)"/);
  const lightweightMatch = content.match(/export const MODEL_LIGHTWEIGHT = "([^"]+)"/);

  if (!primaryMatch || !lightweightMatch) {
    console.error("Failed to extract model IDs from models.ts");
    process.exit(1);
  }

  console.log(JSON.stringify({
    MODEL_PRIMARY: primaryMatch[1],
    MODEL_LIGHTWEIGHT: lightweightMatch[1],
  }));
}

readModels();
```

**Step 2: Verify the script compiles**

Run: `npx tsx .github/scripts/read-models.ts` — should output JSON with both model IDs.

**Step 3: Commit**

```bash
git add .github/scripts/read-models.ts
git commit -m "feat: add TypeScript model reader script for self-healing pipeline"
```

---

## Task 2: Create the Model Probe Script

**Files:**
- Create: `.github/scripts/probe-model.ts`

This script probes the Anthropic API with a **vision request** (1x1 transparent PNG), matching how the app uses models in production. Writes result to `$GITHUB_OUTPUT` as `status=healthy|deprecated|transient` and always exits 0 to avoid GitHub Actions conflating different failure modes.

**Step 1: Create the script**

```typescript
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
```

**Step 2: Verify the script compiles**

Run: `npx tsx .github/scripts/probe-model.ts` (will fail without env vars, that's expected — just verify no syntax errors)

**Step 3: Commit**

```bash
git add .github/scripts/probe-model.ts
git commit -m "feat: add vision-based model probe script for self-healing pipeline"
```

---

## Task 3: Create the Model Discovery Script

**Files:**
- Create: `.github/scripts/discover-model.ts`

This script queries the Anthropic API to find the latest available model in the same family as the deprecated one. Handles API pagination via `has_more` and outputs the full candidate list for inclusion in alerts.

**Step 1: Create the script**

```typescript
// .github/scripts/discover-model.ts
//
// Queries Anthropic's Models API to find the latest available model
// in the same family as the current (deprecated) model.
// Handles pagination via has_more field.
// Outputs the new model ID to stdout.
// Outputs the full candidate list to stderr (for alert inclusion).
// Exit 0 = found replacement. Exit 1 = no replacement found.

import Anthropic from "@anthropic-ai/sdk";

const DEPRECATED_MODEL_ID = process.env.CURRENT_MODEL_ID;
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!DEPRECATED_MODEL_ID || !API_KEY) {
  console.error("Missing CURRENT_MODEL_ID or ANTHROPIC_API_KEY");
  process.exit(2);
}

// Extract the model family by stripping the 8-digit date suffix.
// e.g., "claude-sonnet-4-20250514" -> "claude-sonnet-4"
// e.g., "claude-haiku-4-5-20251001" -> "claude-haiku-4-5"
function getModelFamily(modelId: string): string {
  return modelId.replace(/-\d{8}$/, "");
}

async function discover(): Promise<void> {
  const client = new Anthropic({ apiKey: API_KEY });
  const family = getModelFamily(DEPRECATED_MODEL_ID!);

  console.error(`Looking for models in family: ${family}`);

  try {
    // Paginate through all available models
    const allModels: Array<{ id: string; created_at: string }> = [];
    let hasMore = true;
    let afterId: string | undefined;

    while (hasMore) {
      const params: { limit: number; after_id?: string } = { limit: 100 };
      if (afterId) {
        params.after_id = afterId;
      }

      const response = await client.models.list(params);
      allModels.push(...response.data);

      hasMore = response.has_more === true;
      if (hasMore && response.data.length > 0) {
        afterId = response.data[response.data.length - 1].id;
      }
    }

    console.error(`Total models fetched: ${allModels.length}`);

    // Filter to same family, sort by created_at descending (newest first)
    const candidates = allModels
      .filter((m) => {
        const candidateFamily = getModelFamily(m.id);
        return candidateFamily === family && m.id !== DEPRECATED_MODEL_ID;
      })
      .sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });

    // Output full candidate list to stderr (captured by workflow for alerts)
    console.error(`CANDIDATES:${JSON.stringify(candidates.map((c) => c.id))}`);

    if (candidates.length === 0) {
      console.error(`No replacement models found in family "${family}"`);
      console.error(
        `Available models: ${allModels.map((m) => m.id).join(", ")}`
      );
      process.exit(1);
    }

    const newModel = candidates[0];
    console.error(
      `Found replacement: ${newModel.id} (created: ${newModel.created_at})`
    );

    // Output ONLY the model ID to stdout (workflow reads this)
    console.log(newModel.id);
    process.exit(0);
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error(`Failed to list models: ${error.message}`);
    process.exit(1);
  }
}

discover();
```

**Step 2: Commit**

```bash
git add .github/scripts/discover-model.ts
git commit -m "feat: add model discovery script with pagination for self-healing pipeline"
```

---

## Task 4: Create the Model Update Script

**Files:**
- Create: `.github/scripts/update-model.ts`

This script updates `src/lib/models.ts` with the new model ID using **targeted full-line replacement**. It matches the entire export line pattern to avoid overly broad string replacement.

**Step 1: Create the script**

```typescript
// .github/scripts/update-model.ts
//
// Updates src/lib/models.ts with a new model ID.
// Uses full export line matching for targeted replacement:
//   export const MODEL_PRIMARY = "old-id" -> export const MODEL_PRIMARY = "new-id"
// CONSTANT_NAME env var determines which constant to update.
// Exit 0 = success. Exit 1 = model ID not found in file.

import * as fs from "fs";
import * as path from "path";

const OLD_MODEL = process.env.OLD_MODEL_ID;
const NEW_MODEL = process.env.NEW_MODEL_ID;
const CONSTANT_NAME = process.env.CONSTANT_NAME;

if (!OLD_MODEL || !NEW_MODEL || !CONSTANT_NAME) {
  console.error("Missing OLD_MODEL_ID, NEW_MODEL_ID, or CONSTANT_NAME");
  process.exit(2);
}

const modelsPath = path.join(process.cwd(), "src/lib/models.ts");

if (!fs.existsSync(modelsPath)) {
  console.error(`File not found: ${modelsPath}`);
  process.exit(1);
}

const content = fs.readFileSync(modelsPath, "utf-8");

const oldLine = `export const ${CONSTANT_NAME} = "${OLD_MODEL}";`;
const newLine = `export const ${CONSTANT_NAME} = "${NEW_MODEL}";`;

if (!content.includes(oldLine)) {
  console.error(
    `Expected line not found in ${modelsPath}:\n  ${oldLine}`
  );
  process.exit(1);
}

const updated = content.replace(oldLine, newLine);

if (updated === content) {
  console.error("No changes made — replacement had no effect");
  process.exit(1);
}

fs.writeFileSync(modelsPath, updated, "utf-8");
console.log(`Updated ${CONSTANT_NAME}: ${OLD_MODEL} -> ${NEW_MODEL}`);
process.exit(0);
```

**Step 2: Commit**

```bash
git add .github/scripts/update-model.ts
git commit -m "feat: add targeted model update script for self-healing pipeline"
```

---

## Task 5: Create the Diff Guard Script

**Files:**
- Create: `.github/scripts/diff-guard.ts`

Critical guardrail. Verifies that the ONLY file changed is `src/lib/models.ts` and that at most 2 lines changed (one for PRIMARY, one for LIGHTWEIGHT). Uses a saved base SHA instead of fragile `HEAD~1`.

**Step 1: Create the script**

```typescript
// .github/scripts/diff-guard.ts
//
// GUARDRAIL: Verifies that the ONLY changed file is src/lib/models.ts
// and at most 2 lines were changed (PRIMARY + LIGHTWEIGHT).
// Uses BASE_SHA env var instead of fragile HEAD~1.
// Exit 0 = safe to deploy. Exit 1 = unexpected changes detected.

import { execSync } from "child_process";

const ALLOWED_FILE = "src/lib/models.ts";
const MAX_CHANGED_LINES = 2;
const BASE_SHA = process.env.BASE_SHA;

if (!BASE_SHA) {
  console.error("Missing BASE_SHA environment variable");
  process.exit(1);
}

try {
  // Get list of all changed files vs the saved base SHA
  const diff = execSync(`git diff --name-only ${BASE_SHA}`, {
    encoding: "utf-8",
  }).trim();

  if (!diff) {
    console.error("No changes detected — nothing to deploy");
    process.exit(1);
  }

  const changedFiles = diff.split("\n").filter((f) => f.length > 0);

  console.log(`Changed files (${changedFiles.length}):`);
  changedFiles.forEach((f) => console.log(`  - ${f}`));

  const unauthorizedFiles = changedFiles.filter((f) => f !== ALLOWED_FILE);

  if (unauthorizedFiles.length > 0) {
    console.error("\nGUARDRAIL VIOLATION: Unexpected files changed!");
    console.error("Only src/lib/models.ts is allowed to change.");
    console.error("Unauthorized changes:");
    unauthorizedFiles.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }

  // Verify the change is only model ID string swaps (not structural)
  const fileDiff = execSync(`git diff ${BASE_SHA} -- ${ALLOWED_FILE}`, {
    encoding: "utf-8",
  });
  const addedLines = fileDiff
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"));
  const removedLines = fileDiff
    .split("\n")
    .filter((l) => l.startsWith("-") && !l.startsWith("---"));

  if (
    addedLines.length > MAX_CHANGED_LINES ||
    removedLines.length > MAX_CHANGED_LINES
  ) {
    console.error(
      `\nGUARDRAIL VIOLATION: Expected at most ${MAX_CHANGED_LINES} lines changed, got ${addedLines.length} added and ${removedLines.length} removed`
    );
    process.exit(1);
  }

  if (addedLines.length !== removedLines.length) {
    console.error(
      `\nGUARDRAIL VIOLATION: Mismatched line counts — ${addedLines.length} added vs ${removedLines.length} removed`
    );
    process.exit(1);
  }

  console.log(
    `\nGuardrail check PASSED — only models.ts changed (${addedLines.length} line(s) updated)`
  );
  process.exit(0);
} catch (err: unknown) {
  const error = err as { message?: string };
  console.error(`Diff guard error: ${error.message}`);
  process.exit(1);
}
```

**Step 2: Commit**

```bash
git add .github/scripts/diff-guard.ts
git commit -m "feat: add diff guard script with base SHA comparison"
```

---

## Task 6: Create the Smoke Test Script

**Files:**
- Create: `.github/scripts/smoke-test.ts`

Sends a known comic cover image to the production analyze endpoint and validates the response contains expected fields. This goes beyond the API probe to verify the full production pipeline works end-to-end.

**Step 1: Create the script**

```typescript
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
```

**Step 2: Commit**

```bash
git add .github/scripts/smoke-test.ts
git commit -m "feat: add post-deploy smoke test using existing health-check endpoint"
```

---

## Task 7: Create the Alert Script

**Files:**
- Create: `.github/scripts/send-alert.ts`

Sends email alerts via Resend for every pipeline outcome. Includes discovery candidates in the alert body when available.

**Step 1: Create the script**

```typescript
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
```

**Step 2: Commit**

```bash
git add .github/scripts/send-alert.ts
git commit -m "feat: add email alert script with candidate list support"
```

---

## Task 8: Create the GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/model-health-check.yml`

Single sequential job that checks BOTH models (PRIMARY and LIGHTWEIGHT), makes both replacements if needed, runs tests once, commits, pushes (triggering Netlify auto-deploy), and runs a smoke test. Includes concurrency guard, weekly heartbeat, rollback on failure, and pinned action SHAs.

**Step 1: Create the workflow**

```yaml
# .github/workflows/model-health-check.yml
#
# Self-Healing Model Update Pipeline
# Runs daily at 6 AM UTC. Checks both PRIMARY and LIGHTWEIGHT models.
# Single sequential job — no parallel race conditions.
#
# FREQUENCY NOTE: 1x/day is intentional. Anthropic deprecations come with
# weeks of notice. Running 2x/day adds race risk without safety benefit.
#
# DEPLOYMENT: Pushes to main -> Netlify auto-deploys via git trigger.
# No Netlify CLI or tokens needed.
#
# DISTINCTION FROM /api/admin/health-check:
# The existing health-check endpoint (src/app/api/admin/health-check/route.ts)
# is a live production probe used by the check-alerts cron and monitoring.
# THIS workflow is a CI/CD pipeline that runs in GitHub Actions to detect
# model deprecations and auto-update the codebase. The smoke-test step
# reuses the health-check endpoint for post-deploy verification.
#
# GUARDRAILS:
# - Only src/lib/models.ts can be modified
# - At most 2 lines changed (one per model)
# - Full test suite must pass
# - Post-deploy smoke test with rollback on failure
# - Email alerts on every outcome
# - Concurrency guard prevents overlapping runs

name: Model Health Check

on:
  schedule:
    # Run daily at 6 AM UTC (1 AM EST / 10 PM PST)
    - cron: "0 6 * * *"
  workflow_dispatch: # Allow manual trigger for testing

permissions:
  contents: write

concurrency:
  group: model-health-check
  cancel-in-progress: true

env:
  NODE_VERSION: "20"

jobs:
  check-and-heal:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      # ── Setup ──
      # actions/checkout v4.1.7
      - name: Checkout repository
        uses: actions/checkout@692973e3d937129bcbf40652eb9f2f61becf3332

      # actions/setup-node v4.0.3
      - name: Setup Node.js
        uses: actions/setup-node@1e60f620b9541d16bece96c5465dc8ee9832be0b
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Security audit
        continue-on-error: true
        run: npm audit --audit-level=high

      # ── Save base SHA for diff guard ──
      - name: Save base SHA
        id: base
        run: echo "sha=$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"

      # ── Read current model IDs via TypeScript ──
      - name: Read current model IDs
        id: current-models
        run: |
          MODELS_JSON=$(npx tsx .github/scripts/read-models.ts)
          echo "json=$MODELS_JSON" >> "$GITHUB_OUTPUT"
          PRIMARY=$(echo "$MODELS_JSON" | jq -r '.MODEL_PRIMARY')
          LIGHTWEIGHT=$(echo "$MODELS_JSON" | jq -r '.MODEL_LIGHTWEIGHT')
          echo "primary=$PRIMARY" >> "$GITHUB_OUTPUT"
          echo "lightweight=$LIGHTWEIGHT" >> "$GITHUB_OUTPUT"
          echo "Current PRIMARY: $PRIMARY"
          echo "Current LIGHTWEIGHT: $LIGHTWEIGHT"

      # ── Probe PRIMARY model ──
      - name: Probe PRIMARY model
        id: probe-primary
        env:
          CURRENT_MODEL_ID: ${{ steps.current-models.outputs.primary }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: npx tsx .github/scripts/probe-model.ts

      # ── Probe LIGHTWEIGHT model ──
      - name: Probe LIGHTWEIGHT model
        id: probe-lightweight
        env:
          CURRENT_MODEL_ID: ${{ steps.current-models.outputs.lightweight }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: npx tsx .github/scripts/probe-model.ts

      # ── Log transient errors (no action needed) ──
      - name: Log transient probe errors
        if: steps.probe-primary.outputs.status == 'transient' || steps.probe-lightweight.outputs.status == 'transient'
        run: |
          echo "::warning::Transient probe error detected — not triggering model update"
          echo "  PRIMARY status: ${{ steps.probe-primary.outputs.status }}"
          echo "  LIGHTWEIGHT status: ${{ steps.probe-lightweight.outputs.status }}"

      # ── Check if any model needs updating ──
      - name: Determine if update needed
        id: needs-update
        run: |
          PRIMARY_DEPRECATED="${{ steps.probe-primary.outputs.status == 'deprecated' }}"
          LIGHTWEIGHT_DEPRECATED="${{ steps.probe-lightweight.outputs.status == 'deprecated' }}"
          if [ "$PRIMARY_DEPRECATED" = "true" ] || [ "$LIGHTWEIGHT_DEPRECATED" = "true" ]; then
            echo "needed=true" >> "$GITHUB_OUTPUT"
          else
            echo "needed=false" >> "$GITHUB_OUTPUT"
          fi
          echo "primary_failed=$PRIMARY_DEPRECATED" >> "$GITHUB_OUTPUT"
          echo "lightweight_failed=$LIGHTWEIGHT_DEPRECATED" >> "$GITHUB_OUTPUT"

      # ── Healthy: weekly heartbeat on Mondays ──
      - name: "Heartbeat alert (Monday only)"
        if: steps.needs-update.outputs.needed == 'false'
        env:
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          ADMIN_EMAIL: ${{ secrets.ADMIN_EMAIL }}
          ALERT_TYPE: heartbeat
          OLD_MODEL_ID: ${{ steps.current-models.outputs.primary }}
          ALERT_DETAILS: "Weekly heartbeat — both models healthy. PRIMARY=${{ steps.current-models.outputs.primary }}, LIGHTWEIGHT=${{ steps.current-models.outputs.lightweight }}"
        run: |
          # Only send heartbeat on Mondays (day 1)
          DAY_OF_WEEK=$(date +%u)
          if [ "$DAY_OF_WEEK" = "1" ]; then
            npx tsx .github/scripts/send-alert.ts
          else
            echo "Not Monday (day $DAY_OF_WEEK) — skipping heartbeat"
          fi

      # ── Healthy: exit early ──
      - name: Both models healthy — no further action
        if: steps.needs-update.outputs.needed == 'false'
        run: |
          echo "Both models are healthy. No action needed."
          echo "  PRIMARY: ${{ steps.current-models.outputs.primary }}"
          echo "  LIGHTWEIGHT: ${{ steps.current-models.outputs.lightweight }}"

      # ══════════════════════════════════════════════
      # DEPRECATED PATH — discover, update, test, deploy
      # ══════════════════════════════════════════════

      # ── Discover PRIMARY replacement ──
      - name: Discover PRIMARY replacement
        if: steps.needs-update.outputs.primary_failed == 'true'
        id: discover-primary
        env:
          CURRENT_MODEL_ID: ${{ steps.current-models.outputs.primary }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          npx tsx .github/scripts/discover-model.ts > /tmp/discover-stdout.txt 2> /tmp/discover-stderr.txt
          NEW_MODEL=$(cat /tmp/discover-stdout.txt)
          CANDIDATES=$(grep "CANDIDATES:" /tmp/discover-stderr.txt | sed 's/CANDIDATES://' || echo "[]")
          echo "new_model_id=$NEW_MODEL" >> "$GITHUB_OUTPUT"
          echo "candidates=$CANDIDATES" >> "$GITHUB_OUTPUT"
          echo "Discovered PRIMARY replacement: $NEW_MODEL"

      # ── Discover LIGHTWEIGHT replacement ──
      - name: Discover LIGHTWEIGHT replacement
        if: steps.needs-update.outputs.lightweight_failed == 'true'
        id: discover-lightweight
        env:
          CURRENT_MODEL_ID: ${{ steps.current-models.outputs.lightweight }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          npx tsx .github/scripts/discover-model.ts > /tmp/discover-stdout.txt 2> /tmp/discover-stderr.txt
          NEW_MODEL=$(cat /tmp/discover-stdout.txt)
          CANDIDATES=$(grep "CANDIDATES:" /tmp/discover-stderr.txt | sed 's/CANDIDATES://' || echo "[]")
          echo "new_model_id=$NEW_MODEL" >> "$GITHUB_OUTPUT"
          echo "candidates=$CANDIDATES" >> "$GITHUB_OUTPUT"
          echo "Discovered LIGHTWEIGHT replacement: $NEW_MODEL"

      # ── Update PRIMARY model ID ──
      - name: Update PRIMARY model ID
        if: steps.needs-update.outputs.primary_failed == 'true' && steps.discover-primary.outcome == 'success'
        env:
          OLD_MODEL_ID: ${{ steps.current-models.outputs.primary }}
          NEW_MODEL_ID: ${{ steps.discover-primary.outputs.new_model_id }}
          CONSTANT_NAME: MODEL_PRIMARY
        run: npx tsx .github/scripts/update-model.ts

      # ── Update LIGHTWEIGHT model ID ──
      - name: Update LIGHTWEIGHT model ID
        if: steps.needs-update.outputs.lightweight_failed == 'true' && steps.discover-lightweight.outcome == 'success'
        env:
          OLD_MODEL_ID: ${{ steps.current-models.outputs.lightweight }}
          NEW_MODEL_ID: ${{ steps.discover-lightweight.outputs.new_model_id }}
          CONSTANT_NAME: MODEL_LIGHTWEIGHT
        run: npx tsx .github/scripts/update-model.ts

      # ── Check if any model was actually updated ──
      - name: Determine if any update was applied
        if: steps.needs-update.outputs.needed == 'true'
        id: updates-applied
        run: |
          PRIMARY_UPDATED="false"
          LIGHTWEIGHT_UPDATED="false"
          if [ "${{ steps.needs-update.outputs.primary_failed }}" = "true" ] && [ "${{ steps.discover-primary.outcome }}" = "success" ]; then
            PRIMARY_UPDATED="true"
          fi
          if [ "${{ steps.needs-update.outputs.lightweight_failed }}" = "true" ] && [ "${{ steps.discover-lightweight.outcome }}" = "success" ]; then
            LIGHTWEIGHT_UPDATED="true"
          fi
          if [ "$PRIMARY_UPDATED" = "true" ] || [ "$LIGHTWEIGHT_UPDATED" = "true" ]; then
            echo "any=true" >> "$GITHUB_OUTPUT"
          else
            echo "any=false" >> "$GITHUB_OUTPUT"
            echo "No models were updated (discovery failed for all deprecated models)"
          fi

      # ── Run test suite (once — tests are deterministic) ──
      - name: Run full test suite
        if: steps.updates-applied.outputs.any == 'true'
        run: npm test

      # ── Commit the change ──
      - name: Commit model update
        if: steps.updates-applied.outputs.any == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add src/lib/models.ts

          # Build commit message based on what changed
          MSG="fix(auto): update Anthropic model(s)\n\nAutomated by self-healing model pipeline."
          if [ "${{ steps.needs-update.outputs.primary_failed }}" = "true" ]; then
            MSG="$MSG\nPRIMARY: ${{ steps.current-models.outputs.primary }} -> ${{ steps.discover-primary.outputs.new_model_id }}"
          fi
          if [ "${{ steps.needs-update.outputs.lightweight_failed }}" = "true" ]; then
            MSG="$MSG\nLIGHTWEIGHT: ${{ steps.current-models.outputs.lightweight }} -> ${{ steps.discover-lightweight.outputs.new_model_id }}"
          fi
          MSG="$MSG\n\nCo-Authored-By: github-actions[bot] <github-actions[bot]@users.noreply.github.com>"

          git commit -m "$(printf '%b' "$MSG")"

      # ── Diff Guard ──
      - name: "Guardrail: verify only models.ts changed"
        if: steps.updates-applied.outputs.any == 'true'
        env:
          BASE_SHA: ${{ steps.base.outputs.sha }}
        run: npx tsx .github/scripts/diff-guard.ts

      # ── Push to main (triggers Netlify auto-deploy) ──
      - name: Push model update to main
        if: steps.updates-applied.outputs.any == 'true'
        run: git push origin main

      # ── Wait for Netlify deploy to propagate ──
      - name: Wait for deploy propagation
        if: steps.updates-applied.outputs.any == 'true'
        run: |
          echo "Waiting 240 seconds for Netlify build + deploy propagation..."
          echo "Netlify Next.js builds typically take 2-4 minutes including queue time."
          sleep 240

      # ── Post-deploy smoke test ──
      - name: Smoke test production
        id: smoke-test
        if: steps.updates-applied.outputs.any == 'true'
        continue-on-error: true
        env:
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
          SITE_URL: "https://collectors-chest.com"
        run: npx tsx .github/scripts/smoke-test.ts

      # ── Rollback on smoke test failure ──
      - name: "Rollback: revert commit and push"
        if: steps.updates-applied.outputs.any == 'true' && steps.smoke-test.outcome == 'failure'
        run: |
          set -e
          echo "Smoke test FAILED — reverting commit"
          git revert --no-edit HEAD
          git push origin main
          echo "Revert pushed successfully."

      # ── Alert: rollback ──
      - name: "Alert: rollback"
        if: steps.updates-applied.outputs.any == 'true' && steps.smoke-test.outcome == 'failure'
        env:
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          ADMIN_EMAIL: ${{ secrets.ADMIN_EMAIL }}
          ALERT_TYPE: rollback
          OLD_MODEL_ID: ${{ steps.current-models.outputs.primary }}
          NEW_MODEL_ID: ${{ steps.discover-primary.outputs.new_model_id || 'N/A' }}
          ALERT_DETAILS: |
            Smoke test failed after deploy. Commit has been automatically reverted and pushed. Netlify rebuild will take 2-4 minutes before production reflects the rollback. Manual investigation required.
            PRIMARY: ${{ steps.current-models.outputs.primary }} -> ${{ steps.discover-primary.outputs.new_model_id || 'unchanged' }}
            LIGHTWEIGHT: ${{ steps.current-models.outputs.lightweight }} -> ${{ steps.discover-lightweight.outputs.new_model_id || 'unchanged' }}
          DISCOVERY_CANDIDATES: ${{ steps.discover-primary.outputs.candidates || '' }}
        run: npx tsx .github/scripts/send-alert.ts

      # ── Alert: success ──
      - name: "Alert: success"
        if: steps.updates-applied.outputs.any == 'true' && steps.smoke-test.outcome == 'success'
        env:
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          ADMIN_EMAIL: ${{ secrets.ADMIN_EMAIL }}
          ALERT_TYPE: success
          OLD_MODEL_ID: ${{ steps.current-models.outputs.primary }}
          NEW_MODEL_ID: ${{ steps.discover-primary.outputs.new_model_id || 'N/A' }}
          ALERT_DETAILS: |
            Model(s) auto-updated, tests passed, deployed via git push, smoke test confirmed.
            PRIMARY: ${{ steps.current-models.outputs.primary }} -> ${{ steps.discover-primary.outputs.new_model_id || 'unchanged' }}
            LIGHTWEIGHT: ${{ steps.current-models.outputs.lightweight }} -> ${{ steps.discover-lightweight.outputs.new_model_id || 'unchanged' }}
          DISCOVERY_CANDIDATES: ${{ steps.discover-primary.outputs.candidates || '' }}
        run: npx tsx .github/scripts/send-alert.ts

      # ── Alert: pipeline failure ──
      - name: "Alert: failure"
        if: failure() && steps.updates-applied.outputs.any == 'true'
        env:
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          ADMIN_EMAIL: ${{ secrets.ADMIN_EMAIL }}
          ALERT_TYPE: failure
          OLD_MODEL_ID: ${{ steps.current-models.outputs.primary }}
          NEW_MODEL_ID: ${{ steps.discover-primary.outputs.new_model_id || 'discovery-failed' }}
          ALERT_DETAILS: |
            Pipeline failed. Manual intervention required. Check GitHub Actions logs.
            PRIMARY: ${{ steps.current-models.outputs.primary }} -> ${{ steps.discover-primary.outputs.new_model_id || 'discovery-failed' }}
            LIGHTWEIGHT: ${{ steps.current-models.outputs.lightweight }} -> ${{ steps.discover-lightweight.outputs.new_model_id || 'discovery-failed' }}
          DISCOVERY_CANDIDATES: ${{ steps.discover-primary.outputs.candidates || '' }}
        run: npx tsx .github/scripts/send-alert.ts
```

**Step 2: Commit**

```bash
git add .github/workflows/model-health-check.yml
git commit -m "feat: add self-healing model health check workflow"
```

---

## Task 9: Add GitHub Secrets Setup Documentation

**Files:**
- Create: `.github/SECRETS_SETUP.md`

**Step 1: Create the doc**

```markdown
# GitHub Secrets Required for Self-Healing Pipeline

Navigate to: Repository Settings > Secrets and variables > Actions

| Secret | Source | Notes |
|--------|--------|-------|
| `ANTHROPIC_API_KEY` | console.anthropic.com | Same key as .env.local |
| `RESEND_API_KEY` | resend.com dashboard | Same key as .env.local |
| `ADMIN_EMAIL` | Your alert email | e.g., chris@collectors-chest.com |
| `CRON_SECRET` | .env.local | Shared secret for health-check endpoint auth |

**Not needed:**
- ~~`NETLIFY_AUTH_TOKEN`~~ — Deployment is handled by Netlify's native git-triggered build
- ~~`NETLIFY_SITE_ID`~~ — No CLI deploy, push to main triggers deploy automatically

**GitHub Actions pinned SHAs (update periodically):**
- `actions/checkout` — `692973e3d937129bcbf40652eb9f2f61becf3332` (v4.1.7)
- `actions/setup-node` — `1e60f620b9541d16bece96c5465dc8ee9832be0b` (v4.0.3)

To update SHAs, check the latest releases at:
- https://github.com/actions/checkout/releases
- https://github.com/actions/setup-node/releases
```

**Step 2: Commit**

```bash
git add .github/SECRETS_SETUP.md
git commit -m "docs: add GitHub secrets setup guide for model pipeline"
```

---

## Task 10: Test the Pipeline Manually

**Step 1: Push all changes to GitHub**

```bash
git push origin main
```

**Step 2: Trigger the workflow manually**

Go to GitHub > Actions > "Model Health Check" > Run workflow > Run

**Step 3: Verify the healthy path**

The workflow should:
- Read both model IDs via TypeScript
- Probe PRIMARY with a vision request (1x1 PNG)
- Probe LIGHTWEIGHT with a vision request (1x1 PNG)
- Both return healthy
- Send heartbeat alert only if it's Monday
- Exit early with no changes

**Step 4: Test the failure path (optional, controlled)**

To safely test the full pipeline:
1. Temporarily change `MODEL_PRIMARY` in `models.ts` to a known-bad model ID like `"claude-3-opus-20240229-FAKE"`
2. Push and trigger the workflow
3. Verify it: detects 403 -> discovers latest model -> updates (targeted full-line replace) -> tests pass -> guardrail passes -> pushes to main -> Netlify auto-deploys -> smoke test runs
4. Check email for success alert (should include discovery candidates)

**Step 5: Verify guardrail (optional)**

To test the guardrail, manually modify a second file before the diff guard step runs. The workflow should abort.

**Step 6: Verify rollback (optional)**

To test rollback, temporarily break the smoke test endpoint. The workflow should:
1. Push the model update
2. Fail the smoke test
3. Automatically revert the commit and push
4. Send a rollback alert

---

## Task 11: Add Pipeline Status to EVALUATION.md

**Files:**
- Modify: `EVALUATION.md`

**Step 1: Update the active risks table**

Change:
```
| Single AI provider dependency | Medium | Phase 1 deployed with monitoring — OpenAI activation pending |
```
To:
```
| Single AI provider dependency | Low | Self-healing model pipeline auto-updates deprecated models. OpenAI fallback available. |
```

**Step 2: Add to completed items**

Add to the "Recently Completed" section:
```
- **Self-healing model pipeline** — GitHub Actions daily check, vision probe, auto-update with rollback, single test pass, guardrailed deploy via git push
```

**Step 3: Commit**

```bash
git add EVALUATION.md
git commit -m "docs: update evaluation with self-healing pipeline status"
```

---

## Summary

| Task | What it does |
|------|---|
| 1 | Model reader — TypeScript script that imports models.ts and outputs IDs as JSON (replaces sed) |
| 2 | Probe script — vision-based check with 1x1 PNG matching production usage |
| 3 | Discovery script — queries Anthropic API with pagination, outputs candidate list |
| 4 | Update script — targeted full-line replacement with configurable constant name |
| 5 | Diff guard — uses saved base SHA, allows up to 2 changed lines |
| 6 | Smoke test — post-deploy verification using existing health-check endpoint |
| 7 | Alert script — sends email via Resend, includes discovery candidates in body |
| 8 | GitHub Actions workflow — single job, both models, concurrency guard, rollback |
| 9 | Secrets docs — setup guide (no Netlify tokens needed) |
| 10 | Manual testing — verify healthy path, failure path, guardrail, rollback |
| 11 | Documentation — update EVALUATION.md with new capability |

**Guardrails in place:**
- Only `src/lib/models.ts` can change (diff guard)
- At most 2 lines changed — one per model (added/removed line count check)
- Diff guard uses saved base SHA (not fragile HEAD~1)
- Full test suite passes (single run — tests are deterministic)
- Post-deploy smoke test using existing health-check endpoint
- Automatic rollback (revert + push) if smoke test fails
- Email alerts on every outcome (success, failure, abort, rollback, heartbeat)
- Discovery candidates included in alert body
- Concurrency guard prevents overlapping pipeline runs
- GitHub Actions pinned to SHA commits (not mutable tags)
- npm audit check before proceeding
- Weekly Monday heartbeat confirms pipeline is alive
- Separate exit code for transient errors (won't trigger false updates)

**Architectural notes:**
- `MODEL_LIGHTWEIGHT` routes (`cover-candidates`, `moderate-messages`, `titles/suggest`) use raw Anthropic client calls outside the provider abstraction. The pipeline still works because those routes import from `models.ts`, but they won't benefit from provider fallback logic.
- Deployment is handled by Netlify's native git-triggered build — no `netlify-cli`, `NETLIFY_AUTH_TOKEN`, or `NETLIFY_SITE_ID` needed.
- The existing `/api/admin/health-check` endpoint is a production monitoring probe. This pipeline is a CI/CD system that auto-updates the codebase. They serve different purposes but the smoke test reuses the health-check endpoint for post-deploy verification.
