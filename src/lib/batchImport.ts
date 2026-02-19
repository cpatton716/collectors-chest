/**
 * Batch import lookup utility.
 * Deduplicates by title+issue and processes lookups in parallel batches.
 */

import type { PriceData } from "@/types/comic";

export interface ParsedImportRow {
  title: string;
  issueNumber: string;
  variant?: string;
  publisher?: string;
  releaseYear?: string;
}

export interface ImportLookupResult {
  priceData: PriceData | null;
  keyInfo: string[];
  writer: string | null;
  coverArtist: string | null;
  interiorArtist: string | null;
  publisher: string | null;
  releaseYear: string | null;
  coverImageUrl: string | null;
}

/**
 * Generate a dedup key for a parsed row.
 * Comics with the same title + issue number share lookup results.
 */
export function dedupKey(title: string, issueNumber: string): string {
  return `${title.toLowerCase().trim()}|${issueNumber.toLowerCase().trim()}`;
}

/**
 * Process lookups in parallel batches with deduplication.
 *
 * 1. Groups rows by title+issueNumber
 * 2. Looks up each unique combo once
 * 3. Processes in batches of batchSize
 * 4. Returns a Map of dedupKey -> LookupResult
 */
export async function batchLookup(
  rows: ParsedImportRow[],
  batchSize: number = 5,
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, ImportLookupResult | null>> {
  // Deduplicate - keep first row for each unique title+issue
  const uniqueMap = new Map<string, ParsedImportRow>();
  for (const row of rows) {
    const key = dedupKey(row.title, row.issueNumber);
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, row);
    }
  }

  const uniqueEntries = Array.from(uniqueMap.entries());
  const results = new Map<string, ImportLookupResult | null>();
  let completed = 0;

  // Process in parallel batches
  for (let i = 0; i < uniqueEntries.length; i += batchSize) {
    const batch = uniqueEntries.slice(i, i + batchSize);

    const batchResults = await Promise.allSettled(
      batch.map(async ([key, row]) => {
        const response = await fetch("/api/import-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: row.title,
            issueNumber: row.issueNumber,
            variant: row.variant || "",
            publisher: row.publisher || "",
            releaseYear: row.releaseYear || "",
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return { key, data: data as ImportLookupResult };
        }
        return { key, data: null };
      })
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.set(result.value.key, result.value.data);
      }
      completed++;
      onProgress?.(completed, uniqueEntries.length);
    }
  }

  return results;
}
