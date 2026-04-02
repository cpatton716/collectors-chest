"use client";

import { useCallback, useEffect, useState } from "react";

import { Download, Share, Smartphone, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const DISMISS_STORAGE_KEY = "pwa-install-dismissed";
const DISMISS_DURATION_DAYS = 7;

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isIOSChrome, setIsIOSChrome] = useState(false);

  // Check if running on mobile device and platform
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor;
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent.toLowerCase()
      );
      const isIOSDevice = /iphone|ipad|ipod/i.test(userAgent.toLowerCase());
      // Chrome on iOS has "CriOS" in user agent
      const isChromeiOS = isIOSDevice && /crios/i.test(userAgent);
      setIsMobile(isMobileDevice);
      setIsIOS(isIOSDevice);
      setIsIOSChrome(isChromeiOS);
    };

    checkMobile();
  }, []);

  // Check if app is already installed
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if running in standalone mode (already installed)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    setIsInstalled(isStandalone);
  }, []);

  // Check if user dismissed the prompt recently
  const isDismissed = useCallback(() => {
    if (typeof window === "undefined") return true;

    const dismissedAt = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!dismissedAt) return false;

    const dismissedDate = new Date(parseInt(dismissedAt, 10));
    const now = new Date();
    const daysSinceDismissed = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);

    return daysSinceDismissed < DISMISS_DURATION_DAYS;
  }, []);

  // Listen for the beforeinstallprompt event (Android/Chrome)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Only show if on mobile, not installed, and not recently dismissed
      if (isMobile && !isInstalled && !isDismissed()) {
        // Slight delay to not interrupt initial page load
        setTimeout(() => {
          setShowPrompt(true);
        }, 2000);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for successful installation
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, [isMobile, isInstalled, isDismissed]);

  // Show iOS-specific install prompt (Safari doesn't support beforeinstallprompt)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isIOS || isInstalled || isDismissed()) return;

    // Slight delay to not interrupt initial page load
    setTimeout(() => {
      setShowPrompt(true);
    }, 2000);
  }, [isIOS, isInstalled, isDismissed]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setShowPrompt(false);
    }

    // Clear the deferred prompt
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember dismissal
    localStorage.setItem(DISMISS_STORAGE_KEY, Date.now().toString());
  };

  // Don't render if not showing
  if (!showPrompt || isInstalled) return null;

  // iOS Chrome - need to use Safari to install
  if (isIOSChrome) {
    return (
      <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-slide-up">
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-800 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-white" />
              <span className="text-white font-medium text-sm">Install App</span>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* iOS Chrome Instructions */}
          <div className="p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Open in Safari to Install</h3>
            <p className="text-sm text-gray-600 mb-3">
              To install Collectors Chest on your home screen, you&apos;ll need to open this page in
              Safari:
            </p>
            <ol className="text-sm text-gray-600 space-y-2 mb-4">
              <li className="flex items-start gap-2">
                <span className="font-semibold text-primary-600">1.</span>
                <span>
                  Copy this link:{" "}
                  <span className="font-mono text-xs bg-gray-100 px-1 rounded">
                    collectors-chest.com
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-primary-600">2.</span>
                <span>Open Safari and paste the link</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-primary-600">3.</span>
                <span>
                  Tap <Share className="w-4 h-4 inline text-primary-600" /> then &quot;Add to Home
                  Screen&quot;
                </span>
              </li>
            </ol>

            <button
              onClick={handleDismiss}
              className="w-full px-4 py-2.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  }

  // iOS Safari - show share instructions
  if (isIOS) {
    return (
      <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-slide-up">
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-800 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-white" />
              <span className="text-white font-medium text-sm">Install App</span>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* iOS Instructions */}
          <div className="p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Add to Home Screen</h3>
            <p className="text-sm text-gray-600 mb-3">
              Install Collectors Chest for quick access and offline support:
            </p>
            <ol className="text-sm text-gray-600 space-y-2 mb-4">
              <li className="flex items-start gap-2">
                <span className="font-semibold text-primary-600">1.</span>
                <span>
                  Tap the <Share className="w-4 h-4 inline text-primary-600" /> Share button in Safari&apos;s bottom toolbar
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-primary-600">2.</span>
                <span>Scroll down and tap &quot;Add to Home Screen&quot;</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-primary-600">3.</span>
                <span>Tap &quot;Add&quot; in the top right</span>
              </li>
            </ol>

            <button
              onClick={handleDismiss}
              className="w-full px-4 py-2.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Android/Chrome UI with automatic install
  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-slide-up">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-white" />
            <span className="text-white font-medium text-sm">Install App</span>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 mb-1">Add to Home Screen</h3>
          <p className="text-sm text-gray-600 mb-4">
            Install Collectors Chest for quick access and a better experience with offline support.
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleInstall}
              className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
