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

/**
 * Prune any selected IDs that are no longer present in the visible set.
 * Used when filters change so a hidden-but-selected comic isn't acted on.
 * Returns a new Set (immutable operation).
 */
export function pruneSelection(selected: Set<string>, visibleIds: string[]): Set<string> {
  const visible = new Set(visibleIds);
  const next = new Set<string>();
  for (const id of selected) {
    if (visible.has(id)) next.add(id);
  }
  return next;
}

/**
 * Partition owned comic IDs into those that can be soft-deleted and those
 * blocked by an active shop listing.
 *
 * Pure helper extracted from the bulk-delete route so the rule
 * (active/ended listings block deletion) is unit-testable.
 *
 * @param ownedIds - Comic IDs confirmed to belong to the requesting user.
 * @param blockedIds - Comic IDs that currently have an active/ended listing.
 */
export function partitionDeletableIds(
  ownedIds: string[],
  blockedIds: Iterable<string>
): { deletableIds: string[]; blockedIds: string[] } {
  const blocked = new Set(blockedIds);
  const deletableIds: string[] = [];
  const blockedOut: string[] = [];
  for (const id of ownedIds) {
    if (blocked.has(id)) {
      blockedOut.push(id);
    } else {
      deletableIds.push(id);
    }
  }
  return { deletableIds, blockedIds: blockedOut };
}

/**
 * Compute which owned comic IDs still need adding to a list, given the IDs
 * already present in that list. Pure helper extracted from the
 * bulk-add-to-list route so dedup behavior is unit-testable.
 *
 * @param ownedIds - Comic IDs confirmed to belong to the requesting user.
 * @param existingIds - Comic IDs already in the target list.
 */
export function computeNewListMemberIds(
  ownedIds: string[],
  existingIds: Iterable<string>
): { newIds: string[]; skippedCount: number } {
  const existing = new Set(existingIds);
  const newIds = ownedIds.filter((id) => !existing.has(id));
  return { newIds, skippedCount: ownedIds.length - newIds.length };
}
