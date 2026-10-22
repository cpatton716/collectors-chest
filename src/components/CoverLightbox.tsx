"use client";

import { useEffect } from "react";

import Image from "next/image";

import { X } from "lucide-react";

import { isOptimizableImageSrc } from "@/lib/imageSrc";

interface CoverLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  src: string | null | undefined;
  alt: string;
  caption?: string;
}

/**
 * Full-screen cover image viewer for verification (e.g. on the convention floor
 * after a Key Hunt scan, where the small thumbnail isn't enough to confirm
 * AI-recognized variants).
 *
 * Tap backdrop or × to close. Escape closes on desktop.
 *
 * Pinch-zoom is intentionally not wired here - site-level viewport sets
 * maximumScale=1, so browser-native zoom is disabled. If pinch-zoom becomes
 * a need, drop in `react-zoom-pan-pinch` around the <Image> and lift the
 * viewport restriction inside this overlay.
 */
export function CoverLightbox({ isOpen, onClose, src, alt, caption }: CoverLightboxProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !src) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 animate-in fade-in duration-200"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors z-10"
        style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
        aria-label="Close"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      <div
        className="relative w-[95vw] h-[90vh] flex items-center justify-center animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={src}
          unoptimized={!isOptimizableImageSrc(src)}
          alt={alt}
          fill
          sizes="95vw"
          className="object-contain"
          priority
        />
      </div>

      {caption && (
        <p
          className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/90 text-sm font-medium px-3 py-1 bg-black/50 rounded-full max-w-[90vw] truncate"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
        >
          {caption}
        </p>
      )}
    </div>
  );
}
