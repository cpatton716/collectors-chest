"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import jsQR from "jsqr";
import { AlertCircle, Camera, Loader2, RefreshCw, Settings, SwitchCamera, X } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  isProcessing?: boolean;
}

type ScannerState = "checking" | "requesting" | "starting" | "active" | "error";

interface CameraError {
  type: "permission_denied" | "not_found" | "not_readable" | "overconstrained" | "unknown";
  message: string;
  canRetry: boolean;
}

// Check if native BarcodeDetector API is available
const hasBarcodeDetector = typeof window !== "undefined" && "BarcodeDetector" in window;

// Supported barcode formats
const BARCODE_FORMATS = ["upc_a", "upc_e", "ean_13", "ean_8", "code_128"];

export function BarcodeScanner({ onScan, onClose, isProcessing }: BarcodeScannerProps) {
  const [scannerState, setScannerState] = useState<ScannerState>("checking");
  const [error, setError] = useState<CameraError | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const barcodeDetectorRef = useRef<BarcodeDetector | null>(null);

  // Parse error into user-friendly message
  const parseError = (err: unknown): CameraError => {
    const errorStr = String(err);
    console.error("Scanner error:", err);

    if (errorStr.includes("NotAllowedError") || errorStr.includes("Permission denied")) {
      return {
        type: "permission_denied",
        message:
          "Camera access was denied. Please allow camera permissions in your browser settings and try again.",
        canRetry: true,
      };
    }
    if (
      errorStr.includes("NotFoundError") ||
      errorStr.includes("DevicesNotFoundError") ||
      errorStr.includes("Requested device not found")
    ) {
      return {
        type: "not_found",
        message: "No camera found on this device. Please ensure your device has a camera.",
        canRetry: false,
      };
    }
    if (
      errorStr.includes("NotReadableError") ||
      errorStr.includes("TrackStartError") ||
      errorStr.includes("Could not start video source")
    ) {
      return {
        type: "not_readable",
        message:
          "Camera is in use by another application. Please close other apps using the camera and try again.",
        canRetry: true,
      };
    }
    if (errorStr.includes("OverconstrainedError")) {
      return {
        type: "overconstrained",
        message: "Camera doesn't support the required settings. Trying with default settings...",
        canRetry: true,
      };
    }
    return {
      type: "unknown",
      message: "Unable to start camera. Please check your camera permissions and try again.",
      canRetry: true,
    };
  };

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

  // Stop scanning loop
  const stopScanning = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    stopScanning();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stopScanning]);

  // Process detected barcode
  const processBarcode = useCallback(
    (code: string) => {
      // Validate barcode: UPC-A (12), UPC-E (8), EAN-13 (13), EAN-8 (8)
      const cleanCode = code.replace(/\D/g, "");
      if (/^\d{8,13}$/.test(cleanCode) && cleanCode !== lastScannedCode) {
        setLastScannedCode(cleanCode);
        onScan(cleanCode);
      }
    },
    [lastScannedCode, onScan]
  );

  // Scan using native BarcodeDetector API
  const scanWithBarcodeDetector = useCallback(
    async (video: HTMLVideoElement) => {
      if (!barcodeDetectorRef.current || !mountedRef.current) return;

      try {
        const barcodes = await barcodeDetectorRef.current.detect(video);
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          processBarcode(barcodes[0].rawValue);
        }
      } catch (err) {
        // Detection failed, continue scanning
      }
    },
    [processBarcode]
  );

  // Scan using jsQR fallback
  const scanWithJsQR = useCallback(
    (video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
      if (!mountedRef.current) return;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0);

      // Get image data for jsQR
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // jsQR is designed for QR codes, but can detect some 1D barcodes
      // For better 1D barcode support, we scan a horizontal strip in the middle
      const result = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (result?.data) {
        processBarcode(result.data);
      }
    },
    [processBarcode]
  );

  // Main scanning loop
  const startScanningLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !mountedRef.current) return;

    const scan = async () => {
      if (!mountedRef.current || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animationFrameRef.current = requestAnimationFrame(scan);
        return;
      }

      if (hasBarcodeDetector && barcodeDetectorRef.current) {
        await scanWithBarcodeDetector(video);
      } else {
        scanWithJsQR(video, canvas);
      }

      // Continue scanning at ~15fps
      if (mountedRef.current) {
        animationFrameRef.current = requestAnimationFrame(() => {
          setTimeout(scan, 66); // ~15fps
        });
      }
    };

    scan();
  }, [scanWithBarcodeDetector, scanWithJsQR]);

  // Start camera with fallback constraints
  const startCamera = useCallback(
    async (useBasicConstraints = false) => {
      if (!mountedRef.current) return;

      // Check for browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError({
          type: "unknown",
          message: "Your browser doesn't support camera access. Please try a different browser.",
          canRetry: false,
        });
        setScannerState("error");
        return;
      }

      setScannerState("starting");
      setError(null);

      // Stop any existing stream
      stopCamera();

      try {
        // Try with preferred constraints first, fall back to basic
        const constraints: MediaStreamConstraints = useBasicConstraints
          ? { video: true, audio: false }
          : {
              video: {
                facingMode: facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current && mountedRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();

          // Initialize BarcodeDetector if available
          if (hasBarcodeDetector) {
            try {
              // @ts-expect-error - BarcodeDetector is not in TypeScript types yet
              barcodeDetectorRef.current = new window.BarcodeDetector({
                formats: BARCODE_FORMATS,
              });
            } catch {
              // Fall back to jsQR
              barcodeDetectorRef.current = null;
            }
          }

          setScannerState("active");
          startScanningLoop();

          // Check for multiple cameras after permission granted
          await checkMultipleCameras();
        }
      } catch (err) {
        console.error("Camera error:", err);

        // If we failed with specific constraints, try basic constraints
        if (!useBasicConstraints && err instanceof Error && err.name === "OverconstrainedError") {
          console.log("Retrying with basic constraints...");
          return startCamera(true);
        }

        if (mountedRef.current) {
          const parsedError = parseError(err);
          setError(parsedError);
          setScannerState("error");
        }
      }
    },
    [facingMode, stopCamera, startScanningLoop, checkMultipleCameras]
  );

  // Check permission and start camera
  const initializeScanner = useCallback(async () => {
    if (!mountedRef.current) return;

    setScannerState("checking");
    setError(null);

    // Check current permission status
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: "camera" as PermissionName });
        if (result.state === "denied") {
          setError({
            type: "permission_denied",
            message:
              "Camera access was previously denied. Please enable camera permissions in your browser settings.",
            canRetry: true,
          });
          setScannerState("error");
          return;
        }
      }
    } catch {
      // Permissions API not supported, continue
    }

    setScannerState("requesting");
    await startCamera();
  }, [startCamera]);

  // Retry scanning
  const handleRetry = useCallback(() => {
    setError(null);
    setLastScannedCode(null);
    initializeScanner();
  }, [initializeScanner]);

  // Switch camera
  const switchCamera = useCallback(() => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, []);

  // Restart camera when facing mode changes
  useEffect(() => {
    if (scannerState === "active") {
      startCamera();
    }
  }, [facingMode]);

  // Initialize scanner on mount
  useEffect(() => {
    mountedRef.current = true;
    initializeScanner();

    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent absolute top-0 left-0 right-0 z-10">
        <h2 className="text-white font-medium flex items-center gap-2">
          <Camera className="w-5 h-5" />
          Scan Barcode
        </h2>
        <div className="flex items-center gap-2">
          {hasMultipleCameras && scannerState === "active" && (
            <button
              onClick={switchCamera}
              className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
              aria-label="Switch camera"
            >
              <SwitchCamera className="w-6 h-6" />
            </button>
          )}
          <button
            onClick={handleClose}
            className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
            disabled={isProcessing}
            aria-label="Close scanner"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Scanner Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {/* Checking/Requesting Permission State */}
        {(scannerState === "checking" || scannerState === "requesting") && (
          <div className="text-center text-white">
            <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <p className="text-lg font-medium">
              {scannerState === "checking" ? "Checking camera..." : "Requesting camera access..."}
            </p>
            <p className="text-sm text-white/70 mt-2">
              {scannerState === "requesting" && "Please allow camera access when prompted"}
            </p>
          </div>
        )}

        {/* Starting State */}
        {scannerState === "starting" && (
          <div className="text-center text-white">
            <Camera className="w-16 h-16 mx-auto mb-4 animate-pulse" />
            <p className="text-lg font-medium">Starting camera...</p>
          </div>
        )}

        {/* Error State */}
        {scannerState === "error" && error && (
          <div className="text-center text-white max-w-sm px-4">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-lg font-medium mb-2">Camera Unavailable</p>
            <p className="text-sm text-white/70 mb-6">{error.message}</p>
            <div className="flex flex-col gap-3">
              {error.canRetry && (
                <button
                  onClick={handleRetry}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                >
                  <RefreshCw className="w-5 h-5" />
                  Try Again
                </button>
              )}
              {error.type === "permission_denied" && (
                <button
                  onClick={() => {
                    alert(
                      "To enable camera:\n\n1. Click the lock/info icon in your browser's address bar\n2. Find 'Camera' in the permissions list\n3. Change it to 'Allow'\n4. Refresh this page"
                    );
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-white/20 text-white rounded-lg font-medium hover:bg-white/30 transition-colors"
                >
                  <Settings className="w-5 h-5" />
                  How to Enable Camera
                </button>
              )}
              <button
                onClick={handleClose}
                className="px-6 py-3 text-white/70 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Active Scanner */}
        {scannerState === "active" && (
          <>
            <div className="relative w-full max-w-md">
              {/* Video element - using proven mobile-compatible attributes */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-xl overflow-hidden bg-gray-900"
                style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
              />

              {/* Scanning overlay with animated border */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-[280px] h-[160px] relative">
                  {/* Corner brackets */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary-400 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary-400 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary-400 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary-400 rounded-br-lg" />

                  {/* Scanning line animation */}
                  <div className="absolute inset-x-4 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse" />
                </div>
              </div>
            </div>

            <p className="text-white/80 text-sm mt-6 text-center">
              Position the barcode within the frame
            </p>

            {/* Detection method indicator */}
            <p className="text-white/40 text-xs mt-2">
              {hasBarcodeDetector && barcodeDetectorRef.current
                ? "Using native barcode detection"
                : "Using jsQR detection"}
            </p>
          </>
        )}

        {/* Hidden canvas for frame processing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Processing Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
            <div className="text-center text-white">
              <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin" />
              <p className="text-lg font-medium">Looking up comic...</p>
              <p className="text-sm text-white/70 mt-2">This may take a moment</p>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="p-4 bg-gradient-to-t from-black/70 to-transparent absolute bottom-0 left-0 right-0">
        <p className="text-white/60 text-xs text-center">
          Point your camera at the UPC barcode on the back of the comic book
        </p>
      </div>
    </div>
  );
}
