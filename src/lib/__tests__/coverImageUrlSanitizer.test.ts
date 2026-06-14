import { sanitizeCoverImageUrl } from "../coverImageUrlSanitizer";

// jest.setup.js sets NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co",
// so the Supabase storage allowlist host under test is "test.supabase.co".
const SUPABASE_HOST = "test.supabase.co";

describe("sanitizeCoverImageUrl", () => {
  describe("passes valid allowlisted URLs", () => {
    it("returns https eBay URLs unchanged", () => {
      expect(sanitizeCoverImageUrl("https://i.ebayimg.com/images/g/abc/s-l500.jpg")).toBe(
        "https://i.ebayimg.com/images/g/abc/s-l500.jpg",
      );
    });

    it("returns http eBay URLs unchanged (non-production)", () => {
      expect(sanitizeCoverImageUrl("http://i.ebayimg.com/cover.jpg")).toBe(
        "http://i.ebayimg.com/cover.jpg",
      );
    });

    it("trims whitespace before validation", () => {
      expect(sanitizeCoverImageUrl("  https://i.ebayimg.com/c.jpg  ")).toBe(
        "https://i.ebayimg.com/c.jpg",
      );
    });

    it("accepts URLs at exactly the 2048 char limit", () => {
      const base = `https://${SUPABASE_HOST}/`;
      const url = base + "a".repeat(2048 - base.length);
      expect(url.length).toBe(2048);
      expect(sanitizeCoverImageUrl(url)).toBe(url);
    });
  });

  describe("host allowlist", () => {
    it("allows the Supabase storage host (from NEXT_PUBLIC_SUPABASE_URL)", () => {
      const url = `https://${SUPABASE_HOST}/storage/v1/object/public/comic-covers/a.jpg`;
      expect(sanitizeCoverImageUrl(url)).toBe(url);
    });

    it("allows i.ebayimg.com", () => {
      expect(sanitizeCoverImageUrl("https://i.ebayimg.com/x.jpg")).toBe(
        "https://i.ebayimg.com/x.jpg",
      );
    });

    it("allows img.clerk.com", () => {
      expect(sanitizeCoverImageUrl("https://img.clerk.com/avatar.png")).toBe(
        "https://img.clerk.com/avatar.png",
      );
    });

    it("allows covers.openlibrary.org", () => {
      expect(sanitizeCoverImageUrl("https://covers.openlibrary.org/b/id/123-L.jpg")).toBe(
        "https://covers.openlibrary.org/b/id/123-L.jpg",
      );
    });

    it("rejects arbitrary public hosts not on the allowlist", () => {
      expect(sanitizeCoverImageUrl("https://example.com/cover.jpg")).toBeNull();
      expect(sanitizeCoverImageUrl("https://evil.com/cover.jpg")).toBeNull();
      expect(sanitizeCoverImageUrl("https://cdn.imgur.com/cover.jpg")).toBeNull();
    });

    it("rejects public IPs (not on the allowlist)", () => {
      expect(sanitizeCoverImageUrl("https://172.32.0.1/c.jpg")).toBeNull();
      expect(sanitizeCoverImageUrl("https://8.8.8.8/c.jpg")).toBeNull();
    });

    it("rejects look-alike subdomains of allowlisted hosts", () => {
      expect(sanitizeCoverImageUrl("https://i.ebayimg.com.evil.com/x.jpg")).toBeNull();
      expect(sanitizeCoverImageUrl("https://evil-i.ebayimg.com/x.jpg")).toBeNull();
      expect(sanitizeCoverImageUrl(`https://${SUPABASE_HOST}.evil.com/x.jpg`)).toBeNull();
    });
  });

  describe("rejects dirty values", () => {
    it("returns null for data: URIs", () => {
      expect(sanitizeCoverImageUrl("data:image/png;base64,iVBORw0KGgo=")).toBeNull();
    });

    it("returns null for relative URLs", () => {
      expect(sanitizeCoverImageUrl("/covers/abc.jpg")).toBeNull();
    });

    it("returns null for ftp:// URLs", () => {
      expect(sanitizeCoverImageUrl("ftp://i.ebayimg.com/cover.jpg")).toBeNull();
    });

    it("returns null for URLs over 2048 chars", () => {
      const url = "https://i.ebayimg.com/" + "a".repeat(2050);
      expect(url.length).toBeGreaterThan(2048);
      expect(sanitizeCoverImageUrl(url)).toBeNull();
    });

    it("returns null for URLs with a suspiciously long query string (signed URL JWT)", () => {
      // Simulated Supabase signed URL with a JWT-stuffed query string
      const longJwt = "a".repeat(1000);
      const url = `https://${SUPABASE_HOST}/storage/v1/object/sign/covers/x.jpg?token=${longJwt}`;
      expect(sanitizeCoverImageUrl(url)).toBeNull();
    });

    it("returns null for empty / whitespace-only string", () => {
      expect(sanitizeCoverImageUrl("")).toBeNull();
      expect(sanitizeCoverImageUrl("   ")).toBeNull();
    });
  });

  describe("rejects non-https in production", () => {
    const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

    afterEach(() => {
      Object.defineProperty(process.env, "NODE_ENV", {
        value: ORIGINAL_NODE_ENV,
        configurable: true,
      });
    });

    it("rejects http:// (even allowlisted host) when NODE_ENV=production", () => {
      Object.defineProperty(process.env, "NODE_ENV", {
        value: "production",
        configurable: true,
      });
      expect(sanitizeCoverImageUrl("http://i.ebayimg.com/cover.jpg")).toBeNull();
    });

    it("still allows https on an allowlisted host in production", () => {
      Object.defineProperty(process.env, "NODE_ENV", {
        value: "production",
        configurable: true,
      });
      expect(sanitizeCoverImageUrl("https://i.ebayimg.com/cover.jpg")).toBe(
        "https://i.ebayimg.com/cover.jpg",
      );
    });
  });

  describe("rejects private / SSRF-risk hosts", () => {
    it("returns null for localhost", () => {
      expect(sanitizeCoverImageUrl("http://localhost/cover.jpg")).toBeNull();
      expect(sanitizeCoverImageUrl("http://localhost:3000/cover.jpg")).toBeNull();
      expect(sanitizeCoverImageUrl("https://api.localhost/cover.jpg")).toBeNull();
    });

    it("returns null for loopback IPv4", () => {
      expect(sanitizeCoverImageUrl("http://127.0.0.1/cover.jpg")).toBeNull();
      expect(sanitizeCoverImageUrl("http://127.1.2.3/cover.jpg")).toBeNull();
    });

    it("returns null for private network ranges", () => {
      expect(sanitizeCoverImageUrl("http://10.0.0.5/c.jpg")).toBeNull();
      expect(sanitizeCoverImageUrl("http://192.168.1.10/c.jpg")).toBeNull();
      expect(sanitizeCoverImageUrl("http://172.16.0.1/c.jpg")).toBeNull();
      expect(sanitizeCoverImageUrl("http://172.31.255.255/c.jpg")).toBeNull();
    });

    it("returns null for cloud metadata link-local address", () => {
      expect(sanitizeCoverImageUrl("http://169.254.169.254/latest/meta-data/")).toBeNull();
    });

    it("returns null for bare hostnames with no public dot", () => {
      expect(sanitizeCoverImageUrl("http://metadata/cover.jpg")).toBeNull();
    });
  });

  describe("passes through null/undefined", () => {
    it("returns null for null", () => {
      expect(sanitizeCoverImageUrl(null)).toBeNull();
    });

    it("returns null for undefined", () => {
      expect(sanitizeCoverImageUrl(undefined)).toBeNull();
    });
  });
});
