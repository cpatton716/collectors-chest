# Multi-Select Bulk Actions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add multi-select capability to the collection view with bulk delete, mark for trade, add to list, and mark as sold actions.

**Architecture:** Selection state managed via a new `useSelection` hook. Pure helper functions in `src/lib/bulkActions.ts` handle selection logic. UI components include a sticky bottom toolbar, confirmation modal for large deletes, and an undo toast with countdown timer. Soft delete pattern enables undo functionality.

**Tech Stack:** React hooks, TypeScript, Tailwind CSS (Lichtenstein pop-art style), existing Toast system extended for undo support.

---

## Task 1: Create Selection Helper Functions with Tests

**Files:**
- Create: `src/lib/bulkActions.ts`
- Create: `src/lib/__tests__/bulkActions.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/lib/__tests__/bulkActions.test.ts
import {
  toggleSelection,
  selectAll,
  clearSelection,
  isAllSelected,
  getSelectionCount,
} from '../bulkActions';

describe('bulkActions', () => {
  describe('toggleSelection', () => {
    it('adds ID to empty selection', () => {
      const result = toggleSelection(new Set(), 'comic-1');
      expect(result.has('comic-1')).toBe(true);
      expect(result.size).toBe(1);
    });

    it('removes ID if already selected', () => {
      const initial = new Set(['comic-1', 'comic-2']);
      const result = toggleSelection(initial, 'comic-1');
      expect(result.has('comic-1')).toBe(false);
      expect(result.has('comic-2')).toBe(true);
      expect(result.size).toBe(1);
    });

    it('preserves other selections when toggling', () => {
      const initial = new Set(['comic-1', 'comic-2']);
      const result = toggleSelection(initial, 'comic-3');
      expect(result.has('comic-1')).toBe(true);
      expect(result.has('comic-2')).toBe(true);
      expect(result.has('comic-3')).toBe(true);
      expect(result.size).toBe(3);
    });

    it('returns new Set instance (immutable)', () => {
      const initial = new Set(['comic-1']);
      const result = toggleSelection(initial, 'comic-2');
      expect(result).not.toBe(initial);
    });
  });

  describe('selectAll', () => {
    it('returns Set with all provided IDs', () => {
      const ids = ['comic-1', 'comic-2', 'comic-3'];
      const result = selectAll(ids);
      expect(result.size).toBe(3);
      expect(result.has('comic-1')).toBe(true);
      expect(result.has('comic-2')).toBe(true);
      expect(result.has('comic-3')).toBe(true);
    });

    it('returns empty Set for empty array', () => {
      const result = selectAll([]);
      expect(result.size).toBe(0);
    });
  });

  describe('clearSelection', () => {
    it('returns empty Set', () => {
      const result = clearSelection();
      expect(result.size).toBe(0);
    });
  });

  describe('isAllSelected', () => {
    it('returns true when selection equals visible count', () => {
      const selected = new Set(['a', 'b', 'c']);
      const visibleIds = ['a', 'b', 'c'];
      expect(isAllSelected(selected, visibleIds)).toBe(true);
    });

    it('returns false when selection is partial', () => {
      const selected = new Set(['a', 'b']);
      const visibleIds = ['a', 'b', 'c'];
      expect(isAllSelected(selected, visibleIds)).toBe(false);
    });

    it('returns false when selection is empty', () => {
      const selected = new Set<string>();
      const visibleIds = ['a', 'b', 'c'];
      expect(isAllSelected(selected, visibleIds)).toBe(false);
    });

    it('returns true when both are empty', () => {
      const selected = new Set<string>();
      const visibleIds: string[] = [];
      expect(isAllSelected(selected, visibleIds)).toBe(true);
    });
  });

  describe('getSelectionCount', () => {
    it('returns size of selection', () => {
      const selected = new Set(['a', 'b', 'c']);
      expect(getSelectionCount(selected)).toBe(3);
    });

    it('returns 0 for empty selection', () => {
      expect(getSelectionCount(new Set())).toBe(0);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/__tests__/bulkActions.test.ts`
Expected: FAIL with "Cannot find module '../bulkActions'"

**Step 3: Write minimal implementation**

```typescript
// src/lib/bulkActions.ts

/**
 * Toggle a comic ID in the selection set.
 * Returns a new Set (immutable operation).
 */
export function toggleSelection(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

/**
 * Select all comics by their IDs.
 * Returns a new Set containing all provided IDs.
 */
export function selectAll(ids: string[]): Set<string> {
  return new Set(ids);
}

/**
 * Clear all selections.
 * Returns an empty Set.
 */
export function clearSelection(): Set<string> {
  return new Set();
}

/**
 * Check if all visible comics are selected.
 */
export function isAllSelected(selected: Set<string>, visibleIds: string[]): boolean {
  if (visibleIds.length === 0) return selected.size === 0;
  return visibleIds.length === selected.size && visibleIds.every((id) => selected.has(id));
}

/**
 * Get the number of selected items.
 */
export function getSelectionCount(selected: Set<string>): number {
  return selected.size;
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/__tests__/bulkActions.test.ts`
Expected: All 10 tests PASS

**Step 5: Commit**

```bash
git add src/lib/bulkActions.ts src/lib/__tests__/bulkActions.test.ts
git commit -m "feat(bulk): add selection helper functions with tests"
```

---

## Task 2: Create useSelection Hook

**Files:**
- Create: `src/hooks/useSelection.ts`

**Step 1: Write the hook**

```typescript
// src/hooks/useSelection.ts
"use client";

import { useCallback, useState } from "react";

import {
  clearSelection,
  getSelectionCount,
  isAllSelected,
  selectAll,
  toggleSelection,
} from "@/lib/bulkActions";

export interface UseSelectionReturn {
  // State
  isSelectionMode: boolean;
  selectedIds: Set<string>;

  // Derived state
  selectionCount: number;
  hasSelection: boolean;
  checkIsAllSelected: (visibleIds: string[]) => boolean;

  // Actions
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;
  toggle: (id: string) => void;
  selectAllVisible: (visibleIds: string[]) => void;
  clearAll: () => void;
}

export function useSelection(): UseSelectionReturn {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggle = useCallback((id: string) => {
    setSelectedIds((current) => toggleSelection(current, id));
  }, []);

  const selectAllVisible = useCallback((visibleIds: string[]) => {
    setSelectedIds(selectAll(visibleIds));
  }, []);

  const clearAll = useCallback(() => {
    setSelectedIds(clearSelection());
  }, []);

  const checkIsAllSelected = useCallback(
    (visibleIds: string[]) => isAllSelected(selectedIds, visibleIds),
    [selectedIds]
  );

  return {
    // State
    isSelectionMode,
    selectedIds,

    // Derived state
    selectionCount: getSelectionCount(selectedIds),
    hasSelection: selectedIds.size > 0,
    checkIsAllSelected,

    // Actions
    enterSelectionMode,
    exitSelectionMode,
    toggle,
    selectAllVisible,
    clearAll,
  };
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/hooks/useSelection.ts
git commit -m "feat(bulk): add useSelection hook for selection state management"
```

---

## Task 3: Create Selection Checkbox Component

**Files:**
- Create: `src/components/collection/SelectionCheckbox.tsx`

**Step 1: Write the component**

```typescript
// src/components/collection/SelectionCheckbox.tsx
"use client";

import { Check } from "lucide-react";

interface SelectionCheckboxProps {
  checked: boolean;
  onChange: () => void;
}

export function SelectionCheckbox({ checked, onChange }: SelectionCheckboxProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={`w-6 h-6 border-2 border-pop-black flex items-center justify-center transition-all ${
        checked
          ? "bg-pop-green shadow-[2px_2px_0px_#000]"
          : "bg-pop-white hover:bg-pop-cream"
      }`}
      aria-checked={checked}
      role="checkbox"
    >
      {checked && <Check className="w-4 h-4 text-pop-white" strokeWidth={3} />}
    </button>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/collection/SelectionCheckbox.tsx
git commit -m "feat(bulk): add SelectionCheckbox component with pop-art styling"
```

---

## Task 4: Create Selection Mode Header Component

**Files:**
- Create: `src/components/collection/SelectionHeader.tsx`

**Step 1: Write the component**

```typescript
// src/components/collection/SelectionHeader.tsx
"use client";

import { CheckSquare, Square, X } from "lucide-react";

interface SelectionHeaderProps {
  selectionCount: number;
  isAllSelected: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onCancel: () => void;
}

export function SelectionHeader({
  selectionCount,
  isAllSelected,
  onSelectAll,
  onClear,
  onCancel,
}: SelectionHeaderProps) {
  return (
    <div className="bg-pop-yellow border-3 border-pop-black p-3 shadow-[4px_4px_0px_#000] mb-6 flex items-center justify-between">
      {/* Cancel Button */}
      <button
        onClick={onCancel}
        className="flex items-center gap-2 px-3 py-2 bg-pop-white border-2 border-pop-black font-comic text-sm hover:shadow-[2px_2px_0px_#000] transition-all"
      >
        <X className="w-4 h-4" />
        CANCEL
      </button>

      {/* Selection Count */}
      <div className="font-comic text-pop-black text-lg">
        {selectionCount} SELECTED
      </div>

      {/* Select All / Clear */}
      <div className="flex gap-2">
        {selectionCount > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-2 px-3 py-2 bg-pop-white border-2 border-pop-black font-comic text-sm hover:shadow-[2px_2px_0px_#000] transition-all"
          >
            <Square className="w-4 h-4" />
            CLEAR
          </button>
        )}
        <button
          onClick={onSelectAll}
          className={`flex items-center gap-2 px-3 py-2 border-2 border-pop-black font-comic text-sm hover:shadow-[2px_2px_0px_#000] transition-all ${
            isAllSelected
              ? "bg-pop-green text-pop-white"
              : "bg-pop-white text-pop-black"
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          {isAllSelected ? "ALL SELECTED" : "SELECT ALL"}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/collection/SelectionHeader.tsx
git commit -m "feat(bulk): add SelectionHeader component with select all/clear"
```

---

## Task 5: Create Selection Toolbar Component

**Files:**
- Create: `src/components/collection/SelectionToolbar.tsx`

**Step 1: Write the component**

```typescript
// src/components/collection/SelectionToolbar.tsx
"use client";

import { ArrowLeftRight, DollarSign, ListPlus, Trash2 } from "lucide-react";

interface SelectionToolbarProps {
  selectionCount: number;
  onDelete: () => void;
  onMarkForTrade: () => void;
  onAddToList: () => void;
  onMarkSold: () => void;
  disabled?: boolean;
}

export function SelectionToolbar({
  selectionCount,
  onDelete,
  onMarkForTrade,
  onAddToList,
  onMarkSold,
  disabled = false,
}: SelectionToolbarProps) {
  const isDisabled = disabled || selectionCount === 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-pop-white border-t-4 border-pop-black shadow-[0_-4px_0px_#000]">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-center gap-2 md:gap-4">
          {/* Delete */}
          <button
            onClick={onDelete}
            disabled={isDisabled}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 border-2 border-pop-black font-comic text-sm transition-all ${
              isDisabled
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-pop-red text-pop-white hover:shadow-[2px_2px_0px_#000]"
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">DELETE</span>
          </button>

          {/* Mark for Trade */}
          <button
            onClick={onMarkForTrade}
            disabled={isDisabled}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 border-2 border-pop-black font-comic text-sm transition-all ${
              isDisabled
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-pop-orange text-pop-white hover:shadow-[2px_2px_0px_#000]"
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span className="hidden sm:inline">TRADE</span>
          </button>

          {/* Add to List */}
          <button
            onClick={onAddToList}
            disabled={isDisabled}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 border-2 border-pop-black font-comic text-sm transition-all ${
              isDisabled
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-pop-blue text-pop-white hover:shadow-[2px_2px_0px_#000]"
            }`}
          >
            <ListPlus className="w-4 h-4" />
            <span className="hidden sm:inline">ADD TO LIST</span>
          </button>

          {/* Mark as Sold */}
          <button
            onClick={onMarkSold}
            disabled={isDisabled}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 border-2 border-pop-black font-comic text-sm transition-all ${
              isDisabled
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-pop-green text-pop-white hover:shadow-[2px_2px_0px_#000]"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span className="hidden sm:inline">SOLD</span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/collection/SelectionToolbar.tsx
git commit -m "feat(bulk): add SelectionToolbar with action buttons"
```

---

## Task 6: Create Bulk Delete Confirmation Modal

**Files:**
- Create: `src/components/collection/BulkDeleteModal.tsx`

**Step 1: Write the component**

```typescript
// src/components/collection/BulkDeleteModal.tsx
"use client";

import { AlertTriangle, X } from "lucide-react";

import { CollectionItem } from "@/types/comic";

interface BulkDeleteModalProps {
  items: CollectionItem[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function BulkDeleteModal({ items, onConfirm, onCancel }: BulkDeleteModalProps) {
  const displayItems = items.slice(0, 5);
  const remainingCount = items.length - displayItems.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-pop-white border-4 border-pop-black shadow-[6px_6px_0px_#000] max-w-md w-full">
        {/* Header */}
        <div className="bg-pop-red border-b-4 border-pop-black p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-pop-white" />
            <h2 className="font-comic text-pop-white text-xl">
              DELETE {items.length} COMICS?
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-pop-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-pop-white" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <ul className="space-y-2 mb-4">
            {displayItems.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-pop-black font-body">
                <span className="w-2 h-2 bg-pop-black" />
                {item.comic.title} #{item.comic.issueNumber}
              </li>
            ))}
            {remainingCount > 0 && (
              <li className="text-pop-black/70 font-body italic">
                ...and {remainingCount} more
              </li>
            )}
          </ul>

          <p className="text-sm text-pop-black/70 font-body mb-4">
            This action can be undone for 10 seconds after deletion.
          </p>
        </div>

        {/* Footer */}
        <div className="border-t-3 border-pop-black p-4 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-pop-cream border-2 border-pop-black font-comic text-pop-black hover:shadow-[2px_2px_0px_#000] transition-all"
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-pop-red border-2 border-pop-black font-comic text-pop-white hover:shadow-[2px_2px_0px_#000] transition-all"
          >
            DELETE
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/collection/BulkDeleteModal.tsx
git commit -m "feat(bulk): add BulkDeleteModal for confirming large deletes"
```

---

## Task 7: Create Undo Toast Component

**Files:**
- Create: `src/components/collection/UndoToast.tsx`

**Step 1: Write the component**

```typescript
// src/components/collection/UndoToast.tsx
"use client";

import { useEffect, useState } from "react";

import { Undo2 } from "lucide-react";

interface UndoToastProps {
  message: string;
  duration?: number; // in milliseconds
  onUndo: () => void;
  onExpire: () => void;
}

export function UndoToast({
  message,
  duration = 10000,
  onUndo,
  onExpire,
}: UndoToastProps) {
  const [progress, setProgress] = useState(100);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        setIsVisible(false);
        onExpire();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration, onExpire]);

  const handleUndo = () => {
    setIsVisible(false);
    onUndo();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-pop-black border-3 border-pop-white shadow-[4px_4px_0px_rgba(255,255,255,0.3)] min-w-[300px]">
      <div className="p-3 flex items-center justify-between gap-4">
        <span className="font-comic text-pop-white text-sm">{message}</span>
        <button
          onClick={handleUndo}
          className="flex items-center gap-2 px-3 py-1 bg-pop-yellow border-2 border-pop-black font-comic text-pop-black text-sm hover:shadow-[2px_2px_0px_#000] transition-all"
        >
          <Undo2 className="w-4 h-4" />
          UNDO
        </button>
      </div>
      {/* Progress bar */}
      <div className="h-1 bg-pop-white/30">
        <div
          className="h-full bg-pop-yellow transition-all duration-50"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/collection/UndoToast.tsx
git commit -m "feat(bulk): add UndoToast with countdown progress bar"
```

---

## Task 8: Create List Picker Modal for Bulk Add

**Files:**
- Create: `src/components/collection/BulkListPickerModal.tsx`

**Step 1: Write the component**

```typescript
// src/components/collection/BulkListPickerModal.tsx
"use client";

import { useState } from "react";

import { ListPlus, Plus, X } from "lucide-react";

import { UserList } from "@/types/comic";

interface BulkListPickerModalProps {
  lists: UserList[];
  selectionCount: number;
  onSelect: (listId: string) => void;
  onCreateList: (name: string) => Promise<UserList>;
  onCancel: () => void;
}

export function BulkListPickerModal({
  lists,
  selectionCount,
  onSelect,
  onCreateList,
  onCancel,
}: BulkListPickerModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter out the default "collection" list
  const userLists = lists.filter((l) => l.id !== "collection");

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    setIsSubmitting(true);
    try {
      const newList = await onCreateList(newListName.trim());
      onSelect(newList.id);
    } catch {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-pop-white border-4 border-pop-black shadow-[6px_6px_0px_#000] max-w-sm w-full">
        {/* Header */}
        <div className="bg-pop-blue border-b-4 border-pop-black p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListPlus className="w-6 h-6 text-pop-white" />
            <h2 className="font-comic text-pop-white text-lg">
              ADD {selectionCount} TO LIST
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-pop-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-pop-white" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 max-h-[300px] overflow-y-auto">
          {userLists.length === 0 && !isCreating ? (
            <p className="text-pop-black/70 font-body text-center py-4">
              No lists yet. Create one below!
            </p>
          ) : (
            <div className="space-y-2">
              {userLists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => onSelect(list.id)}
                  className="w-full px-4 py-3 bg-pop-cream border-2 border-pop-black font-comic text-left hover:shadow-[2px_2px_0px_#000] transition-all"
                >
                  {list.name}
                </button>
              ))}
            </div>
          )}

          {/* Create New List */}
          {isCreating ? (
            <div className="mt-4 p-3 border-2 border-pop-black border-dashed">
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="List name..."
                className="w-full px-3 py-2 border-2 border-pop-black font-body mb-2"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateList();
                  if (e.key === "Escape") setIsCreating(false);
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setIsCreating(false)}
                  className="flex-1 px-3 py-2 bg-pop-cream border-2 border-pop-black font-comic text-sm"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleCreateList}
                  disabled={!newListName.trim() || isSubmitting}
                  className="flex-1 px-3 py-2 bg-pop-green border-2 border-pop-black font-comic text-sm text-pop-white disabled:opacity-50"
                >
                  CREATE & ADD
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full mt-4 px-4 py-3 border-2 border-pop-black border-dashed font-comic text-pop-black/70 flex items-center justify-center gap-2 hover:bg-pop-cream transition-colors"
            >
              <Plus className="w-4 h-4" />
              CREATE NEW LIST
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/collection/BulkListPickerModal.tsx
git commit -m "feat(bulk): add BulkListPickerModal for adding to lists"
```

---

## Task 9: Add API Route for Bulk Delete

**Files:**
- Create: `src/app/api/comics/bulk-delete/route.ts`

**Step 1: Write the API route**

```typescript
// src/app/api/comics/bulk-delete/route.ts
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getOrCreateProfile } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { comicIds } = await request.json();

    if (!Array.isArray(comicIds) || comicIds.length === 0) {
      return NextResponse.json({ error: "Invalid comic IDs" }, { status: 400 });
    }

    // Get user's profile
    const profile = await getOrCreateProfile(userId);

    // Verify ownership and soft delete
    const { data: comics, error: fetchError } = await supabase
      .from("comics")
      .select("id")
      .in("id", comicIds)
      .eq("profile_id", profile.id)
      .is("deleted_at", null);

    if (fetchError) {
      console.error("Error fetching comics:", fetchError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const ownedIds = comics?.map((c) => c.id) || [];

    if (ownedIds.length === 0) {
      return NextResponse.json({ error: "No comics found to delete" }, { status: 404 });
    }

    // Soft delete by setting deleted_at
    const { error: deleteError } = await supabase
      .from("comics")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", ownedIds);

    if (deleteError) {
      console.error("Error deleting comics:", deleteError);
      return NextResponse.json({ error: "Failed to delete comics" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deletedCount: ownedIds.length,
      deletedIds: ownedIds,
    });
  } catch (error) {
    console.error("Bulk delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors (or note if deleted_at column doesn't exist yet - handle in Task 10)

**Step 3: Commit**

```bash
git add src/app/api/comics/bulk-delete/route.ts
git commit -m "feat(api): add bulk delete endpoint with soft delete"
```

---

## Task 10: Add API Route for Undo Delete

**Files:**
- Create: `src/app/api/comics/undo-delete/route.ts`

**Step 1: Write the API route**

```typescript
// src/app/api/comics/undo-delete/route.ts
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getOrCreateProfile } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { comicIds } = await request.json();

    if (!Array.isArray(comicIds) || comicIds.length === 0) {
      return NextResponse.json({ error: "Invalid comic IDs" }, { status: 400 });
    }

    // Get user's profile
    const profile = await getOrCreateProfile(userId);

    // Restore by clearing deleted_at
    const { data: comics, error: restoreError } = await supabase
      .from("comics")
      .update({ deleted_at: null })
      .in("id", comicIds)
      .eq("profile_id", profile.id)
      .not("deleted_at", "is", null)
      .select("id");

    if (restoreError) {
      console.error("Error restoring comics:", restoreError);
      return NextResponse.json({ error: "Failed to restore comics" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      restoredCount: comics?.length || 0,
      restoredIds: comics?.map((c) => c.id) || [],
    });
  } catch (error) {
    console.error("Undo delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/comics/undo-delete/route.ts
git commit -m "feat(api): add undo delete endpoint for restoration"
```

---

## Task 11: Add API Route for Bulk Update

**Files:**
- Create: `src/app/api/comics/bulk-update/route.ts`

**Step 1: Write the API route**

```typescript
// src/app/api/comics/bulk-update/route.ts
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getOrCreateProfile } from "@/lib/db";
import { supabase } from "@/lib/supabase";

type BulkUpdateField = "for_trade" | "is_sold";

interface BulkUpdateRequest {
  comicIds: string[];
  field: BulkUpdateField;
  value: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { comicIds, field, value }: BulkUpdateRequest = await request.json();

    if (!Array.isArray(comicIds) || comicIds.length === 0) {
      return NextResponse.json({ error: "Invalid comic IDs" }, { status: 400 });
    }

    const allowedFields: BulkUpdateField[] = ["for_trade", "is_sold"];
    if (!allowedFields.includes(field)) {
      return NextResponse.json({ error: "Invalid field" }, { status: 400 });
    }

    // Get user's profile
    const profile = await getOrCreateProfile(userId);

    // Verify ownership and update
    const { data: comics, error: fetchError } = await supabase
      .from("comics")
      .select("id")
      .in("id", comicIds)
      .eq("profile_id", profile.id)
      .is("deleted_at", null);

    if (fetchError) {
      console.error("Error fetching comics:", fetchError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const ownedIds = comics?.map((c) => c.id) || [];

    if (ownedIds.length === 0) {
      return NextResponse.json({ error: "No comics found to update" }, { status: 404 });
    }

    // Build update object
    const updateData: Record<string, unknown> = { [field]: value };

    // If marking as sold, also set sold_at timestamp
    if (field === "is_sold" && value) {
      updateData.sold_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("comics")
      .update(updateData)
      .in("id", ownedIds);

    if (updateError) {
      console.error("Error updating comics:", updateError);
      return NextResponse.json({ error: "Failed to update comics" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updatedCount: ownedIds.length,
      updatedIds: ownedIds,
    });
  } catch (error) {
    console.error("Bulk update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/comics/bulk-update/route.ts
git commit -m "feat(api): add bulk update endpoint for trade/sold status"
```

---

## Task 12: Add API Route for Bulk Add to List

**Files:**
- Create: `src/app/api/comics/bulk-add-to-list/route.ts`

**Step 1: Write the API route**

```typescript
// src/app/api/comics/bulk-add-to-list/route.ts
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getOrCreateProfile } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { comicIds, listId } = await request.json();

    if (!Array.isArray(comicIds) || comicIds.length === 0) {
      return NextResponse.json({ error: "Invalid comic IDs" }, { status: 400 });
    }

    if (!listId) {
      return NextResponse.json({ error: "List ID required" }, { status: 400 });
    }

    // Get user's profile
    const profile = await getOrCreateProfile(userId);

    // Verify list ownership
    const { data: list, error: listError } = await supabase
      .from("lists")
      .select("id")
      .eq("id", listId)
      .eq("profile_id", profile.id)
      .single();

    if (listError || !list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    // Verify comic ownership
    const { data: comics, error: comicsError } = await supabase
      .from("comics")
      .select("id")
      .in("id", comicIds)
      .eq("profile_id", profile.id)
      .is("deleted_at", null);

    if (comicsError) {
      console.error("Error fetching comics:", comicsError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const ownedIds = comics?.map((c) => c.id) || [];

    if (ownedIds.length === 0) {
      return NextResponse.json({ error: "No comics found" }, { status: 404 });
    }

    // Get existing list memberships to avoid duplicates
    const { data: existing } = await supabase
      .from("comic_lists")
      .select("comic_id")
      .eq("list_id", listId)
      .in("comic_id", ownedIds);

    const existingIds = new Set(existing?.map((e) => e.comic_id) || []);
    const newIds = ownedIds.filter((id) => !existingIds.has(id));

    if (newIds.length === 0) {
      return NextResponse.json({
        success: true,
        addedCount: 0,
        message: "All comics already in list",
      });
    }

    // Add to list
    const { error: insertError } = await supabase.from("comic_lists").insert(
      newIds.map((comicId) => ({
        comic_id: comicId,
        list_id: listId,
      }))
    );

    if (insertError) {
      console.error("Error adding to list:", insertError);
      return NextResponse.json({ error: "Failed to add to list" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      addedCount: newIds.length,
      skippedCount: existingIds.size,
    });
  } catch (error) {
    console.error("Bulk add to list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/comics/bulk-add-to-list/route.ts
git commit -m "feat(api): add bulk add to list endpoint"
```

---

## Task 13: Update ComicCard to Support Selection Mode

**Files:**
- Modify: `src/components/ComicCard.tsx`

**Step 1: Update the component**

Add selection mode props and checkbox overlay to the existing ComicCard component:

```typescript
// At the top of the file, add import:
import { SelectionCheckbox } from "@/components/collection/SelectionCheckbox";

// Update the interface:
interface ComicCardProps {
  item: CollectionItem;
  onClick?: () => void;
  onToggleStar?: (id: string) => void;
  onEdit?: (item: CollectionItem) => void;
  // New selection props
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

// Update the function signature:
export function ComicCard({
  item,
  onClick,
  onToggleStar,
  onEdit,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
}: ComicCardProps) {
  // ... existing code ...

  const handleCardClick = () => {
    if (isSelectionMode && onToggleSelect) {
      onToggleSelect(item.id);
    } else {
      onClick?.();
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`comic-card cursor-pointer group ${
        isSelected ? "ring-4 ring-pop-yellow" : ""
      }`}
    >
      {/* Cover Image */}
      <div className="relative aspect-[2/3] bg-pop-cream border-b-3 border-pop-black">
        {/* Selection Checkbox - shown in selection mode */}
        {isSelectionMode && onToggleSelect && (
          <div className="absolute top-2 left-2 z-10">
            <SelectionCheckbox
              checked={isSelected}
              onChange={() => onToggleSelect(item.id)}
            />
          </div>
        )}

        {/* ... rest of existing cover image code ... */}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/ComicCard.tsx
git commit -m "feat(bulk): update ComicCard to support selection mode"
```

---

## Task 14: Integrate Selection into Collection Page

**Files:**
- Modify: `src/app/collection/page.tsx`

**Step 1: Add imports at top of file**

```typescript
// Add these imports
import { CheckSquare } from "lucide-react"; // Add to existing lucide imports

import { useSelection } from "@/hooks/useSelection";

import { BulkDeleteModal } from "@/components/collection/BulkDeleteModal";
import { BulkListPickerModal } from "@/components/collection/BulkListPickerModal";
import { SelectionHeader } from "@/components/collection/SelectionHeader";
import { SelectionToolbar } from "@/components/collection/SelectionToolbar";
import { UndoToast } from "@/components/collection/UndoToast";
```

**Step 2: Add selection state inside the component**

After the existing useState declarations, add:

```typescript
// Selection state
const {
  isSelectionMode,
  selectedIds,
  selectionCount,
  hasSelection,
  checkIsAllSelected,
  enterSelectionMode,
  exitSelectionMode,
  toggle: toggleSelection,
  selectAllVisible,
  clearAll: clearSelection,
} = useSelection();

// Bulk action modals
const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
const [showBulkListPicker, setShowBulkListPicker] = useState(false);
const [undoState, setUndoState] = useState<{
  message: string;
  comicIds: string[];
  items: CollectionItem[];
} | null>(null);
```

**Step 3: Add bulk action handlers**

```typescript
// Get selected items
const selectedItems = filteredCollection.filter((item) => selectedIds.has(item.id));
const visibleIds = filteredCollection.map((item) => item.id);

// Bulk delete handler
const handleBulkDelete = async () => {
  if (selectedItems.length >= 10) {
    setShowBulkDeleteModal(true);
    return;
  }
  await executeBulkDelete();
};

const executeBulkDelete = async () => {
  setShowBulkDeleteModal(false);
  const idsToDelete = Array.from(selectedIds);
  const itemsToDelete = [...selectedItems];

  try {
    const response = await fetch("/api/comics/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comicIds: idsToDelete }),
    });

    if (!response.ok) throw new Error("Failed to delete");

    // Show undo toast
    setUndoState({
      message: `${idsToDelete.length} comics deleted`,
      comicIds: idsToDelete,
      items: itemsToDelete,
    });

    // Exit selection mode and refresh
    exitSelectionMode();
    await refresh();
  } catch {
    showToast("Failed to delete comics", "error");
  }
};

const handleUndoDelete = async () => {
  if (!undoState) return;

  try {
    const response = await fetch("/api/comics/undo-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comicIds: undoState.comicIds }),
    });

    if (!response.ok) throw new Error("Failed to undo");

    showToast(`Restored ${undoState.comicIds.length} comics`, "success");
    setUndoState(null);
    await refresh();
  } catch {
    showToast("Failed to restore comics", "error");
  }
};

// Bulk mark for trade handler
const handleBulkMarkForTrade = async () => {
  const idsToUpdate = Array.from(selectedIds);

  try {
    const response = await fetch("/api/comics/bulk-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comicIds: idsToUpdate,
        field: "for_trade",
        value: true,
      }),
    });

    if (!response.ok) throw new Error("Failed to update");

    showToast(`Marked ${idsToUpdate.length} comics for trade`, "success");
    exitSelectionMode();
    await refresh();
  } catch {
    showToast("Failed to mark for trade", "error");
  }
};

// Bulk add to list handler
const handleBulkAddToList = async (listId: string) => {
  const idsToAdd = Array.from(selectedIds);
  setShowBulkListPicker(false);

  try {
    const response = await fetch("/api/comics/bulk-add-to-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comicIds: idsToAdd, listId }),
    });

    if (!response.ok) throw new Error("Failed to add to list");

    const result = await response.json();
    const list = lists.find((l) => l.id === listId);
    showToast(`Added ${result.addedCount} comics to "${list?.name}"`, "success");
    exitSelectionMode();
    await refresh();
  } catch {
    showToast("Failed to add to list", "error");
  }
};

// Bulk mark as sold handler
const handleBulkMarkSold = async () => {
  const idsToUpdate = Array.from(selectedIds);

  try {
    const response = await fetch("/api/comics/bulk-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comicIds: idsToUpdate,
        field: "is_sold",
        value: true,
      }),
    });

    if (!response.ok) throw new Error("Failed to update");

    showToast(`Marked ${idsToUpdate.length} comics as sold`, "success");
    exitSelectionMode();
    await refresh();
  } catch {
    showToast("Failed to mark as sold", "error");
  }
};

// Add refresh to useCollection destructuring
const { refresh, ...otherCollectionProps } = useCollection();
```

**Step 4: Add Select button to header**

In the header section, add a Select button before "Add Book":

```typescript
<button
  onClick={enterSelectionMode}
  className="inline-flex items-center gap-2 px-3 py-2 bg-pop-white border-2 border-pop-black text-pop-black font-bold hover:shadow-[2px_2px_0px_#000] transition-all"
>
  <CheckSquare className="w-5 h-5" />
  <span className="hidden sm:inline">Select</span>
</button>
```

**Step 5: Add SelectionHeader below stats cards**

```typescript
{/* Selection Header - shown when in selection mode */}
{isSelectionMode && (
  <SelectionHeader
    selectionCount={selectionCount}
    isAllSelected={checkIsAllSelected(visibleIds)}
    onSelectAll={() => selectAllVisible(visibleIds)}
    onClear={clearSelection}
    onCancel={exitSelectionMode}
  />
)}
```

**Step 6: Update ComicCard rendering in grid**

```typescript
{filteredCollection.map((item) => (
  <ComicCard
    key={item.id}
    item={item}
    onClick={() => handleComicClick(item)}
    onToggleStar={handleToggleStar}
    onEdit={handleEdit}
    isSelectionMode={isSelectionMode}
    isSelected={selectedIds.has(item.id)}
    onToggleSelect={toggleSelection}
  />
))}
```

**Step 7: Add modals and toolbar at end of component**

Before the closing `</div>` of the main container:

```typescript
{/* Selection Toolbar - shown when in selection mode */}
{isSelectionMode && (
  <SelectionToolbar
    selectionCount={selectionCount}
    onDelete={handleBulkDelete}
    onMarkForTrade={handleBulkMarkForTrade}
    onAddToList={() => setShowBulkListPicker(true)}
    onMarkSold={handleBulkMarkSold}
  />
)}

{/* Bulk Delete Confirmation Modal */}
{showBulkDeleteModal && (
  <BulkDeleteModal
    items={selectedItems}
    onConfirm={executeBulkDelete}
    onCancel={() => setShowBulkDeleteModal(false)}
  />
)}

{/* Bulk List Picker Modal */}
{showBulkListPicker && (
  <BulkListPickerModal
    lists={lists}
    selectionCount={selectionCount}
    onSelect={handleBulkAddToList}
    onCreateList={handleCreateList}
    onCancel={() => setShowBulkListPicker(false)}
  />
)}

{/* Undo Toast */}
{undoState && (
  <UndoToast
    message={undoState.message}
    onUndo={handleUndoDelete}
    onExpire={() => setUndoState(null)}
  />
)}
```

**Step 8: Add padding for toolbar**

Update the main container to add bottom padding when in selection mode:

```typescript
<div className={`max-w-7xl mx-auto ${isSelectionMode ? "pb-20" : ""}`}>
```

**Step 9: Verify build succeeds**

Run: `npm run build`
Expected: Build succeeds

**Step 10: Commit**

```bash
git add src/app/collection/page.tsx
git commit -m "feat(bulk): integrate selection mode into collection page"
```

---

## Task 15: Database Migration for Soft Delete

**Files:**
- Create: `supabase/migrations/YYYYMMDD_add_deleted_at.sql`

**Step 1: Create migration file**

```sql
-- Add deleted_at column for soft delete support
ALTER TABLE comics
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_comics_deleted_at ON comics(deleted_at);

-- Update RLS policies to exclude soft-deleted records
-- Note: You may need to update existing policies
```

**Step 2: Apply migration**

Run: `npx supabase db push` or apply via Supabase dashboard

**Step 3: Commit migration**

```bash
git add supabase/migrations/
git commit -m "db: add deleted_at column for soft delete support"
```

---

## Task 16: Update DB Queries to Filter Soft Deletes

**Files:**
- Modify: `src/lib/db.ts`

**Step 1: Update getUserComics function**

Add `.is("deleted_at", null)` filter to the query:

```typescript
export async function getUserComics(profileId: string): Promise<CollectionItem[]> {
  const { data, error } = await supabase
    .from("comics")
    .select("*")
    .eq("profile_id", profileId)
    .is("deleted_at", null)  // Add this line
    .order("created_at", { ascending: false });
  // ... rest of function
}
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "fix(db): filter soft-deleted comics from queries"
```

---

## Task 17: Manual Testing Checklist

**Step 1: Test selection mode entry/exit**

1. Navigate to /collection
2. Click "Select" button
3. Verify: Checkboxes appear on all comics
4. Verify: Selection header appears
5. Verify: Bottom toolbar appears
6. Click "Cancel"
7. Verify: Selection mode exits cleanly

**Step 2: Test selection behavior**

1. Enter selection mode
2. Tap a comic card
3. Verify: Checkbox toggles, card highlights
4. Tap "Select All"
5. Verify: All visible comics selected
6. Tap "Clear"
7. Verify: All deselected

**Step 3: Test bulk delete**

1. Select 3 comics
2. Tap "Delete"
3. Verify: Comics deleted immediately (no modal)
4. Verify: Undo toast appears
5. Tap "Undo"
6. Verify: Comics restored

**Step 4: Test bulk delete confirmation**

1. Select 10+ comics
2. Tap "Delete"
3. Verify: Confirmation modal appears
4. Verify: Shows first 5 titles + remaining count
5. Tap "Delete" in modal
6. Verify: Comics deleted, undo toast appears

**Step 5: Test other bulk actions**

1. Select comics and tap "Trade" - verify status updates
2. Select comics and tap "Add to List" - verify modal and addition
3. Select comics and tap "Sold" - verify status updates

**Step 6: Test mobile responsiveness**

1. Test on mobile viewport
2. Verify: Toolbar buttons show icons only on small screens
3. Verify: Touch targets are adequate size
4. Verify: Toolbar doesn't obscure content

**Step 7: Commit test verification**

```bash
git commit --allow-empty -m "test: verify bulk actions manual testing complete"
```

---

## Task 18: Final Integration Test and Cleanup

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Run type check**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Run lint**

Run: `npm run lint`
Expected: No errors (or only warnings)

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(bulk): complete multi-select bulk actions implementation

- Add selection helper functions with full test coverage
- Add useSelection hook for state management
- Add SelectionCheckbox, SelectionHeader, SelectionToolbar components
- Add BulkDeleteModal with confirmation for 10+ items
- Add UndoToast with 10-second countdown
- Add BulkListPickerModal for adding to lists
- Add API routes: bulk-delete, undo-delete, bulk-update, bulk-add-to-list
- Update ComicCard to support selection mode
- Integrate selection into collection page
- Add soft delete support with deleted_at column

Implements feedback item #18 from January 28th."
```

---

## Summary

**Total Tasks:** 18
**Estimated Commits:** 18-20

**Files Created:**
- `src/lib/bulkActions.ts`
- `src/lib/__tests__/bulkActions.test.ts`
- `src/hooks/useSelection.ts`
- `src/components/collection/SelectionCheckbox.tsx`
- `src/components/collection/SelectionHeader.tsx`
- `src/components/collection/SelectionToolbar.tsx`
- `src/components/collection/BulkDeleteModal.tsx`
- `src/components/collection/UndoToast.tsx`
- `src/components/collection/BulkListPickerModal.tsx`
- `src/app/api/comics/bulk-delete/route.ts`
- `src/app/api/comics/undo-delete/route.ts`
- `src/app/api/comics/bulk-update/route.ts`
- `src/app/api/comics/bulk-add-to-list/route.ts`

**Files Modified:**
- `src/components/ComicCard.tsx`
- `src/app/collection/page.tsx`
- `src/lib/db.ts`

**Database Changes:**
- Add `deleted_at` column to `comics` table
