// src/lib/__tests__/bulkActions.test.ts
import {
  toggleSelection,
  selectAll,
  clearSelection,
  isAllSelected,
  getSelectionCount,
  pruneSelection,
  partitionDeletableIds,
  computeNewListMemberIds,
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

  describe('pruneSelection', () => {
    it('drops IDs no longer visible after a filter change', () => {
      const selected = new Set(['a', 'b', 'c']);
      const result = pruneSelection(selected, ['a', 'c']);
      expect([...result].sort()).toEqual(['a', 'c']);
    });

    it('keeps all IDs when all are still visible', () => {
      const selected = new Set(['a', 'b']);
      const result = pruneSelection(selected, ['a', 'b', 'c']);
      expect(result.size).toBe(2);
    });

    it('returns empty Set when nothing visible', () => {
      const result = pruneSelection(new Set(['a', 'b']), []);
      expect(result.size).toBe(0);
    });

    it('returns a new Set instance (immutable)', () => {
      const selected = new Set(['a']);
      const result = pruneSelection(selected, ['a']);
      expect(result).not.toBe(selected);
    });
  });

  describe('partitionDeletableIds', () => {
    it('separates blocked (active-listing) IDs from deletable ones', () => {
      const owned = ['a', 'b', 'c', 'd'];
      const blocked = ['b', 'd'];
      const result = partitionDeletableIds(owned, blocked);
      expect(result.deletableIds).toEqual(['a', 'c']);
      expect(result.blockedIds).toEqual(['b', 'd']);
    });

    it('returns all deletable when nothing is blocked', () => {
      const result = partitionDeletableIds(['a', 'b'], []);
      expect(result.deletableIds).toEqual(['a', 'b']);
      expect(result.blockedIds).toEqual([]);
    });

    it('returns all blocked when every owned id has a listing', () => {
      const result = partitionDeletableIds(['a', 'b'], ['a', 'b', 'z']);
      expect(result.deletableIds).toEqual([]);
      expect(result.blockedIds).toEqual(['a', 'b']);
    });

    it('preserves input order of owned ids', () => {
      const result = partitionDeletableIds(['c', 'a', 'b'], ['a']);
      expect(result.deletableIds).toEqual(['c', 'b']);
    });
  });

  describe('computeNewListMemberIds', () => {
    it('excludes IDs already in the list and counts skips', () => {
      const owned = ['a', 'b', 'c'];
      const existing = ['b'];
      const result = computeNewListMemberIds(owned, existing);
      expect(result.newIds).toEqual(['a', 'c']);
      expect(result.skippedCount).toBe(1);
    });

    it('adds all when the list is empty', () => {
      const result = computeNewListMemberIds(['a', 'b'], []);
      expect(result.newIds).toEqual(['a', 'b']);
      expect(result.skippedCount).toBe(0);
    });

    it('adds none when every owned id is already present', () => {
      const result = computeNewListMemberIds(['a', 'b'], ['a', 'b']);
      expect(result.newIds).toEqual([]);
      expect(result.skippedCount).toBe(2);
    });

    it('does not double-count duplicate existing ids', () => {
      const result = computeNewListMemberIds(['a', 'b'], ['a', 'a']);
      expect(result.newIds).toEqual(['b']);
      expect(result.skippedCount).toBe(1);
    });
  });
});
