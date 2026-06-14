/**
 * Content filtering for messages
 *
 * Layer 1: BLOCKED patterns - Message is rejected
 * Layer 2: FLAGGED patterns - Message is sent but flagged for review
 */

// Patterns that BLOCK the message from being sent
const BLOCKED_PATTERNS: { pattern: RegExp; reason: string }[] = [
  // Phone numbers with explicit separators (e.g. 555-123-4567, (555) 123 4567,
  // +1 555.123.4567). Requiring a separator between the area code and the
  // remaining groups avoids matching plain 10-digit runs such as order IDs,
  // ISBNs, or comic catalog numbers. Word boundaries prevent matching the
  // middle of a longer digit string.
  {
    pattern: /(?<!\d)(?:\+?\d{1,3}[-.\s]+)?\(?\d{3}\)?[-.\s]+\d{3}[-.\s]+\d{4}(?!\d)/,
    reason: "Phone numbers are not allowed in messages",
  },
  // Email addresses
  {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    reason: "Email addresses are not allowed in messages",
  },
];

// Patterns that FLAG the message for review (but still send it)
const FLAG_PATTERNS: { pattern: RegExp; reason: string }[] = [
  // Ambiguous contact-like number runs: a bare 10-digit sequence (no
  // separators) could be a phone number but is just as likely an order ID,
  // ISBN, or catalog number. Downgrade to FLAG rather than BLOCK to reduce
  // false positives while still surfacing for review.
  {
    pattern: /(?<!\d)\d{10}(?!\d)/,
    reason: "Possible contact number - flagged for review",
  },
  // Payment apps
  {
    pattern: /\b(venmo|zelle|paypal|cashapp|cash\s*app)\b/i,
    reason: "Mentions external payment service",
  },
  // Off-platform contact requests
  {
    pattern: /\b(text\s*me|call\s*me|whatsapp|telegram|signal|discord)\b/i,
    reason: "Requests off-platform contact",
  },
  // Urgency + payment patterns
  {
    pattern: /\b(urgent|asap|immediately|right\s*now)\b.*\b(pay|send|transfer|money)\b/i,
    reason: "Urgency with payment mention",
  },
  {
    pattern: /\b(pay|send|transfer|money)\b.*\b(urgent|asap|immediately|right\s*now)\b/i,
    reason: "Payment with urgency mention",
  },
];

export interface ContentCheckResult {
  blocked: boolean;
  flagged: boolean;
  reason?: string;
}

/**
 * Check message content for blocked or flagged patterns
 */
export function checkMessageContent(content: string): ContentCheckResult {
  // Check blocked patterns first
  for (const { pattern, reason } of BLOCKED_PATTERNS) {
    if (pattern.test(content)) {
      return {
        blocked: true,
        flagged: false,
        reason,
      };
    }
  }

  // Check flag patterns
  for (const { pattern, reason } of FLAG_PATTERNS) {
    if (pattern.test(content)) {
      return {
        blocked: false,
        flagged: true,
        reason,
      };
    }
  }

  // Content is clean
  return {
    blocked: false,
    flagged: false,
  };
}

/**
 * Sanitize content for safe display (no actual sanitization needed for text,
 * but this could be extended in the future)
 */
export function sanitizeContent(content: string): string {
  // For now, just trim whitespace
  return content.trim();
}
