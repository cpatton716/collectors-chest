/**
 * Email validation utilities for bonus scan claims
 * Includes format validation, MX record checking, and disposable email detection
 */
import dns from "dns";
import { promisify } from "util";

const resolveMx = promisify(dns.resolveMx);

// Best-effort disposable email blocklist.
//
// NOTE: This is intentionally a curated, hand-maintained list — NOT a complete
// defense. New disposable providers appear constantly, so this list will always
// lag. It exists to cheaply filter the most common throwaway domains used to
// farm bonus scans. The MX-record check in `validateEmail` is the broader gate.
// If abuse pressure grows, vendor a maintained list (e.g. the
// `disposable-email-domains` package) instead of expanding this by hand.
const DISPOSABLE_DOMAINS = new Set([
  // Original set
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "throwaway.email",
  "10minutemail.com",
  "temp-mail.org",
  "fakeinbox.com",
  "trashmail.com",
  "maildrop.cc",
  "dispostable.com",
  "yopmail.com",
  "getnada.com",
  "tempail.com",
  "mohmal.com",
  "emailondeck.com",
  // Common Mailinator / GuerrillaMail aliases
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "guerrillamail.de",
  "sharklasers.com",
  "grr.la",
  "spam4.me",
  "pokemail.net",
  // 10minutemail / temp-mail families
  "10minutemail.net",
  "10minutemail.org",
  "20minutemail.com",
  "temp-mail.io",
  "tempmail.io",
  "tempmailo.com",
  "tempr.email",
  "tmail.com",
  "mintemail.com",
  "moakt.com",
  "trbvm.com",
  // Other widely-used throwaway providers
  "mailnesia.com",
  "mailcatch.com",
  "spambox.us",
  "spambog.com",
  "fakemailgenerator.com",
  "discard.email",
  "discardmail.com",
  "getairmail.com",
  "throwawaymail.com",
  "tempinbox.com",
  "inboxbear.com",
  "harakirimail.com",
  "maileater.com",
  "mvrht.com",
  "nwytg.net",
  "tmpmail.org",
  "tmpmail.net",
  "1secmail.com",
  "1secmail.org",
  "1secmail.net",
  "emltmp.com",
  "burnermail.io",
  "mailpoof.com",
  "luxusmail.org",
  "byom.de",
]);

export interface EmailValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string;
}

/**
 * Validate email format using regex.
 * Exported for unit testing of the pure format logic.
 */
export function isValidEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if email domain is a known disposable email provider.
 * Exported for unit testing of the pure blocklist logic.
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? DISPOSABLE_DOMAINS.has(domain) : false;
}

/**
 * Check if email domain has valid MX records
 * Returns true if MX records exist, false otherwise
 */
async function hasMxRecords(email: string): Promise<boolean> {
  const domain = email.split("@")[1];
  if (!domain) return false;

  try {
    const records = await resolveMx(domain);
    return records && records.length > 0;
  } catch {
    // DNS lookup failed - domain likely doesn't exist or has no mail server
    return false;
  }
}

/**
 * Comprehensive email validation
 * - Format check
 * - Disposable email check
 * - MX record validation
 */
export async function validateEmail(email: string): Promise<EmailValidationResult> {
  // Normalize
  const normalized = email.toLowerCase().trim();

  // Format check
  if (!isValidEmailFormat(normalized)) {
    return {
      valid: false,
      error: "Invalid email format",
    };
  }

  // Disposable email check
  if (isDisposableEmail(normalized)) {
    return {
      valid: false,
      error: "Please use a permanent email address, not a disposable one",
    };
  }

  // MX record check (skip in development/test for speed)
  if (process.env.NODE_ENV === "production") {
    const hasMx = await hasMxRecords(normalized);
    if (!hasMx) {
      return {
        valid: false,
        error: "This email domain doesn't appear to accept mail",
      };
    }
  }

  return {
    valid: true,
    normalized,
  };
}

/**
 * Generate a secure verification token
 */
export function generateVerificationToken(): string {
  // Generate 32 random bytes, convert to URL-safe base64
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
