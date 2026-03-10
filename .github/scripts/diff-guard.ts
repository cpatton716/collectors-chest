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
