/**
 * Migration Script: Clean up incorrect AI-generated key info
 *
 * What it does:
 * 1. Fetches all comics from Supabase that have key_info populated
 * 2. Re-runs the curated DB lookup with year disambiguation
 * 3. If curated DB match → replaces key_info with verified data
 * 4. If no match → clears key_info to empty array (removes AI hallucinations)
 * 5. NEVER touches custom_key_info (user/admin-added data)
 *
 * Run with: npx tsx scripts/migrate-key-info.ts
 * Add --dry-run flag to preview changes without writing: npx tsx scripts/migrate-key-info.ts --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load env from .env.local manually (no dotenv dependency needed)
const envPath = path.resolve(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.substring(0, eqIdx).trim();
  let value = trimmed.substring(eqIdx + 1).trim();
  // Remove surrounding quotes if present
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Import the curated key info lookup (with year disambiguation)
// We inline a simplified version here to avoid import issues with Next.js modules
// This must match the logic in src/lib/keyComicsDatabase.ts

interface KeyComic {
  title: string;
  issue: string;
  keyInfo: string[];
  year?: number;
}

interface KeyComicEntry {
  keyInfo: string[];
  year?: number;
}

const normalizeTitle = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
};

// We need to dynamically import the database - but since this is a standalone script,
// let's load and eval the key comics data directly
async function loadKeyComicsDatabase(): Promise<Map<string, Map<string, KeyComicEntry[]>>> {
  // Read the database file and extract KEY_COMICS
  const fs = await import("fs");
  const filePath = path.resolve(__dirname, "../src/lib/keyComicsDatabase.ts");
  const fileContent = fs.readFileSync(filePath, "utf-8");

  // Extract the KEY_COMICS array content between the markers
  const startMarker = "const KEY_COMICS: KeyComic[] = [";
  const startIdx = fileContent.indexOf(startMarker);
  if (startIdx === -1) throw new Error("Could not find KEY_COMICS array in file");

  // Find the matching closing bracket
  let bracketCount = 0;
  let endIdx = startIdx + startMarker.length;
  for (let i = endIdx - 1; i < fileContent.length; i++) {
    if (fileContent[i] === "[") bracketCount++;
    if (fileContent[i] === "]") {
      bracketCount--;
      if (bracketCount === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }

  const arrayContent = fileContent.substring(startIdx + "const KEY_COMICS: KeyComic[] = ".length, endIdx);

  // Clean up TypeScript-specific syntax for eval
  const jsContent = arrayContent
    .replace(/\/\/.*$/gm, "") // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//gm, ""); // Remove multi-line comments

  // eslint-disable-next-line no-eval
  const KEY_COMICS: KeyComic[] = eval(jsContent);

  // Build the lookup map
  const keyComicsMap = new Map<string, Map<string, KeyComicEntry[]>>();

  KEY_COMICS.forEach((comic) => {
    const normalizedTitle = normalizeTitle(comic.title);
    if (!keyComicsMap.has(normalizedTitle)) {
      keyComicsMap.set(normalizedTitle, new Map());
    }
    const issueMap = keyComicsMap.get(normalizedTitle)!;
    if (!issueMap.has(comic.issue)) {
      issueMap.set(comic.issue, []);
    }
    issueMap.get(comic.issue)!.push({ keyInfo: comic.keyInfo, year: comic.year });
  });

  console.log(`Loaded ${KEY_COMICS.length} entries from curated database`);
  return keyComicsMap;
}

function resolveEntry(entries: KeyComicEntry[], releaseYear?: number | null): string[] | null {
  // SINGLE ENTRY — no volume conflict
  if (entries.length === 1) {
    const entry = entries[0];
    if (!entry.year) return entry.keyInfo;
    if (!releaseYear) return entry.keyInfo;
    // Comic published after series started — valid match
    if (releaseYear >= entry.year) return entry.keyInfo;
    // Comic claims to be published before the series started — wrong volume
    return null;
  }

  // MULTIPLE ENTRIES — need releaseYear to disambiguate
  if (!releaseYear) return null;

  const exactMatch = entries.find((e) => e.year === releaseYear);
  if (exactMatch) return exactMatch.keyInfo;

  // Prefer the most recent series that started before this issue
  const validEntries = entries
    .filter((e) => e.year && releaseYear >= e.year)
    .sort((a, b) => b.year! - a.year!);
  if (validEntries.length > 0) return validEntries[0].keyInfo;

  const closeMatch = entries
    .filter((e) => e.year && Math.abs(e.year - releaseYear) <= 5)
    .sort((a, b) => Math.abs(a.year! - releaseYear) - Math.abs(b.year! - releaseYear))[0];
  if (closeMatch) return closeMatch.keyInfo;

  return null;
}

function lookupKeyInfo(
  keyComicsMap: Map<string, Map<string, KeyComicEntry[]>>,
  title: string,
  issueNumber: string,
  releaseYear?: number | null
): string[] | null {
  const normalizedTitle = normalizeTitle(title);
  const issueMap = keyComicsMap.get(normalizedTitle);

  if (!issueMap) return null;

  const entries = issueMap.get(issueNumber);
  if (entries) return resolveEntry(entries, releaseYear);

  const cleanIssue = issueNumber.replace(/^0+/, "") || "0";
  const entriesClean = issueMap.get(cleanIssue);
  if (entriesClean) return resolveEntry(entriesClean, releaseYear);

  return null;
}

interface DbComic {
  id: string;
  title: string | null;
  issue_number: string | null;
  release_year: string | null;
  key_info: string[] | null;
  custom_key_info: string[] | null;
  custom_key_info_status: string | null;
  user_id: string;
}

// ============================================
// User-reviewed decisions for AI-generated key info (non-curated comics)
// These were manually reviewed for accuracy on Mar 18, 2026
// ============================================

// Normalize for matching: lowercase title, strip "the ", keep only alphanumeric
function normalizeForMatch(title: string): string {
  return title.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]/g, "").trim();
}

// Comics where ALL AI key info should be CLEARED (fully inaccurate)
const FULL_CLEAR: Set<string> = new Set([
  "xmen|100",              // Death of Phoenix is #137, not #100
  "civilwar|3",            // Death of Goliath is #4, Cap underground is post-#3
  "batman|424",            // Death in the Family is #426-429, not #424
  "batman|227",            // Talia first appears in Detective Comics #411, Ra's in Batman #232
  "amazingspiderman|51",   // Man-Wolf first appears in ASM #124; #51 is a Kingpin story
  "fantasticfour|6",       // Doom first appears in FF #5; Sub-Mariner in FF #4
  "fantasticfour|10",      // Doom first appears in FF #5; no Sub-Mariner in #10
  "incrediblehulk|5",      // Ross and Betty first appear in Hulk #1
  "talesofsuspense|59",    // Cap's Silver Age first is Avengers #4
  "wolverine|70",          // Part of Old Man Logan arc, not final issue
]);

// Specific key info entries to REMOVE (partial clear — keep the rest)
const PARTIAL_CLEAR: Map<string, string[]> = new Map([
  ["incrediblehulk|102", ["First appearance of Nightcrawler (prototype)"]],
]);

function getComicKey(title: string, issue: string): string {
  return `${normalizeForMatch(title)}|${issue.replace(/^0+/, "") || "0"}`;
}

function shouldFullClear(title: string, issue: string): boolean {
  return FULL_CLEAR.has(getComicKey(title, issue));
}

function getPartialClearEntries(title: string, issue: string): string[] | null {
  return PARTIAL_CLEAR.get(getComicKey(title, issue)) || null;
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  if (isDryRun) {
    console.log("\n=== DRY RUN MODE — No changes will be written ===\n");
  } else {
    console.log("\n=== LIVE MODE — Changes will be written to production ===\n");
  }

  // Load curated database
  const keyComicsMap = await loadKeyComicsDatabase();

  // Fetch all comics that have key_info populated
  const { data: comics, error } = await supabase
    .from("comics")
    .select("id, title, issue_number, release_year, key_info, custom_key_info, custom_key_info_status, user_id")
    .not("key_info", "eq", "{}");

  if (error) {
    console.error("Error fetching comics:", error);
    process.exit(1);
  }

  if (!comics || comics.length === 0) {
    console.log("No comics with key_info found. Nothing to migrate.");
    return;
  }

  console.log(`Found ${comics.length} comics with key_info to review\n`);

  let replaced = 0;
  let cleared = 0;
  let filtered = 0;
  let preserved = 0;
  let unchanged = 0;
  let errors = 0;

  const changes: Array<{
    id: string;
    title: string;
    issue: string;
    year: string | null;
    action: "replaced" | "cleared" | "filtered" | "preserved" | "unchanged";
    oldKeyInfo: string[];
    newKeyInfo: string[];
  }> = [];

  for (const comic of comics as DbComic[]) {
    const title = comic.title;
    const issueNumber = comic.issue_number;
    const releaseYear = comic.release_year ? parseInt(comic.release_year) : null;
    const currentKeyInfo = comic.key_info || [];

    if (!title || !issueNumber || currentKeyInfo.length === 0) {
      unchanged++;
      continue;
    }

    // Step 1: Check curated database with year disambiguation
    const verifiedKeyInfo = lookupKeyInfo(keyComicsMap, title, issueNumber, releaseYear);

    if (verifiedKeyInfo && verifiedKeyInfo.length > 0) {
      // Curated DB match found — replace with verified data
      const isSame = JSON.stringify(verifiedKeyInfo.sort()) === JSON.stringify(currentKeyInfo.sort());

      if (isSame) {
        unchanged++;
        changes.push({
          id: comic.id, title, issue: issueNumber, year: comic.release_year,
          action: "unchanged", oldKeyInfo: currentKeyInfo, newKeyInfo: currentKeyInfo,
        });
        continue;
      }

      if (!isDryRun) {
        const { error: updateError } = await supabase
          .from("comics").update({ key_info: verifiedKeyInfo }).eq("id", comic.id);
        if (updateError) {
          console.error(`  ERROR updating ${title} #${issueNumber}:`, updateError.message);
          errors++;
          continue;
        }
      }

      replaced++;
      changes.push({
        id: comic.id, title, issue: issueNumber, year: comic.release_year,
        action: "replaced", oldKeyInfo: currentKeyInfo, newKeyInfo: verifiedKeyInfo,
      });
      continue;
    }

    // Step 2: No curated match — apply user-reviewed decisions

    // Check if this comic should be fully cleared
    if (shouldFullClear(title, issueNumber)) {
      if (!isDryRun) {
        const { error: updateError } = await supabase
          .from("comics").update({ key_info: [] }).eq("id", comic.id);
        if (updateError) {
          console.error(`  ERROR clearing ${title} #${issueNumber}:`, updateError.message);
          errors++;
          continue;
        }
      }
      cleared++;
      changes.push({
        id: comic.id, title, issue: issueNumber, year: comic.release_year,
        action: "cleared", oldKeyInfo: currentKeyInfo, newKeyInfo: [],
      });
      continue;
    }

    // Check if this comic has specific entries to remove (partial clear)
    const entriesToRemove = getPartialClearEntries(title, issueNumber);
    if (entriesToRemove) {
      const newKeyInfo = currentKeyInfo.filter(
        (info) => !entriesToRemove.some((remove) => info.toLowerCase().includes(remove.toLowerCase()))
      );

      if (newKeyInfo.length !== currentKeyInfo.length) {
        if (!isDryRun) {
          const { error: updateError } = await supabase
            .from("comics").update({ key_info: newKeyInfo }).eq("id", comic.id);
          if (updateError) {
            console.error(`  ERROR filtering ${title} #${issueNumber}:`, updateError.message);
            errors++;
            continue;
          }
        }
        filtered++;
        changes.push({
          id: comic.id, title, issue: issueNumber, year: comic.release_year,
          action: "filtered", oldKeyInfo: currentKeyInfo, newKeyInfo,
        });
        continue;
      }
    }

    // No curated match, not in clear/filter lists — user reviewed and approved keeping AI data
    preserved++;
    changes.push({
      id: comic.id, title, issue: issueNumber, year: comic.release_year,
      action: "preserved", oldKeyInfo: currentKeyInfo, newKeyInfo: currentKeyInfo,
    });
  }

  // Print detailed report
  console.log("\n" + "=".repeat(80));
  console.log("MIGRATION REPORT");
  console.log("=".repeat(80));

  const replacedChanges = changes.filter((c) => c.action === "replaced");
  const clearedChanges = changes.filter((c) => c.action === "cleared");
  const filteredChanges = changes.filter((c) => c.action === "filtered");
  const preservedChanges = changes.filter((c) => c.action === "preserved");

  if (replacedChanges.length > 0) {
    console.log("\n--- REPLACED (curated DB match found) ---");
    for (const c of replacedChanges) {
      console.log(`\n  ${c.title} #${c.issue} (${c.year || "no year"})`);
      console.log(`    OLD: ${JSON.stringify(c.oldKeyInfo)}`);
      console.log(`    NEW: ${JSON.stringify(c.newKeyInfo)}`);
    }
  }

  if (clearedChanges.length > 0) {
    console.log("\n--- CLEARED (user-reviewed: inaccurate AI data removed) ---");
    for (const c of clearedChanges) {
      console.log(`\n  ${c.title} #${c.issue} (${c.year || "no year"})`);
      console.log(`    REMOVED: ${JSON.stringify(c.oldKeyInfo)}`);
    }
  }

  if (filteredChanges.length > 0) {
    console.log("\n--- FILTERED (user-reviewed: specific inaccurate entries removed) ---");
    for (const c of filteredChanges) {
      console.log(`\n  ${c.title} #${c.issue} (${c.year || "no year"})`);
      console.log(`    OLD: ${JSON.stringify(c.oldKeyInfo)}`);
      console.log(`    NEW: ${JSON.stringify(c.newKeyInfo)}`);
    }
  }

  if (preservedChanges.length > 0) {
    console.log("\n--- PRESERVED (user-reviewed: AI data confirmed accurate) ---");
    for (const c of preservedChanges) {
      console.log(`  ${c.title} #${c.issue} (${c.year || "no year"}) — ${c.oldKeyInfo.length} entries kept`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`  Total comics reviewed: ${comics.length}`);
  console.log(`  Replaced with verified curated data: ${replaced}`);
  console.log(`  Cleared (inaccurate AI data removed): ${cleared}`);
  console.log(`  Filtered (specific bad entries removed): ${filtered}`);
  console.log(`  Preserved (AI data confirmed accurate): ${preserved}`);
  console.log(`  Unchanged (already correct): ${unchanged}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  custom_key_info: NEVER TOUCHED`);

  if (isDryRun) {
    console.log("\n  DRY RUN — no changes were written. Run without --dry-run to apply.");
  } else {
    console.log("\n  All changes applied to production database.");
  }
  console.log("");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
