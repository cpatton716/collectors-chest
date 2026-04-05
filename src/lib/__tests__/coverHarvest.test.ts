// Mock heavy imports to prevent ESM/transitive-dep failures in Jest
jest.mock("sharp", () => jest.fn());
jest.mock("../supabase", () => ({ supabaseAdmin: { storage: { from: jest.fn() } } }));
jest.mock("../coverImageDb", () => ({
  getCommunityCovers: jest.fn(),
  submitCoverImage: jest.fn(),
}));

import {
  validateCropCoordinates,
  applyInsetPadding,
  isValidAspectRatio,
  meetsMinimumDimensions,
  shouldHarvest,
  SYSTEM_HARVEST_PROFILE_ID,
} from "../coverHarvest";

describe("coverHarvest", () => {
  describe("SYSTEM_HARVEST_PROFILE_ID", () => {
    it("is the expected sentinel UUID", () => {
      expect(SYSTEM_HARVEST_PROFILE_ID).toBe("00000000-0000-0000-0000-000000000001");
    });
  });

  describe("validateCropCoordinates", () => {
    const imageWidth = 800;
    const imageHeight = 1200;

    it("accepts valid coordinates", () => {
      const result = validateCropCoordinates(
        { x: 50, y: 100, width: 400, height: 600 },
        imageWidth,
        imageHeight
      );
      expect(result.valid).toBe(true);
    });

    it("rejects coordinates outside image bounds (x + width overflow)", () => {
      const result = validateCropCoordinates(
        { x: 500, y: 100, width: 400, height: 600 },
        imageWidth,
        imageHeight
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("bounds");
    });

    it("rejects coordinates outside image bounds (y + height overflow)", () => {
      const result = validateCropCoordinates(
        { x: 50, y: 800, width: 400, height: 600 },
        imageWidth,
        imageHeight
      );
      expect(result.valid).toBe(false);
    });

    it("rejects negative values", () => {
      const result = validateCropCoordinates(
        { x: -10, y: 100, width: 400, height: 600 },
        imageWidth,
        imageHeight
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("negative");
    });

    it("rejects NaN values", () => {
      const result = validateCropCoordinates(
        { x: NaN, y: 100, width: 400, height: 600 },
        imageWidth,
        imageHeight
      );
      expect(result.valid).toBe(false);
    });

    it("rejects crop area > 90% of original", () => {
      const result = validateCropCoordinates(
        { x: 0, y: 0, width: 790, height: 1190 },
        imageWidth,
        imageHeight
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("90%");
    });
  });

  describe("applyInsetPadding", () => {
    it("shrinks crop by 4% on each edge", () => {
      const result = applyInsetPadding({ x: 100, y: 200, width: 400, height: 600 });
      expect(result.x).toBe(116);
      expect(result.y).toBe(224);
      expect(result.width).toBe(368);
      expect(result.height).toBe(552);
    });

    it("returns dimensions that could go below minimums for small crops", () => {
      const result = applyInsetPadding({ x: 0, y: 0, width: 104, height: 156 });
      expect(result.width).toBeLessThan(100);
    });
  });

  describe("isValidAspectRatio", () => {
    it("accepts ~2:3 ratio (0.67)", () => {
      expect(isValidAspectRatio(400, 600)).toBe(true);
    });

    it("accepts lower bound (0.55)", () => {
      expect(isValidAspectRatio(275, 500)).toBe(true);
    });

    it("accepts upper bound (0.80)", () => {
      expect(isValidAspectRatio(400, 500)).toBe(true);
    });

    it("rejects square ratio (1.0)", () => {
      expect(isValidAspectRatio(500, 500)).toBe(false);
    });

    it("rejects landscape ratio (1.5)", () => {
      expect(isValidAspectRatio(600, 400)).toBe(false);
    });

    it("rejects zero height", () => {
      expect(isValidAspectRatio(400, 0)).toBe(false);
    });
  });

  describe("meetsMinimumDimensions", () => {
    it("accepts valid dimensions", () => {
      expect(meetsMinimumDimensions(400, 600)).toBe(true);
    });

    it("rejects width below 100", () => {
      expect(meetsMinimumDimensions(99, 600)).toBe(false);
    });

    it("rejects height below 150", () => {
      expect(meetsMinimumDimensions(400, 149)).toBe(false);
    });

    it("accepts exact minimums", () => {
      expect(meetsMinimumDimensions(100, 150)).toBe(true);
    });
  });

  describe("shouldHarvest", () => {
    const validParams = {
      isSlabbed: true,
      coverHarvestable: true,
      coverCropCoordinates: { x: 50, y: 100, width: 400, height: 600 },
      isAuthenticated: true,
    };

    it("returns eligible for valid params", () => {
      expect(shouldHarvest(validParams).eligible).toBe(true);
    });

    it("rejects guest users", () => {
      const result = shouldHarvest({ ...validParams, isAuthenticated: false });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("guest user");
    });

    it("rejects non-slabbed books", () => {
      const result = shouldHarvest({ ...validParams, isSlabbed: false });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("not slabbed");
    });

    it("rejects when coverHarvestable is false", () => {
      const result = shouldHarvest({ ...validParams, coverHarvestable: false });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("not harvestable");
    });

    it("rejects when coverHarvestable is undefined", () => {
      const result = shouldHarvest({ ...validParams, coverHarvestable: undefined });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("not harvestable");
    });

    it("rejects when coordinates are missing", () => {
      const result = shouldHarvest({ ...validParams, coverCropCoordinates: undefined });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("no crop coordinates");
    });
  });
});
