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
