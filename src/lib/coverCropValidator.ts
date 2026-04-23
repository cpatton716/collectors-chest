/**
 * Defensive validator for AI-returned cover crop coordinates.
 *
 * Comic book covers are roughly 2:3 aspect ratio (~0.66 w/h). When the AI
 * returns crop coordinates for a slabbed comic, coordinates whose w/h ratio
 * falls wildly outside the expected range almost certainly indicate a bad
 * crop (e.g. cropped only the grading label strip, or the full slab case).
 *
 * This is a defense-in-depth guard on top of the prompt instructions in
 * `src/lib/providers/anthropic.ts` / `gemini.ts`. It rejects nonsensical
 * coordinates before they can pollute the community cover cache, but it does
 * NOT block the rest of the scan response — the scan still succeeds, we just
 * don't harvest a cover for this image.
 */

// Standard comic covers are ~0.66 w/h. The window below is deliberately wide
// to tolerate slab-through-plastic perspective and minor AI inaccuracy without
// rejecting real covers. Values outside this range are extremely unlikely to
// be a comic cover and almost always represent a mis-crop (grade label only,
// full slab region including the label, square logo area, etc.).
export const COMIC_ASPECT_RATIO_MIN = 0.55; // w/h — narrowest acceptable (tall, skinny)
export const COMIC_ASPECT_RATIO_MAX = 0.85; // w/h — widest acceptable (still comic-like)

export interface CropCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropValidationResult {
  valid: boolean;
  reason?: string;
  aspectRatio: number;
}

/**
 * Validate the aspect ratio of AI-returned crop coordinates against the
 * expected comic cover window (~0.55 to ~0.85 w/h).
 *
 * This is a shape-only check. It does NOT verify that coordinates fit within
 * the source image bounds — that's `validateCropCoordinates` in coverHarvest.ts.
 */
export function validateCoverCrop(
  coords: CropCoordinates
): CropValidationResult {
  const { width, height } = coords;

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return {
      valid: false,
      reason: "Width or height is not a finite number",
      aspectRatio: 0,
    };
  }

  if (width <= 0 || height <= 0) {
    return {
      valid: false,
      reason: "Non-positive width or height",
      aspectRatio: 0,
    };
  }

  const aspectRatio = width / height;

  if (aspectRatio < COMIC_ASPECT_RATIO_MIN) {
    return {
      valid: false,
      reason: `Aspect ratio ${aspectRatio.toFixed(2)} too narrow (min ${COMIC_ASPECT_RATIO_MIN}) — likely includes full slab or non-cover region`,
      aspectRatio,
    };
  }

  if (aspectRatio > COMIC_ASPECT_RATIO_MAX) {
    return {
      valid: false,
      reason: `Aspect ratio ${aspectRatio.toFixed(2)} too wide (max ${COMIC_ASPECT_RATIO_MAX}) — likely cropped only the grading label`,
      aspectRatio,
    };
  }

  return { valid: true, aspectRatio };
}
