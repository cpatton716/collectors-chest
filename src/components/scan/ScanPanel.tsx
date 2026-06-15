"use client";

import { FileSpreadsheet, Info, PenLine } from "lucide-react";

import { GuestLimitBanner } from "@/components/GuestLimitBanner";
import { ImageUpload } from "@/components/ImageUpload";

export function ScanPanel({
  isGuest,
  isLimitReached,
  isSignedIn,
  scanSurfaceRef,
  onImageSelect,
  onManualEntry,
  onOpenCSVImport,
}: {
  isGuest: boolean;
  isLimitReached: boolean;
  isSignedIn: boolean | undefined;
  scanSurfaceRef: React.RefObject<HTMLDivElement>;
  onImageSelect: (file: File, preview: string) => void;
  onManualEntry: () => void;
  onOpenCSVImport: () => void;
}) {
  return (
    <>
      {/* Guest scan limit banner */}
      {isGuest && <GuestLimitBanner variant={isLimitReached ? "warning" : "info"} />}

      {isLimitReached ? (
        <div
          className="bg-pop-white border-3 border-pop-black p-8"
          style={{ boxShadow: "4px 4px 0px #000" }}
        >
          <GuestLimitBanner />
        </div>
      ) : (
        <div
          ref={scanSurfaceRef}
          className="bg-pop-white border-3 border-pop-black p-8 touch-none"
          // touch-action:none locks pinch/double-tap zoom on the camera/scan
          // surface only (H-FE1); the `gesture*` listeners above cover iOS Safari.
          style={{ boxShadow: "4px 4px 0px #000", touchAction: "none" }}
        >
          <ImageUpload onImageSelect={onImageSelect} />

          {/* Foil/shiny cover tip */}
          <p className="flex items-start gap-1.5 mt-3 text-xs text-gray-400">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>For foil, holographic, or shiny covers, photograph at a slight angle to reduce glare for best results.</span>
          </p>

          {/* Alternative add methods */}
          <div className="mt-8 pt-6 border-t-2 border-pop-black">
            <p className="text-sm text-gray-600 text-center mb-4 font-bold uppercase">
              Other ways to add your books:
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={onManualEntry}
                className="flex flex-col items-center justify-center w-36 h-24 bg-pop-white text-pop-black border-2 border-pop-black font-bold hover:shadow-[3px_3px_0px_#000] transition-all"
              >
                <PenLine className="w-7 h-7 mb-2" />
                <span className="text-sm">Enter Manually</span>
              </button>
              {isSignedIn && (
                <button
                  onClick={onOpenCSVImport}
                  className="flex flex-col items-center justify-center w-36 h-24 bg-pop-white text-pop-black border-2 border-pop-black font-bold hover:shadow-[3px_3px_0px_#000] transition-all"
                >
                  <FileSpreadsheet className="w-7 h-7 mb-2" />
                  <span className="text-sm">Import CSV</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
