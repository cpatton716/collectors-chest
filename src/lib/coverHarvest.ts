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
