import { withSentryConfig } from "@sentry/nextjs";

import bundleAnalyzer from "@next/bundle-analyzer";

import { IMAGE_REMOTE_PATTERNS } from "./src/lib/imageRemotePatterns.mjs";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Don't let `next dev` auto-generate AGENTS.md (Next 16 agent-rules feature).
  agentRules: false,
  images: {
    // Explicit allowlist of remote image hosts (H-CC4 / M-FE8). Defined once in
    // src/lib/imageRemotePatterns.mjs and shared with isOptimizableImageSrc().
    remotePatterns: IMAGE_REMOTE_PATTERNS,
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
