"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { AlertCircle, Camera, Loader2, RefreshCw, Settings, X } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  isProcessing?: boolean;
}

type ScannerState = "starting" | "active" | "error";

export function BarcodeScanner({ onScan, onClose, isProcessing }: BarcodeScannerProps) {
  const [scannerState, setScannerState] = useState<ScannerState>("starting");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Start scanner
  const startScanner = useCallback(async () => {
    if (!containerRef.current) return;

    setScannerState("starting");
    setErrorMessage("");

    try {
      // Create scanner instance
      const scanner = new Html5Qrcode("barcode-reader");
      scannerRef.current = scanner;

      // Get available cameras and prefer back camera
      const cameras = await Html5Qrcode.getCameras();
      if (cameras.length === 0) {
        throw new Error("No cameras found on this device");
      }

      // Find back camera, fallback to first camera
      const backCamera = cameras.find(
        (cam) =>
          cam.label.toLowerCase().includes("back") ||
          cam.label.toLowerCase().includes("rear") ||
          cam.label.toLowerCase().includes("environment")
      );
      const cameraId = backCamera?.id || cameras[0].id;

      // Start scanning
      await scanner.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 280, height: 160 },
        },
        (decodedText) => {
          processBarcode(decodedText);
        },
        () => {
          // QR code scan error - ignore, keep scanning
        }
      );

      setScannerState("active");
    } catch (err) {
      console.error("Scanner error:", err);
      const message = err instanceof Error ? err.message : "Failed to start camera";

      if (message.includes("NotAllowedError") || message.includes("Permission")) {
        setErrorMessage("Camera access was denied. Please allow camera permissions and try again.");
      } else if (message.includes("NotFoundError") || message.includes("No cameras")) {
        setErrorMessage("No camera found on this device.");
      } else if (message.includes("NotReadableError")) {
        setErrorMessage("Camera is in use by another app. Please close other apps and try again.");
      } else {
        setErrorMessage(message);
      }
      setScannerState("error");
    }
  }, [processBarcode]);

  // Stop scanner
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
      scannerRef.current = null;
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, []);

  // Handle close
  const handleClose = useCallback(async () => {
    await stopScanner();
    onClose();
  }, [stopScanner, onClose]);

  // Handle retry
  const handleRetry = useCallback(() => {
    stopScanner().then(() => {
      setLastScannedCode(null);
      startScanner();
    });
  }, [stopScanner, startScanner]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent absolute top-0 left-0 right-0 z-10">
        <h2 className="text-white font-medium flex items-center gap-2">
          <Camera className="w-5 h-5" />
          Scan Barcode
        </h2>
        <button
          onClick={handleClose}
          className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
          disabled={isProcessing}
          aria-label="Close scanner"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Scanner Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {/* Starting State */}
        {scannerState === "starting" && (
          <div className="text-center text-white">
            <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <p className="text-lg font-medium">Starting camera...</p>
            <p className="text-sm text-white/70 mt-2">Please allow camera access when prompted</p>
          </div>
        )}

        {/* Error State */}
        {scannerState === "error" && (
          <div className="text-center text-white max-w-sm px-4">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-lg font-medium mb-2">Camera Unavailable</p>
            <p className="text-sm text-white/70 mb-6">{errorMessage}</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleRetry}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
                Try Again
              </button>
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
              <button
                onClick={handleClose}
                className="px-6 py-3 text-white/70 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Active Scanner - html5-qrcode renders here */}
        <div
          id="barcode-reader"
          ref={containerRef}
          className={`w-full max-w-md ${scannerState === "active" ? "" : "hidden"}`}
          style={{ minHeight: 300 }}
        />

        {scannerState === "active" && (
          <p className="text-white/80 text-sm mt-6 text-center">
            Position the barcode within the frame
          </p>
        )}

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
