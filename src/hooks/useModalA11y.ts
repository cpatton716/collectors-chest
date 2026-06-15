"use client";

import { useCallback, useEffect, useId, useRef } from "react";

/**
 * useModalA11y — shared accessibility wiring for overlay modals (H-CC7).
 *
 * Behavior-preserving helper: it ONLY adds dialog semantics, Escape-to-close,
 * and focus management to an existing modal. It does NOT own open/close state,
 * submit logic, or visuals. Spread `dialogProps` onto the modal's panel element
 * (the focusable dialog container) to get:
 *   - role="dialog" (or "alertdialog" for destructive confirms)
 *   - aria-modal="true"
 *   - aria-label / aria-labelledby wiring
 *   - tabIndex={-1} + a ref so the panel can receive focus on open
 *
 * Escape (when `isOpen`) calls `onClose`. On open, focus moves to
 * `initialFocusRef` if supplied, otherwise to the dialog panel. On close, focus
 * is restored to whatever element was focused before the modal opened. An
 * optional focus trap keeps Tab within the dialog.
 *
 * @param options.isOpen        Whether the modal is currently rendered/open.
 * @param options.onClose       Called when Escape is pressed.
 * @param options.initialFocusRef Optional element to focus on open (e.g. a field).
 * @param options.role          "dialog" (default) or "alertdialog".
 * @param options.label         aria-label string. Use when there is no visible title.
 * @param options.labelledBy    id of the visible title element (aria-labelledby).
 *                              If neither label nor labelledBy is given, an id is
 *                              generated and returned as `titleId` for you to put
 *                              on your heading.
 * @param options.trapFocus     Keep Tab focus inside the dialog (default false).
 */

export type ModalRole = "dialog" | "alertdialog";

export interface UseModalA11yOptions {
  isOpen: boolean;
  onClose: () => void;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  role?: ModalRole;
  label?: string;
  labelledBy?: string;
  trapFocus?: boolean;
}

export interface UseModalA11yResult {
  /** Ref to attach to the dialog panel element. */
  dialogRef: React.RefObject<HTMLDivElement>;
  /**
   * Props to spread onto the dialog panel element. Provides role, aria-modal,
   * aria-label/labelledby, tabIndex and the ref.
   */
  dialogProps: {
    ref: React.RefObject<HTMLDivElement>;
    role: ModalRole;
    "aria-modal": true;
    tabIndex: -1;
    "aria-label"?: string;
    "aria-labelledby"?: string;
  };
  /**
   * A generated id you can place on your title heading when you didn't pass
   * `label` or `labelledBy`. Wiring it is optional but improves a11y.
   */
  titleId: string;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Pure helper: compute the aria-* attributes for a dialog given its labelling
 * inputs. Exported for unit testing without rendering a component.
 */
export function computeDialogAria(opts: {
  role?: ModalRole;
  label?: string;
  labelledBy?: string;
  fallbackTitleId: string;
}): {
  role: ModalRole;
  "aria-modal": true;
  tabIndex: -1;
  "aria-label"?: string;
  "aria-labelledby"?: string;
} {
  const role: ModalRole = opts.role ?? "dialog";
  const base = { role, "aria-modal": true as const, tabIndex: -1 as const };
  if (opts.label) {
    return { ...base, "aria-label": opts.label };
  }
  // labelledBy wins when provided; otherwise fall back to the generated id so
  // the dialog always advertises an accessible name target.
  return { ...base, "aria-labelledby": opts.labelledBy ?? opts.fallbackTitleId };
}

/**
 * Pure helper: returns the list of tabbable elements inside a container, in DOM
 * order. Exported for unit testing of the focus-trap math.
 */
export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

export function useModalA11y(options: UseModalA11yOptions): UseModalA11yResult {
  const { isOpen, onClose, initialFocusRef, role, label, labelledBy, trapFocus = false } = options;

  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const generatedTitleId = useId();

  // Keep the latest onClose in a ref so the keydown listener effect doesn't need
  // to re-bind on every render when the parent passes an inline callback.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Respect inner handlers (e.g. an inline-edit input that cancels on
        // Escape) — if they already consumed the event via preventDefault, do
        // not also close the whole modal. This keeps existing nested behavior.
        if (e.defaultPrevented) return;
        onCloseRef.current();
        return;
      }

      if (trapFocus && e.key === "Tab") {
        const focusable = getFocusableElements(dialogRef.current);
        if (focusable.length === 0) {
          e.preventDefault();
          dialogRef.current?.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || active === dialogRef.current) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [trapFocus]
  );

  // Escape + optional focus-trap key handling, only while open. Bubble phase so
  // inner element handlers run first and can opt out via preventDefault.
  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Focus management: focus the dialog (or initial target) on open, restore on
  // close/unmount.
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Defer to allow the dialog DOM to mount/paint before moving focus.
    const raf =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame(() => {
            const target = initialFocusRef?.current ?? dialogRef.current;
            target?.focus();
          })
        : null;

    return () => {
      if (raf !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(raf);
      }
      const toRestore = previouslyFocused.current;
      if (toRestore && typeof toRestore.focus === "function") {
        toRestore.focus();
      }
    };
  }, [isOpen, initialFocusRef]);

  const dialogProps = {
    ref: dialogRef,
    ...computeDialogAria({ role, label, labelledBy, fallbackTitleId: generatedTitleId }),
  };

  return { dialogRef, dialogProps, titleId: generatedTitleId };
}
