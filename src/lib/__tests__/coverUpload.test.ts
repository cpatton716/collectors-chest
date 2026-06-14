/**
 * @jest-environment node
 */
import sharp from "sharp";

import {
  COVER_WEBP_QUALITY,
  MAX_COVER_DIMENSION,
  convertCoverToWebp,
  sniffImageFormat,
} from "@/app/api/comics/upload-cover/route";

// Minimal valid signature byte sequences (padded to >= 12 bytes).
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);
const GIF = Buffer.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0,
]);
const WEBP = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
]);

describe("sniffImageFormat", () => {
  it("detects JPEG by magic bytes", () => {
    expect(sniffImageFormat(JPEG)).toBe("jpeg");
  });
  it("detects PNG by magic bytes", () => {
    expect(sniffImageFormat(PNG)).toBe("png");
  });
  it("detects GIF by magic bytes", () => {
    expect(sniffImageFormat(GIF)).toBe("gif");
  });
  it("detects WebP by RIFF/WEBP markers", () => {
    expect(sniffImageFormat(WEBP)).toBe("webp");
  });
  it("rejects buffers shorter than 12 bytes", () => {
    expect(sniffImageFormat(Buffer.from([0xff, 0xd8, 0xff]))).toBeNull();
  });
  it("rejects non-image content (e.g. an HTML/script payload)", () => {
    const html = Buffer.from("<script>alert(1)</script><!--padding-->");
    expect(sniffImageFormat(html)).toBeNull();
  });
  it("rejects a PDF disguised with an image extension", () => {
    const pdf = Buffer.from("%PDF-1.7\n%more bytes here");
    expect(sniffImageFormat(pdf)).toBeNull();
  });
});

describe("convertCoverToWebp", () => {
  it("converts a PNG source to a WebP buffer", async () => {
    const source = await sharp({
      create: {
        width: 200,
        height: 300,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .png()
      .toBuffer();

    const out = await convertCoverToWebp(source);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(300);
  });

  it("downscales oversized images so the longest edge fits the cap", async () => {
    const source = await sharp({
      create: {
        width: MAX_COVER_DIMENSION * 2,
        height: MAX_COVER_DIMENSION,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .jpeg()
      .toBuffer();

    const out = await convertCoverToWebp(source);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(MAX_COVER_DIMENSION);
    // Aspect ratio preserved (2:1).
    expect(meta.width).toBe(MAX_COVER_DIMENSION);
    expect(meta.height).toBe(MAX_COVER_DIMENSION / 2);
  });

  it("never upscales images smaller than the cap", async () => {
    const source = await sharp({
      create: { width: 50, height: 75, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png()
      .toBuffer();

    const out = await convertCoverToWebp(source);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(50);
    expect(meta.height).toBe(75);
  });

  it("uses a sane WebP quality constant", () => {
    expect(COVER_WEBP_QUALITY).toBeGreaterThanOrEqual(70);
    expect(COVER_WEBP_QUALITY).toBeLessThanOrEqual(90);
  });
});
