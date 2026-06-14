import { sanitizeCoverImageUrl } from "../coverImageUrlSanitizer";

describe("sanitizeCoverImageUrl", () => {
  describe("passes valid URLs", () => {
    it("returns http URLs unchanged", () => {
      expect(sanitizeCoverImageUrl("http://example.com/cover.jpg")).toBe(
        "http://example.com/cover.jpg",
      );
    });

    it("returns https URLs unchanged", () => {
      expect(sanitizeCoverImageUrl("https://i.ebayimg.com/images/g/abc/s-l500.jpg")).toBe(
        "https://i.ebayimg.com/images/g/abc/s-l500.jpg",
      );
    });

    it("trims whitespace before validation", () => {
      expect(sanitizeCoverImageUrl("  https://example.com/c.jpg  ")).toBe(
        "https://example.com/c.jpg",
      );
    });

    it("accepts URLs at exactly the 2048 char limit", () => {
      const url = "https://example.com/" + "a".repeat(2048 - 20);
      expect(url.length).toBe(2048);
      expect(sanitizeCoverImageUrl(url)).toBe(url);
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
      expect(sanitizeCoverImageUrl("ftp://example.com/cover.jpg")).toBeNull();
    });

    it("returns null for URLs over 2048 chars", () => {
      const url = "https://example.com/" + "a".repeat(2050);
      expect(url.length).toBeGreaterThan(2048);
      expect(sanitizeCoverImageUrl(url)).toBeNull();
    });

    it("returns null for URLs with a suspiciously long query string (signed URL JWT)", () => {
      // Simulated Supabase signed URL with a JWT-stuffed query string
      const longJwt = "a".repeat(1000);
      const url = `https://abc.supabase.co/storage/v1/object/sign/covers/x.jpg?token=${longJwt}`;
      expect(sanitizeCoverImageUrl(url)).toBeNull();
    });

    it("returns null for empty / whitespace-only string", () => {
      expect(sanitizeCoverImageUrl("")).toBeNull();
      expect(sanitizeCoverImageUrl("   ")).toBeNull();
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

    it("still allows public IPs and domains", () => {
      expect(sanitizeCoverImageUrl("http://172.32.0.1/c.jpg")).toBe("http://172.32.0.1/c.jpg");
      expect(sanitizeCoverImageUrl("https://i.ebayimg.com/x.jpg")).toBe("https://i.ebayimg.com/x.jpg");
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
