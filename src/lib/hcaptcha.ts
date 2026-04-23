const IS_DEV = process.env.NODE_ENV !== "production";

export const HCAPTCHA_SITE_KEY = IS_DEV
  ? "10000000-ffff-ffff-ffff-000000000001"
  : (process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ?? "");

const HCAPTCHA_SECRET = IS_DEV
  ? "0x0000000000000000000000000000000000000000"
  : (process.env.HCAPTCHA_SECRET_KEY ?? "");

interface HCaptchaVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
}

export interface CaptchaVerificationResult {
  valid: boolean;
  reason?: string;
}

// Siteverify should respond in well under a second. Cap at 5s so we fail fast
// if hCaptcha is having an outage rather than blocking the user-facing scan
// request until Netlify's function timeout (~30s).
export const SITEVERIFY_TIMEOUT_MS = 5000;

/**
 * Verify a client-side hCaptcha token against hCaptcha's siteverify endpoint.
 * Returns { valid: true } on success, or { valid: false, reason } on failure.
 * Never throws — caller decides how to respond to failure.
 *
 * Fails closed: if siteverify is slow, unreachable, or misconfigured, we reject
 * the request rather than letting the scan proceed. A 5s abort timeout bounds
 * the wait — on hCaptcha outage, users see a retry prompt within seconds
 * instead of the full Netlify function timeout.
 */
export async function verifyCaptchaToken(
  token: string | null | undefined,
  clientIp?: string | null
): Promise<CaptchaVerificationResult> {
  if (!token) {
    return { valid: false, reason: "missing_token" };
  }
  if (!HCAPTCHA_SECRET) {
    return { valid: false, reason: "not_configured" };
  }

  try {
    const params = new URLSearchParams();
    params.set("secret", HCAPTCHA_SECRET);
    params.set("response", token);
    if (clientIp) params.set("remoteip", clientIp);
    params.set("sitekey", HCAPTCHA_SITE_KEY);

    const res = await fetch("https://api.hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    });

    if (!res.ok) {
      return { valid: false, reason: `siteverify_http_${res.status}` };
    }

    const body = (await res.json()) as HCaptchaVerifyResponse;
    if (body.success) {
      return { valid: true };
    }
    const code = body["error-codes"]?.[0] ?? "unknown";
    return { valid: false, reason: code };
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return { valid: false, reason: "siteverify_timeout" };
    }
    return { valid: false, reason: "network_error" };
  }
}

/**
 * Map an hCaptcha failure reason to a user-friendly message suitable for
 * display in the scan UI. Never leaks technical details.
 */
export function parseHCaptchaErrorForUser(reason?: string): string {
  if (!reason) return "CAPTCHA verification failed. Please try again.";
  switch (reason) {
    case "missing_token":
      return "Please complete the CAPTCHA and try again.";
    case "not_configured":
      return "CAPTCHA is not configured. Please contact support.";
    case "timeout-or-duplicate":
      return "CAPTCHA expired. Please refresh and try again.";
    case "siteverify_timeout":
      return "CAPTCHA verification is slow right now. Please try again in a moment.";
    default:
      return "CAPTCHA verification failed. Please try again.";
  }
}
