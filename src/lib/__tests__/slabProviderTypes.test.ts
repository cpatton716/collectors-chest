import type { SlabDetectionResult, SlabDetailExtractionResult } from "@/lib/providers/types";

describe("SlabDetectionResult shape", () => {
  it("parses a CGC slab detection response", () => {
    const result: SlabDetectionResult = JSON.parse('{"isSlabbed":true,"gradingCompany":"CGC","certificationNumber":"3809701007"}');
    expect(result.isSlabbed).toBe(true);
    expect(result.gradingCompany).toBe("CGC");
    expect(result.certificationNumber).toBe("3809701007");
  });
  it("parses a CBCS response", () => {
    const result: SlabDetectionResult = JSON.parse('{"isSlabbed":true,"gradingCompany":"CBCS","certificationNumber":"1234567"}');
    expect(result.gradingCompany).toBe("CBCS");
  });
  it("parses a PGX response", () => {
    const result: SlabDetectionResult = JSON.parse('{"isSlabbed":true,"gradingCompany":"PGX","certificationNumber":"9876543"}');
    expect(result.gradingCompany).toBe("PGX");
  });
  it("parses non-slabbed response", () => {
    const result: SlabDetectionResult = JSON.parse('{"isSlabbed":false,"gradingCompany":null,"certificationNumber":null}');
    expect(result.isSlabbed).toBe(false);
    expect(result.gradingCompany).toBeNull();
  });
  it("handles slab with missing cert number", () => {
    const result: SlabDetectionResult = JSON.parse('{"isSlabbed":true,"gradingCompany":"CGC","certificationNumber":null}');
    expect(result.isSlabbed).toBe(true);
    expect(result.certificationNumber).toBeNull();
  });
});

describe("SlabDetailExtractionResult shape", () => {
  it("parses full extraction response", () => {
    const result: SlabDetailExtractionResult = JSON.parse(JSON.stringify({
      barcode: { raw: "75960608936802211", confidence: "medium" },
      coverHarvestable: true,
      coverCropCoordinates: { x: 120, y: 280, width: 450, height: 680 },
      writer: "Greg Pak", coverArtist: "Stonehouse", interiorArtist: "Robert Gill",
    }));
    expect(result.barcode?.raw).toBe("75960608936802211");
    expect(result.coverHarvestable).toBe(true);
    expect(result.writer).toBe("Greg Pak");
  });
  it("parses response with no barcode", () => {
    const result: SlabDetailExtractionResult = JSON.parse(JSON.stringify({
      barcode: { raw: null, confidence: "low" }, coverHarvestable: true,
      coverCropCoordinates: { x: 100, y: 200, width: 400, height: 600 },
      writer: "Todd McFarlane", coverArtist: "Todd McFarlane", interiorArtist: "Todd McFarlane",
    }));
    expect(result.barcode?.raw).toBeNull();
  });
  it("parses cover-harvest-only response (Phase 5.5)", () => {
    const result: SlabDetailExtractionResult = JSON.parse(JSON.stringify({
      barcode: { raw: null, confidence: "low" }, coverHarvestable: true,
      coverCropCoordinates: { x: 50, y: 100, width: 500, height: 700 },
      writer: null, coverArtist: null, interiorArtist: null,
    }));
    expect(result.coverHarvestable).toBe(true);
    expect(result.writer).toBeNull();
  });
  it("parses non-harvestable response", () => {
    const result: SlabDetailExtractionResult = JSON.parse(JSON.stringify({
      barcode: { raw: null, confidence: "low" }, coverHarvestable: false,
      coverCropCoordinates: null, writer: null, coverArtist: null, interiorArtist: null,
    }));
    expect(result.coverHarvestable).toBe(false);
    expect(result.coverCropCoordinates).toBeNull();
  });
  it("has no barcodeNumber field", () => {
    const result = JSON.parse(JSON.stringify({
      barcode: { raw: "12345678901234", confidence: "high" },
      coverHarvestable: false, coverCropCoordinates: null,
      writer: null, coverArtist: null, interiorArtist: null,
    }));
    expect(result).not.toHaveProperty("barcodeNumber");
  });
});
