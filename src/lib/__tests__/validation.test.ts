/**
 * Validation helper tests (M-CC16)
 *
 * Covers the reusable Zod schemas and the validateBody/validateQuery/
 * validateParams wrappers. These guard every API route's input, so the
 * success/failure contract (typed data on success, 400 + details on failure)
 * must be locked down.
 *
 * @jest-environment node
 *
 * (node env: validation.ts imports next/server, which needs the Web Request/
 * Response globals that jsdom doesn't provide but Node does.)
 */
import { z } from "zod";

import {
  schemas,
  validateBody,
  validateParams,
  validateQuery,
  type ValidationErrorResponse,
} from "../validation";

describe("schemas", () => {
  describe("uuid", () => {
    it("accepts a valid UUID", () => {
      const r = schemas.uuid.safeParse("123e4567-e89b-12d3-a456-426614174000");
      expect(r.success).toBe(true);
    });
    it("rejects a non-UUID string", () => {
      const r = schemas.uuid.safeParse("not-a-uuid");
      expect(r.success).toBe(false);
    });
  });

  describe("email", () => {
    it("accepts a valid email", () => {
      expect(schemas.email.safeParse("user@example.com").success).toBe(true);
    });
    it("rejects a malformed email", () => {
      expect(schemas.email.safeParse("user@@example").success).toBe(false);
    });
  });

  describe("url", () => {
    it("accepts an https URL", () => {
      expect(schemas.url.safeParse("https://collectors-chest.com").success).toBe(true);
    });
    it("rejects a bare word", () => {
      expect(schemas.url.safeParse("collectors-chest").success).toBe(false);
    });
  });

  describe("positiveInt", () => {
    it("coerces a numeric string to a positive int", () => {
      const r = schemas.positiveInt.safeParse("42");
      expect(r.success).toBe(true);
      if (r.success) expect(r.data).toBe(42);
    });
    it("rejects zero", () => {
      expect(schemas.positiveInt.safeParse("0").success).toBe(false);
    });
    it("rejects negative numbers", () => {
      expect(schemas.positiveInt.safeParse("-5").success).toBe(false);
    });
    it("rejects non-integers", () => {
      expect(schemas.positiveInt.safeParse("3.5").success).toBe(false);
    });
  });

  describe("nonNegativeNumber", () => {
    it("accepts zero", () => {
      const r = schemas.nonNegativeNumber.safeParse("0");
      expect(r.success).toBe(true);
      if (r.success) expect(r.data).toBe(0);
    });
    it("accepts a positive decimal", () => {
      const r = schemas.nonNegativeNumber.safeParse("19.99");
      expect(r.success).toBe(true);
      if (r.success) expect(r.data).toBeCloseTo(19.99);
    });
    it("rejects a negative number", () => {
      expect(schemas.nonNegativeNumber.safeParse("-0.01").success).toBe(false);
    });
  });

  describe("trimmedString", () => {
    it("trims surrounding whitespace before validating", () => {
      const r = schemas.trimmedString(1, 10).safeParse("  hello  ");
      expect(r.success).toBe(true);
      if (r.success) expect(r.data).toBe("hello");
    });
    it("rejects a string that is only whitespace (below min after trim)", () => {
      const r = schemas.trimmedString(1, 10).safeParse("   ");
      expect(r.success).toBe(false);
    });
    it("rejects a string longer than max after trim", () => {
      const r = schemas.trimmedString(1, 3).safeParse("abcd");
      expect(r.success).toBe(false);
    });
    it("honors a custom minimum length", () => {
      expect(schemas.trimmedString(3, 10).safeParse("ab").success).toBe(false);
      expect(schemas.trimmedString(3, 10).safeParse("abc").success).toBe(true);
    });
  });
});

describe("validateBody", () => {
  const schema = z.object({ name: z.string().min(1), age: z.number().int() });

  it("returns typed data on a valid body", () => {
    const result = validateBody(schema, { name: "Spidey", age: 25 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "Spidey", age: 25 });
    }
  });

  it("returns a 400 response with field details on invalid body", async () => {
    const result = validateBody(schema, { name: "", age: 1.5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(400);
      const json = (await result.response.json()) as ValidationErrorResponse;
      expect(json.error).toBe("Invalid request body");
      const fields = json.details.map((d) => d.field);
      expect(fields).toContain("name");
      expect(fields).toContain("age");
    }
  });

  it("labels root-level errors as (root)", async () => {
    const arraySchema = z.array(z.string());
    const result = validateBody(arraySchema, "not-an-array");
    expect(result.success).toBe(false);
    if (!result.success) {
      const json = (await result.response.json()) as ValidationErrorResponse;
      expect(json.details[0].field).toBe("(root)");
    }
  });
});

describe("validateQuery", () => {
  const schema = z.object({ page: schemas.positiveInt });

  it("parses a URLSearchParams instance", () => {
    const params = new URLSearchParams({ page: "3" });
    const result = validateQuery(schema, params);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.page).toBe(3);
  });

  it("parses a plain object", () => {
    const result = validateQuery(schema, { page: "2" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.page).toBe(2);
  });

  it("returns 400 with 'Invalid query parameters' on bad input", async () => {
    const result = validateQuery(schema, { page: "0" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(400);
      const json = (await result.response.json()) as ValidationErrorResponse;
      expect(json.error).toBe("Invalid query parameters");
    }
  });
});

describe("validateParams", () => {
  const schema = z.object({ id: schemas.uuid });

  it("accepts valid params", () => {
    const result = validateParams(schema, { id: "123e4567-e89b-12d3-a456-426614174000" });
    expect(result.success).toBe(true);
  });

  it("returns 400 with 'Invalid URL parameters' on bad input", async () => {
    const result = validateParams(schema, { id: "nope" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(400);
      const json = (await result.response.json()) as ValidationErrorResponse;
      expect(json.error).toBe("Invalid URL parameters");
    }
  });
});
