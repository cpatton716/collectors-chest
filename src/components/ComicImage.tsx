"use client";

import { useState } from "react";

import Image from "next/image";

interface ComicImageProps {
  src: string | null | undefined;
  alt: string;
  /** Aspect ratio - defaults to "2/3" (standard comic). Use "1/1.5" for golden age. Set to "fill" to fill parent container */
  aspectRatio?: "2/3" | "1/1.5" | "1/1" | "4/3" | "fill";
  /** Load this image with priority (for above-fold/hero images) */
  priority?: boolean;
  /** Additional className for the container */
  className?: string;
  /** Object fit mode - defaults to "cover" */
  objectFit?: "cover" | "contain";
  /** Sizes hint for responsive images */
  sizes?: string;
  /** Click handler */
  onClick?: () => void;
}

/**
 * Optimized comic cover image component using Next.js Image.
 * Features:
 * - Automatic lazy loading (unless priority=true)
 * - WebP/AVIF format optimization
 * - Pop-art placeholder for missing/broken images
 * - Consistent aspect ratio handling
 */
export function ComicImage({
  src,
  alt,
  aspectRatio = "2/3",
  priority = false,
  className = "",
  objectFit = "cover",
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px",
  onClick,
}: ComicImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Show placeholder if no src or if image failed to load
  const showPlaceholder = !src || hasError;

  // Convert aspect ratio string to CSS class (empty for "fill" mode)
  const aspectClass =
    aspectRatio === "fill"
      ? "w-full h-full"
      : {
          "2/3": "aspect-[2/3]",
          "1/1.5": "aspect-[1/1.5]",
          "1/1": "aspect-square",
          "4/3": "aspect-[4/3]",
        }[aspectRatio];

  return (
    <div
      className={`relative ${aspectClass} bg-gray-100 overflow-hidden ${className}`}
      onClick={onClick}
    >
      {showPlaceholder ? (
        // Pop-art placeholder for missing/broken images
        <div className="w-full h-full flex items-center justify-center dots-red">
          <span className="font-comic text-6xl text-pop-blue text-comic-outline">?</span>
        </div>
      ) : (
        <>
          {/* Loading skeleton */}
          {isLoading && <div className="absolute inset-0 bg-gray-200 animate-pulse" />}
          <Image
            src={src}
            alt={alt}
            fill
            priority={priority}
            sizes={sizes}
            className={`${objectFit === "cover" ? "object-cover" : "object-contain"} transition-opacity duration-300 ${isLoading ? "opacity-0" : "opacity-100"}`}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setHasError(true);
              setIsLoading(false);
            }}
          />
        </>
      )}
    </div>
  );
}
