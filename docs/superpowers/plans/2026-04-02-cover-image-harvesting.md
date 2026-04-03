# Cover Image Harvesting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically harvest clean cover artwork from graded/slabbed comic scans and populate the community cover database — zero user friction, zero extra API cost.

**Architecture:** Piggyback on the existing AI Vision call in `/api/analyze`. The AI returns a harvestability boolean and crop coordinates. If eligible, we crop the image server-side with `sharp`, upload to Supabase Storage, and submit to the community cover database. Runs pre-response with a 2-second timeout to work within Netlify's serverless constraints.

**Tech Stack:** sharp (image processing), Supabase Storage (file hosting), existing coverImageDb functions, existing AI providers (Anthropic/Gemini)

**Spec:** `docs/superpowers/specs/2026-04-02-cover-image-harvesting-design.md` (Rev 3)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/providers/types.ts` | Modify | Add harvest fields to `ImageAnalysisResult` |
| `src/lib/providers/anthropic.ts` | Modify | Expand AI prompt + increase `max_tokens` |
| `src/lib/providers/gemini.ts` | Modify | Set `maxOutputTokens` to match |
| `src/lib/coverHarvest.ts` | **Create** | All harvest logic: orchestrator, validation, crop, upload |
| `src/lib/coverImageDb.ts` | Modify | Add `variant` support to `submitCoverImage()` and `getCommunityCovers()` |
| `src/lib/analyticsServer.ts` | Modify | Add `coverHarvested` field |
| `src/app/api/analyze/route.ts` | Modify | Call harvest orchestrator pre-response |
| `src/lib/__tests__/coverHarvest.test.ts` | **Create** | Unit tests for all harvest logic |
| `supabase/migrations/YYYYMMDD_cover_harvest_support.sql` | **Create** | Schema changes |
| `package.json` | Modify | Add `sharp` dependency |

---

### Task 0: sharp Proof-of-Concept on Netlify

**Files:**
- Modify: `package.json`

This is a **blocking prerequisite**. If sharp doesn't work on Netlify, we pivot to the Supabase image transform fallback described in the spec.

- [ ] **Step 1: Install sharp**

```bash
cd "/Users/chrispatton/Coding for Dummies/Comic Tracker"
npm install sharp@^0.33
```

- [ ] **Step 2: Verify local sharp works**

```bash
node -e "const sharp = require('sharp'); sharp(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')).metadata().then(m => console.log('sharp works:', m.format, m.width, m.height))"
```

Expected: `sharp works: png 1 1`

- [ ] **Step 3: Commit and deploy to Netlify**

```bash
git add package.json package-lock.json
git commit -m "chore: add sharp dependency for cover image harvesting"
```

Deploy to Netlify. After deploy, verify the build succeeds and the site loads. If the build fails due to sharp native bindings, investigate `SHARP_IGNORE_GLOBAL_LIBVIPS=1` env var or the `--platform=linux` install approach before proceeding.

- [ ] **Step 4: Decision gate**

If sharp works on Netlify → proceed to Task 1.
If sharp fails → pivot to Supabase image transform fallback (not covered in this plan; would need a revised spec).

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260402_cover_harvest_support.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration: cover_harvest_support.sql
-- Supports cover image harvesting from graded book scans

-- 1. Add variant column to cover_images
ALTER TABLE cover_images ADD COLUMN IF NOT EXISTS variant TEXT DEFAULT '';

-- 2. Backfill existing rows
UPDATE cover_images SET variant = '' WHERE variant IS NULL;

-- 3. Remove duplicate approved covers (keep most recently approved)
DELETE FROM cover_images a
USING cover_images b
WHERE a.title_normalized = b.title_normalized
  AND a.issue_number = b.issue_number
  AND COALESCE(a.variant, '') = COALESCE(b.variant, '')
  AND a.status = 'approved'
  AND b.status = 'approved'
  AND a.approved_at < b.approved_at;

-- 4. Partial unique index for dedup (one approved cover per title+issue+variant)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cover_images_unique_approved
ON cover_images (title_normalized, issue_number, COALESCE(variant, ''))
WHERE status = 'approved';

-- 5. System harvest profile (sentinel row for automated operations)
INSERT INTO profiles (id, display_name, created_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'System Harvest', NOW())
ON CONFLICT (id) DO NOTHING;

-- 6. Add cover_harvested tracking to scan_analytics
ALTER TABLE scan_analytics ADD COLUMN IF NOT EXISTS cover_harvested BOOLEAN DEFAULT FALSE;
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Copy the SQL and run it in the Supabase dashboard SQL Editor. Verify "Success" with no errors.

- [ ] **Step 3: Create Supabase Storage bucket**

In Supabase dashboard → Storage → New Bucket:
- Name: `cover-images`
- Public: Yes (public read)
- File size limit: 500KB
- Allowed MIME types: `image/webp`

- [ ] **Step 4: Commit migration file**

```bash
git add supabase/migrations/20260402_cover_harvest_support.sql
git commit -m "feat: add cover harvest schema — variant column, unique index, sentinel profile"
```

---

### Task 2: Update `ImageAnalysisResult` Type

**Files:**
- Modify: `src/lib/providers/types.ts:34-59`

- [ ] **Step 1: Add harvest fields to the interface**

Add these two optional fields at the end of `ImageAnalysisResult` (before the closing `}`):

```typescript
  // Cover harvesting (populated for slabbed books only)
  coverHarvestable?: boolean;
  coverCropCoordinates?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No new errors (fields are optional, so existing code is unaffected).

- [ ] **Step 3: Commit**

```bash
git add src/lib/providers/types.ts
git commit -m "feat: add coverHarvestable and coverCropCoordinates to ImageAnalysisResult"
```

---

### Task 3: Expand AI Prompt

**Files:**
- Modify: `src/lib/providers/anthropic.ts:21-111` (IMAGE_ANALYSIS_PROMPT) and line 176 (max_tokens)
- Modify: `src/lib/providers/gemini.ts` (add maxOutputTokens)

- [ ] **Step 1: Add harvest instructions to IMAGE_ANALYSIS_PROMPT**

In `src/lib/providers/anthropic.ts`, find the end of the `IMAGE_ANALYSIS_PROMPT` string (around line 111, before the closing backtick). Add the following section before the JSON schema closing:

```
For GRADED/SLABBED books only, also include:
- "coverHarvestable": true/false — Is the cover artwork clearly visible through the slab? Return true ONLY when: the cover is sharp, well-lit, minimal glare/reflections on plastic, accurate colors, and the full cover is visible (not cut off). If ANY of these conditions fail, return false.
- "coverCropCoordinates": {"x": number, "y": number, "width": number, "height": number} — Pixel coordinates of ONLY the comic cover artwork inside the slab. EXCLUDE the grading label (top), certification number, plastic case borders, and any reflections. The coordinates are relative to the image you received. Only include this field when coverHarvestable is true.
```

Also add `coverHarvestable` and `coverCropCoordinates` to the JSON example in the prompt so the AI knows the expected shape.

- [ ] **Step 2: Increase max_tokens in anthropic.ts**

At line 176, change:
```typescript
max_tokens: 1024,
```
to:
```typescript
max_tokens: 1536,
```

- [ ] **Step 3: Set maxOutputTokens in gemini.ts**

In `src/lib/providers/gemini.ts`, find the `generateContent()` call in the `analyzeImage()` function. Add generation config:

```typescript
const result = await model.generateContent({
  contents: [{ role: "user", parts }],
  generationConfig: {
    maxOutputTokens: 1536,
  },
});
```

If the current call uses the array shorthand `model.generateContent([...])`, refactor to the object form to support `generationConfig`.

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern="providers" 2>&1 | tail -10
```

Expected: All existing provider tests pass (prompt changes don't affect mocked tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/providers/anthropic.ts src/lib/providers/gemini.ts
git commit -m "feat: add cover harvest fields to AI prompt, increase token limits"
```

---

### Task 4: Update `coverImageDb.ts` — Variant Support

**Files:**
- Modify: `src/lib/coverImageDb.ts:30-81`

- [ ] **Step 1: Update `getCommunityCovers()` to accept variant**

Change the function signature and query. Current signature (line 30):
```typescript
async function getCommunityCovers(title: string, issueNumber: string): Promise<string | null>
```

New signature:
```typescript
async function getCommunityCovers(title: string, issueNumber: string, variant?: string): Promise<string | null>
```

Add variant filter to the query. After the existing `.eq("issue_number", ...)` filter, add:
```typescript
.eq("variant", variant ? variant.toLowerCase().trim() : "")
```

- [ ] **Step 2: Update `submitCoverImage()` to accept variant**

Change the params interface. Add `variant?: string` to the params object:
```typescript
async function submitCoverImage(params: {
  title: string;
  issueNumber: string;
  imageUrl: string;
  submittedBy: string;
  sourceQuery: string;
  autoApprove: boolean;
  variant?: string;
}): Promise<{ id: string; status: string }>
```

Add variant to the insert data:
```typescript
variant: params.variant ? params.variant.toLowerCase().trim() : "",
```

- [ ] **Step 3: Add `saveComicMetadata()` call for auto-approved inserts**

After the existing insert in `submitCoverImage()`, if `autoApprove` is true and the insert succeeds, add:
```typescript
if (params.autoApprove && data) {
  // Sync to comic_metadata so the cover is immediately findable
  const { saveComicMetadata } = await import("./db");
  await saveComicMetadata({
    title: params.title,
    issueNumber: params.issueNumber,
    coverImageUrl: params.imageUrl,
  }).catch((err) => console.error("[coverImageDb] metadata sync failed:", err.message));
}
```

- [ ] **Step 4: Run existing tests**

```bash
npm test -- --testPathPattern="coverImage" 2>&1 | tail -10
```

Expected: Existing tests pass (variant is optional with default).

- [ ] **Step 5: Commit**

```bash
git add src/lib/coverImageDb.ts
git commit -m "feat: add variant support to submitCoverImage and getCommunityCovers"
```

---

### Task 5: Update Analytics — `coverHarvested` Field

**Files:**
- Modify: `src/lib/analyticsServer.ts:85-99`

- [ ] **Step 1: Add field to `ScanAnalyticsRecord`**

Add to the interface (after `fallback_reason`):
```typescript
  cover_harvested?: boolean;
```

- [ ] **Step 2: Add field to the insert in `recordScanAnalytics()`**

In the insert object (around line 108), add:
```typescript
cover_harvested: record.cover_harvested ?? false,
```

- [ ] **Step 3: Run tests**

```bash
npm test -- --testPathPattern="analytics" 2>&1 | tail -10
```

Expected: Existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/analyticsServer.ts
git commit -m "feat: add cover_harvested field to scan analytics"
```

---

### Task 6: Write Harvest Logic — Tests First

**Files:**
- Create: `src/lib/__tests__/coverHarvest.test.ts`
- Create: `src/lib/coverHarvest.ts`

- [ ] **Step 1: Write tests for coordinate validation**

Create `src/lib/__tests__/coverHarvest.test.ts`:

```typescript
import {
  validateCropCoordinates,
  applyInsetPadding,
  SYSTEM_HARVEST_PROFILE_ID,
} from "../coverHarvest";

describe("coverHarvest", () => {
  describe("SYSTEM_HARVEST_PROFILE_ID", () => {
    it("is the expected sentinel UUID", () => {
      expect(SYSTEM_HARVEST_PROFILE_ID).toBe("00000000-0000-0000-0000-000000000001");
    });
  });

  describe("validateCropCoordinates", () => {
    const imageWidth = 800;
    const imageHeight = 1200;

    it("accepts valid coordinates", () => {
      const result = validateCropCoordinates(
        { x: 50, y: 100, width: 400, height: 600 },
        imageWidth,
        imageHeight
      );
      expect(result.valid).toBe(true);
    });

    it("rejects coordinates outside image bounds (x + width overflow)", () => {
      const result = validateCropCoordinates(
        { x: 500, y: 100, width: 400, height: 600 },
        imageWidth,
        imageHeight
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("bounds");
    });

    it("rejects coordinates outside image bounds (y + height overflow)", () => {
      const result = validateCropCoordinates(
        { x: 50, y: 800, width: 400, height: 600 },
        imageWidth,
        imageHeight
      );
      expect(result.valid).toBe(false);
    });

    it("rejects negative values", () => {
      const result = validateCropCoordinates(
        { x: -10, y: 100, width: 400, height: 600 },
        imageWidth,
        imageHeight
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("negative");
    });

    it("rejects NaN values", () => {
      const result = validateCropCoordinates(
        { x: NaN, y: 100, width: 400, height: 600 },
        imageWidth,
        imageHeight
      );
      expect(result.valid).toBe(false);
    });

    it("rejects crop area > 90% of original", () => {
      const result = validateCropCoordinates(
        { x: 0, y: 0, width: 790, height: 1190 },
        imageWidth,
        imageHeight
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("90%");
    });
  });

  describe("applyInsetPadding", () => {
    it("shrinks crop by 4% on each edge", () => {
      const result = applyInsetPadding({ x: 100, y: 200, width: 400, height: 600 });
      // 4% of 400 = 16 per side
      expect(result.x).toBe(116);
      // 4% of 600 = 24 per side
      expect(result.y).toBe(224);
      expect(result.width).toBe(368); // 400 - 32
      expect(result.height).toBe(552); // 600 - 48
    });

    it("returns dimensions that could go below minimums for small crops", () => {
      const result = applyInsetPadding({ x: 0, y: 0, width: 104, height: 156 });
      // 4% of 104 ~= 4 per side → width = 96
      expect(result.width).toBeLessThan(100);
    });
  });

  describe("isValidAspectRatio", () => {
    // Import after implementation exists
  });

  describe("shouldHarvest", () => {
    // Import after implementation exists
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="coverHarvest" 2>&1 | tail -10
```

Expected: FAIL — module `../coverHarvest` not found.

- [ ] **Step 3: Write `coverHarvest.ts` — validation functions**

Create `src/lib/coverHarvest.ts`:

```typescript
export const SYSTEM_HARVEST_PROFILE_ID = "00000000-0000-0000-0000-000000000001";

export interface CropCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate AI-returned crop coordinates against image dimensions.
 */
export function validateCropCoordinates(
  coords: CropCoordinates,
  imageWidth: number,
  imageHeight: number
): ValidationResult {
  const { x, y, width, height } = coords;

  // Check for NaN or non-finite
  if ([x, y, width, height].some((v) => !Number.isFinite(v))) {
    return { valid: false, reason: "coordinates contain NaN or non-finite values" };
  }

  // Check for negative values
  if (x < 0 || y < 0 || width < 0 || height < 0) {
    return { valid: false, reason: "coordinates contain negative values" };
  }

  // Check bounds
  if (x + width > imageWidth || y + height > imageHeight) {
    return { valid: false, reason: "coordinates exceed image bounds" };
  }

  // Check crop area isn't > 90% of original (indicates bad coordinates)
  const cropArea = width * height;
  const imageArea = imageWidth * imageHeight;
  if (cropArea > imageArea * 0.9) {
    return { valid: false, reason: "crop area exceeds 90% of original image" };
  }

  return { valid: true };
}

/**
 * Apply 4% inset padding to crop coordinates to compensate for AI imprecision.
 */
export function applyInsetPadding(coords: CropCoordinates): CropCoordinates {
  const insetX = Math.round(coords.width * 0.04);
  const insetY = Math.round(coords.height * 0.04);

  return {
    x: coords.x + insetX,
    y: coords.y + insetY,
    width: coords.width - insetX * 2,
    height: coords.height - insetY * 2,
  };
}

/**
 * Check if crop aspect ratio is approximately 2:3 (comic cover proportions).
 * Valid range: width/height between 0.55 and 0.80.
 */
export function isValidAspectRatio(width: number, height: number): boolean {
  if (height === 0) return false;
  const ratio = width / height;
  return ratio >= 0.55 && ratio <= 0.80;
}

/**
 * Check if post-inset dimensions meet minimum requirements.
 */
export function meetsMinimumDimensions(width: number, height: number): boolean {
  return width >= 100 && height >= 150;
}

export interface HarvestEligibility {
  eligible: boolean;
  reason?: string;
}

/**
 * Determine if a scan result is eligible for cover harvesting.
 */
export function shouldHarvest(params: {
  isSlabbed: boolean;
  coverHarvestable?: boolean;
  coverCropCoordinates?: CropCoordinates;
  isAuthenticated: boolean;
}): HarvestEligibility {
  if (!params.isAuthenticated) {
    return { eligible: false, reason: "guest user" };
  }
  if (!params.isSlabbed) {
    return { eligible: false, reason: "not slabbed" };
  }
  if (!params.coverHarvestable) {
    return { eligible: false, reason: "not harvestable" };
  }
  if (!params.coverCropCoordinates) {
    return { eligible: false, reason: "no crop coordinates" };
  }
  return { eligible: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="coverHarvest" 2>&1 | tail -10
```

Expected: All tests pass.

- [ ] **Step 5: Add remaining tests**

Add to `src/lib/__tests__/coverHarvest.test.ts`:

```typescript
import {
  validateCropCoordinates,
  applyInsetPadding,
  isValidAspectRatio,
  meetsMinimumDimensions,
  shouldHarvest,
  SYSTEM_HARVEST_PROFILE_ID,
} from "../coverHarvest";

// ... keep existing tests, add:

  describe("isValidAspectRatio", () => {
    it("accepts ~2:3 ratio (0.67)", () => {
      expect(isValidAspectRatio(400, 600)).toBe(true);
    });

    it("accepts lower bound (0.55)", () => {
      expect(isValidAspectRatio(275, 500)).toBe(true);
    });

    it("accepts upper bound (0.80)", () => {
      expect(isValidAspectRatio(400, 500)).toBe(true);
    });

    it("rejects square ratio (1.0)", () => {
      expect(isValidAspectRatio(500, 500)).toBe(false);
    });

    it("rejects landscape ratio (1.5)", () => {
      expect(isValidAspectRatio(600, 400)).toBe(false);
    });

    it("rejects zero height", () => {
      expect(isValidAspectRatio(400, 0)).toBe(false);
    });
  });

  describe("meetsMinimumDimensions", () => {
    it("accepts valid dimensions", () => {
      expect(meetsMinimumDimensions(400, 600)).toBe(true);
    });

    it("rejects width below 100", () => {
      expect(meetsMinimumDimensions(99, 600)).toBe(false);
    });

    it("rejects height below 150", () => {
      expect(meetsMinimumDimensions(400, 149)).toBe(false);
    });

    it("accepts exact minimums", () => {
      expect(meetsMinimumDimensions(100, 150)).toBe(true);
    });
  });

  describe("shouldHarvest", () => {
    const validParams = {
      isSlabbed: true,
      coverHarvestable: true,
      coverCropCoordinates: { x: 50, y: 100, width: 400, height: 600 },
      isAuthenticated: true,
    };

    it("returns eligible for valid params", () => {
      expect(shouldHarvest(validParams).eligible).toBe(true);
    });

    it("rejects guest users", () => {
      const result = shouldHarvest({ ...validParams, isAuthenticated: false });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("guest user");
    });

    it("rejects non-slabbed books", () => {
      const result = shouldHarvest({ ...validParams, isSlabbed: false });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("not slabbed");
    });

    it("rejects when coverHarvestable is false", () => {
      const result = shouldHarvest({ ...validParams, coverHarvestable: false });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("not harvestable");
    });

    it("rejects when coverHarvestable is undefined", () => {
      const result = shouldHarvest({ ...validParams, coverHarvestable: undefined });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("not harvestable");
    });

    it("rejects when coordinates are missing", () => {
      const result = shouldHarvest({ ...validParams, coverCropCoordinates: undefined });
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("no crop coordinates");
    });
  });
```

- [ ] **Step 6: Run all harvest tests**

```bash
npm test -- --testPathPattern="coverHarvest" 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/coverHarvest.ts src/lib/__tests__/coverHarvest.test.ts
git commit -m "feat: add cover harvest validation logic with tests"
```

---

### Task 7: Write Harvest Orchestrator — Image Processing + Upload

**Files:**
- Modify: `src/lib/coverHarvest.ts`

This task adds the main `harvestCoverFromScan()` function that does the actual crop, upload, and database write.

- [ ] **Step 1: Add imports and orchestrator function**

Add to the top of `src/lib/coverHarvest.ts`:

```typescript
import sharp from "sharp";
import { supabaseAdmin } from "./supabase";
import { normalizeTitle, normalizeIssueNumber } from "./normalizeTitle";
import { submitCoverImage, getCommunityCovers } from "./coverImageDb";
```

Add the orchestrator function at the bottom of the file:

```typescript
export interface HarvestParams {
  base64Image: string; // The compressed image the AI analyzed
  title: string;
  issueNumber: string;
  variant: string | null;
  coverCropCoordinates: CropCoordinates;
  profileId: string | null;
  isSlabbed: boolean;
  coverHarvestable?: boolean;
}

/**
 * Main harvest orchestrator. Crops a cover from a slab scan,
 * uploads to Supabase Storage, and submits to the community cover database.
 * Designed to be called pre-response with a timeout wrapper.
 */
export async function harvestCoverFromScan(params: HarvestParams): Promise<boolean> {
  const {
    base64Image,
    title,
    issueNumber,
    variant,
    coverCropCoordinates,
    profileId,
    isSlabbed,
    coverHarvestable,
  } = params;

  // 1. Eligibility check
  const eligibility = shouldHarvest({
    isSlabbed,
    coverHarvestable,
    coverCropCoordinates,
    isAuthenticated: !!profileId,
  });

  if (!eligibility.eligible) {
    console.log(`[harvest] skipped: ${eligibility.reason}`);
    return false;
  }

  // 2. Check if cover already exists for this title+issue+variant
  const normalizedVariant = variant ? variant.toLowerCase().trim() : "";
  const existingCover = await getCommunityCovers(title, issueNumber, normalizedVariant);
  if (existingCover) {
    console.log("[harvest] skipped: cover exists");
    return false;
  }

  // 3. Decode image and get dimensions
  const imageBuffer = Buffer.from(base64Image, "base64");
  const metadata = await sharp(imageBuffer).metadata();
  const imageWidth = metadata.width || 0;
  const imageHeight = metadata.height || 0;

  // 4. Validate coordinates against image bounds
  const coordValidation = validateCropCoordinates(
    coverCropCoordinates,
    imageWidth,
    imageHeight
  );
  if (!coordValidation.valid) {
    console.log(`[harvest] skipped: bad coordinates — ${coordValidation.reason}`);
    return false;
  }

  // 5. Apply 4% inset padding
  const insetCoords = applyInsetPadding(coverCropCoordinates);

  // 6. Validate dimensions after inset
  if (!meetsMinimumDimensions(insetCoords.width, insetCoords.height)) {
    console.log("[harvest] skipped: too small after inset");
    return false;
  }

  // 7. Validate aspect ratio after inset
  if (!isValidAspectRatio(insetCoords.width, insetCoords.height)) {
    console.log("[harvest] skipped: bad aspect ratio");
    return false;
  }

  // 8. Crop the image
  const croppedBuffer = await sharp(imageBuffer)
    .extract({
      left: insetCoords.x,
      top: insetCoords.y,
      width: insetCoords.width,
      height: insetCoords.height,
    })
    .toBuffer();

  // 9. Validate color variance (reject solid-color garbage crops)
  const stats = await sharp(croppedBuffer).stats();
  const allLowVariance = stats.channels.every((ch) => ch.stdev < 10);
  if (allLowVariance) {
    console.log("[harvest] skipped: low color variance");
    return false;
  }

  // 10. Convert to WebP
  const webpBuffer = await sharp(croppedBuffer).webp({ quality: 85 }).toBuffer();

  // 11. Upload to Supabase Storage
  const normalizedTitle = normalizeTitle(title);
  const normalizedIssue = normalizeIssueNumber(issueNumber);
  const variantPath = normalizedVariant || "_default";
  const uuid = crypto.randomUUID();
  const storagePath = `${normalizedTitle}/${normalizedIssue}/${variantPath}/${uuid}.webp`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("cover-images")
    .upload(storagePath, webpBuffer, {
      contentType: "image/webp",
      upsert: false,
    });

  if (uploadError) {
    console.error("[harvest] storage upload failed:", uploadError.message);
    return false;
  }

  // 12. Get public URL
  const { data: urlData } = supabaseAdmin.storage
    .from("cover-images")
    .getPublicUrl(storagePath);

  const publicUrl = urlData.publicUrl;

  // 13. Submit to community cover database
  await submitCoverImage({
    title,
    issueNumber,
    imageUrl: publicUrl,
    submittedBy: SYSTEM_HARVEST_PROFILE_ID,
    sourceQuery: "scan-harvest",
    autoApprove: true,
    variant: normalizedVariant,
  });

  console.log(`[harvest] success: ${title} #${issueNumber}${normalizedVariant ? ` (${normalizedVariant})` : ""}`);
  return true;
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No new type errors.

- [ ] **Step 3: Run all tests**

```bash
npm test 2>&1 | tail -10
```

Expected: All tests pass (orchestrator is not unit-tested here since it requires mocking sharp/supabase — it will be tested via integration).

- [ ] **Step 4: Commit**

```bash
git add src/lib/coverHarvest.ts
git commit -m "feat: add harvestCoverFromScan orchestrator — crop, upload, submit"
```

---

### Task 8: Integrate Harvest into Analyze Route

**Files:**
- Modify: `src/app/api/analyze/route.ts` (around lines 889-905)

- [ ] **Step 1: Add import at top of file**

```typescript
import { harvestCoverFromScan } from "@/lib/coverHarvest";
```

- [ ] **Step 2: Add harvest call before response**

Find the section after `recordScanAnalytics` (around line 889) and before `const _meta` (around line 891). Insert:

```typescript
  // Cover image harvesting from graded book scans
  // Runs pre-response with 2s timeout — see spec for rationale
  if (comicDetails.isSlabbed && comicDetails.coverHarvestable) {
    const harvestPromise = harvestCoverFromScan({
      base64Image: base64Data,
      title: comicDetails.title || "",
      issueNumber: comicDetails.issueNumber || "",
      variant: comicDetails.variant || null,
      coverCropCoordinates: comicDetails.coverCropCoordinates!,
      profileId: profileId || null,
      isSlabbed: comicDetails.isSlabbed,
      coverHarvestable: comicDetails.coverHarvestable,
    }).catch((err) => {
      console.error("[harvest] failed:", err.message);
      return false;
    });

    const timeoutPromise = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), 2000)
    );

    const harvested = await Promise.race([harvestPromise, timeoutPromise]);

    // Track in analytics (update the existing analytics call if it hasn't fired yet,
    // or fire a supplementary one)
    if (harvested) {
      supabaseAdmin
        .from("scan_analytics")
        .update({ cover_harvested: true })
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(1)
        .then(() => {})
        .catch(() => {});
    }
  }
```

- [ ] **Step 3: Strip harvest fields from response**

The `coverHarvestable` and `coverCropCoordinates` fields are internal — don't send them to the client. Before the `return NextResponse.json(...)` line, add:

```typescript
  // Remove internal harvest fields from client response
  delete comicDetails.coverHarvestable;
  delete comicDetails.coverCropCoordinates;
```

- [ ] **Step 4: Run build**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build passes with no errors.

- [ ] **Step 5: Run all tests**

```bash
npm test 2>&1 | tail -10
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat: integrate cover harvesting into scan route — pre-response with 2s timeout"
```

---

### Task 9: Manual Integration Test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test with a slabbed comic scan**

Scan a photo of a CGC/CBCS graded comic. Check:
1. The scan completes normally (no errors, no significant delay)
2. Check server logs for `[harvest]` messages
3. Check Supabase Storage → `cover-images` bucket for the uploaded WebP file
4. Check `cover_images` table for the new row with `source_query = 'scan-harvest'`
5. Check that `comic_metadata` was updated with the cover URL

- [ ] **Step 3: Test dedup — scan same book again**

Scan the same slabbed comic. Check:
1. Server logs show `[harvest] skipped: cover exists`
2. No duplicate row in `cover_images`
3. No duplicate file in Storage

- [ ] **Step 4: Test non-slabbed scan**

Scan a raw (non-slabbed) comic. Check:
1. No `[harvest]` log messages (skips silently before any processing)
2. No new entries in `cover_images` or Storage
3. Scan completes normally with no delay

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: cover image harvesting complete — auto-harvest from graded scans"
```

---

## Summary

| Task | Description | Estimated Time |
|------|-------------|---------------|
| 0 | sharp PoC on Netlify (blocking) | 15 min |
| 1 | Database migration | 10 min |
| 2 | Update ImageAnalysisResult type | 5 min |
| 3 | Expand AI prompt (both providers) | 15 min |
| 4 | Variant support in coverImageDb | 15 min |
| 5 | Analytics coverHarvested field | 5 min |
| 6 | Harvest validation logic + tests | 30 min |
| 7 | Harvest orchestrator (crop/upload/submit) | 20 min |
| 8 | Integrate into analyze route | 15 min |
| 9 | Manual integration test | 15 min |
| **Total** | | **~2.5 hours** |
