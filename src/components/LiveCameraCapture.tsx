"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Image from "next/image";

import { AlertCircle, Camera, Check, RotateCcw, SwitchCamera, X } from "lucide-react";

import { formatBytes, quickCompress } from "@/lib/imageOptimization";

interface LiveCameraCaptureProps {
  onCapture: (file: File, preview: string) => void;
  onClose: () => void;
}

type CameraState = "requesting" | "active" | "captured" | "error" | "unsupported";

export function LiveCameraCapture({ onCapture, onClose }: LiveCameraCaptureProps) {
  const [cameraState, setCameraState] = useState<CameraState>("requesting");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check for camera support
  const checkCameraSupport = useCallback(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraState("unsupported");
      setErrorMessage(
        "Your browser doesn't support camera access. Please use the file upload option instead."
      );
      return false;
    }
    return true;
  }, []);

  // Check for multiple cameras
  const checkMultipleCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((device) => device.kind === "videoinput");
      setHasMultipleCameras(videoDevices.length > 1);
    } catch {
      setHasMultipleCameras(false);
    }
  }, []);

  // Release any stuck camera streams globally
  const releaseAllCameras = useCallback(async () => {
    try {
      // Get and immediately stop any streams to release cameras
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
    } catch {
      // Ignore - just trying to release
    }
  }, []);

  // Start camera stream
  const startCamera = useCallback(async () => {
    if (!checkCameraSupport()) return;

    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    setCameraState("requesting");
    setErrorMessage("");

    try {
      // First try to release any stuck camera
      await releaseAllCameras();
      await new Promise(resolve => setTimeout(resolve, 300));

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraState("active");
      }

      // Check for multiple cameras after permission granted
      await checkMultipleCameras();
    } catch (err) {
      console.error("Camera error:", err);
      setCameraState("error");

      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setErrorMessage(
            "Camera access was denied. Please allow camera permissions in your browser settings."
          );
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setErrorMessage("No camera found on this device.");
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
          setErrorMessage("Camera is busy. Try closing Chrome completely and reopening, or restart your phone.");
        } else if (err.name === "OverconstrainedError") {
          setErrorMessage("Camera doesn't support the required settings.");
        } else {
          setErrorMessage("Unable to access camera. Please try again or use file upload.");
        }
      } else {
        setErrorMessage("An unexpected error occurred. Please try file upload instead.");
      }
    }
  }, [facingMode, checkCameraSupport, checkMultipleCameras, releaseAllCameras]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Initialize camera on mount
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // Handle camera switch
  const switchCamera = useCallback(() => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    setCapturedImage(null);
    setCameraState("requesting");
  }, []);

  // Restart camera when facing mode changes
  useEffect(() => {
    if (cameraState === "requesting" && !capturedImage) {
      startCamera();
    }
  }, [facingMode, cameraState, capturedImage, startCamera]);

  // Capture photo from video stream
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0);

    // Get image data
    const imageData = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(imageData);
    setCameraState("captured");

    // Stop the camera stream after capture
    stopCamera();
  }, [stopCamera]);

  // Retake photo
  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    startCamera();
  }, [startCamera]);

  // Confirm and submit captured photo with optimized compression
  const confirmCapture = useCallback(async () => {
    if (!capturedImage) return;

    try {
      // Compress the captured image for optimal storage (target 400KB)
      const compressedDataUrl = await quickCompress(capturedImage, 1200, 400 * 1024);

      // Convert to File
      const response = await fetch(compressedDataUrl);
      const blob = await response.blob();
      const file = new File([blob], `comic-${Date.now()}.jpg`, { type: "image/jpeg" });

      // Log compression stats
      const originalSize = Math.round((capturedImage.length * 3) / 4);

      onCapture(file, compressedDataUrl);
    } catch (error) {
      console.error("Error compressing captured image:", error);
      // Fallback to uncompressed if compression fails
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const file = new File([blob], `comic-${Date.now()}.jpg`, { type: "image/jpeg" });
      onCapture(file, capturedImage);
    }
  }, [capturedImage, onCapture]);

  // Handle close
  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
        <button
          onClick={handleClose}
          className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
          aria-label="Close camera"
        >
          <X className="w-6 h-6" />
        </button>
        <span className="text-white font-medium">
          {cameraState === "captured" ? "Review Photo" : "Take Photo"}
        </span>
        {hasMultipleCameras && cameraState === "active" && (
          <button
            onClick={switchCamera}
            className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
            aria-label="Switch camera"
          >
            <SwitchCamera className="w-6 h-6" />
          </button>
        )}
        {(!hasMultipleCameras || cameraState !== "active") && <div className="w-10" />}
      </div>

      {/* Camera View / Captured Image */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {cameraState === "requesting" && (
          <div className="text-center text-white p-4">
            <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <p className="text-lg">Requesting camera access...</p>
            <p className="text-sm text-white/70 mt-2">
              Please allow camera permissions when prompted
            </p>
          </div>
        )}

        {(cameraState === "error" || cameraState === "unsupported") && (
          <div className="text-center text-white p-6 max-w-md">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-lg font-medium mb-2">Camera Unavailable</p>
            <p className="text-sm text-white/70 mb-6">{errorMessage}</p>
            <div className="flex flex-col gap-3">
              {cameraState === "error" && (
                <button
                  onClick={startCamera}
                  className="px-6 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                >
                  Try Again
                </button>
              )}
              <button
                onClick={handleClose}
                className="px-6 py-3 bg-white/20 text-white rounded-lg font-medium hover:bg-white/30 transition-colors"
              >
                Use File Upload Instead
              </button>
            </div>
          </div>
        )}

        {cameraState === "active" && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="max-h-full max-w-full object-contain"
            style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
          />
        )}

        {cameraState === "captured" && capturedImage && (
          <div className="relative w-full h-full">
            <Image
              src={capturedImage}
              alt="Captured photo"
              fill
              className="object-contain"
              unoptimized
            />
          </div>
        )}
      </div>

      {/* Hidden canvas for capturing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-6 bg-gradient-to-t from-black/70 to-transparent">
        {cameraState === "active" && (
          <div className="flex justify-center">
            <button
              onClick={capturePhoto}
              className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform active:scale-95"
              aria-label="Capture photo"
            >
              <Camera className="w-8 h-8 text-gray-900" />
            </button>
          </div>
        )}

        {cameraState === "captured" && (
          <div className="flex justify-center gap-6">
            <button
              onClick={retakePhoto}
              className="flex flex-col items-center gap-2 px-6 py-3 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-colors"
            >
              <RotateCcw className="w-6 h-6" />
              <span className="text-sm font-medium">Retake</span>
            </button>
            <button
              onClick={confirmCapture}
              className="flex flex-col items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
            >
              <Check className="w-6 h-6" />
              <span className="text-sm font-medium">Use Photo</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
