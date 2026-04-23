/**
 * Server-side upload size enforcement for image endpoints.
 *
 * Centralizes the maximum accepted payload size so that API routes and
 * client-side pre-flight validation stay in sync. Mobile photos typically
 * weigh in around 2-5MB, so a 10MB ceiling gives comfortable headroom
 * without exposing the server to OOM / runaway AI cost attacks.
 */

/** Maximum accepted image upload size, in bytes. */
export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

/** Human-readable limit (e.g. "10MB") for use in error messages. */
export const MAX_IMAGE_UPLOAD_LABEL = `${MAX_IMAGE_UPLOAD_BYTES / 1024 / 1024}MB`;

/** Error code surfaced on oversized payload rejections. */
export const PAYLOAD_TOO_LARGE_CODE = "PAYLOAD_TOO_LARGE";

/** Error thrown when an upload exceeds {@link MAX_IMAGE_UPLOAD_BYTES}. */
export class PayloadTooLargeError extends Error {
  readonly code = PAYLOAD_TOO_LARGE_CODE;
  readonly sizeBytes: number;

  constructor(sizeBytes: number, label = "Image") {
    super(`${label} is too large (max ${MAX_IMAGE_UPLOAD_LABEL})`);
    this.name = "PayloadTooLargeError";
    this.sizeBytes = sizeBytes;
  }
}

/**
 * Throws {@link PayloadTooLargeError} if `sizeBytes` exceeds the cap.
 *
 * @param sizeBytes - Byte length of the decoded payload.
 * @param label - Prefix used in the error message (e.g. "Scan image").
 */
export function assertImageSize(sizeBytes: number, label: string = "Image"): void {
  if (sizeBytes > MAX_IMAGE_UPLOAD_BYTES) {
    throw new PayloadTooLargeError(sizeBytes, label);
  }
}

/**
 * Estimate the decoded byte length of a base64-encoded string.
 *
 * Strips a data URL prefix if present, then returns the actual binary
 * size rather than the base64 string length (which is ~33% larger).
 */
export function base64DecodedByteLength(base64: string): number {
  const stripped = base64.replace(/^data:[^;]+;base64,/, "");
  // Buffer.byteLength with base64 encoding gives the exact decoded length.
  return Buffer.byteLength(stripped, "base64");
}

/**
 * Returns true if `sizeBytes` is within the upload cap. Useful in
 * client-side UI code where throwing is unwanted.
 */
export function isWithinImageUploadLimit(sizeBytes: number): boolean {
  return sizeBytes <= MAX_IMAGE_UPLOAD_BYTES;
}
