import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 0.1, // 10% of transactions

  // Session Replay (M-CC12): disable always-on session replay; PostHog covers
  // session recording. Keep on-error replay only (low volume, high debugging value).
  replaysOnErrorSampleRate: 1.0, // 100% when there's an error

  // Debug mode (disable in production)
  debug: false,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",
});
