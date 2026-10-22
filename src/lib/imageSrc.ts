import { matchRemotePattern } from "next/dist/shared/lib/match-remote-pattern";

import { IMAGE_REMOTE_PATTERNS } from "./imageRemotePatterns.mjs";

/**
 * True when next/image can optimize `src` — a same-origin relative path, or an
 * absolute URL matching `images.remotePatterns` (same allowlist + same matcher
 * Next uses). Anything else (user-supplied cover URLs on unknown hosts, http,
 * data:/blob: URIs, malformed strings) must render with `unoptimized`, otherwise
 * next/image throws and the page hits the error boundary.
 *
 * Usage: <Image src={url} unoptimized={!isOptimizableImageSrc(url)} ... />
 */
export function isOptimizableImageSrc(src: string | null | undefined): boolean {
  if (typeof src !== "string") return false;
  const trimmed = src.trim();
  if (!trimmed) return false;

  // Same-origin relative path (but not protocol-relative "//host/...").
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }
  return IMAGE_REMOTE_PATTERNS.some((pattern) => matchRemotePattern(pattern, url));
}
