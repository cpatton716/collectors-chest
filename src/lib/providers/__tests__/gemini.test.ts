import { GeminiProvider } from "../gemini";

const mockGenerateContent = jest.fn();

jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
}));

jest.mock("@/lib/models", () => ({
  GEMINI_PRIMARY: "gemini-2.0-flash",
}));

// Mock the imported prompts from anthropic
jest.mock("../anthropic", () => ({
  IMAGE_ANALYSIS_PROMPT: "mock image prompt",
  buildVerificationPrompt: jest.fn().mockReturnValue("mock verify prompt"),
}));

describe("GeminiProvider", () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    provider = new GeminiProvider();
    mockGenerateContent.mockReset();
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  describe("name", () => {
    it("returns 'gemini'", () => {
      expect(provider.name).toBe("gemini");
    });
  });

  describe("estimateCostCents", () => {
    it("returns 0.3 for imageAnalysis", () => {
      expect(provider.estimateCostCents("imageAnalysis")).toBe(0.3);
    });
    it("returns 0.1 for verification", () => {
      expect(provider.estimateCostCents("verification")).toBe(0.1);
    });
  });

  describe("analyzeImage", () => {
    it("sends image as inline data and returns parsed result", async () => {
      const mockResult = {
        title: "Batman",
        issueNumber: "1",
        publisher: "DC Comics",
        releaseYear: "2011",
        variant: null,
        writer: "Scott Snyder",
        coverArtist: "Greg Capullo",
        interiorArtist: "Greg Capullo",
        confidence: "high",
        isSlabbed: false,
        gradingCompany: null,
        grade: null,
        certificationNumber: null,
        labelType: null,
        pageQuality: null,
        gradeDate: null,
        graderNotes: null,
        isSignatureSeries: false,
        signedBy: null,
        barcodeNumber: null,
        barcode: null,
      };

      mockGenerateContent.mockResolvedValueOnce({
        response: { text: () => JSON.stringify(mockResult) },
      });

      const result = await provider.analyzeImage({
        base64Data: "base64data",
        mediaType: "image/jpeg",
      });

      expect(result.title).toBe("Batman");
      expect(result.publisher).toBe("DC Comics");
      expect(mockGenerateContent).toHaveBeenCalledWith([
        { inlineData: { mimeType: "image/jpeg", data: "base64data" } },
        { text: "mock image prompt" },
      ]);
    });

    it("throws when response has no content", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: { text: () => "" },
      });
      await expect(
        provider.analyzeImage({ base64Data: "data", mediaType: "image/jpeg" })
      ).rejects.toThrow("No response from Gemini");
    });

    it("strips markdown code fences from response", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => '```json\n{"title":"X-Men","issueNumber":"1"}\n```',
        },
      });
      const result = await provider.analyzeImage({
        base64Data: "d",
        mediaType: "image/jpeg",
      });
      expect(result.title).toBe("X-Men");
    });
  });

  describe("verifyAndEnrich", () => {
    it("calls Gemini with verification prompt and returns parsed result", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () =>
            JSON.stringify({
              writer: "Alan Moore",
              coverArtist: null,
              interiorArtist: null,
              publisher: null,
              releaseYear: null,
              variant: null,
              keyInfo: ["First appearance of Rorschach"],
            }),
        },
      });
      const result = await provider.verifyAndEnrich({
        title: "Watchmen",
        issueNumber: "1",
        publisher: "DC Comics",
        releaseYear: "1986",
        variant: null,
        writer: null,
        coverArtist: null,
        interiorArtist: null,
        missingFields: ["writer"],
      });
      expect(result.writer).toBe("Alan Moore");
      expect(result.keyInfo).toContain("First appearance of Rorschach");
    });
  });
});
