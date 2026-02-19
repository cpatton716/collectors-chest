import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import Anthropic from "@anthropic-ai/sdk";

import { isUserSuspended } from "@/lib/adminAuth";
import {
  cacheGet,
  cacheSet,
  generateEbayPriceCacheKey,
  hashImageData,
  isCacheAvailable,
} from "@/lib/cache";
import { lookupCertification } from "@/lib/certLookup";
import { getProfileByClerkId } from "@/lib/db";
import { isFindingApiConfigured, lookupEbaySoldPrices } from "@/lib/ebayFinding";
import { lookupKeyInfo } from "@/lib/keyComicsDatabase";
import { MODEL_PRIMARY } from "@/lib/models";
import { checkRateLimit, getRateLimitIdentifier, rateLimiters } from "@/lib/rateLimit";
import {
  GUEST_SCAN_LIMIT,
  canUserScan,
  getSubscriptionStatus,
  incrementScanCount,
} from "@/lib/subscription";

import { PriceData } from "@/types/comic";

// Barcode detection result from AI analysis
interface BarcodeDetection {
  raw: string;
  confidence: "high" | "medium" | "low";
}

// Parsed barcode components (UPC-A with optional 5-digit add-on)
interface ParsedBarcode {
  upcPrefix: string; // First 5 digits (publisher code)
  itemNumber: string; // Next 6 digits (item identifier)
  checkDigit: string; // Digit 12 (check digit)
  addonIssue?: string; // Digits 13-15 (issue number, if present)
  addonVariant?: string; // Digits 16-17 (variant code, if present)
}

// Interface for comic details from AI analysis
interface ComicDetails {
  title: string | null;
  issueNumber: string | null;
  publisher: string | null;
  releaseYear: string | null;
  variant: string | null;
  writer: string | null;
  coverArtist: string | null;
  interiorArtist: string | null;
  confidence?: string;
  isSlabbed: boolean;
  gradingCompany: string | null;
  grade: string | null;
  certificationNumber: string | null;
  isSignatureSeries?: boolean;
  signedBy?: string | null;
  keyInfo: string[];
  labelType?: string;
  pageQuality?: string;
  gradeDate?: string;
  graderNotes?: string;
  priceData?: (PriceData & { priceSource: "ebay" | "ai" }) | null;
  barcodeNumber?: string | null; // UPC barcode if visible in image (legacy field)
  barcode?: { raw: string; confidence: "high" | "medium" | "low"; parsed?: ParsedBarcode } | null; // Enhanced barcode detection
  dataSource?: "barcode" | "ai" | "cache"; // Track where primary data came from
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Parse a UPC barcode string into its component parts
 * UPC-A (12 digits): PPPPP IIIIII C
 * UPC-A with add-on (17 digits): PPPPP IIIIII C AAA VV
 *
 * @param barcodeRaw - The raw barcode string (12-17 digits)
 * @returns Parsed components or null if invalid format
 */
function parseBarcode(barcodeRaw: string): ParsedBarcode | null {
  // Clean the barcode (remove any spaces/dashes)
  const clean = barcodeRaw.replace(/[\s-]/g, "");

  // Must be 12-17 digits
  if (!/^\d{12,17}$/.test(clean)) {
    return null;
  }

  const parsed: ParsedBarcode = {
    upcPrefix: clean.slice(0, 5), // First 5 digits (publisher code)
    itemNumber: clean.slice(5, 11), // Next 6 digits (item identifier)
    checkDigit: clean.slice(11, 12), // Digit 12 (check digit)
  };

  // If we have a 5-digit add-on (digits 13-17)
  if (clean.length >= 15) {
    parsed.addonIssue = clean.slice(12, 15); // Digits 13-15 (issue number)
  }
  if (clean.length >= 17) {
    parsed.addonVariant = clean.slice(15, 17); // Digits 16-17 (variant code)
  }

  return parsed;
}

// Phase 3: Removed Supabase cache layer - using Redis only for eBay prices
// This simplifies the caching architecture and reduces latency

export async function POST(request: NextRequest) {
  // Track profile for scan counting at the end
  let profileId: string | null = null;

  try {
    // Rate limit check - protect expensive AI endpoint
    const identifier = getRateLimitIdentifier(
      null,
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")
    );
    const { success: rateLimitSuccess, response: rateLimitResponse } = await checkRateLimit(
      rateLimiters.analyze,
      identifier
    );
    if (!rateLimitSuccess) return rateLimitResponse;

    // ============================================
    // Scan Limit Enforcement
    // ============================================
    const { userId } = await auth();

    if (userId) {
      // Check if user is suspended
      const suspensionStatus = await isUserSuspended(userId);
      if (suspensionStatus.suspended) {
        return NextResponse.json(
          {
            error: "account_suspended",
            message: "Your account has been suspended.",
            suspended: true,
          },
          { status: 403 }
        );
      }

      // Registered user - check subscription limits
      const profile = await getProfileByClerkId(userId);
      if (profile) {
        profileId = profile.id;
        const canScan = await canUserScan(profile.id);

        if (!canScan) {
          const status = await getSubscriptionStatus(profile.id);
          return NextResponse.json(
            {
              error: "scan_limit_reached",
              message: "You've used all your scans for this month.",
              scansUsed: status?.scansUsed || 0,
              monthResetDate: status?.monthResetDate.toISOString(),
              tier: status?.tier || "free",
              canStartTrial: status?.tier === "free" && !status?.isTrialing,
            },
            { status: 403 }
          );
        }
      }
    } else {
      // Guest user - check client-provided guest scan count
      // Note: This is validated client-side, but we add server awareness for analytics
      const guestScans = parseInt(request.headers.get("x-guest-scan-count") || "0");
      if (guestScans >= GUEST_SCAN_LIMIT) {
        return NextResponse.json(
          {
            error: "guest_limit_reached",
            message: "You've used all your free scans. Create an account to continue.",
            scansUsed: guestScans,
            limit: GUEST_SCAN_LIMIT,
          },
          { status: 403 }
        );
      }
    }

    const { image, mediaType } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: "No image was received. Please try uploading your photo again." },
        { status: 400 }
      );
    }

    // Check if image is too large (base64 adds ~33% overhead, so 20MB base64 ≈ 15MB image)
    if (image.length > 20 * 1024 * 1024) {
      return NextResponse.json(
        {
          error:
            "This image is too large. Please use a smaller image (under 10MB) or try taking a new photo.",
        },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        {
          error:
            "Our comic recognition service is temporarily unavailable. Please try again in a few minutes.",
        },
        { status: 500 }
      );
    }

    // Remove data URL prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    // ============================================
    // Image Hash Caching (Phase 2 optimization)
    // Cache AI analysis results by image hash for 30 days
    // Saves ~$0.005-0.007 per duplicate/retry scan
    // ============================================
    const imageHash = hashImageData(base64Data);
    const cachedAnalysis = await cacheGet<{
      title: string;
      issueNumber: string;
      publisher: string | null;
      releaseYear: string | null;
      variant: string | null;
      writer: string | null;
      coverArtist: string | null;
      interiorArtist: string | null;
      isSlabbed: boolean;
      grade: string | null;
      gradingCompany: string | null;
      certificationNumber: string | null;
      keyInfo: string[];
    }>(imageHash, "aiAnalyze");

    // If we have a cached result, use it but still get fresh pricing
    let comicDetails: ComicDetails;
    let usedCache = false;

    if (cachedAnalysis && cachedAnalysis.title) {
      comicDetails = { ...cachedAnalysis };
      usedCache = true;
    } else {
      // No cache hit - run the AI image analysis
      const response = await anthropic.messages.create({
        model: MODEL_PRIMARY,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType || "image/jpeg",
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: `You are an expert comic book identifier and grading specialist. Analyze this comic book cover image and extract as much information as possible.

Look carefully at:
1. The title of the comic series (usually prominently displayed)
2. The issue number (often with # symbol)
3. The publisher logo (Marvel, DC, Image, Dark Horse, etc.)
4. Any variant cover indicators (Cover A, B, 1:25, etc.)
5. Creator credits if visible (writer, artist names)
6. The publication year or month/year
7. **UPC BARCODE DETECTION** - Look for any UPC barcode visible on the cover:
   - Read ALL digits carefully (typically 12 digits for UPC-A, plus optional 5-digit add-on = 17 total)
   - The main UPC is 12 digits; if there's a smaller 5-digit add-on code to the right, include those too
   - Report your confidence level based on image clarity:
     * "high" - barcode is clear and fully readable
     * "medium" - barcode is partially visible or slightly blurry but you can make out most digits
     * "low" - barcode is obscured, damaged, or very blurry but you can attempt to read it
   - If no barcode is visible at all, return null for the barcode field
8. WHETHER THIS IS A GRADED/SLABBED COMIC - Look for:
   - A hard plastic case (slab) around the comic
   - A label at the top with grading company logo (CGC, CBCS, PGX)
   - A numeric grade (e.g., 9.8, 9.6, 9.4, 9.0, etc.)
   - "Signature Series" or "SS" indicating it's signed
   - The name of who signed it (often on the label)
   - THE CERTIFICATION NUMBER - This is a long number (usually 7-10 digits) on the label, often near a barcode

Return your findings as a JSON object with this exact structure:
{
  "title": "series title or null if not identifiable",
  "issueNumber": "issue number as string or null",
  "variant": "variant name if this is a variant cover, otherwise null",
  "publisher": "publisher name or null",
  "coverArtist": "cover artist name if visible, otherwise null",
  "writer": "writer name if visible, otherwise null",
  "interiorArtist": "interior artist if visible (usually same as cover unless specified), otherwise null",
  "releaseYear": "4-digit year as string or null",
  "confidence": "high if most fields identified, medium if some fields identified, low if few fields identified",
  "isSlabbed": true or false - whether the comic is in a graded slab/case,
  "gradingCompany": "CGC" or "CBCS" or "PGX" or "Other" or null if not slabbed,
  "grade": "the numeric grade as a string (e.g., '9.8', '9.0') or null if not slabbed",
  "certificationNumber": "the certification/serial number from the label (7-10 digit number) or null if not visible/not slabbed",
  "isSignatureSeries": true or false - whether it's a Signature Series (signed and authenticated),
  "signedBy": "name of person who signed it or null if not signed/not visible",
  "barcodeNumber": "the full UPC barcode digits (12-17 numbers) if visible on the cover, otherwise null",
  "barcode": {
    "raw": "all barcode digits as a single string (12-17 digits)",
    "confidence": "high" | "medium" | "low"
  } or null if no barcode visible
}

Important:
- Return ONLY the JSON object, no other text
- Use null for any field you cannot determine
- Be accurate - don't guess if you're not confident
- For publisher, use the full name (e.g., "Marvel Comics" not just "Marvel")
- Pay special attention to the grading label if present - it contains valuable info
- The CGC/CBCS label typically shows: grade, title, issue, date, and signature info
- **BARCODE PRIORITY**: If you can see a UPC barcode, read EVERY digit carefully - this enables faster database lookup
- **BARCODE CONFIDENCE**: Report "high" only if you can clearly read all digits; "medium" if some digits are unclear; "low" if barcode is partially obscured`,
              },
            ],
          },
        ],
      });

      // Extract the text content from the response
      const textContent = response.content.find((block) => block.type === "text");
      if (!textContent || textContent.type !== "text") {
        throw new Error(
          "We couldn't analyze this image. Please try a clearer photo of the comic cover."
        );
      }

      // Parse the JSON response
      try {
        // Clean the response - remove any markdown code blocks if present
        let jsonText = textContent.text.trim();

        if (jsonText.startsWith("```json")) {
          jsonText = jsonText.slice(7);
        }
        if (jsonText.startsWith("```")) {
          jsonText = jsonText.slice(3);
        }
        if (jsonText.endsWith("```")) {
          jsonText = jsonText.slice(0, -3);
        }
        comicDetails = JSON.parse(jsonText.trim());
        // Initialize keyInfo as empty array
        comicDetails.keyInfo = [];

        // Parse the barcode into components if detected
        if (comicDetails.barcode && comicDetails.barcode.raw) {
          const parsed = parseBarcode(comicDetails.barcode.raw);
          if (parsed) {
            comicDetails.barcode.parsed = parsed;
          }
        }

        // Ensure backward compatibility: populate barcodeNumber from barcode.raw if needed
        if (comicDetails.barcode?.raw && !comicDetails.barcodeNumber) {
          comicDetails.barcodeNumber = comicDetails.barcode.raw;
        }

        // Cache the AI analysis result for 30 days (Phase 2 optimization)
        // Only cache if we got valid results
        if (comicDetails.title && isCacheAvailable()) {
          const cacheData = {
            title: comicDetails.title,
            issueNumber: comicDetails.issueNumber,
            publisher: comicDetails.publisher,
            releaseYear: comicDetails.releaseYear,
            variant: comicDetails.variant,
            writer: comicDetails.writer,
            coverArtist: comicDetails.coverArtist,
            interiorArtist: comicDetails.interiorArtist,
            isSlabbed: comicDetails.isSlabbed,
            grade: comicDetails.grade,
            gradingCompany: comicDetails.gradingCompany,
            certificationNumber: comicDetails.certificationNumber,
            keyInfo: [], // Don't cache keyInfo - we get it fresh from DB or AI
          };
          // Fire and forget - don't block the response
          cacheSet(imageHash, cacheData, "aiAnalyze").catch(() => {});
        }
      } catch (parseError) {
        console.error("Failed to parse Claude response:", textContent.text);
        console.error("Parse error:", parseError);
        throw new Error(
          "We had trouble reading the comic details. Please try a different photo with the cover clearly visible."
        );
      }
    } // End of else block (no cache hit)

    // Ensure keyInfo is initialized
    if (!comicDetails.keyInfo) {
      comicDetails.keyInfo = [];
    }

    // ============================================
    // BARCODE LOOKUP (Optimization)
    // If Claude detected a barcode, try fast database lookup first
    // Barcode lookups are cached and much faster than AI analysis
    // ============================================
    if (comicDetails.barcodeNumber && !usedCache) {
      try {
        // Clean the barcode (remove any spaces/dashes)
        const cleanBarcode = comicDetails.barcodeNumber.replace(/[\s-]/g, "");

        // Only proceed if it looks like a valid UPC (8-13 digits)
        if (/^\d{8,13}$/.test(cleanBarcode)) {
          // Check barcode cache first
          const cachedBarcode = await cacheGet<{
            title: string | null;
            issueNumber: string | null;
            publisher: string | null;
            releaseYear: string | null;
            writer: string | null;
            coverArtist: string | null;
            interiorArtist: string | null;
          }>(cleanBarcode, "barcode");

          if (cachedBarcode && cachedBarcode.title) {
            // Use barcode lookup data, but keep AI-detected grading info
            const gradingInfo = {
              isSlabbed: comicDetails.isSlabbed,
              gradingCompany: comicDetails.gradingCompany,
              grade: comicDetails.grade,
              certificationNumber: comicDetails.certificationNumber,
              isSignatureSeries: comicDetails.isSignatureSeries,
              signedBy: comicDetails.signedBy,
            };

            comicDetails = {
              ...comicDetails,
              title: cachedBarcode.title || comicDetails.title,
              issueNumber: cachedBarcode.issueNumber || comicDetails.issueNumber,
              publisher: cachedBarcode.publisher || comicDetails.publisher,
              releaseYear: cachedBarcode.releaseYear || comicDetails.releaseYear,
              writer: cachedBarcode.writer || comicDetails.writer,
              coverArtist: cachedBarcode.coverArtist || comicDetails.coverArtist,
              interiorArtist: cachedBarcode.interiorArtist || comicDetails.interiorArtist,
              ...gradingInfo,
              dataSource: "barcode",
              keyInfo: [], // Will be populated later
            };
          } else {
            // Try fresh barcode lookup via Comic Vine
            const COMIC_VINE_API_KEY = process.env.COMIC_VINE_API_KEY;
            if (COMIC_VINE_API_KEY) {
              const upcWithoutCheckDigit = cleanBarcode.slice(0, -1);
              const searchUrl = `https://comicvine.gamespot.com/api/issues/?api_key=${COMIC_VINE_API_KEY}&format=json&filter=upc:${upcWithoutCheckDigit}&field_list=id,name,issue_number,cover_date,image,volume,person_credits`;

              const barcodeResponse = await fetch(searchUrl, {
                headers: { "User-Agent": "ComicTracker/1.0" },
              });

              if (barcodeResponse.ok) {
                const barcodeData = await barcodeResponse.json();
                if (barcodeData.results && barcodeData.results.length > 0) {
                  const issue = barcodeData.results[0];
                  const gradingInfo = {
                    isSlabbed: comicDetails.isSlabbed,
                    gradingCompany: comicDetails.gradingCompany,
                    grade: comicDetails.grade,
                    certificationNumber: comicDetails.certificationNumber,
                    isSignatureSeries: comicDetails.isSignatureSeries,
                    signedBy: comicDetails.signedBy,
                  };

                  // Extract year from cover_date
                  let releaseYear: string | null = null;
                  if (issue.cover_date) {
                    const yearMatch = issue.cover_date.match(/(\d{4})/);
                    if (yearMatch) releaseYear = yearMatch[1];
                  }

                  // Extract creators
                  let writer: string | null = null;
                  let coverArtist: string | null = null;
                  let interiorArtist: string | null = null;
                  if (issue.person_credits) {
                    for (const credit of issue.person_credits) {
                      const role = credit.role?.toLowerCase() || "";
                      if (role.includes("writer") && !writer) writer = credit.name;
                      if (role.includes("cover") && !coverArtist) coverArtist = credit.name;
                      if ((role.includes("artist") || role.includes("pencil")) && !interiorArtist) {
                        interiorArtist = credit.name;
                      }
                    }
                  }

                  comicDetails = {
                    ...comicDetails,
                    title: issue.volume?.name || comicDetails.title,
                    issueNumber: issue.issue_number || comicDetails.issueNumber,
                    publisher: issue.volume?.publisher?.name || comicDetails.publisher,
                    releaseYear: releaseYear || comicDetails.releaseYear,
                    writer: writer || comicDetails.writer,
                    coverArtist: coverArtist || comicDetails.coverArtist,
                    interiorArtist: interiorArtist || comicDetails.interiorArtist,
                    ...gradingInfo,
                    dataSource: "barcode",
                    keyInfo: [],
                  };

                  // Cache the barcode result for future lookups (fire and forget)
                  cacheSet(
                    cleanBarcode,
                    {
                      title: comicDetails.title,
                      issueNumber: comicDetails.issueNumber,
                      publisher: comicDetails.publisher,
                      releaseYear: comicDetails.releaseYear,
                      writer: comicDetails.writer,
                      coverArtist: comicDetails.coverArtist,
                      interiorArtist: comicDetails.interiorArtist,
                    },
                    "barcode"
                  ).catch(() => {});
                }
              }
            }
          }
        }
      } catch (barcodeError) {
        console.error("[analyze] Barcode lookup error:", barcodeError);
        // Continue with AI-detected data - barcode lookup is optional optimization
      }
    }

    // Track data source if not already set
    if (!comicDetails.dataSource) {
      comicDetails.dataSource = usedCache ? "cache" : "ai";
    }

    // If this is a slabbed comic with a certification number, look up from grading company
    if (comicDetails.isSlabbed && comicDetails.certificationNumber && comicDetails.gradingCompany) {
      try {
        const certResult = await lookupCertification(
          comicDetails.gradingCompany,
          comicDetails.certificationNumber
        );

        if (certResult.success && certResult.data) {
          // Merge cert data with AI data (cert takes priority for overlapping fields)
          if (certResult.data.title) {
            comicDetails.title = certResult.data.title;
          }
          if (certResult.data.issueNumber) {
            comicDetails.issueNumber = certResult.data.issueNumber;
          }
          if (certResult.data.publisher) {
            comicDetails.publisher = certResult.data.publisher;
          }
          if (certResult.data.releaseYear) {
            comicDetails.releaseYear = certResult.data.releaseYear;
          }
          if (certResult.data.grade) {
            comicDetails.grade = certResult.data.grade;
          }
          if (certResult.data.variant) {
            comicDetails.variant = certResult.data.variant;
          }
          // Store label type and page quality
          if (certResult.data.labelType) {
            comicDetails.labelType = certResult.data.labelType;
          }
          if (certResult.data.pageQuality) {
            comicDetails.pageQuality = certResult.data.pageQuality;
          }
          // Store new grading-specific fields
          if (certResult.data.gradeDate) {
            comicDetails.gradeDate = certResult.data.gradeDate;
          }
          if (certResult.data.graderNotes) {
            comicDetails.graderNotes = certResult.data.graderNotes;
          }
          // Map signatures to signedBy
          if (certResult.data.signatures) {
            comicDetails.signedBy = certResult.data.signatures;
            comicDetails.isSignatureSeries = true;
          }
          // Map keyComments to keyInfo (authoritative source, skip AI lookup)
          if (certResult.data.keyComments) {
            // Split by periods or newlines to create array of key facts
            comicDetails.keyInfo = certResult.data.keyComments
              .split(/[.\n]+/)
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
          }
        } else {
          // Continue with AI-detected data
        }
      } catch (certError) {
        console.error("[analyze] Cert lookup error:", certError);
        // Continue with AI-detected data
      }
    }

    // ============================================
    // COMBINED VERIFICATION CALL (Phase 2 optimization)
    // Merges creator lookup, verification, and key info into ONE API call
    // This saves 30-35% on Anthropic costs vs. 3 separate calls
    // ============================================

    // Check what info is missing
    const missingCreatorInfo =
      !comicDetails.writer || !comicDetails.coverArtist || !comicDetails.interiorArtist;
    const missingBasicInfo = !comicDetails.publisher || !comicDetails.releaseYear;

    // First, check our curated key comics database (fast, guaranteed accurate, FREE)
    let databaseKeyInfo: string[] | null = null;
    if (comicDetails.title && comicDetails.issueNumber) {
      databaseKeyInfo = lookupKeyInfo(comicDetails.title, comicDetails.issueNumber);
      if (databaseKeyInfo && databaseKeyInfo.length > 0) {
        comicDetails.keyInfo = databaseKeyInfo;
      }
    }

    // Only call AI if we need to fill in missing information
    const needsKeyInfoFromAI = !databaseKeyInfo || databaseKeyInfo.length === 0;
    const needsAIVerification =
      comicDetails.title &&
      comicDetails.issueNumber &&
      (missingCreatorInfo || missingBasicInfo || needsKeyInfoFromAI);

    if (needsAIVerification) {
      try {
        // Build a list of what we need
        const missingFields: string[] = [];
        if (missingCreatorInfo)
          missingFields.push("creators (writer, coverArtist, interiorArtist)");
        if (missingBasicInfo) missingFields.push("publication info (publisher, releaseYear)");
        if (needsKeyInfoFromAI) missingFields.push("key collector facts");

        const verifyResponse = await anthropic.messages.create({
          model: MODEL_PRIMARY,
          max_tokens: 384, // Combined call needs slightly more tokens (~300 actual)
          messages: [
            {
              role: "user",
              content: `You are a comic book expert. Complete this comic's information.

Comic: "${comicDetails.title}" #${comicDetails.issueNumber}
Known: Publisher=${comicDetails.publisher || "?"}, Year=${comicDetails.releaseYear || "?"}, Variant=${comicDetails.variant || "standard"}
Need: ${missingFields.join(", ")}

Return JSON:
{
  "writer": "${comicDetails.writer || "fill in or null"}",
  "coverArtist": "${comicDetails.coverArtist || "fill in or null"}",
  "interiorArtist": "${comicDetails.interiorArtist || "fill in or null"}",
  "publisher": "${comicDetails.publisher || "fill in (full name like Marvel Comics)"}",
  "releaseYear": "${comicDetails.releaseYear || "YYYY or null"}",
  "variant": ${comicDetails.variant ? `"${comicDetails.variant}"` : "null if standard cover"},
  "keyInfo": ["ONLY major key facts - first appearances, deaths, origins. Empty array for regular issues."]
}

Rules:
- Keep existing values if already filled
- For keyInfo: ONLY significant collector facts (first appearances of MAJOR characters, major storyline events, origin stories). Most issues = empty array.
- Return ONLY valid JSON, no other text.`,
            },
          ],
        });

        const verifyTextContent = verifyResponse.content.find((block) => block.type === "text");
        if (verifyTextContent && verifyTextContent.type === "text") {
          let verifyJson = verifyTextContent.text.trim();

          // Clean markdown if present
          if (verifyJson.startsWith("```json")) verifyJson = verifyJson.slice(7);
          if (verifyJson.startsWith("```")) verifyJson = verifyJson.slice(3);
          if (verifyJson.endsWith("```")) verifyJson = verifyJson.slice(0, -3);

          const verifyInfo = JSON.parse(verifyJson.trim());

          // Only fill in fields that are missing
          if (!comicDetails.writer && verifyInfo.writer) {
            comicDetails.writer = verifyInfo.writer;
          }
          if (!comicDetails.coverArtist && verifyInfo.coverArtist) {
            comicDetails.coverArtist = verifyInfo.coverArtist;
          }
          if (!comicDetails.interiorArtist && verifyInfo.interiorArtist) {
            comicDetails.interiorArtist = verifyInfo.interiorArtist;
          }
          if (!comicDetails.publisher && verifyInfo.publisher) {
            comicDetails.publisher = verifyInfo.publisher;
          }
          if (!comicDetails.releaseYear && verifyInfo.releaseYear) {
            comicDetails.releaseYear = verifyInfo.releaseYear;
          }
          if (!comicDetails.variant && verifyInfo.variant) {
            comicDetails.variant = verifyInfo.variant;
          }
          // Only use AI keyInfo if we didn't get it from database
          if (needsKeyInfoFromAI && verifyInfo.keyInfo && Array.isArray(verifyInfo.keyInfo)) {
            comicDetails.keyInfo = verifyInfo.keyInfo;
          }
        }
      } catch (verifyError) {
        console.error("Combined verification lookup failed:", verifyError);
        // Continue without the extra data - image analysis result is still valid
      }
    }

    // Price/Value lookup - Try eBay first, fall back to AI
    if (comicDetails.title && comicDetails.issueNumber) {
      const isSlabbed = comicDetails.isSlabbed || false;
      const grade = comicDetails.grade ? parseFloat(comicDetails.grade) : 9.4;
      let priceDataFound = false;

      // 1. Try eBay Finding API first (real sold listings) - with Redis caching only
      // Phase 3: Simplified to use Redis only (removed Supabase cache layer)
      if (isFindingApiConfigured()) {
        try {
          const cacheKey = generateEbayPriceCacheKey(
            comicDetails.title,
            comicDetails.issueNumber,
            grade,
            isSlabbed,
            comicDetails.gradingCompany || undefined
          );

          // Check Redis cache first
          const cachedResult = await cacheGet<PriceData | { noData: true }>(cacheKey, "ebayPrice");
          if (cachedResult !== null) {
            if (!("noData" in cachedResult)) {
              comicDetails.priceData = {
                ...cachedResult,
                priceSource: "ebay",
              };
              priceDataFound = true;
            }
            // If noData marker, priceDataFound stays false - will fall back to AI
          } else {
            // Cache miss - fetch from eBay API
            const ebayPriceData = await lookupEbaySoldPrices(
              comicDetails.title,
              comicDetails.issueNumber,
              grade,
              isSlabbed,
              comicDetails.gradingCompany || undefined
            );

            if (ebayPriceData && ebayPriceData.estimatedValue) {
              comicDetails.priceData = {
                ...ebayPriceData,
                priceSource: "ebay",
              };
              priceDataFound = true;
              // Cache in Redis (fire and forget)
              cacheSet(cacheKey, ebayPriceData, "ebayPrice").catch(() => {});
            } else {
              // Cache "no results" marker to avoid repeated API calls
              cacheSet(cacheKey, { noData: true }, "ebayPrice").catch(() => {});
            }
          }
        } catch (ebayError) {
          console.error("[analyze] eBay lookup failed:", ebayError);
        }
      }

      // 2. Fall back to AI estimates if eBay didn't return results
      if (!priceDataFound) {
        try {
          const gradeInfo = comicDetails.grade ? `Grade: ${comicDetails.grade}` : "Raw/Ungraded";
          const signatureInfo = comicDetails.isSignatureSeries
            ? `Signature Series signed by ${comicDetails.signedBy || "unknown"}`
            : "";
          const gradingCompanyInfo = comicDetails.gradingCompany
            ? `Graded by ${comicDetails.gradingCompany}`
            : "";

          const priceResponse = await anthropic.messages.create({
            model: MODEL_PRIMARY,
            max_tokens: 512, // Reduced from 1024 - actual responses are ~200 tokens
            messages: [
              {
                role: "user",
                content: `You are a comic book market expert with knowledge of recent comic book sales and values.

I need estimated recent sale prices for this comic:
- Title: ${comicDetails.title}
- Issue Number: ${comicDetails.issueNumber}
- Publisher: ${comicDetails.publisher || "Unknown"}
- Year: ${comicDetails.releaseYear || "Unknown"}
- Condition: ${gradeInfo} ${gradingCompanyInfo} ${signatureInfo}

Based on your knowledge of the comic book market, provide realistic estimated recent sale prices. Consider:
- The significance/key status of this issue
- The grade/condition
- Whether it's a signature series (adds value)
- Recent market trends for this title

Return a JSON object with estimated recent sales data AND grade-specific price estimates:
{
  "recentSales": [
    { "price": estimated_price_1, "date": "YYYY-MM-DD", "source": "eBay", "daysAgo": number },
    { "price": estimated_price_2, "date": "YYYY-MM-DD", "source": "eBay", "daysAgo": number },
    { "price": estimated_price_3, "date": "YYYY-MM-DD", "source": "eBay", "daysAgo": number }
  ],
  "gradeEstimates": [
    { "grade": 9.8, "label": "Near Mint/Mint", "rawValue": price, "slabbedValue": price },
    { "grade": 9.4, "label": "Near Mint", "rawValue": price, "slabbedValue": price },
    { "grade": 8.0, "label": "Very Fine", "rawValue": price, "slabbedValue": price },
    { "grade": 6.0, "label": "Fine", "rawValue": price, "slabbedValue": price },
    { "grade": 4.0, "label": "Very Good", "rawValue": price, "slabbedValue": price },
    { "grade": 2.0, "label": "Good", "rawValue": price, "slabbedValue": price }
  ],
  "marketNotes": "brief note about this comic's market value"
}

Important:
- Return ONLY the JSON object, no other text
- For recentSales: provide 3 realistic sale prices at the scanned grade (or 9.4 NM for raw)
- Use dates within the last 6 months (late 2025/early 2026)
- For gradeEstimates: provide realistic price differences between grades
  - Raw comics are ungraded copies (typically 10-30% less than slabbed)
  - Slabbed values are for CGC/CBCS graded copies (command a premium)
  - Higher grades exponentially more valuable for key issues
  - Lower grades have smaller price gaps between them
- Price scaling rules:
  - For KEY issues (first appearances, deaths): 9.8 can be 2-10x the 9.4 price
  - For regular issues: grade premiums are more modest (9.8 ~1.5-2x of 9.4)
  - Raw copies typically 70-90% of equivalent slabbed value
  - Lower grades (2.0-4.0) may be affordable entry points for expensive keys
- Be realistic with actual market pricing behavior`,
              },
            ],
          });

          const priceTextContent = priceResponse.content.find((block) => block.type === "text");
          if (priceTextContent && priceTextContent.type === "text") {
            let priceJson = priceTextContent.text.trim();

            // Clean markdown if present
            if (priceJson.startsWith("```json")) {
              priceJson = priceJson.slice(7);
            }
            if (priceJson.startsWith("```")) {
              priceJson = priceJson.slice(3);
            }
            if (priceJson.endsWith("```")) {
              priceJson = priceJson.slice(0, -3);
            }

            const priceInfo = JSON.parse(priceJson.trim());

            // Process the sales data according to business rules
            const now = new Date();
            const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

            const processedSales = priceInfo.recentSales.map(
              (sale: { price: number; date: string; source: string; daysAgo?: number }) => {
                const saleDate = new Date(sale.date);
                return {
                  price: sale.price,
                  date: sale.date,
                  source: sale.source || "eBay",
                  isOlderThan6Months: saleDate < sixMonthsAgo,
                };
              }
            );

            // Filter to recent sales (within 6 months)
            const recentSales = processedSales.filter(
              (s: { isOlderThan6Months: boolean }) => !s.isOlderThan6Months
            );

            let estimatedValue: number | null = null;
            let isAveraged = false;
            let disclaimer: string | null = null;
            let mostRecentSaleDate: string | null = null;

            // Sort by date to find most recent
            const sortedSales = [...processedSales].sort(
              (a: { date: string }, b: { date: string }) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            );

            if (sortedSales.length > 0) {
              mostRecentSaleDate = sortedSales[0].date;
            }

            if (recentSales.length >= 3) {
              // Average of last 3 recent sales
              const last3 = recentSales.slice(0, 3);
              estimatedValue =
                last3.reduce((sum: number, s: { price: number }) => sum + s.price, 0) / 3;
              isAveraged = true;
              disclaimer = "Technopathic estimate - actual prices may vary.";
            } else if (recentSales.length > 0) {
              // Average of available recent sales
              estimatedValue =
                recentSales.reduce((sum: number, s: { price: number }) => sum + s.price, 0) /
                recentSales.length;
              isAveraged = recentSales.length > 1;
              disclaimer = "Technopathic estimate - actual prices may vary.";
            } else if (processedSales.length > 0) {
              // Only older sales available - use most recent only
              estimatedValue = sortedSales[0].price;
              isAveraged = false;
              disclaimer = "Technopathic estimate - actual prices may vary.";
            }

            // Process grade estimates if available
            let gradeEstimates = undefined;
            if (priceInfo.gradeEstimates && Array.isArray(priceInfo.gradeEstimates)) {
              gradeEstimates = priceInfo.gradeEstimates.map(
                (ge: { grade: number; label: string; rawValue: number; slabbedValue: number }) => ({
                  grade: ge.grade,
                  label: ge.label,
                  rawValue: Math.round(ge.rawValue * 100) / 100,
                  slabbedValue: Math.round(ge.slabbedValue * 100) / 100,
                })
              );
            }

            // Determine base grade for the estimate
            const baseGrade = comicDetails.grade ? parseFloat(comicDetails.grade) : 9.4;

            comicDetails.priceData = {
              estimatedValue: estimatedValue ? Math.round(estimatedValue * 100) / 100 : null,
              recentSales: processedSales,
              mostRecentSaleDate,
              isAveraged,
              disclaimer,
              gradeEstimates,
              baseGrade,
              priceSource: "ai",
            };
          }
        } catch (priceError) {
          console.error("AI Price lookup failed:", priceError);
          comicDetails.priceData = null;
        }
      }
    } else {
      comicDetails.priceData = null;
    }

    // ============================================
    // Increment Scan Count (after successful analysis)
    // ============================================
    if (profileId) {
      // Fire and forget - don't block the response
      incrementScanCount(profileId, "scan").catch((err) => {
        console.error("Failed to increment scan count:", err);
      });
    }

    return NextResponse.json(comicDetails);
  } catch (error) {
    console.error("Error analyzing comic:", error);

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        {
          error:
            "Our comic recognition service is temporarily busy. Please wait a moment and try again.",
        },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Something went wrong while analyzing your comic. Please try again or use a different photo.",
      },
      { status: 500 }
    );
  }
}
