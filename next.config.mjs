import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
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
