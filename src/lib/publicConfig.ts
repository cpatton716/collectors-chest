// Client-safe shared constants. Everything in this module may be imported
// from both server and client code — no secrets, no server-only dependencies.

/**
 * Default support inbox shown in user-facing copy and mailto links.
 *
 * ⚠️ OWNER-SUPPLIED PLACEHOLDER — the owner must confirm the real monitored
 * support address before launch (see CLOSEOUT_RESIDUAL_2026-06-14.md). The
 * server email layer overlays the SUPPORT_EMAIL env var on top of this
 * default (src/lib/email/constants.ts); client components always render this
 * default, so update it here once the real inbox is decided.
 */
export const DEFAULT_SUPPORT_EMAIL = "support@collectors-chest.com";

/**
 * hCaptcha site key, shared by the client widget (GuestCaptcha) and the
 * server-side siteverify helper (src/lib/hcaptcha.ts). Outside production
 * this is hCaptcha's universal test key so local dev always passes; in
 * production it reads NEXT_PUBLIC_HCAPTCHA_SITE_KEY (inlined at build time
 * for both server and client bundles).
 */
export const HCAPTCHA_SITE_KEY =
  process.env.NODE_ENV !== "production"
    ? "10000000-ffff-ffff-ffff-000000000001"
    : (process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ?? "");
