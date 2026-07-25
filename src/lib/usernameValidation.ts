/**
 * Username Validation Utility
 *
 * Validates usernames for format compliance and profanity filtering.
 * Uses leetspeak normalization to catch common bypasses.
 */

// Built-in profanity list (curated for usernames)
const PROFANITY_LIST = [
  "ass",
  "arse",
  "bastard",
  "bitch",
  "cock",
  "cunt",
  "damn",
  "dick",
  "fuck",
  "hell",
  "piss",
  "pussy",
  "shit",
  "slut",
  "whore",
  "penis",
  "vagina",
  "tit",
  "boob",
  "anal",
  "anus",
  "balls",
  "blowjob",
  "boner",
  "butthole",
  "cameltoe",
  "chode",
  "clit",
  "dildo",
  "douche",
  "erection",
  "fag",
  "fellatio",
  "gay",
  "homo",
  "jackoff",
  "jerkoff",
  "jizz",
  "lesbian",
  "masturbat",
  "milf",
  "negro",
  "nigger",
  "nipple",
  "nude",
  "orgasm",
  "orgy",
  "panties",
  "porn",
  "porno",
  "queef",
  "queer",
  "rape",
  "rectum",
  "retard",
  "scrotum",
  "semen",
  "sex",
  "smegma",
  "sperm",
  "testicle",
  "thot",
  "tranny",
  "twat",
  "wank",
  "xxx",
];

// ============================================
// Constants
// ============================================

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
const USERNAME_REGEX = /^[a-z0-9_]+$/;

// ============================================
// Leetspeak Normalization
// ============================================

/**
 * Normalize leetspeak/symbol substitutions to catch bypass attempts
 * e.g., "@ss" → "ass", "sh1t" → "shit"
 */
function normalizeLeetspeak(text: string): string {
  return text
    .toLowerCase()
    .replace(/@/g, "a")
    .replace(/\$/g, "s")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/8/g, "b")
    .replace(/9/g, "g")
    .replace(/\|/g, "i")
    .replace(/!/g, "i")
    .replace(/\+/g, "t")
    .replace(/ph/g, "f")
    .replace(/vv/g, "w")
    .replace(/ck/g, "k")
    .replace(/_/g, ""); // Remove underscores for checking
}

// ============================================
// Validation Functions
// ============================================

export interface UsernameValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate username format (length, allowed characters)
 */
export function validateUsernameFormat(username: string): UsernameValidationResult {
  // Check if empty
  if (!username || username.trim() === "") {
    return { isValid: false, error: "Username is required" };
  }

  // Normalize to lowercase
  const normalized = username.toLowerCase().trim();

  // Check length
  if (normalized.length < USERNAME_MIN_LENGTH) {
    return {
      isValid: false,
      error: `Username must be at least ${USERNAME_MIN_LENGTH} characters`,
    };
  }

  if (normalized.length > USERNAME_MAX_LENGTH) {
    return {
      isValid: false,
      error: `Username must be ${USERNAME_MAX_LENGTH} characters or less`,
    };
  }

  // Check allowed characters (lowercase letters, numbers, underscores)
  if (!USERNAME_REGEX.test(normalized)) {
    return {
      isValid: false,
      error: "Username can only contain letters, numbers, and underscores",
    };
  }

  // Cannot start or end with underscore
  if (normalized.startsWith("_") || normalized.endsWith("_")) {
    return {
      isValid: false,
      error: "Username cannot start or end with an underscore",
    };
  }

  // Cannot have consecutive underscores
  if (normalized.includes("__")) {
    return {
      isValid: false,
      error: "Username cannot have consecutive underscores",
    };
  }

  return { isValid: true };
}

/**
 * A few profanity entries are intentionally matched as substrings because they
 * are roots that only appear inside longer words (e.g. "masturbat" -> ...e/ion).
 * Everything else is matched on word boundaries to avoid the "Scunthorpe
 * problem" - i.e. innocent usernames like "classic", "passable", "analysis",
 * "grape", or "scunthorpe" must NOT be blocked just because a slur is a
 * substring. (H-SO2)
 */
const SUBSTRING_PROFANITY = new Set(["masturbat"]);

/**
 * Escape a string for safe use inside a RegExp.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Check if text contains any word from the profanity list.
 *
 * Matching is boundary-aware: a profane word is only flagged when it stands as
 * its own token. In a username, token separators are the start/end of the
 * string, underscores, and digits (since "shit123" / "123shit" / "xx_shit_xx"
 * are still abuse, but "classic" / "grape" / "scunthorpe" are not). A small
 * allowlist of roots (SUBSTRING_PROFANITY) is still matched as a substring.
 */
function isProfane(text: string): boolean {
  const lowerText = text.toLowerCase();

  return PROFANITY_LIST.some((word) => {
    if (SUBSTRING_PROFANITY.has(word)) {
      return lowerText.includes(word);
    }
    // (^|[^a-z])  = start of string OR a non-letter boundary before the word
    // ([^a-z]|$)  = a non-letter boundary after the word OR end of string
    // This treats letters as the only "word" characters, so digits and
    // underscores act as separators while alphabetic runs do not.
    const pattern = new RegExp(`(^|[^a-z])${escapeRegExp(word)}([^a-z]|$)`);
    return pattern.test(lowerText);
  });
}

/**
 * Check if username contains profanity (including leetspeak bypasses)
 */
export function containsProfanity(username: string): boolean {
  const normalized = username.toLowerCase().trim();

  // Check original username
  if (isProfane(normalized)) {
    return true;
  }

  // Check leetspeak-normalized version
  const leetNormalized = normalizeLeetspeak(normalized);
  if (isProfane(leetNormalized)) {
    return true;
  }

  // Check with underscores removed (catches "f_u_c_k" patterns). After removing
  // the separators the slur becomes a contiguous token, so the boundary check
  // still flags it (e.g. "f_u_c_k" -> "fuck"), while innocent words remain safe.
  const noUnderscores = normalized.replace(/_/g, "");
  if (isProfane(noUnderscores)) {
    return true;
  }

  // Also run the boundary check against the leet-normalized, underscore-stripped
  // form to catch separated leetspeak like "5_h_1_t" -> "shit".
  const leetNoUnderscores = normalizeLeetspeak(noUnderscores);
  if (isProfane(leetNoUnderscores)) {
    return true;
  }

  return false;
}

/**
 * Full username validation (format + profanity check)
 */
export function validateUsername(username: string): UsernameValidationResult {
  // First check format
  const formatResult = validateUsernameFormat(username);
  if (!formatResult.isValid) {
    return formatResult;
  }

  // Then check for profanity
  if (containsProfanity(username)) {
    return {
      isValid: false,
      error: "Username contains inappropriate content",
    };
  }

  return { isValid: true };
}

/**
 * Normalize username for storage (lowercase, trimmed)
 */
export function normalizeUsername(username: string): string {
  return username.toLowerCase().trim();
}

/**
 * Format username for display (with @ prefix)
 */
export function formatUsernameForDisplay(username: string): string {
  return `@${username}`;
}

// ============================================
// Reserved Usernames
// ============================================

const RESERVED_USERNAMES = [
  "admin",
  "administrator",
  "mod",
  "moderator",
  "support",
  "help",
  "system",
  "official",
  "staff",
  "team",
  "collectorschest",
  "collectors_chest",
  "professor",
  "the_professor",
  "root",
  "null",
  "undefined",
  "api",
  "www",
  "mail",
  "email",
];

/**
 * Check if username is reserved
 */
export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.includes(username.toLowerCase().trim());
}

/**
 * Complete validation including reserved username check
 */
export function validateUsernameComplete(username: string): UsernameValidationResult {
  // Basic validation
  const basicResult = validateUsername(username);
  if (!basicResult.isValid) {
    return basicResult;
  }

  // Check reserved usernames
  if (isReservedUsername(username)) {
    return {
      isValid: false,
      error: "This username is reserved",
    };
  }

  return { isValid: true };
}
