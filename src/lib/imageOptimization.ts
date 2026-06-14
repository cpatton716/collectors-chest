/**
 * Image Optimization Utilities
 *
 * Provides efficient image compression for:
 * 1. Storage optimization (reduced database size)
 * 2. Faster API calls (smaller payloads)
 * 3. Better mobile performance
 */

/**
 * Calculate new dimensions while maintaining aspect ratio
 */
function calculateDimensions(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  if (width > height) {
    return {
      width: maxDimension,
      height: Math.round((height * maxDimension) / width),
    };
  } else {
    return {
      width: Math.round((width * maxDimension) / height),
      height: maxDimension,
    };
  }
}

/**
 * Whether the current environment can encode WebP via canvas.toDataURL.
 * Safari added canvas WebP export in 16.4; older browsers fall back to JPEG.
 * Result is memoized — the capability doesn't change within a session.
 */
let _webpSupport: boolean | null = null;
export function canEncodeWebp(): boolean {
  if (_webpSupport !== null) return _webpSupport;
  if (typeof document === "undefined") {
    _webpSupport = false;
    return false;
  }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    // If WebP isn't supported, toDataURL silently falls back to PNG.
    _webpSupport = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    _webpSupport = false;
  }
  return _webpSupport;
}

/**
 * Compress an image to a target size using progressive quality reduction.
 *
 * Encodes to WebP when the browser supports it (smaller files at equal quality)
 * and falls back to JPEG otherwise. Size is measured against the actual decoded
 * byte size via {@link estimateBase64Size} rather than a base64-length fudge
 * factor, so the target comparison is exact.
 */
function compressToTarget(
  canvas: HTMLCanvasElement,
  targetSize: number,
  initialQuality: number,
  minQuality: number
): string {
  const mimeType = canEncodeWebp() ? "image/webp" : "image/jpeg";

  let quality = initialQuality;
  let dataUrl = canvas.toDataURL(mimeType, quality);

  // Reduce quality until the decoded payload hits target size or min quality.
  while (estimateBase64Size(dataUrl) > targetSize && quality > minQuality) {
    quality -= 0.05;
    dataUrl = canvas.toDataURL(mimeType, quality);
  }

  return dataUrl;
}

/**
 * Load an image from a File or data URL
 */
function loadImage(source: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));

    if (typeof source === "string") {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(source);
    }
  });
}

/**
 * Quick compress an image (just full version, no thumbnail)
 * Use this for immediate display before any heavier storage processing.
 */
export async function quickCompress(
  source: File | string,
  maxDimension = 1200,
  targetSize = 400 * 1024
): Promise<string> {
  const img = await loadImage(source);

  const dims = calculateDimensions(img.width, img.height, maxDimension);

  const canvas = document.createElement("canvas");
  canvas.width = dims.width;
  canvas.height = dims.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, dims.width, dims.height);

  return compressToTarget(canvas, targetSize, 0.8, 0.4);
}

/**
 * Estimate the size of a base64 string in bytes
 */
export function estimateBase64Size(dataUrl: string): number {
  // Remove the data URL prefix
  const base64 = dataUrl.split(",")[1] || dataUrl;
  // Base64 is ~4/3 the size of binary
  return Math.round((base64.length * 3) / 4);
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
