import { verifyWithMetron } from "../metronVerify";

// Mock global fetch
const originalFetch = global.fetch;

beforeEach(() => {
  process.env.METRON_USERNAME = "testuser";
  process.env.METRON_PASSWORD = "testpass";
});

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.METRON_USERNAME;
  delete process.env.METRON_PASSWORD;
});

describe("verifyWithMetron", () => {
  it("returns safe default when credentials are missing", async () => {
    delete process.env.METRON_USERNAME;
    delete process.env.METRON_PASSWORD;

    const result = await verifyWithMetron("Spider-Man", "1");
    expect(result).toEqual({
      verified: false,
      confidence_boost: false,
      metron_id: null,
      cover_image: null,
    });
  });

  it("returns verified result when Metron finds a match", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        count: 1,
        results: [
          {
            id: 12345,
            image: "https://metron.cloud/media/issue/spider-man-1.jpg",
          },
        ],
      }),
    });

    const result = await verifyWithMetron("Spider-Man", "1");
    expect(result).toEqual({
      verified: true,
      confidence_boost: true,
      metron_id: "12345",
      cover_image: "https://metron.cloud/media/issue/spider-man-1.jpg",
    });

    // Verify correct URL and auth header
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("series_name=Spider-Man"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from("testuser:testpass").toString("base64")}`,
        }),
      })
    );
  });

  it("returns safe default when Metron returns no results", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ count: 0, results: [] }),
    });

    const result = await verifyWithMetron("Nonexistent Comic", "999");
    expect(result).toEqual({
      verified: false,
      confidence_boost: false,
      metron_id: null,
      cover_image: null,
    });
  });

  it("returns safe default on HTTP error", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await verifyWithMetron("Spider-Man", "1");
    expect(result).toEqual({
      verified: false,
      confidence_boost: false,
      metron_id: null,
      cover_image: null,
    });
  });

  it("returns safe default on network error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    const result = await verifyWithMetron("Spider-Man", "1");
    expect(result).toEqual({
      verified: false,
      confidence_boost: false,
      metron_id: null,
      cover_image: null,
    });
  });

  it("returns safe default on timeout", async () => {
    global.fetch = jest.fn().mockRejectedValue(new DOMException("Aborted", "AbortError"));

    const result = await verifyWithMetron("Spider-Man", "1");
    expect(result).toEqual({
      verified: false,
      confidence_boost: false,
      metron_id: null,
      cover_image: null,
    });
  });

  it("uses cover field as fallback when image is missing", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        count: 1,
        results: [
          {
            id: 67890,
            cover: "https://metron.cloud/media/cover/batman-50.jpg",
          },
        ],
      }),
    });

    const result = await verifyWithMetron("Batman", "50");
    expect(result.cover_image).toBe("https://metron.cloud/media/cover/batman-50.jpg");
  });

  it("handles result with null id gracefully", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        count: 1,
        results: [{ id: null, image: null }],
      }),
    });

    const result = await verifyWithMetron("X-Men", "1");
    expect(result).toEqual({
      verified: true,
      confidence_boost: true,
      metron_id: null,
      cover_image: null,
    });
  });
});
