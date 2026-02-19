import {
  mergeMetadataIntoDetails,
  buildMetadataSavePayload,
} from "../metadataCache";

describe("metadataCache helpers", () => {
  describe("mergeMetadataIntoDetails", () => {
    const fullMetadata = {
      id: "uuid-123",
      title: "Amazing Spider-Man",
      issueNumber: "300",
      publisher: "Marvel",
      releaseYear: "1988",
      writer: "David Michelinie",
      coverArtist: "Todd McFarlane",
      interiorArtist: "Todd McFarlane",
      coverImageUrl: "https://example.com/cover.jpg",
      keyInfo: ["First appearance of Venom"],
      priceData: { fmv: 500 },
      lookupCount: 5,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-02-01T00:00:00Z",
    };

    it("fills empty fields from cached metadata", () => {
      const details: Record<string, unknown> = {
        title: "Amazing Spider-Man",
        issueNumber: "300",
      };
      const result = mergeMetadataIntoDetails(details, fullMetadata);

      expect(result.publisher).toBe("Marvel");
      expect(result.releaseYear).toBe("1988");
      expect(result.writer).toBe("David Michelinie");
      expect(result.coverArtist).toBe("Todd McFarlane");
      expect(result.interiorArtist).toBe("Todd McFarlane");
      expect(result.keyInfo).toEqual(["First appearance of Venom"]);
    });

    it("never overwrites existing fields", () => {
      const details: Record<string, unknown> = {
        title: "Amazing Spider-Man",
        issueNumber: "300",
        publisher: "DC Comics",
        releaseYear: "2000",
        writer: "Someone Else",
        coverArtist: "Another Artist",
        interiorArtist: "Yet Another",
        keyInfo: ["Custom key info"],
      };
      const result = mergeMetadataIntoDetails(details, fullMetadata);

      expect(result.publisher).toBe("DC Comics");
      expect(result.releaseYear).toBe("2000");
      expect(result.writer).toBe("Someone Else");
      expect(result.coverArtist).toBe("Another Artist");
      expect(result.interiorArtist).toBe("Yet Another");
      expect(result.keyInfo).toEqual(["Custom key info"]);
    });

    it("fills keyInfo only when details has none", () => {
      const details: Record<string, unknown> = {
        title: "Amazing Spider-Man",
        issueNumber: "300",
      };
      const result = mergeMetadataIntoDetails(details, fullMetadata);

      expect(result.keyInfo).toEqual(["First appearance of Venom"]);
    });

    it("fills keyInfo from cache when details has empty array", () => {
      const details: Record<string, unknown> = {
        title: "Amazing Spider-Man",
        issueNumber: "300",
        keyInfo: [],
      };
      const result = mergeMetadataIntoDetails(details, fullMetadata);

      expect(result.keyInfo).toEqual(["First appearance of Venom"]);
    });

    it("returns details unchanged when metadata is null", () => {
      const details: Record<string, unknown> = {
        title: "Amazing Spider-Man",
        issueNumber: "300",
        publisher: "Marvel",
      };
      const result = mergeMetadataIntoDetails(details, null);

      expect(result).toBe(details);
      expect(result.publisher).toBe("Marvel");
      expect(result.writer).toBeUndefined();
    });

    it("does not add extra properties (id, lookupCount, etc.) from metadata", () => {
      const details: Record<string, unknown> = {
        title: "Amazing Spider-Man",
        issueNumber: "300",
      };
      const result = mergeMetadataIntoDetails(details, fullMetadata);

      expect(result.id).toBeUndefined();
      expect(result.lookupCount).toBeUndefined();
      expect(result.createdAt).toBeUndefined();
      expect(result.updatedAt).toBeUndefined();
      expect(result.coverImageUrl).toBeUndefined();
      expect(result.priceData).toBeUndefined();
    });
  });

  describe("buildMetadataSavePayload", () => {
    it("extracts saveable fields from comicDetails", () => {
      const details: Record<string, unknown> = {
        title: "Amazing Spider-Man",
        issueNumber: "300",
        publisher: "Marvel",
        releaseYear: "1988",
        writer: "David Michelinie",
        coverArtist: "Todd McFarlane",
        interiorArtist: "Todd McFarlane",
        keyInfo: ["First appearance of Venom"],
        grade: "9.4",
        priceData: { fmv: 500 },
      };
      const result = buildMetadataSavePayload(details);

      expect(result).toEqual({
        title: "Amazing Spider-Man",
        issueNumber: "300",
        publisher: "Marvel",
        releaseYear: "1988",
        writer: "David Michelinie",
        coverArtist: "Todd McFarlane",
        interiorArtist: "Todd McFarlane",
        keyInfo: ["First appearance of Venom"],
      });
      // Should not include non-saveable fields
      expect(result).not.toHaveProperty("grade");
      expect(result).not.toHaveProperty("priceData");
    });

    it("returns null when title is missing", () => {
      const details: Record<string, unknown> = {
        issueNumber: "300",
        publisher: "Marvel",
      };
      expect(buildMetadataSavePayload(details)).toBeNull();
    });

    it("returns null when issueNumber is missing", () => {
      const details: Record<string, unknown> = {
        title: "Amazing Spider-Man",
        publisher: "Marvel",
      };
      expect(buildMetadataSavePayload(details)).toBeNull();
    });

    it("omits undefined fields (only includes fields that exist on details)", () => {
      const details: Record<string, unknown> = {
        title: "Amazing Spider-Man",
        issueNumber: "300",
        publisher: "Marvel",
        // writer, coverArtist, interiorArtist, releaseYear, keyInfo are all missing
      };
      const result = buildMetadataSavePayload(details);

      expect(result).toEqual({
        title: "Amazing Spider-Man",
        issueNumber: "300",
        publisher: "Marvel",
      });
      expect(result).not.toHaveProperty("writer");
      expect(result).not.toHaveProperty("coverArtist");
      expect(result).not.toHaveProperty("interiorArtist");
      expect(result).not.toHaveProperty("releaseYear");
      expect(result).not.toHaveProperty("keyInfo");
    });
  });
});
