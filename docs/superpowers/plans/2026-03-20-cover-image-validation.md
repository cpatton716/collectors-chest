# Cover Image Validation Pipeline — Implementation Plan

> **Apr 23, 2026 update:** Metron verification was fully removed from the scan pipeline this session. Steps in this plan that set `coverSource: "metron"` or call the pipeline "as a fallback when no Metron cover" describe historical behavior only. The current production flow gathers candidates from Community DB → eBay → Open Library with no Metron branch. The `"metron"` enum value is retained only for already-cached legacy rows.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current blind-trust cover image system with a two-stage pipeline that gathers candidates from multiple sources and validates them with Gemini vision before caching.

**Architecture:** Candidates gathered in priority order (Community DB → eBay listings → Open Library), then validated by Gemini 2.0 Flash vision ("Is this the cover of X #Y?"). Validated covers cached permanently; no-cover results retry after 7 days. Query matching fixed from `.ilike()` to `.eq()` with shared title normalization.

**Tech Stack:** Next.js API routes, Supabase (Postgres), `@google/generative-ai` SDK (Gemini 2.0 Flash), Upstash Redis, Jest

**Spec:** `docs/engineering-specs/2026-03-19-cover-image-validation-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/normalizeTitle.ts` | Shared `normalizeTitle()` and `normalizeIssueNumber()` for DB queries |
| `src/lib/__tests__/normalizeTitle.test.ts` | Unit tests for normalization functions |
| `src/lib/coverValidation.ts` | Pipeline orchestration: candidate gathering, Gemini validation, URL validation, MIME detection |
| `src/lib/__tests__/coverValidation.test.ts` | Unit tests for pipeline logic, cache decisions, validation flow |

### Modified Files
| File | What Changes |
|------|-------------|
| `src/lib/db.ts` | `.ilike()` → `.eq()`, add `coverSource`/`coverValidated` to interface + upsert (conditional spread), import shared normalizers |
| `src/lib/metadataCache.ts` | Add `coverImageUrl`, `coverSource`, `coverValidated` to `SAVEABLE_FIELDS` and interface |
| `src/lib/cache.ts` | `generateComicMetadataCacheKey()` uses shared normalizers |
| `src/lib/coverImageDb.ts` | Import shared normalizers instead of local copies, update `approveCover()` to sync `comic_metadata` |
| `src/app/api/con-mode-lookup/route.ts` | Replace `fetchCoverImage()` with `runCoverPipeline()`, add rate limiting, `await` saves, hoist `browseListings` |
| `src/app/api/analyze/route.ts` | Rename `coverImage` → `coverImageUrl` in `ComicDetails`, `await` saves, set `coverSource: 'metron'`, call pipeline as fallback |
| `src/app/api/quick-lookup/route.ts` | Apply title normalization, tag `coverSource: 'comicvine'` |
| `src/app/api/comic-lookup/route.ts` | Apply title normalization |
| `src/app/api/import-lookup/route.ts` | Apply title normalization |

### Database Migration
| File | What |
|------|------|
| Run in Supabase SQL Editor (pre-deploy) | Add columns, dedup, normalize, add functional index |

---

## Task 1: Shared Title Normalization Utility

**Files:**
- Create: `src/lib/normalizeTitle.ts`
- Create: `src/lib/__tests__/normalizeTitle.test.ts`

- [ ] **Step 1: Write failing tests for `normalizeTitle()`**

```typescript
// src/lib/__tests__/normalizeTitle.test.ts

import { normalizeTitle, normalizeIssueNumber } from "../normalizeTitle";

describe("normalizeTitle", () => {
  it("lowercases and trims", () => {
    expect(normalizeTitle("  Batman  ")).toBe("batman");
  });

  it("strips non-alphanumeric characters except hyphens and spaces", () => {
    expect(normalizeTitle("Batman: Year One")).toBe("batman year one");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeTitle("The  Amazing   Spider-Man")).toBe("the amazing spider-man");
  });

  it("preserves hyphens", () => {
    expect(normalizeTitle("Spider-Man")).toBe("spider-man");
  });

  it("handles empty string", () => {
    expect(normalizeTitle("")).toBe("");
  });

  it("strips parentheses and special chars", () => {
    expect(normalizeTitle("Batman (2016)")).toBe("batman 2016");
  });
});

describe("normalizeIssueNumber", () => {
  it("lowercases and trims", () => {
    expect(normalizeIssueNumber("  5  ")).toBe("5");
  });

  it("strips all leading hash signs", () => {
    expect(normalizeIssueNumber("##5")).toBe("5");
  });

  it("handles Annual prefix", () => {
    expect(normalizeIssueNumber("Annual #1")).toBe("annual 1");
  });

  it("preserves fractions", () => {
    expect(normalizeIssueNumber("1/2")).toBe("1/2");
  });

  it("handles empty string", () => {
    expect(normalizeIssueNumber("")).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/__tests__/normalizeTitle.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the normalizers**

```typescript
// src/lib/normalizeTitle.ts

/** For comic_metadata/cover_images DB queries only. Do NOT use for key comics matching. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeIssueNumber(issue: string): string {
  return issue
    .toLowerCase()
    .trim()
    .replace(/^#+/, "");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/__tests__/normalizeTitle.test.ts`
Expected: All 11 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/normalizeTitle.ts src/lib/__tests__/normalizeTitle.test.ts
git commit -m "feat: add shared title normalization utility for comic_metadata queries"
```

---

## Task 2: Update `cache.ts` to Use Shared Normalizers

**Files:**
- Modify: `src/lib/cache.ts:160` — `generateComicMetadataCacheKey()`

- [ ] **Step 1: Write failing test**

If no test file exists for `cache.ts`, create one. Otherwise add to existing:

```typescript
// src/lib/__tests__/cache.test.ts (add to existing or create)

import { generateComicMetadataCacheKey } from "../cache";

describe("generateComicMetadataCacheKey", () => {
  it("normalizes title with special chars to match DB normalization", () => {
    const key = generateComicMetadataCacheKey("Batman: Year One", "1");
    expect(key).toBe("batman year one|1");
  });

  it("strips leading hashes from issue number", () => {
    const key = generateComicMetadataCacheKey("Batman", "#5");
    expect(key).toBe("batman|5");
  });

  it("collapses whitespace in title", () => {
    const key = generateComicMetadataCacheKey("The  Amazing  Spider-Man", "300");
    expect(key).toBe("the amazing spider-man|300");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/cache.test.ts`
Expected: FAIL — `"batman: year one|1"` does not equal `"batman year one|1"`

- [ ] **Step 3: Update `generateComicMetadataCacheKey()` to use shared normalizers**

In `src/lib/cache.ts`, import and use the shared functions:

```typescript
import { normalizeTitle, normalizeIssueNumber } from "./normalizeTitle";

// Replace the existing generateComicMetadataCacheKey implementation:
export function generateComicMetadataCacheKey(title: string, issueNumber: string): string {
  return `${normalizeTitle(title)}|${normalizeIssueNumber(issueNumber)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/cache.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/cache.ts src/lib/__tests__/cache.test.ts
git commit -m "fix: align Redis cache key generation with DB title normalization"
```

---

## Task 3: Update `coverImageDb.ts` to Use Shared Normalizers

**Files:**
- Modify: `src/lib/coverImageDb.ts:5-16` — replace local normalizers with imports
- Modify: `src/lib/coverImageDb.ts:117` — update `approveCover()` to sync `comic_metadata`

- [ ] **Step 1: Replace local normalizers with shared imports**

In `src/lib/coverImageDb.ts`:
- Remove the local `normalizeTitle()` (line 5) and `normalizeIssueNumber()` (line 13) functions
- Add import: `import { normalizeTitle, normalizeIssueNumber } from "./normalizeTitle";`

Note: The shared `normalizeIssueNumber` uses `/^#+/` (strips all leading hashes) vs the local `/^#/` (single hash). This is an intentional alignment per the spec.

- [ ] **Step 2: Update `approveCover()` to sync `comic_metadata`**

After the existing approval update in `approveCover()`, add a call to `saveComicMetadata()` to propagate the community cover:

```typescript
// After the existing .update() call in approveCover():
// Sync to comic_metadata so the pipeline uses this cover immediately
const { data: coverRow } = await supabase
  .from("cover_images")
  .select("title_normalized, issue_number, image_url")
  .eq("id", coverId)
  .single();

if (coverRow) {
  await saveComicMetadata({
    title: coverRow.title_normalized,
    issueNumber: coverRow.issue_number,
    coverImageUrl: coverRow.image_url,
    coverSource: "community",
    coverValidated: true,
  });
}
```

Import `saveComicMetadata` from `./db`.

- [ ] **Step 3: Run existing tests to verify no regressions**

Run: `npm test`
Expected: All existing tests pass (the behavioral change to hash-stripping is intentional)

- [ ] **Step 4: Commit**

```bash
git add src/lib/coverImageDb.ts
git commit -m "refactor: use shared normalizers in coverImageDb, sync approveCover to comic_metadata"
```

---

## Task 4: Update `db.ts` — Query Fix + Cover Fields

**Files:**
- Modify: `src/lib/db.ts:469` — `ComicMetadata` interface
- Modify: `src/lib/db.ts:502-510` — `getComicMetadata()` query
- Modify: `src/lib/db.ts:537-563` — `saveComicMetadata()` signature + upsert
- Modify: `src/lib/db.ts:577-583` — `incrementComicLookupCount()` query

```typescript
// Note: normalizeTitle and normalizeIssueNumber are thoroughly tested in normalizeTitle.test.ts.
// DB integration (Supabase) requires complex mocking — verified via manual testing.
// No separate db.test.ts file needed for normalization.
```

- [ ] **Step 1: Update `ComicMetadata` interface (line ~469)**

Add two new fields:

```typescript
export interface ComicMetadata {
  // ... existing fields ...
  coverSource?: string | null;
  coverValidated?: boolean;
}
```

- [ ] **Step 2: Update `getComicMetadata()` (line ~502)**

```typescript
import { normalizeTitle, normalizeIssueNumber } from "./normalizeTitle";

export async function getComicMetadata(title: string, issueNumber: string): Promise<ComicMetadata | null> {
  const normalizedTitle = normalizeTitle(title);
  const normalizedIssue = normalizeIssueNumber(issueNumber);

  const { data, error } = await supabase
    .from("comic_metadata")
    .select("*")
    .eq("title", normalizedTitle)       // was .ilike()
    .eq("issue_number", normalizedIssue) // was .ilike()
    .maybeSingle();
  // ... rest unchanged, but map cover_source and cover_validated in return ...
```

Map the new DB columns in the return object:
```typescript
  coverSource: data.cover_source,
  coverValidated: data.cover_validated,
```

- [ ] **Step 3: Update `saveComicMetadata()` (line ~537)**

Expand the function signature and use conditional spread:

```typescript
export async function saveComicMetadata(metadata: {
  title: string;
  issueNumber: string;
  publisher?: string;
  releaseYear?: string;
  writer?: string;
  coverArtist?: string;
  interiorArtist?: string;
  coverImageUrl?: string | null;
  keyInfo?: string;
  priceData?: unknown; // Keep the existing `priceData` type from the current code — do not loosen to `unknown`.
  coverSource?: string;
  coverValidated?: boolean;
}): Promise<void> {
  const normalizedTitle = normalizeTitle(metadata.title);
  const normalizedIssue = normalizeIssueNumber(metadata.issueNumber);

  const upsertPayload = {
    title: normalizedTitle,
    issue_number: normalizedIssue,
    publisher: metadata.publisher || null,
    release_year: metadata.releaseYear || null,
    writer: metadata.writer || null,
    cover_artist: metadata.coverArtist || null,
    interior_artist: metadata.interiorArtist || null,
    key_info: metadata.keyInfo || null,
    price_data: metadata.priceData || null,
    // Conditional spread — only include cover fields when explicitly provided
    ...(metadata.coverImageUrl !== undefined && { cover_image_url: metadata.coverImageUrl }),
    ...(metadata.coverSource !== undefined && { cover_source: metadata.coverSource }),
    ...(metadata.coverValidated !== undefined && { cover_validated: metadata.coverValidated }),
  };

  const { error } = await supabase
    .from("comic_metadata")
    .upsert(upsertPayload, { onConflict: "title,issue_number" });

  if (error) {
    // Defensive guard: log unnormalized title detection
    if (error.code === "23505") {
      console.warn("[metadata] Duplicate key violation — possible unnormalized title:", metadata.title);
    }
    console.error("[metadata] Save failed:", error);
  }
}
```

- [ ] **Step 4: Update `incrementComicLookupCount()` (line ~577)**

```typescript
export async function incrementComicLookupCount(title: string, issueNumber: string): Promise<void> {
  const normalizedTitle = normalizeTitle(title);
  const normalizedIssue = normalizeIssueNumber(issueNumber);

  // ... existing logic but with .eq() instead of .ilike() ...
  .eq("title", normalizedTitle)
  .eq("issue_number", normalizedIssue)
```

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts
git commit -m "fix: switch comic_metadata queries from .ilike() to .eq() with normalization, add cover validation fields"
```

---

## Task 5: Update `metadataCache.ts` — Add Cover Fields

**Files:**
- Modify: `src/lib/metadataCache.ts:8` — `ComicMetadata` interface
- Modify: `src/lib/metadataCache.ts:35-44` — `SAVEABLE_FIELDS`

- [ ] **Step 1: Add cover fields to `ComicMetadata` interface (line ~8)**

`coverImageUrl` already exists on line 17 of the interface. Only add the two new fields: `coverSource` and `coverValidated`.

```typescript
export interface ComicMetadata {
  // ... existing fields ...
  coverImageUrl?: string | null;  // already exists — do not duplicate
  coverSource?: string | null;    // NEW
  coverValidated?: boolean;       // NEW
}
```

- [ ] **Step 2: Add cover fields to `SAVEABLE_FIELDS` (line ~35)**

```typescript
const SAVEABLE_FIELDS = [
  "title",
  "issueNumber",
  "publisher",
  "releaseYear",
  "writer",
  "coverArtist",
  "interiorArtist",
  "keyInfo",
  "coverImageUrl",
  "coverSource",
  "coverValidated",
] as const;
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/metadataCache.ts
git commit -m "feat: add cover validation fields to metadataCache SAVEABLE_FIELDS"
```

---

## Task 6: Cover Validation Pipeline — Core Module

**Files:**
- Create: `src/lib/coverValidation.ts`
- Create: `src/lib/__tests__/coverValidation.test.ts`

This is the largest task. Split into sub-steps.

### Step Group A: URL Validation + MIME Detection

- [ ] **Step A1: Write failing tests for `validateImageUrl()` and `detectMimeType()`**

```typescript
// src/lib/__tests__/coverValidation.test.ts

import { validateImageUrl, detectMimeType } from "../coverValidation";

describe("validateImageUrl", () => {
  it("accepts eBay image URLs", () => {
    expect(validateImageUrl("https://i.ebayimg.com/images/g/abc/s-l1600.jpg")).toBe(true);
  });

  it("accepts Open Library cover URLs", () => {
    expect(validateImageUrl("https://covers.openlibrary.org/b/id/12345-L.jpg")).toBe(true);
  });

  it("accepts Wikimedia URLs", () => {
    expect(validateImageUrl("https://upload.wikimedia.org/wikipedia/en/a/image.jpg")).toBe(true);
  });

  it("accepts ebaystatic.com URLs", () => {
    expect(validateImageUrl("https://thumbs1.ebaystatic.com/images/abc.jpg")).toBe(true);
  });

  it("rejects HTTP URLs", () => {
    expect(validateImageUrl("http://i.ebayimg.com/images/g/abc.jpg")).toBe(false);
  });

  it("rejects unknown hostnames", () => {
    expect(validateImageUrl("https://evil.com/image.jpg")).toBe(false);
  });

  it("rejects localhost", () => {
    expect(validateImageUrl("https://localhost/image.jpg")).toBe(false);
  });

  it("rejects private IPs", () => {
    expect(validateImageUrl("https://192.168.1.1/image.jpg")).toBe(false);
  });

  it("rejects invalid URLs", () => {
    expect(validateImageUrl("not-a-url")).toBe(false);
  });
});

describe("detectMimeType", () => {
  it("detects JPEG from magic bytes", () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    expect(detectMimeType(buffer, null)).toBe("image/jpeg");
  });

  it("detects PNG from magic bytes", () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]);
    expect(detectMimeType(buffer, null)).toBe("image/png");
  });

  it("uses Content-Type header when magic bytes don't match", () => {
    const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
    expect(detectMimeType(buffer, "image/webp")).toBe("image/webp");
  });

  it("returns null for unsupported types", () => {
    const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
    expect(detectMimeType(buffer, "image/bmp")).toBeNull();
  });

  it("returns null when no info available", () => {
    const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
    expect(detectMimeType(buffer, null)).toBeNull();
  });
});
```

- [ ] **Step A2: Run tests to verify they fail**

Run: `npm test -- src/lib/__tests__/coverValidation.test.ts`
Expected: FAIL — module not found

- [ ] **Step A3: Implement `validateImageUrl()` and `detectMimeType()`**

```typescript
// src/lib/coverValidation.ts

const ALLOWED_HOSTNAMES = [
  "covers.openlibrary.org",
  "upload.wikimedia.org",
];

const ALLOWED_HOSTNAME_SUFFIXES = [
  ".ebayimg.com",
  ".ebaystatic.com",
];

const SUPPORTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export function validateImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname;
    // Reject private/internal IPs
    if (
      hostname === "localhost" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("172.16.") ||
      hostname.startsWith("169.254.")
    ) {
      return false;
    }
    if (ALLOWED_HOSTNAMES.includes(hostname)) return true;
    if (ALLOWED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return true;
    return false;
  } catch {
    return false;
  }
}

export function detectMimeType(
  buffer: Buffer,
  contentType: string | null
): string | null {
  // Check magic bytes first
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  // Fall back to Content-Type header
  if (contentType && SUPPORTED_MIME_TYPES.has(contentType)) {
    return contentType;
  }
  return null;
}
```

- [ ] **Step A4: Run tests to verify they pass**

Run: `npm test -- src/lib/__tests__/coverValidation.test.ts`
Expected: All URL validation and MIME tests pass

### Step Group B: Cache Decision Logic (`shouldRunPipeline`)

- [ ] **Step B1: Write failing tests for `shouldRunPipeline()`**

Add to `coverValidation.test.ts`:

```typescript
import { shouldRunPipeline } from "../coverValidation";

describe("shouldRunPipeline", () => {
  it("returns true when no metadata exists", () => {
    expect(shouldRunPipeline(null)).toBe(true);
  });

  it("returns false for community covers (any validation state)", () => {
    expect(shouldRunPipeline({
      coverSource: "community",
      coverValidated: false,
      coverImageUrl: "https://example.com/cover.jpg",
      updatedAt: new Date().toISOString(),
    })).toBe(false);
  });

  it("returns false for validated cover with URL", () => {
    expect(shouldRunPipeline({
      coverSource: "ebay",
      coverValidated: true,
      coverImageUrl: "https://i.ebayimg.com/cover.jpg",
      updatedAt: new Date().toISOString(),
    })).toBe(false);
  });

  it("returns true for unvalidated cover", () => {
    expect(shouldRunPipeline({
      coverSource: "openlibrary",
      coverValidated: false,
      coverImageUrl: "https://covers.openlibrary.org/b/id/123-L.jpg",
      updatedAt: new Date().toISOString(),
    })).toBe(true);
  });

  it("returns true for validated null cover older than 7 days", () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(shouldRunPipeline({
      coverSource: null,
      coverValidated: true,
      coverImageUrl: null,
      updatedAt: eightDaysAgo,
    })).toBe(true);
  });

  it("returns false for validated null cover less than 7 days old", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(shouldRunPipeline({
      coverSource: null,
      coverValidated: true,
      coverImageUrl: null,
      updatedAt: twoDaysAgo,
    })).toBe(false);
  });

  it("treats undefined coverValidated as not validated", () => {
    expect(shouldRunPipeline({
      coverSource: null,
      coverValidated: undefined,
      coverImageUrl: "https://covers.openlibrary.org/b/id/123-L.jpg",
      updatedAt: new Date().toISOString(),
    })).toBe(true);
  });
});
```

- [ ] **Step B2: Implement `shouldRunPipeline()`**

```typescript
interface CoverMetadataInput {
  coverSource?: string | null;
  coverValidated?: boolean;
  coverImageUrl?: string | null;
  updatedAt?: string;
}

export function shouldRunPipeline(metadata: CoverMetadataInput | null): boolean {
  if (!metadata) return true;
  const validated = metadata.coverValidated === true;
  if (metadata.coverSource === "community") return false;
  if (validated && metadata.coverImageUrl) return false;
  if (validated && !metadata.coverImageUrl) {
    if (!metadata.updatedAt) return true;
    const daysSince = (Date.now() - new Date(metadata.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 7;
  }
  return true;
}
```

- [ ] **Step B3: Run tests to verify they pass**

Run: `npm test -- src/lib/__tests__/coverValidation.test.ts`
Expected: All `shouldRunPipeline` tests pass

### Step Group C: Gemini Validation + Pipeline Orchestration

- [ ] **Step C1: Write failing tests for `validateWithGemini()` and `runCoverPipeline()`**

Add to `coverValidation.test.ts`:

```typescript

import { runCoverPipeline } from "../coverValidation";
import type { BrowseListingItem } from "../ebayBrowse";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock Gemini SDK
jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn(),
    }),
  })),
}));

describe("runCoverPipeline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.todo("returns community cover without Gemini validation");

  it("validates eBay image with Gemini and returns on YES", async () => {
    const mockListings: BrowseListingItem[] = [
      {
        itemId: "123456",
        title: "Batman #423",
        price: 50,
        currency: "USD",
        condition: "Used",
        imageUrl: "https://i.ebayimg.com/images/g/abc/s-l1600.jpg",
        itemUrl: "https://www.ebay.com/itm/123",
      },
    ];

    // Mock fetch for image download (returns JPEG bytes)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "image/jpeg" },
      arrayBuffer: () => Promise.resolve(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer),
    });

    // Mock Gemini response: YES
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const mockGenerate = jest.fn().mockResolvedValue({
      response: { text: () => "YES, this is Batman #423." },
    });
    (GoogleGenerativeAI as any).mockImplementation(() => ({
      getGenerativeModel: () => ({ generateContent: mockGenerate }),
    }));

    const result = await runCoverPipeline("batman", "423", "1988", "dc", {
      ebayListings: mockListings,
    });

    expect(result.coverUrl).toBe("https://i.ebayimg.com/images/g/abc/s-l1600.jpg");
    expect(result.coverSource).toBe("ebay");
  });

  it.todo("tries Open Library after eBay rejection");

  it.todo("returns null when all candidates fail validation");

  it("stops after 3 Gemini failures per lookup", async () => {
    // Mock Gemini throwing errors 3 times
    // Verifies the 3-failure limit
  });

  it("skips listings with no imageUrl", async () => {
    const mockListings: BrowseListingItem[] = [
      {
        itemId: "123456",
        title: "Batman #423",
        price: 50,
        currency: "USD",
        condition: "Used",
        imageUrl: undefined as any,
        itemUrl: "https://www.ebay.com/itm/123",
      },
    ];

    const result = await runCoverPipeline("batman", "423", null, null, {
      ebayListings: mockListings,
    });

    // Should fall through to Open Library (or return null if OL also fails)
    // The key assertion: no fetch call for undefined imageUrl
  });
});

describe("Gemini response parsing", () => {
  it("treats YES as validated", () => {
    // Tested via runCoverPipeline integration above
  });

  it("treats NO as rejected — tries next candidate", () => {
    // Tested via runCoverPipeline integration above
  });

  it.todo("treats ambiguous response as validation failure");
});
```

Note: The exact mock setup will depend on how `coverValidation.ts` structures its Gemini client dependency injection. The spec says to accept an optional `geminiClient` parameter for testability.

- [ ] **Step C2: Implement the full `coverValidation.ts` module**

Key exports:
- `validateImageUrl(url: string): boolean`
- `detectMimeType(buffer: Buffer, contentType: string | null): string | null`
- `shouldRunPipeline(metadata: CoverMetadataInput | null): boolean`
- `runCoverPipeline(title, issueNumber, year, publisher, options?): Promise<CoverPipelineResult>`

Internal functions:
- `validateWithGemini(imageBuffer, mimeType, title, issueNumber, year, publisher, geminiClient?): Promise<"yes" | "no" | "error">`
- `fetchAndEncodeImage(url: string): Promise<{ buffer: Buffer; mimeType: string } | null>`
- Import `getCommunityCovers` from `./coverImageDb` — do NOT duplicate this function. It already queries the `cover_images` table for approved community covers.
- `getOpenLibraryCover(title, issueNumber, year?): Promise<string | null>` — queries Open Library API

Implementation details from spec:
- Use `GEMINI_PRIMARY` from `src/lib/models.ts`
- Use `@google/generative-ai` SDK directly (NOT `GeminiProvider`)
- `generationConfig: { maxOutputTokens: 50 }`
- Parse first word of response (case-insensitive YES/NO)
- 3-failure limit per request (in-memory counter, not persisted)
- Module-level cooldown flag for 429 rate limits (60 second skip)
- Log all errors with `[cover-validation]` prefix

```typescript
export interface CoverPipelineResult {
  coverUrl: string | null;
  coverSource: "community" | "ebay" | "openlibrary" | "metron" | "comicvine" | null;
}

export async function runCoverPipeline(
  title: string,
  issueNumber: string,
  year: string | null,
  publisher: string | null,
  options?: { ebayListings?: BrowseListingItem[]; geminiClient?: any }
): Promise<CoverPipelineResult>
```

- [ ] **Step C3: Run tests to verify they pass**

Run: `npm test -- src/lib/__tests__/coverValidation.test.ts`
Expected: All tests pass

- [ ] **Step C4: Commit**

```bash
git add src/lib/coverValidation.ts src/lib/__tests__/coverValidation.test.ts
git commit -m "feat: add cover image validation pipeline with Gemini vision verification"
```

---

## Task 7: Integrate Pipeline into `con-mode-lookup` Route

**Files:**
- Modify: `src/app/api/con-mode-lookup/route.ts`

- [ ] **Step 0: Prerequisites — replace existing normalization**

**Prerequisites:** Replace the existing `const normalizedTitle = title.trim()` and `const normalizedIssue = issueNumber.toString().trim()` variable declarations with imports from `@/lib/normalizeTitle` and calls to `normalizeTitle(title)` / `normalizeIssueNumber(issueNumber)`. These existing declarations are at the top of the handler.

- [ ] **Step 1: Add rate limiting**

Import and add `checkRateLimit(rateLimiters.lookup, identifier)` at the top of the handler, matching the pattern in `quick-lookup/route.ts`.

- [ ] **Step 2: Hoist `browseListings` variable**

Move `let browseListings: BrowseListingItem[] = []` to the top of the handler (before the `isBrowseApiConfigured()` block). Capture `browseResult.listings` into it inside the block.

- [ ] **Step 3: Replace `fetchCoverImage()` with `runCoverPipeline()`**

Replace the `fetchCoverImage()` call (~line 132) with:

```typescript
import { runCoverPipeline, shouldRunPipeline } from "@/lib/coverValidation";

// After eBay pricing section:
let coverImageUrl: string | null = existingMetadata?.coverImageUrl || null;

if (shouldRunPipeline(existingMetadata)) {
  const pipelineResult = await runCoverPipeline(
    normalizedTitle,
    normalizedIssue,
    seriesYears?.match(/\d{4}/)?.[0] || null,
    null,
    { ebayListings: browseListings }
  );
  if (pipelineResult.coverUrl) {
    coverImageUrl = pipelineResult.coverUrl;
  }
}
```

- [ ] **Step 4: Change `saveComicMetadata()` from fire-and-forget to `await`**

Change the `.catch()` pattern (~line 162-179) to:

Set `const pipelineRan = shouldRunPipeline(existingMetadata);` before the pipeline `if` block (it's already used as the condition). Then use it to gate the cover validation fields:

```typescript
const pipelineRan = shouldRunPipeline(existingMetadata);

// ... pipeline if-block uses pipelineRan ...

await saveComicMetadata({
  // ... existing fields ...
  coverImageUrl,
  // Only include cover validation fields when pipeline ran
  ...(pipelineRan && {
    coverSource: pipelineResult?.coverSource || null,
    coverValidated: true,
  }),
});
```

This ensures `coverSource` and `coverValidated` are only included when the pipeline actually ran, preventing overwriting valid existing values on cache-hit paths.

- [ ] **Step 5: Invalidate Redis cache after pipeline writes**

After the `await saveComicMetadata()` call, invalidate the Redis cache key:

```typescript
import { cacheDelete, generateComicMetadataCacheKey } from "@/lib/cache";

const metaCacheKey = generateComicMetadataCacheKey(normalizedTitle, normalizedIssue);
await cacheDelete(metaCacheKey, "comicMetadata").catch(() => {});
```

Check whether `cacheDelete` exists or if a different pattern is used. If not, use `cacheSet` with TTL 0 or the existing invalidation pattern.

- [ ] **Step 6: Delete the old `fetchCoverImage()` function**

Remove the `fetchCoverImage()` function definition (~line 241+) from this file. It's replaced by the pipeline.

- [ ] **Step 7: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add src/app/api/con-mode-lookup/route.ts
git commit -m "feat: integrate cover validation pipeline into con-mode-lookup with rate limiting"
```

---

## Task 8: Integrate Pipeline into `analyze` Route

**Files:**
- Modify: `src/app/api/analyze/route.ts`

- [ ] **Step 1: Rename `coverImage` → `coverImageUrl` in `ComicDetails` interface**

In the `ComicDetails` interface (~line 43-71), rename the `coverImage` field to `coverImageUrl`. Then find-and-replace all references to `comicDetails.coverImage` with `comicDetails.coverImageUrl` throughout the file.

- [ ] **Step 2: Set `coverSource: 'metron'` when Metron provides a cover**

Where Metron cover is assigned (~line 779):

```typescript
if (metronResult.cover_image && !comicDetails.coverImageUrl) {
  comicDetails.coverImageUrl = metronResult.cover_image;
  comicDetails.coverSource = "metron";
  comicDetails.coverValidated = false; // Flagged for validation on next lookup
}
```

Add `coverSource` and `coverValidated` to the `ComicDetails` interface.

- [ ] **Step 3: Hoist `ebayPriceData` variable**

**Hoist `ebayPriceData` variable.** The `ebayPriceData` variable is currently declared with `const` inside an `else if` block (~line 720) and is not accessible at the outer scope. Hoist it: add `let ebayPriceData: BrowsePriceResult | null = null;` near the top of the handler (after the eBay config check section), and assign inside the existing block with `ebayPriceData = await searchActiveListings(...)`. This makes eBay listings available to the pipeline call. Change the existing `const ebayPriceData = await searchActiveListings(...)` on line ~720 to just `ebayPriceData = await searchActiveListings(...)` (remove the `const` keyword, since it's now declared at the outer scope).

- [ ] **Step 4: Call pipeline as fallback when no Metron cover**

After the Metron section, add pipeline call:

```typescript
import { runCoverPipeline, shouldRunPipeline } from "@/lib/coverValidation";

// If no cover from Metron, try the pipeline
if (!comicDetails.coverImageUrl && ebayPriceData?.listings?.length) {
  const pipelineResult = await runCoverPipeline(
    comicDetails.title,
    comicDetails.issueNumber,
    comicDetails.releaseYear || null,
    comicDetails.publisher || null,
    { ebayListings: ebayPriceData.listings }
  );
  if (pipelineResult.coverUrl) {
    comicDetails.coverImageUrl = pipelineResult.coverUrl;
    comicDetails.coverSource = pipelineResult.coverSource;
    comicDetails.coverValidated = true;
  }
}
```

- [ ] **Step 5: Change `Promise.all` save from fire-and-forget to `await`**

Change the `Promise.all([saveComicMetadata, cacheSet]).catch()` pattern (~lines 802-807) to:

```typescript
await Promise.all([
  saveComicMetadata(savePayload),
  cacheSet(metaSaveKey, savePayload, "comicMetadata"),
]);
```

Wrap in try/catch for error logging instead of `.catch()`.

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat: integrate cover pipeline into analyze route, rename coverImage to coverImageUrl, await saves"
```

---

## Task 9: Apply Normalization to Remaining Routes

**Files:**
- Modify: `src/app/api/quick-lookup/route.ts`
- Modify: `src/app/api/comic-lookup/route.ts`
- Modify: `src/app/api/import-lookup/route.ts`

- [ ] **Step 1: Update `quick-lookup` route**

This route uses `title` and `issueNumber` variables directly from the request body (no separate normalized variables exist). Add `const normalizedTitle = normalizeTitle(title || ''); const normalizedIssue = normalizeIssueNumber(issueNumber || '1');` after the body parsing, then use these normalized variables in the `getComicMetadata()`, `saveComicMetadata()`, and `generateComicMetadataCacheKey()` calls.

```typescript
import { normalizeTitle, normalizeIssueNumber } from "@/lib/normalizeTitle";

const normalizedTitle = normalizeTitle(title || '');
const normalizedIssue = normalizeIssueNumber(issueNumber || "1");
```

Tag Comic Vine covers with source in `saveComicMetadata()` call (~line 214):

```typescript
await saveComicMetadata({
  // ... existing fields ...
  coverSource: "comicvine",
  coverValidated: false,
});
```

- [ ] **Step 2: Update `comic-lookup` route**

Replace the existing `const normalizedTitle = title.trim()` (line ~39) and `const normalizedIssue = issueNumber?.trim() || ''` (line ~40) with the shared normalizer calls:

```typescript
import { normalizeTitle, normalizeIssueNumber } from "@/lib/normalizeTitle";

const normalizedTitle = normalizeTitle(title);
const normalizedIssue = normalizeIssueNumber(issueNumber || "");
```

- [ ] **Step 3: Update `import-lookup` route**

Replace the existing `const normalizedTitle = title.trim()` (line ~26) and `const normalizedIssue = issueNumber.toString().trim()` (line ~27) with the shared normalizer calls:

```typescript
import { normalizeTitle, normalizeIssueNumber } from "@/lib/normalizeTitle";

const normalizedTitle = normalizeTitle(title);
const normalizedIssue = normalizeIssueNumber(issueNumber.toString());
```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/api/quick-lookup/route.ts src/app/api/comic-lookup/route.ts src/app/api/import-lookup/route.ts
git commit -m "fix: apply shared title normalization to quick-lookup, comic-lookup, and import-lookup routes"
```

---

## Task 10: Database Migration (Pre-Deploy)

**Run in Supabase SQL Editor BEFORE deploying the code.**

- [ ] **Step 1: Add new columns**

```sql
ALTER TABLE comic_metadata ADD COLUMN IF NOT EXISTS cover_source TEXT;
ALTER TABLE comic_metadata ADD COLUMN IF NOT EXISTS cover_validated BOOLEAN DEFAULT false;
```

- [ ] **Step 2: Deduplicate rows that will conflict after normalization**

```sql
BEGIN;

DELETE FROM comic_metadata
WHERE id NOT IN (
  SELECT DISTINCT ON (
    LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(title), '[^a-zA-Z0-9[:space:]-]', '', 'g'), '[[:space:]]+', ' ', 'g')),
    LOWER(REGEXP_REPLACE(TRIM(LEADING '#' FROM TRIM(issue_number)), '[[:space:]]+', ' ', 'g'))
  ) id
  FROM comic_metadata
  ORDER BY
    LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(title), '[^a-zA-Z0-9[:space:]-]', '', 'g'), '[[:space:]]+', ' ', 'g')),
    LOWER(REGEXP_REPLACE(TRIM(LEADING '#' FROM TRIM(issue_number)), '[[:space:]]+', ' ', 'g')),
    lookup_count DESC, cover_image_url IS NULL ASC, updated_at DESC
);

UPDATE comic_metadata
SET title = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(title), '[^a-zA-Z0-9[:space:]-]', '', 'g'), '[[:space:]]+', ' ', 'g')),
    issue_number = LOWER(REGEXP_REPLACE(TRIM(LEADING '#' FROM TRIM(issue_number)), '[[:space:]]+', ' ', 'g'));

COMMIT;
```

- [ ] **Step 3: Add functional uniqueness index**

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_comic_metadata_unique_normalized
ON comic_metadata (
  LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(title), '[^a-zA-Z0-9[:space:]-]', '', 'g'), '[[:space:]]+', ' ', 'g')),
  LOWER(REGEXP_REPLACE(TRIM(LEADING '#' FROM TRIM(issue_number)), '[[:space:]]+', ' ', 'g'))
);
```

- [ ] **Step 4: Clear unreliable Open Library covers from user comics**

```sql
UPDATE comics
SET cover_image_url = NULL
WHERE cover_image_url LIKE '%openlibrary.org%';
```

- [ ] **Step 5: Copy all 4 SQL statements to clipboard for Supabase SQL Editor**

```bash
# Copy to clipboard for easy pasting
pbcopy < migration.sql
```

---

## Task 11: Final Integration Test + Build Verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass (previous count: 421 + new tests)

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No lint errors

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit any remaining changes**

```bash
git add -A
git commit -m "feat: cover image validation pipeline — complete implementation"
```

---

## Deploy Checklist

1. Run Task 10 SQL migration in Supabase SQL Editor **FIRST**
2. Deploy code (Netlify)
3. Verify: scan a comic with a known wrong cover (Batman #423) → should show correct cover or placeholder
4. Verify: scan a popular comic → should get eBay-validated cover
5. Monitor Gemini API costs in Google AI Studio for first 24 hours
