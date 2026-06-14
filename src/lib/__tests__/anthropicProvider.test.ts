/**
 * Tests for the Anthropic provider's request shaping and shared JSON parser.
 *
 * Covers:
 *  - parseAnthropicJson tolerates markdown code fences (shared helper, L-SC32)
 *  - analyzeImage sends the static prompt FIRST as a cacheable prefix with
 *    cache_control: ephemeral, and the image AFTER (M-SC10).
 */

const mockCreate = jest.fn();

jest.mock("@anthropic-ai/sdk", () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
});

import {
  AnthropicProvider,
  parseAnthropicJson,
  IMAGE_ANALYSIS_PROMPT,
} from "../providers/anthropic";

describe("parseAnthropicJson", () => {
  it("parses bare JSON", () => {
    expect(parseAnthropicJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips a ```json fence", () => {
    expect(parseAnthropicJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("strips a bare ``` fence", () => {
    expect(parseAnthropicJson('```\n{"b":2}\n```')).toEqual({ b: 2 });
  });

  it("trims surrounding whitespace", () => {
    expect(parseAnthropicJson('   {"c":3}   ')).toEqual({ c: 3 });
  });
});

describe("AnthropicProvider.analyzeImage request shape", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"title":"X"}' }],
    });
  });

  it("sends static prompt first (cacheable) then the image", async () => {
    const provider = new AnthropicProvider("test-key");
    await provider.analyzeImage({ base64Data: "AAAA", mediaType: "image/jpeg" });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const arg = mockCreate.mock.calls[0][0];
    const content = arg.messages[0].content;

    // First block: the static prompt with cache_control ephemeral.
    expect(content[0].type).toBe("text");
    expect(content[0].text).toBe(IMAGE_ANALYSIS_PROMPT);
    expect(content[0].cache_control).toEqual({ type: "ephemeral" });

    // Second block: the per-scan image (comes AFTER the cached prefix).
    expect(content[1].type).toBe("image");
    expect(content[1].source.data).toBe("AAAA");
  });

  it("returns the parsed JSON identification", async () => {
    const provider = new AnthropicProvider("test-key");
    const result = await provider.analyzeImage({
      base64Data: "AAAA",
      mediaType: "image/jpeg",
    });
    expect(result).toEqual({ title: "X" });
  });
});
