// Single source of truth for remote image hosts that next/image may optimize.
// Imported by next.config.mjs (images.remotePatterns) AND by
// src/lib/imageSrc.ts (isOptimizableImageSrc), so the two can never drift.
// Plain .mjs data module so next.config.mjs can import it without a build step.
// Explicit allowlist (H-CC4 / M-FE8) — replaces the previous wildcard `hostname: "**"`.
// Do NOT add a wildcard host: URLs on other hosts render with `unoptimized`
// instead (see isOptimizableImageSrc).

/** @type {import("next/dist/shared/lib/image-config").RemotePattern[]} */
export const IMAGE_REMOTE_PATTERNS = [
  {
    // Supabase Storage (public covers) — project ref derived from
    // NEXT_PUBLIC_SUPABASE_URL (e.g. ytlzdczhzbyiujxwosez.supabase.co).
    // Wildcard subdomain covers the project ref / storage host.
    protocol: "https",
    hostname: "*.supabase.co",
    pathname: "/storage/v1/object/public/**",
  },
  {
    // eBay listing/sold-comp imagery
    protocol: "https",
    hostname: "i.ebayimg.com",
  },
  {
    // Clerk-hosted user avatars
    protocol: "https",
    hostname: "img.clerk.com",
  },
  {
    // Open Library cover fallbacks
    protocol: "https",
    hostname: "covers.openlibrary.org",
  },
  {
    // Comic Vine cover art — legacy cover URLs stored on comics,
    // hot_books and key_hunt_lists rows (~107 rows as of Oct 2026)
    protocol: "https",
    hostname: "comicvine.gamespot.com",
    pathname: "/a/uploads/**",
  },
  {
    // Marvel CDN cover art — legacy cover URLs on comics/cover_images rows
    protocol: "https",
    hostname: "cdn.marvel.com",
    pathname: "/u/prod/**",
  },
];
