"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Image from "next/image";

import { Camera, FolderOpen, Image as ImageIcon, Upload, X } from "lucide-react";

import { formatBytes, quickCompress } from "@/lib/imageOptimization";
import {
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_LABEL,
} from "@/lib/uploadLimits";

import { LiveCameraCapture } from "./LiveCameraCapture";

interface ImageUploadProps {
  onImageSelect: (file: File, preview: string) => void;
  disabled?: boolean;
}

export function ImageUpload({ onImageSelect, disabled }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showLiveCamera, setShowLiveCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Detect mobile device
    const checkMobile = () => {
      const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.matchMedia("(max-width: 768px)").matches;
      setIsMobile(isTouchDevice && isSmallScreen);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const acceptedTypes = ["image/jpeg", "image/jpg", "image/png"];
  const maxSize = MAX_IMAGE_UPLOAD_BYTES; // Shared cap with server (see uploadLimits.ts)
  const maxDimension = 1200; // Max width/height for compression (reduced from 2048)
  const targetSize = 400 * 1024; // Target ~400KB after compression (reduced from 1.5MB)

  const validateFile = (file: File): string | null => {
    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();

    // Check for HEIC/HEIF by extension if type isn't set (iOS sometimes doesn't set type)
    const isHeic =
      fileName.endsWith(".heic") ||
      fileName.endsWith(".heif") ||
      fileType.includes("heic") ||
      fileType.includes("heif");

    if (!acceptedTypes.includes(fileType) && !isHeic) {
      return "This file type isn't supported. Please use a JPEG, JPG, or PNG image.";
    }
    if (file.size > maxSize) {
      return `This image is too large. Please use an image under ${MAX_IMAGE_UPLOAD_LABEL} or try taking a new photo.`;
    }
    return null;
  };

  // Compress image using optimized compression utility
  const compressImage = useCallback(
    async (file: File): Promise<{ file: File; preview: string }> => {
      try {
        // Use the optimized compression with aggressive settings
        const compressedDataUrl = await quickCompress(file, maxDimension, targetSize);

        // Convert data URL to File
        const response = await fetch(compressedDataUrl);
        const blob = await response.blob();
        const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
          type: "image/jpeg",
        });

        return { file: compressedFile, preview: compressedDataUrl };
      } catch (error) {
        console.error("Compression error:", error);
        throw new Error("Failed to compress image");
      }
    },
    [maxDimension, targetSize]
  );

  const handleFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);

      // Check if HEIC - browser can't process these directly
      const fileName = file.name.toLowerCase();
      const isHeic =
        fileName.endsWith(".heic") ||
        fileName.endsWith(".heif") ||
        file.type.includes("heic") ||
        file.type.includes("heif");

      if (isHeic) {
        setError(
          "HEIC format isn't supported yet. Please take a new photo or convert the image to JPEG first."
        );
        return;
      }

      try {
        // Always compress for optimal storage - target is 400KB
        // Only skip compression if already under 200KB (already optimized)
        const needsCompression = file.size > 200 * 1024;

        if (needsCompression) {
          const { file: compressedFile, preview: compressedPreview } = await compressImage(file);
          setPreview(compressedPreview);
          onImageSelect(compressedFile, compressedPreview);
        } else {
          // Already small enough, use as-is
          const reader = new FileReader();
          reader.onload = (e) => {
            const previewUrl = e.target?.result as string;
            setPreview(previewUrl);
            onImageSelect(file, previewUrl);
          };
          reader.readAsDataURL(file);
        }
      } catch (err) {
        console.error("Error processing image:", err);
        setError("Could not process this image. Please try a different photo.");
      }
    },
    [onImageSelect, compressImage]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const clearImage = () => {
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (galleryInputRef.current) {
      galleryInputRef.current.value = "";
    }
  };

  const handleLiveCameraCapture = (file: File, capturedPreview: string) => {
    setShowLiveCamera(false);
    setError(null);
    setPreview(capturedPreview);
    onImageSelect(file, capturedPreview);
  };

  const handleGallerySelect = () => {
    galleryInputRef.current?.click();
  };

  return (
    <div className="w-full">
      {preview ? (
        <div className="relative">
          <div className="relative aspect-[2/3] max-w-sm mx-auto rounded-lg overflow-hidden shadow-lg">
            <Image
              src={preview}
              alt="Comic cover preview"
              fill
              className="object-cover"
              unoptimized
            />
            {!disabled && (
              <button
                onClick={clearImage}
                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ) : isMobile ? (
        // Mobile: Show camera and gallery buttons
        <div className="space-y-4">
          {/* Primary camera button - uses native device camera */}
          <button
            onClick={() => !disabled && fileInputRef.current?.click()}
            disabled={disabled}
            className={`
              w-full border-2 border-dashed rounded-xl p-8 text-center
              transition-all duration-200 border-primary-400 bg-primary-50 hover:bg-primary-100
              ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 rounded-full bg-primary-100">
                <Camera className="w-10 h-10 text-primary-600" />
              </div>
              <div>
                <p className="text-lg font-medium text-primary-700">Take a Photo</p>
                <p className="text-sm text-primary-600 mt-1">Opens your camera</p>
              </div>
            </div>
          </button>

          {/* Secondary option: Choose from gallery */}
          <button
            onClick={() => !disabled && handleGallerySelect()}
            disabled={disabled}
            className={`
              w-full border-2 border-dashed rounded-xl p-6 text-center
              transition-all duration-200 border-gray-400 hover:border-gray-500 hover:bg-gray-100
              ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
          >
            <div className="flex items-center justify-center gap-3">
              <FolderOpen className="w-6 h-6 text-gray-600" />
              <span className="text-gray-800 font-medium">Choose from Gallery</span>
            </div>
          </button>

          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileInput}
            className="hidden"
            disabled={disabled}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
            disabled={disabled}
          />

          <p className="text-xs text-gray-400 text-center">Supports: JPEG, JPG, PNG (max 10MB)</p>
        </div>
      ) : (
        // Desktop: Drag and drop
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`
            drop-zone relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
            transition-all duration-200
            ${isDragging ? "dragging border-primary-500 bg-primary-50" : "border-gray-300 hover:border-primary-400 hover:bg-gray-50"}
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png"
            onChange={handleFileInput}
            className="hidden"
            disabled={disabled}
          />

          <div className="flex flex-col items-center space-y-4">
            <div className={`p-4 rounded-full ${isDragging ? "bg-primary-100" : "bg-gray-100"}`}>
              {isDragging ? (
                <ImageIcon className="w-10 h-10 text-primary-600" />
              ) : (
                <Upload className="w-10 h-10 text-gray-400" />
              )}
            </div>

            <div>
              <p className="text-lg font-medium text-gray-700">
                {isDragging ? "Drop your comic cover here" : "Upload a comic book cover"}
              </p>
              <p className="text-sm text-gray-500 mt-1">Drag and drop or click to select</p>
              <p className="text-xs text-gray-400 mt-2">Supports: JPEG, JPG, PNG (max 10MB)</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Live Camera Modal */}
      {showLiveCamera && (
        <LiveCameraCapture
          onCapture={handleLiveCameraCapture}
          onClose={() => setShowLiveCamera(false)}
        />
      )}
    </div>
  );
}
