import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Explicit allowlist of remote image hosts (H-CC4 / M-FE8).
    // Replaces the previous wildcard `hostname: "**"`.
    remotePatterns: [
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
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60,
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

// Wrap with Sentry only if DSN is configured
const sentryConfig = process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      // Suppress source map upload logs
      silent: true,

      // Upload source maps for better error tracking
      widenClientFileUpload: true,

      // Hide source maps from browsers
      hideSourceMaps: true,

      // Tree-shake Sentry SDK logger statements to reduce bundle size
      webpack: {
        treeshake: {
          removeDebugLogging: true,
        },
      },
    })
  : nextConfig;

// Apply bundle analyzer wrapper
export default withBundleAnalyzer(sentryConfig);
