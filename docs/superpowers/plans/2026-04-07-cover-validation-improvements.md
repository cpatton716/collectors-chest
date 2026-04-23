# Cover Validation Improvements Implementation Plan

> **Apr 23, 2026 update:** Metron was fully removed from the scan flow this session. The `"metron"` literal in the `coverSource` union below is kept only to keep legacy cached rows valid — no new rows are written with that source. Task list below is otherwise unchanged.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `validated` boolean to `CoverPipelineResult` so callers can distinguish "no cover found" (definitive) from "Gemini unavailable" (transient), and add comprehensive error path tests.

**Architecture:** Add a single field to the existing return type, track `allCandidatesChecked` through the validation loop, fix two caller bugs (missing else branch, inverted logic), and add 11 error path tests.

**Tech Stack:** TypeScript, Jest, Next.js API routes

**Spec:** `docs/engineering-specs/2026-04-07-cover-validation-improvements-design.md`

---

## File Structure

| File | Change | Responsibility |
|------|--------|---------------|
| `src/lib/coverValidation.ts` | Modify | Add `validated` to interface + return values, fix rate-limit break, add API key pre-check |
| `src/app/api/analyze/route.ts` | Modify | Always set `coverValidated` from pipeline result |
| `src/app/api/con-mode-lookup/route.ts` | Modify | Fix inverted `coverValidated` logic |
| `src/app/api/quick-lookup/route.ts` | Review | Verify `coverValidated` assignment is consistent |
| `src/lib/__tests__/coverValidation.test.ts` | Modify | Add 11 error path tests, update existing assertions |

---

### Task 1: Add `validated` field to CoverPipelineResult interface

**Files:**
- Modify: `src/lib/coverValidation.ts:17-26`

- [ ] **Step 1: Update the interface**

In `src/lib/coverValidation.ts`, replace the `CoverPipelineResult` interface (lines 17-26):

```typescript
export interface CoverPipelineResult {
  coverUrl: string | null;
  coverSource:
    | "community"
    | "ebay"
    | "openlibrary"
    | "metron"
    | "comicvine"
    | null;
  validated: boolean;
}
```

- [ ] **Step 2: Update NULL_RESULT constant**

In `src/lib/coverValidation.ts`, replace line 328-330:

```typescript
  const NULL_RESULT: CoverPipelineResult = {
    coverUrl: null,
    coverSource: null,
    validated: true,
  };
```

This is used ONLY for the "no candidates found" early return (line 366), which is a definitive result.

- [ ] **Step 3: Run tests to see what breaks**

Run: `npm test -- src/lib/__tests__/coverValidation.test.ts`
Expected: Some existing tests fail because they assert `{ coverUrl, coverSource }` without `validated`

- [ ] **Step 4: Update existing test assertions**

In `src/lib/__tests__/coverValidation.test.ts`, update the three existing `runCoverPipeline` tests:

Test "returns community cover without calling Gemini" (~line 225):
```typescript
    expect(result).toEqual({
      coverUrl: "https://covers.openlibrary.org/community/batman1.jpg",
      coverSource: "community",
      validated: true,
    });
```

Test "validates eBay image with Gemini YES response" (~line 285):
```typescript
    expect(result).toEqual({
      coverUrl: "https://i.ebayimg.com/images/g/abc/s-l1600.jpg",
      coverSource: "ebay",
      validated: true,
    });
```

Test "skips listings with no imageUrl" (~line 313):
```typescript
    expect(result).toEqual({ coverUrl: null, coverSource: null, validated: true });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/lib/__tests__/coverValidation.test.ts`
Expected: All existing tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/coverValidation.ts src/lib/__tests__/coverValidation.test.ts
git commit -m "feat: add validated field to CoverPipelineResult interface"
```

---

### Task 2: Implement `allCandidatesChecked` tracking in validation loop

**Files:**
- Modify: `src/lib/coverValidation.ts:321-445`

- [ ] **Step 1: Add API key pre-check before candidate loop**

In `src/lib/coverValidation.ts`, after the `if (candidates.length === 0) return NULL_RESULT;` line (line 366), add:

```typescript
  // Pre-check: is Gemini available?
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const hasGeminiClient = !!options?.geminiClient;
  let allCandidatesChecked = !!(geminiApiKey || hasGeminiClient);
```

- [ ] **Step 2: Fix rate-limit check — change `continue` to `break` and track**

In the candidate loop, replace the rate-limit cooldown check (~line 399-402):

Old:
```typescript
    // Check rate-limit cooldown
    if (Date.now() < rateLimitCooldownUntil) {
      console.warn(`${LOG_PREFIX} Gemini rate-limited, skipping validation`);
      continue;
    }
```

New:
```typescript
    // Check rate-limit cooldown — applies to ALL remaining candidates
    if (Date.now() < rateLimitCooldownUntil) {
      console.warn(`${LOG_PREFIX} Gemini rate-limited, skipping remaining candidates`);
      allCandidatesChecked = false;
      break;
    }
```

- [ ] **Step 3: Track failures in catch block AND add break after rate-limit detection**

In the catch block (~line 427-441), add `allCandidatesChecked = false` after `failures++` AND add `break` after rate-limit detection to stop trying remaining candidates:

Old:
```typescript
    } catch (err: unknown) {
      failures++;

      // Check for rate limiting
      if (
        err instanceof Error &&
        (err.message?.includes("429") || err.message?.includes("RATE_LIMIT"))
      ) {
        rateLimitCooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        console.warn(
          `${LOG_PREFIX} Gemini rate limited, cooling down for 60s`
        );
      } else {
        console.error(`${LOG_PREFIX} Gemini validation error`, err);
      }
    }
```

New:
```typescript
    } catch (err: unknown) {
      failures++;
      allCandidatesChecked = false;

      // Check for rate limiting
      if (
        err instanceof Error &&
        (err.message?.includes("429") || err.message?.includes("RATE_LIMIT"))
      ) {
        rateLimitCooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        console.warn(
          `${LOG_PREFIX} Gemini rate limited, cooling down for 60s`
        );
        break; // Rate limit applies to all remaining candidates
      } else {
        console.error(`${LOG_PREFIX} Gemini validation error`, err);
      }
    }
```

- [ ] **Step 4: Update fetchImage failure path to track allCandidatesChecked**

In the candidate loop, where `fetchImage` returns null (~line 385-387):

Old:
```typescript
    const imageResult = await fetchImage(candidate.url);
    if (!imageResult) {
      failures++;
      continue;
    }
```

New:
```typescript
    const imageResult = await fetchImage(candidate.url);
    if (!imageResult) {
      failures++;
      allCandidatesChecked = false;
      continue;
    }
```

And the MIME type failure path (~line 392-395):

Old:
```typescript
    const mimeType = detectMimeType(imageResult.buffer, imageResult.contentType);
    if (!mimeType) {
      console.warn(`${LOG_PREFIX} Unsupported image type for ${candidate.url}`);
      failures++;
      continue;
    }
```

New:
```typescript
    const mimeType = detectMimeType(imageResult.buffer, imageResult.contentType);
    if (!mimeType) {
      console.warn(`${LOG_PREFIX} Unsupported image type for ${candidate.url}`);
      failures++;
      allCandidatesChecked = false;
      continue;
    }
```

- [ ] **Step 5: Update max-failures break to track**

In the max-failures check at top of loop (~lines 372-375):

Old:
```typescript
    if (failures >= MAX_FAILURES_PER_REQUEST) {
      console.warn(`${LOG_PREFIX} Max failures reached, stopping pipeline`);
      break;
    }
```

New:
```typescript
    if (failures >= MAX_FAILURES_PER_REQUEST) {
      console.warn(`${LOG_PREFIX} Max failures reached, stopping pipeline`);
      allCandidatesChecked = false;
      break;
    }
```

- [ ] **Step 6: Update end-of-loop return to compute `validated`**

Replace the final `return NULL_RESULT;` at the end of the function (~line 445):

Old:
```typescript
  return NULL_RESULT;
```

New:
```typescript
  return { coverUrl: null, coverSource: null, validated: allCandidatesChecked };
```

- [ ] **Step 7: Update community cover return to include `validated: true`**

Find the community cover early return (around line 339-342). It currently returns something like `{ coverUrl: communityUrl, coverSource: "community" }`. Add `validated: true`:

```typescript
      return { coverUrl: communityUrl, coverSource: "community", validated: true };
```

- [ ] **Step 8: Update Gemini YES return to include `validated: true`**

In the candidate loop, the Gemini "yes" verdict return (~line 420):

Old:
```typescript
        return { coverUrl: candidate.url, coverSource: candidate.source };
```

New:
```typescript
        return { coverUrl: candidate.url, coverSource: candidate.source, validated: true };
```

- [ ] **Step 9: Run tests**

Run: `npm test -- src/lib/__tests__/coverValidation.test.ts`
Expected: All tests pass

- [ ] **Step 10: Commit**

```bash
git add src/lib/coverValidation.ts
git commit -m "feat: track allCandidatesChecked for validated field, fix rate-limit break"
```

---

### Task 3: Fix callers — analyze/route.ts, con-mode-lookup, quick-lookup

**Files:**
- Modify: `src/app/api/analyze/route.ts:1075-1079`
- Modify: `src/app/api/con-mode-lookup/route.ts:210-214`
- Review: `src/app/api/quick-lookup/route.ts:227`

- [ ] **Step 1: Fix analyze/route.ts — always set coverValidated**

Replace lines 1075-1079:

Old:
```typescript
        if (pipelineResult.coverUrl) {
          comicDetails.coverImageUrl = pipelineResult.coverUrl;
          comicDetails.coverSource = pipelineResult.coverSource;
          comicDetails.coverValidated = true;
        }
```

New:
```typescript
        if (pipelineResult.coverUrl) {
          comicDetails.coverImageUrl = pipelineResult.coverUrl;
          comicDetails.coverSource = pipelineResult.coverSource;
        }
        comicDetails.coverValidated = pipelineResult.validated;
```

- [ ] **Step 2: Fix con-mode-lookup/route.ts — use validated field**

Replace the `coverValidated` line (~line 212):

Old:
```typescript
            coverValidated: pipelineResult?.coverUrl !== null, // true only if pipeline found a valid cover
```

New:
```typescript
            coverValidated: pipelineResult?.validated ?? false,
```

- [ ] **Step 3: Review quick-lookup/route.ts**

Verify line 227 — `coverValidated: false` for ComicVine covers. This is correct as-is (ComicVine covers aren't Gemini-validated). No change needed.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/api/analyze/route.ts src/app/api/con-mode-lookup/route.ts
git commit -m "fix: always set coverValidated from pipeline result, fix inverted logic in con-mode-lookup"
```

---

### Task 4: Add error path tests

**Files:**
- Modify: `src/lib/__tests__/coverValidation.test.ts`

- [ ] **Step 1: Add test — Gemini API key missing returns validated false**

```typescript
  it("returns validated=false when Gemini API key is missing", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
      if (opts?.method === "HEAD") {
        return Promise.resolve({ ok: false, headers: new Headers() });
      }
      return Promise.resolve({ ok: false, headers: new Headers() });
    });

    const result = await runCoverPipeline("Batman", "1", "2016", "DC", {
      ebayListings: [
        { itemId: "1", title: "Batman #1", price: 10, currency: "USD", condition: "New", itemUrl: "https://ebay.com/1", imageUrl: "https://i.ebayimg.com/images/g/abc/s-l1600.jpg" },
      ],
      // No geminiClient provided either
    });

    expect(result.coverUrl).toBeNull();
    expect(result.validated).toBe(false);

    if (originalKey) process.env.GEMINI_API_KEY = originalKey;
  });
```

- [ ] **Step 2: Add test — Gemini returns NO for all candidates**

```typescript
  it("returns validated=true when Gemini rejects all candidates with NO", async () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0x02]);

    global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
      if (opts?.method === "HEAD") {
        return Promise.resolve({ ok: false, headers: new Headers() });
      }
      if (typeof url === "string" && url.includes("ebayimg.com")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ "content-type": "image/jpeg", "content-length": "7" }),
          arrayBuffer: () => Promise.resolve(jpegBuffer.buffer),
        });
      }
      return Promise.resolve({ ok: false, headers: new Headers() });
    });

    const mockGeminiClient = {
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: jest.fn().mockResolvedValue({
          response: { text: () => "NO this is not Batman #1" },
        }),
      }),
    };

    const result = await runCoverPipeline("Batman", "1", "2016", "DC", {
      ebayListings: [
        { itemId: "1", title: "Batman #1", price: 10, currency: "USD", condition: "New", itemUrl: "https://ebay.com/1", imageUrl: "https://i.ebayimg.com/images/g/abc/s-l1600.jpg" },
      ],
      geminiClient: mockGeminiClient,
    });

    expect(result.coverUrl).toBeNull();
    expect(result.validated).toBe(true);
  });
```

- [ ] **Step 3: Add test — Gemini returns ambiguous for all candidates**

```typescript
  it("returns validated=true when Gemini returns ambiguous for all candidates", async () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0x02]);

    global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
      if (opts?.method === "HEAD") {
        return Promise.resolve({ ok: false, headers: new Headers() });
      }
      if (typeof url === "string" && url.includes("ebayimg.com")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ "content-type": "image/jpeg", "content-length": "7" }),
          arrayBuffer: () => Promise.resolve(jpegBuffer.buffer),
        });
      }
      return Promise.resolve({ ok: false, headers: new Headers() });
    });

    const mockGeminiClient = {
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: jest.fn().mockResolvedValue({
          response: { text: () => "AMBIGUOUS cannot determine" },
        }),
      }),
    };

    const result = await runCoverPipeline("Batman", "1", "2016", "DC", {
      ebayListings: [
        { itemId: "1", title: "Batman #1", price: 10, currency: "USD", condition: "New", itemUrl: "https://ebay.com/1", imageUrl: "https://i.ebayimg.com/images/g/abc/s-l1600.jpg" },
      ],
      geminiClient: mockGeminiClient,
    });

    expect(result.coverUrl).toBeNull();
    expect(result.validated).toBe(true);
  });
```

- [ ] **Step 4: Add test — network error on image fetch continues to next candidate**

Note: eBay candidate gathering only takes the FIRST listing, so we use different source types — eBay (bad fetch) + Open Library (good fetch) — to test fallthrough behavior.

```typescript
  it("continues to next candidate when image fetch fails", async () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0x02]);
    const openLibraryUrl = "https://covers.openlibrary.org/b/id/12345-L.jpg";

    global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
      // Open Library HEAD check returns valid URL
      if (opts?.method === "HEAD" && typeof url === "string" && url.includes("openlibrary.org")) {
        return Promise.resolve({ ok: true, headers: new Headers() });
      }
      if (opts?.method === "HEAD") {
        return Promise.resolve({ ok: false, headers: new Headers() });
      }
      // eBay image fetch fails
      if (typeof url === "string" && url.includes("ebayimg.com")) {
        return Promise.resolve({ ok: false, headers: new Headers() });
      }
      // Open Library image fetch succeeds
      if (typeof url === "string" && url.includes("openlibrary.org")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ "content-type": "image/jpeg", "content-length": "7" }),
          arrayBuffer: () => Promise.resolve(jpegBuffer.buffer),
        });
      }
      return Promise.resolve({ ok: false, headers: new Headers() });
    });

    const mockGeminiClient = {
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: jest.fn().mockResolvedValue({
          response: { text: () => "YES this is Batman #1" },
        }),
      }),
    };

    const result = await runCoverPipeline("Batman", "1", "2016", "DC", {
      ebayListings: [
        { itemId: "1", title: "Batman #1", price: 10, currency: "USD", condition: "New", itemUrl: "https://ebay.com/1", imageUrl: "https://i.ebayimg.com/bad-image.jpg" },
      ],
      geminiClient: mockGeminiClient,
    });

    expect(result.coverUrl).toBe(openLibraryUrl);
    expect(result.coverSource).toBe("openlibrary");
    expect(result.validated).toBe(true);
  });
```

- [ ] **Step 5: Add test — max failures reached returns validated false**

```typescript
  it("returns validated=false when max failures reached", async () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0x02]);

    global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
      if (opts?.method === "HEAD") {
        return Promise.resolve({ ok: false, headers: new Headers() });
      }
      if (typeof url === "string" && url.includes("ebayimg.com")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ "content-type": "image/jpeg", "content-length": "7" }),
          arrayBuffer: () => Promise.resolve(jpegBuffer.buffer),
        });
      }
      return Promise.resolve({ ok: false, headers: new Headers() });
    });

    const mockGeminiClient = {
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: jest.fn().mockRejectedValue(new Error("Gemini server error")),
      }),
    };

    const result = await runCoverPipeline("Batman", "1", "2016", "DC", {
      ebayListings: [
        { itemId: "1", title: "Batman #1", price: 10, currency: "USD", condition: "New", itemUrl: "https://ebay.com/1", imageUrl: "https://i.ebayimg.com/images/g/1/s-l1600.jpg" },
        { itemId: "2", title: "Batman #1", price: 10, currency: "USD", condition: "New", itemUrl: "https://ebay.com/2", imageUrl: "https://i.ebayimg.com/images/g/2/s-l1600.jpg" },
        { itemId: "3", title: "Batman #1", price: 10, currency: "USD", condition: "New", itemUrl: "https://ebay.com/3", imageUrl: "https://i.ebayimg.com/images/g/3/s-l1600.jpg" },
        { itemId: "4", title: "Batman #1", price: 10, currency: "USD", condition: "New", itemUrl: "https://ebay.com/4", imageUrl: "https://i.ebayimg.com/images/g/4/s-l1600.jpg" },
      ],
      geminiClient: mockGeminiClient,
    });

    expect(result.coverUrl).toBeNull();
    expect(result.validated).toBe(false);
  });
```

- [ ] **Step 6: Add test — image too large is skipped, continues to next candidate**

Note: eBay candidate gathering only takes the FIRST listing, so we use eBay (too large) + Open Library (normal size) to test that oversized images are skipped.

```typescript
  it("skips image that exceeds size limit and continues to next candidate", async () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0x02]);
    const openLibraryUrl = "https://covers.openlibrary.org/b/id/12345-L.jpg";

    global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
      // Open Library HEAD check returns valid URL
      if (opts?.method === "HEAD" && typeof url === "string" && url.includes("openlibrary.org")) {
        return Promise.resolve({ ok: true, headers: new Headers() });
      }
      if (opts?.method === "HEAD") {
        return Promise.resolve({ ok: false, headers: new Headers() });
      }
      // eBay image is too large (>5MB)
      if (typeof url === "string" && url.includes("ebayimg.com")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ "content-type": "image/jpeg", "content-length": "6000000" }),
          arrayBuffer: () => Promise.resolve(jpegBuffer.buffer),
        });
      }
      // Open Library image fetch succeeds with normal size
      if (typeof url === "string" && url.includes("openlibrary.org")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ "content-type": "image/jpeg", "content-length": "7" }),
          arrayBuffer: () => Promise.resolve(jpegBuffer.buffer),
        });
      }
      return Promise.resolve({ ok: false, headers: new Headers() });
    });

    const mockGeminiClient = {
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: jest.fn().mockResolvedValue({
          response: { text: () => "YES this is Batman #1" },
        }),
      }),
    };

    const result = await runCoverPipeline("Batman", "1", "2016", "DC", {
      ebayListings: [
        { itemId: "1", title: "Batman #1", price: 10, currency: "USD", condition: "New", itemUrl: "https://ebay.com/1", imageUrl: "https://i.ebayimg.com/images/g/big/s-l1600.jpg" },
      ],
      geminiClient: mockGeminiClient,
    });

    expect(result.coverUrl).toBe(openLibraryUrl);
    expect(result.coverSource).toBe("openlibrary");
    expect(result.validated).toBe(true);
  });
```

- [ ] **Step 7: Add test — invalid MIME type is skipped, continues to next candidate**

Note: Uses eBay (bad MIME — buffer doesn't start with JPEG/PNG magic bytes) + Open Library (valid JPEG) to test MIME type validation fallthrough.

```typescript
  it("skips image with invalid MIME type and continues to next candidate", async () => {
    const badBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]); // Not JPEG or PNG
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0x02]);
    const openLibraryUrl = "https://covers.openlibrary.org/b/id/12345-L.jpg";

    global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
      // Open Library HEAD check returns valid URL
      if (opts?.method === "HEAD" && typeof url === "string" && url.includes("openlibrary.org")) {
        return Promise.resolve({ ok: true, headers: new Headers() });
      }
      if (opts?.method === "HEAD") {
        return Promise.resolve({ ok: false, headers: new Headers() });
      }
      // eBay image returns bad MIME type
      if (typeof url === "string" && url.includes("ebayimg.com")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ "content-type": "application/octet-stream", "content-length": "7" }),
          arrayBuffer: () => Promise.resolve(badBuffer.buffer),
        });
      }
      // Open Library image fetch succeeds with valid JPEG
      if (typeof url === "string" && url.includes("openlibrary.org")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ "content-type": "image/jpeg", "content-length": "7" }),
          arrayBuffer: () => Promise.resolve(jpegBuffer.buffer),
        });
      }
      return Promise.resolve({ ok: false, headers: new Headers() });
    });

    const mockGeminiClient = {
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: jest.fn().mockResolvedValue({
          response: { text: () => "YES this is Batman #1" },
        }),
      }),
    };

    const result = await runCoverPipeline("Batman", "1", "2016", "DC", {
      ebayListings: [
        { itemId: "1", title: "Batman #1", price: 10, currency: "USD", condition: "New", itemUrl: "https://ebay.com/1", imageUrl: "https://i.ebayimg.com/images/g/bad/s-l1600.jpg" },
      ],
      geminiClient: mockGeminiClient,
    });

    expect(result.coverUrl).toBe(openLibraryUrl);
    expect(result.coverSource).toBe("openlibrary");
    expect(result.validated).toBe(true);
  });
```

- [ ] **Step 8: Add test — no candidates returns validated true**

```typescript
  it("returns validated=true when no candidates found", async () => {
    global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
      if (opts?.method === "HEAD") {
        return Promise.resolve({ ok: false, headers: new Headers() });
      }
      return Promise.resolve({ ok: false, headers: new Headers() });
    });

    const result = await runCoverPipeline("Batman", "1", "2016", "DC");

    expect(result.coverUrl).toBeNull();
    expect(result.validated).toBe(true);
  });
```

- [ ] **Step 9: Add test — community cover lookup throws, pipeline continues**

```typescript
  it("continues to candidate gathering when community cover lookup throws", async () => {
    mockGetCommunityCovers.mockRejectedValue(new Error("DB connection failed"));

    global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
      if (opts?.method === "HEAD") {
        return Promise.resolve({ ok: false, headers: new Headers() });
      }
      return Promise.resolve({ ok: false, headers: new Headers() });
    });

    const result = await runCoverPipeline("Batman", "1", "2016", "DC");

    expect(result.coverUrl).toBeNull();
    expect(result.validated).toBe(true);
  });
```

- [ ] **Step 10: Add test — community cover found sets validated true**

```typescript
  it("returns validated=true for community covers (no Gemini needed)", async () => {
    mockGetCommunityCovers.mockResolvedValue(
      "https://covers.openlibrary.org/community/batman1.jpg"
    );

    const result = await runCoverPipeline("Batman", "1", "2016", "DC");

    expect(result.validated).toBe(true);
    expect(result.coverUrl).toBe("https://covers.openlibrary.org/community/batman1.jpg");
    expect(result.coverSource).toBe("community");
  });
```

- [ ] **Step 11: Add test — Gemini rate limit returns validated false (MUST BE LAST TEST)**

> **IMPORTANT:** This test MUST be the last test in the describe block because it sets the module-level `rateLimitCooldownUntil` variable, which persists for 60s and cannot be reset from outside the module. Placing it last prevents it from polluting other tests.

Add to the END of the `runCoverPipeline` describe block:

```typescript
  // This test MUST be last — it sets module-level rateLimitCooldownUntil that persists for 60s
  it("returns validated=false when Gemini is rate-limited", async () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0x02]);

    global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
      if (opts?.method === "HEAD") {
        return Promise.resolve({ ok: false, headers: new Headers() });
      }
      if (typeof url === "string" && url.includes("ebayimg.com")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ "content-type": "image/jpeg", "content-length": "7" }),
          arrayBuffer: () => Promise.resolve(jpegBuffer.buffer),
        });
      }
      return Promise.resolve({ ok: false, headers: new Headers() });
    });

    const mockGeminiClient = {
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: jest.fn().mockRejectedValue(new Error("429 RATE_LIMIT")),
      }),
    };

    const result = await runCoverPipeline("Batman", "1", "2016", "DC", {
      ebayListings: [
        { itemId: "1", title: "Batman #1", price: 10, currency: "USD", condition: "New", itemUrl: "https://ebay.com/1", imageUrl: "https://i.ebayimg.com/images/g/abc/s-l1600.jpg" },
      ],
      geminiClient: mockGeminiClient,
    });

    expect(result.coverUrl).toBeNull();
    expect(result.validated).toBe(false);
  });
```

- [ ] **Step 12: Run all tests**

Run: `npm test -- src/lib/__tests__/coverValidation.test.ts`
Expected: All tests pass (existing + 11 new)

- [ ] **Step 13: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 14: Commit**

```bash
git add src/lib/__tests__/coverValidation.test.ts
git commit -m "test: add 11 error path tests for cover validation pipeline"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full quality check**

Run: `npm run check`
Expected: typecheck + lint + test all pass

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit any remaining changes**

If lint or typecheck required fixes, commit them.
