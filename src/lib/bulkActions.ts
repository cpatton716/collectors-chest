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
