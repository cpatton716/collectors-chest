import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { isUserSuspended } from "@/lib/adminAuth";
import { executeWithFallback, getRemainingBudget, getProviders } from "@/lib/aiProvider";
import type { ScanResponseMeta } from "@/lib/providers/types";
import {
  cacheGet,
  cacheSet,
  generateComicMetadataCacheKey,
  generateEbayPriceCacheKey,
  hashImageData,
  isCacheAvailable,
} from "@/lib/cache";
import { lookupCertification } from "@/lib/certLookup";
import { getComicMetadata, getProfileByClerkId, saveComicMetadata } from "@/lib/db";
import { isFindingApiConfigured, lookupEbaySoldPrices } from "@/lib/ebayFinding";
import { ComicMetadata, mergeMetadataIntoDetails, buildMetadataSavePayload } from "@/lib/metadataCache";
import { lookupKeyInfo } from "@/lib/keyComicsDatabase";
import { estimateScanCostCents, trackScanServer, recordScanAnalytics } from "@/lib/analyticsServer";
import { checkRateLimit, getRateLimitIdentifier, rateLimiters } from "@/lib/rateLimit";
import {
  GUEST_SCAN_LIMIT,
  canUserScan,
  getSubscriptionStatus,
  incrementScanCount,
} from "@/lib/subscription";

import { PriceData } from "@/types/comic";

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
  let subscriptionTier: string = "free";

  // Tracking variables (declared outside try so catch block can access them)
  const scanStartTime = Date.now();
  let aiCallsMade = 0;
  let ebayLookupMade = false;
  let p1: string = "anthropic"; // Primary provider used — default for catch block

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
        subscriptionTier = profile.subscription_tier || "free";
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

    const aiProviders = getProviders();

    // Provider tracking variables
    p1 = aiProviders[0]?.name || "anthropic";
    let fb1 = false;
    let fr1: string | null = null;
    if (cachedAnalysis && cachedAnalysis.title) {
      comicDetails = { ...cachedAnalysis };
      usedCache = true;
    } else {
      // No cache hit - run the AI image analysis

      // Call 1: Image Analysis (REQUIRED)
      const call1Timeout = Math.min(12_000, getRemainingBudget(scanStartTime));
      const call1FallbackTimeout = Math.min(10_000, getRemainingBudget(scanStartTime));
      const {
        result: imageResult,
        provider: imageProvider,
        fallbackUsed: imageFallbackUsed,
        fallbackReason: imageFallbackReason,
      } = await executeWithFallback(
        (provider, signal) =>
          provider.analyzeImage({ base64Data, mediaType: mediaType || "image/jpeg" }, { signal }),
        call1Timeout,
        call1FallbackTimeout,
        "imageAnalysis",
        aiProviders
      );
      aiCallsMade++;
      p1 = imageProvider;
      fb1 = imageFallbackUsed;
      fr1 = imageFallbackReason;

      // Map provider result to comicDetails (same structure as before)
      comicDetails = {
        title: imageResult.title,
        issueNumber: imageResult.issueNumber,
        publisher: imageResult.publisher,
        releaseYear: imageResult.releaseYear,
        variant: imageResult.variant,
        writer: imageResult.writer,
        coverArtist: imageResult.coverArtist,
        interiorArtist: imageResult.interiorArtist,
        confidence: imageResult.confidence || "medium",
        isSlabbed: imageResult.isSlabbed || false,
        gradingCompany: imageResult.gradingCompany || null,
        grade: imageResult.grade || null,
        certificationNumber: imageResult.certificationNumber || null,
        isSignatureSeries: imageResult.isSignatureSeries || false,
        signedBy: imageResult.signedBy || null,
        labelType: imageResult.labelType || undefined,
        pageQuality: imageResult.pageQuality || undefined,
        gradeDate: imageResult.gradeDate || undefined,
        graderNotes: imageResult.graderNotes || undefined,
        keyInfo: [],
        barcode: imageResult.barcode || null,
        barcodeNumber: imageResult.barcodeNumber || null,
      };

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

    // First, check our curated key comics database (fast, guaranteed accurate, FREE)
    let databaseKeyInfo: string[] | null = null;
    if (comicDetails.title && comicDetails.issueNumber) {
      databaseKeyInfo = lookupKeyInfo(comicDetails.title, comicDetails.issueNumber);
      if (databaseKeyInfo && databaseKeyInfo.length > 0) {
        comicDetails.keyInfo = databaseKeyInfo;
      }
    }

    // ============================================
    // Metadata Cache Lookup (dual-layer: Redis → Supabase)
    // ============================================
    let metadataCacheHit = false;
    if (comicDetails.title && comicDetails.issueNumber) {
      try {
        const metaCacheKey = generateComicMetadataCacheKey(
          comicDetails.title,
          comicDetails.issueNumber
        );

        // Layer 1: Redis (fast, 7-day TTL)
        let cachedMetadata = await cacheGet<ComicMetadata>(metaCacheKey, "comicMetadata");

        // Layer 2: Supabase fallback (permanent)
        if (!cachedMetadata) {
          const dbMetadata = await getComicMetadata(comicDetails.title, comicDetails.issueNumber);
          if (dbMetadata) {
            cachedMetadata = dbMetadata as ComicMetadata;
            // Backfill Redis for next time (fire-and-forget)
            cacheSet(metaCacheKey, dbMetadata, "comicMetadata").catch(() => {});
          }
        }

        if (cachedMetadata) {
          metadataCacheHit = true;
          mergeMetadataIntoDetails(
            comicDetails as unknown as Record<string, unknown>,
            cachedMetadata
          );
        }
      } catch (cacheError) {
        console.error("Metadata cache lookup failed:", cacheError);
      }
    }

    // Recheck missing fields after cache merge
    const missingCreatorInfoAfterCache =
      !comicDetails.writer || !comicDetails.coverArtist || !comicDetails.interiorArtist;
    const missingBasicInfoAfterCache = !comicDetails.publisher || !comicDetails.releaseYear;

    // Only call AI if we STILL need to fill in missing information after cache
    const needsKeyInfoFromAI = !comicDetails.keyInfo || comicDetails.keyInfo.length === 0;
    const needsAIVerification =
      comicDetails.title &&
      comicDetails.issueNumber &&
      (missingCreatorInfoAfterCache || missingBasicInfoAfterCache || needsKeyInfoFromAI);

    let verificationMeta = { provider: p1, fallbackUsed: false, fallbackReason: null as string | null };

    if (needsAIVerification) {
      const call2Budget = getRemainingBudget(scanStartTime);
      if (call2Budget < 3000) {
        console.warn(`[scan] Skipping verification: only ${call2Budget}ms remaining`);
      } else {
        try {
          const missingFields: string[] = [];
          if (!comicDetails.writer) missingFields.push("writer");
          if (!comicDetails.coverArtist) missingFields.push("coverArtist");
          if (!comicDetails.interiorArtist) missingFields.push("interiorArtist");
          if (!comicDetails.publisher) missingFields.push("publisher");
          if (!comicDetails.releaseYear) missingFields.push("releaseYear");

          const { result: verifyResult, ...meta } = await executeWithFallback(
            (provider, signal) =>
              provider.verifyAndEnrich(
                {
                  title: comicDetails.title || "",
                  issueNumber: comicDetails.issueNumber || "",
                  publisher: comicDetails.publisher,
                  releaseYear: comicDetails.releaseYear,
                  variant: comicDetails.variant,
                  writer: comicDetails.writer,
                  coverArtist: comicDetails.coverArtist,
                  interiorArtist: comicDetails.interiorArtist,
                  missingFields,
                },
                { signal }
              ),
            Math.min(8_000, call2Budget),
            Math.min(6_000, getRemainingBudget(scanStartTime)),
            "verification",
            aiProviders
          );
          verificationMeta = meta;
          aiCallsMade++;

          // Merge verification results — only fill missing fields
          if (!comicDetails.writer && verifyResult.writer) comicDetails.writer = verifyResult.writer;
          if (!comicDetails.coverArtist && verifyResult.coverArtist) comicDetails.coverArtist = verifyResult.coverArtist;
          if (!comicDetails.interiorArtist && verifyResult.interiorArtist) comicDetails.interiorArtist = verifyResult.interiorArtist;
          if (!comicDetails.publisher && verifyResult.publisher) comicDetails.publisher = verifyResult.publisher;
          if (!comicDetails.releaseYear && verifyResult.releaseYear) comicDetails.releaseYear = verifyResult.releaseYear;
          if (!comicDetails.variant && verifyResult.variant) comicDetails.variant = verifyResult.variant;
          // Only use AI keyInfo if we didn't get it from database
          if (needsKeyInfoFromAI && verifyResult.keyInfo?.length) {
            comicDetails.keyInfo = verifyResult.keyInfo;
          }
        } catch {
          // Continue with partial data — image analysis result is still valid
          console.warn("[scan] Verification failed on all providers, continuing with partial data");
        }
      }
    }

    // Price/Value lookup - Try eBay first, fall back to AI
    let priceMeta = { provider: p1, fallbackUsed: false, fallbackReason: null as string | null };
    let priceDataFound = false;

    if (comicDetails.title && comicDetails.issueNumber) {
      const isSlabbed = comicDetails.isSlabbed || false;
      const grade = comicDetails.grade ? parseFloat(comicDetails.grade) : 9.4;

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
            ebayLookupMade = true;

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
        const call3Budget = getRemainingBudget(scanStartTime);
        if (call3Budget < 3000) {
          console.warn(`[scan] Skipping price estimation: only ${call3Budget}ms remaining`);
        } else {
          try {
            const { result: priceResult, ...meta } = await executeWithFallback(
              (provider, signal) =>
                provider.estimatePrice(
                  {
                    title: comicDetails.title || "",
                    issueNumber: comicDetails.issueNumber || "",
                    publisher: comicDetails.publisher,
                    releaseYear: comicDetails.releaseYear,
                    grade: comicDetails.grade,
                    gradingCompany: comicDetails.gradingCompany,
                    isSlabbed: comicDetails.isSlabbed,
                    isSignatureSeries: comicDetails.isSignatureSeries || false,
                    signedBy: comicDetails.signedBy || null,
                  },
                  { signal }
                ),
              Math.min(8_000, call3Budget),
              Math.min(6_000, getRemainingBudget(scanStartTime)),
              "priceEstimation",
              aiProviders
            );
            priceMeta = meta;
            aiCallsMade++;

            // Process the sales data according to business rules
            const now = new Date();
            const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

            const processedSales = priceResult.recentSales.map(
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
            if (priceResult.gradeEstimates && Array.isArray(priceResult.gradeEstimates)) {
              gradeEstimates = priceResult.gradeEstimates.map(
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
          } catch {
            comicDetails.priceData = null;
            console.warn("[scan] Price estimation failed on all providers");
          }
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

    // ============================================
    // Save to Metadata Cache (fire-and-forget)
    // ============================================
    const savePayload = buildMetadataSavePayload(
      comicDetails as unknown as Record<string, unknown>
    );
    if (savePayload) {
      const metaSaveKey = generateComicMetadataCacheKey(
        savePayload.title,
        savePayload.issueNumber
      );
      Promise.all([
        saveComicMetadata(savePayload),
        cacheSet(metaSaveKey, savePayload, "comicMetadata"),
      ]).catch((err) => {
        console.error("Metadata cache save failed:", err);
      });
    }

    // ============================================
    // Server-Side Analytics (fire-and-forget)
    // ============================================
    const scanDuration = Date.now() - scanStartTime;
    const costCents = estimateScanCostCents({
      metadataCacheHit,
      aiCallsMade,
      ebayLookup: ebayLookupMade,
      provider: p1 as "anthropic" | "openai",
    });

    if (profileId) {
      trackScanServer(profileId, {
        scanMethod: "camera",
        metadataCacheHit,
        redisCacheHit: false,
        supabaseCacheHit: false,
        aiCallsMade,
        ebayLookup: ebayLookupMade,
        durationMs: scanDuration,
        estimatedCostCents: costCents,
        success: true,
        userId: profileId,
        subscriptionTier,
        provider: p1 as "anthropic" | "openai",
        fallbackUsed: fb1 || verificationMeta.fallbackUsed || priceMeta.fallbackUsed,
        fallbackReason: fr1 || verificationMeta.fallbackReason || priceMeta.fallbackReason,
      }).catch((err) => {
        console.error("PostHog tracking failed:", err);
      });
    }

    // Record to scan_analytics table (fire-and-forget, tracks ALL users including guests)
    recordScanAnalytics({
      profile_id: profileId || null,
      scan_method: "camera",
      estimated_cost_cents: costCents,
      ai_calls_made: aiCallsMade,
      metadata_cache_hit: metadataCacheHit,
      ebay_lookup: ebayLookupMade,
      duration_ms: scanDuration,
      success: true,
      subscription_tier: subscriptionTier || "guest",
      provider: p1,
      fallback_used: fb1 || verificationMeta.fallbackUsed || priceMeta.fallbackUsed,
      fallback_reason: fr1 || verificationMeta.fallbackReason || priceMeta.fallbackReason,
    }).catch((err) => {
      console.error("Scan analytics recording failed:", err);
    });

    const _meta: ScanResponseMeta = {
      provider: p1 as "anthropic" | "openai",
      fallbackUsed: fb1 || verificationMeta.fallbackUsed || priceMeta.fallbackUsed,
      fallbackReason: fr1 || verificationMeta.fallbackReason || priceMeta.fallbackReason,
      confidence: fb1 ? "medium" : ((comicDetails.confidence || "medium") as "high" | "medium" | "low"),
      callDetails: {
        imageAnalysis: { provider: p1, fallbackUsed: fb1 },
        verification: needsAIVerification
          ? { provider: verificationMeta.provider, fallbackUsed: verificationMeta.fallbackUsed }
          : null,
        priceEstimation: !priceDataFound
          ? { provider: priceMeta.provider, fallbackUsed: priceMeta.fallbackUsed }
          : null,
      },
    };

    return NextResponse.json({ ...comicDetails, _meta });
  } catch (error) {
    console.error("Error analyzing comic:", error);

    // Record the failed scan (failed scans still consume AI credits)
    const failDuration = Date.now() - scanStartTime;
    const failProvider = p1 || "anthropic";
    const failCostCents = estimateScanCostCents({
      metadataCacheHit: false,
      aiCallsMade,
      ebayLookup: ebayLookupMade,
      provider: failProvider as "anthropic" | "openai",
    });
    recordScanAnalytics({
      profile_id: profileId || null,
      scan_method: "camera",
      estimated_cost_cents: failCostCents,
      ai_calls_made: aiCallsMade,
      metadata_cache_hit: false,
      ebay_lookup: ebayLookupMade,
      duration_ms: failDuration,
      success: false,
      subscription_tier: subscriptionTier || "guest",
      error_type: (error as Error)?.message?.substring(0, 100) || "unknown",
      provider: failProvider,
      fallback_used: false,
      fallback_reason: null,
    }).catch(() => {});

    // Check for API errors from any provider (status code errors)
    const errorStatus = (error as { status?: number })?.status;
    if (errorStatus && errorStatus >= 400) {
      return NextResponse.json(
        {
          error:
            "Our comic recognition service is temporarily busy. Please wait a moment and try again.",
        },
        { status: errorStatus >= 500 ? errorStatus : 500 }
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
