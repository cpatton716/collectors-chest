import {
  estimateBase64Size,
  formatBytes,
  canEncodeWebp,
} from "../imageOptimization";

describe("estimateBase64Size", () => {
  it("computes decoded byte size from a data URL (strips prefix)", () => {
    // "AAAA" base64 (4 chars) -> 3 bytes decoded
    const dataUrl = "data:image/webp;base64,AAAA";
    expect(estimateBase64Size(dataUrl)).toBe(3);
  });

  it("handles a bare base64 string with no data URL prefix", () => {
    // 8 base64 chars -> 6 bytes
    expect(estimateBase64Size("AAAAAAAA")).toBe(6);
  });

  it("scales roughly 3/4 of the base64 character length", () => {
    const base64 = "A".repeat(1000);
    expect(estimateBase64Size(`data:image/jpeg;base64,${base64}`)).toBe(750);
  });
});

describe("formatBytes", () => {
  it("formats zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes, KB, MB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1024 * 1024)).toBe("1 MB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });
});

describe("canEncodeWebp", () => {
  it("returns a boolean and is stable across calls (memoized)", () => {
    const first = canEncodeWebp();
    expect(typeof first).toBe("boolean");
    // jsdom canvas does not encode WebP, so the JPEG fallback path is exercised.
    expect(canEncodeWebp()).toBe(first);
  });
});
