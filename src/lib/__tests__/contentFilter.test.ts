/**
 * Content Filter Tests
 *
 * Covers the two-layer message content filter:
 *   - BLOCKED patterns (message rejected)
 *   - FLAGGED patterns (message sent but flagged for review)
 *
 * The project mandates tests for content-filter logic (permissions/limits/
 * filtering), so this exercises both happy paths and false-positive edge cases.
 */

import { checkMessageContent, sanitizeContent } from "../contentFilter";

describe("checkMessageContent - BLOCK layer", () => {
  it("blocks phone numbers with dash separators", () => {
    const result = checkMessageContent("Call me at 555-123-4567 tonight");
    expect(result.blocked).toBe(true);
    expect(result.flagged).toBe(false);
    expect(result.reason).toMatch(/phone numbers/i);
  });

  it("blocks phone numbers with parentheses and spaces", () => {
    const result = checkMessageContent("My cell is (555) 123 4567");
    expect(result.blocked).toBe(true);
    expect(result.reason).toMatch(/phone numbers/i);
  });

  it("blocks phone numbers with a country code prefix", () => {
    const result = checkMessageContent("reach me +1 555.123.4567");
    expect(result.blocked).toBe(true);
    expect(result.reason).toMatch(/phone numbers/i);
  });

  it("blocks email addresses", () => {
    const result = checkMessageContent("email me at seller@example.com");
    expect(result.blocked).toBe(true);
    expect(result.reason).toMatch(/email addresses/i);
  });

  it("prioritizes block over flag when both could match", () => {
    // Contains a payment app (flag) AND an email (block) - block wins.
    const result = checkMessageContent("paypal me, then email buyer@test.com");
    expect(result.blocked).toBe(true);
    expect(result.flagged).toBe(false);
  });
});

describe("checkMessageContent - phone-number false positives (M-MS7)", () => {
  it("does NOT block a bare 10-digit run (order/catalog number)", () => {
    // 10 digits with no separators - too ambiguous to BLOCK.
    const result = checkMessageContent("Order number 5551234567 shipped today");
    expect(result.blocked).toBe(false);
  });

  it("downgrades a bare 10-digit run to a FLAG", () => {
    const result = checkMessageContent("ref 5551234567");
    expect(result.flagged).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.reason).toMatch(/contact number/i);
  });

  it("does NOT block a 13-digit ISBN-like number", () => {
    const result = checkMessageContent("ISBN 9781401234567 first print");
    expect(result.blocked).toBe(false);
  });

  it("does NOT block a price like 12345.67", () => {
    const result = checkMessageContent("asking 12345.67 for the slab");
    expect(result.blocked).toBe(false);
  });
});

describe("checkMessageContent - FLAG layer", () => {
  it("flags external payment service mentions", () => {
    const result = checkMessageContent("can you venmo me?");
    expect(result.flagged).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.reason).toMatch(/payment service/i);
  });

  it("flags cash app with a space", () => {
    const result = checkMessageContent("send it on cash app");
    expect(result.flagged).toBe(true);
  });

  it("flags off-platform contact requests", () => {
    const result = checkMessageContent("just text me about it");
    expect(result.flagged).toBe(true);
    expect(result.reason).toMatch(/off-platform/i);
  });

  it("flags urgency followed by a payment request", () => {
    const result = checkMessageContent("urgent: please send money now");
    expect(result.flagged).toBe(true);
  });

  it("flags a payment request followed by urgency", () => {
    const result = checkMessageContent("transfer the funds asap");
    expect(result.flagged).toBe(true);
  });
});

describe("checkMessageContent - clean content", () => {
  it("passes a normal marketplace message", () => {
    const result = checkMessageContent("Is this CGC 9.8 still available? I can pay full price.");
    expect(result.blocked).toBe(false);
    expect(result.flagged).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it("passes an empty string", () => {
    const result = checkMessageContent("");
    expect(result.blocked).toBe(false);
    expect(result.flagged).toBe(false);
  });
});

describe("sanitizeContent", () => {
  it("trims surrounding whitespace", () => {
    expect(sanitizeContent("  hello  ")).toBe("hello");
  });

  it("leaves clean content unchanged", () => {
    expect(sanitizeContent("clean")).toBe("clean");
  });
});
