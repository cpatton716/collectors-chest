import { OpenAIProvider } from "../openai";

jest.mock("openai", () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }));
});

jest.mock("@/lib/models", () => ({
  OPENAI_PRIMARY: "gpt-4o",
}));

// Mock the imported prompts from anthropic
jest.mock("../anthropic", () => ({
  IMAGE_ANALYSIS_PROMPT: "mock image prompt",
  buildVerificationPrompt: jest.fn().mockReturnValue("mock verify prompt"),
  buildPriceEstimationPrompt: jest.fn().mockReturnValue("mock price prompt"),
}));

describe("OpenAIProvider", () => {
  let provider: OpenAIProvider;
  let mockCreate: jest.Mock;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    provider = new OpenAIProvider();
    const OpenAI = require("openai");
    const instance = new OpenAI();
    mockCreate = instance.chat.completions.create;
    (
      provider as unknown as {
        client: { chat: { completions: { create: jest.Mock } } };
      }
    ).client = instance;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe("name", () => {
    it("returns 'openai'", () => {
      expect(provider.name).toBe("openai");
    });
  });

  describe("estimateCostCents", () => {
    it("returns 1.2 for imageAnalysis", () => {
      expect(provider.estimateCostCents("imageAnalysis")).toBe(1.2);
    });
    it("returns 0.4 for verification", () => {
      expect(provider.estimateCostCents("verification")).toBe(0.4);
    });
    it("returns 0.4 for priceEstimation", () => {
      expect(provider.estimateCostCents("priceEstimation")).toBe(0.4);
    });
  });

  describe("analyzeImage", () => {
    it("uses JSON mode and image_url content type", async () => {
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

      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockResult) } }],
      });

      const result = await provider.analyzeImage({
        base64Data: "base64data",
        mediaType: "image/jpeg",
      });

      expect(result.title).toBe("Batman");
      expect(result.publisher).toBe("DC Comics");
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4o",
          response_format: { type: "json_object" },
        }),
        expect.any(Object)
      );
    });

    it("throws when response has no content", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });
      await expect(
        provider.analyzeImage({ base64Data: "data", mediaType: "image/jpeg" })
      ).rejects.toThrow("No response from OpenAI");
    });

    it("passes abort signal to SDK", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '{"title":"X"}' } }],
      });
      const signal = AbortSignal.timeout(5000);
      await provider.analyzeImage(
        { base64Data: "d", mediaType: "image/jpeg" },
        { signal }
      );
      expect(mockCreate).toHaveBeenCalledWith(expect.any(Object), { signal });
    });
  });

  describe("verifyAndEnrich", () => {
    it("calls OpenAI with verification prompt and returns parsed result", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                writer: "Alan Moore",
                coverArtist: null,
                interiorArtist: null,
                publisher: null,
                releaseYear: null,
                variant: null,
                keyInfo: ["First appearance of Rorschach"],
              }),
            },
          },
        ],
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

  describe("estimatePrice", () => {
    it("calls OpenAI with price estimation prompt and returns parsed result", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                recentSales: [
                  { price: 45, date: "2026-01-15", source: "eBay" },
                ],
                gradeEstimates: [],
                marketNotes: "Steady",
              }),
            },
          },
        ],
      });
      const result = await provider.estimatePrice({
        title: "X-Men",
        issueNumber: "1",
        publisher: "Marvel",
        releaseYear: "1991",
        grade: null,
        gradingCompany: null,
        isSlabbed: false,
        isSignatureSeries: false,
        signedBy: null,
      });
      expect(result.recentSales[0].price).toBe(45);
    });
  });
});
