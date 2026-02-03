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
