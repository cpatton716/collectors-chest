/**
 * Image Optimization Utilities
 *
 * Provides efficient image compression for:
 * 1. Storage optimization (reduced database size)
 * 2. Faster API calls (smaller payloads)
 * 3. Better mobile performance
 */

export interface OptimizedImage {
  /** Full quality image for detail view (max 800KB) */
  full: string;
  /** Thumbnail for list views (max 50KB) */
  thumbnail: string;
  /** Original dimensions */
  originalSize: { width: number; height: number };
  /** Compressed dimensions */
  compressedSize: { width: number; height: number };
  /** Compression stats for debugging */
  stats: {
    originalBytes: number;
    fullBytes: number;
    thumbnailBytes: number;
    compressionRatio: number;
  };
}

export interface CompressionOptions {
  /** Max dimension for full image (default: 1200) */
  maxFullDimension?: number;
  /** Max dimension for thumbnail (default: 300) */
  maxThumbnailDimension?: number;
  /** Target size for full image in bytes (default: 400KB) */
  targetFullSize?: number;
  /** Target size for thumbnail in bytes (default: 30KB) */
  targetThumbnailSize?: number;
  /** Starting quality 0-1 (default: 0.8) */
  initialQuality?: number;
  /** Minimum quality 0-1 (default: 0.4) */
  minQuality?: number;
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxFullDimension: 1200,
  maxThumbnailDimension: 300,
  targetFullSize: 400 * 1024, // 400KB
  targetThumbnailSize: 30 * 1024, // 30KB
  initialQuality: 0.8,
  minQuality: 0.4,
};

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
 * Optimize an image for storage and display
 *
 * @param source - File object or base64 data URL
 * @param options - Compression options
 * @returns Optimized image with full and thumbnail versions
 */
export async function optimizeImage(
  source: File | string,
  options: CompressionOptions = {}
): Promise<OptimizedImage> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Load the image
  const img = await loadImage(source);
  const originalSize = { width: img.width, height: img.height };
  const originalBytes = typeof source === "string" ? source.length : source.size;

  // Calculate dimensions for full image
  const fullDims = calculateDimensions(img.width, img.height, opts.maxFullDimension);

  // Create canvas for full image
  const fullCanvas = document.createElement("canvas");
  fullCanvas.width = fullDims.width;
  fullCanvas.height = fullDims.height;
  const fullCtx = fullCanvas.getContext("2d");
  if (!fullCtx) throw new Error("Could not get canvas context");

  // Enable image smoothing for better quality
  fullCtx.imageSmoothingEnabled = true;
  fullCtx.imageSmoothingQuality = "high";
  fullCtx.drawImage(img, 0, 0, fullDims.width, fullDims.height);

  // Compress full image
  const full = compressToTarget(
    fullCanvas,
    opts.targetFullSize,
    opts.initialQuality,
    opts.minQuality
  );

  // Calculate dimensions for thumbnail
  const thumbDims = calculateDimensions(img.width, img.height, opts.maxThumbnailDimension);

  // Create canvas for thumbnail
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = thumbDims.width;
  thumbCanvas.height = thumbDims.height;
  const thumbCtx = thumbCanvas.getContext("2d");
  if (!thumbCtx) throw new Error("Could not get canvas context");

  thumbCtx.imageSmoothingEnabled = true;
  thumbCtx.imageSmoothingQuality = "high";
  thumbCtx.drawImage(img, 0, 0, thumbDims.width, thumbDims.height);

  // Compress thumbnail more aggressively
  const thumbnail = compressToTarget(thumbCanvas, opts.targetThumbnailSize, 0.7, 0.3);

  return {
    full,
    thumbnail,
    originalSize,
    compressedSize: fullDims,
    stats: {
      originalBytes,
      fullBytes: full.length,
      thumbnailBytes: thumbnail.length,
      compressionRatio: originalBytes / full.length,
    },
  };
}

/**
 * Quick compress an image (just full version, no thumbnail)
 * Use this for immediate display, then call optimizeImage for storage
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
