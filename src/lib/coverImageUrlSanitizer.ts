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
 *   - Reject URLs longer than 2048 characters (Stripe + most CDNs cap here)
 *   - Reject URLs whose `?` query string is suspiciously long (almost always
 *     a Supabase signed URL with embedded JWT — caller should persist the
 *     storage object key and build the signed URL on read instead)
 *   - Reject URLs that point at localhost / private/loopback hosts. These cover
 *     URLs are later fetched server-side (HEAD check / Stripe), so a stored
 *     value pointing at an internal host is an SSRF vector — block it at write.
 *   - Pass through `null` and `undefined` unchanged (column already supports them)
 *
 * Returns the original URL if it passes, `null` if it fails. Never throws —
 * sanitization failures shouldn't block the broader write.
 */

const MAX_URL_LENGTH = 2048;
const MAX_QUERY_STRING_LENGTH = 800; // signed-URL JWT typically pushes this past 1KB

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

  // 3. Reject overly long URLs (Stripe images cap, CDN limits)
  if (trimmed.length > MAX_URL_LENGTH) return null;

  // 4. Reject suspiciously long query strings (signed URLs with JWT)
  const queryStart = trimmed.indexOf("?");
  if (queryStart !== -1) {
    const queryString = trimmed.slice(queryStart + 1);
    if (queryString.length > MAX_QUERY_STRING_LENGTH) return null;
  }

  // 5. Reject localhost / private / loopback hosts (SSRF guard — these URLs are
  //    later fetched server-side). Parse the host and block internal targets.
  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    if (isPrivateHost(host)) return null;
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
