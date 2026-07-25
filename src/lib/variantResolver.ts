/**
 * 3-tier variant name resolver. Runs after AI cover analysis in /api/analyze
 * when the comic has a parsed UPC supplement. Decides what to write into
 * `comicDetails.variant` and tags the source so the review form can surface
 * a "Detected from barcode" hint.
 *
 * Design principle: the BARCODE is more authoritative than the AI's cover-
 * derived hint. Two physically different books (e.g., a standard
 * Cover A vs a 7th-printing reprint by the same artist) can share identical
 * cover artwork but have different addon codes -- if we trust AI's cover
 * read over the barcode, we'd label them identically. So when a parsed
 * addon is present, the barcode-derived path always runs.
 *
 * Tier 1 (catalog): instant + free. Looks up
 *   (upc_prefix, addon_issue, addon_variant) in barcode_catalog and returns
 *   the admin-approved variant name. Compounds as admins approve entries.
 *
 * Tier 2 (AI enrichment): focused text-only call (~$0.0008 with Haiku).
 *   Fires on Tier-1 miss when the addon clearly indicates a variant.
 *   Receives the deterministically-derived cover letter (e.g., "Cover G")
 *   so Haiku searches its training data with a concrete query rather than
 *   trying to decode raw addon digits.
 *
 * Tier 3 (derived): the addon[0] > 1 -> "Cover A/B/C/..." mapping.
 *   Always-available fallback when catalog and AI both come up empty.
 *
 * Note: AI's first-pass cover-derived hint is only used as a final fallback
 * when there's no parsed barcode. With a barcode present, the barcode path
 * wins -- user can override on the review screen if they disagree.
 */

import Anthropic from "@anthropic-ai/sdk";

import { MODEL_LIGHTWEIGHT } from "@/lib/models";
import { parseAnthropicJson } from "@/lib/providers/anthropic";
import { supabaseAdmin } from "@/lib/supabase";

import type { BarcodeData } from "@/types/comic";

// ── Types ──

type VariantSource = "catalog" | "ai" | "derived";

export interface VariantResolution {
  variantName: string | null;
  source: VariantSource | null;
}

export interface ResolveVariantInput {
  title: string;
  issueNumber: string;
  releaseYear: string | null;
  publisher: string | null;
  parsedBarcode: BarcodeData["parsed"] | undefined;
  /** What AI returned for `variant` from cover analysis (may be null or generic). */
  aiVariantHint: string | null;
}

export interface ResolverDeps {
  catalogLookup: CatalogLookup;
  enricher: VariantEnricher;
}

export type CatalogLookup = (parts: {
  upcPrefix: string;
  addonIssue: string | undefined;
  addonVariant: string;
}) => Promise<string | null>;

export type VariantEnricher = (input: {
  title: string;
  issueNumber: string;
  releaseYear: string | null;
  publisher: string | null;
  addonVariant: string;
  /** Cover letter deterministically derived from addonVariant[0] (e.g., "Cover G"). */
  derivedLabel: string;
}) => Promise<string | null>;

// ── Heuristics ──

const COVER_LETTERS = ["", "A", "B", "C", "D", "E", "F", "G", "H", "I"];
const NON_VARIANT_ADDONS = new Set(["00", "01", "11"]);

/** True when the addon-variant code suggests this isn't a base Cover A 1st print. */
export function isVariantAddon(addonVariant: string | undefined): boolean {
  if (!addonVariant) return false;
  return !NON_VARIANT_ADDONS.has(addonVariant);
}

/** Map the first addon digit to a generic cover letter ("Cover G" for "71"). */
export function deriveVariantFromAddon(addonVariant: string | undefined): string | null {
  if (!addonVariant || addonVariant.length === 0) return null;
  const firstDigit = parseInt(addonVariant[0], 10);
  if (Number.isNaN(firstDigit) || firstDigit <= 1 || firstDigit > 9) return null;
  return `Cover ${COVER_LETTERS[firstDigit]}`;
}

// ── Resolver ──

export async function resolveVariant(
  input: ResolveVariantInput,
  deps: ResolverDeps
): Promise<VariantResolution> {
  const parsed = input.parsedBarcode;

  // No parsed barcode -- nothing to resolve. Trust whatever AI returned.
  if (!parsed?.addonVariant || !parsed?.upcPrefix) {
    return {
      variantName: input.aiVariantHint,
      source: input.aiVariantHint ? "ai" : null,
    };
  }

  const addonVariant = parsed.addonVariant;

  // Tier 1: catalog lookup (fast + free) -- admin-approved community names
  // are the most authoritative source.
  try {
    const fromCatalog = await deps.catalogLookup({
      upcPrefix: parsed.upcPrefix,
      addonIssue: parsed.addonIssue,
      addonVariant,
    });
    if (fromCatalog) {
      return { variantName: fromCatalog, source: "catalog" };
    }
  } catch (err) {
    console.warn("[variantResolver] Catalog lookup failed", err);
    // fall through
  }

  // Deterministically derive the cover letter from the addon. Used as both
  // (a) input to the AI enricher (gives Haiku a concrete search query) and
  // (b) the final-fallback label.
  const derived = deriveVariantFromAddon(addonVariant);

  // Tier 2: AI enrichment with the derived label as a hint. Fires when the
  // addon implies a variant AND we have a derived letter to search by.
  // We deliberately ignore aiVariantHint here -- the barcode is more
  // authoritative, and the same cover artwork can appear on multiple
  // printings/variants with different addon codes.
  if (derived && isVariantAddon(addonVariant)) {
    try {
      const enriched = await deps.enricher({
        title: input.title,
        issueNumber: input.issueNumber,
        releaseYear: input.releaseYear,
        publisher: input.publisher,
        addonVariant,
        derivedLabel: derived,
      });
      if (enriched) {
        return { variantName: enriched, source: "ai" };
      }
    } catch (err) {
      console.warn("[variantResolver] AI enrichment failed", err);
      // fall through
    }
  }

  // Tier 3: addon-derived generic name ("Cover G" for "71")
  if (derived) {
    return { variantName: derived, source: "derived" };
  }

  // Final: keep AI hint if any (e.g., "11" addon = no derived letter, but
  // AI may have read "Variant Cover" text from the cover); else null.
  return {
    variantName: input.aiVariantHint,
    source: input.aiVariantHint ? "ai" : null,
  };
}

// ── Default dep implementations (production wiring) ──

/**
 * Tier-1 catalog lookup. Returns the most-frequently-approved variant name
 * for the given barcode signature, or null if the catalog has no approved
 * entry yet. Falls back to addon-issue-loose match if the strict lookup
 * misses (lets us tolerate scanner-side off-by-one issue digits).
 */
export const lookupApprovedVariantName: CatalogLookup = async ({
  upcPrefix,
  addonIssue,
  addonVariant,
}) => {
  if (!supabaseAdmin) return null;

  let query = supabaseAdmin
    .from("barcode_catalog")
    .select("variant_name")
    .eq("upc_prefix", upcPrefix)
    .eq("addon_variant", addonVariant)
    .eq("variant_name_status", "approved")
    .not("variant_name", "is", null);

  if (addonIssue) {
    query = query.eq("addon_issue", addonIssue);
  }

  const { data, error } = await query.limit(50);
  if (error || !data || data.length === 0) return null;

  // Pick the most common name across approved submissions; ties go to the
  // first one (Postgres returns rows in insertion order absent an order-by).
  const counts = new Map<string, number>();
  for (const row of data) {
    const name = (row as { variant_name: string | null }).variant_name;
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  let bestName: string | null = null;
  let bestCount = 0;
  for (const [name, count] of counts.entries()) {
    if (count > bestCount) {
      bestCount = count;
      bestName = name;
    }
  }
  return bestName;
};

/**
 * Tier-2 AI enrichment. Single text-only Haiku call. Cost: ~$0.0008 each.
 * Conservative prompt -- model is told to return null rather than fabricate.
 */
export const enrichVariantNameFromAI: VariantEnricher = async ({
  title,
  issueNumber,
  releaseYear,
  publisher,
  addonVariant,
  derivedLabel,
}) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const yearPart = releaseYear ? ` (${releaseYear})` : "";
  const publisherPart = publisher ? `, published by ${publisher}` : "";

  const prompt = `You are a comic book variant catalog. The user scanned a comic and we have decoded its UPC supplement to identify the variant slot.

Book: ${title} #${issueNumber}${yearPart}${publisherPart}
Variant slot from barcode: ${derivedLabel} (decoded from UPC supplement code "${addonVariant}")

What is the canonical/official name for this specific variant in collector databases (CovrPrice, GCD, CGC census, etc.)?

Common formats you might return:
- "[Artist Name] Variant Cover" (most common — e.g., "Greg Capullo Variant Cover", "Andy Kubert Variant", "Jim Lee Cover")
- "1:25 Ratio Variant", "1:50 Incentive", "1:100 Incentive"
- "Foil Cover", "Holofoil Edition", "Virgin Variant", "Sketch Variant", "B&W Variant"
- "Newsstand Edition", "Direct Edition"
- "Midnight Release Variant", "Convention Exclusive", "[Retailer] Exclusive"
- "[N]th Printing" -- if the addon code maps to a reprint rather than a cover variant for this publisher

Rules:
1. Return the canonical name if you know this specific variant for THIS book.
2. If you cannot identify it, return null -- do NOT fabricate or guess artist names.
3. If "${derivedLabel}" is the only thing you can confidently say, return null (the resolver will fall back to "${derivedLabel}" on its own).
4. Do not include reasoning or explanation -- only the JSON.

Return ONLY a JSON object: {"variantName": "string"} or {"variantName": null}.`;

  try {
    const response = await client.messages.create({
      model: MODEL_LIGHTWEIGHT,
      max_tokens: 96,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    const parsed = parseAnthropicJson(textBlock.text) as { variantName: string | null };
    const name = parsed.variantName;
    if (!name || typeof name !== "string") return null;
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.toLowerCase() === "null") return null;
    return trimmed;
  } catch (err) {
    console.warn("[variantResolver] enrichVariantNameFromAI threw", err);
    return null;
  }
};
