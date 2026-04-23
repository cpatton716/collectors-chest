import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { isUserSuspended } from "@/lib/adminAuth";
import { executeWithFallback, executeSlabDetection, executeSlabDetailExtraction, getRemainingBudget, getProviders } from "@/lib/aiProvider";
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
import { lookupKeyInfo } from "@/lib/keyComicsDatabase";
import { verifyWithMetron, MetronVerifyResult } from "@/lib/metronVerify";
import { estimateScanCostCents, trackScanServer, recordScanAnalytics } from "@/lib/analyticsServer";
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
  keyInfoSource?: "database" | "cgc" | "ai" | "cache";
  labelType?: string;
  pageQuality?: string;
  gradeDate?: string;
  graderNotes?: string;
  priceData?: (PriceData & { priceSource: "ebay" }) | null;
  barcodeNumber?: string | null; // UPC barcode if visible in image (legacy field)
  barcode?: { raw: string; confidence: "high" | "medium" | "low"; parsed?: ParsedBarcode } | null; // Enhanced barcode detection
  dataSource?: "barcode" | "ai" | "cache"; // Track where primary data came from
  coverImageUrl?: string | null; // Cover image URL (e.g. from Metron or pipeline)
  coverSource?: string | null; // Where the cover came from (metron, community, ebay, etc.)
  coverValidated?: boolean; // Whether the cover has been validated
  metronId?: string | null; // Metron database ID for cross-reference
  // Cover harvesting fields (internal — stripped before sending to client)
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

  // Tracking variables (declared outside try so catch block can access them)
  const scanStartTime = Date.now();
  const CERT_FIRST_BUDGET_MS = 15_000;
  let scanPath: ScanPath = "full-pipeline";
  let barcodeExtracted = false;
  let slabDetectionMeta: { provider: string; durationMs: number; cost: number } | undefined;
  let slabDetailExtractionMeta: { provider: string; durationMs: number; cost: number; coverHarvestOnly?: boolean } | undefined;
  let certFirstPath = false;
  let metadataCacheHit = false;
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
      // Release the reserved scan slot — the request is invalid, don't charge the user
      if (profileId && scanSlotReserved) {
        releaseScanSlot(profileId, scanSlotUsedPurchased).catch((err) => {
          console.error("Failed to release scan slot:", err);
        });
        scanSlotReserved = false;
      }
      return NextResponse.json(
        { error: "No image was received. Please try uploading your photo again." },
        { status: 400 }
      );
    }

    // Enforce max decoded image size (10MB). Fast-reject the base64 string
    // before decoding if it can't possibly fit — base64 encoding inflates
    // payloads by ~4/3, so a decoded 10MB image is ~13.34MB as base64.
    const base64StringUpperBound = Math.ceil((MAX_IMAGE_UPLOAD_BYTES * 4) / 3) + 64;
    if (
      typeof image !== "string" ||
      image.length > base64StringUpperBound ||
      base64DecodedByteLength(image) > MAX_IMAGE_UPLOAD_BYTES
    ) {
      // Release the reserved scan slot — the user never got a scan
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
    let comicDetails: ComicDetails = null!; // Assigned in cache-hit or else branch below
    let usedCache = false;

    const aiProviders = getProviders();

    // Provider tracking variables
    p1 = aiProviders[0]?.name || "anthropic";
    let fb1 = false;
    let fr1: string | null = null;
    let cerebro_assisted = false;
    if (cachedAnalysis && cachedAnalysis.title) {
      comicDetails = { ...cachedAnalysis };
      usedCache = true;
    } else {
      // No cache hit - run the AI image analysis

      // ============================================
      // CERT-FIRST BRANCH: Slab Detection → Cert Lookup → Cache Gate
      // If the image is a slabbed comic, we can skip the expensive full AI
      // pipeline and get structured data from the grading company's database.
      // ============================================
      // Phase 1: Slab Detection (lightweight ~2-3s AI call)
      const slabDetStart = Date.now();
      const slabBudget = Math.min(5_000, CERT_FIRST_BUDGET_MS);
      try {
        const {
          result: slabResult,
          provider: slabProvider,
          fallbackUsed: slabFallbackUsed,
        } = await executeSlabDetection(
          base64Data,
          mediaType || "image/jpeg",
          slabBudget,
          aiProviders
        );
        aiCallsMade++;
        const slabDetDuration = Date.now() - slabDetStart;
        slabDetectionMeta = {
          provider: slabProvider,
          durationMs: slabDetDuration,
          cost: slabProvider === "anthropic" ? 0.003 : 0.001,
        };
        p1 = slabProvider;
        if (slabFallbackUsed) {
          fb1 = true;
        }

        console.info(
          `[scan] Slab detection: isSlabbed=${slabResult.isSlabbed} company=${slabResult.gradingCompany} cert=${slabResult.certificationNumber} provider=${slabProvider} duration=${slabDetDuration}ms`
        );

        // Phase 1.5: Normalize grading company
        const normalizedCompany = normalizeGradingCompany(slabResult.gradingCompany);

        if (slabResult.isSlabbed && normalizedCompany && slabResult.certificationNumber) {
          // Phase 2: Cert Lookup (free, ~1-2s network call)
          const certResult = await lookupCertification(
            normalizedCompany,
            slabResult.certificationNumber
          );

          if (certResult.success && certResult.data) {
            certFirstPath = true;
            scanPath = "cert-first-full"; // May upgrade to cert-first-cached below

            // Build comicDetails from cert data
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
              certificationNumber: slabResult.certificationNumber,
              isSignatureSeries: !!certResult.data.signatures,
              signedBy: certResult.data.signatures || null,
              labelType: certResult.data.labelType || undefined,
              pageQuality: certResult.data.pageQuality || undefined,
              gradeDate: certResult.data.gradeDate || undefined,
              graderNotes: certResult.data.graderNotes || undefined,
              keyInfo: [],
            };

            // Phase 2.1: Label color → notes mapping
            const labelColor = slabResult.labelColor;
            if (labelColor) {
              if (labelColor === "purple") {
                (comicDetails as unknown as Record<string, unknown>).notes = "Restored (Purple Label)";
              } else if (labelColor === "green") {
                (comicDetails as unknown as Record<string, unknown>).notes = "Qualified (Green Label)";
              } else if (labelColor === "red") {
                (comicDetails as unknown as Record<string, unknown>).notes = "Conserved (Red Label)";
              }
              // Blue label and yellow non-CGC: no notes added
            }

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
            // Merge with database key info
            if (comicDetails.title && comicDetails.issueNumber) {
              const dbKeyInfo = lookupKeyInfo(
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

            // Phase 5 / 5.5: Cache gate — decide if we need AI detail extraction
            const slabDataComplete = hasCompleteSlabData(comicDetails);
            // Propagate to outer scope for analytics
            metadataCacheHit = certMetadataCacheHit;

            if (slabDataComplete && certMetadataCacheHit) {
              // Phase 5: Cache hit — skip detail extraction entirely
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
                    mediaType || "image/jpeg",
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
            // Cert lookup failed — fall through to full pipeline
            console.info(`[scan] Cert lookup failed for ${normalizedCompany} #${slabResult.certificationNumber}, falling back to full pipeline`);
            scanPath = "cert-first-fallback";
          }
        }
      } catch (slabDetErr) {
        console.warn("[scan] Slab detection failed, falling back to full pipeline:", slabDetErr);
        // Continue to full pipeline
      }

      if (!certFirstPath) {
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
        coverHarvestable: imageResult.coverHarvestable,
        coverCropCoordinates: imageResult.coverCropCoordinates,
      };

      // Debug: log AI identification results
      console.info(`[scan] AI result: title="${comicDetails.title}" issue="${comicDetails.issueNumber}" variant="${comicDetails.variant}" barcode="${comicDetails.barcodeNumber}" barcode_raw="${comicDetails.barcode?.raw}" confidence="${comicDetails.confidence}" provider="${imageProvider}"`);

      // Low-confidence fallback: if primary returned low confidence, re-scan with the other provider
      const fallbackProvider = aiProviders.find((p) => p.name !== imageProvider);
      if (imageResult.confidence === "low" && fallbackProvider) {
        const fallbackBudget = getRemainingBudget(scanStartTime);
        if (fallbackBudget >= 5000) {
          try {
            const fallbackTimeout = Math.min(10_000, fallbackBudget);
            const fallbackSignal = AbortSignal.timeout(fallbackTimeout);
            const fallbackResult = await fallbackProvider.analyzeImage(
              { base64Data, mediaType: mediaType || "image/jpeg" },
              { signal: fallbackSignal }
            );
            aiCallsMade++;

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

          // Map barcode variant code to variant field if AI didn't detect one
          // UPC add-on digits 16-17 encode cover variant + printing info
          // Common schemes vary by publisher:
          //   Scheme A: 01=Cover A, 02=Cover B, 03=Cover C...
          //   Scheme B: 11=Cover A 1st print, 12=Cover A 2nd print, 21=Cover B 1st print...
          // We use the FIRST digit as the cover letter (1=A, 2=B, 3=C...)
          // and only flag as variant if cover > A (first digit > 1)
          if (parsed.addonVariant && !comicDetails.variant) {
            const firstDigit = parseInt(parsed.addonVariant[0], 10);
            if (firstDigit > 1 && firstDigit <= 9) {
              const variantLetters = ["", "A", "B", "C", "D", "E", "F", "G", "H", "I"];
              comicDetails.variant = `Cover ${variantLetters[firstDigit]}`;
            }
          }
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
    if (comicDetails.barcodeNumber && !usedCache) {
      try {
        // Clean the barcode (remove any spaces/dashes)
        const cleanBarcode = comicDetails.barcodeNumber.replace(/[\s-]/g, "");

        // Only proceed if it looks like a valid UPC (8-13 digits)
        if (/^\d{8,13}$/.test(cleanBarcode)) {
          // Priority 1: Check our own barcode_catalog (crowd-sourced, verified)
          const catalogResult = await lookupBarcodeCatalog(cleanBarcode);
          if (catalogResult && catalogResult.title) {
            // Our catalog is trusted — use it to fill in or override
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
          // Comic Vine barcode lookups REMOVED — unreliable UPC data
          // (see docs/BARCODE_SCANNER_SPEC.md for history)
          // Our barcode_catalog (crowd-sourced from verified scans) is the only trusted source
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
    // Skip on cert-first path — already done during the cert-first branch
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

    // First, check our curated key comics database (fast, guaranteed accurate, FREE)
    let databaseKeyInfo: string[] | null = null;
    if (comicDetails.title && comicDetails.issueNumber) {
      databaseKeyInfo = lookupKeyInfo(comicDetails.title, comicDetails.issueNumber, comicDetails.releaseYear ? parseInt(String(comicDetails.releaseYear)) : null);
      if (databaseKeyInfo && databaseKeyInfo.length > 0) {
        comicDetails.keyInfo = databaseKeyInfo;
        comicDetails.keyInfoSource = "database";
      }
    }

    // ============================================
    // Metron Verification (non-blocking, fire-and-settle alongside cache lookup)
    // ============================================
    let metronPromise: Promise<PromiseSettledResult<MetronVerifyResult>> | null = null;
    if (comicDetails.title && comicDetails.issueNumber) {
      metronPromise = Promise.allSettled([
        verifyWithMetron(comicDetails.title, comicDetails.issueNumber),
      ]).then((results) => results[0]);
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
    // Skip on cert-first path — creators were handled by extractSlabDetails
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
            comicDetails.keyInfoSource = "ai";
          }
        } catch {
          // Continue with partial data — image analysis result is still valid
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
            // Cache miss or stale AI price — fetch from eBay Browse API
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
    // Metron Verification Merge (non-blocking result)
    // ============================================
    if (metronPromise) {
      try {
        const settled = await metronPromise;
        if (settled.status === "fulfilled" && settled.value.verified) {
          const metronResult = settled.value;
          // Boost confidence if Metron verified the comic
          if (metronResult.confidence_boost && comicDetails.confidence !== "high") {
            comicDetails.confidence = "high";
          }
          // Use Metron cover image if we don't have one
          if (metronResult.cover_image && !comicDetails.coverImageUrl) {
            comicDetails.coverImageUrl = metronResult.cover_image;
            comicDetails.coverSource = "metron";
            comicDetails.coverValidated = false; // Flagged for validation on next lookup
          }
          // Store Metron ID for future reference
          if (metronResult.metron_id) {
            comicDetails.metronId = metronResult.metron_id;
          }
        }
      } catch {
        // Metron merge failed — proceed silently
      }
    }

    // ============================================
    // Cover Image Pipeline Fallback
    // If no cover from Metron, try the pipeline with eBay listing images
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
    const savePayload = buildMetadataSavePayload(
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
    const costCents = estimateScanCostCents({
      metadataCacheHit,
      aiCallsMade,
      ebayLookup: ebayLookupMade,
      provider: p1 as "anthropic" | "gemini",
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
        provider: p1 as "anthropic" | "gemini",
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
      provider: p1,
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
    // Runs pre-response with 2s timeout — see spec for rationale
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

    return NextResponse.json({ ...comicDetails, cerebro_assisted, _meta });
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
    const failProvider = p1 || "anthropic";
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
