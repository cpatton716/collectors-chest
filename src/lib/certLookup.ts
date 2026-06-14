/**
 * Grading Company Certification Lookup Service
 *
 * Fetches comic book data from CGC, CBCS, and PGX verification pages
 * using their certification numbers.
 *
 * Phase 2: Now includes Redis caching (1 year TTL) since certificates are permanent.
 */
import { cacheGet, cacheSet } from "./cache";

export interface CertLookupResult {
  success: boolean;
  source: "cgc" | "cbcs" | "pgx";
  certNumber: string;
  data?: {
    title: string | null;
    issueNumber: string | null;
    publisher: string | null;
    releaseYear: string | null;
    grade: string | null;
    gradeLabel: string | null;
    labelType: string | null; // e.g., "Universal", "Signature Series"
    variant: string | null;
    pageQuality: string | null; // e.g., "White", "Off-white"
    gradeDate: string | null; // Date the comic was graded (CGC only)
    graderNotes: string | null; // Defect notes from grader
    signatures: string | null; // Who signed the comic (maps to signedBy)
    keyComments: string | null; // Key issue info (maps to keyInfo)
    artComments: string | null; // Art/creator comments
  };
  error?: string;
}

// ============================================
// CGC Lookup
// ============================================

/**
 * Look up a comic by CGC certification number
 * URL format: https://www.cgccomics.com/certlookup/{certNumber}/
 */
export async function lookupCGCCert(certNumber: string): Promise<CertLookupResult> {
  const cleanCert = certNumber.replace(/\D/g, ""); // Remove non-digits

  if (!cleanCert || cleanCert.length < 6) {
    return {
      success: false,
      source: "cgc",
      certNumber,
      error: "Invalid CGC certification number",
    };
  }

  try {
    const response = await fetch(`https://www.cgccomics.com/certlookup/${cleanCert}/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CollectorsChest/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        source: "cgc",
        certNumber: cleanCert,
        error: `CGC lookup failed: ${response.status}`,
      };
    }

    const html = await response.text();
    return parseCGCResponse(html, cleanCert);
  } catch (error) {
    console.error("[cert-lookup] CGC lookup error:", error);
    return {
      success: false,
      source: "cgc",
      certNumber: cleanCert,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Parse CGC verification page HTML
 * CGC page structure includes: Title, Issue, Issue Date, Issue Year, Publisher,
 * Grade, Page Quality, Grade Date, Label Category, Art Comments, Key Comments,
 * Grader Notes, Signatures
 */
export function parseCGCResponse(html: string, certNumber: string): CertLookupResult {
  try {
    // Check if cert was found
    if (html.includes("not found") || html.includes("No results") || html.includes("invalid")) {
      return {
        success: false,
        source: "cgc",
        certNumber,
        error: "Certification number not found",
      };
    }

    // Helper to extract text after a label
    const extractField = (label: string): string | null => {
      // Try multiple patterns for field extraction
      const patterns = [
        new RegExp(`${label}[\\s\\S]*?<[^>]*>([^<]+)<`, "i"),
        new RegExp(`>${label}<[^>]*>[\\s\\S]*?<[^>]*>([^<]+)<`, "i"),
        new RegExp(`${label}[:\\s]+([^<\\n]+)`, "i"),
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]?.trim()) {
          return match[1].trim();
        }
      }
      return null;
    };

    // Extract title - usually in h1 or prominent element
    const titleMatch =
      html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
      html.match(/class="[^"]*title[^"]*"[^>]*>([^<]+)/i) ||
      html.match(/>Title<[^>]*>[\s\S]*?<[^>]*>([^<]+)</i);

    // Extract specific fields
    const grade = extractField("Grade") || html.match(/(?:^|>)(\d+\.?\d*)\s*(?:<|$)/m)?.[1] || null;
    const publisher = extractField("Publisher");
    const yearMatch =
      html.match(/Issue Year[\s\S]*?(\d{4})/i) || html.match(/\b(19\d{2}|20\d{2})\b/);
    const releaseYear = yearMatch ? yearMatch[1] : null;

    // Page Quality - look for patterns like "Page Quality" followed by value
    const pageQualityMatch =
      html.match(/Page\s*Quality[\s\S]*?<[^>]*>([^<]+)</i) ||
      html.match(/Page\s*Quality[:\s]+([A-Za-z\-\s]+)/i);
    const pageQuality = pageQualityMatch ? pageQualityMatch[1].trim() : null;

    // Grade Date - format like "2017-06-27"
    const gradeDateMatch =
      html.match(/Grade\s*Date[\s\S]*?(\d{4}-\d{2}-\d{2})/i) ||
      html.match(/Grade\s*Date[\s\S]*?<[^>]*>([^<]+)</i);
    const gradeDate = gradeDateMatch ? gradeDateMatch[1].trim() : null;

    // Label Category (Universal, Signature Series, etc.)
    const labelMatch =
      html.match(/Label\s*Category[\s\S]*?<[^>]*>([^<]+)</i) ||
      html.match(/Label\s*Category[:\s]+([^<\n]+)/i);
    const labelType = labelMatch ? labelMatch[1].trim() : null;

    // Art Comments - creator info
    const artCommentsMatch =
      html.match(/Art\s*Comments[\s\S]*?<[^>]*>([^<]+(?:<br[^>]*>[^<]+)*)</i) ||
      html.match(/Art\s*Comments[:\s]+([^\n]+)/i);
    const artComments = artCommentsMatch
      ? artCommentsMatch[1].replace(/<br[^>]*>/gi, "\n").trim()
      : null;

    // Key Comments - first appearances, significance
    const keyCommentsMatch =
      html.match(/Key\s*Comments[\s\S]*?<[^>]*>([^<]+(?:<br[^>]*>[^<]+)*)</i) ||
      html.match(/Key\s*Comments[:\s]+([^\n]+)/i);
    const keyComments = keyCommentsMatch
      ? keyCommentsMatch[1].replace(/<br[^>]*>/gi, "\n").trim()
      : null;

    // Grader Notes - defects noted by grader
    const graderNotesMatch =
      html.match(/Grader\s*Notes[\s\S]*?<[^>]*>([^<]+(?:<br[^>]*>[^<]+)*)</i) ||
      html.match(/Grader\s*Notes[:\s]+([^\n]+(?:\n[^\n]+)*)/i);
    const graderNotes = graderNotesMatch
      ? graderNotesMatch[1].replace(/<br[^>]*>/gi, "\n").trim()
      : null;

    // Signatures - who signed the comic
    const signaturesMatch =
      html.match(/Signatures[\s\S]*?<[^>]*>([^<]+(?:<br[^>]*>[^<]+)*)</i) ||
      html.match(/Signatures[:\s]+([^\n]+)/i) ||
      html.match(/SIGNED BY[^<\n]+/i);
    const signatures = signaturesMatch
      ? (typeof signaturesMatch[1] === "string" ? signaturesMatch[1] : signaturesMatch[0])
          .replace(/<br[^>]*>/gi, "\n")
          .trim()
      : null;

    // Parse title to extract series name and issue number
    let title: string | null = null;
    let issueNumber: string | null = null;

    if (titleMatch) {
      const fullTitle = titleMatch[1].trim();
      // Try to split "Amazing Spider-Man #300" or "Fantastic Four 46" format
      const issueMatch = fullTitle.match(/^(.+?)\s*#?(\d+[A-Za-z]?)$/);
      if (issueMatch) {
        title = issueMatch[1].trim();
        issueNumber = issueMatch[2];
      } else {
        title = fullTitle;
      }
    }

    // Also try to get issue number from Issue field
    if (!issueNumber) {
      const issueFieldMatch = html.match(/>Issue<[\s\S]*?<[^>]*>(\d+[A-Za-z]?)</i);
      if (issueFieldMatch) {
        issueNumber = issueFieldMatch[1];
      }
    }

    // Check if we got any useful data
    if (!title && !grade) {
      return {
        success: false,
        source: "cgc",
        certNumber,
        error: "Could not parse certification data",
      };
    }

    return {
      success: true,
      source: "cgc",
      certNumber,
      data: {
        title,
        issueNumber,
        publisher,
        releaseYear,
        grade,
        gradeLabel: null,
        labelType,
        variant: null,
        pageQuality,
        gradeDate,
        graderNotes,
        signatures,
        keyComments,
        artComments,
      },
    };
  } catch (error) {
    console.error("[cert-lookup] Error parsing CGC response:", error);
    return {
      success: false,
      source: "cgc",
      certNumber,
      error: "Failed to parse CGC response",
    };
  }
}

// ============================================
// CBCS Lookup
// ============================================

/**
 * Look up a comic by CBCS certification number
 * URL format: https://cbcscomics.com/grading-notes/{certNumber}
 * CBCS cert numbers can contain letters and dashes (e.g., "20-1F9AC96-004")
 */
export async function lookupCBCSCert(certNumber: string): Promise<CertLookupResult> {
  // CBCS certs can have alphanumeric format with dashes, so don't strip non-digits
  const cleanCert = certNumber.trim();

  if (!cleanCert || cleanCert.length < 5) {
    return {
      success: false,
      source: "cbcs",
      certNumber,
      error: "Invalid CBCS certification number",
    };
  }

  try {
    const response = await fetch(
      `https://cbcscomics.com/grading-notes/${encodeURIComponent(cleanCert)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; CollectorsChest/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
      }
    );

    if (!response.ok) {
      return {
        success: false,
        source: "cbcs",
        certNumber: cleanCert,
        error: `CBCS lookup failed: ${response.status}`,
      };
    }

    const html = await response.text();
    return parseCBCSResponse(html, cleanCert);
  } catch (error) {
    console.error("[cert-lookup] CBCS lookup error:", error);
    return {
      success: false,
      source: "cbcs",
      certNumber: cleanCert,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Parse CBCS verification page HTML
 * CBCS page structure includes: Title #Issue, Publisher, Date, Variant,
 * Grade, Page Quality (under Verified), Signees, Notes (grader notes)
 */
export function parseCBCSResponse(html: string, certNumber: string): CertLookupResult {
  try {
    // Check if cert was found
    if (
      html.includes("not found") ||
      html.includes("No results") ||
      html.includes("invalid") ||
      html.includes("no record")
    ) {
      return {
        success: false,
        source: "cbcs",
        certNumber,
        error: "Certification number not found",
      };
    }

    // Title is typically in a header element like "Spider-Man #1"
    const titleMatch =
      html.match(/<h[1-3][^>]*>([^<]+#\d+[A-Za-z]?)<\/h[1-3]>/i) ||
      html.match(/>([^<]+#\d+[A-Za-z]?)</i);

    // Publisher and date often appear together like "Marvel 8 1990"
    const publisherDateMatch = html.match(/>([A-Za-z\s]+)\s+(\d{1,2})\s+(\d{4})</i);
    const publisher = publisherDateMatch ? publisherDateMatch[1].trim() : null;
    const releaseYear = publisherDateMatch ? publisherDateMatch[3] : null;

    // Grade - typically a standalone number like "9.4"
    const gradeMatch =
      html.match(/>(\d+\.?\d*)<[^>]*>[\s\S]*?Verified/i) ||
      html.match(/>\s*(\d+\.?\d*)\s*<[\s\S]*?Verified/i) ||
      html.match(/>(\d+\.\d)<\/[^>]+>/i);

    // Variant - look for "Variant:" prefix
    const variantMatch =
      html.match(/Variant[:\s]*([^<\n]+)/i) || html.match(/>Variant:\s*([^<]+)</i);
    const variant = variantMatch ? variantMatch[1].trim() : null;

    // Page Quality - appears under "Verified" section
    const pageQualityMatch =
      html.match(/Verified[\s\S]*?<[^>]*>([A-Za-z][A-Za-z\s\-]*)</i) ||
      html.match(/>(\s*White\s*|\s*Off-White\s*|\s*Cream\s*)<\/[^>]+>/i);
    const pageQuality = pageQualityMatch ? pageQualityMatch[1].trim() : null;

    // Signees - who signed the comic
    const signeesMatch =
      html.match(/Signees:[\s\S]*?<[^>]*>([^<]+(?:<[^>]*>[^<]+)*)/i) ||
      html.match(/Verified Signature[:\s]*([^<\n]+)/i);
    let signatures: string | null = null;
    if (signeesMatch) {
      signatures = signeesMatch[1]
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    // Notes (Grader Notes) - defects/comments
    const notesMatch =
      html.match(/Notes:[\s\S]*?<[^>]*>([^<]+(?:<[^>]*>[^<]+)*)/i) ||
      html.match(/>Notes:<[\s\S]*?<[^>]*>([^<]+)/i);
    let graderNotes: string | null = null;
    if (notesMatch) {
      graderNotes = notesMatch[1]
        .replace(/<[^>]*>/g, "\n")
        .replace(/\n+/g, "\n")
        .trim();
    }

    // Parse title to extract series name and issue number
    let title: string | null = null;
    let issueNumber: string | null = null;

    if (titleMatch) {
      const fullTitle = titleMatch[1].trim();
      const issueMatch = fullTitle.match(/^(.+?)\s*#(\d+[A-Za-z]?)$/);
      if (issueMatch) {
        title = issueMatch[1].trim();
        issueNumber = issueMatch[2];
      } else {
        title = fullTitle;
      }
    }

    // Extract grade value
    const grade = gradeMatch ? gradeMatch[1] : null;

    if (!title && !grade) {
      return {
        success: false,
        source: "cbcs",
        certNumber,
        error: "Could not parse certification data",
      };
    }

    return {
      success: true,
      source: "cbcs",
      certNumber,
      data: {
        title,
        issueNumber,
        publisher,
        releaseYear,
        grade,
        gradeLabel: null,
        labelType: signatures ? "Verified Signature" : null,
        variant,
        pageQuality,
        gradeDate: null, // CBCS doesn't show grade date
        graderNotes,
        signatures,
        keyComments: null, // CBCS doesn't have key comments
        artComments: null,
      },
    };
  } catch (error) {
    console.error("[cert-lookup] Error parsing CBCS response:", error);
    return {
      success: false,
      source: "cbcs",
      certNumber,
      error: "Failed to parse CBCS response",
    };
  }
}

// ============================================
// PGX Lookup
// ============================================

/**
 * Look up a comic by PGX certification number
 * URL format: https://www.pgxcomics.com/cert/verify/{certNumber}
 */
export async function lookupPGXCert(certNumber: string): Promise<CertLookupResult> {
  const cleanCert = certNumber.replace(/\D/g, "");

  if (!cleanCert || cleanCert.length < 5) {
    return {
      success: false,
      source: "pgx",
      certNumber,
      error: "Invalid PGX certification number",
    };
  }

  try {
    const response = await fetch(`https://www.pgxcomics.com/cert/verify/${cleanCert}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CollectorsChest/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        source: "pgx",
        certNumber: cleanCert,
        error: `PGX lookup failed: ${response.status}`,
      };
    }

    const html = await response.text();
    return parsePGXResponse(html, cleanCert);
  } catch (error) {
    console.error("[cert-lookup] PGX lookup error:", error);
    return {
      success: false,
      source: "pgx",
      certNumber: cleanCert,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Parse PGX verification page HTML
 */
export function parsePGXResponse(html: string, certNumber: string): CertLookupResult {
  try {
    if (html.includes("not found") || html.includes("No results") || html.includes("invalid")) {
      return {
        success: false,
        source: "pgx",
        certNumber,
        error: "Certification number not found",
      };
    }

    const titleMatch = html.match(/(?:title|Title)[:\s]*([^<\n]+)/i);
    const gradeMatch = html.match(/(?:grade|Grade)[:\s]*(\d+\.?\d*)/i);
    const yearMatch = html.match(/\((\d{4})\)/);

    let title: string | null = null;
    let issueNumber: string | null = null;

    if (titleMatch) {
      const fullTitle = titleMatch[1].trim();
      const issueMatch = fullTitle.match(/^(.+?)\s*#(\d+[A-Za-z]?)$/);
      if (issueMatch) {
        title = issueMatch[1].trim();
        issueNumber = issueMatch[2];
      } else {
        title = fullTitle;
      }
    }

    if (!title && !gradeMatch) {
      return {
        success: false,
        source: "pgx",
        certNumber,
        error: "Could not parse certification data",
      };
    }

    return {
      success: true,
      source: "pgx",
      certNumber,
      data: {
        title,
        issueNumber,
        publisher: null,
        releaseYear: yearMatch ? yearMatch[1] : null,
        grade: gradeMatch ? gradeMatch[1] : null,
        gradeLabel: null,
        labelType: null,
        variant: null,
        pageQuality: null,
        gradeDate: null,
        graderNotes: null,
        signatures: null,
        keyComments: null,
        artComments: null,
      },
    };
  } catch (error) {
    console.error("[cert-lookup] Error parsing PGX response:", error);
    return {
      success: false,
      source: "pgx",
      certNumber,
      error: "Failed to parse PGX response",
    };
  }
}

// ============================================
// Main Router Function
// ============================================

/**
 * Look up certification from the appropriate grading company
 */
export async function lookupCertification(
  gradingCompany: "CGC" | "CBCS" | "PGX" | string,
  certNumber: string
): Promise<CertLookupResult> {
  const company = gradingCompany.toUpperCase();
  const cleanCert = certNumber.replace(/\D/g, ""); // Normalize for cache key

  // ============================================
  // Cert Caching (Phase 2 optimization)
  // Cache cert results for 1 year - certificates never change
  // Saves web scraping calls and improves response time
  // ============================================
  const cacheKey = `${company.toLowerCase()}-${cleanCert}`;
  const cachedResult = await cacheGet<CertLookupResult>(cacheKey, "cert");

  if (cachedResult && cachedResult.success && cachedResult.data) {
    return cachedResult;
  }

  // Fetch from grading company website
  let result: CertLookupResult;

  switch (company) {
    case "CGC":
      result = await lookupCGCCert(certNumber);
      break;
    case "CBCS":
      result = await lookupCBCSCert(certNumber);
      break;
    case "PGX":
      result = await lookupPGXCert(certNumber);
      break;
    default:
      return {
        success: false,
        source: "cgc",
        certNumber,
        error: `Unsupported grading company: ${gradingCompany}`,
      };
  }

  // Cache successful results for 1 year (fire and forget)
  if (result.success && result.data) {
    cacheSet(cacheKey, result, "cert").catch(() => {});
  }

  return result;
}

/**
 * Try to detect which grading company based on cert number format
 */
export function detectGradingCompany(certNumber: string): "CGC" | "CBCS" | "PGX" | null {
  const trimmed = certNumber.trim();

  // CBCS cert numbers have alphanumeric format with dashes (e.g., "20-1F9AC96-004")
  if (/^[\dA-Z]+-[A-Z0-9]+-\d+$/i.test(trimmed) || /[A-F]/i.test(trimmed)) {
    return "CBCS";
  }

  const digitsOnly = trimmed.replace(/\D/g, "");

  // CGC cert numbers are typically 10 digits
  if (digitsOnly.length === 10) {
    return "CGC";
  }

  // CGC can also be 7-10 digits for older certs
  if (digitsOnly.length >= 7 && digitsOnly.length <= 10 && /^\d+$/.test(trimmed)) {
    return "CGC";
  }

  // PGX cert numbers are typically shorter (5-7 digits)
  if (digitsOnly.length >= 5 && digitsOnly.length <= 7) {
    return "PGX";
  }

  return null;
}
