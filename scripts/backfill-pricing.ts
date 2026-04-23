/**
 * Migration Script: Refresh stale pricing data on comics
 *
 * Background:
 *   Early in the project, pricing came from AI-generated estimates (hallucinated
 *   values). Session 22 (Feb/Mar 2026) switched to the eBay Browse API as the
 *   source of truth, and `price_data.priceSource` is now set to `"ebay"` on
 *   every new lookup. Any row where `priceSource !== "ebay"` is legacy data
 *   from the AI era (or predates the field being added).
 *
 * What it does:
 *   1. Finds `comics` rows where `price_data` is non-null AND
 *      `price_data->>'priceSource'` is NULL or != 'ebay'
 *   2. For each, calls the local /api/ebay-prices endpoint to fetch fresh
 *      eBay-sourced pricing for that (title, issue, grade, slabbed, company)
 *   3. Writes the refreshed `price_data` back to the row
 *   4. If eBay returns nothing (book is obscure / no active listings), clears
 *      price_data entirely — bogus data is worse than no data
 *
 * Run:
 *   # Dry-run — prints what would change, writes nothing (default)
 *   npx tsx scripts/backfill-pricing.ts
 *
 *   # Real run — must explicitly set APPLY=true
 *   APPLY=true npx tsx scripts/backfill-pricing.ts
 *
 *   # Point at production API (instead of localhost) if running against prod data
 *   API_BASE_URL=https://collectors-chest.com APPLY=true npx tsx scripts/backfill-pricing.ts
 *
 *   # Limit the batch size (default 25, safer to start small)
 *   LIMIT=5 npx tsx scripts/backfill-pricing.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ─── Env loading (copied from migrate-key-info.ts) ────────────────
const envPath = path.resolve(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.substring(0, eqIdx).trim();
  let value = trimmed.substring(eqIdx + 1).trim();
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

// ─── Config ───────────────────────────────────────────────────────
const APPLY = process.env.APPLY === "true";
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
const LIMIT = parseInt(process.env.LIMIT || "25", 10);
const RATE_LIMIT_MS = parseInt(process.env.RATE_LIMIT_MS || "500", 10);

// ─── Types ────────────────────────────────────────────────────────
interface ComicRow {
  id: string;
  title: string | null;
  issue_number: string | null;
  grade: string | null;
  is_slabbed: boolean | null;
  grading_company: string | null;
  release_year: string | null;
  price_data: Record<string, unknown> | null;
}

// ─── Helpers ──────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchFreshPricing(comic: ComicRow): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${API_BASE_URL}/api/ebay-prices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: comic.title,
      issueNumber: comic.issue_number,
      grade: comic.grade ? parseFloat(comic.grade) : undefined,
      isSlabbed: comic.is_slabbed,
      gradingCompany: comic.grading_company,
      year: comic.release_year,
    }),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  const body = (await res.json()) as { success: boolean; data: Record<string, unknown> | null; error?: string };
  if (!body.success) {
    throw new Error(body.error || "unknown api error");
  }
  return body.data;
}

// ─── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log("");
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║  Pricing Backfill — clear legacy AI data, refresh via eBay║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`  Mode:        ${APPLY ? "🟢 APPLY (writes enabled)" : "🟡 DRY-RUN (no writes)"}`);
  console.log(`  API target:  ${API_BASE_URL}`);
  console.log(`  Batch limit: ${LIMIT}`);
  console.log(`  Rate limit:  ${RATE_LIMIT_MS}ms between requests`);
  console.log(`  Supabase:    ${supabaseUrl}`);
  console.log("");

  // Step 1 — count the universe first
  const { count: totalStale, error: countErr } = await supabase
    .from("comics")
    .select("id", { count: "exact", head: true })
    .not("price_data", "is", null)
    .or("price_data->>priceSource.is.null,price_data->>priceSource.neq.ebay");

  if (countErr) {
    console.error("Error counting stale rows:", countErr);
    process.exit(1);
  }

  console.log(`  Stale rows found: ${totalStale ?? 0}`);
  console.log("");

  if ((totalStale ?? 0) === 0) {
    console.log("✅ Nothing to backfill. All priced rows already sourced from eBay.");
    return;
  }

  // Step 2 — fetch a batch
  const { data: rows, error: fetchErr } = await supabase
    .from("comics")
    .select("id, title, issue_number, grade, is_slabbed, grading_company, release_year, price_data")
    .not("price_data", "is", null)
    .or("price_data->>priceSource.is.null,price_data->>priceSource.neq.ebay")
    .limit(LIMIT);

  if (fetchErr) {
    console.error("Error fetching batch:", fetchErr);
    process.exit(1);
  }

  const batch = (rows as ComicRow[]) ?? [];
  console.log(`  Processing batch of ${batch.length}...`);
  console.log("");

  let refreshed = 0;
  let cleared = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < batch.length; i++) {
    const comic = batch[i];
    const label = `[${i + 1}/${batch.length}] ${comic.title ?? "(no title)"} #${comic.issue_number ?? "?"}${comic.grade ? ` @${comic.grade}` : ""}`;

    if (!comic.title) {
      console.log(`${label} → SKIP (no title)`);
      skipped++;
      continue;
    }

    try {
      const fresh = await fetchFreshPricing(comic);

      if (fresh) {
        const oldVal = (comic.price_data as { estimatedValue?: number })?.estimatedValue ?? "?";
        const newVal = (fresh as { estimatedValue?: number })?.estimatedValue ?? "?";
        console.log(`${label} → REFRESH (was $${oldVal}, now $${newVal})`);

        if (APPLY) {
          const { error: updErr } = await supabase
            .from("comics")
            .update({ price_data: fresh, updated_at: new Date().toISOString() })
            .eq("id", comic.id);
          if (updErr) throw updErr;
        }
        refreshed++;
      } else {
        console.log(`${label} → CLEAR (no eBay data available, removing bogus price)`);

        if (APPLY) {
          const { error: updErr } = await supabase
            .from("comics")
            .update({ price_data: null, updated_at: new Date().toISOString() })
            .eq("id", comic.id);
          if (updErr) throw updErr;
        }
        cleared++;
      }
    } catch (err) {
      console.log(`${label} → FAIL (${(err as Error).message})`);
      failed++;
    }

    // Throttle between requests to respect eBay + our own rate limits
    if (i < batch.length - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  console.log("");
  console.log("─────────────────────────────────────────────────────────────");
  console.log("  Summary");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(`  Refreshed:  ${refreshed}`);
  console.log(`  Cleared:    ${cleared}`);
  console.log(`  Skipped:    ${skipped}`);
  console.log(`  Failed:     ${failed}`);
  console.log(`  Remaining:  ${Math.max(0, (totalStale ?? 0) - batch.length)} (run again to process)`);
  console.log("");
  if (!APPLY) {
    console.log("  🟡 DRY-RUN complete — no rows were modified.");
    console.log("  To apply changes, re-run with:  APPLY=true npx tsx scripts/backfill-pricing.ts");
  } else {
    console.log("  🟢 Batch applied.");
  }
  console.log("");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
