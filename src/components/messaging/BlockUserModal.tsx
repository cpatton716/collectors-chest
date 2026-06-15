"use client";

import { useState } from "react";

import { Loader2, ShieldX, X } from "lucide-react";

import { useModalA11y } from "@/hooks/useModalA11y";

interface BlockUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  onBlocked?: () => void;
}

export function BlockUserModal({
  isOpen,
  onClose,
  userId,
  username,
  onBlocked,
}: BlockUserModalProps) {
  const [isBlocking, setIsBlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { dialogProps, titleId } = useModalA11y({ isOpen, onClose, role: "alertdialog" });

  if (!isOpen) return null;

  const handleBlock = async () => {
    setIsBlocking(true);
    setError(null);

    try {
      const res = await fetch(`/api/users/${userId}/block`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to block user");
      }

      onBlocked?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsBlocking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        {...dialogProps}
        className="relative w-full max-w-md rounded-lg border-4 border-pop-black bg-pop-white p-6 shadow-comic outline-none"
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-gray-500 hover:text-pop-black"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-4 rounded-full bg-pop-red/10 p-3">
            <ShieldX className="h-8 w-8 text-pop-red" />
          </div>

          <h2 id={titleId} className="mb-2 text-xl font-black">
            Block {username}?
          </h2>

          <p className="mb-6 text-gray-600">
            They won&apos;t be able to send you messages, and you won&apos;t see their messages. You
            can unblock them later from your settings.
          </p>

          {error && <p className="mb-4 text-sm text-pop-red">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isBlocking}
              className="rounded-lg border-2 border-pop-black px-4 py-2 font-bold transition-all hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleBlock}
              disabled={isBlocking}
              className="flex items-center gap-2 rounded-lg border-2 border-pop-black bg-pop-red px-4 py-2 font-bold text-white transition-all hover:shadow-comic disabled:opacity-50"
            >
              {isBlocking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldX className="h-4 w-4" />
              )}
              Block User
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
