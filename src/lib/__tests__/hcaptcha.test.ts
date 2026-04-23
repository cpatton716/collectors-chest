import { parseHCaptchaErrorForUser, verifyCaptchaToken } from "../hcaptcha";

describe("parseHCaptchaErrorForUser", () => {
  it("returns a default friendly message when reason is undefined", () => {
    expect(parseHCaptchaErrorForUser(undefined)).toBe(
      "CAPTCHA verification failed. Please try again."
    );
  });

  it("returns a specific message for missing_token", () => {
    expect(parseHCaptchaErrorForUser("missing_token")).toBe(
      "Please complete the CAPTCHA and try again."
    );
  });

  it("returns a configuration message for not_configured", () => {
    expect(parseHCaptchaErrorForUser("not_configured")).toBe(
      "CAPTCHA is not configured. Please contact support."
    );
  });

  it("returns an expiration message for timeout-or-duplicate", () => {
    expect(parseHCaptchaErrorForUser("timeout-or-duplicate")).toBe(
      "CAPTCHA expired. Please refresh and try again."
    );
  });

  it("returns a specific message for siteverify_timeout", () => {
    expect(parseHCaptchaErrorForUser("siteverify_timeout")).toBe(
      "CAPTCHA verification is slow right now. Please try again in a moment."
    );
  });

  it("falls back to the generic message for unknown reasons", () => {
    expect(parseHCaptchaErrorForUser("invalid-input-secret")).toBe(
      "CAPTCHA verification failed. Please try again."
    );
  });
});

describe("verifyCaptchaToken", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("returns missing_token when the token is null", async () => {
    const result = await verifyCaptchaToken(null);
    expect(result).toEqual({ valid: false, reason: "missing_token" });
  });

  it("returns missing_token when the token is an empty string", async () => {
    const result = await verifyCaptchaToken("");
    expect(result).toEqual({ valid: false, reason: "missing_token" });
  });

  it("returns { valid: true } when hCaptcha responds success", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as unknown as typeof fetch;

    const result = await verifyCaptchaToken("fake-token", "1.2.3.4");
    expect(result).toEqual({ valid: true });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.hcaptcha.com/siteverify",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("returns the first error code when hCaptcha rejects the token", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        "error-codes": ["invalid-input-response", "bad-request"],
      }),
    }) as unknown as typeof fetch;

    const result = await verifyCaptchaToken("fake-token");
    expect(result).toEqual({ valid: false, reason: "invalid-input-response" });
  });

  it("returns 'unknown' when hCaptcha fails without error codes", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    }) as unknown as typeof fetch;

    const result = await verifyCaptchaToken("fake-token");
    expect(result).toEqual({ valid: false, reason: "unknown" });
  });

  it("returns siteverify_http_<status> on non-OK HTTP responses", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    const result = await verifyCaptchaToken("fake-token");
    expect(result).toEqual({ valid: false, reason: "siteverify_http_500" });
  });

  it("returns network_error when fetch throws", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("boom")) as unknown as typeof fetch;

    const result = await verifyCaptchaToken("fake-token");
    expect(result).toEqual({ valid: false, reason: "network_error" });
  });

  it("returns siteverify_timeout when the fetch aborts with a TimeoutError", async () => {
    const timeoutError = new DOMException("The operation was aborted", "TimeoutError");
    global.fetch = jest.fn().mockRejectedValue(timeoutError) as unknown as typeof fetch;

    const result = await verifyCaptchaToken("fake-token");
    expect(result).toEqual({ valid: false, reason: "siteverify_timeout" });
  });

  it("passes an AbortSignal to fetch for request timeout enforcement", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as unknown as jest.Mock;
    global.fetch = fetchMock as unknown as typeof fetch;

    await verifyCaptchaToken("fake-token");
    const [, init] = fetchMock.mock.calls[0];
    expect(init).toHaveProperty("signal");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
