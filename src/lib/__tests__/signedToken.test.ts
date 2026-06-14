/**
 * signedToken tests (H-SC3).
 *
 * Security helper: covers round-trip, tamper rejection (payload + signature),
 * expiry enforcement, malformed input, and the missing-secret fail-closed path.
 *
 * @jest-environment node
 */
import { sign, verify } from "../signedToken";

const SECRET_NAME = "TEST_SIGNING_SECRET";

describe("signedToken", () => {
  const original = process.env[SECRET_NAME];
  const originalClerk = process.env.CLERK_SECRET_KEY;

  beforeEach(() => {
    process.env[SECRET_NAME] = "super-secret-test-key";
    delete process.env.CLERK_SECRET_KEY;
  });

  afterAll(() => {
    if (original === undefined) delete process.env[SECRET_NAME];
    else process.env[SECRET_NAME] = original;
    if (originalClerk === undefined) delete process.env.CLERK_SECRET_KEY;
    else process.env.CLERK_SECRET_KEY = originalClerk;
  });

  it("round-trips a payload (sign → verify)", () => {
    const token = sign({ gid: "abc123", role: "guest" }, SECRET_NAME);
    const result = verify<{ gid: string; role: string }>(token, SECRET_NAME);
    expect(result.valid).toBe(true);
    expect(result.payload?.gid).toBe("abc123");
    expect(result.payload?.role).toBe("guest");
  });

  it("rejects a tampered payload segment", () => {
    const token = sign({ gid: "abc123" }, SECRET_NAME);
    const [, sig] = token.split(".");
    // Re-encode a different payload but keep the original signature.
    const forgedPayload = Buffer.from(JSON.stringify({ gid: "evil" }))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const forged = `${forgedPayload}.${sig}`;
    const result = verify(forged, SECRET_NAME);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("bad-signature");
  });

  it("rejects a tampered signature segment", () => {
    const token = sign({ gid: "abc123" }, SECRET_NAME);
    const [payload] = token.split(".");
    const result = verify(`${payload}.deadbeef`, SECRET_NAME);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("bad-signature");
  });

  it("rejects a token signed with a different secret", () => {
    const token = sign({ gid: "abc123" }, SECRET_NAME);
    process.env[SECRET_NAME] = "a-completely-different-secret";
    const result = verify(token, SECRET_NAME);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("bad-signature");
  });

  it("enforces expiry", () => {
    const token = sign({ gid: "abc123", exp: 1000 }, SECRET_NAME);
    const result = verify(token, SECRET_NAME, 2000);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("expired");
  });

  it("accepts a not-yet-expired token", () => {
    const token = sign({ gid: "abc123", exp: 5000 }, SECRET_NAME);
    const result = verify(token, SECRET_NAME, 1000);
    expect(result.valid).toBe(true);
  });

  it("returns malformed for null / empty / shapeless input", () => {
    expect(verify(null, SECRET_NAME).reason).toBe("malformed");
    expect(verify("", SECRET_NAME).reason).toBe("malformed");
    expect(verify("noseparator", SECRET_NAME).reason).toBe("malformed");
    expect(verify("a.b.c", SECRET_NAME).reason).toBe("malformed");
  });

  it("falls back to CLERK_SECRET_KEY when the named secret is unset", () => {
    delete process.env[SECRET_NAME];
    process.env.CLERK_SECRET_KEY = "clerk-fallback";
    const token = sign({ gid: "abc123" }, SECRET_NAME);
    const result = verify(token, SECRET_NAME);
    expect(result.valid).toBe(true);
  });

  it("fails closed when no secret is configured at all", () => {
    delete process.env[SECRET_NAME];
    delete process.env.CLERK_SECRET_KEY;
    expect(() => sign({ gid: "abc123" }, SECRET_NAME)).toThrow();
    const result = verify("a.b", SECRET_NAME);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("no-secret");
  });
});
