import {
  validateCoverCrop,
  COMIC_ASPECT_RATIO_MIN,
  COMIC_ASPECT_RATIO_MAX,
} from "../coverCropValidator";

describe("coverCropValidator", () => {
  describe("validateCoverCrop — happy path", () => {
    it("accepts a standard comic cover (400x600, ratio ~0.67)", () => {
      const result = validateCoverCrop({ x: 0, y: 0, width: 400, height: 600 });
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.aspectRatio).toBeCloseTo(0.6667, 3);
    });

    it("accepts a tall-ish comic crop near the narrow end (ratio ~0.60)", () => {
      const result = validateCoverCrop({ x: 0, y: 0, width: 300, height: 500 });
      expect(result.valid).toBe(true);
      expect(result.aspectRatio).toBeCloseTo(0.6, 3);
    });

    it("accepts a slightly wide slab-through-plastic crop (ratio ~0.75)", () => {
      const result = validateCoverCrop({ x: 0, y: 0, width: 450, height: 600 });
      expect(result.valid).toBe(true);
      expect(result.aspectRatio).toBeCloseTo(0.75, 3);
    });
  });

  describe("validateCoverCrop — aspect ratio rejects", () => {
    it("rejects a narrow horizontal strip (grade-label style, 400x100, ratio 4.0) as too wide", () => {
      const result = validateCoverCrop({ x: 0, y: 0, width: 400, height: 100 });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("too wide");
      expect(result.reason).toContain("grading label");
      expect(result.aspectRatio).toBe(4);
    });

    it("rejects a square region (400x400, ratio 1.0) as too wide", () => {
      const result = validateCoverCrop({ x: 0, y: 0, width: 400, height: 400 });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("too wide");
      expect(result.aspectRatio).toBe(1);
    });

    it("rejects a full-slab crop (400x800, ratio 0.5) as too narrow", () => {
      const result = validateCoverCrop({ x: 0, y: 0, width: 400, height: 800 });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("too narrow");
      expect(result.reason).toContain("slab");
      expect(result.aspectRatio).toBe(0.5);
    });
  });

  describe("validateCoverCrop — degenerate inputs", () => {
    it("rejects zero width", () => {
      const result = validateCoverCrop({ x: 0, y: 0, width: 0, height: 600 });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Non-positive");
      expect(result.aspectRatio).toBe(0);
    });

    it("rejects zero height", () => {
      const result = validateCoverCrop({ x: 0, y: 0, width: 400, height: 0 });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Non-positive");
      expect(result.aspectRatio).toBe(0);
    });

    it("rejects negative width", () => {
      const result = validateCoverCrop({
        x: 0,
        y: 0,
        width: -100,
        height: 600,
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Non-positive");
    });

    it("rejects non-finite values (NaN)", () => {
      const result = validateCoverCrop({
        x: 0,
        y: 0,
        width: NaN,
        height: 600,
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("finite");
      expect(result.aspectRatio).toBe(0);
    });

    it("rejects non-finite values (Infinity)", () => {
      const result = validateCoverCrop({
        x: 0,
        y: 0,
        width: Infinity,
        height: 600,
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("finite");
    });
  });

  describe("validateCoverCrop — threshold boundaries", () => {
    it("accepts exactly at COMIC_ASPECT_RATIO_MIN (0.55)", () => {
      // 550/1000 = 0.55 exactly
      const result = validateCoverCrop({
        x: 0,
        y: 0,
        width: 550,
        height: 1000,
      });
      expect(result.valid).toBe(true);
      expect(result.aspectRatio).toBeCloseTo(COMIC_ASPECT_RATIO_MIN, 5);
    });

    it("accepts exactly at COMIC_ASPECT_RATIO_MAX (0.85)", () => {
      // 850/1000 = 0.85 exactly
      const result = validateCoverCrop({
        x: 0,
        y: 0,
        width: 850,
        height: 1000,
      });
      expect(result.valid).toBe(true);
      expect(result.aspectRatio).toBeCloseTo(COMIC_ASPECT_RATIO_MAX, 5);
    });

    it("rejects just below min (ratio 0.549)", () => {
      // 549/1000 = 0.549
      const result = validateCoverCrop({
        x: 0,
        y: 0,
        width: 549,
        height: 1000,
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("too narrow");
    });

    it("rejects just above max (ratio 0.851)", () => {
      // 851/1000 = 0.851
      const result = validateCoverCrop({
        x: 0,
        y: 0,
        width: 851,
        height: 1000,
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("too wide");
    });
  });

  describe("constants", () => {
    it("exposes sane min/max thresholds", () => {
      expect(COMIC_ASPECT_RATIO_MIN).toBeLessThan(COMIC_ASPECT_RATIO_MAX);
      // Standard comic ratio (~0.66) must fall inside the window
      expect(COMIC_ASPECT_RATIO_MIN).toBeLessThanOrEqual(0.66);
      expect(COMIC_ASPECT_RATIO_MAX).toBeGreaterThanOrEqual(0.66);
    });
  });
});
