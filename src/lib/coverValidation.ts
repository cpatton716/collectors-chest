import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_PRIMARY } from "@/lib/models";
import { getCommunityCovers } from "./coverImageDb";
import type { BrowseListingItem } from "./ebayBrowse";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoverMetadataInput {
  coverSource?: string | null;
  coverValidated?: boolean;
  coverImageUrl?: string | null;
  updatedAt?: string;
}

export interface CoverPipelineResult {
  coverUrl: string | null;
  coverSource:
    | "community"
    | "ebay"
    | "openlibrary"
    | "comicvine"
    | null;
  validated: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOG_PREFIX = "[cover-validation]";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const RETRY_AFTER_DAYS = 7;
const MAX_FAILURES_PER_REQUEST = 3;
const RATE_LIMIT_COOLDOWN_MS = 60_000;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const ALLOWED_EXACT_HOSTS = new Set([
  "covers.openlibrary.org",
  "upload.wikimedia.org",
]);

const ALLOWED_HOST_SUFFIXES = [".ebayimg.com", ".ebaystatic.com"];

const PRIVATE_IP_PREFIXES = [
  "127.",
  "10.",
  "192.168.",
  "172.16.",
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.",
  "169.254.",
];

// Module-level rate-limit cooldown
let rateLimitCooldownUntil = 0;

// ---------------------------------------------------------------------------
// URL Validation
// ---------------------------------------------------------------------------

export function validateImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Must be HTTPS
    if (parsed.protocol !== "https:") return false;

    const hostname = parsed.hostname.toLowerCase();

    // Reject localhost
    if (hostname === "localhost") return false;

    // Reject private IPs
    for (const prefix of PRIVATE_IP_PREFIXES) {
      if (hostname.startsWith(prefix)) return false;
    }

    // Check exact hosts
    if (ALLOWED_EXACT_HOSTS.has(hostname)) return true;

    // Check suffix hosts
    for (const suffix of ALLOWED_HOST_SUFFIXES) {
      if (hostname.endsWith(suffix)) return true;
    }

    return false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// MIME Type Detection
// ---------------------------------------------------------------------------

export function detectMimeType(
  buffer: Buffer,
  contentType: string | null
): string | null {
  // Check magic bytes first
  if (buffer.length >= 3) {
    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return "image/jpeg";
    }
  }

  if (buffer.length >= 4) {
    // PNG: 89 50 4E 47
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return "image/png";
    }
  }

  // Fall back to Content-Type header
  if (contentType) {
    const mime = contentType.split(";")[0].trim().toLowerCase();
    if (ALLOWED_MIME_TYPES.has(mime)) return mime;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Pipeline Decision
// ---------------------------------------------------------------------------

export function shouldRunPipeline(
  metadata: CoverMetadataInput | null
): boolean {
  // No metadata at all → run
  if (metadata === null) return true;

  // Community-sourced covers are authoritative → skip
  if (metadata.coverSource === "community") return false;

  // Already validated with a URL → skip
  if (metadata.coverValidated === true && metadata.coverImageUrl) return false;

  // Validated but no URL — retry after RETRY_AFTER_DAYS
  if (
    metadata.coverValidated === true &&
    !metadata.coverImageUrl &&
    metadata.updatedAt
  ) {
    const updatedAt = new Date(metadata.updatedAt).getTime();
    const daysSince = (Date.now() - updatedAt) / (1000 * 60 * 60 * 24);
    return daysSince > RETRY_AFTER_DAYS;
  }

  // coverValidated is undefined or false → run
  return true;
}

// ---------------------------------------------------------------------------
// Image Fetching
// ---------------------------------------------------------------------------

async function fetchImage(
  url: string
): Promise<{ buffer: Buffer; contentType: string | null } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return null;

    // Check Content-Length if available
    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_BYTES) {
      console.warn(`${LOG_PREFIX} Image too large: ${contentLength} bytes`);
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_IMAGE_BYTES) {
      console.warn(`${LOG_PREFIX} Image too large: ${buffer.length} bytes`);
      return null;
    }

    const contentType = res.headers.get("content-type");
    return { buffer, contentType };
  } catch (err) {
    console.error(`${LOG_PREFIX} Failed to fetch image: ${url}`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Gemini Validation
// ---------------------------------------------------------------------------

function buildPrompt(
  title: string,
  issueNumber: string,
  year: string | null,
  publisher: string | null
): string {
  let desc = `${title} #${issueNumber}`;
  const parts: string[] = [];
  if (year) parts.push(year);
  if (publisher) parts.push(publisher);
  if (parts.length > 0) desc += ` (${parts.join(", ")})`;

  return `Is this a cover of ${desc}? Variant covers, reprints, and different printings of the same issue are acceptable. The comic may be shown inside a CGC/CBCS grading slab — this is still acceptable if the cover is visible. Answer YES or NO. If NO, briefly say what comic this actually appears to be.`;
}

type GeminiVerdict = "yes" | "no" | "ambiguous";

function parseGeminiResponse(text: string): GeminiVerdict {
  const firstWord = text.trim().split(/\s+/)[0]?.toUpperCase() ?? "";
  if (firstWord.startsWith("YES")) return "yes";
  if (firstWord.startsWith("NO")) return "no";
  return "ambiguous";
}

async function validateWithGemini(
  imageBuffer: Buffer,
  mimeType: string,
  title: string,
  issueNumber: string,
  year: string | null,
  publisher: string | null,
  geminiClient?: unknown
): Promise<GeminiVerdict> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey && !geminiClient) {
    console.warn(`${LOG_PREFIX} No GEMINI_API_KEY set, skipping validation`);
    return "ambiguous";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const genAI: any =
    geminiClient ?? new GoogleGenerativeAI(apiKey!);

  const model = genAI.getGenerativeModel({
    model: GEMINI_PRIMARY,
    generationConfig: { maxOutputTokens: 50 },
  });

  const prompt = buildPrompt(title, issueNumber, year, publisher);
  const base64 = imageBuffer.toString("base64");

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType,
        data: base64,
      },
    },
  ]);

  const response = await result.response;
  const text = response.text();
  return parseGeminiResponse(text);
}

// ---------------------------------------------------------------------------
// Open Library Candidate
// ---------------------------------------------------------------------------

async function tryOpenLibrary(title: string): Promise<string | null> {
  const encoded = encodeURIComponent(title);
  const url = `https://covers.openlibrary.org/b/title/${encoded}-L.jpg`;

  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) return null;

    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) return null;

    return url;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main Pipeline
// ---------------------------------------------------------------------------

interface CandidateSource {
  url: string;
  source: CoverPipelineResult["coverSource"];
}

export async function runCoverPipeline(
  title: string,
  issueNumber: string,
  year: string | null,
  publisher: string | null,
  options?: { ebayListings?: BrowseListingItem[]; geminiClient?: unknown }
): Promise<CoverPipelineResult> {
  const NULL_RESULT: CoverPipelineResult = {
    coverUrl: null,
    coverSource: null,
    validated: true,
  };

  // Step 1: Community covers (authoritative, no Gemini needed)
  try {
    const communityUrl = await getCommunityCovers(title, issueNumber);
    if (communityUrl) {
      return { coverUrl: communityUrl, coverSource: "community", validated: true };
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} Community cover lookup failed`, err);
  }

  // Step 2: Gather candidates
  const candidates: CandidateSource[] = [];

  // eBay candidates
  if (options?.ebayListings) {
    for (const listing of options.ebayListings) {
      if (listing.imageUrl) {
        candidates.push({ url: listing.imageUrl, source: "ebay" });
        break; // only take first with an image
      }
    }
  }

  // Open Library candidate
  try {
    const olUrl = await tryOpenLibrary(title);
    if (olUrl) {
      candidates.push({ url: olUrl, source: "openlibrary" });
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} Open Library lookup failed`, err);
  }

  if (candidates.length === 0) return NULL_RESULT;

  // Pre-check: is Gemini available?
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const hasGeminiClient = !!options?.geminiClient;
  let allCandidatesChecked = !!(geminiApiKey || hasGeminiClient);

  // Step 3: Validate each candidate with Gemini
  let failures = 0;

  for (const candidate of candidates) {
    if (failures >= MAX_FAILURES_PER_REQUEST) {
      console.warn(`${LOG_PREFIX} Max failures reached, stopping pipeline`);
      allCandidatesChecked = false;
      break;
    }

    // URL safety check
    if (!validateImageUrl(candidate.url)) {
      console.warn(`${LOG_PREFIX} Rejected unsafe URL: ${candidate.url}`);
      continue;
    }

    // Fetch the image
    const imageResult = await fetchImage(candidate.url);
    if (!imageResult) {
      failures++;
      allCandidatesChecked = false;
      continue;
    }

    // Detect MIME type
    const mimeType = detectMimeType(imageResult.buffer, imageResult.contentType);
    if (!mimeType) {
      console.warn(`${LOG_PREFIX} Unsupported image type for ${candidate.url}`);
      failures++;
      allCandidatesChecked = false;
      continue;
    }

    // Check rate-limit cooldown
    if (Date.now() < rateLimitCooldownUntil) {
      console.warn(`${LOG_PREFIX} Gemini rate-limited, skipping remaining candidates`);
      allCandidatesChecked = false;
      break;
    }

    // Gemini validation
    try {
      const verdict = await validateWithGemini(
        imageResult.buffer,
        mimeType,
        title,
        issueNumber,
        year,
        publisher,
        options?.geminiClient
      );

      if (verdict === "yes") {
        return { coverUrl: candidate.url, coverSource: candidate.source, validated: true };
      }

      if (verdict === "no") {
        // Confirmed wrong cover — skip this candidate
        continue;
      }

      // Ambiguous — don't count as failure, just skip
      continue;
    } catch (err: unknown) {
      failures++;
      allCandidatesChecked = false;

      if (
        err instanceof Error &&
        (err.message?.includes("429") || err.message?.includes("RATE_LIMIT"))
      ) {
        rateLimitCooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        console.warn(
          `${LOG_PREFIX} Gemini rate limited, cooling down for 60s`
        );
        break; // Rate limit applies to all remaining candidates
      } else {
        console.error(`${LOG_PREFIX} Gemini validation error`, err);
      }
    }
  }

  return { coverUrl: null, coverSource: null, validated: allCandidatesChecked };
}
