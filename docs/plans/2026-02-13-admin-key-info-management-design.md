# Admin Key Info Management + Custom Key Info Sandboxing — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow admins to manage the global key_comics database (CRUD) and prevent unapproved user-added key info from appearing in public-facing surfaces (shop, auctions, public collections).

**Architecture:** Two-part change. Part 1 sandboxes `customKeyInfo` so it only appears publicly when `customKeyInfoStatus === "approved"` — this is a data-layer filter in transform functions plus a strip in `getPublicComics()`. Part 2 adds full CRUD API routes for the `key_comics` table and a new "Database" tab on the existing admin key-info page.

**Tech Stack:** Next.js API routes, Supabase (PostgreSQL), React (client components), Vitest

---

## Task 1: Sandbox — Write tests for custom key info filtering

**Files:**
- Create: `src/lib/__tests__/keyInfoSandbox.test.ts`

**Step 1: Write the tests**

```typescript
import { describe, expect, it } from "vitest";
import { filterCustomKeyInfoForPublic } from "../keyInfoHelpers";

describe("filterCustomKeyInfoForPublic", () => {
  it("returns customKeyInfo when status is approved", () => {
    const result = filterCustomKeyInfoForPublic(
      ["First appearance of X"],
      "approved"
    );
    expect(result).toEqual(["First appearance of X"]);
  });

  it("returns empty array when status is pending", () => {
    const result = filterCustomKeyInfoForPublic(
      ["First appearance of X"],
      "pending"
    );
    expect(result).toEqual([]);
  });

  it("returns empty array when status is rejected", () => {
    const result = filterCustomKeyInfoForPublic(
      ["First appearance of X"],
      "rejected"
    );
    expect(result).toEqual([]);
  });

  it("returns empty array when status is null", () => {
    const result = filterCustomKeyInfoForPublic(
      ["First appearance of X"],
      null
    );
    expect(result).toEqual([]);
  });

  it("returns empty array when customKeyInfo is empty", () => {
    const result = filterCustomKeyInfoForPublic([], "approved");
    expect(result).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/keyInfoSandbox.test.ts`
Expected: FAIL — `filterCustomKeyInfoForPublic` not found

---

## Task 2: Sandbox — Implement helper and integrate into transforms

**Files:**
- Create: `src/lib/keyInfoHelpers.ts`
- Modify: `src/lib/db.ts:726-742` (getPublicComics)
- Modify: `src/lib/auctionDb.ts:1807` (transform customKeyInfo)

**Step 1: Create the helper**

```typescript
// src/lib/keyInfoHelpers.ts

/**
 * Filter custom key info for public display.
 * Only approved custom key info should be shown to other users.
 */
export function filterCustomKeyInfoForPublic(
  customKeyInfo: string[],
  status: "pending" | "approved" | "rejected" | null
): string[] {
  if (status !== "approved") return [];
  return customKeyInfo;
}
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- src/lib/__tests__/keyInfoSandbox.test.ts`
Expected: PASS (all 5 tests)

**Step 3: Update `getPublicComics` in `src/lib/db.ts`**

In `getPublicComics()` (around line 741), after mapping through `transformDbComicToCollectionItem`, strip unapproved custom key info:

```typescript
import { filterCustomKeyInfoForPublic } from "./keyInfoHelpers";

// In getPublicComics, change the return to:
return (data || []).map((row) => {
  const item = transformDbComicToCollectionItem(row);
  // Sandbox: only show approved custom key info publicly
  item.customKeyInfo = filterCustomKeyInfoForPublic(
    item.customKeyInfo,
    item.customKeyInfoStatus
  );
  return item;
});
```

**Step 4: Update auction transform in `src/lib/auctionDb.ts`**

In the `transformDbAuction` function (around line 1807), filter custom key info:

```typescript
import { filterCustomKeyInfoForPublic } from "./keyInfoHelpers";

// Change line ~1807 from:
customKeyInfo: (comics.custom_key_info as string[]) || [],
// To:
customKeyInfo: filterCustomKeyInfoForPublic(
  (comics.custom_key_info as string[]) || [],
  comics.custom_key_info_status as "pending" | "approved" | "rejected" | null
),
```

**Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/lib/keyInfoHelpers.ts src/lib/__tests__/keyInfoSandbox.test.ts src/lib/db.ts src/lib/auctionDb.ts
git commit -m "feat: sandbox custom key info — only show approved entries publicly"
```

---

## Task 3: Admin CRUD API — GET and POST for key_comics

**Files:**
- Create: `src/app/api/admin/key-comics/route.ts`
- Modify: `src/lib/keyComicsDb.ts` (add CRUD helpers)

**Step 1: Add CRUD helpers to `src/lib/keyComicsDb.ts`**

Add these functions after the existing code:

```typescript
// ==========================================
// Admin CRUD Functions for key_comics
// ==========================================

/**
 * Search/list key_comics entries with pagination
 */
export async function searchKeyComics(params: {
  search?: string;
  source?: string;
  page?: number;
  limit?: number;
}): Promise<{
  entries: Array<{
    id: string;
    title: string;
    issueNumber: string;
    publisher: string | null;
    keyInfo: string[];
    source: string;
    contributedBy: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
  error?: string;
}> {
  if (!supabase) return { entries: [], total: 0, error: "Database not available" };

  const page = params.page || 1;
  const limit = params.limit || 25;
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from("key_comics")
      .select("*", { count: "exact" });

    if (params.search) {
      const normalized = normalizeTitle(params.search);
      query = query.ilike("title_normalized", `%${normalized}%`);
    }

    if (params.source) {
      query = query.eq("source", params.source);
    }

    const { data, count, error } = await query
      .order("title", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) return { entries: [], total: 0, error: error.message };

    return {
      entries: (data || []).map((e) => ({
        id: e.id,
        title: e.title,
        issueNumber: e.issue_number,
        publisher: e.publisher,
        keyInfo: e.key_info || [],
        source: e.source,
        contributedBy: e.contributed_by,
        createdAt: e.created_at,
        updatedAt: e.updated_at,
      })),
      total: count || 0,
    };
  } catch (error) {
    return {
      entries: [],
      total: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create a new key_comics entry
 */
export async function createKeyComic(params: {
  title: string;
  issueNumber: string;
  publisher?: string;
  keyInfo: string[];
}): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!supabase) return { success: false, error: "Database not available" };

  try {
    const normalizedTitle = normalizeTitle(params.title);

    // Check for duplicates
    const { data: existing } = await supabase
      .from("key_comics")
      .select("id")
      .eq("title_normalized", normalizedTitle)
      .eq("issue_number", params.issueNumber)
      .single();

    if (existing) {
      return { success: false, error: "An entry for this comic already exists" };
    }

    const { data, error } = await supabase
      .from("key_comics")
      .insert({
        title: params.title,
        title_normalized: normalizedTitle,
        issue_number: params.issueNumber,
        publisher: params.publisher || null,
        key_info: params.keyInfo,
        source: "curated",
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, id: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update a key_comics entry
 */
export async function updateKeyComic(
  id: string,
  params: {
    title?: string;
    issueNumber?: string;
    publisher?: string;
    keyInfo?: string[];
  }
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: "Database not available" };

  try {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (params.title !== undefined) {
      updateData.title = params.title;
      updateData.title_normalized = normalizeTitle(params.title);
    }
    if (params.issueNumber !== undefined) updateData.issue_number = params.issueNumber;
    if (params.publisher !== undefined) updateData.publisher = params.publisher;
    if (params.keyInfo !== undefined) updateData.key_info = params.keyInfo;

    const { error } = await supabase
      .from("key_comics")
      .update(updateData)
      .eq("id", id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete a key_comics entry
 */
export async function deleteKeyComic(
  id: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: "Database not available" };

  try {
    const { error } = await supabase
      .from("key_comics")
      .delete()
      .eq("id", id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
```

**Step 2: Create `src/app/api/admin/key-comics/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAdminProfile } from "@/lib/adminAuth";
import { searchKeyComics, createKeyComic } from "@/lib/keyComicsDb";

// GET - Search/list key_comics entries
export async function GET(request: NextRequest) {
  try {
    const adminProfile = await getAdminProfile();
    if (!adminProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const source = searchParams.get("source") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");

    const result = await searchKeyComics({ search, source, page, limit });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      entries: result.entries,
      total: result.total,
      page,
      limit,
    });
  } catch (error) {
    console.error("Error fetching key comics:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

// POST - Create a new key_comics entry
export async function POST(request: NextRequest) {
  try {
    const adminProfile = await getAdminProfile();
    if (!adminProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, issueNumber, publisher, keyInfo } = body;

    if (!title || !issueNumber || !keyInfo || keyInfo.length === 0) {
      return NextResponse.json(
        { error: "Title, issue number, and at least one key info entry are required" },
        { status: 400 }
      );
    }

    const result = await createKeyComic({ title, issueNumber, publisher, keyInfo });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch (error) {
    console.error("Error creating key comic:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/keyComicsDb.ts src/app/api/admin/key-comics/route.ts
git commit -m "feat: admin CRUD helpers and GET/POST API for key_comics"
```

---

## Task 4: Admin CRUD API — PATCH and DELETE for key_comics/[id]

**Files:**
- Create: `src/app/api/admin/key-comics/[id]/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAdminProfile } from "@/lib/adminAuth";
import { updateKeyComic, deleteKeyComic } from "@/lib/keyComicsDb";

// PATCH - Update a key_comics entry
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminProfile = await getAdminProfile();
    if (!adminProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, issueNumber, publisher, keyInfo } = body;

    const result = await updateKeyComic(id, {
      title,
      issueNumber,
      publisher,
      keyInfo,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating key comic:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

// DELETE - Delete a key_comics entry
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminProfile = await getAdminProfile();
    if (!adminProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const result = await deleteKeyComic(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting key comic:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/admin/key-comics/[id]/route.ts
git commit -m "feat: admin PATCH/DELETE API for key_comics entries"
```

---

## Task 5: Admin UI — Add "Database" tab to key-info page

**Files:**
- Modify: `src/app/admin/key-info/page.tsx`

This is the largest task. Add:
1. New `"database"` option to `activeTab` state
2. New state for: `keyComicEntries`, `keyComicsTotal`, `searchQuery`, `sourceFilter`, `currentPage`, `editingEntry`, `deletingEntry`, `showCreateForm`
3. Fetch function `fetchKeyComics()` that calls `GET /api/admin/key-comics`
4. Create/Edit/Delete handlers
5. "Database" tab button alongside existing tabs
6. Database tab content: search bar, entries list, create form, edit modal, delete confirmation

**Key UI elements:**
- Search input with debounce (title filter)
- Source filter dropdown (All / Curated / Community)
- Paginated card list showing: title #issue, publisher, source badge, key_info badges, edit/delete buttons
- "Add Entry" button that shows inline form (title, issue, publisher, key_info textarea — one per line)
- Edit: opens same form pre-filled with current values
- Delete: confirmation dialog with comic title

**Step 1: Add the Database tab and all CRUD UI**

Add new state, handlers, and tab content to the existing page component. The tab button goes alongside "Suggestions" and "From Comics". Content renders when `activeTab === "database"`.

**Step 2: Run dev server and manually test**

1. Navigate to `/admin/key-info`
2. Click "Database" tab — should see paginated entries
3. Search by title — should filter results
4. Click "Add Entry" — fill form, submit — should create entry
5. Click edit on an entry — modify key info, save — should update
6. Click delete on an entry — confirm — should remove entry

**Step 3: Commit**

```bash
git add src/app/admin/key-info/page.tsx
git commit -m "feat: admin key comics database tab with full CRUD UI"
```

---

## Task 6: Final verification and cleanup

**Step 1: Run full check**

```bash
npm run check
```

Expected: typecheck + lint + test all pass

**Step 2: Manual verification checklist**

- [ ] Public collection page (`/u/[username]`) does NOT show unapproved custom key info
- [ ] Auction detail modal does NOT show unapproved custom key info
- [ ] Owner's collection view DOES show custom key info regardless of status
- [ ] Admin key-info page "Database" tab loads with entries
- [ ] Admin can search, create, edit, delete entries
- [ ] All existing tests still pass

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: admin key info management + custom key info sandboxing"
```
