# Self-Healing Model Update Pipeline — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a GitHub Actions pipeline that runs daily, checks if the current Anthropic model is still available, and if deprecated (403), automatically discovers the latest model, updates the code, validates with two test passes, and deploys only that change to production.

**Architecture:** A GitHub Actions workflow on a daily cron schedule clones the repo, probes the Anthropic API with the current model ID, and exits early if healthy. On failure, it queries the Anthropic Models API to find the latest replacement, updates `src/lib/models.ts`, runs the full test suite twice, verifies via git diff that ONLY `models.ts` changed, deploys to Netlify via CLI, and probes the live site post-deploy. Email alerts sent on every outcome (success, failure, abort).

**Tech Stack:** GitHub Actions, Anthropic API (models endpoint), Netlify CLI, Node.js, Resend (email alerts)

---

## Prerequisites

Before starting, ensure you have:
- GitHub repo access (to add Actions workflows and secrets)
- These secrets ready to add to GitHub Settings > Secrets:
  - `ANTHROPIC_API_KEY` — Anthropic API key
  - `NETLIFY_AUTH_TOKEN` — Netlify personal access token (Site settings > General > API)
  - `NETLIFY_SITE_ID` — Netlify site ID (Site settings > General > Site ID)
  - `RESEND_API_KEY` — For email alerts
  - `ADMIN_EMAIL` — Alert recipient email

---

## Task 1: Create the Model Probe Script

**Files:**
- Create: `.github/scripts/probe-model.ts`

This script probes the Anthropic API with the current model to check if it's still available. Exit code 0 = healthy, exit code 1 = deprecated/unavailable.

**Step 1: Create the script**

```typescript
// .github/scripts/probe-model.ts
//
// Probes the current Anthropic model with a minimal API call.
// Exit 0 = model is healthy. Exit 1 = model is unavailable (403/404).
// Outputs the error type to stdout for the workflow to read.

import Anthropic from "@anthropic-ai/sdk";

const MODEL_ID = process.env.CURRENT_MODEL_ID;
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!MODEL_ID || !API_KEY) {
  console.error("Missing CURRENT_MODEL_ID or ANTHROPIC_API_KEY");
  process.exit(2);
}

async function probe(): Promise<void> {
  const client = new Anthropic({ apiKey: API_KEY });

  try {
    await client.messages.create({
      model: MODEL_ID!,
      max_tokens: 10,
      messages: [{ role: "user", content: "Say OK" }],
    });
    console.log(`Model ${MODEL_ID} is healthy`);
    process.exit(0);
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    const status = error.status || 0;
    const message = error.message || "Unknown error";

    if (status === 403 || status === 404) {
      console.log(`MODEL_DEPRECATED: ${MODEL_ID} returned ${status}: ${message}`);
      process.exit(1);
    }

    // Other errors (rate limit, server error) — don't trigger model change
    console.error(`Transient error (${status}): ${message}`);
    process.exit(2);
  }
}

probe();
```

**Step 2: Verify the script compiles**

Run: `npx tsx .github/scripts/probe-model.ts` (will fail without env vars, that's expected — just verify no syntax errors)

**Step 3: Commit**

```bash
git add .github/scripts/probe-model.ts
git commit -m "feat: add model probe script for self-healing pipeline"
```

---

## Task 2: Create the Model Discovery Script

**Files:**
- Create: `.github/scripts/discover-model.ts`

This script queries the Anthropic API to find the latest available model in the same family as the deprecated one.

**Step 1: Create the script**

```typescript
// .github/scripts/discover-model.ts
//
// Queries Anthropic's Models API to find the latest available model
// in the same family as the current (deprecated) model.
// Outputs the new model ID to stdout.
// Exit 0 = found replacement. Exit 1 = no replacement found.

import Anthropic from "@anthropic-ai/sdk";

const DEPRECATED_MODEL_ID = process.env.CURRENT_MODEL_ID;
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!DEPRECATED_MODEL_ID || !API_KEY) {
  console.error("Missing CURRENT_MODEL_ID or ANTHROPIC_API_KEY");
  process.exit(2);
}

// Extract the model family from the model ID.
// e.g., "claude-sonnet-4-20250514" -> "claude-sonnet-4"
// e.g., "claude-haiku-4-5-20251001" -> "claude-haiku-4-5"
function getModelFamily(modelId: string): string {
  // Remove the date suffix (last segment after the final hyphen that's all digits)
  const parts = modelId.split("-");
  // Walk backwards to find where the date portion starts
  while (parts.length > 0 && /^\d+$/.test(parts[parts.length - 1])) {
    parts.pop();
  }
  return parts.join("-");
}

async function discover(): Promise<void> {
  const client = new Anthropic({ apiKey: API_KEY });
  const family = getModelFamily(DEPRECATED_MODEL_ID!);

  console.error(`Looking for models in family: ${family}`);

  try {
    // List all available models
    const response = await client.models.list({ limit: 100 });
    const models = response.data;

    // Filter to same family, sort by created_at descending (newest first)
    const candidates = models
      .filter((m) => {
        const candidateFamily = getModelFamily(m.id);
        return candidateFamily === family && m.id !== DEPRECATED_MODEL_ID;
      })
      .sort((a, b) => {
        // Sort by created_at descending
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });

    if (candidates.length === 0) {
      console.error(`No replacement models found in family "${family}"`);
      console.error(`Available models: ${models.map((m) => m.id).join(", ")}`);
      process.exit(1);
    }

    const newModel = candidates[0];
    console.error(`Found replacement: ${newModel.id} (created: ${newModel.created_at})`);

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
git commit -m "feat: add model discovery script for self-healing pipeline"
```

---

## Task 3: Create the Model Update Script

**Files:**
- Create: `.github/scripts/update-model.ts`

This script updates `src/lib/models.ts` with the new model ID. It only replaces the specific constant that matches the deprecated model.

**Step 1: Create the script**

```typescript
// .github/scripts/update-model.ts
//
// Updates src/lib/models.ts with a new model ID.
// Only replaces the exact model ID string — no other changes.
// Exit 0 = success. Exit 1 = model ID not found in file.

import * as fs from "fs";
import * as path from "path";

const OLD_MODEL = process.env.OLD_MODEL_ID;
const NEW_MODEL = process.env.NEW_MODEL_ID;

if (!OLD_MODEL || !NEW_MODEL) {
  console.error("Missing OLD_MODEL_ID or NEW_MODEL_ID");
  process.exit(2);
}

const modelsPath = path.join(process.cwd(), "src/lib/models.ts");

if (!fs.existsSync(modelsPath)) {
  console.error(`File not found: ${modelsPath}`);
  process.exit(1);
}

const content = fs.readFileSync(modelsPath, "utf-8");

if (!content.includes(`"${OLD_MODEL}"`)) {
  console.error(`Model ID "${OLD_MODEL}" not found in ${modelsPath}`);
  process.exit(1);
}

const updated = content.replace(`"${OLD_MODEL}"`, `"${NEW_MODEL}"`);

if (updated === content) {
  console.error("No changes made — replacement had no effect");
  process.exit(1);
}

fs.writeFileSync(modelsPath, updated, "utf-8");
console.log(`Updated ${OLD_MODEL} -> ${NEW_MODEL} in ${modelsPath}`);
process.exit(0);
```

**Step 2: Commit**

```bash
git add .github/scripts/update-model.ts
git commit -m "feat: add model update script for self-healing pipeline"
```

---

## Task 4: Create the Diff Guard Script

**Files:**
- Create: `.github/scripts/diff-guard.ts`

This is the critical guardrail. It verifies that the ONLY file changed is `src/lib/models.ts`. If any other file was modified, it aborts the entire pipeline.

**Step 1: Create the script**

```typescript
// .github/scripts/diff-guard.ts
//
// GUARDRAIL: Verifies that the ONLY changed file is src/lib/models.ts.
// This prevents any accidental code changes from being deployed.
// Exit 0 = safe to deploy. Exit 1 = unexpected changes detected.

import { execSync } from "child_process";

const ALLOWED_FILE = "src/lib/models.ts";

try {
  // Get list of all changed files vs the main branch
  const diff = execSync("git diff --name-only HEAD~1", { encoding: "utf-8" }).trim();

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

  // Verify the change is only a model ID string swap (not structural)
  const fileDiff = execSync(`git diff HEAD~1 -- ${ALLOWED_FILE}`, { encoding: "utf-8" });
  const addedLines = fileDiff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));
  const removedLines = fileDiff.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---"));

  if (addedLines.length !== 1 || removedLines.length !== 1) {
    console.error(`\nGUARDRAIL VIOLATION: Expected exactly 1 line changed, got ${addedLines.length} added and ${removedLines.length} removed`);
    process.exit(1);
  }

  console.log("\nGuardrail check PASSED — only models.ts model ID changed");
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
git commit -m "feat: add diff guard script for deploy safety"
```

---

## Task 5: Create the Alert Script

**Files:**
- Create: `.github/scripts/send-alert.ts`

Sends email alerts via Resend for every pipeline outcome (success, failure, abort).

**Step 1: Create the script**

```typescript
// .github/scripts/send-alert.ts
//
// Sends email alert via Resend API.
// Usage: ALERT_TYPE=success|failure|abort ALERT_DETAILS="..." npx tsx send-alert.ts

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ALERT_TYPE = process.env.ALERT_TYPE || "info";
const ALERT_DETAILS = process.env.ALERT_DETAILS || "No details provided";
const OLD_MODEL = process.env.OLD_MODEL_ID || "unknown";
const NEW_MODEL = process.env.NEW_MODEL_ID || "unknown";

if (!RESEND_API_KEY || !ADMIN_EMAIL) {
  console.error("Missing RESEND_API_KEY or ADMIN_EMAIL — skipping alert");
  process.exit(0); // Don't fail the pipeline over alerts
}

const subjects: Record<string, string> = {
  success: `[Collectors Chest] Model auto-updated: ${OLD_MODEL} -> ${NEW_MODEL}`,
  failure: `[Collectors Chest] Model auto-update FAILED — manual intervention needed`,
  abort: `[Collectors Chest] Model auto-update ABORTED — guardrail triggered`,
  healthy: `[Collectors Chest] Daily model check — all healthy`,
};

const subject = subjects[ALERT_TYPE] || `[Collectors Chest] Model Pipeline: ${ALERT_TYPE}`;

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
git commit -m "feat: add email alert script for model pipeline"
```

---

## Task 6: Create the GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/model-health-check.yml`

This is the main orchestration workflow that ties all the scripts together.

**Step 1: Create the workflow**

```yaml
# .github/workflows/model-health-check.yml
#
# Self-Healing Model Update Pipeline
# Runs daily, checks Anthropic model availability, auto-updates if deprecated.
#
# GUARDRAILS:
# - Only src/lib/models.ts can be modified
# - Exactly 1 line change allowed (model ID swap)
# - Two-pass test validation required
# - Post-deploy production probe required
# - Email alerts on every outcome

name: Model Health Check

on:
  schedule:
    # Run daily at 6 AM UTC (1 AM EST / 10 PM PST)
    - cron: "0 6 * * *"
  workflow_dispatch: # Allow manual trigger for testing

permissions:
  contents: write

env:
  NODE_VERSION: "20"

jobs:
  check-and-heal:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      # ── Setup ──
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      # ── Read current model ID ──
      - name: Read current model ID
        id: current-model
        run: |
          MODEL_ID=$(grep 'MODEL_PRIMARY' src/lib/models.ts | head -1 | sed 's/.*"\(.*\)".*/\1/')
          echo "model_id=$MODEL_ID" >> "$GITHUB_OUTPUT"
          echo "Current primary model: $MODEL_ID"

      # ── Probe current model ──
      - name: Probe current model
        id: probe
        continue-on-error: true
        env:
          CURRENT_MODEL_ID: ${{ steps.current-model.outputs.model_id }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: npx tsx .github/scripts/probe-model.ts

      # ── Healthy: exit early ──
      - name: Model is healthy — exit
        if: steps.probe.outcome == 'success'
        run: echo "Model ${{ steps.current-model.outputs.model_id }} is healthy. No action needed."

      # ── Deprecated: discover replacement ──
      - name: Discover latest model
        if: steps.probe.outcome == 'failure'
        id: discover
        env:
          CURRENT_MODEL_ID: ${{ steps.current-model.outputs.model_id }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          NEW_MODEL=$(npx tsx .github/scripts/discover-model.ts)
          echo "new_model_id=$NEW_MODEL" >> "$GITHUB_OUTPUT"
          echo "Discovered replacement: $NEW_MODEL"

      # ── Update model ID in code ──
      - name: Update model ID
        if: steps.probe.outcome == 'failure'
        env:
          OLD_MODEL_ID: ${{ steps.current-model.outputs.model_id }}
          NEW_MODEL_ID: ${{ steps.discover.outputs.new_model_id }}
        run: npx tsx .github/scripts/update-model.ts

      # ── Test Pass 1 ──
      - name: "Test pass 1: Run full test suite"
        if: steps.probe.outcome == 'failure'
        run: npm test

      # ── Test Pass 2 ──
      - name: "Test pass 2: Run full test suite again"
        if: steps.probe.outcome == 'failure'
        run: npm test

      # ── Commit the change ──
      - name: Commit model update
        if: steps.probe.outcome == 'failure'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add src/lib/models.ts
          git commit -m "fix(auto): update Anthropic model ${{ steps.current-model.outputs.model_id }} -> ${{ steps.discover.outputs.new_model_id }}

          Automated by self-healing model pipeline.
          Previous model returned 403 (deprecated).

          Co-Authored-By: github-actions[bot] <github-actions[bot]@users.noreply.github.com>"

      # ── Diff Guard ──
      - name: "Guardrail: verify only models.ts changed"
        if: steps.probe.outcome == 'failure'
        run: npx tsx .github/scripts/diff-guard.ts

      # ── Deploy to Netlify ──
      - name: Deploy to Netlify
        if: steps.probe.outcome == 'failure'
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
        run: |
          npm run build
          npx netlify-cli deploy --prod --dir=.next --site=$NETLIFY_SITE_ID --auth=$NETLIFY_AUTH_TOKEN

      # ── Push commit to repo ──
      - name: Push model update to main
        if: steps.probe.outcome == 'failure'
        run: git push origin main

      # ── Post-deploy verification ──
      - name: Probe production with new model
        if: steps.probe.outcome == 'failure'
        env:
          CURRENT_MODEL_ID: ${{ steps.discover.outputs.new_model_id }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: npx tsx .github/scripts/probe-model.ts

      # ── Alerts ──
      - name: "Alert: success"
        if: steps.probe.outcome == 'failure' && success()
        env:
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          ADMIN_EMAIL: ${{ secrets.ADMIN_EMAIL }}
          ALERT_TYPE: success
          OLD_MODEL_ID: ${{ steps.current-model.outputs.model_id }}
          NEW_MODEL_ID: ${{ steps.discover.outputs.new_model_id }}
          ALERT_DETAILS: "Model auto-updated and deployed successfully. All tests passed (2 runs). Production probe confirmed."
        run: npx tsx .github/scripts/send-alert.ts

      - name: "Alert: failure"
        if: steps.probe.outcome == 'failure' && failure()
        env:
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          ADMIN_EMAIL: ${{ secrets.ADMIN_EMAIL }}
          ALERT_TYPE: failure
          OLD_MODEL_ID: ${{ steps.current-model.outputs.model_id }}
          NEW_MODEL_ID: ${{ steps.discover.outputs.new_model_id || 'discovery-failed' }}
          ALERT_DETAILS: "Pipeline failed. Manual intervention required. Check GitHub Actions logs."
        run: npx tsx .github/scripts/send-alert.ts
```

**Step 2: Commit**

```bash
git add .github/workflows/model-health-check.yml
git commit -m "feat: add self-healing model health check workflow"
```

---

## Task 7: Create the Lightweight Model Check

The pipeline in Task 6 only checks `MODEL_PRIMARY`. We also need to handle `MODEL_LIGHTWEIGHT` (Haiku). Rather than duplicating the entire workflow, we add a second probe + update cycle to the same workflow.

**Files:**
- Modify: `.github/workflows/model-health-check.yml`

**Step 1: Add lightweight model steps**

After the primary model section, add a second parallel job `check-lightweight` that follows the same pattern but reads `MODEL_LIGHTWEIGHT` from `models.ts` instead. Use the same scripts — they're parameterized via `CURRENT_MODEL_ID` env var.

Add a second job to the workflow:

```yaml
  check-lightweight:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Read lightweight model ID
        id: current-model
        run: |
          MODEL_ID=$(grep 'MODEL_LIGHTWEIGHT' src/lib/models.ts | head -1 | sed 's/.*"\(.*\)".*/\1/')
          echo "model_id=$MODEL_ID" >> "$GITHUB_OUTPUT"
          echo "Current lightweight model: $MODEL_ID"

      # Same probe -> discover -> update -> test -> test -> guard -> deploy -> push -> probe flow
      # (identical steps as check-and-heal job but with MODEL_LIGHTWEIGHT)
```

**Step 2: Commit**

```bash
git add .github/workflows/model-health-check.yml
git commit -m "feat: add lightweight model check to self-healing pipeline"
```

---

## Task 8: Add GitHub Secrets Setup Documentation

**Files:**
- Create: `.github/SECRETS_SETUP.md`

**Step 1: Create the doc**

```markdown
# GitHub Secrets Required for Self-Healing Pipeline

Navigate to: Repository Settings > Secrets and variables > Actions

| Secret | Source | Notes |
|--------|--------|-------|
| `ANTHROPIC_API_KEY` | console.anthropic.com | Same key as .env.local |
| `NETLIFY_AUTH_TOKEN` | Netlify User Settings > Applications > Personal access tokens | Create a new token |
| `NETLIFY_SITE_ID` | Netlify Site Settings > General > Site ID | Copy the site ID |
| `RESEND_API_KEY` | resend.com dashboard | Same key as .env.local |
| `ADMIN_EMAIL` | Your alert email | e.g., chris@collectors-chest.com |
```

**Step 2: Commit**

```bash
git add .github/SECRETS_SETUP.md
git commit -m "docs: add GitHub secrets setup guide for model pipeline"
```

---

## Task 9: Test the Pipeline Manually

**Step 1: Push all changes to GitHub**

```bash
git push origin main
```

**Step 2: Trigger the workflow manually**

Go to GitHub > Actions > "Model Health Check" > Run workflow > Run

**Step 3: Verify the healthy path**

The workflow should:
- Probe the current model
- Get a healthy response
- Exit early with no changes
- No deploy, no alert

**Step 4: Test the failure path (optional, controlled)**

To safely test the full pipeline:
1. Temporarily change `MODEL_PRIMARY` in `models.ts` to a known-bad model ID like `"claude-3-opus-20240229-FAKE"`
2. Push and trigger the workflow
3. Verify it: detects 403 -> discovers latest model -> updates -> tests pass -> guardrail passes -> deploys -> probes production
4. Check email for success alert

**Step 5: Verify guardrail (optional)**

To test the guardrail, manually modify a second file before the diff guard step runs. The workflow should abort.

---

## Task 10: Add Pipeline Status to EVALUATION.md

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
- **Self-healing model pipeline** — GitHub Actions daily check, auto-update, two-pass testing, guardrailed deploy
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
| 1 | Probe script — checks if current model responds or returns 403 |
| 2 | Discovery script — queries Anthropic API for latest model in same family |
| 3 | Update script — swaps model ID string in `src/lib/models.ts` |
| 4 | Diff guard — ensures ONLY `models.ts` changed (1 line) |
| 5 | Alert script — sends email via Resend for all outcomes |
| 6 | GitHub Actions workflow — orchestrates the full pipeline |
| 7 | Lightweight model — extends pipeline to also check Haiku model |
| 8 | Secrets docs — setup guide for GitHub repository secrets |
| 9 | Manual testing — verify healthy path, failure path, guardrail |
| 10 | Documentation — update EVALUATION.md with new capability |

**Guardrails in place:**
- Only `src/lib/models.ts` can change (diff guard)
- Exactly 1 line changed (added/removed line count check)
- Two full test suite passes required
- Post-deploy production probe
- Email alerts on every outcome
- Separate exit code for transient errors (won't trigger false updates)
