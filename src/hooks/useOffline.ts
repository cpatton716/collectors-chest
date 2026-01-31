"use client";

import { useCallback, useEffect, useState } from "react";

import { v4 as uuidv4 } from "uuid";

import {
  OfflineAction,
  clearOfflineQueue,
  getOfflineQueue,
  removeFromOfflineQueue,
} from "@/lib/offlineCache";
import { storage } from "@/lib/storage";

import { CollectionItem } from "@/types/comic";

export interface UseOfflineReturn {
  isOnline: boolean;
  isOfflineMode: boolean;
  pendingActionsCount: number;
  syncPendingActions: () => Promise<{ synced: number; failed: number }>;
  lastSyncResult: { synced: number; failed: number } | null;
}

export function useOffline(): UseOfflineReturn {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingActionsCount, setPendingActionsCount] = useState(0);
  const [lastSyncResult, setLastSyncResult] = useState<{ synced: number; failed: number } | null>(
    null
  );

  // Initialize online status
  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);
    setPendingActionsCount(getOfflineQueue().length);

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming back online
      syncPendingActions();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    // Listen for service worker messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "SYNC_OFFLINE_ACTIONS") {
        syncPendingActions();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleMessage);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleMessage);
      }
    };
  }, []);

  // Sync pending actions when back online
  const syncPendingActions = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    const queue = getOfflineQueue();
    let synced = 0;
    let failed = 0;

    for (const action of queue) {
      try {
        if (action.type === "add_to_collection") {
          const item = createCollectionItemFromAction(action);
          storage.addToCollection(item);
          removeFromOfflineQueue(action.id);
          synced++;
        }
      } catch (error) {
        console.error("Failed to sync action:", action, error);
        failed++;
      }
    }

    setPendingActionsCount(getOfflineQueue().length);

    const result = { synced, failed };
    if (synced > 0 || failed > 0) {
      setLastSyncResult(result);
      // Clear sync result notification after 5 seconds
      setTimeout(() => setLastSyncResult(null), 5000);
    }

    return result;
  }, []);

  // Update pending count when queue changes
  const updatePendingCount = useCallback(() => {
    setPendingActionsCount(getOfflineQueue().length);
  }, []);

  // Set up interval to check pending count
  useEffect(() => {
    const interval = setInterval(updatePendingCount, 1000);
    return () => clearInterval(interval);
  }, [updatePendingCount]);

  return {
    isOnline,
    isOfflineMode: !isOnline,
    pendingActionsCount,
    syncPendingActions,
    lastSyncResult,
  };
}

// Helper function to create a collection item from an offline action
function createCollectionItemFromAction(action: OfflineAction): CollectionItem {
  const { data } = action;
  return {
    id: uuidv4(),
    comic: {
      id: uuidv4(),
      title: data.title,
      issueNumber: data.issueNumber,
      variant: null,
      publisher: data.publisher || null,
      releaseYear: data.releaseYear || null,
      writer: null,
      coverArtist: null,
      interiorArtist: null,
      confidence: "high",
      isSlabbed: false,
      gradingCompany: null,
      grade: null,
      isSignatureSeries: false,
      signedBy: null,
      keyInfo: data.keyInfo || [],
      certificationNumber: null,
      labelType: null,
      pageQuality: null,
      gradeDate: null,
      graderNotes: null,
      priceData: data.averagePrice
        ? {
            estimatedValue: data.averagePrice,
            recentSales: data.recentSale
              ? [{ ...data.recentSale, source: "Technopathic Estimate", isOlderThan6Months: false }]
              : [],
            mostRecentSaleDate: data.recentSale?.date || null,
            isAveraged: true,
            disclaimer: "Technopathic estimate",
          }
        : null,
    },
    coverImageUrl: data.coverImageUrl || "",
    conditionGrade: data.grade,
    conditionLabel: null,
    isGraded: false,
    gradingCompany: null,
    purchasePrice: null,
    purchaseDate: null,
    notes: "Added from Key Hunt (synced from offline)",
    forSale: false,
    forTrade: false,
    askingPrice: null,
    averagePrice: data.averagePrice,
    dateAdded: new Date(action.timestamp).toISOString(),
    listIds: [],
    isStarred: false,
    customKeyInfo: [],
    customKeyInfoStatus: null,
  };
}

// Hook for service worker registration
export function useServiceWorker() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Register service worker
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        setRegistration(reg);
        setIsRegistered(true);

        // Check for updates
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error("[SW] Service worker registration failed:", error);
      });

    // Handle controller change (new SW activated)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // New service worker has taken control
      setUpdateAvailable(false);
    });
  }, []);

  const updateServiceWorker = useCallback(() => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  }, [registration]);

  return {
    isRegistered,
    registration,
    updateAvailable,
    updateServiceWorker,
  };
}
