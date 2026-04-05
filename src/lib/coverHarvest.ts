import sharp from "sharp";
import { supabaseAdmin } from "./supabase";
import { submitCoverImage, getCommunityCovers } from "./coverImageDb";

export const SYSTEM_HARVEST_PROFILE_ID = "00000000-0000-0000-0000-000000000001";

export interface CropCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate AI-returned crop coordinates against image dimensions.
 */
export function validateCropCoordinates(
  coords: CropCoordinates,
  imageWidth: number,
  imageHeight: number
): ValidationResult {
  const { x, y, width, height } = coords;

  if ([x, y, width, height].some((v) => !Number.isFinite(v))) {
    return { valid: false, reason: "coordinates contain NaN or non-finite values" };
  }

  if (x < 0 || y < 0 || width < 0 || height < 0) {
    return { valid: false, reason: "coordinates contain negative values" };
  }

  if (x + width > imageWidth || y + height > imageHeight) {
    return { valid: false, reason: "coordinates exceed image bounds" };
  }

  const cropArea = width * height;
  const imageArea = imageWidth * imageHeight;
  if (cropArea > imageArea * 0.9) {
    return { valid: false, reason: "crop area exceeds 90% of original image" };
  }

  return { valid: true };
}

/**
 * Apply 4% inset padding to crop coordinates to compensate for AI imprecision.
 */
export function applyInsetPadding(coords: CropCoordinates): CropCoordinates {
  const insetX = Math.round(coords.width * 0.04);
  const insetY = Math.round(coords.height * 0.04);

  return {
    x: coords.x + insetX,
    y: coords.y + insetY,
    width: coords.width - insetX * 2,
    height: coords.height - insetY * 2,
  };
}

/**
 * Check if crop aspect ratio is approximately 2:3 (comic cover proportions).
 * Valid range: width/height between 0.55 and 0.80.
 */
export function isValidAspectRatio(width: number, height: number): boolean {
  if (height === 0) return false;
  const ratio = width / height;
  return ratio >= 0.55 && ratio <= 0.80;
}

/**
 * Check if post-inset dimensions meet minimum requirements.
 */
export function meetsMinimumDimensions(width: number, height: number): boolean {
  return width >= 100 && height >= 150;
}

export interface HarvestEligibility {
  eligible: boolean;
  reason?: string;
}

/**
 * Determine if a scan result is eligible for cover harvesting.
 */
export function shouldHarvest(params: {
  isSlabbed: boolean;
  coverHarvestable?: boolean;
  coverCropCoordinates?: CropCoordinates;
  isAuthenticated: boolean;
}): HarvestEligibility {
  if (!params.isAuthenticated) {
    return { eligible: false, reason: "guest user" };
  }
  if (!params.isSlabbed) {
    return { eligible: false, reason: "not slabbed" };
  }
  if (!params.coverHarvestable) {
    return { eligible: false, reason: "not harvestable" };
  }
  if (!params.coverCropCoordinates) {
    return { eligible: false, reason: "no crop coordinates" };
  }
  return { eligible: true };
}

export interface HarvestParams {
  base64Image: string;
  title: string;
  issueNumber: string;
  variant: string | null;
  coverCropCoordinates: CropCoordinates;
  profileId: string | null;
  isSlabbed: boolean;
  coverHarvestable?: boolean;
}

export async function harvestCoverFromScan(params: HarvestParams): Promise<boolean> {
  const {
    base64Image, title, issueNumber, variant,
    coverCropCoordinates, profileId, isSlabbed, coverHarvestable,
  } = params;

  // 1. Eligibility check
  const eligibility = shouldHarvest({
    isSlabbed,
    coverHarvestable,
    coverCropCoordinates,
    isAuthenticated: !!profileId,
  });
  if (!eligibility.eligible) {
    console.log(`[harvest] skipped: ${eligibility.reason}`);
    return false;
  }

  // 2. Check if cover already exists
  const normalizedVariant = variant ? variant.toLowerCase().trim() : "";
  const existingCover = await getCommunityCovers(title, issueNumber, normalizedVariant);
  if (existingCover) {
    console.log("[harvest] skipped: cover exists");
    return false;
  }

  // 3. Decode image and get dimensions
  const imageBuffer = Buffer.from(base64Image, "base64");
  const metadata = await sharp(imageBuffer).metadata();
  const imageWidth = metadata.width || 0;
  const imageHeight = metadata.height || 0;

  // 4. Validate coordinates
  const coordValidation = validateCropCoordinates(coverCropCoordinates, imageWidth, imageHeight);
  if (!coordValidation.valid) {
    console.log(`[harvest] skipped: bad coordinates — ${coordValidation.reason}`);
    return false;
  }

  // 5. Apply 4% inset padding
  const insetCoords = applyInsetPadding(coverCropCoordinates);

  // 6. Validate dimensions after inset
  if (!meetsMinimumDimensions(insetCoords.width, insetCoords.height)) {
    console.log("[harvest] skipped: too small after inset");
    return false;
  }

  // 7. Validate aspect ratio
  if (!isValidAspectRatio(insetCoords.width, insetCoords.height)) {
    console.log("[harvest] skipped: bad aspect ratio");
    return false;
  }

  // 8. Crop the image
  const croppedBuffer = await sharp(imageBuffer)
    .extract({ left: insetCoords.x, top: insetCoords.y, width: insetCoords.width, height: insetCoords.height })
    .toBuffer();

  // 9. Validate color variance (reject solid-color garbage crops)
  const stats = await sharp(croppedBuffer).stats();
  const allLowVariance = stats.channels.every((ch) => ch.stdev < 10);
  if (allLowVariance) {
    console.log("[harvest] skipped: low color variance");
    return false;
  }

  // 10. Convert to WebP
  const webpBuffer = await sharp(croppedBuffer).webp({ quality: 85 }).toBuffer();

  // 11. Upload to Supabase Storage
  const safeTitle = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
  const safeIssue = issueNumber.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
  const variantPath = normalizedVariant ? normalizedVariant.replace(/[^a-z0-9]+/g, "-") : "_default";
  const uuid = crypto.randomUUID();
  const storagePath = `${safeTitle}/${safeIssue}/${variantPath}/${uuid}.webp`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("cover-images")
    .upload(storagePath, webpBuffer, { contentType: "image/webp", upsert: false });

  if (uploadError) {
    console.error("[harvest] storage upload failed:", uploadError.message);
    return false;
  }

  // 12. Get public URL
  const { data: urlData } = supabaseAdmin.storage.from("cover-images").getPublicUrl(storagePath);

  // 13. Submit to community cover database
  await submitCoverImage({
    title,
    issueNumber,
    imageUrl: urlData.publicUrl,
    submittedBy: SYSTEM_HARVEST_PROFILE_ID,
    sourceQuery: "scan-harvest",
    autoApprove: true,
    variant: normalizedVariant,
  });

  console.log(`[harvest] success: ${title} #${issueNumber}${normalizedVariant ? ` (${normalizedVariant})` : ""}`);
  return true;
}
