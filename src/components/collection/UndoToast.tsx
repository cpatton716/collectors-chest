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
