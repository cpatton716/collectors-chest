/**
 * @jest-environment node
 *
 * Security test for the email HTML escaper (H-EM1). User-controlled strings
 * (comic titles, display names, message previews, failure reasons) are
 * interpolated into email HTML, so the escaper must neutralize markup/script
 * to prevent injection in webmail clients.
 */

// Mock Resend so importing email.ts doesn't construct a live client.
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ data: { id: "x" }, error: null }) },
    batch: { send: jest.fn().mockResolvedValue({ data: null, error: null }) },
  })),
}));

import { escapeHtml } from "../email";

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml("&")).toBe("&amp;");
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml(">")).toBe("&gt;");
    expect(escapeHtml('"')).toBe("&quot;");
    expect(escapeHtml("'")).toBe("&#39;");
  });

  it("neutralizes a script-tag injection payload", () => {
    const out = escapeHtml('<script>alert("xss")</script>');
    expect(out).not.toContain("<script>");
    expect(out).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
  });

  it("neutralizes an attribute-breakout payload", () => {
    // Would otherwise close an href="" and inject an event handler.
    const out = escapeHtml('" onmouseover="alert(1)');
    expect(out).not.toContain('"');
    expect(out).toBe("&quot; onmouseover=&quot;alert(1)");
  });

  it("escapes ampersand first to avoid double-encoding entities", () => {
    expect(escapeHtml("Tom & <Jerry>")).toBe("Tom &amp; &lt;Jerry&gt;");
    // The '&' from the '<' replacement must NOT be re-escaped.
    expect(escapeHtml("<")).toBe("&lt;");
  });

  it("leaves benign text untouched", () => {
    expect(escapeHtml("Amazing Spider-Man #300")).toBe("Amazing Spider-Man #300");
  });

  it("coerces numbers to their string form", () => {
    expect(escapeHtml(42)).toBe("42");
    expect(escapeHtml(0)).toBe("0");
  });

  it("returns an empty string for null/undefined", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("escapes every occurrence, not just the first", () => {
    expect(escapeHtml("<<>>")).toBe("&lt;&lt;&gt;&gt;");
  });
});
