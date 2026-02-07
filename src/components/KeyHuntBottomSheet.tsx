"use client";

import { useEffect, useRef, useState } from "react";

import {
  Camera,
  Database,
  History,
  KeyRound,
  PenLine,
  Target,
  WifiOff,
  X,
} from "lucide-react";

import { getKeyHuntHistoryCount } from "@/lib/offlineCache";

import { useKeyHunt } from "@/hooks/useKeyHunt";

type KeyHuntOption = "cover" | "manual" | "offline-search" | "history" | "my-list";

interface KeyHuntBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOption: (option: KeyHuntOption) => void;
  isOffline?: boolean;
}

export function KeyHuntBottomSheet({
  isOpen,
  onClose,
  onSelectOption,
  isOffline = false,
}: KeyHuntBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [historyCount, setHistoryCount] = useState(0);
  const { count: wishlistCount, isSignedIn } = useKeyHunt();

  // Load history count on mount and when opened
  useEffect(() => {
    if (isOpen) {
      setHistoryCount(getKeyHuntHistoryCount());
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Only lock body scroll on mobile — this component is inside md:hidden
      // but React still mounts it on desktop, so guard with a media query check
      const isMobile = window.matchMedia("(max-width: 767px)").matches;
      if (isMobile) {
        document.body.style.overflow = "hidden";
      }
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const options = [
    {
      id: "my-list" as KeyHuntOption,
      icon: Target,
      title: "My Hunt List",
      description:
        wishlistCount > 0
          ? `${wishlistCount} comics you're hunting`
          : isSignedIn
            ? "Start tracking comics you want"
            : "Sign in to track comics",
      color: "bg-amber-500",
      disabled: false,
      badge: wishlistCount > 0 ? wishlistCount : null,
    },
    {
      id: "cover" as KeyHuntOption,
      icon: Camera,
      title: "Scan Cover",
      description: isOffline ? "Not available offline" : "Take a photo of the comic cover",
      color: isOffline ? "bg-gray-400" : "bg-blue-500",
      disabled: isOffline,
      badge: null,
    },
    {
      id: "manual" as KeyHuntOption,
      icon: PenLine,
      title: "Manual Entry",
      description: isOffline
        ? "Check cache for previously looked up comics"
        : "Enter title and issue number",
      color: "bg-purple-500",
      disabled: false,
      badge: null,
    },
    {
      id: "history" as KeyHuntOption,
      icon: History,
      title: "Recent Lookups",
      description:
        historyCount > 0 ? `View your last ${historyCount} lookups` : "No recent lookups yet",
      color: historyCount > 0 ? "bg-indigo-500" : "bg-gray-400",
      disabled: historyCount === 0,
      badge: historyCount > 0 ? historyCount : null,
    },
  ];

  // Add offline search option when offline
  if (isOffline) {
    options.push({
      id: "offline-search" as KeyHuntOption,
      icon: Database,
      title: "Cached Lookups",
      description: "Search your previously looked up comics",
      color: "bg-amber-500",
      disabled: false,
      badge: null,
    });
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl animate-in slide-in-from-bottom duration-300 ease-out"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Key Hunt</h2>
              <div className="flex items-center gap-1.5">
                <p className="text-sm text-gray-500">Quick Price Lookup</p>
                {isOffline && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 rounded text-xs text-amber-700">
                    <WifiOff className="w-3 h-3" />
                    Offline
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Offline Notice */}
        {isOffline && (
          <div className="mx-4 mb-3 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-700">
              You are offline. Only cached lookups are available.
            </p>
          </div>
        )}

        {/* Options */}
        <div className="px-4 pb-20 space-y-3">
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => !option.disabled && onSelectOption(option.id)}
              disabled={option.disabled}
              className={`w-full flex items-center gap-4 p-4 rounded-xl transition-colors text-left ${
                option.disabled
                  ? "bg-gray-50 opacity-60 cursor-not-allowed"
                  : "bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <div
                className={`relative w-12 h-12 ${option.color} rounded-full flex items-center justify-center flex-shrink-0`}
              >
                <option.icon className="w-6 h-6 text-white" />
                {option.badge && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 bg-red-500 rounded-full text-xs font-bold text-white flex items-center justify-center">
                    {option.badge > 99 ? "99+" : option.badge}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`font-semibold ${option.disabled ? "text-gray-500" : "text-gray-900"}`}
                >
                  {option.title}
                </p>
                <p className={`text-sm ${option.disabled ? "text-gray-400" : "text-gray-500"}`}>
                  {option.description}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Safe area padding for iOS */}
        <div className="h-safe-area-inset-bottom" />
      </div>
    </div>
  );
}
