import {
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_LABEL,
  PAYLOAD_TOO_LARGE_CODE,
  PayloadTooLargeError,
  assertImageSize,
  base64DecodedByteLength,
  isWithinImageUploadLimit,
} from "../uploadLimits";

describe("uploadLimits", () => {
  describe("assertImageSize", () => {
    it("passes when size is well below the limit", () => {
      expect(() => assertImageSize(1024)).not.toThrow();
    });

    it("passes at exactly the limit (boundary condition)", () => {
      expect(() => assertImageSize(MAX_IMAGE_UPLOAD_BYTES)).not.toThrow();
    });

    it("passes when size is 0", () => {
      expect(() => assertImageSize(0)).not.toThrow();
    });

    it("throws when size is one byte over the limit", () => {
      expect(() => assertImageSize(MAX_IMAGE_UPLOAD_BYTES + 1)).toThrow(
        PayloadTooLargeError
      );
    });

    it("throws with the PAYLOAD_TOO_LARGE code", () => {
      try {
        assertImageSize(MAX_IMAGE_UPLOAD_BYTES + 1);
        fail("expected assertImageSize to throw");
      } catch (err) {
        expect(err).toBeInstanceOf(PayloadTooLargeError);
        expect((err as PayloadTooLargeError).code).toBe(PAYLOAD_TOO_LARGE_CODE);
      }
    });

    it("includes the human-readable limit in the message", () => {
      try {
        assertImageSize(MAX_IMAGE_UPLOAD_BYTES + 1);
        fail("expected assertImageSize to throw");
      } catch (err) {
        expect((err as Error).message).toContain(MAX_IMAGE_UPLOAD_LABEL);
      }
    });

    it("uses the provided label in the error message", () => {
      try {
        assertImageSize(MAX_IMAGE_UPLOAD_BYTES + 1, "Scan image");
        fail("expected assertImageSize to throw");
      } catch (err) {
        expect((err as Error).message).toMatch(/^Scan image is too large/);
      }
    });

    it("defaults label to 'Image' when not provided", () => {
      try {
        assertImageSize(MAX_IMAGE_UPLOAD_BYTES + 1);
        fail("expected assertImageSize to throw");
      } catch (err) {
        expect((err as Error).message).toMatch(/^Image is too large/);
      }
    });

    it("records the offending size on the error", () => {
      const offending = MAX_IMAGE_UPLOAD_BYTES + 12345;
      try {
        assertImageSize(offending);
        fail("expected assertImageSize to throw");
      } catch (err) {
        expect((err as PayloadTooLargeError).sizeBytes).toBe(offending);
      }
    });
  });

  describe("isWithinImageUploadLimit", () => {
    it("returns true below the limit", () => {
      expect(isWithinImageUploadLimit(1024)).toBe(true);
    });

    it("returns true at exactly the limit", () => {
      expect(isWithinImageUploadLimit(MAX_IMAGE_UPLOAD_BYTES)).toBe(true);
    });

    it("returns false above the limit", () => {
      expect(isWithinImageUploadLimit(MAX_IMAGE_UPLOAD_BYTES + 1)).toBe(false);
    });
  });

  describe("base64DecodedByteLength", () => {
    it("returns 0 for an empty string", () => {
      expect(base64DecodedByteLength("")).toBe(0);
    });

    it("decodes simple base64 to the correct byte length", () => {
      // "hello" => "aGVsbG8=" (5 bytes decoded)
      expect(base64DecodedByteLength("aGVsbG8=")).toBe(5);
    });

    it("strips a data URL prefix before measuring", () => {
      const bare = "aGVsbG8=";
      const withPrefix = `data:image/png;base64,${bare}`;
      expect(base64DecodedByteLength(withPrefix)).toBe(
        base64DecodedByteLength(bare)
      );
    });

    it("returns decoded length that is smaller than the base64 string length", () => {
      // Base64 encoding inflates by ~4/3
      const payload = Buffer.alloc(1000, 0x41).toString("base64");
      const decoded = base64DecodedByteLength(payload);
      expect(decoded).toBe(1000);
      expect(decoded).toBeLessThan(payload.length);
    });
  });

  describe("constants", () => {
    it("exposes 10MB as the upload cap", () => {
      expect(MAX_IMAGE_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
    });

    it("exposes a human-readable 10MB label", () => {
      expect(MAX_IMAGE_UPLOAD_LABEL).toBe("10MB");
    });
  });
});
