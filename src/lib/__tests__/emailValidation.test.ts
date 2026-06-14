/**
 * @jest-environment node
 *
 * Tests the pure (no-DNS) email validation logic: format checking,
 * disposable-domain detection, normalization, and verification-token
 * generation. The MX-record path in `validateEmail` only runs in production,
 * so under the test env (`NODE_ENV !== "production"`) we exercise the full
 * `validateEmail` flow without hitting DNS.
 */
import {
  generateVerificationToken,
  isDisposableEmail,
  isValidEmailFormat,
  validateEmail,
} from "../emailValidation";

describe("isValidEmailFormat", () => {
  it.each([
    "user@example.com",
    "first.last@sub.domain.co",
    "name+tag@gmail.com",
    "a@b.io",
  ])("accepts well-formed address %s", (email) => {
    expect(isValidEmailFormat(email)).toBe(true);
  });

  it.each([
    "",
    "plainaddress",
    "missing-at.example.com",
    "no-domain@",
    "@no-local.com",
    "spaces in@example.com",
    "two@@example.com",
    "no-tld@example",
  ])("rejects malformed address %s", (email) => {
    expect(isValidEmailFormat(email)).toBe(false);
  });
});

describe("isDisposableEmail", () => {
  it("flags a known disposable domain", () => {
    expect(isDisposableEmail("throwaway@mailinator.com")).toBe(true);
  });

  it("flags newly-added blocklist domains", () => {
    expect(isDisposableEmail("x@sharklasers.com")).toBe(true);
    expect(isDisposableEmail("x@1secmail.com")).toBe(true);
    expect(isDisposableEmail("x@temp-mail.io")).toBe(true);
  });

  it("is case-insensitive on the domain", () => {
    expect(isDisposableEmail("Person@MailInator.COM")).toBe(true);
  });

  it("allows legitimate providers", () => {
    expect(isDisposableEmail("real@gmail.com")).toBe(false);
    expect(isDisposableEmail("user@collectors-chest.com")).toBe(false);
  });

  it("returns false when there is no domain", () => {
    expect(isDisposableEmail("no-domain")).toBe(false);
  });
});

describe("validateEmail (non-production: skips MX lookup)", () => {
  it("normalizes to lowercase and trims whitespace", async () => {
    const result = await validateEmail("  USER@Example.COM  ");
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("user@example.com");
  });

  it("rejects an invalid format with a format error", async () => {
    const result = await validateEmail("not-an-email");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/format/i);
  });

  it("rejects a disposable address with a disposable error", async () => {
    const result = await validateEmail("burner@mailinator.com");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/disposable|permanent/i);
  });

  it("checks format before disposable status", async () => {
    // A disposable domain but malformed local part -> format error wins.
    const result = await validateEmail("bad address@mailinator.com");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/format/i);
  });
});

describe("generateVerificationToken", () => {
  it("returns a 64-char lowercase hex string (32 bytes)", () => {
    const token = generateVerificationToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces unique tokens across calls", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateVerificationToken()));
    expect(tokens.size).toBe(50);
  });
});
