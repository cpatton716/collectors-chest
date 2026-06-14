import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { isUserSuspended } from "@/lib/adminAuth";
import { parseHCaptchaErrorForUser, verifyCaptchaToken } from "@/lib/hcaptcha";
import { validateBody } from "@/lib/validation";
import { executeWithFallback, executeSlabDetailExtraction, getRemainingBudget, getProviders } from "@/lib/aiProvider";
import { hasCompleteSlabData } from "@/lib/metadataCache";
import { normalizeGradingCompany, parseKeyComments, mergeKeyComments, parseArtComments } from "@/lib/certHelpers";
import type { ScanPath } from "@/lib/analyticsServer";
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
import { getComicMetadata, getProfileByClerkId, saveComicMetadata, lookupBarcodeCatalog } from "@/lib/db";
import { isBrowseApiConfigured, searchActiveListings, convertBrowseToPriceData, type BrowsePriceResult } from "@/lib/ebayBrowse";
import { ComicMetadata, mergeMetadataIntoDetails, buildMetadataSavePayload } from "@/lib/metadataCache";
import { runCoverPipeline } from "@/lib/coverValidation";
import { lookupKeyInfoFromDb } from "@/lib/keyComicsDb";
import {
  GUEST_COOKIE_NAME,
  GUEST_COOKIE_MAX_AGE_SECONDS,
  effectiveGuestAllowance,
  evaluateGuestScan,
  incrementGuestScans,
  issueGuestToken,
  readGuestBonus,
  readGuestScans,
  signGuestCookie,
  verifyGuestCookie,
} from "@/lib/guestScanToken";
import {
  enrichVariantNameFromAI,
  lookupApprovedVariantName,
  resolveVariant,
} from "@/lib/variantResolver";
import { estimateScanCostCents, estimateScanCostBreakdown, trackScanServer, recordScanAnalytics, type ScanCostCall } from "@/lib/analyticsServer";
import { harvestCoverFromScan } from "@/lib/coverHarvest";
import { supabaseAdmin } from "@/lib/supabase";
import { checkRateLimit, getRateLimitIdentifier, rateLimiters } from "@/lib/rateLimit";
import {
  GUEST_SCAN_LIMIT,
  getSubscriptionStatus,
  reserveScanSlot,
  releaseScanSlot,
} from "@/lib/subscription";
import {
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_LABEL,
  base64DecodedByteLength,
} from "@/lib/uploadLimits";

import { PriceData } from "@/types/comic";

const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

const analyzeSchema = z
  .object({
    image: z.string().min(1, "Image data required"),
    mediaType: z.string().min(1).max(100).optional(),
    scanType: z.enum(["auto", "barcode", "cover", "cert"]).optional(),
    guestMode: z.boolean().optional(),
    // Only required for guest scans 4-5 (enforced after parse, not in schema,
    // because registered users never send this field).
    captchaToken: z.string().min(1).max(8000).optional(),
  })
  .passthrough();

// Guests must solve an hCaptcha on scans 4 and 5 (zero-indexed from 0, so the
// stored count of completed scans is >= 3 when this submission would be
// the user's 4th or 5th).
const GUEST_CAPTCHA_THRESHOLD = 3;

// Server-side ceiling on bonus scans a single guest cookie can ever accrue
// (one email capture grants 5; never trust a larger stored/claimed value). M-SC4.
const GUEST_MAX_BONUS_SCANS = 5;

/**
 * Attach the signed guest cookie to a response so the same browser keeps its
 * server-tracked id on subsequent scans. Idempotent to set on every guest
 * response (limit-reached, captcha-required, and success).
 */
function withGuestCookie(response: NextResponse, gid: string | null): NextResponse {
  if (!gid) return response;
  response.cookies.set(GUEST_COOKIE_NAME, signGuestCookie(gid), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GUEST_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}

function normalizeMediaType(raw: string | undefined): SupportedMediaType {
  if (raw && (SUPPORTED_MEDIA_TYPES as readonly string[]).includes(raw)) {
    return raw as SupportedMediaType;
  }
  return "image/jpeg";
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
  variantSource?: "catalog" | "ai" | "derived" | null;
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
  keyInfoSource?: "database" | "cgc" | "ai" | "cache";
  labelType?: string;
  pageQuality?: string;
  gradeDate?: string;
  graderNotes?: string;
  priceData?: (PriceData & { priceSource: "ebay" }) | null;
  barcodeNumber?: string | null; // UPC barcode if visible in image (legacy field)
  barcode?: { raw: string; confidence: "high" | "medium" | "low"; parsed?: ParsedBarcode } | null; // Enhanced barcode detection
  dataSource?: "barcode" | "ai" | "cache"; // Track where primary data came from
  coverImageUrl?: string | null; // Cover image URL (e.g. from the cover pipeline)
  coverSource?: string | null; // Where the cover came from (community, ebay, openlibrary, etc.)
  coverValidated?: boolean; // Whether the cover has been validated
  // Cover harvesting fields (internal - stripped before sending to client)
  coverHarvestable?: boolean;
  coverCropCoordinates?: { x: number; y: number; width: number; height: number };
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
  let scanSlotReserved = false;
  let scanSlotUsedPurchased = false;

  // Guest scan tracking (server source of truth via signed cookie + Redis).
  // gid is set for every guest request (existing or freshly issued); the cookie
  // is (re)attached to the final response via withGuestCookie. H-SC3 / M-SC4.
  let guestId: string | null = null;
  let guestCaptchaRequired = false;
  let guestRemaining = 0;

  // Tracking variables (declared outside try so catch block can access them)
  const scanStartTime = Date.now();
  let scanPath: ScanPath = "full-pipeline";
  let barcodeExtracted = false;
  // Retained for analytics shape stability; with H-SC1 the dedicated slab-
  // detection vision call no longer runs, so this stays undefined.
  let slabDetectionMeta: { provider: string; durationMs: number; cost: number } | undefined;
  let slabDetailExtractionMeta: { provider: string; durationMs: number; cost: number; coverHarvestOnly?: boolean } | undefined;
  let certFirstPath = false;
  let metadataCacheHit = false;
  let aiCallsMade = 0;
  // Provider that served the single low-confidence re-scan, if one ran (L-SC21).
  // Tracked so the cost breakdown can attribute this distinct extra call.
  let lowConfidenceRescanProvider: "anthropic" | "gemini" | null = null;
  let ebayLookupMade = false;
  let p1: string = "gemini"; // Primary provider used - default for catch block (Gemini-primary per VISION_PROVIDER_ORDER)

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

      // Registered user - atomically reserve a scan slot (check + increment in one step)
      const profile = await getProfileByClerkId(userId);
      if (profile) {
        profileId = profile.id;
        subscriptionTier = profile.subscription_tier || "free";

        const reservation = await reserveScanSlot(profile.id, "scan");

        if (!reservation.success) {
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

        scanSlotReserved = true;
        scanSlotUsedPurchased = reservation.usedPurchased ?? false;
      }
    } else {
      // Guest user - enforce limits against the SERVER-stored count (H-SC3).
      // The signed cookie identifies the guest; the client header is now only a
      // display hint and is never trusted for the limit or captcha gate.
      guestId = verifyGuestCookie(request.cookies.get(GUEST_COOKIE_NAME)?.value);
      if (!guestId) {
        // First guest scan (or tampered/cleared cookie) - mint a fresh id.
        guestId = issueGuestToken();
      }

      // Server-trusted completed count + verified bonus allowance (M-SC4).
      const [completed, storedBonus] = await Promise.all([
        readGuestScans(guestId),
        readGuestBonus(guestId),
      ]);
      const allowance = effectiveGuestAllowance(
        GUEST_SCAN_LIMIT,
        storedBonus,
        GUEST_MAX_BONUS_SCANS
      );
      const decision = evaluateGuestScan({
        completed,
        allowance,
        captchaThreshold: GUEST_CAPTCHA_THRESHOLD,
      });
      guestCaptchaRequired = decision.captchaRequired;
      guestRemaining = decision.remaining;

      if (!decision.allowed) {
        return withGuestCookie(
          NextResponse.json(
            {
              error: "guest_limit_reached",
              message: "You've used all your free scans. Create an account to continue.",
              scansUsed: completed,
              limit: allowance,
            },
            { status: 403 }
          ),
          guestId
        );
      }
    }

    const rawBody = await request.json().catch(() => null);
    const validated = validateBody(analyzeSchema, rawBody);
    if (!validated.success) {
      // Release the reserved scan slot - the request is invalid, don't charge the user
      if (profileId && scanSlotReserved) {
        releaseScanSlot(profileId, scanSlotUsedPurchased).catch((err) => {
          console.error("Failed to release scan slot:", err);
        });
        scanSlotReserved = false;
      }
      return validated.response;
    }
    const { image, mediaType } = validated.data;

    // ============================================
    // hCaptcha Verification (Guest Scans 4-5 Only)
    // ============================================
    // Registered users are rate-limited by plan tier and never see CAPTCHA.
    // Guests on scans 1-3 also skip - keeps onboarding friction minimal.
    // On scans 4 and 5, a client-side hCaptcha token is required; we verify
    // with hCaptcha siteverify and fail closed on any verification failure.
    // The "is this a captcha scan?" decision comes from the SERVER-stored count
    // (guestCaptchaRequired), not a client header (H-SC3).
    if (!userId && guestCaptchaRequired) {
      const forwarded = request.headers.get("x-forwarded-for");
      const clientIp = forwarded
        ? forwarded.split(",")[0].trim()
        : request.headers.get("x-real-ip");

      const verification = await verifyCaptchaToken(
        validated.data.captchaToken,
        clientIp
      );
      if (!verification.valid) {
        return withGuestCookie(
          NextResponse.json(
            {
              error: parseHCaptchaErrorForUser(verification.reason),
              captchaRequired: true,
            },
            { status: 403 }
          ),
          guestId
        );
      }
    }

    // Enforce max decoded image size (10MB). Fast-reject the base64 string
    // before decoding if it can't possibly fit - base64 encoding inflates
    // payloads by ~4/3, so a decoded 10MB image is ~13.34MB as base64.
    const base64StringUpperBound = Math.ceil((MAX_IMAGE_UPLOAD_BYTES * 4) / 3) + 64;
    if (
      typeof image !== "string" ||
      image.length > base64StringUpperBound ||
      base64DecodedByteLength(image) > MAX_IMAGE_UPLOAD_BYTES
    ) {
      // Release the reserved scan slot - the user never got a scan
      if (profileId && scanSlotReserved) {
        releaseScanSlot(profileId, scanSlotUsedPurchased).catch((err) => {
          console.error("Failed to release scan slot:", err);
        });
        scanSlotReserved = false;
      }
      return NextResponse.json(
        {
          error: `This image is too large. Please use a smaller image (under ${MAX_IMAGE_UPLOAD_LABEL}) or try taking a new photo.`,
        },
        { status: 413 }
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
      variantSource?: "catalog" | "ai" | "derived" | null;
      writer: string | null;
      coverArtist: string | null;
      interiorArtist: string | null;
      isSlabbed: boolean;
      grade: string | null;
      gradingCompany: string | null;
      certificationNumber: string | null;
      // Cached barcode signal so a cache hit can re-run the free catalog lookup
      // + variant re-resolve without stale names (L-SC25).
      barcode?: ComicDetails["barcode"];
      barcodeNumber?: string | null;
      keyInfo: string[];
    }>(imageHash, "aiAnalyze");

    // If we have a cached result, use it but still get fresh pricing
    let comicDetails: ComicDetails = null!; // Assigned in cache-hit or else branch below
    let usedCache = false;

    const aiProviders = getProviders();

    // Provider tracking variables
    p1 = aiProviders[0]?.name || "gemini";
    let fb1 = false;
    let fr1: string | null = null;
    let cerebro_assisted = false;
    if (cachedAnalysis && cachedAnalysis.title) {
      comicDetails = { ...cachedAnalysis };
      usedCache = true;
      // L-SC25: re-parse the cached barcode so the catalog lookup + variant
      // re-resolve below have the parsed add-on to work with.
      if (comicDetails.barcode?.raw && !comicDetails.barcode.parsed) {
        const parsed = parseBarcode(comicDetails.barcode.raw);
        if (parsed) comicDetails.barcode.parsed = parsed;
      }
    } else {
      // No cache hit - run the AI image analysis.

      // ============================================
      // IMAGE-ANALYSIS-FIRST (H-SC1)
      // The main IMAGE_ANALYSIS_PROMPT already returns isSlabbed + gradingCompany
      // + certificationNumber, so we run it FIRST and only branch into the
      // cert-first sub-pipeline when it flags a slab. This removes the dedicated
      // executeSlabDetection vision call from every raw scan (the majority).
      // ============================================
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
          provider.analyzeImage({ base64Data, mediaType: normalizeMediaType(mediaType) }, { signal }),
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
        coverHarvestable: imageResult.coverHarvestable,
        coverCropCoordinates: imageResult.coverCropCoordinates,
      };

      // Debug: log AI identification results
      console.info(`[scan] AI result: title="${comicDetails.title}" issue="${comicDetails.issueNumber}" variant="${comicDetails.variant}" barcode="${comicDetails.barcodeNumber}" barcode_raw="${comicDetails.barcode?.raw}" isSlabbed=${comicDetails.isSlabbed} confidence="${comicDetails.confidence}" provider="${imageProvider}"`);

      // ============================================
      // CERT-FIRST BRANCH (only when the main analysis flags a slab) — H-SC1.
      // Seeded directly from imageResult's slab fields (no extra vision call).
      // When cert lookup succeeds, comicDetails is rebuilt from authoritative
      // cert + database data and the full creator/verification pipeline is
      // skipped (certFirstPath = true). Raw comics fall straight through.
      // ============================================
      const normalizedCompany = normalizeGradingCompany(comicDetails.gradingCompany);
      if (imageResult.isSlabbed && normalizedCompany && comicDetails.certificationNumber) {
        try {
          // Phase 2: Cert Lookup (free, ~1-2s network call)
          const certResult = await lookupCertification(
            normalizedCompany,
            comicDetails.certificationNumber
          );

          if (certResult.success && certResult.data) {
            certFirstPath = true;
            scanPath = "cert-first-full"; // May upgrade to cert-first-cached below

            // Build comicDetails from cert data (authoritative)
            comicDetails = {
              title: certResult.data.title,
              issueNumber: certResult.data.issueNumber,
              publisher: certResult.data.publisher,
              releaseYear: certResult.data.releaseYear,
              variant: certResult.data.variant,
              writer: null,
              coverArtist: null,
              interiorArtist: null,
              confidence: "high",
              isSlabbed: true,
              gradingCompany: normalizedCompany,
              grade: certResult.data.grade,
              certificationNumber: comicDetails.certificationNumber,
              isSignatureSeries: !!certResult.data.signatures,
              signedBy: certResult.data.signatures || null,
              labelType: certResult.data.labelType || undefined,
              pageQuality: certResult.data.pageQuality || undefined,
              gradeDate: certResult.data.gradeDate || undefined,
              graderNotes: certResult.data.graderNotes || undefined,
              keyInfo: [],
            };

            // Phase 2.5: Parse art comments for creator info
            if (certResult.data.artComments) {
              const artParsed = parseArtComments(certResult.data.artComments);
              if (artParsed.writer) comicDetails.writer = artParsed.writer;
              if (artParsed.coverArtist) comicDetails.coverArtist = artParsed.coverArtist;
              if (artParsed.interiorArtist) comicDetails.interiorArtist = artParsed.interiorArtist;
            }

            // Phase 3: Key Info from cert + database
            const certKeyEntries = parseKeyComments(certResult.data.keyComments);
            if (certKeyEntries.length > 0) {
              comicDetails.keyInfo = certKeyEntries;
              comicDetails.keyInfoSource = "cgc";
            }
            // Merge with database key info (DB-primary, static fallback — M-PR6)
            if (comicDetails.title && comicDetails.issueNumber) {
              const dbKeyInfo = await lookupKeyInfoFromDb(
                comicDetails.title,
                comicDetails.issueNumber,
                comicDetails.releaseYear ? parseInt(String(comicDetails.releaseYear)) : null
              );
              if (dbKeyInfo && dbKeyInfo.length > 0) {
                comicDetails.keyInfo = mergeKeyComments(comicDetails.keyInfo, dbKeyInfo);
                if (!comicDetails.keyInfoSource) {
                  comicDetails.keyInfoSource = "database";
                }
              }
            }

            // Phase 4: Two-layer metadata cache (Redis → Supabase)
            let certMetadataCacheHit = false;
            if (comicDetails.title && comicDetails.issueNumber) {
              try {
                const metaCacheKey = generateComicMetadataCacheKey(
                  comicDetails.title,
                  comicDetails.issueNumber
                );
                // Layer 1: Redis
                let cachedMeta = await cacheGet<ComicMetadata>(metaCacheKey, "comicMetadata");
                // Layer 2: Supabase fallback
                if (!cachedMeta) {
                  const dbMeta = await getComicMetadata(comicDetails.title, comicDetails.issueNumber);
                  if (dbMeta) {
                    cachedMeta = dbMeta as ComicMetadata;
                    cacheSet(metaCacheKey, dbMeta, "comicMetadata").catch(() => {});
                  }
                }
                if (cachedMeta) {
                  certMetadataCacheHit = true;
                  mergeMetadataIntoDetails(
                    comicDetails as unknown as Record<string, unknown>,
                    cachedMeta
                  );
                }
              } catch (cacheErr) {
                console.error("[cert-first] Metadata cache lookup failed:", cacheErr);
              }
            }

            // Phase 5 / 5.5: Cache gate - decide if we need AI detail extraction
            const slabDataComplete = hasCompleteSlabData(comicDetails);
            // Propagate to outer scope for analytics
            metadataCacheHit = certMetadataCacheHit;

            if (slabDataComplete && certMetadataCacheHit) {
              // Phase 5: Cache hit - skip detail extraction entirely
              scanPath = "cert-first-cached";
              console.info("[scan] Cert-first cached path: all data from cert + cache");
            } else {
              // Phase 5.5: Need AI for missing creators/barcode/cover harvest
              const skipCreators = slabDataComplete;
              const skipBarcode = false; // Always try to extract barcode
              const detailBudget = getRemainingBudget(scanStartTime);

              if (detailBudget >= 3000) {
                try {
                  const detailStart = Date.now();
                  const {
                    result: detailResult,
                    provider: detailProvider,
                  } = await executeSlabDetailExtraction(
                    base64Data,
                    normalizeMediaType(mediaType),
                    { skipCreators, skipBarcode, remainingBudgetMs: detailBudget },
                    aiProviders
                  );
                  aiCallsMade++;
                  const detailDuration = Date.now() - detailStart;
                  slabDetailExtractionMeta = {
                    provider: detailProvider,
                    durationMs: detailDuration,
                    cost: detailProvider === "anthropic" ? 0.005 : 0.002,
                    coverHarvestOnly: skipCreators,
                  };

                  // Merge detail extraction results
                  if (!skipCreators) {
                    if (detailResult.writer && !comicDetails.writer) comicDetails.writer = detailResult.writer;
                    if (detailResult.coverArtist && !comicDetails.coverArtist) comicDetails.coverArtist = detailResult.coverArtist;
                    if (detailResult.interiorArtist && !comicDetails.interiorArtist) comicDetails.interiorArtist = detailResult.interiorArtist;
                  }

                  // Barcode
                  if (detailResult.barcode?.raw) {
                    comicDetails.barcode = {
                      raw: detailResult.barcode.raw,
                      confidence: detailResult.barcode.confidence,
                    };
                    comicDetails.barcodeNumber = detailResult.barcode.raw;
                    barcodeExtracted = true;
                  }

                  // Cover harvest data
                  if (detailResult.coverHarvestable) {
                    comicDetails.coverHarvestable = true;
                    comicDetails.coverCropCoordinates = detailResult.coverCropCoordinates || undefined;
                  }

                  console.info(
                    `[scan] Slab detail extraction: barcode=${detailResult.barcode?.raw} coverHarvestable=${detailResult.coverHarvestable} provider=${detailProvider} duration=${detailDuration}ms`
                  );
                } catch (detailErr) {
                  console.warn("[scan] Slab detail extraction failed:", detailErr);
                  // Continue with what we have from cert lookup
                }
              } else {
                console.warn(`[scan] Skipping slab detail extraction: only ${detailBudget}ms remaining`);
              }
            }

            // Parse barcode into components if detected
            if (comicDetails.barcode && comicDetails.barcode.raw) {
              const parsed = parseBarcode(comicDetails.barcode.raw);
              if (parsed) {
                comicDetails.barcode.parsed = parsed;
              }
            }
            // Backward compat: populate barcodeNumber from barcode.raw
            if (comicDetails.barcode?.raw && !comicDetails.barcodeNumber) {
              comicDetails.barcodeNumber = comicDetails.barcode.raw;
            }

            comicDetails.dataSource = "barcode"; // cert-first uses structured data, not AI vision
          } else {
            // Cert lookup failed - keep the imageAnalysis result, run full pipeline
            console.info(`[scan] Cert lookup failed for ${normalizedCompany} #${comicDetails.certificationNumber}, falling back to full pipeline`);
            scanPath = "cert-first-fallback";
          }
        } catch (certErr) {
          console.warn("[scan] Cert-first branch failed, falling back to full pipeline:", certErr);
          // Continue with the imageAnalysis result through the full pipeline
        }
      }

      if (!certFirstPath) {

      // Low-confidence fallback (L-SC21): if primary returned low confidence,
      // re-scan with the other provider. Gated to SIGNED-IN users only (guests
      // never trigger this extra paid vision call), and capped to exactly ONE
      // extra call. The extra call is tagged as a distinct cost type below.
      const fallbackProvider = aiProviders.find((p) => p.name !== imageProvider);
      if (Boolean(userId) && imageResult.confidence === "low" && fallbackProvider) {
        const fallbackBudget = getRemainingBudget(scanStartTime);
        if (fallbackBudget >= 5000) {
          try {
            const fallbackTimeout = Math.min(10_000, fallbackBudget);
            const fallbackSignal = AbortSignal.timeout(fallbackTimeout);
            const fallbackResult = await fallbackProvider.analyzeImage(
              { base64Data, mediaType: normalizeMediaType(mediaType) },
              { signal: fallbackSignal }
            );
            aiCallsMade++;
            lowConfidenceRescanProvider = fallbackProvider.name as "anthropic" | "gemini";

            // Prefer fallback's result over the low-confidence primary result
            if (fallbackResult.confidence !== "low") {
              comicDetails = {
                title: fallbackResult.title,
                issueNumber: fallbackResult.issueNumber,
                publisher: fallbackResult.publisher,
                releaseYear: fallbackResult.releaseYear,
                variant: fallbackResult.variant,
                writer: fallbackResult.writer,
                coverArtist: fallbackResult.coverArtist,
                interiorArtist: fallbackResult.interiorArtist,
                confidence: fallbackResult.confidence || "medium",
                isSlabbed: fallbackResult.isSlabbed || false,
                gradingCompany: fallbackResult.gradingCompany || null,
                grade: fallbackResult.grade || null,
                certificationNumber: fallbackResult.certificationNumber || null,
                isSignatureSeries: fallbackResult.isSignatureSeries || false,
                signedBy: fallbackResult.signedBy || null,
                labelType: fallbackResult.labelType || undefined,
                pageQuality: fallbackResult.pageQuality || undefined,
                gradeDate: fallbackResult.gradeDate || undefined,
                graderNotes: fallbackResult.graderNotes || undefined,
                keyInfo: [],
                barcode: fallbackResult.barcode || null,
                barcodeNumber: fallbackResult.barcodeNumber || null,
                coverHarvestable: fallbackResult.coverHarvestable,
                coverCropCoordinates: fallbackResult.coverCropCoordinates,
              };
              p1 = fallbackProvider.name;
              cerebro_assisted = true;
              console.info(`[scan] Low-confidence fallback: ${fallbackProvider.name} provided better result`);
            }
          } catch (fallbackErr) {
            console.warn("[scan] Low-confidence fallback failed:", fallbackErr);
            // Continue with original low-confidence result
          }
        }
      }

      // Parse the barcode into components if detected
      if (comicDetails.barcode && comicDetails.barcode.raw) {
        const parsed = parseBarcode(comicDetails.barcode.raw);
        if (parsed) {
          comicDetails.barcode.parsed = parsed;

          console.info(`[scan] Barcode parsed: raw="${comicDetails.barcode.raw}" addonIssue="${parsed.addonIssue}" addonVariant="${parsed.addonVariant}" digits=${comicDetails.barcode.raw.length}`);
        }
      }

      // Resolve the variant name via the 3-tier resolver (catalog -> AI -> derived).
      // Runs whenever a parsed barcode is present, even if AI returned a variant --
      // the catalog may already have a canonical community-approved name that beats
      // AI's cover-derived guess, and rich AI hints are preserved inside the resolver.
      if (comicDetails.barcode?.parsed?.addonVariant && comicDetails.title && comicDetails.issueNumber) {
        const resolved = await resolveVariant(
          {
            title: comicDetails.title,
            issueNumber: comicDetails.issueNumber,
            releaseYear: comicDetails.releaseYear,
            publisher: comicDetails.publisher,
            parsedBarcode: comicDetails.barcode.parsed,
            aiVariantHint: comicDetails.variant,
          },
          {
            catalogLookup: lookupApprovedVariantName,
            enricher: enrichVariantNameFromAI,
          }
        );
        if (resolved.variantName !== comicDetails.variant || resolved.source) {
          console.info(
            `[scan] Variant resolved: "${resolved.variantName}" (source=${resolved.source}, addon=${comicDetails.barcode.parsed.addonVariant})`
          );
        }
        comicDetails.variant = resolved.variantName;
        comicDetails.variantSource = resolved.source;
      } else if (comicDetails.variant) {
        // No barcode signal but AI returned something -- mark it accordingly
        comicDetails.variantSource = "ai";
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
          variantSource: comicDetails.variantSource,
          writer: comicDetails.writer,
          coverArtist: comicDetails.coverArtist,
          interiorArtist: comicDetails.interiorArtist,
          isSlabbed: comicDetails.isSlabbed,
          grade: comicDetails.grade,
          gradingCompany: comicDetails.gradingCompany,
          certificationNumber: comicDetails.certificationNumber,
          // Persist the barcode signal so a cache hit can re-run catalog + variant
          // resolution (L-SC25). Cheap to store; never overrides on read.
          barcode: comicDetails.barcode,
          barcodeNumber: comicDetails.barcodeNumber,
          keyInfo: [], // Don't cache keyInfo - we get it fresh from DB or AI
        };
        // Fire and forget - don't block the response
        cacheSet(imageHash, cacheData, "aiAnalyze").catch(() => {});
      }
      } // End of if (!certFirstPath)
    } // End of else block (no cache hit)

    // Ensure keyInfo is initialized
    if (!comicDetails.keyInfo) {
      comicDetails.keyInfo = [];
    }

    // ============================================
    // BARCODE LOOKUP
    // Priority: 1) Our barcode_catalog (crowd-sourced, verified)
    //           2) Redis cache
    //           3) Comic Vine API (external, unreliable UPC mappings)
    // IMPORTANT: Only use barcode data to FILL IN missing fields when
    // the AI already identified the book with confidence. External sources
    // (Comic Vine) have known bad UPC mappings and must never override.
    // Our own barcode_catalog IS trusted for overrides (user-verified data).
    // ============================================
    const aiAlreadyIdentified = comicDetails.title && comicDetails.issueNumber &&
      comicDetails.confidence !== "low";
    // L-SC25: run the FREE barcode_catalog lookup on cache hits too, so a cached
    // scan still picks up community-approved catalog updates and we can re-resolve
    // the variant below (no stale variant names from a 30-day-old cache entry).
    if (comicDetails.barcodeNumber) {
      try {
        // Clean the barcode (remove any spaces/dashes)
        const cleanBarcode = comicDetails.barcodeNumber.replace(/[\s-]/g, "");

        // Only proceed if it looks like a valid UPC (8-13 digits)
        if (/^\d{8,13}$/.test(cleanBarcode)) {
          // Priority 1: Check our own barcode_catalog (crowd-sourced, verified)
          const catalogResult = await lookupBarcodeCatalog(cleanBarcode);
          if (catalogResult && catalogResult.title) {
            // Our catalog is trusted - use it to fill in or override
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
              title: catalogResult.title || comicDetails.title,
              issueNumber: catalogResult.issueNumber || comicDetails.issueNumber,
              publisher: catalogResult.publisher || comicDetails.publisher,
              releaseYear: catalogResult.releaseYear || comicDetails.releaseYear,
              variant: catalogResult.variant || comicDetails.variant,
              writer: catalogResult.writer || comicDetails.writer,
              coverArtist: catalogResult.coverArtist || comicDetails.coverArtist,
              interiorArtist: catalogResult.interiorArtist || comicDetails.interiorArtist,
              ...gradingInfo,
              dataSource: "barcode",
              keyInfo: [],
            };
          }

          // Priority 2: Check Redis barcode cache (may contain Comic Vine data)
          // Skip if our catalog already provided data
          // Comic Vine barcode lookups REMOVED - unreliable UPC data
          // (see docs/BARCODE_SCANNER_SPEC.md for history)
          // Our barcode_catalog (crowd-sourced from verified scans) is the only trusted source
        }
      } catch (barcodeError) {
        console.error("[analyze] Barcode lookup error:", barcodeError);
        // Continue with AI-detected data - barcode lookup is optional optimization
      }
    }

    // L-SC25: re-resolve the variant on CACHE HITS. Fresh scans already did this
    // in the image-analysis branch; a cached entry may carry a stale variant name
    // that the community catalog has since corrected/approved, so we re-run the
    // resolver here using the cached barcode add-on signal.
    if (
      usedCache &&
      comicDetails.barcode?.parsed?.addonVariant &&
      comicDetails.title &&
      comicDetails.issueNumber
    ) {
      try {
        const resolved = await resolveVariant(
          {
            title: comicDetails.title,
            issueNumber: comicDetails.issueNumber,
            releaseYear: comicDetails.releaseYear,
            publisher: comicDetails.publisher,
            parsedBarcode: comicDetails.barcode.parsed,
            aiVariantHint: comicDetails.variant,
          },
          {
            catalogLookup: lookupApprovedVariantName,
            enricher: enrichVariantNameFromAI,
          }
        );
        comicDetails.variant = resolved.variantName;
        comicDetails.variantSource = resolved.source;
      } catch (variantErr) {
        console.warn("[scan] Cache-hit variant re-resolve failed:", variantErr);
      }
    }

    // Track data source if not already set
    if (!comicDetails.dataSource) {
      comicDetails.dataSource = usedCache ? "cache" : "ai";
    }

    // If this is a slabbed comic with a certification number, look up from grading company
    // Skip on cert-first path - already done during the cert-first branch
    if (!certFirstPath && comicDetails.isSlabbed && comicDetails.certificationNumber && comicDetails.gradingCompany) {
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
            comicDetails.keyInfoSource = "cgc";
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

    // First, check our key comics database. M-PR6: DB-primary (community-approved
    // entries) with the static curated list as fallback — fast, FREE.
    let databaseKeyInfo: string[] | null = null;
    if (comicDetails.title && comicDetails.issueNumber) {
      databaseKeyInfo = await lookupKeyInfoFromDb(comicDetails.title, comicDetails.issueNumber, comicDetails.releaseYear ? parseInt(String(comicDetails.releaseYear)) : null);
      if (databaseKeyInfo && databaseKeyInfo.length > 0) {
        comicDetails.keyInfo = databaseKeyInfo;
        comicDetails.keyInfoSource = "database";
      }
    }

    // ============================================
    // Metadata Cache Lookup (dual-layer: Redis → Supabase)
    // Skip if cert-first path already did its own cache lookup
    // ============================================
    if (!certFirstPath && comicDetails.title && comicDetails.issueNumber) {
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
    // Skip on cert-first path - creators were handled by extractSlabDetails
    const needsKeyInfoFromAI = !comicDetails.keyInfo || comicDetails.keyInfo.length === 0;
    const needsAIVerification =
      !certFirstPath &&
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
          if (!comicDetails.variant) missingFields.push("variant");

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

          // Merge verification results - only fill missing fields
          if (!comicDetails.writer && verifyResult.writer) comicDetails.writer = verifyResult.writer;
          if (!comicDetails.coverArtist && verifyResult.coverArtist) comicDetails.coverArtist = verifyResult.coverArtist;
          if (!comicDetails.interiorArtist && verifyResult.interiorArtist) comicDetails.interiorArtist = verifyResult.interiorArtist;
          if (!comicDetails.publisher && verifyResult.publisher) comicDetails.publisher = verifyResult.publisher;
          if (!comicDetails.releaseYear && verifyResult.releaseYear) comicDetails.releaseYear = verifyResult.releaseYear;
          if (!comicDetails.variant && verifyResult.variant) comicDetails.variant = verifyResult.variant;
          // Only use AI keyInfo if we didn't get it from database
          if (needsKeyInfoFromAI && verifyResult.keyInfo?.length) {
            comicDetails.keyInfo = verifyResult.keyInfo;
            comicDetails.keyInfoSource = "ai";
          }
        } catch {
          // Continue with partial data - image analysis result is still valid
          console.warn("[scan] Verification failed on all providers, continuing with partial data");
        }
      }
    }

    // Price/Value lookup - Try eBay Browse API for active listings
    let priceDataFound = false;
    let ebayPriceData: BrowsePriceResult | null = null;

    if (comicDetails.title && comicDetails.issueNumber) {
      const isSlabbed = comicDetails.isSlabbed || false;
      const grade = comicDetails.grade ? parseFloat(comicDetails.grade) : 9.4;

      // 1. Try eBay Browse API (active listings) - with Redis caching only
      // Phase 3: Simplified to use Redis only (removed Supabase cache layer)
      if (isBrowseApiConfigured()) {
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
          if (cachedResult !== null && !("noData" in cachedResult) && (cachedResult as PriceData).priceSource === "ebay") {
              comicDetails.priceData = {
                ...cachedResult,
                priceSource: "ebay",
              };
              priceDataFound = true;
          } else if (cachedResult === null || (cachedResult !== null && !("noData" in cachedResult) && (cachedResult as PriceData).priceSource !== "ebay")) {
            // Cache miss or stale AI price - fetch from eBay Browse API
            ebayPriceData = await searchActiveListings(
              comicDetails.title,
              comicDetails.issueNumber,
              String(grade),
              isSlabbed,
              comicDetails.gradingCompany || undefined,
              comicDetails.releaseYear || undefined
            );
            ebayLookupMade = true;

            if (ebayPriceData) {
              const priceData = convertBrowseToPriceData(ebayPriceData, String(grade));
              if (priceData && priceData.estimatedValue) {
                comicDetails.priceData = {
                  ...priceData,
                  priceSource: "ebay",
                };
                priceDataFound = true;
                // Cache in Redis with 12-hour TTL (fire and forget)
                cacheSet(cacheKey, priceData, "ebayPrice", 12 * 60 * 60).catch(() => {});
              } else {
                // Cache "no results" marker with short TTL (1 hour) so we retry sooner
                cacheSet(cacheKey, { noData: true }, "ebayPrice", 60 * 60).catch(() => {});
              }
            } else {
              // Cache "no results" marker with short TTL (1 hour) so we retry sooner
              cacheSet(cacheKey, { noData: true }, "ebayPrice", 60 * 60).catch(() => {});
            }
          }
          // If noData marker in cache, priceDataFound stays false - no pricing data shown
        } catch (ebayError) {
          console.error("[analyze] eBay lookup failed:", ebayError);
        }
      }

      // 2. No eBay data = no pricing data shown
      // If eBay Browse API has no active listings, we show nothing.
      if (!priceDataFound) {
        comicDetails.priceData = null;
      }
    } else {
      comicDetails.priceData = null;
    }

    // Scan count was already incremented atomically via reserveScanSlot() at the start

    // ============================================
    // Cover Image Pipeline
    // Runs the cover pipeline with eBay listing images and Open Library
    // ============================================
    if (!comicDetails.coverImageUrl && comicDetails.title && comicDetails.issueNumber) {
      try {
        const pipelineResult = await runCoverPipeline(
          comicDetails.title,
          comicDetails.issueNumber,
          comicDetails.releaseYear || null,
          comicDetails.publisher || null,
          { ebayListings: ebayPriceData?.listings }
        );
        if (pipelineResult.coverUrl) {
          comicDetails.coverImageUrl = pipelineResult.coverUrl;
          comicDetails.coverSource = pipelineResult.coverSource;
        }
        comicDetails.coverValidated = pipelineResult.validated;
      } catch (coverErr) {
        console.error("[analyze] Cover pipeline failed:", coverErr);
      }
    }

    // ============================================
    // Save to Metadata Cache (awaited to ensure persistence)
    // ============================================
    // Skip the DB + Redis write entirely when the metadata came from cache —
    // re-persisting an unchanged cache hit is a redundant round-trip.
    const savePayload = metadataCacheHit
      ? null
      : buildMetadataSavePayload(
          comicDetails as unknown as Record<string, unknown>
        );
    if (savePayload) {
      const metaSaveKey = generateComicMetadataCacheKey(
        savePayload.title,
        savePayload.issueNumber
      );
      try {
        await Promise.all([
          saveComicMetadata(savePayload),
          cacheSet(metaSaveKey, savePayload, "comicMetadata"),
        ]);
      } catch (err) {
        console.error("Metadata cache save failed:", err);
      }
    }

    // ============================================
    // Server-Side Analytics (fire-and-forget)
    // ============================================
    const scanDuration = Date.now() - scanStartTime;

    // Track the provider used per call and pick the dominant one for the summary.
    // A scan can mix providers (e.g. Gemini image analysis + Anthropic fallback
    // on verification), so the headline provider should reflect the majority,
    // not just the first call.
    const callProviders = [
      certFirstPath ? null : p1,
      slabDetectionMeta?.provider,
      slabDetailExtractionMeta?.provider,
      needsAIVerification ? verificationMeta.provider : null,
    ].filter((p): p is string => Boolean(p));
    const providerCounts = callProviders.reduce<Record<string, number>>((acc, p) => {
      acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {});
    const dominantProvider =
      (Object.entries(providerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as
        | "anthropic"
        | "gemini"
        | undefined) || (p1 as "anthropic" | "gemini");

    // Per-call-type cost breakdown (M-SC12): attribute each AI call to the
    // provider that served it instead of charging every call at one flat rate.
    const costBreakdown: ScanCostCall[] = [];
    if (!certFirstPath) {
      costBreakdown.push({ type: "imageAnalysis", provider: p1 as "anthropic" | "gemini" });
    }
    // L-SC21: attribute the one-and-only low-confidence re-scan as a distinct
    // (extra) imageAnalysis call so its cost is visible and not undercounted.
    if (lowConfidenceRescanProvider) {
      costBreakdown.push({ type: "imageAnalysis", provider: lowConfidenceRescanProvider });
    }
    if (slabDetectionMeta) {
      costBreakdown.push({ type: "imageAnalysis", provider: slabDetectionMeta.provider as "anthropic" | "gemini" });
    }
    if (slabDetailExtractionMeta) {
      costBreakdown.push({ type: "imageAnalysis", provider: slabDetailExtractionMeta.provider as "anthropic" | "gemini" });
    }
    if (needsAIVerification) {
      costBreakdown.push({ type: "verification", provider: verificationMeta.provider as "anthropic" | "gemini" });
    }
    if (ebayLookupMade) {
      costBreakdown.push({ type: "ebay", provider: dominantProvider });
    }
    const costCents =
      costBreakdown.length > 0
        ? estimateScanCostBreakdown(costBreakdown)
        : estimateScanCostCents({
            metadataCacheHit,
            aiCallsMade,
            ebayLookup: ebayLookupMade,
            provider: dominantProvider,
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
        provider: dominantProvider,
        fallbackUsed: fb1 || verificationMeta.fallbackUsed,
        fallbackReason: fr1 || verificationMeta.fallbackReason,
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
      provider: dominantProvider,
      fallback_used: fb1 || verificationMeta.fallbackUsed,
      fallback_reason: fr1 || verificationMeta.fallbackReason,
      scan_path: scanPath,
      barcode_extracted: barcodeExtracted,
    }).catch((err) => {
      console.error("Scan analytics recording failed:", err);
    });

    const _meta: ScanResponseMeta = {
      provider: p1 as "anthropic" | "gemini",
      fallbackUsed: fb1 || verificationMeta.fallbackUsed,
      fallbackReason: fr1 || verificationMeta.fallbackReason,
      confidence: fb1 ? "medium" : ((comicDetails.confidence || "medium") as "high" | "medium" | "low"),
      ...(cerebro_assisted ? { cerebro_assisted: true } : {}),
      callDetails: {
        imageAnalysis: certFirstPath ? null : { provider: p1, fallbackUsed: fb1 },
        verification: needsAIVerification
          ? { provider: verificationMeta.provider, fallbackUsed: verificationMeta.fallbackUsed }
          : null,
        ...(slabDetectionMeta ? { slabDetection: slabDetectionMeta } : {}),
        ...(slabDetailExtractionMeta ? { slabDetailExtraction: slabDetailExtractionMeta } : {}),
      },
    };

    // Cover image harvesting from graded book scans
    // Runs pre-response with 2s timeout - see spec for rationale
    if (comicDetails.isSlabbed && comicDetails.coverHarvestable) {
      const harvestPromise = harvestCoverFromScan({
        base64Image: base64Data,
        title: comicDetails.title || "",
        issueNumber: comicDetails.issueNumber || "",
        variant: comicDetails.variant || null,
        coverCropCoordinates: comicDetails.coverCropCoordinates!,
        profileId: profileId || null,
        isSlabbed: comicDetails.isSlabbed,
        coverHarvestable: comicDetails.coverHarvestable,
      }).catch((err) => {
        console.error("[harvest] failed:", err.message);
        return false;
      });

      const timeoutPromise = new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), 2000)
      );

      const harvested = await Promise.race([harvestPromise, timeoutPromise]);

      if (harvested) {
        void supabaseAdmin
          .from("scan_analytics")
          .update({ cover_harvested: true })
          .eq("profile_id", profileId)
          .order("created_at", { ascending: false })
          .limit(1);
      }
    }

    // Remove internal harvest fields from client response
    delete comicDetails.coverHarvestable;
    delete comicDetails.coverCropCoordinates;

    // Guest scan accounting: this scan succeeded, so record it server-side and
    // surface the authoritative remaining/limit on the response (H-SC3 / M-SC4).
    // The client should render these instead of its local optimistic count.
    let guestMeta: { guestRemaining: number; guestLimit: number } | undefined;
    if (!userId && guestId) {
      const newCount = await incrementGuestScans(guestId);
      const remaining = Math.max(0, guestRemaining - 1);
      guestMeta = { guestRemaining: remaining, guestLimit: newCount + remaining };
    }

    const response = NextResponse.json({
      ...comicDetails,
      cerebro_assisted,
      _meta,
      ...(guestMeta ?? {}),
    });
    return withGuestCookie(response, userId ? null : guestId);
  } catch (error) {
    console.error("Error analyzing comic:", error);

    // Rollback: release the reserved scan slot so the user isn't charged for a failed scan
    if (profileId && scanSlotReserved) {
      releaseScanSlot(profileId, scanSlotUsedPurchased).catch((err) => {
        console.error("Failed to release scan slot:", err);
      });
    }

    // Record the failed scan (failed scans still consume AI credits)
    const failDuration = Date.now() - scanStartTime;
    const failProvider = p1 || "gemini";
    const failCostCents = estimateScanCostCents({
      metadataCacheHit: false,
      aiCallsMade,
      ebayLookup: ebayLookupMade,
      provider: failProvider as "anthropic" | "gemini",
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
