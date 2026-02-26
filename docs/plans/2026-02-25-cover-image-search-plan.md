# Cover Image Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a two-layer cover image system — Claude-powered search with a community cover database that grows over time, reducing AI costs.

**Architecture:** CSV imports check a community `cover_images` table first. On cache miss, Claude generates an optimized Google search query, Google Custom Search returns image candidates, and the user picks the right cover. Single-match covers auto-approve to the community DB; multi-match (variant) covers go through admin approval.

**Tech Stack:** Next.js API routes, Anthropic Claude (Haiku), Google Custom Search JSON API, Supabase (Postgres + RLS), React

---

## Task 1: Database Migration — `cover_images` Table

**Files:**
- Create: `supabase/migrations/20260225_cover_images.sql`

**Step 1: Write the migration**

```sql
-- Cover Images Community Database
-- Stores admin-approved cover images for reuse across all users

CREATE TABLE IF NOT EXISTS cover_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title_normalized TEXT NOT NULL,
  issue_number TEXT NOT NULL,
  image_url TEXT NOT NULL,
  submitted_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  source_query TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

-- Fast lookups by title + issue + status
CREATE INDEX IF NOT EXISTS idx_cover_images_lookup
  ON cover_images(title_normalized, issue_number, status);

CREATE INDEX IF NOT EXISTS idx_cover_images_status
  ON cover_images(status, created_at DESC);

-- Enable RLS
ALTER TABLE cover_images ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved covers
CREATE POLICY "Anyone can read approved covers"
  ON cover_images FOR SELECT
  USING (status = 'approved');

-- Users can read their own pending/rejected covers
CREATE POLICY "Users can read own covers"
  ON cover_images FOR SELECT
  USING (
    submitted_by IN (
      SELECT id FROM profiles
      WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

-- Admins can read all covers
CREATE POLICY "Admins can read all covers"
  ON cover_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
      AND is_admin = TRUE
    )
  );

-- Admins can update covers (approve/reject)
CREATE POLICY "Admins can update covers"
  ON cover_images FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
      AND is_admin = TRUE
    )
  );

-- Service role full access (API routes use supabaseAdmin)
CREATE POLICY "Service role full access to cover images"
  ON cover_images FOR ALL
  USING (auth.role() = 'service_role');
```

**Step 2: Run the migration against Supabase**

Run: Open Supabase dashboard SQL Editor → paste and execute
Expected: Table created with indexes and RLS policies

**Step 3: Commit**

```bash
git add supabase/migrations/20260225_cover_images.sql
git commit -m "feat: add cover_images table for community cover database"
```

---

## Task 2: Cover Image DB Helpers

**Files:**
- Create: `src/lib/coverImageDb.ts`
- Create: `src/lib/__tests__/coverImageDb.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/lib/__tests__/coverImageDb.test.ts

import {
  normalizeTitle,
  normalizeIssueNumber,
  buildCoverLookupKey,
} from "../coverImageDb";

describe("coverImageDb helpers", () => {
  describe("normalizeTitle", () => {
    it("lowercases and trims the title", () => {
      expect(normalizeTitle("  Batman  ")).toBe("batman");
    });

    it("removes special characters except hyphens", () => {
      expect(normalizeTitle("Spider-Man (2022)")).toBe("spider-man 2022");
    });

    it("collapses multiple spaces", () => {
      expect(normalizeTitle("The   Amazing   Spider-Man")).toBe(
        "the amazing spider-man"
      );
    });

    it("handles the/a/an articles consistently", () => {
      expect(normalizeTitle("The Uncanny X-Men")).toBe("the uncanny x-men");
    });
  });

  describe("normalizeIssueNumber", () => {
    it("strips leading hash", () => {
      expect(normalizeIssueNumber("#171")).toBe("171");
    });

    it("trims whitespace", () => {
      expect(normalizeIssueNumber("  42  ")).toBe("42");
    });

    it("handles N/A", () => {
      expect(normalizeIssueNumber("N/A")).toBe("n/a");
    });

    it("preserves decimals and letters", () => {
      expect(normalizeIssueNumber("1.1")).toBe("1.1");
      expect(normalizeIssueNumber("500A")).toBe("500a");
    });
  });

  describe("buildCoverLookupKey", () => {
    it("combines normalized title and issue", () => {
      expect(buildCoverLookupKey("Batman", "#171")).toBe("batman|171");
    });

    it("handles variant titles the same as base", () => {
      expect(buildCoverLookupKey("  Batman  ", "171")).toBe("batman|171");
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/__tests__/coverImageDb.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// src/lib/coverImageDb.ts

import { supabaseAdmin } from "./supabaseAdmin";

// --- Pure helpers (exported for testing) ---

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeIssueNumber(issue: string): string {
  return issue.toLowerCase().trim().replace(/^#/, "");
}

export function buildCoverLookupKey(title: string, issue: string): string {
  return `${normalizeTitle(title)}|${normalizeIssueNumber(issue)}`;
}

// --- Database functions ---

export interface CoverImage {
  id: string;
  title_normalized: string;
  issue_number: string;
  image_url: string;
  submitted_by: string | null;
  approved_by: string | null;
  status: "pending" | "approved" | "rejected";
  source_query: string | null;
  created_at: string;
  approved_at: string | null;
}

/**
 * Look up an approved community cover for a comic.
 * Returns the image URL if found, null otherwise.
 */
export async function getCommunityCovers(
  title: string,
  issueNumber: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("cover_images")
    .select("image_url")
    .eq("title_normalized", normalizeTitle(title))
    .eq("issue_number", normalizeIssueNumber(issueNumber))
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data.image_url;
}

/**
 * Submit a cover image to the community database.
 * Auto-approved covers (single match) get status='approved'.
 * Multi-match covers get status='pending' for admin review.
 */
export async function submitCoverImage(params: {
  title: string;
  issueNumber: string;
  imageUrl: string;
  submittedBy: string;
  sourceQuery: string;
  autoApprove: boolean;
}): Promise<{ id: string; status: string }> {
  const status = params.autoApprove ? "approved" : "pending";
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("cover_images")
    .insert({
      title_normalized: normalizeTitle(params.title),
      issue_number: normalizeIssueNumber(params.issueNumber),
      image_url: params.imageUrl,
      submitted_by: params.submittedBy,
      status,
      source_query: params.sourceQuery,
      approved_by: params.autoApprove ? params.submittedBy : null,
      approved_at: params.autoApprove ? now : null,
    })
    .select("id, status")
    .single();

  if (error) throw new Error(`Failed to submit cover: ${error.message}`);
  return data;
}

/**
 * Get pending cover submissions for admin review.
 */
export async function getPendingCovers(
  page = 1,
  limit = 20
): Promise<{ covers: CoverImage[]; total: number }> {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabaseAdmin
    .from("cover_images")
    .select("*", { count: "exact" })
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(`Failed to fetch covers: ${error.message}`);
  return { covers: (data as CoverImage[]) || [], total: count || 0 };
}

/**
 * Admin approves a cover — sets status to approved, records approver.
 */
export async function approveCover(
  coverId: string,
  adminId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("cover_images")
    .update({
      status: "approved",
      approved_by: adminId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", coverId);

  if (error) throw new Error(`Failed to approve cover: ${error.message}`);
}

/**
 * Admin rejects a cover — stays private to submitter.
 */
export async function rejectCover(coverId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("cover_images")
    .update({ status: "rejected" })
    .eq("id", coverId);

  if (error) throw new Error(`Failed to reject cover: ${error.message}`);
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/__tests__/coverImageDb.test.ts`
Expected: PASS (3 describe blocks, all passing)

**Step 5: Commit**

```bash
git add src/lib/coverImageDb.ts src/lib/__tests__/coverImageDb.test.ts
git commit -m "feat: add cover image DB helpers with normalization and CRUD"
```

---

## Task 3: Cover Candidates API Route

**Files:**
- Create: `src/app/api/cover-candidates/route.ts`

**Step 1: Write the API route**

This route:
1. Checks community DB for approved cover
2. On miss, calls Claude (Haiku) to generate a search query
3. Calls Google Custom Search with that query
4. Returns candidates array

```typescript
// src/app/api/cover-candidates/route.ts

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { MODEL_LIGHTWEIGHT } from "@/lib/models";
import { getCommunityCovers } from "@/lib/coverImageDb";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface CoverCandidate {
  url: string;
  title: string;
  source: string;
}

async function generateSearchQuery(
  title: string,
  issueNumber: string,
  publisher?: string,
  releaseYear?: string
): Promise<string> {
  const context = [
    `Comic: ${title} #${issueNumber}`,
    publisher && `Publisher: ${publisher}`,
    releaseYear && `Year: ${releaseYear}`,
  ]
    .filter(Boolean)
    .join(", ");

  const message = await anthropic.messages.create({
    model: MODEL_LIGHTWEIGHT,
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content: `You are a comic book expert. Generate the best Google Image search query to find the COVER IMAGE of this comic book. Include era-specific details, key visual elements, or notable cover artists if you know them. Return ONLY the search query string, nothing else.

${context}`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text.trim() : "";
  // Strip quotes if Claude wraps the query
  return text.replace(/^["']|["']$/g, "");
}

async function searchGoogleImages(
  query: string
): Promise<CoverCandidate[]> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;

  if (!apiKey || !cx) {
    console.warn("Google CSE not configured — skipping image search");
    return [];
  }

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("searchType", "image");
  url.searchParams.set("num", "8");
  url.searchParams.set("imgType", "photo");
  url.searchParams.set("safe", "active");

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    console.error("Google CSE error:", response.status, await response.text());
    return [];
  }

  const data = await response.json();
  if (!data.items || !Array.isArray(data.items)) return [];

  return data.items.map(
    (item: { link: string; title: string; displayLink: string }) => ({
      url: item.link,
      title: item.title || "",
      source: item.displayLink || "google",
    })
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, issueNumber, publisher, releaseYear } = body;

    if (!title || !issueNumber) {
      return NextResponse.json(
        { error: "title and issueNumber are required" },
        { status: 400 }
      );
    }

    // Step 1: Check community database
    const communityUrl = await getCommunityCovers(title, issueNumber);
    if (communityUrl) {
      return NextResponse.json({
        source: "community",
        candidates: [{ url: communityUrl, title: "Community cover", source: "community" }],
        searchQuery: null,
      });
    }

    // Step 2: Claude generates search query
    const searchQuery = await generateSearchQuery(
      title,
      issueNumber,
      publisher,
      releaseYear
    );

    // Step 3: Google Custom Search
    const candidates = await searchGoogleImages(searchQuery);

    return NextResponse.json({
      source: "search",
      candidates,
      searchQuery,
    });
  } catch (error) {
    console.error("Cover candidates error:", error);
    return NextResponse.json(
      { error: "Failed to search for cover images" },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/app/api/cover-candidates/route.ts
git commit -m "feat: add cover-candidates API with community DB check and Claude+Google search"
```

---

## Task 4: Cover Submission API Route

**Files:**
- Create: `src/app/api/cover-images/route.ts`

**Step 1: Write the API route**

Handles user submitting their selected cover. Auto-approves single-match, queues multi-match for admin.

```typescript
// src/app/api/cover-images/route.ts

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { submitCoverImage } from "@/lib/coverImageDb";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get profile ID from Clerk user ID
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("clerk_user_id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      title,
      issueNumber,
      imageUrl,
      sourceQuery,
      candidateCount,
    } = body;

    if (!title || !issueNumber || !imageUrl) {
      return NextResponse.json(
        { error: "title, issueNumber, and imageUrl are required" },
        { status: 400 }
      );
    }

    // Auto-approve if single candidate (no ambiguity)
    const autoApprove = candidateCount === 1;

    const result = await submitCoverImage({
      title,
      issueNumber,
      imageUrl,
      submittedBy: profile.id,
      sourceQuery: sourceQuery || "",
      autoApprove,
    });

    return NextResponse.json({
      id: result.id,
      status: result.status,
      autoApproved: autoApprove,
    });
  } catch (error) {
    console.error("Cover submission error:", error);
    return NextResponse.json(
      { error: "Failed to submit cover image" },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/app/api/cover-images/route.ts
git commit -m "feat: add cover-images submission API with auto-approve for single matches"
```

---

## Task 5: Admin Cover Queue API Routes

**Files:**
- Create: `src/app/api/admin/cover-queue/route.ts`

**Step 1: Write the admin API routes**

Follow the existing pattern from `src/app/api/admin/key-info/[id]/route.ts`.

```typescript
// src/app/api/admin/cover-queue/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAdminProfile } from "@/lib/adminAuth";
import {
  getPendingCovers,
  approveCover,
  rejectCover,
} from "@/lib/coverImageDb";

// GET — fetch pending covers for admin review
export async function GET(request: NextRequest) {
  const adminProfile = await getAdminProfile();
  if (!adminProfile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  try {
    const { covers, total } = await getPendingCovers(page, limit);
    return NextResponse.json({ covers, total, page, limit });
  } catch (error) {
    console.error("Admin cover queue error:", error);
    return NextResponse.json(
      { error: "Failed to fetch cover queue" },
      { status: 500 }
    );
  }
}

// PATCH — approve or reject a cover
export async function PATCH(request: NextRequest) {
  const adminProfile = await getAdminProfile();
  if (!adminProfile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { coverId, action } = body;

    if (!coverId || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "coverId and action (approve|reject) required" },
        { status: 400 }
      );
    }

    if (action === "approve") {
      await approveCover(coverId, adminProfile.id);
    } else {
      await rejectCover(coverId);
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error("Admin cover action error:", error);
    return NextResponse.json(
      { error: "Failed to process cover action" },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/app/api/admin/cover-queue/route.ts
git commit -m "feat: add admin cover queue API with approve/reject actions"
```

---

## Task 6: Admin Cover Queue UI Page

**Files:**
- Create: `src/app/admin/cover-queue/page.tsx`
- Modify: `src/app/admin/layout.tsx` (add nav link)

**Step 1: Create the admin cover queue page**

Follow the pattern from `src/app/admin/barcode-reviews/page.tsx`. Display pending covers with comic title/issue, the submitted cover image, and approve/reject buttons.

```typescript
// src/app/admin/cover-queue/page.tsx

"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Check, X, ImageIcon } from "lucide-react";

interface PendingCover {
  id: string;
  title_normalized: string;
  issue_number: string;
  image_url: string;
  source_query: string | null;
  created_at: string;
}

export default function AdminCoverQueuePage() {
  const [covers, setCovers] = useState<PendingCover[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchCovers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cover-queue");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCovers(data.covers);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to load cover queue:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCovers();
  }, [fetchCovers]);

  const handleAction = async (coverId: string, action: "approve" | "reject") => {
    setProcessing(coverId);
    try {
      const res = await fetch("/api/admin/cover-queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverId, action }),
      });
      if (!res.ok) throw new Error("Failed to process");
      // Remove from list
      setCovers((prev) => prev.filter((c) => c.id !== coverId));
      setTotal((prev) => prev - 1);
    } catch (err) {
      console.error("Failed to process cover:", err);
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-comic font-bold mb-4">Cover Queue</h1>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-comic font-bold">Cover Queue</h1>
        <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
          {total} pending
        </span>
      </div>

      {covers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No covers pending review</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {covers.map((cover) => (
            <div
              key={cover.id}
              className="border-2 border-black rounded-lg overflow-hidden bg-white"
            >
              {/* Cover image */}
              <div className="relative aspect-[2/3] bg-gray-100">
                <Image
                  src={cover.image_url}
                  alt={`${cover.title_normalized} #${cover.issue_number}`}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>

              {/* Info */}
              <div className="p-3 border-t-2 border-black">
                <p className="font-comic font-bold capitalize">
                  {cover.title_normalized}
                </p>
                <p className="text-sm text-gray-600">
                  Issue #{cover.issue_number}
                </p>
                {cover.source_query && (
                  <p className="text-xs text-gray-400 mt-1 truncate">
                    Query: {cover.source_query}
                  </p>
                )}
                <p className="text-xs text-gray-400">
                  {new Date(cover.created_at).toLocaleDateString()}
                </p>
              </div>

              {/* Actions */}
              <div className="flex border-t-2 border-black">
                <button
                  onClick={() => handleAction(cover.id, "approve")}
                  disabled={processing === cover.id}
                  className="flex-1 flex items-center justify-center gap-1 py-2 bg-green-500 text-white font-bold hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={() => handleAction(cover.id, "reject")}
                  disabled={processing === cover.id}
                  className="flex-1 flex items-center justify-center gap-1 py-2 bg-red-500 text-white font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add nav link to admin layout**

In `src/app/admin/layout.tsx`, add to the `adminLinks` array:

```typescript
{ href: "/admin/cover-queue", label: "Covers", icon: ImageIcon },
```

Import `ImageIcon` from `lucide-react` (or `Image` — check what's already imported).

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/app/admin/cover-queue/page.tsx src/app/admin/layout.tsx
git commit -m "feat: add admin cover queue page with approve/reject UI"
```

---

## Task 7: Cover Review UI Component

**Files:**
- Create: `src/components/CoverReviewQueue.tsx`

**Step 1: Write the Cover Review Queue component**

This is the post-import screen where users pick covers for their imported comics. It processes comics one at a time: fetches candidates from `/api/cover-candidates`, displays them, user picks one, then submits via `/api/cover-images`.

```typescript
// src/components/CoverReviewQueue.tsx

"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { X, Check, SkipForward, Loader2 } from "lucide-react";

interface CoverCandidate {
  url: string;
  title: string;
  source: string;
}

interface ReviewItem {
  id: string;
  title: string;
  issueNumber: string;
  publisher?: string;
  releaseYear?: string;
  coverImageUrl?: string;
}

interface CoverReviewQueueProps {
  items: ReviewItem[];
  onCoverSet: (itemId: string, imageUrl: string) => void;
  onComplete: () => void;
  onCancel: () => void;
}

export default function CoverReviewQueue({
  items,
  onCoverSet,
  onComplete,
  onCancel,
}: CoverReviewQueueProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [candidates, setCandidates] = useState<CoverCandidate[]>([]);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filter to items missing covers
  const needsCover = items.filter((item) => !item.coverImageUrl);
  const current = needsCover[currentIndex];

  const fetchCandidates = useCallback(async (item: ReviewItem) => {
    setLoading(true);
    setCandidates([]);
    setSelectedUrl(null);
    setSearchQuery(null);

    try {
      const res = await fetch("/api/cover-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          issueNumber: item.issueNumber,
          publisher: item.publisher,
          releaseYear: item.releaseYear,
        }),
      });

      if (!res.ok) throw new Error("Failed to fetch candidates");
      const data = await res.json();

      setCandidates(data.candidates || []);
      setSearchQuery(data.searchQuery);

      // Auto-select if community match
      if (data.source === "community" && data.candidates.length === 1) {
        setSelectedUrl(data.candidates[0].url);
      }
    } catch (err) {
      console.error("Failed to fetch cover candidates:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (current) {
      fetchCandidates(current);
    }
  }, [current, fetchCandidates]);

  const handleConfirm = async () => {
    if (!selectedUrl || !current) return;
    setSubmitting(true);

    try {
      // Submit to community DB
      await fetch("/api/cover-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: current.title,
          issueNumber: current.issueNumber,
          imageUrl: selectedUrl,
          sourceQuery: searchQuery,
          candidateCount: candidates.length,
        }),
      });

      // Update the comic's cover
      onCoverSet(current.id, selectedUrl);

      // Move to next
      if (currentIndex + 1 < needsCover.length) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        onComplete();
      }
    } catch (err) {
      console.error("Failed to submit cover:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (currentIndex + 1 < needsCover.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  if (needsCover.length === 0) {
    onComplete();
    return null;
  }

  if (!current) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border-2 border-black max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-black">
          <div>
            <h2 className="font-comic font-bold text-lg">Pick a Cover</h2>
            <p className="text-sm text-gray-500">
              {currentIndex + 1} of {needsCover.length} comics
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comic info */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <p className="font-comic font-bold text-lg">
            {current.title} #{current.issueNumber}
          </p>
          {current.publisher && (
            <p className="text-sm text-gray-600">{current.publisher}</p>
          )}
        </div>

        {/* Candidates */}
        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-pop-blue mb-3" />
              <p className="text-sm text-gray-500">Searching for covers...</p>
            </div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No cover images found</p>
              <p className="text-sm mt-1">
                You can add a cover manually later from the edit screen
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {candidates.map((candidate, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedUrl(candidate.url)}
                  className={`relative aspect-[2/3] rounded-lg overflow-hidden border-3 transition-all ${
                    selectedUrl === candidate.url
                      ? "border-green-500 ring-2 ring-green-300 scale-105"
                      : "border-gray-200 hover:border-gray-400"
                  }`}
                >
                  <Image
                    src={candidate.url}
                    alt={candidate.title || `Cover option ${idx + 1}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  {selectedUrl === candidate.url && (
                    <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                    <p className="text-white text-[10px] truncate">
                      {candidate.source}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 border-t-2 border-black">
          <button
            onClick={handleSkip}
            className="flex items-center gap-1 px-4 py-2 border-2 border-black rounded-lg font-bold hover:bg-gray-100 transition-colors"
          >
            <SkipForward className="w-4 h-4" />
            Skip
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedUrl || submitting}
            className="flex-1 flex items-center justify-center gap-1 px-4 py-2 bg-green-500 text-white border-2 border-black rounded-lg font-bold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Set Cover
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/components/CoverReviewQueue.tsx
git commit -m "feat: add CoverReviewQueue component for post-import cover selection"
```

---

## Task 8: Integrate Cover Review into CSV Import Flow

**Files:**
- Modify: `src/app/scan/page.tsx` (~lines 696-765, the onImportComplete callback)
- Modify: `src/components/CSVImport.tsx` (optional — add note about cover review)

**Step 1: Add state and CoverReviewQueue to scan page**

In `src/app/scan/page.tsx`:

1. Import `CoverReviewQueue` component
2. Add state: `const [coverReviewItems, setCoverReviewItems] = useState<ReviewItem[]>([]);`
3. Add state: `const [showCoverReview, setShowCoverReview] = useState(false);`
4. In the `onImportComplete` callback, after saving items to collection:
   - Filter items that have no `coverImageUrl`
   - If any exist, set `coverReviewItems` and `showCoverReview(true)`
   - If none need covers, proceed to collection as before
5. Add `onCoverSet` handler that calls `updateComic()` from `useCollection` to set the cover URL
6. Render `CoverReviewQueue` when `showCoverReview` is true

**Key changes to onImportComplete:**

```typescript
// After saving all items to collection...
const itemsNeedingCovers = items.filter((item) => !item.coverImageUrl);

if (itemsNeedingCovers.length > 0) {
  setCoverReviewItems(
    itemsNeedingCovers.map((item) => ({
      id: item.id,
      title: item.comic.title,
      issueNumber: item.comic.issueNumber,
      publisher: item.comic.publisher || undefined,
      releaseYear: item.comic.releaseYear || undefined,
      coverImageUrl: item.coverImageUrl || undefined,
    }))
  );
  setShowCoverReview(true);
} else {
  showToast(message, "success");
  setShowCSVImport(false);
  router.push("/collection");
}
```

**Key changes — render CoverReviewQueue:**

```typescript
{showCoverReview && (
  <CoverReviewQueue
    items={coverReviewItems}
    onCoverSet={async (itemId, imageUrl) => {
      // Update the comic in collection with the new cover
      const item = collection.find((c) => c.id === itemId);
      if (item) {
        await updateComic({ ...item, coverImageUrl: imageUrl });
      }
    }}
    onComplete={() => {
      setShowCoverReview(false);
      setCoverReviewItems([]);
      showToast("Import complete! Covers updated.", "success");
      router.push("/collection");
    }}
    onCancel={() => {
      setShowCoverReview(false);
      setCoverReviewItems([]);
      showToast("Import complete. You can add covers later.", "success");
      router.push("/collection");
    }}
  />
)}
```

**Step 2: Verify it compiles and renders**

Run: `npx tsc --noEmit`
Run: Test CSV import in browser — after import, should see cover review modal

**Step 3: Commit**

```bash
git add src/app/scan/page.tsx
git commit -m "feat: integrate CoverReviewQueue into CSV import flow"
```

---

## Task 9: Remove Comic Vine from Import Lookup

**Files:**
- Modify: `src/app/api/import-lookup/route.ts` (remove `fetchCoverImage` function and Comic Vine references)

**Step 1: Remove the fetchCoverImage function**

In `src/app/api/import-lookup/route.ts`:

1. Delete the entire `fetchCoverImage()` function (lines ~212-266)
2. Remove the call to `fetchCoverImage()` in the main handler (lines ~179-183)
3. Set `coverImageUrl: null` in the response — cover images are now handled by the CoverReviewQueue post-import
4. Remove any `COMIC_VINE_API_KEY` references in this file

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Run existing tests**

Run: `npm test`
Expected: All existing tests pass

**Step 4: Commit**

```bash
git add src/app/api/import-lookup/route.ts
git commit -m "refactor: remove Comic Vine from import-lookup, covers now handled by CoverReviewQueue"
```

---

## Task 10: Environment Variables and Testing

**Files:**
- Modify: `.env.local` (add Google CSE keys)

**Step 1: Set up Google Custom Search**

1. Go to https://programmablesearchengine.google.com/ — create a search engine configured for image search
2. Go to https://console.cloud.google.com/ — enable Custom Search JSON API, create API key
3. Add to `.env.local`:

```
GOOGLE_CSE_API_KEY=your_api_key_here
GOOGLE_CSE_CX=your_search_engine_id_here
```

**Step 2: Run all tests**

Run: `npm test`
Expected: All tests pass (existing + new coverImageDb tests)

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Manual test — CSV import with cover review**

1. Import a CSV with a few comics
2. After import completes, Cover Review Queue should appear
3. Each comic should show image candidates from Google
4. Select a cover → "Set Cover" → moves to next comic
5. Skip → moves to next without setting cover
6. After all reviewed → redirects to collection
7. Check admin panel → /admin/cover-queue shows multi-match submissions

**Step 5: Commit**

```bash
git commit -m "feat: add Google CSE environment variables for cover image search"
```

---

## Task 11: Update Documentation

**Files:**
- Modify: `EVALUATION.md` — update cover image status
- Modify: `BACKLOG.md` — mark Comic Vine removal as complete
- Modify: `TEST_CASES.md` — add cover image search test cases

**Step 1: Update docs**

Add test cases for:
- CSV import triggers cover review for comics without covers
- Community DB returns cached cover (skip Claude)
- Single match auto-approves to community DB
- Multiple matches go to admin queue
- Admin approve/reject works
- Skip button works in cover review
- Cancel exits cover review gracefully

**Step 2: Commit**

```bash
git add EVALUATION.md BACKLOG.md TEST_CASES.md
git commit -m "docs: update evaluation, backlog, and test cases for cover image search"
```
