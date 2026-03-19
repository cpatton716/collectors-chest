import {
  AnthropicProvider,
  IMAGE_ANALYSIS_PROMPT,
  buildVerificationPrompt,
} from "../anthropic";

import type { VerificationRequest } from "../types";

// ── Mocks ──

jest.mock("@anthropic-ai/sdk", () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: jest.fn() },
  }));
});

jest.mock("@/lib/models", () => ({
  MODEL_PRIMARY: "claude-sonnet-4-20250514",
}));

// ── Helpers ──

function makeProvider() {
  return new AnthropicProvider("test-key");
}

/** Access the private parseJsonResponse method for testing. */
function parse(provider: AnthropicProvider, raw: string): unknown {
  return (
    provider as unknown as { parseJsonResponse: (s: string) => unknown }
  ).parseJsonResponse(raw);
}

/** Get the mocked SDK client from a provider instance. */
function getClient(provider: AnthropicProvider) {
  return (provider as unknown as { client: { messages: { create: jest.Mock } } }).client;
}

// ── Tests ──

describe("AnthropicProvider", () => {
  describe("name", () => {
    it('returns "anthropic"', () => {
      const provider = makeProvider();
      expect(provider.name).toBe("anthropic");
    });
  });

  // ── parseJsonResponse ──

  describe("parseJsonResponse", () => {
    let provider: AnthropicProvider;

    beforeEach(() => {
      provider = makeProvider();
    });

    it("parses clean JSON", () => {
      const result = parse(provider, '{"title":"Spider-Man"}');
      expect(result).toEqual({ title: "Spider-Man" });
    });

    it("strips ```json fences", () => {
      const result = parse(provider, '```json\n{"title":"Batman"}\n```');
      expect(result).toEqual({ title: "Batman" });
    });

    it("strips plain ``` fences", () => {
      const result = parse(provider, '```\n{"issue":"1"}\n```');
      expect(result).toEqual({ issue: "1" });
    });

    it("handles surrounding whitespace", () => {
      const result = parse(provider, '  \n {"ok":true} \n  ');
      expect(result).toEqual({ ok: true });
    });

    it("throws on invalid JSON", () => {
      expect(() => parse(provider, "not json at all")).toThrow();
    });
  });

  // ── estimateCostCents ──

  describe("estimateCostCents", () => {
    const provider = makeProvider();

    it("returns 1.5 for imageAnalysis", () => {
      expect(provider.estimateCostCents("imageAnalysis")).toBe(1.5);
    });

    it("returns 0.6 for verification", () => {
      expect(provider.estimateCostCents("verification")).toBe(0.6);
    });
  });

  // ── analyzeImage ──

  describe("analyzeImage", () => {
    it("calls SDK with correct structure and returns parsed result", async () => {
      const provider = makeProvider();
      const client = getClient(provider);
      const mockResult = {
        title: "Amazing Spider-Man",
        issueNumber: "300",
        publisher: "Marvel Comics",
        releaseYear: "1988",
        variant: null,
        writer: "David Michelinie",
        coverArtist: "Todd McFarlane",
        interiorArtist: "Todd McFarlane",
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

      client.messages.create.mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify(mockResult) }],
      });

      const result = await provider.analyzeImage({
        base64Data: "abc123",
        mediaType: "image/jpeg",
      });

      expect(result).toEqual(mockResult);

      // Verify SDK was called with correct shape
      const [body, requestOpts] = client.messages.create.mock.calls[0];
      expect(body.model).toBe("claude-sonnet-4-20250514");
      expect(body.max_tokens).toBe(1024);
      expect(body.messages[0].content[0]).toMatchObject({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: "abc123" },
      });
      expect(body.messages[0].content[1]).toMatchObject({
        type: "text",
        text: IMAGE_ANALYSIS_PROMPT,
      });
      expect(requestOpts).toEqual({ signal: undefined });
    });

    it("passes abort signal through to SDK", async () => {
      const provider = makeProvider();
      const client = getClient(provider);
      const controller = new AbortController();

      client.messages.create.mockResolvedValueOnce({
        content: [{ type: "text", text: '{"title":"X-Men"}' }],
      });

      await provider.analyzeImage(
        { base64Data: "data", mediaType: "image/png" },
        { signal: controller.signal }
      );

      const [, requestOpts] = client.messages.create.mock.calls[0];
      expect(requestOpts.signal).toBe(controller.signal);
    });

    it("throws when response has no text block", async () => {
      const provider = makeProvider();
      const client = getClient(provider);

      client.messages.create.mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "123", name: "test", input: {} }],
      });

      await expect(
        provider.analyzeImage({ base64Data: "data", mediaType: "image/jpeg" })
      ).rejects.toThrow("We couldn't analyze this image");
    });
  });

  // ── verifyAndEnrich ──

  describe("verifyAndEnrich", () => {
    it("calls SDK and returns parsed verification result", async () => {
      const provider = makeProvider();
      const client = getClient(provider);
      const mockResult = {
        writer: "Brian K. Vaughan",
        coverArtist: "Fiona Staples",
        interiorArtist: "Fiona Staples",
        publisher: "Image Comics",
        releaseYear: "2012",
        variant: null,
        keyInfo: ["First appearance of Saga characters"],
      };

      client.messages.create.mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify(mockResult) }],
      });

      const req: VerificationRequest = {
        title: "Saga",
        issueNumber: "1",
        publisher: "Image Comics",
        releaseYear: null,
        variant: null,
        writer: null,
        coverArtist: null,
        interiorArtist: null,
        missingFields: ["creators (writer, coverArtist, interiorArtist)"],
      };

      const result = await provider.verifyAndEnrich(req);
      expect(result).toEqual(mockResult);

      const [body] = client.messages.create.mock.calls[0];
      expect(body.max_tokens).toBe(384);
      expect(body.messages[0].content).toContain('Comic: "Saga" #1');
    });
  });

  // ── Prompt Builders ──

  describe("buildVerificationPrompt", () => {
    it("includes title and issue number", () => {
      const prompt = buildVerificationPrompt({
        title: "Batman",
        issueNumber: "423",
        publisher: "DC Comics",
        releaseYear: "1988",
        variant: null,
        writer: null,
        coverArtist: null,
        interiorArtist: null,
        missingFields: ["creators (writer, coverArtist, interiorArtist)"],
      });
      expect(prompt).toContain('"Batman" #423');
      expect(prompt).toContain("Publisher=DC Comics");
    });

    it("uses ? for missing publisher and year", () => {
      const prompt = buildVerificationPrompt({
        title: "Spawn",
        issueNumber: "1",
        publisher: null,
        releaseYear: null,
        variant: null,
        writer: null,
        coverArtist: null,
        interiorArtist: null,
        missingFields: ["publication info (publisher, releaseYear)"],
      });
      expect(prompt).toContain("Publisher=?");
      expect(prompt).toContain("Year=?");
    });
  });
});
