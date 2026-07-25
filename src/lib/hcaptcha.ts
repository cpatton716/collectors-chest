import { HCAPTCHA_SITE_KEY } from "./publicConfig";

const IS_DEV = process.env.NODE_ENV !== "production";

// Named to mirror the underlying env var (HCAPTCHA_SECRET_KEY) so the local
// constant and the configured secret can't be confused. Audit ref M-DOC7.
const HCAPTCHA_SECRET_KEY = IS_DEV
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
const SITEVERIFY_TIMEOUT_MS = 5000;

// Retry budget for transient network failures. Two extra attempts on top of
// the initial fetch covers most blip scenarios (TCP reset, connection refused,
// 5xx from hCaptcha edge) without inflating the worst-case wait beyond
// SITEVERIFY_TIMEOUT_MS * (1 + RETRY_ATTEMPTS) + RETRY_BACKOFF_MS * RETRY_ATTEMPTS
// = 5000ms * 3 + 200ms * 2 = ~15.4s, comfortably inside the 30s function cap.
//
// Non-transient errors (4xx including 400 invalid input, valid-but-failed
// verification responses) skip retries — they will not change on retry.
const RETRY_ATTEMPTS = 2;
const RETRY_BACKOFF_MS = 200;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Verify a client-side hCaptcha token against hCaptcha's siteverify endpoint.
 * Returns { valid: true } on success, or { valid: false, reason } on failure.
 * Never throws - caller decides how to respond to failure.
 *
 * Fails closed: if siteverify is slow, unreachable, or misconfigured, we reject
 * the request rather than letting the scan proceed. A 5s abort timeout bounds
 * the wait - on hCaptcha outage, users see a retry prompt within seconds
 * instead of the full Netlify function timeout.
 */
export async function verifyCaptchaToken(
  token: string | null | undefined,
  clientIp?: string | null
): Promise<CaptchaVerificationResult> {
  if (!token) {
    return { valid: false, reason: "missing_token" };
  }
  if (!HCAPTCHA_SECRET_KEY) {
    return { valid: false, reason: "not_configured" };
  }

  const params = new URLSearchParams();
  params.set("secret", HCAPTCHA_SECRET_KEY);
  params.set("response", token);
  if (clientIp) params.set("remoteip", clientIp);
  params.set("sitekey", HCAPTCHA_SITE_KEY);
  const body = params.toString();

  let lastResult: CaptchaVerificationResult = { valid: false, reason: "network_error" };
  for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const res = await fetch("https://api.hcaptcha.com/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
      });

      if (!res.ok) {
        // 5xx is transient (hCaptcha edge issue) — retry. 4xx is our fault
        // (bad secret, malformed body) — return immediately, retrying won't help.
        const reason = `siteverify_http_${res.status}`;
        lastResult = { valid: false, reason };
        if (res.status >= 500 && attempt < RETRY_ATTEMPTS) {
          await sleep(RETRY_BACKOFF_MS);
          continue;
        }
        return lastResult;
      }

      const json = (await res.json()) as HCaptchaVerifyResponse;
      if (json.success) {
        return { valid: true };
      }
      // Verification responses are authoritative — don't retry a "success: false".
      const code = json["error-codes"]?.[0] ?? "unknown";
      return { valid: false, reason: code };
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        // Timeout — treat as transient and retry within budget.
        lastResult = { valid: false, reason: "siteverify_timeout" };
      } else {
        // Network error (DNS, connection refused, TCP reset) — retry.
        lastResult = { valid: false, reason: "network_error" };
      }
      if (attempt < RETRY_ATTEMPTS) {
        await sleep(RETRY_BACKOFF_MS);
        continue;
      }
    }
  }
  return lastResult;
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
