"use client";

import { Trash2 } from "lucide-react";

import { useDialogA11y } from "./useDialogA11y";

interface RemoveConfirmDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Delete-confirmation overlay extracted from ComicDetailModal (R3 / M-CO15).
 * Markup is verbatim from the original; only dialog a11y (role/aria-modal/
 * aria-labelledby + Escape/focus via useDialogA11y) is added.
 */
export function RemoveConfirmDialog({ onConfirm, onCancel }: RemoveConfirmDialogProps) {
  const { titleId, dialogRef } = useDialogA11y(true, onCancel);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-white rounded-xl border-4 border-black p-6 mx-4 max-w-sm w-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <h3 id={titleId} className="text-lg font-black">
            Delete Comic?
          </h3>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          Are you sure you want to delete this comic from your collection?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg border-2 border-black font-bold hover:bg-red-700 transition-colors text-sm"
          >
            Yes, Delete
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg border-2 border-gray-300 font-bold hover:bg-gray-200 transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface ActiveListingWarningDialogProps {
  onDismiss: () => void;
}

/**
 * "Cannot delete — active listing" overlay extracted from ComicDetailModal.
 * Markup verbatim; dialog a11y added.
 */
export function ActiveListingWarningDialog({ onDismiss }: ActiveListingWarningDialogProps) {
  const { titleId, dialogRef } = useDialogA11y(true, onDismiss);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-white rounded-xl border-4 border-yellow-400 p-6 mx-4 max-w-sm w-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-yellow-600" />
          </div>
          <h3 id={titleId} className="text-lg font-black">
            Cannot Delete Comic
          </h3>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          This comic has an active shop listing. You must cancel the listing before deleting it from
          your collection.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onDismiss}
            className="flex-1 px-4 py-2.5 bg-yellow-400 text-black rounded-lg border-2 border-black font-bold hover:bg-yellow-300 transition-colors text-sm"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
