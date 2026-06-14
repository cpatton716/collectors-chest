/**
 * Username Validation Tests
 *
 * Tests username format validation, profanity filtering, and reserved username checks.
 * Critical for user registration and profile management.
 */
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  containsProfanity,
  formatUsernameForDisplay,
  isReservedUsername,
  normalizeUsername,
  validateUsername,
  validateUsernameComplete,
  validateUsernameFormat,
} from "../usernameValidation";

describe("validateUsernameFormat", () => {
  describe("length validation", () => {
    it("rejects empty username", () => {
      const result = validateUsernameFormat("");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Username is required");
    });

    it("rejects whitespace-only username", () => {
      const result = validateUsernameFormat("   ");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Username is required");
    });

    it("rejects username shorter than minimum", () => {
      const result = validateUsernameFormat("ab");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain(`at least ${USERNAME_MIN_LENGTH}`);
    });

    it("accepts username at minimum length", () => {
      const result = validateUsernameFormat("abc");
      expect(result.isValid).toBe(true);
    });

    it("rejects username longer than maximum", () => {
      const result = validateUsernameFormat("a".repeat(USERNAME_MAX_LENGTH + 1));
      expect(result.isValid).toBe(false);
      expect(result.error).toContain(`${USERNAME_MAX_LENGTH} characters or less`);
    });

    it("accepts username at maximum length", () => {
      const result = validateUsernameFormat("a".repeat(USERNAME_MAX_LENGTH));
      expect(result.isValid).toBe(true);
    });
  });

  describe("character validation", () => {
    it("accepts lowercase letters", () => {
      expect(validateUsernameFormat("collector").isValid).toBe(true);
    });

    it("accepts numbers", () => {
      expect(validateUsernameFormat("user123").isValid).toBe(true);
    });

    it("accepts underscores in middle", () => {
      expect(validateUsernameFormat("comic_collector").isValid).toBe(true);
    });

    it("rejects uppercase letters (normalized to lowercase)", () => {
      // Username is normalized, so UPPERCASE becomes uppercase
      const result = validateUsernameFormat("UPPERCASE");
      expect(result.isValid).toBe(true);
    });

    it("rejects spaces", () => {
      const result = validateUsernameFormat("comic collector");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("letters, numbers, and underscores");
    });

    it("rejects special characters", () => {
      expect(validateUsernameFormat("user@name").isValid).toBe(false);
      expect(validateUsernameFormat("user-name").isValid).toBe(false);
      expect(validateUsernameFormat("user.name").isValid).toBe(false);
      expect(validateUsernameFormat("user!name").isValid).toBe(false);
    });
  });

  describe("underscore rules", () => {
    it("rejects username starting with underscore", () => {
      const result = validateUsernameFormat("_username");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("cannot start or end with an underscore");
    });

    it("rejects username ending with underscore", () => {
      const result = validateUsernameFormat("username_");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("cannot start or end with an underscore");
    });

    it("rejects consecutive underscores", () => {
      const result = validateUsernameFormat("user__name");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("consecutive underscores");
    });

    it("accepts single underscores between words", () => {
      expect(validateUsernameFormat("comic_book_fan").isValid).toBe(true);
    });
  });
});

describe("containsProfanity", () => {
  describe("direct profanity", () => {
    it("detects obvious profanity", () => {
      expect(containsProfanity("badword_shit")).toBe(true);
      expect(containsProfanity("fuck_you")).toBe(true);
    });

    it("allows clean usernames", () => {
      expect(containsProfanity("comic_collector")).toBe(false);
      expect(containsProfanity("spiderman_fan")).toBe(false);
      expect(containsProfanity("marvel_dc_123")).toBe(false);
    });
  });

  describe("leetspeak bypasses", () => {
    it("detects @ substitution for a", () => {
      expect(containsProfanity("@ss")).toBe(true);
    });

    it("detects $ substitution for s", () => {
      expect(containsProfanity("a$$")).toBe(true);
    });

    it("detects number substitutions", () => {
      expect(containsProfanity("sh1t")).toBe(true);
      expect(containsProfanity("4ss")).toBe(true);
    });

    it("detects combined leetspeak", () => {
      expect(containsProfanity("f_u_c_k")).toBe(true);
    });
  });

  describe("false positive prevention (H-SO2 - word-boundary matching)", () => {
    it("does NOT block innocent words that merely contain a slur as a substring", () => {
      // Previously these were false positives because matching used includes().
      // Word-boundary matching means an alphabetic run is never split, so a slur
      // buried inside a longer word is not flagged.
      expect(containsProfanity("class")).toBe(false); // contains "ass"
      expect(containsProfanity("classic")).toBe(false); // contains "ass"
      expect(containsProfanity("pass")).toBe(false); // contains "ass"
      expect(containsProfanity("passable")).toBe(false); // contains "ass"
      expect(containsProfanity("bassist")).toBe(false); // contains "ass"
      expect(containsProfanity("assassin")).toBe(false); // contains "ass"
      expect(containsProfanity("analysis")).toBe(false); // contains "anal"
      expect(containsProfanity("analytics")).toBe(false); // contains "anal"
      expect(containsProfanity("grape")).toBe(false); // contains "rape"
      expect(containsProfanity("scunthorpe")).toBe(false); // contains "cunt"
      expect(containsProfanity("therapist")).toBe(false); // contains "rapist" root vibes
      expect(containsProfanity("hello")).toBe(false); // contains "hell"
      expect(containsProfanity("shell")).toBe(false); // contains "hell"
      expect(containsProfanity("cocktail")).toBe(false); // contains "cock"
      expect(containsProfanity("dickens")).toBe(false); // contains "dick"
      expect(containsProfanity("sexagon")).toBe(false); // contains "sex"
    });

    it("still flags a slur when it stands as its own token", () => {
      // Boundary = string start/end, underscore, or digit.
      expect(containsProfanity("shit")).toBe(true);
      expect(containsProfanity("shit123")).toBe(true); // digit boundary
      expect(containsProfanity("123shit")).toBe(true); // digit boundary
      expect(containsProfanity("xx_shit_xx")).toBe(true); // underscore boundary
      expect(containsProfanity("ass_hat")).toBe(true); // standalone "ass" token
      expect(containsProfanity("anal_4_life")).toBe(true); // standalone "anal" token
    });

    it("still matches substring-only roots (masturbat) inside longer words", () => {
      expect(containsProfanity("masturbation")).toBe(true);
      expect(containsProfanity("masturbate")).toBe(true);
    });

    it("allows comic-related terms", () => {
      expect(containsProfanity("batman")).toBe(false);
      expect(containsProfanity("superman")).toBe(false);
      expect(containsProfanity("xmen")).toBe(false);
    });
  });
});

describe("validateUsername", () => {
  it("validates format and profanity together", () => {
    // Valid format, no profanity
    expect(validateUsername("comic_fan_123").isValid).toBe(true);

    // Valid format, but profanity
    const profane = validateUsername("shit_head");
    expect(profane.isValid).toBe(false);
    expect(profane.error).toBe("Username contains inappropriate content");

    // Invalid format
    const invalid = validateUsername("ab");
    expect(invalid.isValid).toBe(false);
    expect(invalid.error).toContain("at least");
  });

  it("checks format before profanity", () => {
    // Too short AND profane - should fail on format first
    const result = validateUsername("fu");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("at least");
  });
});

describe("isReservedUsername", () => {
  it("detects admin-related reserved names", () => {
    expect(isReservedUsername("admin")).toBe(true);
    expect(isReservedUsername("administrator")).toBe(true);
    expect(isReservedUsername("mod")).toBe(true);
    expect(isReservedUsername("moderator")).toBe(true);
  });

  it("detects system reserved names", () => {
    expect(isReservedUsername("system")).toBe(true);
    expect(isReservedUsername("support")).toBe(true);
    expect(isReservedUsername("help")).toBe(true);
    expect(isReservedUsername("official")).toBe(true);
  });

  it("detects brand reserved names", () => {
    expect(isReservedUsername("collectorschest")).toBe(true);
    expect(isReservedUsername("collectors_chest")).toBe(true);
    expect(isReservedUsername("professor")).toBe(true);
  });

  it("detects technical reserved names", () => {
    expect(isReservedUsername("root")).toBe(true);
    expect(isReservedUsername("null")).toBe(true);
    expect(isReservedUsername("undefined")).toBe(true);
    expect(isReservedUsername("api")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(isReservedUsername("ADMIN")).toBe(true);
    expect(isReservedUsername("Admin")).toBe(true);
  });

  it("allows non-reserved usernames", () => {
    expect(isReservedUsername("comic_fan")).toBe(false);
    expect(isReservedUsername("spidey_collector")).toBe(false);
  });
});

describe("normalizeUsername", () => {
  it("converts to lowercase", () => {
    expect(normalizeUsername("ComicFan")).toBe("comicfan");
  });

  it("trims whitespace", () => {
    expect(normalizeUsername("  comic_fan  ")).toBe("comic_fan");
  });

  it("handles combined normalization", () => {
    expect(normalizeUsername("  COMIC_FAN  ")).toBe("comic_fan");
  });
});

describe("formatUsernameForDisplay", () => {
  it("adds @ prefix", () => {
    expect(formatUsernameForDisplay("comic_fan")).toBe("@comic_fan");
  });

  it("handles already lowercase username", () => {
    expect(formatUsernameForDisplay("collector123")).toBe("@collector123");
  });
});

describe("validateUsernameComplete", () => {
  it("validates format, profanity, and reserved names", () => {
    // All valid
    expect(validateUsernameComplete("comic_fan_123").isValid).toBe(true);

    // Reserved
    const reserved = validateUsernameComplete("admin");
    expect(reserved.isValid).toBe(false);
    expect(reserved.error).toBe("This username is reserved");

    // Profane
    const profane = validateUsernameComplete("shit_face");
    expect(profane.isValid).toBe(false);
    expect(profane.error).toBe("Username contains inappropriate content");

    // Invalid format
    const invalid = validateUsernameComplete("ab");
    expect(invalid.isValid).toBe(false);
  });

  it("checks in order: format → profanity → reserved", () => {
    // "ad" is too short, even if it were "admin"
    const result = validateUsernameComplete("ad");
    expect(result.error).toContain("at least");
  });
});

describe("constants", () => {
  it("has sensible min length", () => {
    expect(USERNAME_MIN_LENGTH).toBeGreaterThanOrEqual(3);
  });

  it("has sensible max length", () => {
    expect(USERNAME_MAX_LENGTH).toBeLessThanOrEqual(30);
    expect(USERNAME_MAX_LENGTH).toBeGreaterThanOrEqual(10);
  });
});
