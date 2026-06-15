"use client";

import { MutableRefObject, useEffect, useId, useRef } from "react";

interface UseDialogA11yResult {
  /** Stable id for the dialog's labelling element (wire to the title via `id` + `aria-labelledby`). */
  titleId: string;
  /** Attach to the dialog panel element so focus can be moved into it on open. */
  dialogRef: MutableRefObject<HTMLDivElement | null>;
}

/**
 * Dialog accessibility wiring scoped to the Comic Detail batch (R3).
 *
 * Adds the H-CC6/H-CO6 pattern:
 * - Escape-to-close wired to the supplied `onClose`.
 * - Focus moves into the dialog panel when it opens.
 * - Focus is restored to the previously focused element when it closes.
 *
 * Behavior-preserving: this only manages focus + Escape. It does not own
 * open/close state, submit handlers, or any network behavior. Callers spread
 * `role="dialog"` / `aria-modal="true"` / `aria-labelledby={titleId}` onto the
 * panel themselves and render their title with `id={titleId}`.
 *
 * Kept separate from R4's `src/hooks/useModalA11y.ts` to keep the refactor
 * batches file-disjoint (per the refactor plan cross-batch notes).
 */
export function useDialogA11y(isOpen: boolean, onClose: () => void): UseDialogA11yResult {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);

  // Escape-to-close.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus management: move focus into the dialog on open, restore on close.
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current = document.activeElement;
    const node = dialogRef.current;
    if (node) {
      const focusTarget = node.querySelector<HTMLElement>(
        'input, select, textarea, button, a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusTarget) {
        focusTarget.focus();
      } else {
        node.focus();
      }
    }
    return () => {
      const previous = previouslyFocusedRef.current;
      if (previous instanceof HTMLElement) {
        previous.focus();
      }
    };
  }, [isOpen]);

  return { titleId, dialogRef };
}
