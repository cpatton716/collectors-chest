/**
 * Metadata cache helpers for merging cached comic metadata into scan results
 * and building payloads for saving metadata back to the cache.
 *
 * These are pure functions with no side effects or database calls.
 */

export interface ComicMetadata {
  id: string;
  title: string;
  issueNumber: string;
  publisher: string | null;
  releaseYear: string | null;
  writer: string | null;
  coverArtist: string | null;
  interiorArtist: string | null;
  coverImageUrl: string | null;
  coverSource?: string | null;
  coverValidated?: boolean;
  keyInfo: string[];
  priceData: unknown;
  lookupCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Fields that can be filled from cached metadata (fill-only, never overwrite) */
const MERGEABLE_FIELDS = [
  "publisher",
  "releaseYear",
  "writer",
  "coverArtist",
  "interiorArtist",
] as const;

/** Fields that are safe to save to the metadata cache */
const SAVEABLE_FIELDS = [
  "title",
  "issueNumber",
  "publisher",
  "releaseYear",
  "writer",
  "coverArtist",
  "interiorArtist",
  "coverImageUrl",
  "coverSource",
  "coverValidated",
  "keyInfo",
] as const;

/**
 * Fill-only merge: cached metadata values only populate fields that are
 * still empty/falsy on `details`. Never overwrites existing data.
 *
 * Returns the modified details object (mutates in place).
 */
export function mergeMetadataIntoDetails(
  details: Record<string, unknown>,
  metadata: ComicMetadata | null
): Record<string, unknown> {
  if (!metadata) return details;

  for (const field of MERGEABLE_FIELDS) {
    if (!details[field] && metadata[field]) {
      details[field] = metadata[field];
    }
  }

  // keyInfo: only fill if details has no keyInfo or empty array
  const existingKeyInfo = details.keyInfo;
  if (
    (!existingKeyInfo ||
      (Array.isArray(existingKeyInfo) && existingKeyInfo.length === 0)) &&
    metadata.keyInfo &&
    metadata.keyInfo.length > 0
  ) {
    details.keyInfo = metadata.keyInfo;
    // Cache may contain AI-sourced or database-sourced keyInfo — mark as cache
    if (!details.keyInfoSource) {
      details.keyInfoSource = "cache";
    }
  }

  return details;
}

/**
 * Extract saveable fields from comicDetails for caching.
 * Returns null if title or issueNumber is missing.
 * Only includes fields that are defined (not undefined) in the payload.
 */
export function buildMetadataSavePayload(
  details: Record<string, unknown>
): { title: string; issueNumber: string; [key: string]: unknown } | null {
  if (!details.title || !details.issueNumber) return null;

  const payload: Record<string, unknown> = {};

  for (const field of SAVEABLE_FIELDS) {
    if (details[field] !== undefined) {
      payload[field] = details[field];
    }
  }

  return payload as { title: string; issueNumber: string; [key: string]: unknown };
}
