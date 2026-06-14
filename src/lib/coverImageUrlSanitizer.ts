/**
 * Defensive sanitizer for the `cover_image_url` column.
 *
 * History: Apr 23, 2026 a Buy Now checkout 500'd in production because
 * `cover_image_url` carried a 2400+ char Supabase signed URL (with JWT query
 * params), which Stripe rejected on `line_items[].product_data.images[]`
 * (2048-char cap). Earlier still, base64 `data:` URIs leaked into the column
 * via paste-from-clipboard flows and broke CSV export.
 *
 * Rather than scatter defensive guards across every read site, sanitize at
 * the WRITE boundary so dirty values never reach storage. Any value that
 * fails sanitization is converted to `null` (the column is nullable; UI
 * fallback gracefully renders the placeholder).
 *
 * Rules:
 *   - Reject `data:` URIs (no base64 in the column — should be a real URL)
 *   - Reject anything that isn't `http://` or `https://`
 *   - Reject non-`https://` URLs in production (cover URLs are surfaced to
 *     Stripe / fetched server-side; plain http is only tolerated in dev/test)
 *   - Reject URLs longer than 2048 characters (Stripe + most CDNs cap here)
 *   - Reject URLs whose `?` query string is suspiciously long (almost always
 *     a Supabase signed URL with embedded JWT — caller should persist the
 *     storage object key and build the signed URL on read instead)
 *   - Reject URLs that point at localhost / private/loopback hosts. These cover
 *     URLs are later fetched server-side (HEAD check / Stripe), so a stored
 *     value pointing at an internal host is an SSRF vector — block it at write.
 *   - Reject URLs whose host is not on the explicit allowlist (the Supabase
 *     storage host plus the three external cover CDNs). This mirrors the
 *     `next.config.mjs` image `remotePatterns` allowlist so a value that can't
 *     be rendered by next/image can't be persisted either, and shrinks the
 *     SSRF surface to a handful of known-good hosts.
 *   - Pass through `null` and `undefined` unchanged (column already supports them)
 *
 * Returns the original URL if it passes, `null` if it fails. Never throws —
 * sanitization failures shouldn't block the broader write.
 */

const MAX_URL_LENGTH = 2048;
const MAX_QUERY_STRING_LENGTH = 800; // signed-URL JWT typically pushes this past 1KB

/**
 * Hostname allowlist — must stay in sync with `next.config.mjs` image
 * `remotePatterns`. Anything not on this list is rejected at the write boundary.
 *   - Supabase storage host (derived from NEXT_PUBLIC_SUPABASE_URL): user-uploaded covers
 *   - i.ebayimg.com: eBay listing photos used for pricing/cover matches
 *   - img.clerk.com: Clerk-hosted avatars
 *   - covers.openlibrary.org: Open Library cover fallbacks
 */
const STATIC_ALLOWED_HOSTS = [
  "i.ebayimg.com",
  "img.clerk.com",
  "covers.openlibrary.org",
] as const;

/** Derive the Supabase storage host from NEXT_PUBLIC_SUPABASE_URL (e.g. "abc.supabase.co"). */
function getSupabaseHost(): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;
  try {
    return new URL(supabaseUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True when `host` is on the allowlist (Supabase storage host + external cover CDNs). */
function isAllowedHost(host: string): boolean {
  if (STATIC_ALLOWED_HOSTS.includes(host as (typeof STATIC_ALLOWED_HOSTS)[number])) {
    return true;
  }
  const supabaseHost = getSupabaseHost();
  return supabaseHost != null && host === supabaseHost;
}

export function sanitizeCoverImageUrl(
  url: string | null | undefined,
): string | null {
  if (url == null) return null;
  if (typeof url !== "string") return null;

  const trimmed = url.trim();
  if (trimmed.length === 0) return null;

  // 1. Reject base64 data URIs
  if (trimmed.startsWith("data:")) return null;

  // 2. Must be HTTP(S)
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return null;
  }

  // 3. In production, require https (plain http only tolerated in dev/test).
  if (
    process.env.NODE_ENV === "production" &&
    trimmed.startsWith("http://")
  ) {
    return null;
  }

  // 4. Reject overly long URLs (Stripe images cap, CDN limits)
  if (trimmed.length > MAX_URL_LENGTH) return null;

  // 5. Reject suspiciously long query strings (signed URLs with JWT)
  const queryStart = trimmed.indexOf("?");
  if (queryStart !== -1) {
    const queryString = trimmed.slice(queryStart + 1);
    if (queryString.length > MAX_QUERY_STRING_LENGTH) return null;
  }

  // 6. Reject localhost / private / loopback hosts (SSRF guard — these URLs are
  //    later fetched server-side) and any host not on the allowlist. Parse the
  //    host once and apply both checks.
  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    if (isPrivateHost(host)) return null;
    if (!isAllowedHost(host)) return null;
  } catch {
    // Unparseable URL — fail closed.
    return null;
  }

  return trimmed;
}

/**
 * True for hosts that resolve to loopback / private / link-local ranges or
 * have no public DNS dot (e.g. "localhost", bare hostnames). Best-effort string
 * check — not a full DNS resolution, but blocks the obvious SSRF targets.
 */
function isPrivateHost(host: string): boolean {
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  // Bare hostname with no dot (e.g. "metadata", "redis") — not a public domain.
  if (!host.includes(".")) return true;
  // IPv6 loopback / unspecified.
  if (host === "::1" || host === "[::1]" || host === "0.0.0.0") return true;
  // IPv4 private / loopback / link-local ranges.
  if (/^127\./.test(host)) return true; // loopback
  if (/^10\./.test(host)) return true; // private class A
  if (/^192\.168\./.test(host)) return true; // private class C
  if (/^169\.254\./.test(host)) return true; // link-local (cloud metadata)
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true; // private class B
  return false;
}
